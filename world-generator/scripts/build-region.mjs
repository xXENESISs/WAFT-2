import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createLocalProjection } from '../lib/projection.mjs';
import { loadLegacyBalearesSource } from '../lib/legacy-baleares-source.mjs';
import { encodeTerrain, encodeLandcover, REGION_BINARY_FORMAT } from '../lib/binary-formats.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const GENERATOR_VERSION = '0.1.0';
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
const NODATA = REGION_BINARY_FORMAT.nodataElevation;

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

function writeFile(directory, filename, data) {
  const target = path.join(directory, filename);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, data);
  return target;
}

function deterministicNoise(column, row, salt = 0) {
  let value = Math.imul(column + 1 + salt * 17, 374761393) ^ Math.imul(row + 1 + salt * 31, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function distanceGrid(sourceMask, columns, rows) {
  const distance = new Uint16Array(sourceMask.length);
  distance.fill(65535);
  const queue = new Int32Array(sourceMask.length);
  let head = 0;
  let tail = 0;
  for (let index = 0; index < sourceMask.length; index++) {
    if (sourceMask[index]) { distance[index] = 0; queue[tail++] = index; }
  }
  while (head < tail) {
    const index = queue[head++];
    const row = Math.floor(index / columns);
    const column = index - row * columns;
    const next = distance[index] + 1;
    const visit = neighbour => {
      if (distance[neighbour] > next) { distance[neighbour] = next; queue[tail++] = neighbour; }
    };
    if (column > 0) visit(index - 1);
    if (column < columns - 1) visit(index + 1);
    if (row > 0) visit(index - columns);
    if (row < rows - 1) visit(index + columns);
  }
  return distance;
}

function geoDistanceKm(a, b) {
  const meanLat = (a.lat + b.lat) * .5 * Math.PI / 180;
  const dx = (a.lon - b.lon) * 111.320 * Math.cos(meanLat);
  const dz = (a.lat - b.lat) * 111.132;
  return Math.hypot(dx, dz);
}

function terrainCoordinates(config, column, row) {
  const { bounds } = config.geography;
  const { columns, rows } = config.generation.terrain.grid;
  return {
    lon: bounds.west + column / (columns - 1) * (bounds.east - bounds.west),
    lat: bounds.north - row / (rows - 1) * (bounds.north - bounds.south)
  };
}

function classifyLandcover({ config, elevations, landMask, coastDistance }) {
  const { columns, rows } = config.generation.terrain.grid;
  const classes = new Uint8Array(elevations.length);
  const settlements = config.generation.settlements.manualInclude;
  const wetland = config.geography.subregions.find(item => item.id === 'albufera-mallorca')?.center;

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const index = row * columns + column;
      if (!landMask[index]) { classes[index] = 0; continue; }
      const position = terrainCoordinates(config, column, row);
      const elevation = elevations[index];
      const noise = deterministicNoise(column, row, 7);
      const secondNoise = deterministicNoise(column, row, 19);
      const nearestSettlement = settlements.reduce((best, settlement) => {
        const distance = geoDistanceKm(position, settlement.position);
        return distance < best.distance ? { settlement, distance } : best;
      }, { settlement: null, distance: Infinity });
      const urbanRadius = nearestSettlement.settlement?.id === 'palma' ? 5.2 : 2.0;

      if (nearestSettlement.distance <= urbanRadius) classes[index] = 8;
      else if (wetland && geoDistanceKm(position, wetland) < 7.2 && elevation < 35) classes[index] = 7;
      else if (coastDistance[index] <= 1 && elevation < 24) classes[index] = 1;
      else if (coastDistance[index] <= 2 && elevation >= 24) classes[index] = 2;
      else if (elevation >= 700) classes[index] = 6;
      else if (elevation >= 360) classes[index] = secondNoise < .68 ? 4 : 6;
      else if (position.lon > 3.68 && position.lat > 39.75) classes[index] = noise < .58 ? 9 : 3;
      else if (elevation < 210 && noise < .42) classes[index] = 5;
      else if (secondNoise < .34) classes[index] = 4;
      else classes[index] = 3;
    }
  }
  return classes;
}

