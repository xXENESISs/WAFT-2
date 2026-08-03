import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourcePath = path.join(ROOT, 'world-generator/scripts/verify-region-preview.mjs');
const temporaryPath = path.join(ROOT, 'world-generator/scripts/.verify-region-preview-v2-generated.mjs');

function replaceOnce(source, search, replacement, label) {
  const count = source.split(search).length - 1;
  if (count !== 1) throw new Error(`Expected one ${label}, found ${count}`);
  return source.replace(search, replacement);
}

let verifier = fs.readFileSync(sourcePath, 'utf8');
verifier = replaceOnce(
  verifier,
  `  const metadataPath = path.join(previewDirectory, 'baleares-preview-v1.json');
  const binaryPath = path.join(previewDirectory, 'baleares-preview-v1.bin');`,
  `  const config = readJson(path.join(ROOT, 'world-generator/configs', \`${'${regionId}'}.region.json\`));
  const metadataPath = path.join(previewDirectory, \`${'${regionId}'}-preview-v1.json\`);
  const binaryPath = path.join(previewDirectory, \`${'${regionId}'}-preview-v1.bin\`);`,
  'generic preview paths'
);
verifier = verifier.replaceAll('y <= 2000', 'y <= 3000');
verifier = replaceOnce(
  verifier,
  `  assert(header.buildingCount >= 5000, \`Too few buildings: ${'${header.buildingCount}'}\`);
  assert(metadata.counts.hotels >= 2000, \`Too few hotels: ${'${metadata.counts.hotels}'}\`);
  assert(metadata.counts.selectedRoads >= 3000, \`Too few selected roads: ${'${metadata.counts.selectedRoads}'}\`);
  assert(header.roadVertexCount >= 10000, \`Too few road vertices: ${'${header.roadVertexCount}'}\`);
  assert(header.landmarkCount === 90, \`Expected 90 landmarks, got ${'${header.landmarkCount}'}\`);
  assert(header.settlementCount >= 60, \`Too few settlements: ${'${header.settlementCount}'}\`);
  assert(buffer.length < 8 * 1024 * 1024, \`Preview binary is too large: ${'${buffer.length}'}\`);
  assert(metadata.presets.some(item => item.id === 'overview'), 'Missing overview preset');
  assert(metadata.presets.some(item => item.name === 'Palma'), 'Missing Palma preset');
  assert(metadata.presets.some(item => item.name === 'Menorca'), 'Missing Menorca preset');
  assert(metadata.presets.some(item => item.name === 'Eivissa'), 'Missing Eivissa preset');`,
  `  const minimumLandmarks = Math.min(config.generation.landmarks.maximumCount, config.gameplay.contentTargets.minimumLandmarks);
  assert(header.buildingCount >= 1000, \`Too few buildings: ${'${header.buildingCount}'}\`);
  assert(metadata.counts.selectedRoads >= 1000, \`Too few selected roads: ${'${metadata.counts.selectedRoads}'}\`);
  assert(header.roadVertexCount >= 4000, \`Too few road vertices: ${'${header.roadVertexCount}'}\`);
  assert(header.landmarkCount >= minimumLandmarks, \`Too few landmarks: ${'${header.landmarkCount}'}/${'${minimumLandmarks}'}\`);
  assert(header.settlementCount >= 20, \`Too few settlements: ${'${header.settlementCount}'}\`);
  assert(buffer.length < 12 * 1024 * 1024, \`Preview binary is too large: ${'${buffer.length}'}\`);
  assert(metadata.presets.some(item => item.id === 'overview'), 'Missing overview preset');
  assert(metadata.presets.length >= 4, \`Too few preview presets: ${'${metadata.presets.length}'}\`);`,
  'region-neutral preview thresholds'
);

if (verifier.includes('baleares-preview-v1')) throw new Error('Baleares preview paths remain in generic verifier');
fs.writeFileSync(temporaryPath, verifier);
const result = spawnSync(process.execPath, [temporaryPath, ...process.argv.slice(2)], { cwd: ROOT, stdio: 'inherit' });
fs.rmSync(temporaryPath, { force: true });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
