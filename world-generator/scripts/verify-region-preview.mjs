import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MAGIC = 'WAFTRPV1';
const HEADER_BYTES = 80;
const VERIFICATION_RUN = 2;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readFloat(buffer, byteOffset) {
  const value = buffer.readFloatLE(byteOffset);
  assert(Number.isFinite(value), `Non-finite float at byte ${byteOffset}`);
  return value;
}

function verifyRecords(buffer, header, metadata) {
  const bounds = metadata.terrain.localBounds;
  const margin = 20;
  for (let index = 0; index < header.buildingCount; index++) {
    const offset = header.buildingOffset + index * header.buildingStride * 4;
    const x = readFloat(buffer, offset);
    const y = readFloat(buffer, offset + 4);
    const z = readFloat(buffer, offset + 8);
    const width = readFloat(buffer, offset + 12);
    const height = readFloat(buffer, offset + 16);
    const depth = readFloat(buffer, offset + 20);
    const kind = readFloat(buffer, offset + 28);
    assert(x >= bounds.minX - margin && x <= bounds.maxX + margin, `Building ${index} x outside bounds`);
    assert(z >= bounds.minZ - margin && z <= bounds.maxZ + margin, `Building ${index} z outside bounds`);
    assert(y >= 0 && y <= 2000, `Building ${index} terrain elevation invalid`);
    assert(width > 0 && width <= 3 && depth > 0 && depth <= 3, `Building ${index} footprint invalid`);
    assert(height >= 2.5 && height <= 90, `Building ${index} height invalid`);
    assert(Number.isInteger(kind) && kind >= 0 && kind <= 5, `Building ${index} kind invalid`);
  }
  assert(header.roadVertexCount % 2 === 0, 'Road vertex count must be even');
  for (let index = 0; index < header.roadVertexCount; index++) {
    const offset = header.roadOffset + index * header.roadStride * 4;
    const x = readFloat(buffer, offset);
    const y = readFloat(buffer, offset + 4);
    const z = readFloat(buffer, offset + 8);
    const roadClass = readFloat(buffer, offset + 12);
    assert(x >= bounds.minX - margin && x <= bounds.maxX + margin, `Road vertex ${index} x outside bounds`);
    assert(z >= bounds.minZ - margin && z <= bounds.maxZ + margin, `Road vertex ${index} z outside bounds`);
    assert(y >= 0 && y <= 2000, `Road vertex ${index} elevation invalid`);
    assert(Number.isInteger(roadClass) && roadClass >= 0 && roadClass <= 10, `Road vertex ${index} class invalid`);
  }
  for (let index = 0; index < header.landmarkCount; index++) {
    const offset = header.landmarkOffset + index * header.landmarkStride * 4;
    const x = readFloat(buffer, offset);
    const y = readFloat(buffer, offset + 4);
    const z = readFloat(buffer, offset + 8);
    const score = readFloat(buffer, offset + 12);
    const representation = readFloat(buffer, offset + 16);
    assert(x >= bounds.minX - margin && x <= bounds.maxX + margin, `Landmark ${index} x outside bounds`);
    assert(z >= bounds.minZ - margin && z <= bounds.maxZ + margin, `Landmark ${index} z outside bounds`);
    assert(y >= 0 && y <= 2000, `Landmark ${index} elevation invalid`);
    assert(score >= 0 && score <= 200, `Landmark ${index} score invalid`);
    assert(Number.isInteger(representation) && representation >= 0 && representation <= 2, `Landmark ${index} representation invalid`);
  }
  for (let index = 0; index < header.settlementCount; index++) {
    const offset = header.settlementOffset + index * header.settlementStride * 4;
    const x = readFloat(buffer, offset);
    const y = readFloat(buffer, offset + 4);
    const z = readFloat(buffer, offset + 8);
    const priority = readFloat(buffer, offset + 12);
    assert(x >= bounds.minX - margin && x <= bounds.maxX + margin, `Settlement ${index} x outside bounds`);
    assert(z >= bounds.minZ - margin && z <= bounds.maxZ + margin, `Settlement ${index} z outside bounds`);
    assert(y >= 0 && y <= 2000, `Settlement ${index} elevation invalid`);
    assert(priority >= 0 && priority <= 200, `Settlement ${index} priority invalid`);
  }
}

