import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createLocalProjection } from '../lib/projection.mjs';
import { readTerrainHeader, readLandcoverHeader } from '../lib/binary-formats.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const NODATA = -32768;
const FORMAT_VERSION = 1;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableJson(value[key])]));
  }
  return value;
}

function sha256(value) {
  const input = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(stableJson(value)));
  return crypto.createHash('sha256').update(input).digest('hex');
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sameBounds(a, b, epsilon = 1e-9) {
  return Math.abs(a.west - b.west) <= epsilon && Math.abs(a.east - b.east) <= epsilon && Math.abs(a.south - b.south) <= epsilon && Math.abs(a.north - b.north) <= epsilon;
}

function createSectorSystem(config, projection) {
  const size = config.performance.sectorSizeUnits;
  const bounds = projection.localBounds;
  const columns = Math.max(1, Math.ceil((bounds.maxX - bounds.minX) / size));
  const rows = Math.max(1, Math.ceil((bounds.maxZ - bounds.minZ) / size));
  const id = (column, row) => `s-${String(column).padStart(2, '0')}-${String(row).padStart(2, '0')}`;
  const forLocal = (x, z) => ({
    column: Math.max(0, Math.min(columns - 1, Math.floor((x - bounds.minX) / size))),
    row: Math.max(0, Math.min(rows - 1, Math.floor((z - bounds.minZ) / size)))
  });
  return { size, bounds, columns, rows, id, forLocal };
}

function readOverrideFile(config) {
  const file = path.join(ROOT, config.overrides.file);
  if (!fs.existsSync(file)) return { operations: [] };
  return readJson(file);
}

function elevationAt(elevations, columns, rows, projection, lon, lat) {
  const u = (lon - projection.bounds.west) / (projection.bounds.east - projection.bounds.west);
  const v = (projection.bounds.north - lat) / (projection.bounds.north - projection.bounds.south);
  const column = Math.max(0, Math.min(columns - 1, Math.round(u * (columns - 1))));
  const row = Math.max(0, Math.min(rows - 1, Math.round(v * (rows - 1))));
  const value = elevations[row * columns + column];
  return value === NODATA ? 0 : value;
}

function transformPoints(config, projection, elevations, sectorSystem, items) {
  return items.map((item, index) => {
    const local = projection.project(item.position.lon, item.position.lat);
    const elevationMeters = elevationAt(elevations, config.generation.terrain.grid.columns, config.generation.terrain.grid.rows, projection, item.position.lon, item.position.lat);
    const sector = sectorSystem.forLocal(local.x, local.z);
    return {
      id: item.id ?? `point-${String(index + 1).padStart(3, '0')}`,
      name: item.name ?? item.id ?? `Point ${index + 1}`,
      ...item,
      local: { x: +local.x.toFixed(4), y: elevationMeters, z: +local.z.toFixed(4) },
      sectorId: sectorSystem.id(sector.column, sector.row),
      terrainStatus: 'dem-cell'
    };
  });
}

function applyPointOverrides(items, kind, overrides, config, sectorSystem) {
  const byId = new Map(items.map(item => [item.id, item]));
  for (const operation of overrides.operations ?? []) {
    if (operation.targetType !== kind) continue;
    if (operation.operation === 'remove') {
      if (!byId.has(operation.targetId) && config.overrides.failOnUnknownTarget) throw new Error(`Unknown ${kind} override target ${operation.targetId}`);
      byId.delete(operation.targetId);
      continue;
    }
    const item = byId.get(operation.targetId);
    if (!item) {
      if (config.overrides.failOnUnknownTarget) throw new Error(`Unknown ${kind} override target ${operation.targetId}`);
      continue;
    }
    if (operation.operation === 'rename') item.name = operation.value;
    if (operation.operation === 'protect') item.protected = Boolean(operation.value ?? true);
    if (operation.operation === 'move') {
      if (operation.value?.position) item.position = { ...operation.value.position };
      if (operation.value?.local) item.local = { ...item.local, ...operation.value.local };
      const sector = sectorSystem.forLocal(item.local.x, item.local.z);
      item.sectorId = sectorSystem.id(sector.column, sector.row);
    }
  }
  return [...byId.values()];
}

