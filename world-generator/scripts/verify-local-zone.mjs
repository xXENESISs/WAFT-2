import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MAGIC = 'WAFTLZ01';
const HEADER_BYTES = 80;
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
  return `${JSON.stringify(value, null, 2)}\n`;
}

function verify() {
  const regionId = process.argv[2] ?? 'baleares';
  const zoneId = process.argv[3] ?? 'llevant';
  const directory = path.join(ROOT, 'regions', regionId, 'local', zoneId);
  const metadataPath = path.join(directory, 'llevant-local-v1.json');
  const binaryPath = path.join(directory, 'llevant-local-v1.bin');
  assert(fs.existsSync(metadataPath), `Missing ${metadataPath}`);
  assert(fs.existsSync(binaryPath), `Missing ${binaryPath}`);

  const metadata = readJson(metadataPath);
  const buffer = fs.readFileSync(binaryPath);
  assert(metadata.packageType === 'waft-local-zone', 'Invalid package type');
  assert(metadata.regionId === regionId && metadata.zoneId === zoneId, 'Region or zone mismatch');
  assert(metadata.deterministic === true, 'Local package is not deterministic');
  assert(metadata.binary.sha256 === sha256(buffer), 'Local package SHA-256 mismatch');
  assert(metadata.binary.bytes === buffer.length, 'Local package byte count mismatch');
  assert(buffer.subarray(0, 8).toString('ascii') === MAGIC, 'Invalid local package magic');

  const header = {
    version: buffer.readUInt16LE(8),
    headerBytes: buffer.readUInt16LE(10),
    columns: buffer.readUInt16LE(12),
    rows: buffer.readUInt16LE(14),
    buildingCount: buffer.readUInt32LE(16),
    roadVertexCount: buffer.readUInt32LE(20),
    landmarkCount: buffer.readUInt32LE(24),
    settlementCount: buffer.readUInt32LE(28),
    terrainOffset: buffer.readUInt32LE(32),
    landcoverOffset: buffer.readUInt32LE(36),
    buildingOffset: buffer.readUInt32LE(40),
    roadOffset: buffer.readUInt32LE(44),
    landmarkOffset: buffer.readUInt32LE(48),
    settlementOffset: buffer.readUInt32LE(52),
    buildingStride: buffer.readUInt16LE(56),
    roadStride: buffer.readUInt16LE(58),
    landmarkStride: buffer.readUInt16LE(60),
    settlementStride: buffer.readUInt16LE(62),
    totalBytes: buffer.readUInt32LE(64),
    terrainCells: buffer.readUInt32LE(68),
    nodata: buffer.readInt32LE(72)
  };

  assert(header.version === 1 && header.headerBytes === HEADER_BYTES, 'Unsupported local package version');
  assert(header.totalBytes === buffer.length, 'Local package length mismatch');
  assert(header.columns === metadata.terrain.columns && header.rows === metadata.terrain.rows, 'Terrain dimensions mismatch');
  assert(header.terrainCells === header.columns * header.rows, 'Terrain cell count mismatch');
  assert(header.nodata === NODATA, 'Unexpected terrain nodata value');
  assert(header.buildingStride === 8 && header.roadStride === 4 && header.landmarkStride === 5 && header.settlementStride === 4, 'Record stride mismatch');
  assert(header.terrainOffset === HEADER_BYTES, 'Terrain offset mismatch');
  assert(header.landcoverOffset === header.terrainOffset + header.terrainCells * 2, 'Landcover offset mismatch');
  assert(header.buildingOffset === header.landcoverOffset + header.terrainCells, 'Building offset mismatch');
  assert(header.roadOffset === header.buildingOffset + header.buildingCount * header.buildingStride * 4, 'Road offset mismatch');
  assert(header.landmarkOffset === header.roadOffset + header.roadVertexCount * header.roadStride * 4, 'Landmark offset mismatch');
  assert(header.settlementOffset === header.landmarkOffset + header.landmarkCount * header.landmarkStride * 4, 'Settlement offset mismatch');
  assert(buffer.length === header.settlementOffset + header.settlementCount * header.settlementStride * 4, 'Unexpected binary tail');

  assert(header.buildingCount === metadata.counts.buildings, 'Building count mismatch');
  assert(header.roadVertexCount === metadata.counts.roadVertices, 'Road vertex count mismatch');
  assert(header.landmarkCount === metadata.counts.landmarks, 'Landmark count mismatch');
  assert(header.settlementCount === metadata.counts.settlements, 'Settlement count mismatch');
  assert(header.buildingCount >= 250 && header.buildingCount < 5866, `Invalid local building count: ${header.buildingCount}`);
  assert(header.roadVertexCount >= 600 && header.roadVertexCount < 34092, `Invalid local road vertex count: ${header.roadVertexCount}`);
  assert(header.columns < 512 && header.rows < 256, `Terrain was not cropped: ${header.columns}x${header.rows}`);
  assert(metadata.worldScale === 12 && metadata.footprintScale === 4, 'Local scale contract changed');
  assert(metadata.regionalRadius === 18, 'Local radius contract changed');
  assert(buffer.length < 2 * 1024 * 1024, `Local package is too large: ${buffer.length}`);

  let landCells = 0;
  const terrainStart = header.terrainOffset;
  const landcoverStart = header.landcoverOffset;
  for (let index = 0; index < header.terrainCells; index++) {
    const elevation = buffer.readInt16LE(terrainStart + index * 2);
    const landcover = buffer[landcoverStart + index];
    if (elevation === NODATA) assert(landcover === 0, `Water cell ${index} has landcover ${landcover}`);
    else {
      assert(elevation >= 0, `Negative land elevation at ${index}`);
      assert(landcover !== 0, `Land cell ${index} is classified as water`);
      landCells++;
    }
  }
  assert(landCells === metadata.terrain.landCells, 'Land cell count mismatch');
  assert(landCells > 0, 'Local terrain has no land');

  const radiusLimit = metadata.regionalRadius + 2.5;
  for (let index = 0; index < header.buildingCount; index++) {
    const offset = header.buildingOffset + index * header.buildingStride * 4;
    const x = buffer.readFloatLE(offset);
    const z = buffer.readFloatLE(offset + 8);
    assert(Math.hypot(x - metadata.center.x, z - metadata.center.z) <= radiusLimit, `Building ${index} lies outside local package`);
  }
  for (let index = 0; index < header.roadVertexCount; index++) {
    const offset = header.roadOffset + index * header.roadStride * 4;
    const x = buffer.readFloatLE(offset);
    const z = buffer.readFloatLE(offset + 8);
    assert(Number.isFinite(x) && Number.isFinite(z), `Road vertex ${index} is invalid`);
  }

  const report = {
    formatVersion: 1,
    valid: true,
    regionId,
    zoneId,
    buildId: metadata.buildId,
    binaryBytes: buffer.length,
    binarySha256: metadata.binary.sha256,
    terrain: metadata.terrain,
    counts: metadata.counts,
    worldScale: metadata.worldScale,
    footprintScale: metadata.footprintScale,
    regionalRadius: metadata.regionalRadius
  };
  const reportPath = path.join(ROOT, 'world-generator', `${regionId}-${zoneId}-local-validation.json`);
  fs.writeFileSync(reportPath, stableJson(report));
  process.stdout.write(stableJson(report));
}

try {
  verify();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
