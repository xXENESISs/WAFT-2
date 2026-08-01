import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

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

function verify() {
  const regionId = process.argv[2] ?? 'baleares';
  const config = readJson(path.join(ROOT, 'world-generator/configs', `${regionId}.region.json`));
  const packageDirectory = path.join(ROOT, config.outputs.directory);
  const sourceDirectory = path.join(ROOT, 'world-generator/sources', regionId);
  const metadataPath = path.join(sourceDirectory, 'wikidata-landmarks.json');
  const snapshotPath = path.join(sourceDirectory, 'wikidata-landmarks.json.gz');
  assert(fs.existsSync(metadataPath) && fs.existsSync(snapshotPath), 'Wikidata source snapshot is missing');
  const metadata = readJson(metadataPath);
  const compressed = fs.readFileSync(snapshotPath);
  assert(sha256(compressed) === metadata.snapshotSha256, 'Wikidata source snapshot hash mismatch');
  const snapshot = JSON.parse(gunzipSync(compressed));
  assert(snapshot.regionId === regionId && snapshot.formatVersion === 1, 'Wikidata source contract mismatch');
  assert(Object.keys(snapshot.entities).length === metadata.entityCount, 'Wikidata entity count mismatch');
  assert(metadata.entityCount >= 30, `Too few Wikidata entities: ${metadata.entityCount}`);
  assert(metadata.manualMatchCount >= 3, `Too few manual landmarks matched to Wikidata: ${metadata.manualMatchCount}`);

  const landmarks = readJson(path.join(packageDirectory, config.outputs.landmarks));
  assert(landmarks.generationStage === 'wikidata-ranked-landmarks', 'Landmark package is not Wikidata-ranked');
  assert(landmarks.wikidataRankingPending === false, 'Wikidata ranking is still marked pending');
  assert(landmarks.items.length === config.generation.landmarks.maximumCount, `Expected ${config.generation.landmarks.maximumCount} landmarks, found ${landmarks.items.length}`);
  const ids = new Set();
  const qids = new Set();
  const types = new Set();
  const tiers = new Map();
  let linked = 0;
  for (const landmark of landmarks.items) {
    assert(!ids.has(landmark.id), `Duplicate landmark id ${landmark.id}`);
    ids.add(landmark.id);
    types.add(landmark.type);
    assert(Number.isFinite(landmark.ranking?.finalScore), `${landmark.id} has no final ranking score`);
    assert(landmark.modelPolicy?.tier, `${landmark.id} has no model policy`);
    tiers.set(landmark.modelPolicy.tier, (tiers.get(landmark.modelPolicy.tier) ?? 0) + 1);
    if (landmark.wikidata?.qid) {
      linked++;
      assert(!qids.has(landmark.wikidata.qid), `Duplicate Wikidata item ${landmark.wikidata.qid}`);
      qids.add(landmark.wikidata.qid);
      assert(snapshot.entities[landmark.wikidata.qid], `${landmark.id} links to missing Wikidata entity`);
    }
    if (landmark.modelPolicy.tier === 'archetype') assert(landmark.modelPolicy.assetId, `${landmark.id} archetype has no asset id`);
    if (landmark.modelPolicy.tier === 'unique-candidate') assert(landmark.modelPolicy.customAssetRequired === true, `${landmark.id} unique candidate is not marked for a custom asset`);
  }
  assert(linked >= 30, `Too few selected landmarks linked to Wikidata: ${linked}`);
  assert((tiers.get('unique') ?? 0) + (tiers.get('unique-candidate') ?? 0) >= 8, 'Too few unique landmark models or candidates');
  assert((tiers.get('unique-candidate') ?? 0) <= 18, 'Unique candidate budget exceeded');
  assert((tiers.get('archetype') ?? 0) >= 20, 'Too few landmarks assigned to reusable archetypes');
  for (const type of ['castle', 'cathedral', 'lighthouse', 'archaeological_site', 'natural_landmark', 'tower']) assert(types.has(type), `Missing ranked landmark type ${type}`);

  const mandatory = new Map([
    ['catedral-mallorca', 'catedral-mallorca'],
    ['castell-bellver', 'castell-bellver'],
    ['castell-capdepera', 'castell-capdepera'],
    ['coves-drach', 'coves-drach']
  ]);
  for (const [id, assetId] of mandatory) {
    const landmark = landmarks.items.find(item => item.id === id);
    assert(landmark, `Missing manual landmark ${id}`);
    assert(landmark.modelPolicy?.tier === 'unique', `${id} lost its unique model policy`);
    assert(landmark.modelPolicy?.assetId === assetId, `${id} lost asset ${assetId}`);
  }

  const sectors = readJson(path.join(packageDirectory, config.outputs.sectors));
  const sectorIds = new Set(sectors.sectors.map(sector => sector.id));
  for (const landmark of landmarks.items) assert(sectorIds.has(landmark.sectorId), `${landmark.id} refers to an unknown sector`);
  const sectorLandmarks = new Set(sectors.sectors.flatMap(sector => sector.content.landmarks));
  for (const landmark of landmarks.items) assert(sectorLandmarks.has(landmark.id), `${landmark.id} is missing from sector content`);

  const manifest = readJson(path.join(packageDirectory, config.outputs.manifest));
  assert(manifest.generationStage === 'wikidata-ranked-landmarks', 'Manifest stage was not advanced to Wikidata');
  assert(!manifest.pendingStages.includes('wikidata-landmark-ranking'), 'Wikidata stage remains pending in manifest');
  assert(manifest.knowledgeGraph?.snapshotSha256 === metadata.snapshotSha256, 'Manifest Wikidata source hash mismatch');
  assert(manifest.provenance?.wikidataSnapshot?.sha256 === metadata.snapshotSha256, 'Manifest Wikidata provenance mismatch');
  assert(manifest.content.wikidataLinkedLandmarks === linked, 'Manifest linked landmark count mismatch');
  for (const record of manifest.files) {
    const data = fs.readFileSync(path.join(packageDirectory, record.path));
    assert(data.length === record.bytes, `Manifest size mismatch for ${record.path}`);
    assert(sha256(data) === record.sha256, `Manifest hash mismatch for ${record.path}`);
  }

  const packageBytes = manifest.packageBytesWithoutManifest + fs.statSync(path.join(packageDirectory, config.outputs.manifest)).size;
  assert(packageBytes <= config.performance.budgets.downloadMb * 1024 * 1024, 'Wikidata package exceeds mobile budget');
  const report = {
    formatVersion: 1,
    regionId,
    valid: true,
    dataset: metadata.dataset,
    sourceEntities: metadata.entityCount,
    requestedQids: metadata.requestedQids,
    manualMatches: metadata.manualMatchCount,
    selectedLandmarks: landmarks.items.length,
    linkedLandmarks: linked,
    representationCounts: Object.fromEntries([...tiers.entries()].sort()),
    landmarkTypes: [...types].sort(),
    packageBytes
  };
  fs.writeFileSync(path.join(ROOT, 'world-generator', `${regionId}-wikidata-validation.json`), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

try {
  verify();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
