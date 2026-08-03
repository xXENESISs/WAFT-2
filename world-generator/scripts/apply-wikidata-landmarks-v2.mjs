import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourcePath = path.join(ROOT, 'world-generator/scripts/apply-wikidata-landmarks.mjs');
const temporaryPath = path.join(ROOT, 'world-generator/scripts/.apply-wikidata-landmarks-v2-generated.mjs');

function replaceOnce(source, search, replacement, label) {
  const count = source.split(search).length - 1;
  if (count !== 1) throw new Error(`Expected one ${label}, found ${count}`);
  return source.replace(search, replacement);
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
      protected: true
    };
    const match = knowledge.manualMatches?.[item.id];
    const qid = match?.qid ?? qidFromTags(canonical.tags);
    return enrichItem(canonical, knowledge.entities[qid], qid, true);
  });`,
  'canonical manual landmark restoration'
);

fs.writeFileSync(temporaryPath, generated);
const result = spawnSync(process.execPath, [temporaryPath, ...process.argv.slice(2)], { cwd: ROOT, stdio: 'inherit' });
fs.rmSync(temporaryPath, { force: true });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