function nearestElevation(elevations, config, position) {
  const { columns, rows } = config.generation.terrain.grid;
  const { bounds } = config.geography;
  const column = Math.max(0, Math.min(columns - 1, Math.round((position.lon - bounds.west) / (bounds.east - bounds.west) * (columns - 1))));
  const row = Math.max(0, Math.min(rows - 1, Math.round((bounds.north - position.lat) / (bounds.north - bounds.south) * (rows - 1))));
  const direct = elevations[row * columns + column];
  if (direct !== NODATA) return { elevationMeters: direct, snappedToLand: false };
  for (let radius = 1; radius <= 7; radius++) {
    let best = null;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const x = column + dx;
        const y = row + dy;
        if (x < 0 || y < 0 || x >= columns || y >= rows) continue;
        const value = elevations[y * columns + x];
        if (value === NODATA) continue;
        const distance = dx * dx + dy * dy;
        if (!best || distance < best.distance) best = { elevationMeters: value, distance };
      }
    }
    if (best) return { elevationMeters: best.elevationMeters, snappedToLand: true };
  }
  return { elevationMeters: 0, snappedToLand: true };
}

function applyPointOverrides(items, type, overrides, projection, config) {
  const byId = new Map(items.map(item => [item.id, item]));
  for (const operation of overrides.operations) {
    if (operation.targetType !== type) continue;
    const item = byId.get(operation.targetId);
    if (!item) continue;
    if (operation.op === 'remove') {
      byId.delete(operation.targetId);
      continue;
    }
    if (operation.op === 'move') {
      const multiplier = operation.space === 'geographic-km'
        ? config.geography.scale.horizontalUnitsPerKm * (config.geography.scale.emptySpaceCompression?.factor ?? 1)
        : 1;
      item.local.x += operation.offset.x * multiplier;
      item.local.z += operation.offset.z * multiplier;
      item.override = { ...(item.override ?? {}), moved: true };
    } else if (operation.op === 'scale') {
      item.scale = operation.value;
      item.verticalScale = operation.verticalValue ?? operation.value;
    } else if (operation.op === 'custom-model') {
      item.assetId = operation.assetId;
      item.preferredRepresentation = 'unique';
    }
  }
  return [...byId.values()];
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

function transformPoints(config, projection, elevations, sectorSystem, points, type) {
  const transformed = points.map(source => {
    const local = projection.project(source.position);
    const terrain = nearestElevation(elevations, config, source.position);
    return {
      ...source,
      local: { x: local.x, y: terrain.elevationMeters, z: local.z },
      sectorId: sectorSystem.locate(local).id,
      terrainStatus: terrain.snappedToLand ? 'nearest-land-cell' : 'exact-cell'
    };
  });
  return transformed;
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
        content: { settlements: [], landmarks: [], entryPoints: [], spawnPoints: [] },
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
      const geo = terrainCoordinates(config, column, row);
      const local = projection.project(geo);
      const sector = byId.get(sectorSystem.locate(local).id);
      sector.totalCells++;
      const classKey = classKeys.get(landcover[index]);
      sector.landcover[classKey] = (sector.landcover[classKey] ?? 0) + 1;
      if (elevations[index] === NODATA) continue;
      sector.landCells++;
      sector.elevationMeters.min = sector.elevationMeters.min === null ? elevations[index] : Math.min(sector.elevationMeters.min, elevations[index]);
      sector.elevationMeters.max = sector.elevationMeters.max === null ? elevations[index] : Math.max(sector.elevationMeters.max, elevations[index]);
      sums.set(sector.id, (sums.get(sector.id) ?? 0) + elevations[index]);
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
    for (const item of items) {
      const sector = byId.get(item.sectorId);
      if (sector) sector.content[key].push(item.id);
    }
  }
  return sectors;
}

function candidateSectorsForSpecies(species, sectors) {
  const biomeToClasses = {
    'mediterranean-pine': ['mediterranean-forest'],
    agricultural: ['agricultural'],
    mountain: ['mountain-rock'],
    'mediterranean-scrub': ['mediterranean-scrub'],
    pasture: ['pasture'],
    forest: ['mediterranean-forest'],
    'open-sea': ['water'],
    'coastal-scrub': ['mediterranean-scrub'],
    'coastal-rock': ['coastal-rock']
  };
  const accepted = new Set(species.biomes.flatMap(biome => biomeToClasses[biome] ?? []));
  return sectors.filter(sector => Object.entries(sector.landcover).some(([key, count]) => count > 0 && accepted.has(key))).map(sector => sector.id);
}

function makeFileRecord(filePath, rootDirectory) {
  const data = fs.readFileSync(filePath);
  return { path: path.relative(rootDirectory, filePath).replaceAll(path.sep, '/'), bytes: data.length, sha256: sha256(data) };
}

