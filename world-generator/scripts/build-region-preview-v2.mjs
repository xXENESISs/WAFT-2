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
  `function buildRoads(routes, sampleTerrain) {`,
  `function buildRoads(routes, sampleTerrain, localBounds) {`,
  'preview road bounds argument'
);
builder = replaceOnce(
  builder,
  `      for (const point of [road.points[pointIndex], road.points[pointIndex + 1]]) {
        records[cursor++] = point[0];
        records[cursor++] = sampleTerrain(point[0], point[1]);
        records[cursor++] = point[1];
        records[cursor++] = classCode;
      }`,
  `      for (const point of [road.points[pointIndex], road.points[pointIndex + 1]]) {
        const x = Math.max(localBounds.minX, Math.min(localBounds.maxX, point[0]));
        const z = Math.max(localBounds.minZ, Math.min(localBounds.maxZ, point[1]));
        records[cursor++] = x;
        records[cursor++] = sampleTerrain(x, z);
        records[cursor++] = z;
        records[cursor++] = classCode;
      }`,
  'preview road vertex constraint'
);
builder = replaceOnce(
  builder,
  `  const roads = buildRoads(routes, sampleTerrain);`,
  `  const roads = buildRoads(routes, sampleTerrain, manifest.projection.localBounds);`,
  'preview road bounds call'
);
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
  const config = readJson(path.join(ROOT, 'world-generator/configs', \`${'${regionId}'}.region.json\`));
  const normalized = value => String(value ?? '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
  const settlementPresets = (config.generation?.settlements?.manualInclude ?? []).slice(0, 3).map((manual, index) => {
    const found = settlementsDocument.items.find(item => normalized(item.name) === normalized(manual.name))
      ?? settlementsDocument.items.find(item => normalized(item.name).includes(normalized(manual.name)));
    if (!found) return null;
    return {
      id: found.id,
      name: manual.name,
      x: found.local.x,
      z: found.local.z,
      terrainMeters: found.local.y,
      altitude: 42 + index * 3,
      distance: 34 + index * 4
    };
  }).filter(Boolean);
  const project = position => ({
    x: (position.lon - manifest.projection.origin.lon) * manifest.projection.kmPerDegreeLon * manifest.projection.unitsPerKm,
    z: -(position.lat - manifest.projection.origin.lat) * manifest.projection.kmPerDegreeLat * manifest.projection.unitsPerKm
  });
  const featurePresets = [...(config.geography?.subregions ?? [])]
    .filter(item => item.type !== 'city')
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.id.localeCompare(b.id))
    .slice(0, 3)
    .map((item, index) => {
      const local = project(item.center);
      return {
        id: \`subregion-${'${item.id}'}\`,
        name: item.name,
        x: Number(local.x.toFixed(4)),
        z: Number(local.z.toFixed(4)),
        terrainMeters: sampleTerrain(local.x, local.z),
        altitude: 52 + index * 4,
        distance: 44 + index * 4
      };
    });
  const presets = [
    { id: 'overview', name: 'Tot', x: 0, z: 0, terrainMeters: 0, altitude: regionId === 'iberia' ? 980 : 310, distance: 0 },
    ...settlementPresets,
    ...featurePresets
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
