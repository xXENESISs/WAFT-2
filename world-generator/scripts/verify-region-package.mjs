import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { decodeTerrainHeader, decodeLandcoverHeader, REGION_BINARY_FORMAT } from '../lib/binary-formats.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const GENERATION_STAGES = new Set([
  'terrain-landcover-sectors-bootstrap',
  'openstreetmap-physical-network'
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function nearlyEqual(a, b, epsilon = 1e-9) {
  return Math.abs(a - b) <= epsilon;
}

function readElevation(buffer, header, column, row) {
  return buffer.readInt16LE(header.headerBytes + (row * header.columns + column) * 2);
}

function nearestTerrainCell(header, position) {
  return {
    column: Math.max(0, Math.min(header.columns - 1, Math.round((position.lon - header.bounds.west) / (header.bounds.east - header.bounds.west) * (header.columns - 1)))),
    row: Math.max(0, Math.min(header.rows - 1, Math.round((header.bounds.north - position.lat) / (header.bounds.north - header.bounds.south) * (header.rows - 1))))
  };
}

function verify() {
  const regionId = process.argv[2] ?? 'baleares';
  const configPath = path.join(ROOT, 'world-generator/configs', `${regionId}.region.json`);
  const config = readJson(configPath);
  const packageDirectory = path.join(ROOT, config.outputs.directory);
  const manifestPath = path.join(packageDirectory, config.outputs.manifest);
  assert(fs.existsSync(manifestPath), `Missing manifest ${manifestPath}`);
  const manifest = readJson(manifestPath);
  assert(manifest.region.id === regionId, 'Manifest region id mismatch');
  assert(manifest.deterministic === true, 'Package must be marked deterministic');
  assert(GENERATION_STAGES.has(manifest.generationStage), `Unexpected generation stage: ${manifest.generationStage}`);

  let fileBytes = 0;
  for (const record of manifest.files) {
    const filePath = path.join(packageDirectory, record.path);
    assert(fs.existsSync(filePath), `Missing package file ${record.path}`);
    const data = fs.readFileSync(filePath);
    assert(data.length === record.bytes, `Size mismatch for ${record.path}`);
    assert(sha256(data) === record.sha256, `SHA-256 mismatch for ${record.path}`);
    fileBytes += data.length;
  }
  assert(fileBytes === manifest.packageBytesWithoutManifest, 'Manifest package byte total mismatch');
  const totalBytes = fileBytes + fs.statSync(manifestPath).size;
  assert(totalBytes <= config.performance.budgets.downloadMb * 1024 * 1024, `Package exceeds ${config.performance.budgets.downloadMb} MB budget`);

  const terrainBuffer = fs.readFileSync(path.join(packageDirectory, config.outputs.terrain));
  const terrain = decodeTerrainHeader(terrainBuffer);
  assert(terrain.formatVersion === 1, 'Unsupported terrain version');
  assert(terrain.columns === config.generation.terrain.grid.columns, 'Terrain columns mismatch');
  assert(terrain.rows === config.generation.terrain.grid.rows, 'Terrain rows mismatch');
  assert(terrain.cellCount === terrain.columns * terrain.rows, 'Terrain cell count mismatch');
  assert(terrainBuffer.length === terrain.headerBytes + terrain.cellCount * 2, 'Terrain binary length mismatch');
  for (const key of ['west', 'east', 'south', 'north']) assert(nearlyEqual(terrain.bounds[key], config.geography.bounds[key]), `Terrain ${key} bound mismatch`);

  let landCells = 0;
  let maximumElevation = 0;
  for (let index = 0; index < terrain.cellCount; index++) {
    const elevation = terrainBuffer.readInt16LE(terrain.headerBytes + index * 2);
    if (elevation === REGION_BINARY_FORMAT.nodataElevation) continue;
    assert(elevation >= 0, `Negative land elevation at cell ${index}`);
    landCells++;
    maximumElevation = Math.max(maximumElevation, elevation);
  }
  assert(landCells === manifest.terrain.landCells, 'Manifest land cell count mismatch');
  assert(landCells > terrain.cellCount * .015, 'Terrain contains too little land');
  assert(maximumElevation > 900, 'Mallorca relief was not preserved');

  for (const subregionId of ['mallorca', 'menorca', 'ibiza', 'formentera', 'cabrera']) {
    const subregion = config.geography.subregions.find(item => item.id === subregionId);
    assert(subregion, `Missing configured subregion ${subregionId}`);
    const center = nearestTerrainCell(terrain, subregion.center);
    let foundLand = false;
    for (let radius = 0; radius <= 4 && !foundLand; radius++) {
      for (let dy = -radius; dy <= radius && !foundLand; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const column = center.column + dx;
          const row = center.row + dy;
          if (column < 0 || row < 0 || column >= terrain.columns || row >= terrain.rows) continue;
          if (readElevation(terrainBuffer, terrain, column, row) !== REGION_BINARY_FORMAT.nodataElevation) { foundLand = true; break; }
        }
      }
    }
    assert(foundLand, `No generated land near ${subregionId}`);
  }

  const landcoverBuffer = fs.readFileSync(path.join(packageDirectory, config.outputs.landcover));
  const landcover = decodeLandcoverHeader(landcoverBuffer);
  assert(landcover.formatVersion === 1, 'Unsupported landcover version');
  assert(landcover.columns === terrain.columns && landcover.rows === terrain.rows, 'Landcover grid mismatch');
  assert(landcover.cellCount === terrain.cellCount, 'Landcover cell count mismatch');
  assert(landcoverBuffer.length === landcover.headerBytes + landcover.cellCount, 'Landcover binary length mismatch');
  const usedClasses = new Set();
  for (let index = 0; index < landcover.cellCount; index++) {
    const classId = landcoverBuffer[landcover.headerBytes + index];
    assert(classId < landcover.classCount, `Unknown landcover class ${classId}`);
    usedClasses.add(classId);
    const elevation = terrainBuffer.readInt16LE(terrain.headerBytes + index * 2);
    if (elevation === REGION_BINARY_FORMAT.nodataElevation) assert(classId === 0, `Water cell ${index} is not class 0`);
    else assert(classId !== 0, `Land cell ${index} is classed as water`);
  }
  assert(usedClasses.size >= 6, `Landcover has insufficient variety: ${usedClasses.size} classes`);

  const sectorsDocument = readJson(path.join(packageDirectory, config.outputs.sectors));
  assert(sectorsDocument.regionId === regionId, 'Sectors region mismatch');
  assert(sectorsDocument.sectors.length === sectorsDocument.grid.columns * sectorsDocument.grid.rows, 'Sector grid count mismatch');
  const sectorIds = new Set(sectorsDocument.sectors.map(sector => sector.id));
  assert(sectorIds.size === sectorsDocument.sectors.length, 'Duplicate sector ids');
  const activeSectors = sectorsDocument.sectors.filter(sector => sector.active);
  assert(activeSectors.length === manifest.sectors.active, 'Active sector count mismatch');
  assert(activeSectors.length >= 10, 'Too few active sectors');
  for (const sector of sectorsDocument.sectors) {
    assert(sector.landRatio >= 0 && sector.landRatio <= 1, `Invalid land ratio in ${sector.id}`);
    for (const neighbour of sector.neighbours) assert(sectorIds.has(neighbour), `Unknown neighbour ${neighbour} in ${sector.id}`);
  }

  const pointDocuments = [
    [config.outputs.settlements, 'items'],
    [config.outputs.landmarks, 'items'],
    [config.outputs.routes, 'entryPoints']
  ];
  for (const [filename, property] of pointDocuments) {
    const document = readJson(path.join(packageDirectory, filename));
    assert(document.regionId === regionId, `${filename} region mismatch`);
    for (const item of document[property]) {
      assert(Number.isFinite(item.local?.x) && Number.isFinite(item.local?.y) && Number.isFinite(item.local?.z), `${filename}:${item.id} has invalid local coordinates`);
      assert(sectorIds.has(item.sectorId), `${filename}:${item.id} refers to unknown sector ${item.sectorId}`);
    }
  }

  const fauna = readJson(path.join(packageDirectory, config.outputs.fauna));
  assert(fauna.species.length === config.generation.fauna.manualInclude.length, 'Fauna seed count mismatch');
  for (const species of fauna.species) {
    assert(species.candidateSectorIds.length > 0, `${species.commonName} has no candidate sectors`);
    for (const sectorId of species.candidateSectorIds) assert(sectorIds.has(sectorId), `${species.commonName} refers to unknown sector ${sectorId}`);
  }

  const report = {
    formatVersion: 1,
    regionId,
    valid: true,
    generationStage: manifest.generationStage,
    packageBytes: totalBytes,
    terrain: { columns: terrain.columns, rows: terrain.rows, landCells, maximumElevation },
    landcoverClassesUsed: [...usedClasses].sort((a, b) => a - b),
    sectors: { total: sectorsDocument.sectors.length, active: activeSectors.length },
    content: manifest.content,
    fileCount: manifest.files.length + 1
  };
  const reportPath = path.join(ROOT, 'world-generator', `${regionId}-package-validation.json`);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

try {
  verify();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
