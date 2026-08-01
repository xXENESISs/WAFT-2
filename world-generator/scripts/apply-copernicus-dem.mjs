import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createLocalProjection } from '../lib/projection.mjs';
import { decodeTerrainHeader, REGION_BINARY_FORMAT } from '../lib/binary-formats.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEM_MAGIC = 'WAFTDEM1';
const DEM_HEADER_BYTES = 64;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted(value[key])]));
  }
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

function nearlyEqual(a, b, epsilon = 1e-9) {
  return Math.abs(a - b) <= epsilon;
}

function decodeDemHeader(buffer) {
  assert(buffer.length >= DEM_HEADER_BYTES, 'DEM snapshot is truncated');
  assert(buffer.subarray(0, 8).toString('ascii') === DEM_MAGIC, 'Invalid DEM snapshot magic');
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
    nodata: buffer.readInt32LE(48),
    cellCount: buffer.readUInt32LE(52),
    nominalResolutionMeters: buffer.readUInt32LE(56)
  };
}

function terrainCell(config, position) {
  const { columns, rows } = config.generation.terrain.grid;
  const bounds = config.geography.bounds;
  return {
    column: Math.max(0, Math.min(columns - 1, Math.round((position.lon - bounds.west) / (bounds.east - bounds.west) * (columns - 1)))),
    row: Math.max(0, Math.min(rows - 1, Math.round((bounds.north - position.lat) / (bounds.north - bounds.south) * (rows - 1))))
  };
}

function nearestLandElevation(terrainBuffer, terrainHeader, config, position) {
  const center = terrainCell(config, position);
  const read = (column, row) => terrainBuffer.readInt16LE(terrainHeader.headerBytes + (row * terrainHeader.columns + column) * 2);
  const direct = read(center.column, center.row);
  if (direct !== REGION_BINARY_FORMAT.nodataElevation) return direct;
  for (let radius = 1; radius <= 8; radius++) {
    let best = null;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const column = center.column + dx;
        const row = center.row + dy;
        if (column < 0 || row < 0 || column >= terrainHeader.columns || row >= terrainHeader.rows) continue;
        const elevation = read(column, row);
        if (elevation === REGION_BINARY_FORMAT.nodataElevation) continue;
        const distance = dx * dx + dy * dy;
        if (!best || distance < best.distance) best = { elevation, distance };
      }
    }
    if (best) return best.elevation;
  }
  return 0;
}

function updatePointDocument(filePath, property, terrainBuffer, terrainHeader, config) {
  const document = readJson(filePath);
  for (const item of document[property] ?? []) {
    if (!item.position || !item.local) continue;
    item.local.y = nearestLandElevation(terrainBuffer, terrainHeader, config, item.position);
  }
  fs.writeFileSync(filePath, stableJson(document));
}

function updateSectors(filePath, terrainBuffer, terrainHeader, config, projection) {
  const document = readJson(filePath);
  const byId = new Map(document.sectors.map(sector => [sector.id, sector]));
  const sums = new Map();
  for (const sector of document.sectors) {
    sector.elevationMeters = { min: null, max: null, mean: null };
  }
  const { columns, rows } = config.generation.terrain.grid;
  const bounds = config.geography.bounds;
  const size = document.sectorSizeUnits;
  const minX = document.localBounds.minX;
  const minZ = document.localBounds.minZ;
  for (let row = 0; row < rows; row++) {
    const lat = bounds.north - row / (rows - 1) * (bounds.north - bounds.south);
    for (let column = 0; column < columns; column++) {
      const index = row * columns + column;
      const elevation = terrainBuffer.readInt16LE(terrainHeader.headerBytes + index * 2);
      if (elevation === REGION_BINARY_FORMAT.nodataElevation) continue;
      const lon = bounds.west + column / (columns - 1) * (bounds.east - bounds.west);
      const local = projection.project({ lon, lat });
      const sectorColumn = Math.max(0, Math.min(document.grid.columns - 1, Math.floor((local.x - minX) / size)));
      const sectorRow = Math.max(0, Math.min(document.grid.rows - 1, Math.floor((local.z - minZ) / size)));
      const id = `s-${String(sectorColumn).padStart(2, '0')}-${String(sectorRow).padStart(2, '0')}`;
      const sector = byId.get(id);
      if (!sector) throw new Error(`Terrain cell maps to unknown sector ${id}`);
      sector.elevationMeters.min = sector.elevationMeters.min === null ? elevation : Math.min(sector.elevationMeters.min, elevation);
      sector.elevationMeters.max = sector.elevationMeters.max === null ? elevation : Math.max(sector.elevationMeters.max, elevation);
      sums.set(id, (sums.get(id) ?? 0) + elevation);
    }
  }
  for (const sector of document.sectors) {
    if (sector.landCells > 0) sector.elevationMeters.mean = Number(((sums.get(sector.id) ?? 0) / sector.landCells).toFixed(2));
  }
  fs.writeFileSync(filePath, stableJson(document));
}

