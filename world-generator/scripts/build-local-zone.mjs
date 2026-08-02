import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MAGIC = 'WAFTLZ01';
const HEADER_BYTES = 80;
const BUILDING_FLOATS = 8;
const ROAD_FLOATS = 4;
const LANDMARK_FLOATS = 5;
const SETTLEMENT_FLOATS = 4;
const NODATA = -32768;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function stableJson(value) {
  const sort = input => {
    if (Array.isArray(input)) return input.map(sort);
    if (input && typeof input === 'object') {
      return Object.fromEntries(Object.keys(input).sort().map(key => [key, sort(input[key])]));
    }
    return input;
  };
  return `${JSON.stringify(sort(value), null, 2)}\n`;
}

function align4(value) {
  return (value + 3) & ~3;
}

function loadZoneContract(regionId, zoneId) {
  const configPath = path.join(ROOT, 'world-generator', 'configs', `${regionId}-local-zones.json`);
  assert(fs.existsSync(configPath), `Missing local-zone config ${configPath}`);
  const config = readJson(configPath);
  assert(config.formatVersion === 1, 'Unsupported local-zone config version');
  assert(config.regionId === regionId, `Local-zone config region mismatch: ${config.regionId}`);
  assert(config.packageFormat === MAGIC, `Local-zone package format mismatch: ${config.packageFormat}`);
  const zone = config.zones.find(item => item.id === zoneId);
  assert(zone, `Unknown local zone ${regionId}/${zoneId}`);
  const defaults = config.defaults ?? {};
  const contract = {
    ...defaults,
    ...zone,
    worldScale: zone.worldScale ?? defaults.worldScale,
    footprintScale: zone.footprintScale ?? defaults.footprintScale,
    verticalScaleMultiplier: zone.verticalScaleMultiplier ?? defaults.verticalScaleMultiplier,
    maxBinaryBytes: zone.maxBinaryBytes ?? defaults.maxBinaryBytes,
    terrainPaddingMinimum: zone.terrainPaddingMinimum ?? defaults.terrainPaddingMinimum,
    terrainPaddingRatio: zone.terrainPaddingRatio ?? defaults.terrainPaddingRatio,
    featurePadding: zone.featurePadding ?? defaults.featurePadding
  };
  for (const field of ['id', 'presetId', 'name']) assert(typeof contract[field] === 'string' && contract[field], `Zone ${zoneId} is missing ${field}`);
  for (const field of ['regionalRadius', 'worldScale', 'footprintScale', 'verticalScaleMultiplier', 'maxBinaryBytes', 'minimumBuildings', 'minimumRoadVertices']) {
    assert(Number.isFinite(contract[field]) && contract[field] > 0, `Zone ${zoneId} has invalid ${field}`);
  }
  return { configPath, config, contract };
}

function parsePreview(buffer) {
  assert(buffer.subarray(0, 8).toString('ascii') === 'WAFTRPV1', 'Invalid regional preview binary');
  const header = {
    version: buffer.readUInt16LE(8),
    headerBytes: buffer.readUInt16LE(10),
    buildingCount: buffer.readUInt32LE(12),
    roadVertexCount: buffer.readUInt32LE(16),
    landmarkCount: buffer.readUInt32LE(20),
    settlementCount: buffer.readUInt32LE(24),
    buildingOffset: buffer.readUInt32LE(28),
    roadOffset: buffer.readUInt32LE(32),
    landmarkOffset: buffer.readUInt32LE(36),
    settlementOffset: buffer.readUInt32LE(40),
    buildingStride: buffer.readUInt16LE(44),
    roadStride: buffer.readUInt16LE(46),
    landmarkStride: buffer.readUInt16LE(48),
    settlementStride: buffer.readUInt16LE(50),
    totalBytes: buffer.readUInt32LE(52)
  };
  assert(header.version === 1 && header.totalBytes === buffer.length, 'Regional preview binary is incomplete');
  assert(header.buildingStride === BUILDING_FLOATS, 'Unexpected regional building stride');
  assert(header.roadStride === ROAD_FLOATS, 'Unexpected regional road stride');
  assert(header.landmarkStride === LANDMARK_FLOATS, 'Unexpected regional landmark stride');
  assert(header.settlementStride === SETTLEMENT_FLOATS, 'Unexpected regional settlement stride');
  return {
    header,
    buildings: new Float32Array(buffer.buffer, buffer.byteOffset + header.buildingOffset, header.buildingCount * header.buildingStride),
    roads: new Float32Array(buffer.buffer, buffer.byteOffset + header.roadOffset, header.roadVertexCount * header.roadStride),
    landmarks: new Float32Array(buffer.buffer, buffer.byteOffset + header.landmarkOffset, header.landmarkCount * header.landmarkStride),
    settlements: new Float32Array(buffer.buffer, buffer.byteOffset + header.settlementOffset, header.settlementCount * header.settlementStride)
  };
}

