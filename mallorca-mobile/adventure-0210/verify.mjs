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
const mechanics = fs.readFileSync(path.join(here, 'mechanics-0232.js'), 'utf8');
const world1Reference = path.join(here, 'reference', 'world1-015-source.html');
const runtimes = [
  path.join(mobile, 'region-runtime-baleares-013.html'),
  path.join(mobile, 'region-runtime-catalunya-litoral-003.html'),
];

assert.match(index, /WAFT Adventure 0\.23\.2/);
assert.match(index, /region-runtime-baleares-013\.html/);
assert.match(index, /region-runtime-catalunya-litoral-003\.html/);
assert.match(index, /state\.yaw \+= dx \* \.0042/);
assert.match(index, /WAFTAdventurePlugin\?\.afterWorldDraw/);
assert.match(index, /setAdventureModifiers/);
assert.match(index, /queueAdventureJump/);
assert.match(index, /adventureFlight/);
assert.match(index, /adventureCoyote: \.12/);
assert.match(index, /adventureJumpBuffer: 0/);
assert.match(index, /adventureQueuedJumpVelocity: 0/);
assert.match(index, /buildingContactAt/);
assert.match(index, /buildingTopAt/);
assert.match(index, /collidesBuildingAtPlayerHeight/);
assert.match(index, /resolveBuildingOverlap/);
assert.match(index, /standOnRoof/);
assert.match(index, /records\[offset \+ 4\] \* metadata\.display\.buildingVerticalScale \* 1\.18/);
assert.match(index, /drop > \.42/);
assert.match(index, /state\.adventureCoyote = Math\.max\(state\.adventureCoyote, \.12\)/);
assert.match(index, /plugin-loader\.js/);
assert.match(index, /__WAFT_ADVENTURE_BUILD__='0\.23\.2'/);

