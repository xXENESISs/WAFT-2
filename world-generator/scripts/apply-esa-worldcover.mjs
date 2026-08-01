import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { decodeTerrainHeader, decodeLandcoverHeader, REGION_BINARY_FORMAT } from '../lib/binary-formats.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SOURCE_MAGIC = 'WAFTWCV1';
const SOURCE_HEADER_BYTES = 64;
const BIOME_TO_CLASSES = Object.freeze({
  'mediterranean-pine': ['mediterranean-forest'],
  agricultural: ['agricultural'],
  mountain: ['mountain-rock'],
  'mediterranean-scrub': ['mediterranean-scrub'],
  pasture: ['pasture'],
  forest: ['mediterranean-forest'],
  'open-sea': ['water'],
  'coastal-scrub': ['mediterranean-scrub'],
  'coastal-rock': ['coastal-rock']
});

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted(value[key])]));
  return value;
}

function stableJson(value) {
  return `${JSON.stringify(sorted(value), null, 2)}\n`;
}

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function decodeSourceHeader(buffer) {
  assert(buffer.length >= SOURCE_HEADER_BYTES, 'WorldCover snapshot is truncated');
  assert(buffer.subarray(0, 8).toString('ascii') === SOURCE_MAGIC, 'Invalid WorldCover snapshot magic');
  return {
    formatVersion: buffer.readUInt16LE(8),
    headerBytes: buffer.readUInt16LE(10),
    columns: buffer.readUInt16LE(12),
    rows: buffer.readUInt16LE(14),
    bounds: {
      west: buffer.readDoubleLE(16),
      east: buffer.readDoubleLE(24),
      south: buffer.readDoubleLE(32),
      north: buffer.readDoubleLE(40)
    },
    nodata: buffer.readUInt32LE(48),
    cellCount: buffer.readUInt32LE(52),
    year: buffer.readUInt16LE(56),
    algorithmVersion: buffer.readUInt16LE(58),
    nominalResolutionMeters: buffer.readUInt32LE(60)
  };
}

function distanceGrid(sourceMask, columns, rows) {
  const distance = new Uint16Array(sourceMask.length);
  distance.fill(65535);
  const queue = new Int32Array(sourceMask.length);
  let head = 0;
  let tail = 0;
  for (let index = 0; index < sourceMask.length; index++) {
    if (sourceMask[index]) {
      distance[index] = 0;
      queue[tail++] = index;
    }
  }
  while (head < tail) {
    const index = queue[head++];
    const row = Math.floor(index / columns);
    const column = index - row * columns;
    const nextDistance = distance[index] + 1;
    const visit = neighbour => {
      if (distance[neighbour] > nextDistance) {
        distance[neighbour] = nextDistance;
        queue[tail++] = neighbour;
      }
    };
    if (column > 0) visit(index - 1);
    if (column < columns - 1) visit(index + 1);
    if (row > 0) visit(index - columns);
    if (row < rows - 1) visit(index + columns);
  }
  return distance;
}

function mapWorldCoverClass(sourceClass, elevation, coastDistance, fallbackClass) {
  switch (sourceClass) {
    case 10: return 4;
    case 20: return 3;
    case 30: return 9;
    case 40: return 5;
    case 50: return 8;
    case 60:
      if (coastDistance <= 1 && elevation < 35) return 1;
      if (coastDistance <= 2 && elevation < 90) return 2;
      if (elevation >= 350) return 6;
      return 3;
    case 70: return 6;
    case 80: return 7;
    case 90: return 7;
    case 95: return 7;
    case 100: return 3;
    case 0: return fallbackClass;
    default: throw new Error(`Unsupported WorldCover class ${sourceClass}`);
  }
}