function distanceGrid(mask, columns, rows) {
  const INF = 1e9;
  const result = new Float32Array(mask.length);
  for (let i = 0; i < result.length; i++) result[i] = mask[i] ? 0 : INF;
  const neighborsForward = [[-1, 0, 1], [0, -1, 1], [-1, -1, Math.SQRT2], [1, -1, Math.SQRT2]];
  const neighborsBackward = [[1, 0, 1], [0, 1, 1], [1, 1, Math.SQRT2], [-1, 1, Math.SQRT2]];
  const pass = (forward) => {
    const ys = forward ? [...Array(rows).keys()] : [...Array(rows).keys()].reverse();
    const xs = forward ? [...Array(columns).keys()] : [...Array(columns).keys()].reverse();
    const neighbors = forward ? neighborsForward : neighborsBackward;
    for (const y of ys) for (const x of xs) {
      const index = y * columns + x;
      for (const [dx, dy, cost] of neighbors) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= columns || ny >= rows) continue;
        result[index] = Math.min(result[index], result[ny * columns + nx] + cost);
      }
    }
  };
  pass(true); pass(false);
  return result;
}

function mapWorldCover(sourceClass, elevation, coastCells) {
  if (sourceClass === 80) return 0;
  if (sourceClass === 50) return 9;
  if (sourceClass === 40) return 5;
  if (sourceClass === 30) return 6;
  if (sourceClass === 20) return 4;
  if (sourceClass === 10 || sourceClass === 95) return 3;
  if (sourceClass === 90 || sourceClass === 100) return 8;
  if (sourceClass === 70 || elevation > 2200) return 7;
  if (coastCells <= 1.5) return 2;
  return 1;
}

function encodeTerrain(elevations, columns, rows, projection) {
  const headerBytes = 64;
  const buffer = Buffer.alloc(headerBytes + elevations.length * 2);
  buffer.write('WAFTHGT1', 0, 'ascii');
  buffer.writeUInt16LE(FORMAT_VERSION, 8);
  buffer.writeUInt16LE(headerBytes, 10);
  buffer.writeUInt16LE(columns, 12);
  buffer.writeUInt16LE(rows, 14);
  buffer.writeDoubleLE(projection.bounds.west, 16);
  buffer.writeDoubleLE(projection.bounds.east, 24);
  buffer.writeDoubleLE(projection.bounds.south, 32);
  buffer.writeDoubleLE(projection.bounds.north, 40);
  buffer.writeInt32LE(NODATA, 48);
  buffer.writeUInt32LE(elevations.length, 52);
  buffer.writeUInt32LE(0, 56);
  buffer.writeUInt32LE(0, 60);
  for (let index = 0; index < elevations.length; index++) buffer.writeInt16LE(elevations[index], headerBytes + index * 2);
  return buffer;
}

function encodeLandcover(landcover, columns, rows, projection) {
  const headerBytes = 64;
  const buffer = Buffer.alloc(headerBytes + landcover.length);
  buffer.write('WAFTLCV1', 0, 'ascii');
  buffer.writeUInt16LE(FORMAT_VERSION, 8);
  buffer.writeUInt16LE(headerBytes, 10);
  buffer.writeUInt16LE(columns, 12);
  buffer.writeUInt16LE(rows, 14);
  buffer.writeDoubleLE(projection.bounds.west, 16);
  buffer.writeDoubleLE(projection.bounds.east, 24);
  buffer.writeDoubleLE(projection.bounds.south, 32);
  buffer.writeDoubleLE(projection.bounds.north, 40);
  buffer.writeUInt32LE(landcover.length, 48);
  buffer.writeUInt32LE(0, 52);
  buffer.writeUInt32LE(0, 56);
  buffer.writeUInt32LE(0, 60);
  Buffer.from(landcover).copy(buffer, headerBytes);
  return buffer;
}