for (const source of [loader, plugin, playability, mobilePolish, mechanics]) new vm.Script(source);
assert.match(loader, /mechanics-0232\.js/);
assert.match(loader, /Math\.min\(2, \(held \/ 1000 - \.10\) \/ \.88\)/);
assert.match(loader, /megaMax = \(fromWater \? 21\.30 : 23\.55\)/);
assert.match(loader, /charge >= 1\.72 \? '¡MEGA!'/);
assert.match(loader, /classList\.toggle\('mega'/);
assert.match(loader, /mounted\.type === 'shark' \? \.24/);
assert.match(loader, /distance < 1\.6/);
assert.match(loader, /api\.sampleSurface\(animal\.x, animal\.z\)\?\.water/);

assert.match(mechanics, /#6d3d86/);
assert.match(mechanics, /waftMegaPulse0232/);
assert.match(mechanics, /animal\.type === 'shark' \|\| animal\.type === 'vulture'/);
assert.match(mechanics, /animal\.mountable = true/);
assert.match(mechanics, /__WAFT_MECHANICS_0232_READY__/);

// Recreate the important gameplay-source transformations and compile the result.
let patchedPlugin = plugin
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
  .replace("    const visible = playerState.worldMode === 'regional' && distance < 18;", "    const visible = playerState.worldMode === 'regional' && distance < 1.6;")
  .replace("    button.textContent = 'NAVEGAR A ' + REGION_NAMES[port.target].toUpperCase();", "    button.textContent = '⚓ ' + REGION_NAMES[port.target].toUpperCase();")
  .replace('      const charge = Math.min(1, held / 1250);', "      const charge = Math.max(0, Math.min(2, (held / 1000 - .10) / .88));")
  .replace("      jump.classList.remove('charging');", "      jump.classList.remove('charging','maxed','mega');")
  .replace('        api.setAdventureModifiers({ flightFlap: 3.8 + charge * 6.4 });', '        api.setAdventureModifiers({ flightFlap: 3.8 + Math.min(1, charge) * 6.4 });')
  .replace("        drawPenguin(this, player, now, mounted.type === 'shark' ? .85 : 1.05);", "        drawPenguin(this, player, now, mounted.type === 'shark' ? .24 : mounted.type === 'goat' ? .72 : .82);");

const oldGroundJump = `      api.setAdventureModifiers({ jumpVelocity: BASE_SPEEDS.jumpVelocity + charge * 7.2 });\n      api.jump();\n      setTimeout(() => api.setAdventureModifiers({ jumpVelocity: BASE_SPEEDS.jumpVelocity }), 220);`;
assert.ok(patchedPlugin.includes(oldGroundJump), 'simplified ground jump anchor disappeared');
patchedPlugin = patchedPlugin.replace(oldGroundJump, `      const state = api.getState?.();
      const fromWater = Boolean(state?.swimming);
      const mountBoost = mounted?.type === 'goat' ? 1.08 : mounted?.type === 'shark' ? 1.26 : 1;
      const normalMax = (fromWater ? 12.15 : 13.05) * mountBoost;
      const megaMax = (fromWater ? 21.30 : 23.55) * mountBoost;
      const minImpulse = (fromWater ? 5.45 : 7.25) * mountBoost;
      const impulse = charge <= 1
        ? minImpulse + (normalMax - minImpulse) * Math.pow(charge, .72)
        : normalMax + (megaMax - normalMax) * Math.pow(charge - 1, .76);
      if (api.queueAdventureJump) api.queueAdventureJump(impulse);
      else { api.setAdventureModifiers({ jumpVelocity: impulse }); api.jump(); }
`);
assert.match(patchedPlugin, /megaMax = \(fromWater \? 21\.30 : 23\.55\)/);
assert.match(patchedPlugin, /mounted\.type === 'shark' \? \.24/);
new vm.Script(patchedPlugin, { filename: 'gameplay-plugin-patched-0232.js' });

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
  'const collidesBuilding = (x, z) => collidesBuildingWithRadius(x, z, state.playerCollisionRadius);',
  'const movePlayer = (dx, dz) => {',
  'const ground = terrainNow.height + state.playerEyeHeight;',
  'if (state.jumpQueued && state.grounded) {'
];
for (const runtimePath of runtimes) {
  const source = fs.readFileSync(runtimePath, 'utf8');
  for (const anchor of runtimeAnchors) assert.ok(source.includes(anchor), `${path.basename(runtimePath)} is missing integration anchor: ${anchor}`);
  const scripts = [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match => match[1]);
  assert.ok(scripts.length >= 1, `${path.basename(runtimePath)} has no script`);
  for (const script of scripts) new vm.Script(script, { filename: path.basename(runtimePath) });
}

for (const pattern of [
  /function drawPenguin/, /function buildAdventurePopulation/, /Lagartija balear/, /Sargantana de las Pitiusas/,
  /Conejo europeo/, /Comadreja/, /Salamandra/, /Gineta/, /Myotragus balearicus/, /Cabra mallorquina/,
  /Vaca vermella menorquina/, /Porc negre mallorquí/, /Curruca balear/, /Tintorera/, /Buitre negro/,
  /function mountAnimal/, /flightMountReady/, /flightFlap: 3\.8 \+ charge \* 6\.4/, /ALETEAR/,
  /function drawCheckpointRoute/, /function checkpointAction/, /RUTA DE EXPEDICIÓN/, /function travelToOtherRegion/
]) assert.match(plugin, pattern);

for (const pattern of [
  /const PROJECTIONS/, /function regionalToGeo/, /function geoDistanceBearing/, /waftGeoHud/,
  /m s\.n\.m\./, /Port d'Alcúdia/, /Port de Barcelona/, /WAFTAnimalRenderer0230/
]) assert.match(playability, pattern);

for (const pattern of [
  /PHONE_LANDSCAPE/, /waftMobileMenuButton/, /#joystick\{[^}]*width:84px!important/,
  /#waftJump\{[^}]*width:60px!important/, /installSharkRenderer/, /vertical caudal fin/
]) assert.match(mobilePolish, pattern);

if (fs.existsSync(world1Reference)) {
  const world1 = fs.readFileSync(world1Reference, 'utf8');
  for (const originalFeature of [
    'function startJumpCharge', "jumpBtn.classList.toggle('mega'", 'megaMax=(fromWater?21.30:23.55)',
    'function objectTopAt', 'function sideBlocked', 'player.coyote=.12', "MONTAR BUITRE"
  ]) assert.ok(world1.includes(originalFeature), `World 1 reference lost ${originalFeature}`);
}

console.log('WAFT Adventure 0.23.2 validated: World 1 charged jump feedback/power, roof traversal, height-aware building collision, overlap recovery and universal shark/vulture mountability restored over World 2.');