function parseTerrain(buffer) {
  assert(buffer.subarray(0, 8).toString('ascii') === 'WAFTHGT1', 'Invalid terrain binary');
  const headerBytes = buffer.readUInt16LE(10);
  const columns = buffer.readUInt16LE(12);
  const rows = buffer.readUInt16LE(14);
  return {
    headerBytes,
    columns,
    rows,
    elevations: new Int16Array(buffer.buffer, buffer.byteOffset + headerBytes, columns * rows)
  };
}

function parseLandcover(buffer) {
  assert(buffer.subarray(0, 8).toString('ascii') === 'WAFTLCV1', 'Invalid landcover binary');
  const headerBytes = buffer.readUInt16LE(10);
  const columns = buffer.readUInt16LE(12);
  const rows = buffer.readUInt16LE(14);
  return {
    headerBytes,
    columns,
    rows,
    classes: new Uint8Array(buffer.buffer, buffer.byteOffset + headerBytes, columns * rows)
  };
}

function segmentDistance(px, pz, ax, az, bx, bz) {
  const vx = bx - ax;
  const vz = bz - az;
  const denominator = vx * vx + vz * vz || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / denominator));
  return Math.hypot(px - (ax + vx * t), pz - (az + vz * t));
}

function cropTerrain(terrain, landcover, bounds, center, radius, contract) {
  assert(terrain.columns === landcover.columns && terrain.rows === landcover.rows, 'Terrain and landcover grids differ');
  const pad = Math.max(contract.terrainPaddingMinimum, radius * contract.terrainPaddingRatio);
  const requested = {
    minX: center.x - radius - pad,
    maxX: center.x + radius + pad,
    minZ: center.z - radius - pad,
    maxZ: center.z + radius + pad
  };
  const columnForX = x => (x - bounds.minX) / (bounds.maxX - bounds.minX) * (terrain.columns - 1);
  const rowForZ = z => (z - bounds.minZ) / (bounds.maxZ - bounds.minZ) * (terrain.rows - 1);
  const minColumn = Math.max(0, Math.floor(columnForX(requested.minX)) - 1);
  const maxColumn = Math.min(terrain.columns - 1, Math.ceil(columnForX(requested.maxX)) + 1);
  const minRow = Math.max(0, Math.floor(rowForZ(requested.minZ)) - 1);
  const maxRow = Math.min(terrain.rows - 1, Math.ceil(rowForZ(requested.maxZ)) + 1);
  const columns = maxColumn - minColumn + 1;
  const rows = maxRow - minRow + 1;
  const elevations = new Int16Array(columns * rows);
  const classes = new Uint8Array(columns * rows);
  let landCells = 0;
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const sourceIndex = (minRow + row) * terrain.columns + minColumn + column;
      const targetIndex = row * columns + column;
      elevations[targetIndex] = terrain.elevations[sourceIndex];
      classes[targetIndex] = landcover.classes[sourceIndex];
      if (elevations[targetIndex] !== NODATA) landCells++;
    }
  }
  const dx = (bounds.maxX - bounds.minX) / (terrain.columns - 1);
  const dz = (bounds.maxZ - bounds.minZ) / (terrain.rows - 1);
  return {
    columns,
    rows,
    elevations,
    classes,
    landCells,
    regionalBounds: {
      minX: bounds.minX + minColumn * dx,
      maxX: bounds.minX + maxColumn * dx,
      minZ: bounds.minZ + minRow * dz,
      maxZ: bounds.minZ + maxRow * dz
    },
    sourceWindow: { minColumn, maxColumn, minRow, maxRow }
  };
}