function updateSectors(sectorsPath, classes, terrainBuffer, terrain, landcoverBuffer, landcover) {
  const document = readJson(sectorsPath);
  const classNames = new Map(classes.map(item => [item.id, item.key]));
  const byId = new Map(document.sectors.map(sector => [sector.id, sector]));
  for (const sector of document.sectors) sector.landcover = {};
  const bounds = terrain.bounds;
  const size = document.sectorSizeUnits;
  for (let row = 0; row < terrain.rows; row++) {
    const lat = bounds.north - row / (terrain.rows - 1) * (bounds.north - bounds.south);
    for (let column = 0; column < terrain.columns; column++) {
      const index = row * terrain.columns + column;
      const lon = bounds.west + column / (terrain.columns - 1) * (bounds.east - bounds.west);
      const unitsPerKm = 5;
      const compression = .76;
      const kmPerDegreeLon = 111.320 * Math.cos(39.6 * Math.PI / 180);
      const kmPerDegreeLat = 111.132;
      const x = (lon - 2.9) * kmPerDegreeLon * unitsPerKm * compression;
      const z = -(lat - 39.6) * kmPerDegreeLat * unitsPerKm * compression;
      const sectorColumn = Math.max(0, Math.min(document.grid.columns - 1, Math.floor((x - document.localBounds.minX) / size)));
      const sectorRow = Math.max(0, Math.min(document.grid.rows - 1, Math.floor((z - document.localBounds.minZ) / size)));
      const sectorId = `s-${String(sectorColumn).padStart(2, '0')}-${String(sectorRow).padStart(2, '0')}`;
      const sector = byId.get(sectorId);
      if (!sector) throw new Error(`Landcover cell maps to unknown sector ${sectorId}`);
      const classId = landcoverBuffer[landcover.headerBytes + index];
      const key = classNames.get(classId);
      if (!key) throw new Error(`Unknown WAFT landcover class ${classId}`);
      sector.landcover[key] = (sector.landcover[key] ?? 0) + 1;
    }
  }
  fs.writeFileSync(sectorsPath, stableJson(document));
  return document;
}

function updateFauna(faunaPath, sectorsDocument) {
  const document = readJson(faunaPath);
  for (const species of document.species) {
    const accepted = new Set(species.biomes.flatMap(biome => BIOME_TO_CLASSES[biome] ?? []));
    species.candidateSectorIds = sectorsDocument.sectors
      .filter(sector => Object.entries(sector.landcover).some(([key, count]) => count > 0 && accepted.has(key)))
      .map(sector => sector.id);
    assert(species.candidateSectorIds.length > 0, `${species.commonName} has no candidate sectors after WorldCover import`);
  }
  fs.writeFileSync(faunaPath, stableJson(document));
}

function refreshManifest(packageDirectory, manifestPath, metadata, sourcePath, stats) {
  const manifest = readJson(manifestPath);
  manifest.landcover.quality = 'esa-worldcover-2021-v200';
  manifest.landcover.externalWorldCoverImportPending = false;
  manifest.landcover.source = {
    dataset: metadata.dataset,
    datasetYear: metadata.datasetYear,
    algorithmVersion: metadata.algorithmVersion,
    provider: metadata.provider,
    distribution: metadata.distribution,
    nominalResolutionMeters: metadata.nominalResolutionMeters,
    retrievedOn: metadata.retrievedOn,
    attribution: metadata.attribution,
    license: metadata.license,
    doi: metadata.doi,
    snapshotSha256: metadata.binarySha256,
    tiles: metadata.tiles.map(tile => ({ id: tile.id, bytes: tile.bytes, sha256: tile.sha256 }))
  };
  manifest.landcover.realClassifiedLandCells = stats.realClassifiedLandCells;
  manifest.landcover.fallbackLandCells = stats.fallbackLandCells;
  manifest.landcover.classDistribution = stats.classDistribution;
  manifest.pendingStages = manifest.pendingStages.filter(stage => stage !== 'esa-worldcover-ingestion');
  manifest.provenance.worldCoverSnapshot = {
    path: path.relative(ROOT, sourcePath).replaceAll(path.sep, '/'),
    sha256: metadata.binarySha256,
    metadataPath: `world-generator/sources/${manifest.region.id}/esa-worldcover-2021-v200.json`
  };
  manifest.files = manifest.files.map(record => {
    const data = fs.readFileSync(path.join(packageDirectory, record.path));
    return { path: record.path, bytes: data.length, sha256: sha256(data) };
  });
  manifest.packageBytesWithoutManifest = manifest.files.reduce((sum, item) => sum + item.bytes, 0);
  fs.writeFileSync(manifestPath, stableJson(manifest));
}

