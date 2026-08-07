import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const here = path.dirname(new URL(import.meta.url).pathname);
const mobile = path.resolve(here, '..');
const index = fs.readFileSync(path.join(here, 'index.html'), 'utf8');
const loader = fs.readFileSync(path.join(here, 'plugin-loader.js'), 'utf8');
const plugin = fs.readFileSync(path.join(here, 'gameplay-plugin.js'), 'utf8');
const playability = fs.readFileSync(path.join(here, 'playability-0230.js'), 'utf8');
const mobilePolish = fs.readFileSync(path.join(here, 'mobile-polish-0231.js'), 'utf8');
const world1Reference = path.join(here, 'reference', 'world1-015-source.html');
const runtimes = [
  path.join(mobile, 'region-runtime-baleares-013.html'),
  path.join(mobile, 'region-runtime-catalunya-litoral-003.html'),
];

assert.match(index, /WAFT Adventure 0\.23\.1/);
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
assert.match(index, /__WAFT_ADVENTURE_BUILD__='0\.23\.1'/);

assert.match(loader, /gameplay-plugin\.js/);
assert.match(loader, /playability-0230\.js/);
assert.match(loader, /mobile-polish-0231\.js/);
assert.match(loader, /__WAFT_INTERNAL_GAME__/);
assert.match(loader, /WAFTAnimalRenderer0230/);
assert.match(loader, /distance < 1\.6/);
assert.match(loader, /api\.sampleSurface\(animal\.x, animal\.z\)\?\.water/);
assert.match(loader, /⚓/);
new vm.Script(loader, { filename: 'plugin-loader.js' });
new vm.Script(plugin, { filename: 'gameplay-plugin.js' });
new vm.Script(playability, { filename: 'playability-0230.js' });
new vm.Script(mobilePolish, { filename: 'mobile-polish-0231.js' });

const patchedPlugin = plugin
  .replace('  const plugin = window.WAFTAdventurePlugin = {', '  window.__WAFT_INTERNAL_GAME__ = game;\n  const plugin = window.WAFTAdventurePlugin = {')
  .replace(
    'base=worldBase(display.x,baseY+bob,display.z,a.yaw,1);switch(a.type){',
    'base=worldBase(display.x,baseY+bob,display.z,a.yaw,1);if(window.WAFTAnimalRenderer0230){return window.WAFTAnimalRenderer0230({r,a,now,mounted,api,display,surface,baseY,bob,base,drawSphere,drawCylinderPart,M});}switch(a.type){'
  )
  .replace(
    "    if (animal.type === 'shark' && !state.swimming) { showToast('La tintorera solo puede montarse en el agua'); return; }",
    "    if (animal.type === 'shark' && !api.sampleSurface(animal.x, animal.z)?.water) { showToast('La tintorera debe estar en el agua'); return; }"
  )
  .replace(
    "        && (animal.type !== 'shark' || playerState.swimming);",
    "        && (animal.type !== 'shark' || api.sampleSurface(animal.x, animal.z)?.water);"
  )
  .replace(
    "    const visible = playerState.worldMode === 'regional' && distance < 18;",
    "    const visible = playerState.worldMode === 'regional' && distance < 1.6;"
  )
  .replace(
    "    button.textContent = 'NAVEGAR A ' + REGION_NAMES[port.target].toUpperCase();",
    "    button.textContent = '⚓ ' + REGION_NAMES[port.target].toUpperCase();"
  );
assert.match(patchedPlugin, /__WAFT_INTERNAL_GAME__/);
assert.match(patchedPlugin, /WAFTAnimalRenderer0230/);
assert.match(patchedPlugin, /distance < 1\.6/);
assert.match(patchedPlugin, /api\.sampleSurface\(animal\.x, animal\.z\)\?\.water/);
assert.doesNotMatch(patchedPlugin, /tintorera solo puede montarse en el agua/i);
new vm.Script(patchedPlugin, { filename: 'gameplay-plugin-patched-0231.js' });

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
  /function drawPenguin/, /function buildAdventurePopulation/, /Lagartija balear/, /Sargantana de las Pitiusas/,
  /Conejo europeo/, /Comadreja/, /Salamandra/, /Gineta/, /Myotragus balearicus/, /Cabra mallorquina/,
  /Vaca vermella menorquina/, /Porc negre mallorquí/, /Curruca balear/, /Tintorera/, /Buitre negro/,
  /function mountAnimal/, /flightMountReady/, /flightFlap: 3\.8 \+ charge \* 6\.4/, /ALETEAR/,
  /function drawCheckpointRoute/, /function checkpointAction/, /RUTA DE EXPEDICIÓN/, /function travelToOtherRegion/,
  /waft\.adventure\.integration\.0210\.v1/
]) assert.match(plugin, pattern);
assert.doesNotMatch(plugin, /createTerrainMesh|parseTerrain|terrain\.bin/);

for (const pattern of [
  /const PROJECTIONS/, /compression: \.76/, /function regionalToGeo/, /function geoToRegional/, /function geoDistanceBearing/,
  /waftGeoHud/, /m s\.n\.m\./, /norte geográfico/, /Port d'Alcúdia/, /Port de Barcelona/,
  /waft\.adventure\.0230\.sea-arrival/, /beginSeaCrossing\('catalunya-litoral'/, /beginSeaCrossing\('baleares'/,
  /targetCount=.*68/, /targetCount=.*54/, /Fauna regional ampliada/, /WAFTAnimalRenderer0230/,
  /case'lizard'/, /case'gineta'/, /case'myotragus'/, /case'goat'/, /case'cow'/, /case'pig'/,
  /case'rabbit'/, /case'weasel'/, /case'salamander'/, /case'warbler'/, /case'vulture'/, /case'shark'/,
  /#vertical,#help\{display:none!important\}/, /waftDestinations/, /waftRun/, /waftRespawn/
]) assert.match(playability, pattern);

for (const pattern of [
  /PHONE_LANDSCAPE/, /waftMobileMenuButton/, /waft-mobile-menu-open/, /#hudStats,#nearest\{display:none!important\}/,
  /#joystick\{[^}]*width:84px!important/, /#waftJump\{[^}]*width:60px!important/,
  /#waftAdventureAction\{[^}]*right:max\(76px/, /#waftMountBadge\{display:none!important\}/,
  /installSharkRenderer/, /long pointed body/, /vertical caudal fin/, /tailSwing/, /M\.compose\(tailRot/,
  /__WAFT_MOBILE_POLISH_0231_READY__/
]) assert.match(mobilePolish, pattern);

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

console.log(`WAFT Adventure 0.23.1 validated: mobile landscape HUD compacted, contextual actions cleared from the playfield, shark mounting fixed, port prompt limited to dock range and tintorera silhouette rebuilt.`);
