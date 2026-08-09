import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { decodeTerrainHeader, REGION_BINARY_FORMAT } from '../lib/binary-formats.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MAGIC = 'WAFTRPV1';
const HEADER_BYTES = 80;
const BUILDING_FLOATS = 8;
const ROAD_FLOATS = 4;
const LANDMARK_FLOATS = 5;
const SETTLEMENT_FLOATS = 4;
const MAX_ROADS = 12500;
const MAX_ROAD_SEGMENTS = 90000;

const BUILDING_KINDS = Object.freeze({ ordinary: 0, hotel: 1, religious: 2, historic: 3, public: 4, commercial: 5 });
const ROAD_CLASSES = Object.freeze({
  motorway: 0, motorway_link: 0, trunk: 1, trunk_link: 1, primary: 2, primary_link: 2,
  secondary: 3, secondary_link: 3, tertiary: 4, tertiary_link: 4, residential: 5,
  living_street: 5, unclassified: 6, service: 6, track: 7, path: 8, footway: 8,
  cycleway: 9, bridleway: 9, pedestrian: 8, steps: 10
});
const ROAD_PRIORITY = Object.freeze({
  motorway: 100, motorway_link: 98, trunk: 96, trunk_link: 94, primary: 92, primary_link: 90,
  secondary: 84, secondary_link: 82, tertiary: 76, tertiary_link: 74, residential: 52,
  living_street: 50, unclassified: 46, service: 35, track: 30, cycleway: 27,
  pedestrian: 25, footway: 23, path: 21, bridleway: 20, steps: 18
});
const REPRESENTATIONS = Object.freeze({ archetype: 0, marker: 0, 'unique-candidate': 1, unique: 2 });

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function stableJson(value) {
  const sort = input => {
    if (Array.isArray(input)) return input.map(sort);
    if (input && typeof input === 'object') return Object.fromEntries(Object.keys(input).sort().map(key => [key, sort(input[key])]));
    return input;
  };
  return `${JSON.stringify(sort(value), null, 2)}\n`;
}

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function hashText(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function sourceFingerprint(paths) {
  const hash = crypto.createHash('sha256');
  for (const filePath of paths) {
    const relative = path.relative(ROOT, filePath).replaceAll(path.sep, '/');
    hash.update(relative);
    hash.update(fs.readFileSync(filePath));
  }
  return hash.digest('hex');
}

function createTerrainSampler(terrainBuffer, terrain, localBounds) {
  const read = (column, row) => terrainBuffer.readInt16LE(terrain.headerBytes + (row * terrain.columns + column) * 2);
  return (x, z) => {
    const column = Math.max(0, Math.min(terrain.columns - 1, Math.round((x - localBounds.minX) / (localBounds.maxX - localBounds.minX) * (terrain.columns - 1))));
    const row = Math.max(0, Math.min(terrain.rows - 1, Math.round((z - localBounds.minZ) / (localBounds.maxZ - localBounds.minZ) * (terrain.rows - 1))));
    const direct = read(column, row);
    if (direct !== REGION_BINARY_FORMAT.nodataElevation) return direct;
    for (let radius = 1; radius <= 4; radius++) {
      let best = null;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          const cx = column + dx;
          const cy = row + dy;
          if (cx < 0 || cy < 0 || cx >= terrain.columns || cy >= terrain.rows) continue;
          const elevation = read(cx, cy);
          if (elevation === REGION_BINARY_FORMAT.nodataElevation) continue;
          const distance = dx * dx + dy * dy;
          if (!best || distance < best.distance) best = { elevation, distance };
        }
      }
      if (best) return best.elevation;
    }
    return 0;
  };
}

function orientedBounds(footprint, fallbackX, fallbackZ) {
  const points = (footprint ?? []).slice(0, -1).filter(point => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]));
  if (points.length < 3) return { x: fallbackX, z: fallbackZ, width: .08, depth: .08, angle: 0 };
  let meanX = 0;
  let meanZ = 0;
  for (const point of points) { meanX += point[0]; meanZ += point[1]; }
  meanX /= points.length;
  meanZ /= points.length;
  let xx = 0;
  let zz = 0;
  let xz = 0;
  for (const point of points) {
    const dx = point[0] - meanX;
    const dz = point[1] - meanZ;
    xx += dx * dx;
    zz += dz * dz;
    xz += dx * dz;
  }
  const angle = .5 * Math.atan2(2 * xz, xx - zz);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  let minA = Infinity;
  let maxA = -Infinity;
  let minB = Infinity;
  let maxB = -Infinity;
  for (const point of points) {
    const dx = point[0] - meanX;
    const dz = point[1] - meanZ;
    const a = dx * cos + dz * sin;
    const b = -dx * sin + dz * cos;
    minA = Math.min(minA, a);
    maxA = Math.max(maxA, a);
    minB = Math.min(minB, b);
    maxB = Math.max(maxB, b);
  }
  const centerA = (minA + maxA) * .5;
  const centerB = (minB + maxB) * .5;
  return {
    x: meanX + centerA * cos - centerB * sin,
    z: meanZ + centerA * sin + centerB * cos,
    width: Math.max(.025, Math.min(2.8, maxA - minA)),
    depth: Math.max(.025, Math.min(2.8, maxB - minB)),
    angle
  };
}

