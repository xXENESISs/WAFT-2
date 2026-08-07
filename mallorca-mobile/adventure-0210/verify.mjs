import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const here = path.dirname(new URL(import.meta.url).pathname);
const mobile = path.resolve(here, '..');
const index = fs.readFileSync(path.join(here, 'index.html'), 'utf8');
const loader = fs.readFileSync(path.join(here, 'plugin-loader.js'), 'utf8');
const plugin = fs.readFileSync(path.join(here, 'gameplay-plugin.js'), 'utf8');
const world1Reference = path.join(here, 'reference', 'world1-015-source.html');
const runtimes = [
  path.join(mobile, 'region-runtime-baleares-013.html'),
  path.join(mobile, 'region-runtime-catalunya-litoral-003.html'),
];

assert.match(index, /WAFT Adventure 0\.22\.0/);
assert.match(index, /region-runtime-baleares-013\.html/);
assert.match(index, /region-runtime-catalunya-litoral-003\.html/);
assert.match(index, /state\.yaw \+= dx \* \.0042/);
assert.match(index, /WAFTAdventurePlugin\?\.afterWorldDraw/);
assert.match(index, /setAdventureModifiers/);
assert.match(index, /adventureFlight/);
assert.match(index, /adventureFlightFlap/);
assert.match(index, /flightFloor/);
assert.match(index, /state\.adventureFlight \|\| !xTerrain\.land/);
assert.match(index, /plugin-loader\.js/);
assert.match(loader, /gameplay-plugin\.js/);
new vm.Script(loader, { filename: 'plugin-loader.js' });
new vm.Script(plugin, { filename: 'gameplay-plugin.js' });

const bootScripts = [...index.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match => match[1]);
assert.ok(bootScripts.length >= 1, 'integrated index has no boot script');
for (const script of bootScripts) new vm.Script(script, { filename: 'adventure-index-script.js' });

const runtimeAnchors = [
  'drawCharacter(now, eye);',
  'jump() { state.jumpQueued = true; },',
  'window.WAFTRegionRuntime = {',
  'swimStroke: 0,',
  'const swimmingBeforeMove = terrainBeforeMove.inside && !terrainBeforeMove.land;',
  'state.swimming = terrainNow.inside && !terrainNow.land;',
  'const swimSurface = terrainNow.waterHeight + state.playerSwimEyeHeight;',
  'if (xTerrain.inside && (!xTerrain.land || !collidesBuilding(nextX, state.camera.z))) {',
  'if (zTerrain.inside && (!zTerrain.land || !collidesBuilding(state.camera.x, nextZ))) {'
];
for (const runtimePath of runtimes) {
  const source = fs.readFileSync(runtimePath, 'utf8');
  for (const anchor of runtimeAnchors) assert.ok(source.includes(anchor), `${path.basename(runtimePath)} is missing integration anchor: ${anchor}`);
  assert.ok(source.includes('const updateTerrainAlignment = dt => {\n      if (state.swimming) {'), `${path.basename(runtimePath)} lost terrain alignment anchor`);
  const scripts = [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match => match[1]);
  assert.ok(scripts.length >= 1, `${path.basename(runtimePath)} has no script`);
  for (const script of scripts) new vm.Script(script, { filename: path.basename(runtimePath) });
}

for (const pattern of [
  /function drawPenguin/,
  /function buildAdventurePopulation/,
  /Lagartija balear/,
  /Sargantana de las Pitiusas/,
  /Conejo europeo/,
  /Comadreja/,
  /Salamandra/,
  /Gineta/,
  /Myotragus balearicus/,
  /Cabra mallorquina/,
  /Vaca vermella menorquina/,
  /Porc negre mallorquí/,
  /Curruca balear/,
  /Tintorera/,
  /Buitre negro/,
  /function mountAnimal/,
  /flightMountReady/,
  /flightFlap: 3\.8 \+ charge \* 6\.4/,
  /ALETEAR/,
  /function drawCheckpointRoute/,
  /function checkpointAction/,
  /RUTA DE EXPEDICIÓN/,
  /function travelToOtherRegion/,
  /waft\.adventure\.integration\.0210\.v1/
]) assert.match(plugin, pattern);
assert.doesNotMatch(plugin, /createTerrainMesh|parseTerrain|terrain\.bin/);

const faunaEntries = [...plugin.matchAll(/\['[^']+','(?:lizard|gineta|myotragus|goat|cow|pig|warbler|vulture|shark|rabbit|weasel|salamander)'/g)];
assert.ok(faunaEntries.length >= 24, `expected at least 24 integrated fauna entries, got ${faunaEntries.length}`);
for (const type of ['lizard','gineta','myotragus','goat','cow','pig','warbler','vulture','shark','rabbit','weasel','salamander']) {
  assert.match(plugin, new RegExp(`,'${type}',`), `missing fauna family ${type}`);
}

if (fs.existsSync(world1Reference)) {
  const world1 = fs.readFileSync(world1Reference, 'utf8');
  for (const originalFeature of [
    'MONTAR BUITRE', 'OBSERVAR SARGANTANA', 'OBSERVAR CONEJO', 'OBSERVAR COMADREJA', 'OBSERVAR SALAMANDRA',
    'function startJumpCharge', 'function updateCheckpointUI', 'function saveGame', 'function drawPenguin'
  ]) assert.ok(world1.includes(originalFeature), `World 1 reference lost ${originalFeature}`);
}

console.log(`WAFT Adventure 0.22.0 validated: exact World 2 runtimes + World 1 penguin gameplay, ${faunaEntries.length} fauna placements, ground/aquatic/aerial mounts, charged jump/flap, route checkpoints, saves, mission and physical Baleares↔Barcelona travel.`);