function createSectors({ config, projection, sectorSystem, elevations, landcover, content }) {
  const { columns, rows } = config.generation.terrain.grid;
  const sectors = [];
  for (let row = 0; row < sectorSystem.rows; row++) for (let column = 0; column < sectorSystem.columns; column++) {
    const minX = sectorSystem.bounds.minX + column * sectorSystem.size;
    const maxX = Math.min(sectorSystem.bounds.maxX, minX + sectorSystem.size);
    const minZ = sectorSystem.bounds.minZ + row * sectorSystem.size;
    const maxZ = Math.min(sectorSystem.bounds.maxZ, minZ + sectorSystem.size);
    const sample = projection.unproject((minX + maxX) / 2, (minZ + maxZ) / 2);
    const elevation = elevationAt(elevations, columns, rows, projection, sample.lon, sample.lat);
    const u = Math.max(0, Math.min(columns - 1, Math.round((sample.lon - projection.bounds.west) / (projection.bounds.east - projection.bounds.west) * (columns - 1))));
    const v = Math.max(0, Math.min(rows - 1, Math.round((projection.bounds.north - sample.lat) / (projection.bounds.north - projection.bounds.south) * (rows - 1))));
    const cover = landcover[v * columns + u];
    const sectorId = sectorSystem.id(column, row);
    const counts = {};
    for (const [key, items] of Object.entries(content)) counts[key] = items.filter(item => item.sectorId === sectorId).length;
    sectors.push({ id: sectorId, column, row, bounds: { minX: +minX.toFixed(4), maxX: +maxX.toFixed(4), minZ: +minZ.toFixed(4), maxZ: +maxZ.toFixed(4) }, center: { lon: +sample.lon.toFixed(6), lat: +sample.lat.toFixed(6), elevationMeters: elevation }, dominantLandcover: cover, content: counts, active: cover !== 0 || Object.values(counts).some(Boolean) });
  }
  return sectors;
}

function createEmptyObjects(regionId, generationStage = 'terrain-only') {
  return { formatVersion: 1, regionId, generationStage, generatedBuildingsPending: false, discardedBuildings: {}, items: [] };
}

