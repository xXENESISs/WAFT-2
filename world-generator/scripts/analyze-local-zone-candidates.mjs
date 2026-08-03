import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BUILDING_FLOATS = 8;
const ROAD_FLOATS = 4;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
}

function stableJson(value) {
  const sort = input => {
    if (Array.isArray(input)) return input.map(sort);
    if (input && typeof input === 'object') return Object.fromEntries(Object.keys(input).sort().map(key => [key, sort(input[key])]));
    return input;
  };
  return `${JSON.stringify(sort(value), null, 2)}\n`;
}

function parsePreview(buffer) {
  assert(buffer.subarray(0, 8).toString('ascii') === 'WAFTRPV1', 'Invalid regional preview binary');
  const header = {
    version: buffer.readUInt16LE(8),
    buildingCount: buffer.readUInt32LE(12),
    roadVertexCount: buffer.readUInt32LE(16),
    buildingOffset: buffer.readUInt32LE(28),
    roadOffset: buffer.readUInt32LE(32),
    buildingStride: buffer.readUInt16LE(44),
    roadStride: buffer.readUInt16LE(46),
    totalBytes: buffer.readUInt32LE(52)
  };
  assert(header.version === 1 && header.totalBytes === buffer.length, 'Incomplete regional preview binary');
  assert(header.buildingStride === BUILDING_FLOATS && header.roadStride === ROAD_FLOATS, 'Unexpected preview strides');
  return {
    header,
    buildings: new Float32Array(buffer.buffer, buffer.byteOffset + header.buildingOffset, header.buildingCount * BUILDING_FLOATS),
    roads: new Float32Array(buffer.buffer, buffer.byteOffset + header.roadOffset, header.roadVertexCount * ROAD_FLOATS)
  };
}

function segmentDistance(px, pz, ax, az, bx, bz) {
  const vx = bx - ax;
  const vz = bz - az;
  const denominator = vx * vx + vz * vz || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / denominator));
  return Math.hypot(px - (ax + vx * t), pz - (az + vz * t));
}

function countAt(preview, center, radius) {
  let buildings = 0;
  for (let offset = 0; offset < preview.buildings.length; offset += BUILDING_FLOATS) {
    if (Math.hypot(preview.buildings[offset] - center.x, preview.buildings[offset + 2] - center.z) <= radius) buildings++;
  }
  let roadSegments = 0;
  let roadLength = 0;
  for (let offset = 0; offset + ROAD_FLOATS * 2 <= preview.roads.length; offset += ROAD_FLOATS * 2) {
    const ax = preview.roads[offset];
    const az = preview.roads[offset + 2];
    const bx = preview.roads[offset + ROAD_FLOATS];
    const bz = preview.roads[offset + ROAD_FLOATS + 2];
    if (segmentDistance(center.x, center.z, ax, az, bx, bz) > radius) continue;
    roadSegments++;
    roadLength += Math.hypot(bx - ax, bz - az);
  }
  return { buildings, roadSegments, roadVertices: roadSegments * 2, roadLength };
}

const regions = [
  { id: 'baleares', candidates: ['palma', 'llevant', 'alcúdia', 'menorca', 'eivissa'] },
  { id: 'catalunya-litoral', candidates: ['barcelona', 'tarragona', 'girona', 'subregion-maresme', 'subregion-montserrat', 'subregion-montseny'] }
];
const radii = [18, 24, 30, 36, 44, 52];
const report = { formatVersion: 1, generatedAt: new Date().toISOString(), radii, regions: {} };

for (const region of regions) {
  const metadataRelative = `regions/${region.id}/preview/${region.id}-preview-v1.json`;
  const binaryRelative = `regions/${region.id}/preview/${region.id}-preview-v1.bin`;
  const metadata = readJson(metadataRelative);
  const preview = parsePreview(fs.readFileSync(path.join(ROOT, binaryRelative)));
  const presets = new Map(metadata.presets.map(preset => [preset.id, preset]));
  const regionReport = {
    buildId: metadata.buildId,
    totalBuildings: preview.header.buildingCount,
    totalRoadVertices: preview.header.roadVertexCount,
    candidates: {}
  };
  for (const candidateId of region.candidates) {
    const preset = presets.get(candidateId);
    assert(preset, `Missing preset ${region.id}/${candidateId}`);
    regionReport.candidates[candidateId] = {
      name: preset.name,
      center: { x: preset.x, z: preset.z },
      density: Object.fromEntries(radii.map(radius => [radius, countAt(preview, preset, radius)]))
    };
  }
  report.regions[region.id] = regionReport;
}

fs.writeFileSync(path.join(ROOT, 'world-generator/local-zone-candidate-density.json'), stableJson(report));
process.stdout.write(stableJson(report));
