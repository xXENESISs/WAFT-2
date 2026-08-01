import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { createLocalProjection } from '../lib/projection.mjs';
import { decodeTerrainHeader, REGION_BINARY_FORMAT } from '../lib/binary-formats.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ARCHETYPES = Object.freeze({
  castle: 'regional-castle',
  fortress: 'regional-fortress',
  cathedral: 'regional-cathedral',
  church: 'regional-church',
  monastery: 'regional-monastery',
  tower: 'regional-tower',
  lighthouse: 'regional-lighthouse',
  palace: 'regional-palace',
  monument: 'regional-monument',
  archaeological_site: 'regional-archaeological-site',
  natural_landmark: 'regional-natural-landmark'
});
const DIVERSITY_TARGETS = Object.freeze({
  castle: 3,
  fortress: 2,
  cathedral: 1,
  church: 3,
  monastery: 2,
  lighthouse: 4,
  tower: 4,
  palace: 2,
  monument: 4,
  archaeological_site: 7,
  natural_landmark: 5
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

function normalizedName(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function geoDistanceKm(a, b) {
  const meanLat = (a.lat + b.lat) * .5 * Math.PI / 180;
  const dx = (a.lon - b.lon) * 111.320 * Math.cos(meanLat);
  const dz = (a.lat - b.lat) * 111.132;
  return Math.hypot(dx, dz);
}

function terrainSampler(terrainBuffer, terrain) {
  const elevationAt = (column, row) => terrainBuffer.readInt16LE(terrain.headerBytes + (row * terrain.columns + column) * 2);
  return position => {
    const column = Math.max(0, Math.min(terrain.columns - 1, Math.round((position.lon - terrain.bounds.west) / (terrain.bounds.east - terrain.bounds.west) * (terrain.columns - 1))));
    const row = Math.max(0, Math.min(terrain.rows - 1, Math.round((terrain.bounds.north - position.lat) / (terrain.bounds.north - terrain.bounds.south) * (terrain.rows - 1))));
    const direct = elevationAt(column, row);
    if (direct !== REGION_BINARY_FORMAT.nodataElevation) return { elevationMeters: direct, snappedToLand: false };
    for (let radius = 1; radius <= 4; radius++) {
      let best = null;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          const x = column + dx;
          const y = row + dy;
          if (x < 0 || y < 0 || x >= terrain.columns || y >= terrain.rows) continue;
          const elevation = elevationAt(x, y);
          if (elevation === REGION_BINARY_FORMAT.nodataElevation) continue;
          const distance = dx * dx + dy * dy;
          if (!best || distance < best.distance) best = { elevationMeters: elevation, distance };
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
  return local => {
    const column = Math.max(0, Math.min(columns - 1, Math.floor((local.x - bounds.minX) / size)));
    const row = Math.max(0, Math.min(rows - 1, Math.floor((local.z - bounds.minZ) / size)));
    return `s-${String(column).padStart(2, '0')}-${String(row).padStart(2, '0')}`;
  };
}

function localPoint(projection, position, sampleTerrain) {
  const projected = projection.project(position);
  const terrain = sampleTerrain(position);
  if (!terrain) return null;
  return {
    local: { x: Number(projected.x.toFixed(4)), y: terrain.elevationMeters, z: Number(projected.z.toFixed(4)) },
    terrainStatus: terrain.snappedToLand ? 'nearest-land-cell' : 'exact-cell'
  };
}

function transformFootprint(projection, footprint) {
  if (!Array.isArray(footprint)) return null;
  const points = footprint.map(([lon, lat]) => {
    const local = projection.project({ lon, lat });
    return [Number(local.x.toFixed(4)), Number(local.z.toFixed(4))];
  });
  if (points.length > 2 && (points[0][0] !== points.at(-1)[0] || points[0][1] !== points.at(-1)[1])) points.push(points[0]);
  return points.length >= 4 ? points : null;
}

function qidFromTags(tags) {
  const value = tags?.wikidata;
  if (!value) return null;
  return String(value).split(/[;,\s]+/).find(candidate => /^Q[1-9][0-9]*$/.test(candidate)) ?? null;
}

function preferredLabel(entity, fallback) {
  return entity?.labels?.ca ?? entity?.labels?.es ?? entity?.labels?.en ?? fallback;
}

function preferredDescription(entity) {
  return entity?.descriptions?.ca ?? entity?.descriptions?.es ?? entity?.descriptions?.en ?? null;
}

function wikidataScore(entity) {
  if (!entity) return { boost: 0, reasons: [] };
  let boost = 0;
  const reasons = [];
  const sitelinks = entity.sitelinkCount ?? 0;
  if (sitelinks > 0) {
    const value = Math.min(28, Math.log2(sitelinks + 1) * 4);
    boost += value;
    reasons.push(`sitelinks:${sitelinks}`);
  }
  if (entity.heritageDesignations?.length) { boost += 12; reasons.push('heritage'); }
  if (entity.image) { boost += 4; reasons.push('image'); }
  if (entity.commonsCategory) { boost += 3; reasons.push('commons'); }
  const localArticles = ['ca', 'es', 'en'].filter(language => entity.sitelinks?.[language]);
  if (localArticles.length) { boost += localArticles.length * 2; reasons.push(`articles:${localArticles.join(',')}`); }
  if (entity.officialWebsite) { boost += 1; reasons.push('official-website'); }
  if (entity.coordinate) { boost += 1; reasons.push('coordinate'); }
  return { boost: Number(boost.toFixed(2)), reasons };
}

function enrichItem(item, entity, qid, manual = false) {
  const baseScore = manual ? 140 : Number(item.score ?? 20);
  const enrichment = wikidataScore(entity);
  const finalScore = Number((baseScore + enrichment.boost).toFixed(2));
  const result = {
    ...item,
    name: preferredLabel(entity, item.name),
    originalName: item.name,
    score: finalScore,
    ranking: {
      baseScore,
      wikidataBoost: enrichment.boost,
      finalScore,
      reasons: manual ? ['manual-include', ...enrichment.reasons] : enrichment.reasons
    }
  };
  if (qid && entity) {
    result.wikidata = {
      qid,
      labels: entity.labels,
      description: preferredDescription(entity),
      sitelinkCount: entity.sitelinkCount,
      sitelinks: entity.sitelinks,
      heritageDesignations: entity.heritageDesignations,
      instanceOf: entity.instanceOf,
      image: entity.image,
      commonsCategory: entity.commonsCategory,
      officialWebsite: entity.officialWebsite,
      heightMeters: entity.heightMeters,
      inception: entity.inception,
      coordinate: entity.coordinate
    };
  }
  return result;
}

function buildCandidate(source, projection, sampleTerrain, locateSector) {
  const transformed = localPoint(projection, source.position, sampleTerrain);
  if (!transformed) return null;
  return {
    id: `osm-landmark-${source.sourceId}`,
    sourceId: source.sourceId,
    source: 'openstreetmap',
    name: source.name,
    type: source.type,
    position: source.position,
    ...transformed,
    sectorId: locateSector(transformed.local),
    score: source.score,
    footprint: transformFootprint(projection, source.footprint),
    areaM2: source.areaM2 ?? null,
    tags: source.tags
  };
}

function isDuplicate(candidate, accepted) {
  const qid = candidate.wikidata?.qid;
  return accepted.some(item => {
    if (qid && item.wikidata?.qid === qid) return true;
    if (!candidate.name || !item.name) return false;
    return normalizedName(candidate.name) === normalizedName(item.name) && geoDistanceKm(candidate.position, item.position) < 1.5;
  });
}

function selectDiverse(manual, candidates, maximumCount) {
  const selected = [...manual];
  const remaining = candidates.filter(candidate => !isDuplicate(candidate, selected));
  for (const [type, target] of Object.entries(DIVERSITY_TARGETS)) {
    let current = selected.filter(item => item.type === type).length;
    for (const candidate of remaining) {
      if (selected.length >= maximumCount || current >= target) break;
      if (candidate.type !== type || selected.includes(candidate) || isDuplicate(candidate, selected)) continue;
      selected.push(candidate);
      current++;
    }
  }
  for (const candidate of remaining) {
    if (selected.length >= maximumCount) break;
    if (!selected.includes(candidate) && !isDuplicate(candidate, selected)) selected.push(candidate);
  }
  return selected;
}

function assignModels(items) {
  const automatic = items.filter(item => item.source !== 'manual-config').sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const uniqueEligible = automatic.filter(item => item.score >= 100 || (item.wikidata?.sitelinkCount ?? 0) >= 18 || item.wikidata?.heritageDesignations?.length);
  const uniqueIds = new Set(uniqueEligible.slice(0, 18).map(item => item.id));
  for (const item of items) {
    if (item.source === 'manual-config') {
      item.modelPolicy = {
        tier: item.preferredRepresentation === 'unique' ? 'unique' : 'archetype',
        assetId: item.assetId ?? ARCHETYPES[item.type] ?? null,
        customAssetRequired: item.preferredRepresentation === 'unique' && !item.assetId,
        reason: 'manual-direction'
      };
      continue;
    }
    if (uniqueIds.has(item.id)) {
      item.preferredRepresentation = 'unique-candidate';
      item.modelPolicy = { tier: 'unique-candidate', assetId: null, customAssetRequired: true, reason: 'wikidata-ranking' };
    } else if (item.score >= 55) {
      item.preferredRepresentation = 'archetype';
      item.assetId = ARCHETYPES[item.type] ?? 'regional-landmark';
      item.modelPolicy = { tier: 'archetype', assetId: item.assetId, customAssetRequired: false, reason: 'regional-archetype' };
    } else {
      item.preferredRepresentation = item.footprint ? 'real-footprint' : 'marker';
      item.modelPolicy = { tier: item.footprint ? 'real-footprint' : 'marker', assetId: null, customAssetRequired: false, reason: 'low-priority' };
    }
  }
  return items;
}

function refreshManifest(packageDirectory, manifestPath, metadata, snapshotPath, statistics) {
  const manifest = readJson(manifestPath);
  manifest.generationStage = 'wikidata-ranked-landmarks';
  manifest.knowledgeGraph = {
    provider: metadata.provider,
    dataset: metadata.dataset,
    endpoint: metadata.endpoint,
    license: metadata.license,
    retrievedOn: metadata.retrievedOn,
    requestedQids: metadata.requestedQids,
    entityCount: metadata.entityCount,
    snapshotSha256: metadata.snapshotSha256
  };
  manifest.content = { ...manifest.content, ...statistics };
  manifest.pendingStages = manifest.pendingStages.filter(stage => stage !== 'wikidata-landmark-ranking');
  manifest.provenance.wikidataSnapshot = {
    path: path.relative(ROOT, snapshotPath).replaceAll(path.sep, '/'),
    sha256: metadata.snapshotSha256,
    metadataPath: `world-generator/sources/${manifest.region.id}/wikidata-landmarks.json`
  };
  manifest.files = manifest.files.map(record => {
    const data = fs.readFileSync(path.join(packageDirectory, record.path));
    return { path: record.path, bytes: data.length, sha256: sha256(data) };
  });
  manifest.packageBytesWithoutManifest = manifest.files.reduce((sum, record) => sum + record.bytes, 0);
  fs.writeFileSync(manifestPath, stableJson(manifest));
}

function apply() {
  const { regionId, outputDirectory } = parseArguments(process.argv.slice(2));
  const config = readJson(path.join(ROOT, 'world-generator/configs', `${regionId}.region.json`));
  const packageDirectory = path.resolve(ROOT, outputDirectory ?? config.outputs.directory);
  const sourceDirectory = path.join(ROOT, 'world-generator/sources', regionId);
  const snapshotPath = path.join(sourceDirectory, 'wikidata-landmarks.json.gz');
  const metadataPath = path.join(sourceDirectory, 'wikidata-landmarks.json');
  const osmPath = path.join(sourceDirectory, 'openstreetmap-extract.json.gz');
  assert(fs.existsSync(snapshotPath) && fs.existsSync(metadataPath), 'Missing Wikidata landmark snapshot');
  assert(fs.existsSync(osmPath), 'Missing OpenStreetMap snapshot');
  const compressed = fs.readFileSync(snapshotPath);
  const metadata = readJson(metadataPath);
  assert(sha256(compressed) === metadata.snapshotSha256, 'Wikidata snapshot hash mismatch');
  const knowledge = JSON.parse(gunzipSync(compressed));
  const osm = JSON.parse(gunzipSync(fs.readFileSync(osmPath)));
  assert(knowledge.regionId === regionId && knowledge.formatVersion === 1, 'Wikidata snapshot contract mismatch');

  const terrainBuffer = fs.readFileSync(path.join(packageDirectory, config.outputs.terrain));
  const terrain = decodeTerrainHeader(terrainBuffer);
  const sampleTerrain = terrainSampler(terrainBuffer, terrain);
  const projection = createLocalProjection(config.geography);
  const sectorsPath = path.join(packageDirectory, config.outputs.sectors);
  const sectorsDocument = readJson(sectorsPath);
  const locateSector = createSectorLocator(sectorsDocument);
  const landmarksPath = path.join(packageDirectory, config.outputs.landmarks);
  const current = readJson(landmarksPath);
  const manual = current.items.filter(item => item.source === 'manual-config').map(item => {
    const match = knowledge.manualMatches?.[item.id];
    const qid = match?.qid ?? qidFromTags(item.tags);
    return enrichItem({ ...item, source: 'manual-config' }, knowledge.entities[qid], qid, true);
  });

  const currentBySourceId = new Map(current.items.filter(item => item.sourceId).map(item => [item.sourceId, item]));
  const candidatesByKey = new Map();
  for (const source of osm.landmarks) {
    const qid = qidFromTags(source.tags);
    const entity = qid ? knowledge.entities[qid] : null;
    const existing = currentBySourceId.get(source.sourceId);
    if (!entity && !existing) continue;
    const candidate = existing ? { ...existing } : buildCandidate(source, projection, sampleTerrain, locateSector);
    if (!candidate) continue;
    const enriched = enrichItem(candidate, entity, qid, false);
    const key = qid ? `qid:${qid}` : `source:${source.sourceId}`;
    const previous = candidatesByKey.get(key);
    if (!previous || enriched.score > previous.score || (enriched.score === previous.score && enriched.id < previous.id)) candidatesByKey.set(key, enriched);
  }
  const candidates = [...candidatesByKey.values()].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const selected = assignModels(selectDiverse(manual, candidates, config.generation.landmarks.maximumCount));
  selected.sort((a, b) => a.id.localeCompare(b.id));

  const bySector = new Map(sectorsDocument.sectors.map(sector => [sector.id, sector]));
  for (const sector of sectorsDocument.sectors) sector.content.landmarks = [];
  for (const landmark of selected) bySector.get(landmark.sectorId)?.content.landmarks.push(landmark.id);
  fs.writeFileSync(sectorsPath, stableJson(sectorsDocument));

  const representationCounts = selected.reduce((counts, item) => {
    const tier = item.modelPolicy?.tier ?? 'unknown';
    counts[tier] = (counts[tier] ?? 0) + 1;
    return counts;
  }, {});
  const statistics = {
    landmarks: selected.length,
    wikidataLinkedLandmarks: selected.filter(item => item.wikidata?.qid).length,
    uniqueModelCandidates: selected.filter(item => item.modelPolicy?.tier === 'unique-candidate' || item.modelPolicy?.tier === 'unique').length,
    landmarkArchetypes: selected.filter(item => item.modelPolicy?.tier === 'archetype').length
  };
  fs.writeFileSync(landmarksPath, stableJson({
    formatVersion: 1,
    regionId,
    generationStage: 'wikidata-ranked-landmarks',
    automaticDiscoveryPending: false,
    wikidataRankingPending: false,
    sourceCount: osm.landmarks.length,
    wikidataEntityCount: Object.keys(knowledge.entities).length,
    representationCounts,
    items: selected
  }));

  const manifestPath = path.join(packageDirectory, config.outputs.manifest);
  refreshManifest(packageDirectory, manifestPath, metadata, snapshotPath, statistics);
  const manifest = readJson(manifestPath);
  const packageBytes = manifest.packageBytesWithoutManifest + fs.statSync(manifestPath).size;
  assert(packageBytes <= config.performance.budgets.downloadMb * 1024 * 1024, `Wikidata package exceeds ${config.performance.budgets.downloadMb} MB`);
  process.stdout.write(stableJson({ regionId, packageDirectory: path.relative(ROOT, packageDirectory), packageBytes, ...statistics, representationCounts }));
}

try {
  apply();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