function apply() {
  const regionId = process.argv[2] ?? 'baleares';
  let outputDirectory = null;
  const args = process.argv.slice(3);
  while (args.length) {
    const flag = args.shift();
    if (flag === '--output-dir') outputDirectory = args.shift();
    else throw new Error(`Unknown argument ${flag}`);
  }
  const config = readJson(path.join(ROOT, 'world-generator/configs', `${regionId}.region.json`));
  const packageDirectory = path.resolve(ROOT, outputDirectory ?? config.outputs.directory);
  const sourceDirectory = path.join(ROOT, 'world-generator/sources', regionId);
  const sourcePath = path.join(sourceDirectory, 'esa-worldcover-2021-v200.bin');
  const metadataPath = path.join(sourceDirectory, 'esa-worldcover-2021-v200.json');
  assert(fs.existsSync(sourcePath), `Missing WorldCover snapshot ${sourcePath}`);
  assert(fs.existsSync(metadataPath), `Missing WorldCover metadata ${metadataPath}`);
  const sourceBuffer = fs.readFileSync(sourcePath);
  const source = decodeSourceHeader(sourceBuffer);
  const metadata = readJson(metadataPath);
  assert(source.formatVersion === 1 && source.headerBytes === SOURCE_HEADER_BYTES, 'Unsupported WorldCover snapshot format');
  assert(source.columns === config.generation.terrain.grid.columns && source.rows === config.generation.terrain.grid.rows, 'WorldCover grid mismatch');
  assert(sourceBuffer.length === source.headerBytes + source.cellCount, 'WorldCover snapshot length mismatch');
  assert(sha256(sourceBuffer) === metadata.binarySha256, 'WorldCover snapshot hash mismatch');

  const terrainPath = path.join(packageDirectory, config.outputs.terrain);
  const landcoverPath = path.join(packageDirectory, config.outputs.landcover);
  const terrainBuffer = fs.readFileSync(terrainPath);
  const terrain = decodeTerrainHeader(terrainBuffer);
  const landcoverBuffer = fs.readFileSync(landcoverPath);
  const landcover = decodeLandcoverHeader(landcoverBuffer);
  assert(terrain.cellCount === source.cellCount && landcover.cellCount === source.cellCount, 'WorldCover, terrain and landcover grids differ');

  const waterMask = new Uint8Array(terrain.cellCount);
  for (let index = 0; index < terrain.cellCount; index++) {
    const elevation = terrainBuffer.readInt16LE(terrain.headerBytes + index * 2);
    waterMask[index] = elevation === REGION_BINARY_FORMAT.nodataElevation ? 1 : 0;
  }
  const coastDistance = distanceGrid(waterMask, terrain.columns, terrain.rows);
  let realClassifiedLandCells = 0;
  let fallbackLandCells = 0;
  const distribution = new Map();
  for (let index = 0; index < terrain.cellCount; index++) {
    const terrainElevation = terrainBuffer.readInt16LE(terrain.headerBytes + index * 2);
    const targetOffset = landcover.headerBytes + index;
    if (terrainElevation === REGION_BINARY_FORMAT.nodataElevation) {
      landcoverBuffer[targetOffset] = 0;
      distribution.set(0, (distribution.get(0) ?? 0) + 1);
      continue;
    }
    const sourceClass = sourceBuffer[source.headerBytes + index];
    const fallbackClass = landcoverBuffer[targetOffset];
    if (sourceClass === 0) fallbackLandCells++;
    else realClassifiedLandCells++;
    const mapped = mapWorldCoverClass(sourceClass, terrainElevation, coastDistance[index], fallbackClass);
    landcoverBuffer[targetOffset] = mapped;
    distribution.set(mapped, (distribution.get(mapped) ?? 0) + 1);
  }
  assert(realClassifiedLandCells > (realClassifiedLandCells + fallbackLandCells) * .85, `WorldCover coverage too low: ${realClassifiedLandCells}`);
  fs.writeFileSync(landcoverPath, landcoverBuffer);

  const manifest = readJson(path.join(packageDirectory, config.outputs.manifest));
  const sectorsDocument = updateSectors(
    path.join(packageDirectory, config.outputs.sectors),
    manifest.landcover.classes,
    terrainBuffer,
    terrain,
    landcoverBuffer,
    landcover
  );
  updateFauna(path.join(packageDirectory, config.outputs.fauna), sectorsDocument);
  const stats = {
    realClassifiedLandCells,
    fallbackLandCells,
    classDistribution: Object.fromEntries([...distribution.entries()].sort((a, b) => a[0] - b[0]).map(([id, cells]) => [String(id), cells]))
  };
  refreshManifest(packageDirectory, path.join(packageDirectory, config.outputs.manifest), metadata, sourcePath, stats);
  process.stdout.write(stableJson({ regionId, packageDirectory: path.relative(ROOT, packageDirectory), ...stats }));
}

try {
  apply();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
