import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourcePath = path.join(ROOT, 'mallorca-mobile/region-preview-baleares-001.html');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function replaceOnce(source, search, replacement, label) {
  const count = source.split(search).length - 1;
  assert(count === 1, `Expected one ${label}, found ${count}`);
  return source.replace(search, replacement);
}

function displayName(config) {
  return String(config.name || config.id).toUpperCase();
}

function build() {
  const regionId = process.argv[2];
  const version = process.argv[3] ?? '001';
  assert(regionId, 'Usage: node build-region-preview-page.mjs <region-id> [version]');
  const configPath = path.join(ROOT, 'world-generator/configs', `${regionId}.region.json`);
  assert(fs.existsSync(configPath), `Missing region config ${configPath}`);
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  assert(config.id === regionId, `Config id ${config.id} does not match ${regionId}`);
  assert(fs.existsSync(sourcePath), `Missing source preview page ${sourcePath}`);

  let html = fs.readFileSync(sourcePath, 'utf8');
  html = replaceOnce(
    html,
    '<title>WAFT · Visor regional de Baleares 001</title>',
    `<title>WAFT · Visor regional de ${config.name} ${version}</title>`,
    'preview title'
  );
  html = replaceOnce(
    html,
    '<div id="loading"><div><h1>WAFT · BALEARES</h1><div id="loadText">Preparando el primer visor regional…</div></div></div>',
    `<div id="loading"><div><h1>WAFT · ${displayName(config)}</h1><div id="loadText">Preparando el visor regional…</div></div></div>`,
    'preview loading panel'
  );
  html = replaceOnce(
    html,
    '<div id="hud"><div id="hudTitle">VISOR REGIONAL 001</div>',
    `<div id="hud"><div id="hudTitle">VISOR REGIONAL ${version}</div>`,
    'preview HUD version'
  );
  html = replaceOnce(
    html,
    "  const base = '../regions/baleares/';",
    `  const base = '../regions/${regionId}/';`,
    'preview region base'
  );
  html = replaceOnce(
    html,
    '    const metadata = await fetchJson(`${previewBase}baleares-preview-v1.json`);',
    `    const metadata = await fetchJson(\`${'${previewBase}'}${regionId}-preview-v1.json\`);`,
    'preview metadata request'
  );
  html = replaceOnce(
    html,
    "    window.__WAFT_PREVIEW_STATS__={...metadata.counts,webgl2:true,buildId:metadata.buildId,binarySha256:metadata.binary.sha256};",
    `    window.__WAFT_PREVIEW_STATS__={...metadata.counts,regionId:metadata.regionId,regionName:metadata.regionName,webgl2:true,buildId:metadata.buildId,binarySha256:metadata.binary.sha256};`,
    'preview region stats'
  );

  assert(!html.includes("../regions/baleares/"), 'Baleares base remains in generated preview page');
  assert(!html.includes('baleares-preview-v1'), 'Baleares preview filename remains in generated page');
  const outputPath = path.join(ROOT, 'mallorca-mobile', `region-preview-${regionId}-${version}.html`);
  fs.writeFileSync(outputPath, html);
  process.stdout.write(`${JSON.stringify({
    valid: true,
    regionId,
    version,
    source: path.relative(ROOT, sourcePath).replaceAll(path.sep, '/'),
    output: path.relative(ROOT, outputPath).replaceAll(path.sep, '/'),
    bytes: Buffer.byteLength(html)
  }, null, 2)}\n`);
}

try {
  build();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