function filterBuildings(records, center, radius, featurePadding) {
  const selected = [];
  const limit = radius + featurePadding;
  for (let offset = 0; offset < records.length; offset += BUILDING_FLOATS) {
    if (Math.hypot(records[offset] - center.x, records[offset + 2] - center.z) > limit) continue;
    for (let index = 0; index < BUILDING_FLOATS; index++) selected.push(records[offset + index]);
  }
  return new Float32Array(selected);
}

function filterRoads(records, center, radius, featurePadding) {
  const selected = [];
  const limit = radius + featurePadding;
  for (let offset = 0; offset < records.length; offset += ROAD_FLOATS * 2) {
    const ax = records[offset];
    const az = records[offset + 2];
    const bx = records[offset + ROAD_FLOATS];
    const bz = records[offset + ROAD_FLOATS + 2];
    if (segmentDistance(center.x, center.z, ax, az, bx, bz) > limit) continue;
    for (let index = 0; index < ROAD_FLOATS * 2; index++) selected.push(records[offset + index]);
  }
  return new Float32Array(selected);
}

function filterPoints(records, stride, labels, center, radius) {
  const selected = [];
  const selectedLabels = [];
  for (let offset = 0, itemIndex = 0; offset < records.length; offset += stride, itemIndex++) {
    if (Math.hypot(records[offset] - center.x, records[offset + 2] - center.z) > radius) continue;
    for (let index = 0; index < stride; index++) selected.push(records[offset + index]);
    if (labels?.[itemIndex]) selectedLabels.push(labels[itemIndex]);
  }
  return { records: new Float32Array(selected), labels: selectedLabels };
}

function writeTypedArray(buffer, offset, array) {
  Buffer.from(array.buffer, array.byteOffset, array.byteLength).copy(buffer, offset);
}

