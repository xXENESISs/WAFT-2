import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { decodeTerrainHeader, decodeLandcoverHeader, REGION_BINARY_FORMAT } from '../lib/binary-formats.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SOURCE_MAGIC = 'WAFTWCV1';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function verify() {
  const regionId = process.argv[2] ?? 'baleares';
  const config = readJson(path.join(ROOT, 'world-generator/configs', `${regionId}.region.json`));
  const packageDirectory = path.join(ROOT, config.outputs.directory);
  const sourceDirectory = path.join(ROOT, 'world-generator/sources', regionId);
  const sourcePath = path.join(sourceDirectory, 'esa-worldcover-2021-v200.bin');
  const metadataPath = path.join(sourceDirectory, 'esa-worldcover-2021-v200.json');
  const sourceBuffer = fs.readFileSync(sourcePath);
  const metadata = readJson(metadataPath);
  assert(sourceBuffer.subarray(0, 8).toString('ascii') === SOURCE_MAGIC, 'Invalid WorldCover source magic');
  assert(sha256(sourceBuffer) === metadata.binarySha256, 'WorldCover source hash mismatch');
  assert(metadata.dataset === 'ESA WorldCover 10 m 2021 v200', 'Unexpected WorldCover dataset');
  assert(metadata.tiles.length >= 4, `Too few WorldCover source tiles: ${metadata.tiles.length}`);
  const sourceClasses = new Set(Object.keys(metadata.classDistribution).map(Number));
  for (const expected of [10, 20, 30, 40, 50, 60, 80, 90]) {
    assert(sourceClasses.has(expected), `WorldCover class ${expected} is absent from the regional snapshot`);
  }

  const manifestPath = path.join(packageDirectory, config.outputs.manifest);
  const manifest = readJson(manifestPath);
  assert(manifest.landcover.quality === 'esa-worldcover-2021-v200', 'Manifest does not declare real WorldCover quality');
  assert(manifest.landcover.externalWorldCoverImportPending === false, 'WorldCover import still marked pending');
  assert(!manifest.pendingStages.includes('esa-worldcover-ingestion'), 'WorldCover stage remains in pending stages');
  assert(manifest.landcover.source?.snapshotSha256 === metadata.binarySha256, 'Manifest WorldCover snapshot hash mismatch');
  const classified = manifest.landcover.realClassifiedLandCells;
  const fallback = manifest.landcover.fallbackLandCells;
  assert(classified > 0, 'No land cells use WorldCover');
  assert(classified / (classified + fallback) > .85, 'WorldCover land coverage is below 85%');

  const terrainBuffer = fs.readFileSync(path.join(packageDirectory, config.outputs.terrain));
  const terrain = decodeTerrainHeader(terrainBuffer);
  const landcoverBuffer = fs.readFileSync(path.join(packageDirectory, config.outputs.landcover));
  const landcover = decodeLandcoverHeader(landcoverBuffer);
  assert(terrain.cellCount === landcover.cellCount, 'Terrain and landcover grids differ');
  const counts = new Map();
  for (let index = 0; index < terrain.cellCount; index++) {
    const elevation = terrainBuffer.readInt16LE(terrain.headerBytes + index * 2);
    const classId = landcoverBuffer[landcover.headerBytes + index];
    counts.set(classId, (counts.get(classId) ?? 0) + 1);
    if (elevation === REGION_BINARY_FORMAT.nodataElevation) assert(classId === 0, `Water cell ${index} is not water`);
    else assert(classId !== 0, `Land cell ${index} has water class`);
  }
  for (const classId of [3, 4, 5, 7, 8, 9]) assert((counts.get(classId) ?? 0) > 0, `Generated WAFT class ${classId} is absent`);
  const declaredDistribution = manifest.landcover.classDistribution;
  for (const [classId, count] of counts) {
    assert(declaredDistribution[String(classId)] === count, `Manifest class count mismatch for ${classId}`);
  }

  const sectors = readJson(path.join(packageDirectory, config.outputs.sectors));
  const sectorClassTotals = new Map();
  for (const sector of sectors.sectors) {
    for (const [key, count] of Object.entries(sector.landcover)) sectorClassTotals.set(key, (sectorClassTotals.get(key) ?? 0) + count);
  }
  const classKeys = new Map(manifest.landcover.classes.map(item => [item.id, item.key]));
  for (const [classId, count] of counts) {
    assert(sectorClassTotals.get(classKeys.get(classId)) === count, `Sector landcover total mismatch for class ${classId}`);
  }

  const fauna = readJson(path.join(packageDirectory, config.outputs.fauna));
  for (const species of fauna.species) assert(species.candidateSectorIds.length > 0, `${species.commonName} has no candidate sectors`);

  for (const record of manifest.files) {
    const data = fs.readFileSync(path.join(packageDirectory, record.path));
    assert(data.length === record.bytes, `File size mismatch: ${record.path}`);
    assert(sha256(data) === record.sha256, `File hash mismatch: ${record.path}`);
  }

  const report = {
    formatVersion: 1,
    regionId,
    valid: true,
    dataset: metadata.dataset,
    sourceTiles: metadata.tiles.map(tile => tile.id),
    snapshotBytes: sourceBuffer.length,
    snapshotSha256: metadata.binarySha256,
    sourceClasses: [...sourceClasses].sort((a, b) => a - b),
    realClassifiedLandCells: classified,
    fallbackLandCells: fallback,
    realCoverageRatio: Number((classified / (classified + fallback)).toFixed(6)),
    waftClassDistribution: Object.fromEntries([...counts.entries()].sort((a, b) => a[0] - b[0]).map(([id, count]) => [String(id), count])),
    externalWorldCoverStagePending: false
  };
  const reportPath = path.join(ROOT, 'world-generator', `${regionId}-worldcover-validation.json`);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

try {
  verify();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