function buildBuildings(objects) {
  const records = new Float32Array(objects.items.length * BUILDING_FLOATS);
  const kinds = {};
  let hotels = 0;
  let named = 0;
  for (let index = 0; index < objects.items.length; index++) {
    const building = objects.items[index];
    const bounds = orientedBounds(building.footprint, building.local.x, building.local.z);
    const kind = BUILDING_KINDS[building.kind] ?? 0;
    const offset = index * BUILDING_FLOATS;
    records[offset] = bounds.x;
    records[offset + 1] = building.local.y;
    records[offset + 2] = bounds.z;
    records[offset + 3] = bounds.width;
    records[offset + 4] = Math.max(2.5, Math.min(90, building.heightMeters ?? 6));
    records[offset + 5] = bounds.depth;
    records[offset + 6] = bounds.angle;
    records[offset + 7] = kind;
    kinds[building.kind] = (kinds[building.kind] ?? 0) + 1;
    if (building.kind === 'hotel') hotels++;
    if (building.name) named++;
  }
  return { records, kinds, hotels, named };
}

function roadRank(road) {
  const base = ROAD_PRIORITY[road.class] ?? 0;
  const named = road.name ? 18 : 0;
  const bridge = road.bridge && road.bridge !== 'no' ? 4 : 0;
  const deterministic = (hashText(road.id) % 1000) / 1000;
  return base + named + bridge + deterministic;
}

function roadKeepChance(road) {
  if ((ROAD_PRIORITY[road.class] ?? 0) >= 74) return true;
  if (road.name && (ROAD_PRIORITY[road.class] ?? 0) >= 35) return true;
  const modulus = road.class === 'residential' || road.class === 'living_street' ? 5
    : road.class === 'unclassified' || road.class === 'service' ? 8 : 12;
  return hashText(road.id) % modulus === 0;
}

function buildRoads(routes, sampleTerrain) {
  const candidates = routes.roads
    .filter(road => road.points?.length >= 2 && ROAD_CLASSES[road.class] !== undefined && roadKeepChance(road))
    .sort((a, b) => roadRank(b) - roadRank(a) || a.id.localeCompare(b.id));
  const selected = [];
  let segments = 0;
  for (const road of candidates) {
    const count = road.points.length - 1;
    if (selected.length >= MAX_ROADS || segments + count > MAX_ROAD_SEGMENTS) continue;
    selected.push(road);
    segments += count;
  }
  const records = new Float32Array(segments * 2 * ROAD_FLOATS);
  const classes = {};
  let cursor = 0;
  for (const road of selected) {
    const classCode = ROAD_CLASSES[road.class];
    classes[road.class] = (classes[road.class] ?? 0) + 1;
    for (let pointIndex = 0; pointIndex < road.points.length - 1; pointIndex++) {
      for (const point of [road.points[pointIndex], road.points[pointIndex + 1]]) {
        records[cursor++] = point[0];
        records[cursor++] = sampleTerrain(point[0], point[1]);
        records[cursor++] = point[1];
        records[cursor++] = classCode;
      }
    }
  }
  return { records, classes, selectedRoads: selected.length, segments };
}

function buildLandmarks(document) {
  const records = new Float32Array(document.items.length * LANDMARK_FLOATS);
  const labels = [];
  const representations = {};
  for (let index = 0; index < document.items.length; index++) {
    const item = document.items[index];
    const representation = REPRESENTATIONS[item.preferredRepresentation] ?? 0;
    const offset = index * LANDMARK_FLOATS;
    records[offset] = item.local.x;
    records[offset + 1] = item.local.y;
    records[offset + 2] = item.local.z;
    records[offset + 3] = item.finalScore ?? item.score ?? (item.preferredRepresentation === 'unique' ? 100 : 50);
    records[offset + 4] = representation;
    labels.push({
      id: item.id,
      name: item.name ?? item.wikidata?.label ?? item.id,
      type: item.type,
      representation: item.preferredRepresentation,
      wikidataId: item.wikidata?.id ?? item.tags?.wikidata ?? null
    });
    representations[item.preferredRepresentation] = (representations[item.preferredRepresentation] ?? 0) + 1;
  }
  return { records, labels, representations };
}

