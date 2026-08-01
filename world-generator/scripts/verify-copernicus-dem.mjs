import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { decodeTerrainHeader, REGION_BINARY_FORMAT } from '../lib/binary-formats.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEM_MAGIC = 'WAFTDEM1';

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
  const sourcePath = path.join(sourceDirectory, 'copernicus-dem-glo30.bin');
  const metadataPath = path.join(sourceDirectory, 'copernicus-dem-glo30.json');
  const source = fs.readFileSync(sourcePath);
  const metadata = readJson(metadataPath);
  assert(source.subarray(0, 8).toString('ascii') === DEM_MAGIC, 'Invalid source DEM magic');
  assert(sha256(source) === metadata.binarySha256, 'Source DEM hash mismatch');
  assert(metadata.dataset === 'Copernicus DEM GLO-30 Public', 'Unexpected DEM dataset');
  assert(metadata.tiles.length >= 4, `Too few source tiles: ${metadata.tiles.length}`);
  assert(metadata.maximumElevationMeters > 1200, `Source maximum is implausible: ${metadata.maximumElevationMeters}`);

  const manifest = readJson(path.join(packageDirectory, config.outputs.manifest));
  assert(manifest.terrain.elevationSource?.mode === 'copernicus-dem-glo30', 'Manifest does not declare Copernicus elevation');
  assert(manifest.terrain.elevationSource.snapshotSha256 === metadata.binarySha256, 'Manifest DEM snapshot hash mismatch');
  assert(!manifest.pendingStages.includes('external-dem-ingestion'), 'DEM stage is still marked pending');
  assert(manifest.terrain.realElevationCells > manifest.terrain.landCells * .85, 'Too few land cells use real elevation');
  assert(manifest.terrain.maximumElevationMeters > 1200, 'Generated terrain lost mountain relief');

  const terrainBuffer = fs.readFileSync(path.join(packageDirectory, config.outputs.terrain));
  const terrain = decodeTerrainHeader(terrainBuffer);
  let landCells = 0;
  let maximum = -Infinity;
  let sum = 0;
  for (let index = 0; index < terrain.cellCount; index++) {
    const value = terrainBuffer.readInt16LE(terrain.headerBytes + index * 2);
    if (value === REGION_BINARY_FORMAT.nodataElevation) continue;
    landCells++;
    maximum = Math.max(maximum, value);
    sum += value;
  }
  assert(landCells === manifest.terrain.landCells, 'Land cell count changed during DEM integration');
  assert(maximum === manifest.terrain.maximumElevationMeters, 'Manifest maximum elevation mismatch');

  for (const record of manifest.files) {
    const filePath = path.join(packageDirectory, record.path);
    const data = fs.readFileSync(filePath);
    assert(data.length === record.bytes, `File size mismatch: ${record.path}`);
    assert(sha256(data) === record.sha256, `File hash mismatch: ${record.path}`);
  }

  const report = {
    formatVersion: 1,
    regionId,
    valid: true,
    dataset: metadata.dataset,
    datasetRelease: metadata.datasetRelease,
    sourceTiles: metadata.tiles.map(tile => tile.id),
    snapshotBytes: source.length,
    snapshotSha256: metadata.binarySha256,
    landCells,
    realElevationCells: manifest.terrain.realElevationCells,
    fallbackElevationCells: manifest.terrain.fallbackElevationCells,
    realCoverageRatio: Number((manifest.terrain.realElevationCells / landCells).toFixed(6)),
    minimumElevationMeters: manifest.terrain.minimumElevationMeters,
    maximumElevationMeters: maximum,
    meanElevationMeters: Number((sum / landCells).toFixed(3)),
    externalDemStagePending: false
  };
  const reportPath = path.join(ROOT, 'world-generator', `${regionId}-copernicus-dem-validation.json`);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

try {
  verify();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