function build() {
  const regionId = process.argv[2] ?? 'baleares';
  const zoneId = process.argv[3] ?? 'llevant';
  const { configPath, contract } = loadZoneContract(regionId, zoneId);
  const regionDirectory = path.join(ROOT, 'regions', regionId);
  const previewDirectory = path.join(regionDirectory, 'preview');
  const outputDirectory = path.join(regionDirectory, 'local', zoneId);
  fs.mkdirSync(outputDirectory, { recursive: true });

  const metadataPath = path.join(previewDirectory, `${regionId}-preview-v1.json`);
  const previewPath = path.join(previewDirectory, `${regionId}-preview-v1.bin`);
  const terrainPath = path.join(regionDirectory, 'terrain.bin');
  const landcoverPath = path.join(regionDirectory, 'landcover.bin');
  for (const filePath of [metadataPath, previewPath, terrainPath, landcoverPath]) {
    assert(fs.existsSync(filePath), `Missing ${filePath}`);
  }

  const regionalMetadata = readJson(metadataPath);
  assert(regionalMetadata.regionId === regionId, 'Regional preview metadata mismatch');
  const previewBuffer = fs.readFileSync(previewPath);
  const preview = parsePreview(previewBuffer);
  const terrainBuffer = fs.readFileSync(terrainPath);
  const landcoverBuffer = fs.readFileSync(landcoverPath);
  const terrain = parseTerrain(terrainBuffer);
  const landcover = parseLandcover(landcoverBuffer);
  const preset = regionalMetadata.presets.find(item => item.id === contract.presetId);
  assert(preset, `Missing preset ${contract.presetId} for local zone ${zoneId}`);

  const center = { x: preset.x, z: preset.z };
  const regionalRadius = contract.regionalRadius;
  const worldScale = contract.worldScale;
  const footprintScale = contract.footprintScale;
  const crop = cropTerrain(terrain, landcover, regionalMetadata.terrain.localBounds, center, regionalRadius, contract);
  const buildings = filterBuildings(preview.buildings, center, regionalRadius, contract.featurePadding);
  const roads = filterRoads(preview.roads, center, regionalRadius, contract.featurePadding);
  const landmarks = filterPoints(preview.landmarks, LANDMARK_FLOATS, regionalMetadata.landmarks, center, regionalRadius);
  const settlements = filterPoints(preview.settlements, SETTLEMENT_FLOATS, regionalMetadata.settlements, center, regionalRadius);
  const buildingCount = buildings.length / BUILDING_FLOATS;
  const roadVertexCount = roads.length / ROAD_FLOATS;

  assert(buildingCount >= contract.minimumBuildings, `${zoneId} local zone has too few buildings: ${buildingCount} < ${contract.minimumBuildings}`);
  assert(roadVertexCount >= contract.minimumRoadVertices, `${zoneId} local zone has too few road vertices: ${roadVertexCount} < ${contract.minimumRoadVertices}`);
  assert(crop.landCells > 0, `${zoneId} local terrain has no land`);

  const terrainOffset = HEADER_BYTES;
  const landcoverOffset = terrainOffset + crop.elevations.byteLength;
  const buildingOffset = align4(landcoverOffset + crop.classes.byteLength);
  const roadOffset = buildingOffset + buildings.byteLength;
  const landmarkOffset = roadOffset + roads.byteLength;
  const settlementOffset = landmarkOffset + landmarks.records.byteLength;
  const totalBytes = settlementOffset + settlements.records.byteLength;
  assert(totalBytes <= contract.maxBinaryBytes, `${zoneId} local package exceeds ${contract.maxBinaryBytes} bytes: ${totalBytes}`);

  const binary = Buffer.alloc(totalBytes);
  binary.write(MAGIC, 0, 8, 'ascii');
  binary.writeUInt16LE(1, 8);
  binary.writeUInt16LE(HEADER_BYTES, 10);
  binary.writeUInt16LE(crop.columns, 12);
  binary.writeUInt16LE(crop.rows, 14);
  binary.writeUInt32LE(buildingCount, 16);
  binary.writeUInt32LE(roadVertexCount, 20);
  binary.writeUInt32LE(landmarks.records.length / LANDMARK_FLOATS, 24);
  binary.writeUInt32LE(settlements.records.length / SETTLEMENT_FLOATS, 28);
  binary.writeUInt32LE(terrainOffset, 32);
  binary.writeUInt32LE(landcoverOffset, 36);
  binary.writeUInt32LE(buildingOffset, 40);
  binary.writeUInt32LE(roadOffset, 44);
  binary.writeUInt32LE(landmarkOffset, 48);
  binary.writeUInt32LE(settlementOffset, 52);
  binary.writeUInt16LE(BUILDING_FLOATS, 56);
  binary.writeUInt16LE(ROAD_FLOATS, 58);
  binary.writeUInt16LE(LANDMARK_FLOATS, 60);
  binary.writeUInt16LE(SETTLEMENT_FLOATS, 62);
  binary.writeUInt32LE(totalBytes, 64);
  binary.writeUInt32LE(crop.columns * crop.rows, 68);
  binary.writeInt32LE(NODATA, 72);
  binary.writeUInt32LE(buildingOffset - (landcoverOffset + crop.classes.byteLength), 76);
  writeTypedArray(binary, terrainOffset, crop.elevations);
  writeTypedArray(binary, landcoverOffset, crop.classes);
  writeTypedArray(binary, buildingOffset, buildings);
  writeTypedArray(binary, roadOffset, roads);
  writeTypedArray(binary, landmarkOffset, landmarks.records);
  writeTypedArray(binary, settlementOffset, settlements.records);

  const binaryName = `${zoneId}-local-v1.bin`;
  const metadataName = `${zoneId}-local-v1.json`;
  const binaryPath = path.join(outputDirectory, binaryName);
  fs.writeFileSync(binaryPath, binary);

  const sourceFingerprint = sha256(Buffer.concat([
    fs.readFileSync(metadataPath),
    previewBuffer,
    terrainBuffer,
    landcoverBuffer,
    fs.readFileSync(configPath),
    fs.readFileSync(fileURLToPath(import.meta.url))
  ]));
  const metadata = {
    formatVersion: 1,
    packageType: 'waft-local-zone',
    regionId,
    zoneId,
    presetId: contract.presetId,
    name: contract.name,
    buildId: `${regionId}-${zoneId}-${sourceFingerprint.slice(0, 12)}`,
    deterministic: true,
    coordinateSpace: 'regional-local-window',
    center,
    regionalRadius,
    worldScale,
    footprintScale,
    verticalScaleMultiplier: contract.verticalScaleMultiplier,
    regionalBounds: crop.regionalBounds,
    displayBounds: {
      minX: (crop.regionalBounds.minX - center.x) * worldScale,
      maxX: (crop.regionalBounds.maxX - center.x) * worldScale,
      minZ: (crop.regionalBounds.minZ - center.z) * worldScale,
      maxZ: (crop.regionalBounds.maxZ - center.z) * worldScale
    },
    terrain: {
      columns: crop.columns,
      rows: crop.rows,
      cells: crop.columns * crop.rows,
      landCells: crop.landCells,
      sourceWindow: crop.sourceWindow
    },
    counts: {
      buildings: buildingCount,
      roadVertices: roadVertexCount,
      roadSegments: roadVertexCount / 2,
      landmarks: landmarks.records.length / LANDMARK_FLOATS,
      settlements: settlements.records.length / SETTLEMENT_FLOATS
    },
    labels: {
      landmarks: landmarks.labels,
      settlements: settlements.labels
    },
    binary: {
      file: binaryName,
      bytes: binary.length,
      sha256: sha256(binary),
      magic: MAGIC,
      headerBytes: HEADER_BYTES,
      floatAlignmentPadding: buildingOffset - (landcoverOffset + crop.classes.byteLength)
    },
    contract: {
      minimumBuildings: contract.minimumBuildings,
      minimumRoadVertices: contract.minimumRoadVertices,
      maxBinaryBytes: contract.maxBinaryBytes,
      featurePadding: contract.featurePadding
    },
    source: {
      regionalBuildId: regionalMetadata.buildId,
      regionalBinarySha256: regionalMetadata.binary.sha256,
      configFile: path.relative(ROOT, configPath).replaceAll(path.sep, '/'),
      fingerprint: sourceFingerprint
    }
  };
  fs.writeFileSync(path.join(outputDirectory, metadataName), stableJson(metadata));

  const report = {
    formatVersion: 1,
    valid: true,
    regionId,
    zoneId,
    buildId: metadata.buildId,
    binaryBytes: binary.length,
    binarySha256: metadata.binary.sha256,
    terrain: metadata.terrain,
    counts: metadata.counts,
    worldScale,
    footprintScale,
    regionalRadius,
    floatAlignmentPadding: metadata.binary.floatAlignmentPadding
  };
  fs.writeFileSync(path.join(ROOT, 'world-generator', `${regionId}-${zoneId}-local-build.json`), stableJson(report));
  process.stdout.write(stableJson(report));
}

try {
  build();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
