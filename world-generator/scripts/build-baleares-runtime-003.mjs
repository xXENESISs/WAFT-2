import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const BUILD_REVISION = 2;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourcePath = path.join(ROOT, 'mallorca-mobile/region-runtime-baleares-002.html');
const outputPath = path.join(ROOT, 'mallorca-mobile/region-runtime-baleares-003.html');
const reportPath = path.join(ROOT, 'world-generator/baleares-runtime-003-build.json');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function replaceOnce(source, search, replacement, label) {
  const first = source.indexOf(search);
  assert(first >= 0, `Could not find ${label}`);
  assert(source.indexOf(search, first + search.length) < 0, `${label} is not unique`);
  return source.slice(0, first) + replacement + source.slice(first + search.length);
}

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

let html = fs.readFileSync(sourcePath, 'utf8');
html = html.replaceAll('Runtime regional de Baleares 002', 'Runtime regional de Baleares 003');
html = html.replaceAll('RUNTIME REGIONAL 002', 'RUNTIME REGIONAL 003');
html = html.replaceAll('__WAFT_RUNTIME_002_', '__WAFT_RUNTIME_003_');
html = replaceOnce(
  html,
  "      const strafe = state.joyX + (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);",
  "      const strafe = -state.joyX + (keys.has('KeyA') ? 1 : 0) - (keys.has('KeyD') ? 1 : 0);",
  'screen-relative lateral input'
);
html = replaceOnce(
  html,
  "      getState() { return { position: { ...state.camera }, cameraEye: { ...state.cameraEye }, playerFacing: state.playerFacing, cameraMode: 'third-person', characterVisible: true, cameraBlocked: state.cameraBlocked, grounded: state.grounded, activeBuildings: state.activeBuildings, loadedCells: state.loadedCells, collisions: state.collisions, preset: state.activePreset }; },\n      version: '002',",
  "      getState() { return { position: { ...state.camera }, cameraEye: { ...state.cameraEye }, cameraYaw: state.yaw, playerFacing: state.playerFacing, cameraMode: 'third-person', characterVisible: true, cameraBlocked: state.cameraBlocked, lateralControls: 'screen-relative', grounded: state.grounded, activeBuildings: state.activeBuildings, loadedCells: state.loadedCells, collisions: state.collisions, preset: state.activePreset }; },\n      version: '003',",
  'runtime 003 state API'
);
html = html.replaceAll("cameraMode: 'third-person',\n          characterVisible: true,", "cameraMode: 'third-person',\n          characterVisible: true,\n          lateralControls: 'screen-relative',");
html = replaceOnce(
  html,
  "window.__WAFT_RUNTIME_003_STATS__ = { totalBuildings: metadata.counts.buildings, activeBuildings: state.activeBuildings, loadedCells: state.loadedCells, collisions: 0, grounded: true, cameraMode: 'third-person', characterVisible: true, playerFacing: state.playerFacing, cameraBlocked: state.cameraBlocked, cameraEye: { ...state.cameraEye }, webgl2: true, buildId: metadata.buildId, binarySha256: metadata.binary.sha256, position: { ...state.camera } };",
  "window.__WAFT_RUNTIME_003_STATS__ = { totalBuildings: metadata.counts.buildings, activeBuildings: state.activeBuildings, loadedCells: state.loadedCells, collisions: 0, grounded: true, cameraMode: 'third-person', characterVisible: true, lateralControls: 'screen-relative', playerFacing: state.playerFacing, cameraBlocked: state.cameraBlocked, cameraEye: { ...state.cameraEye }, webgl2: true, buildId: metadata.buildId, binarySha256: metadata.binary.sha256, position: { ...state.camera } };",
  'initial runtime 003 stats'
);

assert(html.includes("const strafe = -state.joyX"), 'Lateral joystick axis was not inverted');
assert(html.includes("keys.has('KeyA') ? 1 : 0) - (keys.has('KeyD') ? 1 : 0"), 'Keyboard lateral controls were not inverted');
assert(html.includes("version: '003'"), 'Runtime version 003 marker is missing');
assert(html.includes('window.__WAFT_RUNTIME_003_READY__=true'), 'Runtime 003 ready marker is missing');
assert(!html.includes('RUNTIME REGIONAL 002'), 'Runtime 002 title leaked into runtime 003');

fs.writeFileSync(outputPath, html);
const report = {
  formatVersion: 1,
  buildRevision: BUILD_REVISION,
  runtimeVersion: '003',
  valid: true,
  source: path.relative(ROOT, sourcePath).replaceAll(path.sep, '/'),
  output: path.relative(ROOT, outputPath).replaceAll(path.sep, '/'),
  sourceSha256: sha256(fs.readFileSync(sourcePath)),
  outputSha256: sha256(Buffer.from(html)),
  outputBytes: Buffer.byteLength(html),
  changes: [
    'invert-touch-strafe-to-screen-relative-direction',
    'invert-keyboard-a-d-to-screen-relative-direction',
    'preserve-forward-back-camera-and-character-scale',
    'expose-camera-yaw-and-lateral-control-convention-for-verification'
  ]
};
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