function updateManifest(packageDirectory, manifestPath, metadata, sourceBinaryPath, replacementStats) {
  const manifest = readJson(manifestPath);
  const previousTerrainSource = manifest.terrain.source;
  delete manifest.terrain.source;
  manifest.terrain.landMaskSource = previousTerrainSource;
  manifest.terrain.elevationSource = {
    mode: 'copernicus-dem-glo30',
    dataset: metadata.dataset,
    datasetRelease: metadata.datasetRelease,
    provider: metadata.provider,
    distribution: metadata.distribution,
    nominalResolutionMeters: metadata.nominalResolutionMeters,
    retrievedOn: metadata.retrievedOn,
    attribution: metadata.attribution,
    license: metadata.license,
    tiles: metadata.tiles.map(tile => ({ id: tile.id, bytes: tile.bytes, sha256: tile.sha256 })),
    snapshotSha256: metadata.binarySha256
  };
  manifest.terrain.realElevationCells = replacementStats.realElevationCells;
  manifest.terrain.fallbackElevationCells = replacementStats.fallbackElevationCells;
  manifest.terrain.minimumElevationMeters = replacementStats.minimumElevationMeters;
  manifest.terrain.maximumElevationMeters = replacementStats.maximumElevationMeters;
  manifest.terrain.meanElevationMeters = replacementStats.meanElevationMeters;
  manifest.pendingStages = manifest.pendingStages.filter(stage => stage !== 'external-dem-ingestion');
  manifest.provenance.demSnapshot = {
    path: path.relative(ROOT, sourceBinaryPath).replaceAll(path.sep, '/'),
    sha256: metadata.binarySha256,
    metadataPath: `world-generator/sources/${manifest.region.id}/copernicus-dem-glo30.json`
  };

  const fileRecords = [];
  for (const current of manifest.files) {
    const filePath = path.join(packageDirectory, current.path);
    const data = fs.readFileSync(filePath);
    fileRecords.push({ path: current.path, bytes: data.length, sha256: sha256(data) });
  }
  manifest.files = fileRecords;
  manifest.packageBytesWithoutManifest = fileRecords.reduce((sum, file) => sum + file.bytes, 0);
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
  const configPath = path.join(ROOT, 'world-generator/configs', `${regionId}.region.json`);
  const config = readJson(configPath);
  const packageDirectory = path.resolve(ROOT, outputDirectory ?? config.outputs.directory);
  const sourceDirectory = path.join(ROOT, 'world-generator/sources', regionId);
  const sourceBinaryPath = path.join(sourceDirectory, 'copernicus-dem-glo30.bin');
  const sourceMetadataPath = path.join(sourceDirectory, 'copernicus-dem-glo30.json');
  assert(fs.existsSync(sourceBinaryPath), `Missing real DEM snapshot: ${sourceBinaryPath}`);
  assert(fs.existsSync(sourceMetadataPath), `Missing DEM metadata: ${sourceMetadataPath}`);

  const sourceBuffer = fs.readFileSync(sourceBinaryPath);
  const sourceHeader = decodeDemHeader(sourceBuffer);
  const metadata = readJson(sourceMetadataPath);
  assert(sourceHeader.formatVersion === 1, 'Unsupported DEM snapshot version');
  assert(sourceHeader.headerBytes === DEM_HEADER_BYTES, 'Unexpected DEM snapshot header size');
  assert(sourceHeader.columns === config.generation.terrain.grid.columns, 'DEM columns do not match region grid');
  assert(sourceHeader.rows === config.generation.terrain.grid.rows, 'DEM rows do not match region grid');
  assert(sourceHeader.cellCount === sourceHeader.columns * sourceHeader.rows, 'DEM cell count mismatch');
  assert(sourceBuffer.length === sourceHeader.headerBytes + sourceHeader.cellCount * 2, 'DEM snapshot length mismatch');
  assert(sha256(sourceBuffer) === metadata.binarySha256, 'DEM snapshot SHA-256 mismatch');
  for (const key of ['west', 'east', 'south', 'north']) {
    assert(nearlyEqual(sourceHeader.bounds[key], config.geography.bounds[key]), `DEM ${key} bound mismatch`);
  }

  const terrainPath = path.join(packageDirectory, config.outputs.terrain);
  const terrainBuffer = fs.readFileSync(terrainPath);
  const terrainHeader = decodeTerrainHeader(terrainBuffer);
  assert(terrainHeader.columns === sourceHeader.columns && terrainHeader.rows === sourceHeader.rows, 'Terrain and DEM grids differ');
  let realElevationCells = 0;
  let fallbackElevationCells = 0;
  let minimum = Infinity;
  let maximum = -Infinity;
  let sum = 0;
  let landCells = 0;
  for (let index = 0; index < terrainHeader.cellCount; index++) {
    const terrainOffset = terrainHeader.headerBytes + index * 2;
    const current = terrainBuffer.readInt16LE(terrainOffset);
    if (current === REGION_BINARY_FORMAT.nodataElevation) continue;
    const sourceValue = sourceBuffer.readInt16LE(sourceHeader.headerBytes + index * 2);
    let elevation = current;
    if (sourceValue !== sourceHeader.nodata) {
      elevation = Math.max(0, sourceValue);
      terrainBuffer.writeInt16LE(elevation, terrainOffset);
      realElevationCells++;
    } else {
      fallbackElevationCells++;
    }
    minimum = Math.min(minimum, elevation);
    maximum = Math.max(maximum, elevation);
    sum += elevation;
    landCells++;
  }
  assert(realElevationCells > landCells * 0.85, `Real DEM coverage too low: ${realElevationCells}/${landCells}`);
  assert(maximum > 1200, `Real DEM did not preserve Mallorca mountain relief: ${maximum}m`);
  fs.writeFileSync(terrainPath, terrainBuffer);

  const projection = createLocalProjection(config.geography);
  updatePointDocument(path.join(packageDirectory, config.outputs.settlements), 'items', terrainBuffer, terrainHeader, config);
  updatePointDocument(path.join(packageDirectory, config.outputs.landmarks), 'items', terrainBuffer, terrainHeader, config);
  updatePointDocument(path.join(packageDirectory, config.outputs.routes), 'entryPoints', terrainBuffer, terrainHeader, config);
  updateSectors(path.join(packageDirectory, config.outputs.sectors), terrainBuffer, terrainHeader, config, projection);

  const stats = {
    realElevationCells,
    fallbackElevationCells,
    minimumElevationMeters: minimum,
    maximumElevationMeters: maximum,
    meanElevationMeters: Number((sum / landCells).toFixed(3))
  };
  const manifestPath = path.join(packageDirectory, config.outputs.manifest);
  updateManifest(packageDirectory, manifestPath, metadata, sourceBinaryPath, stats);
  process.stdout.write(stableJson({ regionId, packageDirectory: path.relative(ROOT, packageDirectory), ...stats }));
}

try {
  apply();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