function verify() {
  const regionId = process.argv[2] ?? 'baleares';
  const previewDirectory = path.join(ROOT, 'regions', regionId, 'preview');
  const metadataPath = path.join(previewDirectory, 'baleares-preview-v1.json');
  const binaryPath = path.join(previewDirectory, 'baleares-preview-v1.bin');
  assert(fs.existsSync(metadataPath), `Missing ${metadataPath}`);
  assert(fs.existsSync(binaryPath), `Missing ${binaryPath}`);
  const metadata = readJson(metadataPath);
  const buffer = fs.readFileSync(binaryPath);
  assert(metadata.formatVersion === 1, 'Unsupported preview metadata version');
  assert(metadata.regionId === regionId, 'Preview region mismatch');
  assert(metadata.generationStage === 'wikidata-ranked-landmarks', 'Preview source stage mismatch');
  assert(buffer.subarray(0, 8).toString('ascii') === MAGIC, 'Invalid preview binary magic');
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
    totalBytes: buffer.readUInt32LE(52),
    terrainColumns: buffer.readUInt32LE(56),
    terrainRows: buffer.readUInt32LE(60)
  };
  assert(header.version === 1 && header.headerBytes === HEADER_BYTES, 'Unsupported preview binary version');
  assert(header.buildingStride === 8 && header.roadStride === 4 && header.landmarkStride === 5 && header.settlementStride === 4, 'Preview record stride mismatch');
  assert(header.buildingOffset === HEADER_BYTES, 'Unexpected building offset');
  assert(header.roadOffset === header.buildingOffset + header.buildingCount * header.buildingStride * 4, 'Unexpected road offset');
  assert(header.landmarkOffset === header.roadOffset + header.roadVertexCount * header.roadStride * 4, 'Unexpected landmark offset');
  assert(header.settlementOffset === header.landmarkOffset + header.landmarkCount * header.landmarkStride * 4, 'Unexpected settlement offset');
  assert(header.totalBytes === buffer.length, 'Preview binary length mismatch');
  assert(buffer.length === header.settlementOffset + header.settlementCount * header.settlementStride * 4, 'Unexpected preview binary tail');
  assert(metadata.binary.bytes === buffer.length, 'Preview metadata byte size mismatch');
  assert(metadata.binary.sha256 === sha256(buffer), 'Preview binary SHA-256 mismatch');
  assert(header.terrainColumns === metadata.terrain.columns && header.terrainRows === metadata.terrain.rows, 'Terrain dimensions mismatch');
  assert(header.buildingCount === metadata.counts.buildings, 'Building count mismatch');
  assert(header.roadVertexCount === metadata.counts.roadVertices, 'Road vertex count mismatch');
  assert(header.roadVertexCount / 2 === metadata.counts.roadSegments, 'Road segment count mismatch');
  assert(header.landmarkCount === metadata.counts.landmarks, 'Landmark count mismatch');
  assert(header.settlementCount === metadata.counts.settlements, 'Settlement count mismatch');
  assert(metadata.landmarks.length === header.landmarkCount, 'Landmark labels mismatch');
  assert(metadata.settlements.length === header.settlementCount, 'Settlement labels mismatch');
  assert(header.buildingCount >= 5000, `Too few buildings: ${header.buildingCount}`);
  assert(metadata.counts.hotels >= 2000, `Too few hotels: ${metadata.counts.hotels}`);
  assert(metadata.counts.selectedRoads >= 3000, `Too few selected roads: ${metadata.counts.selectedRoads}`);
  assert(header.roadVertexCount >= 10000, `Too few road vertices: ${header.roadVertexCount}`);
  assert(header.landmarkCount === 90, `Expected 90 landmarks, got ${header.landmarkCount}`);
  assert(header.settlementCount >= 60, `Too few settlements: ${header.settlementCount}`);
  assert(buffer.length < 8 * 1024 * 1024, `Preview binary is too large: ${buffer.length}`);
  assert(metadata.presets.some(item => item.id === 'overview'), 'Missing overview preset');
  assert(metadata.presets.some(item => item.name === 'Palma'), 'Missing Palma preset');
  assert(metadata.presets.some(item => item.name === 'Menorca'), 'Missing Menorca preset');
  assert(metadata.presets.some(item => item.name === 'Eivissa'), 'Missing Eivissa preset');
  verifyRecords(buffer, header, metadata);
  const report = {
    formatVersion: 1,
    verificationRun: VERIFICATION_RUN,
    regionId,
    valid: true,
    buildId: metadata.buildId,
    binaryBytes: buffer.length,
    binarySha256: metadata.binary.sha256,
    counts: metadata.counts,
    presets: metadata.presets.map(item => item.name),
    terrain: { columns: header.terrainColumns, rows: header.terrainRows },
    generationStage: metadata.generationStage
  };
  fs.writeFileSync(path.join(ROOT, 'world-generator', `${regionId}-preview-validation.json`), stableJson(report));
  process.stdout.write(stableJson(report));
}

try {
  verify();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
