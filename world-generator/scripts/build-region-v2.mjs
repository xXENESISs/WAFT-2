import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createLocalProjection } from '../lib/projection.mjs';
import { encodeTerrain, encodeLandcover, REGION_BINARY_FORMAT } from '../lib/binary-formats.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const GENERATOR_VERSION = '0.2.0';
const DEM_MAGIC = 'WAFTDEM1';
const WORLDCOVER_MAGIC = 'WAFTWCV1';
const SOURCE_HEADER_BYTES = 64;
const NODATA = REGION_BINARY_FORMAT.nodataElevation;
const LANDCOVER_CLASSES = Object.freeze([
  { id: 0, key: 'water', walkable: false },
  { id: 1, key: 'beach', walkable: true },
  { id: 2, key: 'coastal-rock', walkable: true },
  { id: 3, key: 'mediterranean-scrub', walkable: true },
  { id: 4, key: 'mediterranean-forest', walkable: true },
  { id: 5, key: 'agricultural', walkable: true },
  { id: 6, key: 'mountain-rock', walkable: true },
  { id: 7, key: 'wetland', walkable: true },
  { id: 8, key: 'urban', walkable: true },
  { id: 9, key: 'pasture', walkable: true }
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

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

function parseArguments(argv) {
  const args = [...argv];
  const regionId = args.shift() ?? 'baleares';
  let outputDirectory = null;
  while (args.length) {
    const flag = args.shift();
    if (flag === '--output-dir') outputDirectory = args.shift();
    else throw new Error(`Unknown argument ${flag}`);
  }
  return { regionId, outputDirectory };
}

function decodeRasterHeader(buffer, magic, signedNodata) {
  assert(buffer.length >= SOURCE_HEADER_BYTES, `${magic} snapshot is truncated`);
  assert(buffer.subarray(0, 8).toString('ascii') === magic, `Invalid ${magic} snapshot magic`);
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
    nodata: signedNodata ? buffer.readInt32LE(48) : buffer.readUInt32LE(48),
    cellCount: buffer.readUInt32LE(52)
  };
}

function sameBounds(a, b, epsilon = 1e-10) {
  return ['west', 'east', 'south', 'north'].every(key => Math.abs(a[key] - b[key]) <= epsilon);
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
    const next = distance[index] + 1;
    const visit = neighbour => {
      if (distance[neighbour] > next) {
        distance[neighbour] = next;
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

function mapWorldCover(sourceClass, elevation, coastDistance) {
  switch (sourceClass) {
    case 10: return elevation >= 900 ? 6 : 4;
    case 20: return 3;
    case 30: return elevation >= 1100 ? 6 : 9;
    case 40: return 5;
    case 50: return 8;
    case 60:
      if (coastDistance <= 1 && elevation < 35) return 1;
      if (coastDistance <= 2 && elevation < 110) return 2;
      return elevation >= 450 ? 6 : 3;
    case 70: return 6;
    case 80: return 0;
    case 90:
    case 95: return 7;
    case 100: return elevation >= 700 ? 6 : 3;
    case 0: return elevation >= 900 ? 6 : elevation >= 350 ? 4 : 3;
    default: throw new Error(`Unsupported WorldCover class ${sourceClass}`);
  }
}

function terrainCoordinates(config, column, row) {
  const { bounds } = config.geography;
  const { columns, rows } = config.generation.terrain.grid;
  return {
    lon: bounds.west + column / (columns - 1) * (bounds.east - bounds.west),
    lat: bounds.north - row / (rows - 1) * (bounds.north - bounds.south)
  };
}

function terrainCell(config, position) {
  const { columns, rows } = config.generation.terrain.grid;
  const { bounds } = config.geography;
  return {
    column: Math.max(0, Math.min(columns - 1, Math.round((position.lon - bounds.west) / (bounds.east - bounds.west) * (columns - 1)))),
    row: Math.max(0, Math.min(rows - 1, Math.round((bounds.north - position.lat) / (bounds.north - bounds.south) * (rows - 1))))
  };
}

function nearestElevation(elevations, config, position) {
  const center = terrainCell(config, position);
  const { columns, rows } = config.generation.terrain.grid;
  const direct = elevations[center.row * columns + center.column];
  if (direct !== NODATA) return { elevationMeters: direct, snappedToLand: false };
  for (let radius = 1; radius <= 10; radius++) {
    let best = null;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const column = center.column + dx;
        const row = center.row + dy;
        if (column < 0 || row < 0 || column >= columns || row >= rows) continue;
        const elevation = elevations[row * columns + column];
        if (elevation === NODATA) continue;
        const distance = dx * dx + dy * dy;
        if (!best || distance < best.distance) best = { elevationMeters: elevation, distance };
      }
    }
    if (best) return { elevationMeters: best.elevationMeters, snappedToLand: true };
  }
  return { elevationMeters: 0, snappedToLand: true };
}

function createSectorSystem(config, projection) {
  const size = config.performance.sectorSizeUnits;
  const bounds = projection.localBounds;
  const columns = Math.ceil((bounds.maxX - bounds.minX) / size);
  const rows = Math.ceil((bounds.maxZ - bounds.minZ) / size);
  const id = (column, row) => `s-${String(column).padStart(2, '0')}-${String(row).padStart(2, '0')}`;
  const locate = local => {
    const column = Math.max(0, Math.min(columns - 1, Math.floor((local.x - bounds.minX) / size)));
    const row = Math.max(0, Math.min(rows - 1, Math.floor((local.z - bounds.minZ) / size)));
    return { column, row, id: id(column, row) };
  };
  return { size, bounds, columns, rows, id, locate };
}

function transformPoints(config, projection, elevations, sectorSystem, points) {
  return points.map(source => {
    const local = projection.project(source.position);
    const terrain = nearestElevation(elevations, config, source.position);
    return {
      ...source,
      local: { x: Number(local.x.toFixed(4)), y: terrain.elevationMeters, z: Number(local.z.toFixed(4)) },
      sectorId: sectorSystem.locate(local).id,
      terrainStatus: terrain.snappedToLand ? 'nearest-land-cell' : 'exact-cell'
    };
  });
}

function applyPointOverrides(items, type, overrides, config, sectorSystem) {
  const byId = new Map(items.map(item => [item.id, item]));
  const unknown = [];
  for (const operation of overrides.operations ?? []) {
    if (operation.targetType !== type) continue;
    const item = byId.get(operation.targetId);
    if (!item) {
      unknown.push(operation.targetId);
      continue;
    }
    if (operation.op === 'remove') {
      byId.delete(operation.targetId);
      continue;
    }
    if (operation.op === 'move') {
      const multiplier = operation.space === 'geographic-km'
        ? config.geography.scale.horizontalUnitsPerKm * (config.geography.scale.emptySpaceCompression?.factor ?? 1)
        : 1;
      item.local.x = Number((item.local.x + operation.offset.x * multiplier).toFixed(4));
      item.local.z = Number((item.local.z + operation.offset.z * multiplier).toFixed(4));
      item.override = { ...(item.override ?? {}), moved: true };
    } else if (operation.op === 'scale') {
      item.scale = operation.value;
      item.verticalScale = operation.verticalValue ?? operation.value;
    } else if (operation.op === 'custom-model') {
      item.assetId = operation.assetId;
      item.preferredRepresentation = 'unique';
    }
    item.sectorId = sectorSystem.locate(item.local).id;
  }
  if (unknown.length && config.overrides.failOnUnknownTarget) throw new Error(`Unknown ${type} override targets: ${unknown.join(', ')}`);
  return [...byId.values()].map(item => ({ ...item, sectorId: sectorSystem.locate(item.local).id }));
}

function createSectors({ config, projection, sectorSystem, elevations, landcover, content }) {
  const sectors = [];
  const byId = new Map();
  const classKeys = new Map(LANDCOVER_CLASSES.map(item => [item.id, item.key]));
  for (let row = 0; row < sectorSystem.rows; row++) {
    for (let column = 0; column < sectorSystem.columns; column++) {
      const minX = sectorSystem.bounds.minX + column * sectorSystem.size;
      const maxX = Math.min(sectorSystem.bounds.maxX, minX + sectorSystem.size);
      const minZ = sectorSystem.bounds.minZ + row * sectorSystem.size;
      const maxZ = Math.min(sectorSystem.bounds.maxZ, minZ + sectorSystem.size);
      const northWest = projection.unproject({ x: minX, z: minZ });
      const southEast = projection.unproject({ x: maxX, z: maxZ });
      const sector = {
        id: sectorSystem.id(column, row),
        grid: { column, row },
        localBounds: { minX, maxX, minZ, maxZ },
        geographicBounds: { west: northWest.lon, east: southEast.lon, north: northWest.lat, south: southEast.lat },
        active: false,
        totalCells: 0,
        landCells: 0,
        landRatio: 0,
        elevationMeters: { min: null, max: null, mean: null },
        landcover: {},
        content: { settlements: [], landmarks: [], entryPoints: [], spawnPoints: [], buildings: [], roads: [], ports: [] },
        neighbours: []
      };
      sectors.push(sector);
      byId.set(sector.id, sector);
    }
  }

  const { columns, rows } = config.generation.terrain.grid;
  const sums = new Map();
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const index = row * columns + column;
      const local = projection.project(terrainCoordinates(config, column, row));
      const sector = byId.get(sectorSystem.locate(local).id);
      sector.totalCells++;
      const key = classKeys.get(landcover[index]);
      sector.landcover[key] = (sector.landcover[key] ?? 0) + 1;
      const elevation = elevations[index];
      if (elevation === NODATA) continue;
      sector.landCells++;
      sector.elevationMeters.min = sector.elevationMeters.min === null ? elevation : Math.min(sector.elevationMeters.min, elevation);
      sector.elevationMeters.max = sector.elevationMeters.max === null ? elevation : Math.max(sector.elevationMeters.max, elevation);
      sums.set(sector.id, (sums.get(sector.id) ?? 0) + elevation);
    }
  }
  for (const sector of sectors) {
    sector.landRatio = sector.totalCells ? Number((sector.landCells / sector.totalCells).toFixed(6)) : 0;
    sector.active = sector.landCells > 0;
    if (sector.landCells) sector.elevationMeters.mean = Number(((sums.get(sector.id) ?? 0) / sector.landCells).toFixed(2));
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const x = sector.grid.column + dx;
        const y = sector.grid.row + dy;
        if (x >= 0 && y >= 0 && x < sectorSystem.columns && y < sectorSystem.rows) sector.neighbours.push(sectorSystem.id(x, y));
      }
    }
  }
  for (const [key, items] of Object.entries(content)) {
    for (const item of items) byId.get(item.sectorId)?.content[key].push(item.id);
  }
  return sectors;
}

