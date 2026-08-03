import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourcePath = path.join(ROOT, 'world-generator/scripts/build-region-preview.mjs');
const temporaryPath = path.join(ROOT, 'world-generator/scripts/.build-region-preview-v2-generated.mjs');

function replaceOnce(source, search, replacement, label) {
  const count = source.split(search).length - 1;
  if (count !== 1) throw new Error(`Expected one ${label}, found ${count}`);
  return source.replace(search, replacement);
}

let builder = fs.readFileSync(sourcePath, 'utf8');
builder = replaceOnce(
  builder,
  `  const binaryPath = path.join(outputDirectory, 'baleares-preview-v1.bin');`,
  `  const binaryFilename = \`${'${regionId}'}-preview-v1.bin\`;
  const binaryPath = path.join(outputDirectory, binaryFilename);`,
  'preview binary filename'
);
builder = replaceOnce(
  builder,
  `  const buildId = \`baleares-preview-${'${inputsSha256.slice(0, 12)}'}\`;
  const presets = [
    { id: 'overview', name: 'Tot', x: 0, z: 0, terrainMeters: 0, altitude: 310, distance: 0 },
    presetFrom(settlementsDocument.items, 'Palma', ['Palma'], 42, 34),
    presetFrom(settlementsDocument.items, 'Llevant', ['Manacor'], 48, 42),
    presetFrom(settlementsDocument.items, 'Alcúdia', ['Alcúdia', 'Alcudia'], 45, 38),
    presetFrom(settlementsDocument.items, 'Menorca', ['Maó', 'Mao'], 52, 46),
    presetFrom(settlementsDocument.items, 'Eivissa', ['Eivissa'], 50, 44)
  ].filter(Boolean);`,
  `  const buildId = \`${'${regionId}'}-preview-${'${inputsSha256.slice(0, 12)}'}\`;
  const prioritySettlements = [...settlementsDocument.items]
    .sort((a, b) => Number(Boolean(b.protected)) - Number(Boolean(a.protected)) || (b.priority ?? 0) - (a.priority ?? 0) || a.id.localeCompare(b.id));
  const presetSettlements = [];
  const seenPresetNames = new Set();
  for (const item of prioritySettlements) {
    const key = String(item.name ?? item.id).normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
    if (seenPresetNames.has(key)) continue;
    seenPresetNames.add(key);
    presetSettlements.push(item);
    if (presetSettlements.length >= 6) break;
  }
  const presets = [
    { id: 'overview', name: 'Tot', x: 0, z: 0, terrainMeters: 0, altitude: 310, distance: 0 },
    ...presetSettlements.map((item, index) => ({
      id: item.id,
      name: item.name ?? item.id,
      x: item.local.x,
      z: item.local.z,
      terrainMeters: item.local.y,
      altitude: 44 + index * 2,
      distance: 36 + index * 2
    }))
  ];`,
  'generic preview presets'
);
builder = replaceOnce(
  builder,
  `      file: 'baleares-preview-v1.bin',`,
  `      file: binaryFilename,`,
  'preview metadata binary filename'
);
builder = replaceOnce(
  builder,
  `  const metadataPath = path.join(outputDirectory, 'baleares-preview-v1.json');`,
  `  const metadataPath = path.join(outputDirectory, \`${'${regionId}'}-preview-v1.json\`);`,
  'preview metadata filename'
);

if (builder.includes("'baleares-preview-v1")) throw new Error('Baleares preview filenames remain in generic builder');
fs.writeFileSync(temporaryPath, builder);
const result = spawnSync(process.execPath, [temporaryPath, ...process.argv.slice(2)], { cwd: ROOT, stdio: 'inherit' });
fs.rmSync(temporaryPath, { force: true });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