function hashGeneratorSources() {
  const paths = [
    'world-generator/scripts/build-region.mjs',
    'world-generator/lib/projection.mjs',
    'world-generator/lib/legacy-baleares-source.mjs',
    'world-generator/lib/binary-formats.mjs'
  ];
  const hash = crypto.createHash('sha256');
  for (const relative of paths) {
    hash.update(relative);
    hash.update(fs.readFileSync(path.join(ROOT, relative)));
  }
  return hash.digest('hex');
}

function build() {
  const { regionId, outputDirectory: cliOutput } = parseArguments(process.argv.slice(2));
  const configPath = path.join(ROOT, 'world-generator/configs', `${regionId}.region.json`);
  if (!fs.existsSync(configPath)) throw new Error(`Unknown region config: ${configPath}`);
  const config = readJson(configPath);
  const overridesPath = path.join(ROOT, config.overrides.file);
  const overrides = readJson(overridesPath);
  const outputDirectory = path.resolve(ROOT, cliOutput ?? config.outputs.directory);
  fs.rmSync(outputDirectory, { recursive: true, force: true });
  fs.mkdirSync(outputDirectory, { recursive: true });

  const projection = createLocalProjection(config.geography);
  if (regionId !== 'baleares') throw new Error('Only the Baleares bootstrap source is implemented in generator 0.1.0');
  const sourcePath = path.join(ROOT, 'mallorca-mobile/waft-0158.html');
  const source = loadLegacyBalearesSource({ htmlPath: sourcePath, projection });
  const { columns, rows } = config.generation.terrain.grid;
  const elevations = new Int16Array(columns * rows);
  elevations.fill(NODATA);
  const landMask = new Uint8Array(columns * rows);
  const sourceCounts = {};

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const index = row * columns + column;
      const position = terrainCoordinates(config, column, row);
      const sample = source.sample(position.lon, position.lat);
      if (!sample) continue;
      const elevation = Math.max(0, Math.min(32767, Math.round(sample.elevationMeters)));
      elevations[index] = elevation;
      landMask[index] = 1;
      sourceCounts[sample.source] = (sourceCounts[sample.source] ?? 0) + 1;
    }
  }

  const waterSources = Uint8Array.from(landMask, value => value ? 0 : 1);
  const coastDistance = distanceGrid(waterSources, columns, rows);
  const landcover = classifyLandcover({ config, elevations, landMask, coastDistance });
  const sectorSystem = createSectorSystem(config, projection);

  let settlements = transformPoints(config, projection, elevations, sectorSystem, config.generation.settlements.manualInclude, 'settlement');
  settlements = applyPointOverrides(settlements, 'settlement', overrides, projection, config);
  let landmarks = transformPoints(config, projection, elevations, sectorSystem, config.generation.landmarks.manualInclude, 'landmark');
  landmarks = applyPointOverrides(landmarks, 'landmark', overrides, projection, config);
  let entryPoints = transformPoints(config, projection, elevations, sectorSystem, config.travel.entryPoints.map(item => ({ ...item, position: item.position })), 'route');
  entryPoints = applyPointOverrides(entryPoints, 'route', overrides, projection, config);
  const spawnPoints = transformPoints(config, projection, elevations, sectorSystem, config.gameplay.spawnPoints, 'spawn');

  const sectors = createSectors({
    config,
    projection,
    sectorSystem,
    elevations,
    landcover,
    content: { settlements, landmarks, entryPoints, spawnPoints }
  });

  const sectorMap = new Map(sectors.map(sector => [sector.id, sector]));
  for (const item of [...settlements, ...landmarks, ...entryPoints, ...spawnPoints]) {
    const location = sectorSystem.locate(item.local);
    item.sectorId = location.id;
    if (!sectorMap.has(item.sectorId)) throw new Error(`Point ${item.id} has invalid sector ${item.sectorId}`);
  }

  const terrainBuffer = encodeTerrain({ columns, rows, bounds: config.geography.bounds, elevations, seaLevelMeters: config.generation.terrain.seaLevelMeters });
  const landcoverBuffer = encodeLandcover({ columns, rows, bounds: config.geography.bounds, classes: landcover, classCount: LANDCOVER_CLASSES.length });
  const terrainPath = writeFile(outputDirectory, config.outputs.terrain, terrainBuffer);
  const landcoverPath = writeFile(outputDirectory, config.outputs.landcover, landcoverBuffer);

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
    generationStage: 'manual-and-priority-landmarks',
    automaticDiscoveryPending: true,
    items: landmarks
  }));
  const routesPath = writeFile(outputDirectory, config.outputs.routes, stableJson({
    formatVersion: 1,
    regionId,
    entryPoints,
    connections: config.travel.connections
  }));
  const objectsPath = writeFile(outputDirectory, config.outputs.objects, stableJson({
    formatVersion: 1,
    regionId,
    generationStage: 'reserved-zones-only',
    generatedBuildingsPending: true,
    items: [],
    reservedZones: config.gameplay.reservedZones.map(zone => ({
      ...zone,
      localCenter: projection.project(zone.center)
    })),
    overrideOperations: overrides.operations.filter(operation => operation.op === 'local-density' || operation.op === 'protect-area')
  }));
  const sectorsPath = writeFile(outputDirectory, config.outputs.sectors, stableJson({
    formatVersion: 1,
    regionId,
    sectorSizeUnits: sectorSystem.size,
    grid: { columns: sectorSystem.columns, rows: sectorSystem.rows },
    localBounds: sectorSystem.bounds,
    sectors
  }));
  const faunaItems = config.generation.fauna.manualInclude.map((species, index) => ({
    id: `species-${String(index + 1).padStart(2, '0')}`,
    ...species,
    candidateSectorIds: candidateSectorsForSpecies(species, sectors),
    placementStatus: 'candidate-sectors-generated'
  }));
  const faunaPath = writeFile(outputDirectory, config.outputs.fauna, stableJson({
    formatVersion: 1,
    regionId,
    ruleset: config.generation.fauna.ruleset,
    automaticOccurrenceImportPending: true,
    species: faunaItems
  }));

  const dataFiles = [terrainPath, landcoverPath, sectorsPath, settlementsPath, objectsPath, landmarksPath, faunaPath, routesPath];
  const fileRecords = dataFiles.map(filePath => makeFileRecord(filePath, outputDirectory));
  const totalBytes = fileRecords.reduce((sum, item) => sum + item.bytes, 0);
  const landCells = landMask.reduce((sum, value) => sum + value, 0);
  const activeSectors = sectors.filter(sector => sector.active).length;
  const configData = fs.readFileSync(configPath);
  const overridesData = fs.readFileSync(overridesPath);
  const sourceData = fs.readFileSync(sourcePath);

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
    generationStage: 'terrain-landcover-sectors-bootstrap',
    deterministic: true,
    projection: { ...projection.metadata, localBounds: projection.localBounds },
    terrain: {
      format: 'WAFTHGT1',
      columns,
      rows,
      cells: columns * rows,
      landCells,
      landRatio: Number((landCells / (columns * rows)).toFixed(6)),
      nodataElevation: NODATA,
      sourceCounts,
      source: source.metadata
    },
    landcover: {
      format: 'WAFTLCV1',
      classes: LANDCOVER_CLASSES,
      quality: 'deterministic-bootstrap',
      externalWorldCoverImportPending: true
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
      faunaSpecies: faunaItems.length,
      entryPoints: entryPoints.length,
      connections: config.travel.connections.length,
      generatedBuildings: 0
    },
    files: fileRecords,
    packageBytesWithoutManifest: totalBytes,
    budgets: config.performance.budgets,
    provenance: {
      config: { path: path.relative(ROOT, configPath), sha256: sha256(configData) },
      overrides: { path: path.relative(ROOT, overridesPath), sha256: sha256(overridesData) },
      bootstrapSource: { path: path.relative(ROOT, sourcePath), sha256: sha256(sourceData) },
      generatorSourcesSha256: hashGeneratorSources()
    },
    pendingStages: [
      'external-dem-ingestion',
      'esa-worldcover-ingestion',
      'openstreetmap-settlements-buildings-and-routes',
      'wikidata-landmark-ranking',
      'gbif-fauna-candidates',
      'procedural-vegetation-and-buildings'
    ]
  };
  const manifestPath = writeFile(outputDirectory, config.outputs.manifest, stableJson(manifest));
  const packageBytes = totalBytes + fs.statSync(manifestPath).size;
  process.stdout.write(`${stableJson({ regionId, outputDirectory: path.relative(ROOT, outputDirectory), packageBytes, landCells, activeSectors, files: fileRecords.length + 1 })}`);
}

try {
  build();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
