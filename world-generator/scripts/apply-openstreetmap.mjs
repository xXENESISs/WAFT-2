import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { createLocalProjection } from '../lib/projection.mjs';
import { decodeTerrainHeader, REGION_BINARY_FORMAT } from '../lib/binary-formats.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PLACE_PRIORITY = Object.freeze({ city: 100, town: 85, village: 70, suburb: 58, quarter: 52, neighbourhood: 45, hamlet: 35, island: 32, locality: 20 });
const MAJOR_ROADS = new Set(['motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary', 'tertiary_link']);
const TRAILS = new Set(['track', 'path', 'footway', 'cycleway', 'bridleway', 'pedestrian', 'steps']);

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

function slug(value) {
  return String(value ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'unnamed';
}

function normalizedName(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function geoDistanceKm(a, b) {
  const meanLat = (a.lat + b.lat) * .5 * Math.PI / 180;
  const dx = (a.lon - b.lon) * 111.320 * Math.cos(meanLat);
  const dz = (a.lat - b.lat) * 111.132;
  return Math.hypot(dx, dz);
}

function pointInProtectedZone(position, zones, layer) {
  return zones.some(zone => zone.exclude?.includes(layer) && geoDistanceKm(position, zone.center) < zone.radiusKm);
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

function terrainSampler(terrainBuffer, terrain) {
  const cell = position => ({
    column: Math.max(0, Math.min(terrain.columns - 1, Math.round((position.lon - terrain.bounds.west) / (terrain.bounds.east - terrain.bounds.west) * (terrain.columns - 1)))),
    row: Math.max(0, Math.min(terrain.rows - 1, Math.round((terrain.bounds.north - position.lat) / (terrain.bounds.north - terrain.bounds.south) * (terrain.rows - 1))))
  });
  const elevationAt = (column, row) => terrainBuffer.readInt16LE(terrain.headerBytes + (row * terrain.columns + column) * 2);
  return position => {
    const origin = cell(position);
    const direct = elevationAt(origin.column, origin.row);
    if (direct !== REGION_BINARY_FORMAT.nodataElevation) return { elevationMeters: direct, snappedToLand: false };
    for (let radius = 1; radius <= 4; radius++) {
      let best = null;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          const column = origin.column + dx;
          const row = origin.row + dy;
          if (column < 0 || row < 0 || column >= terrain.columns || row >= terrain.rows) continue;
          const value = elevationAt(column, row);
          if (value === REGION_BINARY_FORMAT.nodataElevation) continue;
          const distance = dx * dx + dy * dy;
          if (!best || distance < best.distance) best = { elevationMeters: value, distance };
        }
      }
      if (best) return { elevationMeters: best.elevationMeters, snappedToLand: true };
    }
    return null;
  };
}

function createSectorLocator(sectorsDocument) {
  const { columns, rows } = sectorsDocument.grid;
  const size = sectorsDocument.sectorSizeUnits;
  const bounds = sectorsDocument.localBounds;
  const id = (column, row) => `s-${String(column).padStart(2, '0')}-${String(row).padStart(2, '0')}`;
  return local => {
    const column = Math.max(0, Math.min(columns - 1, Math.floor((local.x - bounds.minX) / size)));
    const row = Math.max(0, Math.min(rows - 1, Math.floor((local.z - bounds.minZ) / size)));
    return id(column, row);
  };
}

function localPoint(projection, position, sampleTerrain) {
  const local = projection.project(position);
  const terrain = sampleTerrain(position);
  if (!terrain) return null;
  return {
    local: { x: Number(local.x.toFixed(4)), y: terrain.elevationMeters, z: Number(local.z.toFixed(4)) },
    terrainStatus: terrain.snappedToLand ? 'nearest-land-cell' : 'exact-cell'
  };
}

function transformFootprint(projection, footprint) {
  const points = footprint.map(([lon, lat]) => {
    const local = projection.project({ lon, lat });
    return [Number(local.x.toFixed(4)), Number(local.z.toFixed(4))];
  });
  if (points.length > 2 && (points[0][0] !== points.at(-1)[0] || points[0][1] !== points.at(-1)[1])) points.push(points[0]);
  return points;
}

function buildingHeight(building) {
  if (Number.isFinite(building.heightMeters) && building.heightMeters > 1) return Math.min(90, building.heightMeters);
  if (Number.isFinite(building.levels) && building.levels > 0) return Math.min(90, building.levels * 3.15 + 1.2);
  if (building.kind === 'hotel') return Math.min(42, 12 + Math.sqrt(building.areaM2) * .28);
  if (building.kind === 'religious') return Math.min(35, 10 + Math.sqrt(building.areaM2) * .22);
  if (building.kind === 'historic') return Math.min(30, 7 + Math.sqrt(building.areaM2) * .20);
  if (building.kind === 'public') return Math.min(24, 6 + Math.sqrt(building.areaM2) * .17);
  return Math.min(18, 4.3 + Math.sqrt(building.areaM2) * .11);
}

function selectSettlements(snapshot, manualDocument, config, projection, sampleTerrain, locateSector) {
  const manual = manualDocument.items.map(item => ({ ...item, source: item.source ?? 'manual-config', protected: true }));
  const manualNames = new Set(manual.map(item => normalizedName(item.name)));
  const automatic = snapshot.settlements
    .filter(item => item.name && !manualNames.has(normalizedName(item.name)))
    .map(item => {
      const transformed = localPoint(projection, item.position, sampleTerrain);
      if (!transformed) return null;
      const populationBoost = item.population ? Math.min(35, Math.log10(Math.max(10, item.population)) * 8) : 0;
      const priority = (PLACE_PRIORITY[item.place] ?? 10) + populationBoost;
      return {
        id: `osm-${item.sourceId}`,
        sourceId: item.sourceId,
        source: 'openstreetmap',
        name: item.name,
        place: item.place,
        population: item.population,
        position: item.position,
        ...transformed,
        sectorId: locateSector(transformed.local),
        priority: Number(priority.toFixed(2)),
        tags: item.tags
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));

  const accepted = [...manual];
  for (const item of automatic) {
    if (accepted.length >= config.generation.settlements.maxCount) break;
    const duplicate = accepted.some(previous => normalizedName(previous.name) === normalizedName(item.name) && geoDistanceKm(previous.position, item.position) < 4);
    if (!duplicate) accepted.push(item);
  }
  return accepted.sort((a, b) => a.id.localeCompare(b.id));
}

function selectBuildings(snapshot, config, projection, sampleTerrain, locateSector, reservedZones) {
  const perSector = new Map();
  const duplicateKeys = new Set();
  const discarded = { water: 0, protectedZone: 0, duplicate: 0, sectorLimit: 0, invalid: 0 };
  const candidates = [];
  for (const building of snapshot.buildings) {
    if (!building.footprint || building.footprint.length < 4 || building.areaM2 < 12) { discarded.invalid++; continue; }
    if (pointInProtectedZone(building.position, reservedZones, 'buildings')) { discarded.protectedZone++; continue; }
    const transformed = localPoint(projection, building.position, sampleTerrain);
    if (!transformed) { discarded.water++; continue; }
    const footprint = transformFootprint(projection, building.footprint);
    if (footprint.length < 4) { discarded.invalid++; continue; }
    const duplicateKey = `${Math.round(transformed.local.x * 2)}:${Math.round(transformed.local.z * 2)}:${Math.round(building.areaM2 / 10)}:${building.kind}`;
    if (duplicateKeys.has(duplicateKey)) { discarded.duplicate++; continue; }
    duplicateKeys.add(duplicateKey);
    const sectorId = locateSector(transformed.local);
    const heightMeters = Number(buildingHeight(building).toFixed(2));
    candidates.push({
      id: `osm-building-${building.sourceId}`,
      sourceId: building.sourceId,
      source: 'openstreetmap',
      name: building.name,
      kind: building.kind,
      position: building.position,
      ...transformed,
      sectorId,
      footprint,
      areaM2: building.areaM2,
      heightMeters,
      scaleY: Number((heightMeters / 3.15).toFixed(3)),
      roofWalkable: config.generation.buildings.roofWalkable,
      collisionMode: config.generation.buildings.collisionMode,
      priority: building.priority,
      tags: building.tags
    });
  }

  candidates.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  const selected = [];
  for (const building of candidates) {
    const current = perSector.get(building.sectorId) ?? [];
    if (current.length >= config.generation.buildings.maximumPerSector) { discarded.sectorLimit++; continue; }
    current.push(building.id);
    perSector.set(building.sectorId, current);
    selected.push(building);
  }
  selected.sort((a, b) => a.id.localeCompare(b.id));
  return { selected, discarded, perSector };
}

function roadAllowed(roadClass, config) {
  if (config.generation.transport.includeRoadClasses.includes(roadClass)) return true;
  if (config.generation.transport.includeTrails && TRAILS.has(roadClass)) return true;
  return false;
}

function transformRoads(snapshot, config, projection, locateSector) {
  const roads = [];
  const minorPerSector = new Map();
  for (const road of snapshot.roads) {
    if (!roadAllowed(road.class, config) || road.points.length < 2) continue;
    const points = road.points.map(([lon, lat]) => {
      const local = projection.project({ lon, lat });
      return [Number(local.x.toFixed(4)), Number(local.z.toFixed(4))];
    });
    const sectorIds = [...new Set(points.map(([x, z]) => locateSector({ x, z })))];
    if (!sectorIds.length) continue;
    if (!MAJOR_ROADS.has(road.class)) {
      const primarySector = sectorIds[0];
      const count = minorPerSector.get(primarySector) ?? 0;
      const limit = road.class === 'residential' ? 220 : 150;
      if (count >= limit && !road.name) continue;
      minorPerSector.set(primarySector, count + 1);
    }
    roads.push({
      id: `osm-road-${road.sourceId}`,
      sourceId: road.sourceId,
      source: 'openstreetmap',
      name: road.name,
      class: road.class,
      points,
      sectorIds,
      bridge: road.tags.bridge ?? null,
      tunnel: road.tags.tunnel ?? null,
      surface: road.tags.surface ?? null,
      access: road.tags.access ?? null,
      tags: road.tags
    });
  }
  return roads.sort((a, b) => a.id.localeCompare(b.id));
}

function selectLandmarks(snapshot, manualDocument, config, projection, sampleTerrain, locateSector) {
  const manual = manualDocument.items.map(item => ({ ...item, source: item.source ?? 'manual-config', protected: true }));
  const automatic = [];
  for (const landmark of snapshot.landmarks) {
    if (landmark.score < config.generation.landmarks.minimumScore) continue;
    const transformed = localPoint(projection, landmark.position, sampleTerrain);
    if (!transformed) continue;
    const duplicate = manual.some(item => {
      const sameName = landmark.name && normalizedName(item.name) === normalizedName(landmark.name);
      const sameWikidata = landmark.tags?.wikidata && item.tags?.wikidata === landmark.tags.wikidata;
      return (sameName || sameWikidata) && geoDistanceKm(item.position, landmark.position) < 3;
    });
    if (duplicate) continue;
    const representation = landmark.score >= config.generation.landmarks.uniqueModelScore
      ? 'unique-candidate'
      : landmark.score >= config.generation.landmarks.archetypeScore ? 'archetype' : 'marker';
    automatic.push({
      id: `osm-landmark-${landmark.sourceId}`,
      sourceId: landmark.sourceId,
      source: 'openstreetmap',
      name: landmark.name,
      type: landmark.type,
      position: landmark.position,
      ...transformed,
      sectorId: locateSector(transformed.local),
      score: landmark.score,
      preferredRepresentation: representation,
      footprint: landmark.footprint ? transformFootprint(projection, landmark.footprint) : null,
      areaM2: landmark.areaM2 ?? null,
      tags: landmark.tags
    });
  }
  automatic.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const available = Math.max(0, config.generation.landmarks.maximumCount - manual.length);
  return [...manual, ...automatic.slice(0, available)].sort((a, b) => a.id.localeCompare(b.id));
}

function transformPorts(snapshot, projection, sampleTerrain, locateSector) {
  return snapshot.ports.map(port => {
    const projected = projection.project(port.position);
    const terrain = sampleTerrain(port.position);
    const local = {
      x: Number(projected.x.toFixed(4)),
      y: terrain?.elevationMeters ?? 0,
      z: Number(projected.z.toFixed(4))
    };
    return {
      id: `osm-port-${port.sourceId}`,
      sourceId: port.sourceId,
      source: 'openstreetmap',
      name: port.name,
      type: port.type,
      position: port.position,
      local,
      sectorId: locateSector(local),
      footprint: port.footprint ? transformFootprint(projection, port.footprint) : null,
      tags: port.tags
    };
  }).sort((a, b) => a.id.localeCompare(b.id));
}

function updateSectors(sectorsDocument, content) {
  const byId = new Map(sectorsDocument.sectors.map(sector => [sector.id, sector]));
  for (const sector of sectorsDocument.sectors) {
    sector.content.settlements = [];
    sector.content.landmarks = [];
    sector.content.buildings = [];
    sector.content.roads = [];
    sector.content.ports = [];
  }
  for (const settlement of content.settlements) byId.get(settlement.sectorId)?.content.settlements.push(settlement.id);
  for (const landmark of content.landmarks) byId.get(landmark.sectorId)?.content.landmarks.push(landmark.id);
  for (const building of content.buildings) byId.get(building.sectorId)?.content.buildings.push(building.id);
  for (const port of content.ports) byId.get(port.sectorId)?.content.ports.push(port.id);
  for (const road of content.roads) for (const sectorId of road.sectorIds) byId.get(sectorId)?.content.roads.push(road.id);
  return sectorsDocument;
}

function refreshManifest(packageDirectory, manifestPath, metadata, snapshotPath, counts) {
  const manifest = readJson(manifestPath);
  manifest.generationStage = 'openstreetmap-physical-network';
  manifest.cartography = {
    provider: metadata.provider,
    dataset: metadata.dataset,
    distribution: metadata.distribution,
    sourceUrl: metadata.sourceUrl,
    license: metadata.license,
    attribution: metadata.attribution,
    retrievedOn: metadata.retrievedOn,
    osmTimestamp: metadata.osmTimestamp,
    pbfSha256: metadata.pbfSha256,
    snapshotSha256: metadata.snapshotSha256
  };
  manifest.content = { ...manifest.content, ...counts };
  manifest.pendingStages = manifest.pendingStages.filter(stage => stage !== 'openstreetmap-settlements-buildings-and-routes');
  manifest.provenance.openStreetMapSnapshot = {
    path: path.relative(ROOT, snapshotPath).replaceAll(path.sep, '/'),
    sha256: metadata.snapshotSha256,
    metadataPath: `world-generator/sources/${manifest.region.id}/openstreetmap-extract.json`
  };
  manifest.files = manifest.files.map(record => {
    const data = fs.readFileSync(path.join(packageDirectory, record.path));
    return { path: record.path, bytes: data.length, sha256: sha256(data) };
  });
  manifest.packageBytesWithoutManifest = manifest.files.reduce((sum, item) => sum + item.bytes, 0);
  fs.writeFileSync(manifestPath, stableJson(manifest));
}

function apply() {
  const { regionId, outputDirectory } = parseArguments(process.argv.slice(2));
  const config = readJson(path.join(ROOT, 'world-generator/configs', `${regionId}.region.json`));
  const packageDirectory = path.resolve(ROOT, outputDirectory ?? config.outputs.directory);
  const sourceDirectory = path.join(ROOT, 'world-generator/sources', regionId);
  const snapshotPath = path.join(sourceDirectory, 'openstreetmap-extract.json.gz');
  const metadataPath = path.join(sourceDirectory, 'openstreetmap-extract.json');
  assert(fs.existsSync(snapshotPath), `Missing OpenStreetMap snapshot ${snapshotPath}`);
  assert(fs.existsSync(metadataPath), `Missing OpenStreetMap metadata ${metadataPath}`);
  const compressed = fs.readFileSync(snapshotPath);
  const metadata = readJson(metadataPath);
  assert(sha256(compressed) === metadata.snapshotSha256, 'OpenStreetMap snapshot hash mismatch');
  const snapshot = JSON.parse(gunzipSync(compressed));
  assert(snapshot.regionId === regionId && snapshot.formatVersion === 1, 'OpenStreetMap snapshot contract mismatch');

  const manifestPath = path.join(packageDirectory, config.outputs.manifest);
  const terrainBuffer = fs.readFileSync(path.join(packageDirectory, config.outputs.terrain));
  const terrain = decodeTerrainHeader(terrainBuffer);
  const sampleTerrain = terrainSampler(terrainBuffer, terrain);
  const projection = createLocalProjection(config.geography);
  const sectorsPath = path.join(packageDirectory, config.outputs.sectors);
  const sectorsDocument = readJson(sectorsPath);
  const locateSector = createSectorLocator(sectorsDocument);

  const settlementsPath = path.join(packageDirectory, config.outputs.settlements);
  const manualSettlements = readJson(settlementsPath);
  const settlements = selectSettlements(snapshot, manualSettlements, config, projection, sampleTerrain, locateSector);
  const buildingsResult = selectBuildings(snapshot, config, projection, sampleTerrain, locateSector, config.gameplay.reservedZones);
  const roads = transformRoads(snapshot, config, projection, locateSector);
  const landmarksPath = path.join(packageDirectory, config.outputs.landmarks);
  const manualLandmarks = readJson(landmarksPath);
  const landmarks = selectLandmarks(snapshot, manualLandmarks, config, projection, sampleTerrain, locateSector);
  const ports = transformPorts(snapshot, projection, sampleTerrain, locateSector);

  const objectsPath = path.join(packageDirectory, config.outputs.objects);
  const objectsDocument = readJson(objectsPath);
  objectsDocument.generationStage = 'openstreetmap-real-footprints';
  objectsDocument.generatedBuildingsPending = false;
  objectsDocument.items = buildingsResult.selected;
  objectsDocument.discardedBuildings = buildingsResult.discarded;
  objectsDocument.statistics = {
    sourceBuildings: snapshot.buildings.length,
    selectedBuildings: buildingsResult.selected.length,
    hotels: buildingsResult.selected.filter(item => item.kind === 'hotel').length,
    sectorsWithBuildings: buildingsResult.perSector.size,
    maximumPerSector: config.generation.buildings.maximumPerSector
  };
  fs.writeFileSync(objectsPath, stableJson(objectsDocument));

  fs.writeFileSync(settlementsPath, stableJson({
    formatVersion: 1,
    regionId,
    generationStage: 'openstreetmap-settlements',
    proceduralGenerationPending: false,
    sourceCount: snapshot.settlements.length,
    items: settlements
  }));
  fs.writeFileSync(landmarksPath, stableJson({
    formatVersion: 1,
    regionId,
    generationStage: 'openstreetmap-landmark-candidates',
    automaticDiscoveryPending: false,
    wikidataRankingPending: true,
    sourceCount: snapshot.landmarks.length,
    items: landmarks
  }));

  const routesPath = path.join(packageDirectory, config.outputs.routes);
  const routesDocument = readJson(routesPath);
  routesDocument.generationStage = 'openstreetmap-transport-network';
  routesDocument.roads = roads;
  routesDocument.ports = ports;
  routesDocument.statistics = {
    sourceRoads: snapshot.roads.length,
    selectedRoads: roads.length,
    sourcePorts: snapshot.ports.length,
    selectedPorts: ports.length
  };
  fs.writeFileSync(routesPath, stableJson(routesDocument));

  updateSectors(sectorsDocument, { settlements, landmarks, buildings: buildingsResult.selected, roads, ports });
  fs.writeFileSync(sectorsPath, stableJson(sectorsDocument));

  const counts = {
    settlements: settlements.length,
    landmarks: landmarks.length,
    generatedBuildings: buildingsResult.selected.length,
    hotels: buildingsResult.selected.filter(item => item.kind === 'hotel').length,
    roads: roads.length,
    ports: ports.length
  };
  refreshManifest(packageDirectory, manifestPath, metadata, snapshotPath, counts);
  const packageBytes = readJson(manifestPath).packageBytesWithoutManifest + fs.statSync(manifestPath).size;
  assert(packageBytes <= config.performance.budgets.downloadMb * 1024 * 1024, `OpenStreetMap package exceeds ${config.performance.budgets.downloadMb} MB`);
  process.stdout.write(stableJson({ regionId, packageDirectory: path.relative(ROOT, packageDirectory), packageBytes, ...counts, discardedBuildings: buildingsResult.discarded }));
}

try {
  apply();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
