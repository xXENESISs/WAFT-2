import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourcePath = path.join(ROOT, 'world-generator/scripts/apply-wikidata-landmarks.mjs');
const temporaryPath = path.join(ROOT, 'world-generator/scripts/.apply-wikidata-landmarks-v2-generated.mjs');

function replaceOnce(source, search, replacement, label) {
  const count = source.split(search).length - 1;
  if (count !== 1) throw new Error(`Expected one ${label}, found ${count}`);
  return source.replace(search, replacement);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function verifyProtectedLandmarks(args) {
  const regionId = args.find(argument => !argument.startsWith('-')) ?? 'baleares';
  const outputIndex = args.indexOf('--output-dir');
  const config = readJson(path.join(ROOT, 'world-generator/configs', `${regionId}.region.json`));
  const packageDirectory = path.resolve(ROOT, outputIndex >= 0 ? args[outputIndex + 1] : config.outputs.directory);
  const landmarks = readJson(path.join(packageDirectory, config.outputs.landmarks));
  const snapshot = JSON.parse(gunzipSync(fs.readFileSync(path.join(ROOT, 'world-generator/sources', regionId, 'wikidata-landmarks.json.gz'))));
  const generatedById = new Map(landmarks.items.map(item => [item.id, item]));

  for (const configured of config.generation.landmarks.manualInclude) {
    const item = generatedById.get(configured.id);
    assert(item, `Missing protected landmark ${configured.id}`);
    assert(item.source === 'manual-config' && item.protected === true, `Landmark ${configured.id} lost protected manual status`);
    assert(item.name === configured.name, `Landmark ${configured.id} name changed to ${item.name}`);
    assert(item.type === configured.type, `Landmark ${configured.id} type changed to ${item.type}`);
    const match = snapshot.manualMatches?.[configured.id] ?? null;
    const expectedQid = match?.qid ?? null;
    const actualQid = item.wikidata?.qid ?? null;
    assert(actualQid === expectedQid, `Landmark ${configured.id} QID mismatch: ${actualQid}/${expectedQid}`);
    if (match) {
      const semanticMatch = (
        (match.typeMatch && match.nameSimilarity >= 0.52 && match.distanceKm <= 0.65)
        || (match.nameSimilarity >= 0.88 && match.distanceKm <= 1.5)
      );
      assert(semanticMatch, `Landmark ${configured.id} has weak Wikidata match ${match.qid}`);
    }
  }
}

let generated = fs.readFileSync(sourcePath, 'utf8');
generated = replaceOnce(
  generated,
  `    name: preferredLabel(entity, item.name),`,
  `    name: manual ? item.name : preferredLabel(entity, item.name),`,
  'manual landmark name preservation'
);
generated = replaceOnce(
  generated,
  `  const current = readJson(landmarksPath);
  const manual = current.items.filter(item => item.source === 'manual-config').map(item => {
    const match = knowledge.manualMatches?.[item.id];
    const qid = match?.qid ?? qidFromTags(item.tags);
    return enrichItem({ ...item, source: 'manual-config' }, knowledge.entities[qid], qid, true);
  });`,
  `  const current = readJson(landmarksPath);
  const manualConfigById = new Map(config.generation.landmarks.manualInclude.map(item => [item.id, item]));
  const manual = current.items.filter(item => item.source === 'manual-config').map(item => {
    const configured = manualConfigById.get(item.id) ?? {};
    const canonical = {
      ...item,
      ...configured,
      position: configured.position ?? item.position,
      name: configured.name ?? item.name,
      type: configured.type ?? item.type,
      preferredRepresentation: configured.preferredRepresentation ?? item.preferredRepresentation,
      assetId: configured.assetId ?? item.assetId,
      source: 'manual-config',
      protected: true,
      wikidata: undefined,
      ranking: undefined
    };
    const match = knowledge.manualMatches?.[item.id];
    const qid = match?.qid ?? qidFromTags(canonical.tags);
    return enrichItem(canonical, knowledge.entities[qid], qid, true);
  });`,
  'canonical manual landmark restoration'
);
generated = replaceOnce(
  generated,
  `    const candidate = existing ? { ...existing } : buildCandidate(source, projection, sampleTerrain, locateSector);`,
  `    const candidate = existing ? { ...existing, score: source.score, wikidata: undefined, ranking: undefined } : buildCandidate(source, projection, sampleTerrain, locateSector);`,
  'automatic landmark enrichment reset'
);

const args = process.argv.slice(2);
fs.writeFileSync(temporaryPath, generated);
const result = spawnSync(process.execPath, [temporaryPath, ...args], { cwd: ROOT, stdio: 'inherit' });
fs.rmSync(temporaryPath, { force: true });
if (result.error) throw result.error;
if (result.status === 0) verifyProtectedLandmarks(args);
process.exitCode = result.status ?? 1;
