import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { decodeTerrainHeader, REGION_BINARY_FORMAT } from '../lib/binary-formats.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
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

function terrainCell(terrain, position) {
  return {
    column: Math.max(0, Math.min(terrain.columns - 1, Math.round((position.lon - terrain.bounds.west) / (terrain.bounds.east - terrain.bounds.west) * (terrain.columns - 1)))),
    row: Math.max(0, Math.min(terrain.rows - 1, Math.round((terrain.bounds.north - position.lat) / (terrain.bounds.north - terrain.bounds.south) * (terrain.rows - 1))))
  };
}

function hasNearbyLand(terrainBuffer, terrain, position, radius = 4) {
  const origin = terrainCell(terrain, position);
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const column = origin.column + dx;
      const row = origin.row + dy;
      if (column < 0 || row < 0 || column >= terrain.columns || row >= terrain.rows) continue;
      const value = terrainBuffer.readInt16LE(terrain.headerBytes + (row * terrain.columns + column) * 2);
      if (value !== REGION_BINARY_FORMAT.nodataElevation) return true;
    }
  }
  return false;
}

function verify() {
  const regionId = process.argv[2] ?? 'baleares';
  const config = readJson(path.join(ROOT, 'world-generator/configs', `${regionId}.region.json`));
  const packageDirectory = path.join(ROOT, config.outputs.directory);
  const sourceDirectory = path.join(ROOT, 'world-generator/sources', regionId);
  const metadataPath = path.join(sourceDirectory, 'openstreetmap-extract.json');
  const snapshotPath = path.join(sourceDirectory, 'openstreetmap-extract.json.gz');
  assert(fs.existsSync(metadataPath) && fs.existsSync(snapshotPath), 'OpenStreetMap source snapshot is missing');
  const metadata = readJson(metadataPath);
  const compressed = fs.readFileSync(snapshotPath);
  assert(sha256(compressed) === metadata.snapshotSha256, 'OpenStreetMap snapshot hash mismatch');
  assert(metadata.license === 'ODbL 1.0', 'OpenStreetMap license metadata is missing');
  assert(metadata.attribution.includes('OpenStreetMap'), 'OpenStreetMap attribution is missing');
  assert(metadata.counts.buildings > 5000, `Source contains too few buildings: ${metadata.counts.buildings}`);
  assert(metadata.counts.roads > 1000, `Source contains too few roads: ${metadata.counts.roads}`);
  assert(metadata.counts.hotels > 20, `Source contains too few hotels: ${metadata.counts.hotels}`);
  assert(metadata.counts.ports > 5, `Source contains too few ports: ${metadata.counts.ports}`);

  const manifestPath = path.join(packageDirectory, config.outputs.manifest);
  const manifest = readJson(manifestPath);
  assert(manifest.generationStage === 'openstreetmap-physical-network', 'Package has not reached OpenStreetMap stage');
  assert(manifest.cartography?.snapshotSha256 === metadata.snapshotSha256, 'Manifest OpenStreetMap snapshot mismatch');
  assert(!manifest.pendingStages.includes('openstreetmap-settlements-buildings-and-routes'), 'OpenStreetMap stage is still marked pending');

  const sectorsDocument = readJson(path.join(packageDirectory, config.outputs.sectors));
  const sectors = new Map(sectorsDocument.sectors.map(sector => [sector.id, sector]));
  const terrainBuffer = fs.readFileSync(path.join(packageDirectory, config.outputs.terrain));
  const terrain = decodeTerrainHeader(terrainBuffer);

  const settlementsDocument = readJson(path.join(packageDirectory, config.outputs.settlements));
  assert(settlementsDocument.generationStage === 'openstreetmap-settlements', 'Settlement stage mismatch');
  assert(settlementsDocument.items.length >= 25, `Too few selected settlements: ${settlementsDocument.items.length}`);
  const settlementNames = new Set(settlementsDocument.items.map(item => normalizedName(item.name)));
  for (const expected of ['palma', 'manacor', 'alcudia', 'cala millor', 'mao', 'eivissa']) {
    assert(settlementNames.has(expected), `Missing required settlement ${expected}`);
  }
  for (const settlement of settlementsDocument.items) {
    assert(sectors.has(settlement.sectorId), `Settlement ${settlement.id} has unknown sector`);
    assert(Number.isFinite(settlement.local?.x) && Number.isFinite(settlement.local?.z), `Settlement ${settlement.id} has invalid local position`);
  }

  const objects = readJson(path.join(packageDirectory, config.outputs.objects));
  assert(objects.generationStage === 'openstreetmap-real-footprints', 'Building stage mismatch');
  assert(objects.generatedBuildingsPending === false, 'Buildings are still marked pending');
  assert(objects.items.length >= 1500, `Too few selected buildings: ${objects.items.length}`);
  const buildingIds = new Set();
  const perSector = new Map();
  let hotels = 0;
  let namedBuildings = 0;
  for (const building of objects.items) {
    assert(!buildingIds.has(building.id), `Duplicate building id ${building.id}`);
    buildingIds.add(building.id);
    assert(sectors.has(building.sectorId), `Building ${building.id} has unknown sector`);
    assert(building.footprint.length >= 4, `Building ${building.id} has invalid footprint`);
    assert(building.roofWalkable === true, `Building ${building.id} roof is not walkable`);
    assert(building.collisionMode === config.generation.buildings.collisionMode, `Building ${building.id} collision mode mismatch`);
    assert(building.heightMeters > 1 && building.heightMeters <= 90, `Building ${building.id} height is invalid`);
    assert(hasNearbyLand(terrainBuffer, terrain, building.position), `Building ${building.id} is not near generated land`);
    for (const zone of config.gameplay.reservedZones) {
      if (zone.exclude.includes('buildings')) assert(geoDistanceKm(building.position, zone.center) >= zone.radiusKm, `Building ${building.id} violates protected zone ${zone.id}`);
    }
    perSector.set(building.sectorId, (perSector.get(building.sectorId) ?? 0) + 1);
    if (building.kind === 'hotel') hotels++;
    if (building.name) namedBuildings++;
  }
  assert(hotels >= 20, `Too few selected hotels: ${hotels}`);
  assert(namedBuildings >= 40, `Too few named buildings: ${namedBuildings}`);
  for (const [sectorId, count] of perSector) assert(count <= config.generation.buildings.maximumPerSector, `Sector ${sectorId} exceeds building limit: ${count}`);

  const routes = readJson(path.join(packageDirectory, config.outputs.routes));
  assert(routes.generationStage === 'openstreetmap-transport-network', 'Transport stage mismatch');
  assert(routes.roads.length >= 1000, `Too few selected roads: ${routes.roads.length}`);
  assert(routes.ports.length >= 5, `Too few selected ports: ${routes.ports.length}`);
  const roadClasses = new Set();
  for (const road of routes.roads) {
    assert(road.points.length >= 2, `Road ${road.id} has too few points`);
    assert(road.sectorIds.length >= 1, `Road ${road.id} has no sectors`);
    for (const sectorId of road.sectorIds) assert(sectors.has(sectorId), `Road ${road.id} has unknown sector ${sectorId}`);
    roadClasses.add(road.class);
  }
  assert(roadClasses.has('primary') || roadClasses.has('trunk'), 'Major roads were not imported');
  assert(roadClasses.has('secondary'), 'Secondary roads were not imported');
  assert(roadClasses.has('residential'), 'Residential roads were not imported');
  for (const port of routes.ports) assert(sectors.has(port.sectorId), `Port ${port.id} has unknown sector`);

  const landmarksDocument = readJson(path.join(packageDirectory, config.outputs.landmarks));
  assert(landmarksDocument.generationStage === 'openstreetmap-landmark-candidates', 'Landmark stage mismatch');
  assert(landmarksDocument.items.length >= config.gameplay.contentTargets.minimumLandmarks, `Too few landmarks: ${landmarksDocument.items.length}`);
  const landmarkTypes = new Set(landmarksDocument.items.map(item => item.type));
  for (const expected of ['castle', 'lighthouse']) assert(landmarkTypes.has(expected), `Missing landmark type ${expected}`);
  assert(landmarkTypes.has('church') || landmarkTypes.has('cathedral'), 'Missing religious landmark type church or cathedral');
  for (const landmark of landmarksDocument.items) assert(sectors.has(landmark.sectorId), `Landmark ${landmark.id} has unknown sector`);

  for (const sector of sectors.values()) {
    for (const id of sector.content.buildings) assert(buildingIds.has(id), `Sector ${sector.id} references unknown building ${id}`);
    assert(sector.content.buildings.length <= config.generation.buildings.maximumPerSector, `Sector ${sector.id} content exceeds building limit`);
  }

  for (const record of manifest.files) {
    const filePath = path.join(packageDirectory, record.path);
    const data = fs.readFileSync(filePath);
    assert(data.length === record.bytes, `Manifest size mismatch for ${record.path}`);
    assert(sha256(data) === record.sha256, `Manifest hash mismatch for ${record.path}`);
  }
  const packageBytes = manifest.packageBytesWithoutManifest + fs.statSync(manifestPath).size;
  assert(packageBytes <= config.performance.budgets.downloadMb * 1024 * 1024, 'Package exceeds download budget');

  const report = {
    formatVersion: 1,
    regionId,
    valid: true,
    source: {
      osmTimestamp: metadata.osmTimestamp,
      pbfBytes: metadata.pbfBytes,
      snapshotBytes: metadata.snapshotBytes,
      sourceCounts: metadata.counts
    },
    package: {
      packageBytes,
      settlements: settlementsDocument.items.length,
      buildings: objects.items.length,
      hotels,
      namedBuildings,
      roads: routes.roads.length,
      roadClasses: [...roadClasses].sort(),
      ports: routes.ports.length,
      landmarks: landmarksDocument.items.length,
      landmarkTypes: [...landmarkTypes].sort(),
      sectorsWithBuildings: perSector.size,
      maximumBuildingsInSector: Math.max(...perSector.values())
    }
  };
  const reportPath = path.join(ROOT, 'world-generator', `${regionId}-openstreetmap-validation.json`);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

try {
  verify();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