function build(regionId) {
  const configPath = path.join(ROOT, 'world-generator', 'configs', `${regionId}.region.json`);
  assert(fs.existsSync(configPath), `Missing region config ${regionId}`);
  const config = readJson(configPath);
  const overrides = readOverrideFile(config);
  const sourceDir = path.join(ROOT, 'world-generator', 'sources', regionId);
  const demPath = path.join(sourceDir, 'copernicus-dem-glo30.bin');
  const landcoverPath = path.join(sourceDir, 'esa-worldcover-2021-v200.bin');
  assert(fs.existsSync(demPath), `Missing DEM source for ${regionId}`);
  assert(fs.existsSync(landcoverPath), `Missing landcover source for ${regionId}`);
  const demBuffer = fs.readFileSync(demPath), worldCoverBuffer = fs.readFileSync(landcoverPath);
  const dem = readTerrainHeader(demBuffer), worldCover = readLandcoverHeader(worldCoverBuffer);
  const grid = config.generation.terrain.grid;
  assert(dem.columns === grid.columns && dem.rows === grid.rows, 'DEM grid does not match config');
  assert(worldCover.columns === grid.columns && worldCover.rows === grid.rows, 'WorldCover grid does not match config');
  assert(sameBounds(dem.bounds, config.geography.bounds) && sameBounds(worldCover.bounds, config.geography.bounds), 'Source bounds do not match config');
  assert(demBuffer.length === dem.headerBytes + dem.cellCount * 2, 'DEM byte length mismatch');
  assert(worldCoverBuffer.length === worldCover.headerBytes + worldCover.cellCount, 'WorldCover byte length mismatch');

  const elevations = new Int16Array(dem.cellCount);
  elevations.fill(NODATA);
  const sourceClasses = new Uint8Array(dem.cellCount);
  const waterMask = new Uint8Array(dem.cellCount);
  for (let index = 0; index < dem.cellCount; index++) {
    const demValue = demBuffer.readInt16LE(dem.headerBytes + index * 2);
    const sourceClass = worldCoverBuffer[worldCover.headerBytes + index];
    sourceClasses[index] = sourceClass;
    const water = sourceClass === 80 || (sourceClass === 0 && (demValue === dem.nodata || demValue <= 0));
    if (water) { waterMask[index] = 1; continue; }
    elevations[index] = Math.max(0, Math.min(32767, demValue === dem.nodata ? 0 : demValue));
  }
  const coastDistance = distanceGrid(waterMask, grid.columns, grid.rows);
  const landcover = new Uint8Array(dem.cellCount);
  const distribution = {};
  let landCells = 0, minimumElevation = Infinity, maximumElevation = -Infinity, elevationSum = 0;
  for (let index = 0; index < dem.cellCount; index++) {
    if (elevations[index] === NODATA) landcover[index] = 0;
    else {
      landCells++;
      minimumElevation = Math.min(minimumElevation, elevations[index]);
      maximumElevation = Math.max(maximumElevation, elevations[index]);
      elevationSum += elevations[index];
      landcover[index] = mapWorldCover(sourceClasses[index], elevations[index], coastDistance[index]);
    }
    distribution[landcover[index]] = (distribution[landcover[index]] ?? 0) + 1;
  }
  const subregions = config.geography.subregions ?? [];
  const islandCount = subregions.filter(item => item.type === 'island').length;
  const archipelagoOnly = subregions.length > 0 && islandCount === subregions.length;
  const minimumLandRatio = archipelagoOnly ? .04 : .2;
  assert(landCells > dem.cellCount * minimumLandRatio, `Region contains too little land: ${landCells}/${dem.cellCount} (minimum ratio ${minimumLandRatio})`);
  assert(maximumElevation > 300, `Region relief is unexpectedly flat: ${maximumElevation}m`);

  const projection = createLocalProjection(config.geography);
  const sectorSystem = createSectorSystem(config, projection);
  let settlements = transformPoints(config, projection, elevations, sectorSystem, config.generation.settlements.manualInclude ?? []);
  settlements = applyPointOverrides(settlements, 'settlement', overrides, config, sectorSystem);
  let landmarks = transformPoints(config, projection, elevations, sectorSystem, config.generation.landmarks.manualInclude ?? []);
  landmarks = applyPointOverrides(landmarks, 'landmark', overrides, config, sectorSystem);
  let entryPoints = transformPoints(config, projection, elevations, sectorSystem, config.travel.entryPoints ?? []);
  entryPoints = applyPointOverrides(entryPoints, 'route', overrides, config, sectorSystem);
  let spawnPoints = transformPoints(config, projection, elevations, sectorSystem, config.gameplay.spawnPoints ?? []);
  spawnPoints = applyPointOverrides(spawnPoints, 'spawn', overrides, config, sectorSystem);

  const sectors = createSectors({ config, projection, sectorSystem, elevations, landcover, content: { settlements, landmarks, entryPoints, spawnPoints } });
  const activeSectors = sectors.filter(sector => sector.active).length;
  const fauna = (config.generation.fauna.manualInclude ?? []).map((species, index) => ({ id: `species-${String(index + 1).padStart(2, '0')}`, ...species, source: 'manual-config' }));
  const outputDir = path.join(ROOT, config.outputs.directory);
  fs.mkdirSync(outputDir, { recursive: true });
  const terrainBuffer = encodeTerrain(elevations, grid.columns, grid.rows, projection);
  const landcoverBuffer = encodeLandcover(landcover, grid.columns, grid.rows, projection);
  fs.writeFileSync(path.join(outputDir, config.outputs.terrain), terrainBuffer);
  fs.writeFileSync(path.join(outputDir, config.outputs.landcover), landcoverBuffer);
  writeJson(path.join(outputDir, config.outputs.sectors), { formatVersion: 1, regionId, sectorSizeUnits: sectorSystem.size, columns: sectorSystem.columns, rows: sectorSystem.rows, items: sectors });
  writeJson(path.join(outputDir, config.outputs.settlements), { formatVersion: 1, regionId, generationStage: 'terrain-only', items: settlements });
  writeJson(path.join(outputDir, config.outputs.objects), createEmptyObjects(regionId));
  writeJson(path.join(outputDir, config.outputs.landmarks), { formatVersion: 1, regionId, generationStage: 'terrain-only', items: landmarks });
  writeJson(path.join(outputDir, config.outputs.fauna), { formatVersion: 1, regionId, generationStage: 'terrain-only', items: fauna });
  writeJson(path.join(outputDir, config.outputs.routes), { formatVersion: 1, regionId, generationStage: 'terrain-only', entryPoints, connections: config.travel.connections });

  const manifest = {
    formatVersion: 1,
    region: { id: config.id, name: config.name, version: config.version, status: config.status, continent: config.continent ?? null, countryCodes: config.countryCodes ?? [] },
    projection: { type: config.geography.projection, origin: config.geography.origin, bounds: config.geography.bounds, localBounds: projection.localBounds, unitsPerKm: config.geography.scale.horizontalUnitsPerKm, kmPerDegreeLat: projection.kmPerDegreeLat, kmPerDegreeLon: projection.kmPerDegreeLon },
    terrain: { columns: grid.columns, rows: grid.rows, minimumElevationMeters: Number.isFinite(minimumElevation) ? minimumElevation : 0, maximumElevationMeters: Number.isFinite(maximumElevation) ? maximumElevation : 0, meanElevationMeters: landCells ? +(elevationSum / landCells).toFixed(3) : 0, landCells, waterCells: dem.cellCount - landCells, landRatio: +(landCells / dem.cellCount).toFixed(6), minimumAcceptedLandRatio: minimumLandRatio, archipelagoOnly },
    landcover: { distribution },
    sectors: { sizeUnits: sectorSystem.size, columns: sectorSystem.columns, rows: sectorSystem.rows, total: sectors.length, active: activeSectors },
    content: { settlements: settlements.length, generatedBuildings: 0, landmarks: landmarks.length, faunaSpecies: fauna.length, routes: entryPoints.length },
    performance: config.performance,
    sources: config.sources,
    files: []
  };
  for (const relative of [config.outputs.terrain, config.outputs.landcover, config.outputs.sectors, config.outputs.settlements, config.outputs.objects, config.outputs.landmarks, config.outputs.fauna, config.outputs.routes]) {
    const file = path.join(outputDir, relative);
    manifest.files.push({ path: relative, bytes: fs.statSync(file).size, sha256: sha256File(file) });
  }
  writeJson(path.join(outputDir, config.outputs.manifest), manifest);
  const manifestPath = path.join(outputDir, config.outputs.manifest);
  manifest.files.push({ path: config.outputs.manifest, bytes: fs.statSync(manifestPath).size, sha256: sha256File(manifestPath) });
  writeJson(manifestPath, manifest);
  const packageBytes = manifest.files.reduce((sum, file) => sum + file.bytes, 0);
  console.log(JSON.stringify({ regionId, outputDirectory: config.outputs.directory, files: manifest.files.length, landCells, maximumElevationMeters: maximumElevation, activeSectors, packageBytes }, null, 2));
}

const regionId = process.argv[2];
if (!regionId) { console.error('Usage: node world-generator/scripts/build-region-v2.mjs <region-id>'); process.exit(2); }
try { build(regionId); } catch (error) { console.error(error?.stack ?? error); process.exit(1); }