function buildSettlements(document) {
  const records = new Float32Array(document.items.length * SETTLEMENT_FLOATS);
  const labels = [];
  for (let index = 0; index < document.items.length; index++) {
    const item = document.items[index];
    const offset = index * SETTLEMENT_FLOATS;
    records[offset] = item.local.x;
    records[offset + 1] = item.local.y;
    records[offset + 2] = item.local.z;
    records[offset + 3] = item.priority ?? (item.protected ? 100 : 40);
    labels.push({ id: item.id, name: item.name, place: item.place ?? null, population: item.population ?? null });
  }
  return { records, labels };
}

function writeFloatArray(buffer, offset, array) {
  Buffer.from(array.buffer, array.byteOffset, array.byteLength).copy(buffer, offset);
}

function presetFrom(items, name, aliases, altitude, distance) {
  const normalized = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const found = items.find(item => aliases.some(alias => normalized(item.name).includes(normalized(alias))));
  if (!found) return null;
  return { id: name.toLowerCase().replaceAll(' ', '-'), name, x: found.local.x, z: found.local.z, terrainMeters: found.local.y, altitude, distance };
}

function build() {
  const regionId = process.argv[2] ?? 'baleares';
  const regionDirectory = path.join(ROOT, 'regions', regionId);
  const outputDirectory = path.join(regionDirectory, 'preview');
  fs.mkdirSync(outputDirectory, { recursive: true });
  const paths = {
    manifest: path.join(regionDirectory, 'manifest.json'),
    terrain: path.join(regionDirectory, 'terrain.bin'),
    landcover: path.join(regionDirectory, 'landcover.bin'),
    objects: path.join(regionDirectory, 'objects.json'),
    routes: path.join(regionDirectory, 'routes.json'),
    landmarks: path.join(regionDirectory, 'landmarks.json'),
    settlements: path.join(regionDirectory, 'settlements.json')
  };
  for (const filePath of Object.values(paths)) assert(fs.existsSync(filePath), `Missing source ${filePath}`);
  const manifest = readJson(paths.manifest);
  assert(['wikidata-ranked-landmarks','dem-worldcover-bootstrap'].includes(manifest.generationStage), `Preview requires terrain bootstrap or Wikidata stage, got ${manifest.generationStage}`);
  const terrainBuffer = fs.readFileSync(paths.terrain);
  const terrain = decodeTerrainHeader(terrainBuffer);
  const sampleTerrain = createTerrainSampler(terrainBuffer, terrain, manifest.projection.localBounds);
  const objects = readJson(paths.objects);
  const routes = readJson(paths.routes);
  const landmarksDocument = readJson(paths.landmarks);
  const settlementsDocument = readJson(paths.settlements);
  const buildings = buildBuildings(objects);
  const roads = buildRoads(routes, sampleTerrain);
  const landmarks = buildLandmarks(landmarksDocument);
  const settlements = buildSettlements(settlementsDocument);

  const buildingOffset = HEADER_BYTES;
  const roadOffset = buildingOffset + buildings.records.byteLength;
  const landmarkOffset = roadOffset + roads.records.byteLength;
  const settlementOffset = landmarkOffset + landmarks.records.byteLength;
  const totalBytes = settlementOffset + settlements.records.byteLength;
  const buffer = Buffer.alloc(totalBytes);
  buffer.write(MAGIC, 0, 8, 'ascii');
  buffer.writeUInt16LE(1, 8);
  buffer.writeUInt16LE(HEADER_BYTES, 10);
  buffer.writeUInt32LE(buildings.records.length / BUILDING_FLOATS, 12);
  buffer.writeUInt32LE(roads.records.length / ROAD_FLOATS, 16);
  buffer.writeUInt32LE(landmarks.records.length / LANDMARK_FLOATS, 20);
  buffer.writeUInt32LE(settlements.records.length / SETTLEMENT_FLOATS, 24);
  buffer.writeUInt32LE(buildingOffset, 28);
  buffer.writeUInt32LE(roadOffset, 32);
  buffer.writeUInt32LE(landmarkOffset, 36);
  buffer.writeUInt32LE(settlementOffset, 40);
  buffer.writeUInt16LE(BUILDING_FLOATS, 44);
  buffer.writeUInt16LE(ROAD_FLOATS, 46);
  buffer.writeUInt16LE(LANDMARK_FLOATS, 48);
  buffer.writeUInt16LE(SETTLEMENT_FLOATS, 50);
  buffer.writeUInt32LE(totalBytes, 52);
  buffer.writeUInt32LE(terrain.columns, 56);
  buffer.writeUInt32LE(terrain.rows, 60);
  writeFloatArray(buffer, buildingOffset, buildings.records);
  writeFloatArray(buffer, roadOffset, roads.records);
  writeFloatArray(buffer, landmarkOffset, landmarks.records);
  writeFloatArray(buffer, settlementOffset, settlements.records);

  const binaryPath = path.join(outputDirectory, 'baleares-preview-v1.bin');
  fs.writeFileSync(binaryPath, buffer);
  const binarySha256 = sha256(buffer);
  const inputsSha256 = sourceFingerprint(Object.values(paths));
  const buildId = `baleares-preview-${inputsSha256.slice(0, 12)}`;
  const presets = [
    { id: 'overview', name: 'Tot', x: 0, z: 0, terrainMeters: 0, altitude: 310, distance: 0 },
    presetFrom(settlementsDocument.items, 'Palma', ['Palma'], 42, 34),
    presetFrom(settlementsDocument.items, 'Llevant', ['Manacor'], 48, 42),
    presetFrom(settlementsDocument.items, 'Alcúdia', ['Alcúdia', 'Alcudia'], 45, 38),
    presetFrom(settlementsDocument.items, 'Menorca', ['Maó', 'Mao'], 52, 46),
    presetFrom(settlementsDocument.items, 'Eivissa', ['Eivissa'], 50, 44)
  ].filter(Boolean);

  const metadata = {
    formatVersion: 1,
    buildId,
    regionId,
    regionName: manifest.region.name,
    generationStage: manifest.generationStage,
    binary: {
      file: 'baleares-preview-v1.bin',
      bytes: buffer.length,
      sha256: binarySha256,
      magic: MAGIC,
      headerBytes: HEADER_BYTES
    },
    sources: {
      inputsSha256,
      regionManifestSha256: sha256(fs.readFileSync(paths.manifest)),
      terrainSha256: sha256(terrainBuffer),
      landcoverSha256: sha256(fs.readFileSync(paths.landcover))
    },
    terrain: {
      file: '../terrain.bin',
      landcoverFile: '../landcover.bin',
      columns: terrain.columns,
      rows: terrain.rows,
      localBounds: manifest.projection.localBounds,
      verticalScale: Number((.03 * ((manifest.projection.unitsPerKm ?? 3.2) / 3.2)).toFixed(6))
    },
    counts: {
      buildings: buildings.records.length / BUILDING_FLOATS,
      hotels: buildings.hotels,
      namedBuildings: buildings.named,
      selectedRoads: roads.selectedRoads,
      roadSegments: roads.segments,
      roadVertices: roads.records.length / ROAD_FLOATS,
      landmarks: landmarks.records.length / LANDMARK_FLOATS,
      settlements: settlements.records.length / SETTLEMENT_FLOATS
    },
    mappings: {
      buildingKinds: BUILDING_KINDS,
      roadClasses: ROAD_CLASSES,
      representations: REPRESENTATIONS
    },
    distributions: {
      buildingKinds: buildings.kinds,
      roadClasses: roads.classes,
      landmarkRepresentations: landmarks.representations
    },
    landmarks: landmarks.labels,
    settlements: settlements.labels,
    presets,
    display: {
      buildingHorizontalExaggeration: 2.7,
      buildingVerticalScale: .075,
      roadLift: .16,
      landmarkLift: 2.6
    }
  };
  const metadataPath = path.join(outputDirectory, 'baleares-preview-v1.json');
  fs.writeFileSync(metadataPath, stableJson(metadata));
  const report = {
    formatVersion: 1,
    valid: true,
    buildId,
    regionId,
    binaryBytes: buffer.length,
    binarySha256,
    counts: metadata.counts,
    distributions: metadata.distributions,
    inputsSha256
  };
  fs.writeFileSync(path.join(ROOT, 'world-generator', `${regionId}-preview-build.json`), stableJson(report));
  process.stdout.write(stableJson(report));
}

try {
  build();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