function candidateSectorsForSpecies(species, sectors) {
  const biomeToClasses = {
    'mediterranean-pine': ['mediterranean-forest'],
    'mediterranean-forest': ['mediterranean-forest'],
    agricultural: ['agricultural'],
    mountain: ['mountain-rock'],
    'mediterranean-scrub': ['mediterranean-scrub'],
    pasture: ['pasture'],
    forest: ['mediterranean-forest'],
    wetland: ['wetland'],
    'open-sea': ['water'],
    'coastal-scrub': ['mediterranean-scrub'],
    'coastal-rock': ['coastal-rock']
  };
  const accepted = new Set(species.biomes.flatMap(biome => biomeToClasses[biome] ?? []));
  return sectors.filter(sector => Object.entries(sector.landcover).some(([key, count]) => count > 0 && accepted.has(key))).map(sector => sector.id);
}

function writeFile(directory, filename, data) {
  const target = path.join(directory, filename);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, data);
  return target;
}

function fileRecord(filePath, directory) {
  const data = fs.readFileSync(filePath);
  return { path: path.relative(directory, filePath).replaceAll(path.sep, '/'), bytes: data.length, sha256: sha256(data) };
}

function build() {
  const { regionId, outputDirectory: cliOutput } = parseArguments(process.argv.slice(2));
  const configPath = path.join(ROOT, 'world-generator/configs', `${regionId}.region.json`);
  assert(fs.existsSync(configPath), `Unknown region config: ${configPath}`);
  const config = readJson(configPath);
  assert(config.id === regionId, `Config id ${config.id} does not match ${regionId}`);
  const overridesPath = path.join(ROOT, config.overrides.file);
  const overrides = readJson(overridesPath);
  assert(overrides.regionId === regionId, `Overrides region ${overrides.regionId} does not match ${regionId}`);
  const sourceDirectory = path.join(ROOT, 'world-generator/sources', regionId);
  const demPath = path.join(sourceDirectory, 'copernicus-dem-glo30.bin');
  const demMetadataPath = path.join(sourceDirectory, 'copernicus-dem-glo30.json');
  const worldCoverPath = path.join(sourceDirectory, 'esa-worldcover-2021-v200.bin');
  const worldCoverMetadataPath = path.join(sourceDirectory, 'esa-worldcover-2021-v200.json');
  for (const sourcePath of [demPath, demMetadataPath, worldCoverPath, worldCoverMetadataPath]) assert(fs.existsSync(sourcePath), `Missing source ${sourcePath}`);

  const demBuffer = fs.readFileSync(demPath);
  const worldCoverBuffer = fs.readFileSync(worldCoverPath);
  const dem = decodeRasterHeader(demBuffer, DEM_MAGIC, true);
  const worldCover = decodeRasterHeader(worldCoverBuffer, WORLDCOVER_MAGIC, false);
  const grid = config.generation.terrain.grid;
  assert(dem.formatVersion === 1 && worldCover.formatVersion === 1, 'Unsupported source raster version');
  assert(dem.headerBytes === SOURCE_HEADER_BYTES && worldCover.headerBytes === SOURCE_HEADER_BYTES, 'Unexpected source header size');
  assert(dem.columns === grid.columns && dem.rows === grid.rows, 'DEM grid does not match config');
  assert(worldCover.columns === grid.columns && worldCover.rows === grid.rows, 'WorldCover grid does not match config');
  assert(sameBounds(dem.bounds, config.geography.bounds) && sameBounds(worldCover.bounds, config.geography.bounds), 'Source bounds do not match config');
  assert(demBuffer.length === dem.headerBytes + dem.cellCount * 2, 'DEM byte length mismatch');
  assert(worldCoverBuffer.length === worldCover.headerBytes + worldCover.cellCount, 'WorldCover byte length mismatch');

  const elevations = new Int16Array(dem.cellCount);
  elevations.fill(NODATA);
  const sourceClasses = new Uint8Array(worldCover.cellCount);
  const waterMask = new Uint8Array(dem.cellCount);
  for (let index = 0; index < dem.cellCount; index++) {
    const demValue = demBuffer.readInt16LE(dem.headerBytes + index * 2);
    const sourceClass = worldCoverBuffer[worldCover.headerBytes + index];
    sourceClasses[index] = sourceClass;
    const water = sourceClass === 80 || (sourceClass === 0 && (demValue === dem.nodata || demValue <= 0));
    if (water) {
      waterMask[index] = 1;
      continue;
    }
    elevations[index] = Math.max(0, Math.min(32767, demValue === dem.nodata ? 0 : demValue));
  }
  const coastDistance = distanceGrid(waterMask, grid.columns, grid.rows);
  const landcover = new Uint8Array(dem.cellCount);
  const distribution = {};
  let landCells = 0;
  let minimumElevation = Infinity;
  let maximumElevation = -Infinity;
  let elevationSum = 0;
  for (let index = 0; index < dem.cellCount; index++) {
    if (elevations[index] === NODATA) {
      landcover[index] = 0;
    } else {
      landCells++;
      minimumElevation = Math.min(minimumElevation, elevations[index]);
      maximumElevation = Math.max(maximumElevation, elevations[index]);
      elevationSum += elevations[index];
      landcover[index] = mapWorldCover(sourceClasses[index], elevations[index], coastDistance[index]);
    }
    distribution[landcover[index]] = (distribution[landcover[index]] ?? 0) + 1;
  }
  assert(landCells > dem.cellCount * .2, `Region contains too little land: ${landCells}/${dem.cellCount}`);
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

  const sectors = createSectors({
    config,
    projection,
    sectorSystem,
    elevations,
    landcover,
    content: { settlements, landmarks, entryPoints, spawnPoints }
  });
  const activeSectors = sectors.filter(sector => sector.active).length;
  const fauna = (config.generation.fauna.manualInclude ?? []).map((species, index) => ({
    id: `species-${String(index + 1).padStart(2, '0')}`,
    ...species,
    candidateSectorIds: candidateSectorsForSpecies(species, sectors),
    placementStatus: 'candidate-sectors-generated'
  }));
  for (const species of fauna) assert(species.candidateSectorIds.length > 0, `${species.commonName} has no candidate sectors`);

  const outputDirectory = path.resolve(ROOT, cliOutput ?? config.outputs.directory);
  fs.rmSync(outputDirectory, { recursive: true, force: true });
  fs.mkdirSync(outputDirectory, { recursive: true });
  const terrainPath = writeFile(outputDirectory, config.outputs.terrain, encodeTerrain({
    columns: grid.columns,
    rows: grid.rows,
    bounds: config.geography.bounds,
    elevations,
    seaLevelMeters: config.generation.terrain.seaLevelMeters ?? 0
  }));
  const landcoverPath = writeFile(outputDirectory, config.outputs.landcover, encodeLandcover({
    columns: grid.columns,
    rows: grid.rows,
    bounds: config.geography.bounds,
    classes: landcover,
    classCount: LANDCOVER_CLASSES.length
  }));
  const sectorsPath = writeFile(outputDirectory, config.outputs.sectors, stableJson({
    formatVersion: 1,
    regionId,
    sectorSizeUnits: sectorSystem.size,
    grid: { columns: sectorSystem.columns, rows: sectorSystem.rows },
    localBounds: sectorSystem.bounds,
    sectors
  }));
  const settlementsPath = writeFile(outputDirectory, config.outputs.settlements, stableJson({
    formatVersion: 1,
    regionId,
    generationStage: 'manual-seed-points',
    proceduralGenerationPending: true,
    items: settlements
  }));
  const landmarksPath = writeFile(outputDirectory, config.outputs.landmarks, stableJson({
    formatVersion: 1,
    regionId,
    generationStage: 'manual-landmark-seeds',
    automaticDiscoveryPending: true,
    items: landmarks
  }));
  const routesPath = writeFile(outputDirectory, config.outputs.routes, stableJson({
    formatVersion: 1,
    regionId,
    generationStage: 'manual-travel-entry-points',
    entryPoints,
    connections: config.travel.connections,
    roads: [],
    ports: []
  }));
  const objectsPath = writeFile(outputDirectory, config.outputs.objects, stableJson({
    formatVersion: 1,
    regionId,
    generationStage: 'reserved-zones-only',
    generatedBuildingsPending: true,
    items: [],
    reservedZones: config.gameplay.reservedZones.map(zone => ({ ...zone, localCenter: projection.project(zone.center) })),
    overrideOperations: (overrides.operations ?? []).filter(operation => operation.op === 'local-density' || operation.op === 'protect-area')
  }));
  const faunaPath = writeFile(outputDirectory, config.outputs.fauna, stableJson({
    formatVersion: 1,
    regionId,
    ruleset: config.generation.fauna.ruleset,
    automaticOccurrenceImportPending: true,
    species: fauna
  }));

  const dataFiles = [terrainPath, landcoverPath, sectorsPath, settlementsPath, objectsPath, landmarksPath, faunaPath, routesPath];
  const files = dataFiles.map(filePath => fileRecord(filePath, outputDirectory));
  const packageBytesWithoutManifest = files.reduce((sum, item) => sum + item.bytes, 0);
  const demMetadata = readJson(demMetadataPath);
  const worldCoverMetadata = readJson(worldCoverMetadataPath);
  const manifest = {
    formatVersion: 1,
    generatorVersion: GENERATOR_VERSION,
    region: {
      id: config.id,
      name: config.name,
      version: config.version,
      status: config.status,
      continent: config.continent,
      countryCodes: config.countryCodes
    },
    generationStage: 'dem-worldcover-bootstrap',
    deterministic: true,
    projection: { ...projection.metadata, localBounds: projection.localBounds },
    terrain: {
      format: 'WAFTHGT1',
      columns: grid.columns,
      rows: grid.rows,
      cells: dem.cellCount,
      landCells,
      landRatio: Number((landCells / dem.cellCount).toFixed(6)),
      nodataElevation: NODATA,
      minimumElevationMeters: minimumElevation,
      maximumElevationMeters: maximumElevation,
      meanElevationMeters: Number((elevationSum / landCells).toFixed(3)),
      elevationSource: {
        mode: 'copernicus-dem-glo30',
        dataset: demMetadata.dataset,
        provider: demMetadata.provider,
        retrievedOn: demMetadata.retrievedOn,
        attribution: demMetadata.attribution,
        license: demMetadata.license,
        snapshotSha256: demMetadata.binarySha256,
        tiles: demMetadata.tiles.map(tile => ({ id: tile.id, bytes: tile.bytes, sha256: tile.sha256 }))
      },
      landMaskSource: 'esa-worldcover-water-class'
    },
    landcover: {
      format: 'WAFTLCV1',
      classes: LANDCOVER_CLASSES,
      quality: 'esa-worldcover-2021-v200',
      externalWorldCoverImportPending: false,
      realClassifiedLandCells: landCells,
      fallbackLandCells: 0,
      classDistribution: Object.fromEntries(Object.entries(distribution).sort((a, b) => Number(a[0]) - Number(b[0]))),
      source: {
        dataset: worldCoverMetadata.dataset,
        datasetYear: worldCoverMetadata.datasetYear,
        algorithmVersion: worldCoverMetadata.algorithmVersion,
        provider: worldCoverMetadata.provider,
        distribution: worldCoverMetadata.distribution,
        nominalResolutionMeters: worldCoverMetadata.nominalResolutionMeters,
        retrievedOn: worldCoverMetadata.retrievedOn,
        attribution: worldCoverMetadata.attribution,
        license: worldCoverMetadata.license,
        doi: worldCoverMetadata.doi,
        snapshotSha256: worldCoverMetadata.binarySha256,
        tiles: worldCoverMetadata.tiles.map(tile => ({ id: tile.id, bytes: tile.bytes, sha256: tile.sha256 }))
      }
    },
    sectors: {
      sizeUnits: sectorSystem.size,
      columns: sectorSystem.columns,
      rows: sectorSystem.rows,
      total: sectors.length,
      active: activeSectors,
      preloadRadius: config.performance.preloadRadiusSectors
    },
    content: {
      settlements: settlements.length,
      landmarks: landmarks.length,
      faunaSpecies: fauna.length,
      entryPoints: entryPoints.length,
      connections: config.travel.connections.length,
      generatedBuildings: 0
    },
    files,
    packageBytesWithoutManifest,
    budgets: config.performance.budgets,
    provenance: {
      config: { path: path.relative(ROOT, configPath).replaceAll(path.sep, '/'), sha256: sha256(fs.readFileSync(configPath)) },
      overrides: { path: path.relative(ROOT, overridesPath).replaceAll(path.sep, '/'), sha256: sha256(fs.readFileSync(overridesPath)) },
      demSnapshot: { path: path.relative(ROOT, demPath).replaceAll(path.sep, '/'), sha256: demMetadata.binarySha256, metadataPath: path.relative(ROOT, demMetadataPath).replaceAll(path.sep, '/') },
      worldCoverSnapshot: { path: path.relative(ROOT, worldCoverPath).replaceAll(path.sep, '/'), sha256: worldCoverMetadata.binarySha256, metadataPath: path.relative(ROOT, worldCoverMetadataPath).replaceAll(path.sep, '/') },
      generatorSourcesSha256: sha256(Buffer.concat([
        fs.readFileSync(fileURLToPath(import.meta.url)),
        fs.readFileSync(path.join(ROOT, 'world-generator/lib/projection.mjs')),
        fs.readFileSync(path.join(ROOT, 'world-generator/lib/binary-formats.mjs'))
      ]))
    },
    pendingStages: [
      'openstreetmap-settlements-buildings-and-routes',
      'wikidata-landmark-ranking',
      'gbif-fauna-candidates',
      'procedural-vegetation-and-buildings'
    ]
  };
  const manifestPath = writeFile(outputDirectory, config.outputs.manifest, stableJson(manifest));
  const packageBytes = packageBytesWithoutManifest + fs.statSync(manifestPath).size;
  assert(packageBytes <= config.performance.budgets.downloadMb * 1024 * 1024, `Bootstrap package exceeds ${config.performance.budgets.downloadMb} MB`);
  process.stdout.write(stableJson({
    regionId,
    outputDirectory: path.relative(ROOT, outputDirectory).replaceAll(path.sep, '/'),
    packageBytes,
    landCells,
    activeSectors,
    maximumElevationMeters: maximumElevation,
    files: files.length + 1
  }));
}

try {
  build();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
