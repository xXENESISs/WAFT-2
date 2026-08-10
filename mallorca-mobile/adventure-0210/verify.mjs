import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';

// WAFT 0.24.6 global static verification: preserve World 1/2 parity and require the visible-world corrective layer.
const here=path.dirname(new URL(import.meta.url).pathname);
const mobile=path.resolve(here,'..');
const root=path.resolve(here,'../..');
const read=name=>fs.readFileSync(path.join(here,name),'utf8');
const index=read('index.html');
const loader=read('plugin-loader.js');
const plugin=read('gameplay-plugin.js');
const playability=read('playability-0230.js');
const mobilePolish=read('mobile-polish-0231.js');
const mechanics=read('mechanics-0232.js');
const parity=read('world1-parity-0233.js');
const world244=read('iberia-world-0244.js');
const stream245=read('iberia-world-0245.js');
const visible246=read('iberia-world-0246.js');

for(const [name,source] of [
  ['plugin-loader.js',loader],['gameplay-plugin.js',plugin],['playability-0230.js',playability],
  ['mobile-polish-0231.js',mobilePolish],['mechanics-0232.js',mechanics],['world1-parity-0233.js',parity],
  ['iberia-world-0244.js',world244],['iberia-world-0245.js',stream245],['iberia-world-0246.js',visible246]
])new vm.Script(source,{filename:name});
for(const script of [...index.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(Boolean))new vm.Script(script,{filename:'adventure-index-inline.js'});

for(const pattern of [
  /WAFT Adventure 0\.23\.3/,
  /state\.yaw -= dx \* \.0053/,
  /Math\.max\(-1\.05, Math\.min\(1\.46, state\.pitch \+ dy \* \.0043\)\)/,
  /minimumDistance=Math\.min\(\.28,desiredDistance\*\.055\)/,
  /adventureBuildingGrid/,
  /ensureAdventureBuildingGrid/,
  /adventureStepSize=state\.adventureFlight\?\.72:state\.adventureWaterJump\?\.52/,
  /adventureMaxSteps=state\.adventureFlight\?10:state\.adventureWaterJump\?14:26/,
  /__WAFT_UI_SAFETY_READY__/,
  /gravity: 20\.5/,
  /adventureWaterJump/,
  /adventureSharkBreachSpeed/,
  /buildingContactAt/,
  /queueAdventureJump\(velocity,options=\{\}\)/,
  /__WAFT_ADVENTURE_BUILD__='0\.24\.6'/,
  /WAFT_IBERIA_WORLD_0244/,
  /WAFT_IBERIA_WORLD_0245/,
  /iberia-world-0246\.js/,
  /state\.iberiaDiveButton\|\|state\.joyY>\.55/,
  /state\.iberiaDiveButton\)state\.adventureFlightVy=-58/,
  /iberiaVerticalDt/,
  /'flightDive'in modifiers/,
  /releaseRegionalTerrainGpu/,
  /restoreRegionalTerrainGpu/,
  /WAFTWorldStreaming0245\?\.sampleSurface/
])assert.match(index,pattern,`index missing ${pattern}`);
assert.doesNotMatch(index,/state\.yaw \+= dx/,'camera drag was re-inverted');
assert.doesNotMatch(index,/minimumDistance = Math\.min\(1\.05, desiredDistance \* \.30\)/,'old near-camera terrain blind spot survived');

for(const pattern of [
  /world1-parity-0233\.js/,/mountType:'shark'/,/mountType:'vulture'/,/mountType:'goat'/,
  /adventureMountEject==='shark-land'/,/adventureLastWaterX/,/¡MEGA!/
])assert.match(loader,pattern,`loader missing ${pattern}`);

for(const pattern of [/__WAFT_IBERIA_WORLD_0244_READY__/,/LUGARES · PRE-GUERRA/,/nuclearWarDeaths/,/christmas-tree/,/waftCastleIcon/])assert.match(world244,pattern,`0.24.4 layer missing ${pattern}`);
for(const pattern of [
  /__WAFT_IBERIA_WORLD_0245_READY__/,
  /regions\/france\/terrain\.bin/,/regions\/france\/landcover\.bin/,
  /const LOD_MIN_LAT=42\.10;/,/const FULL_SWITCH_LAT=43\.20;/,
  /lift:stride===1\?0:-\.08/,
  /france-full/,/france-lod/,/releaseRegionalTerrainGpu/,/restoreRegionalTerrainGpu/,/streamedRegion:'france'/
])assert.match(stream245,pattern,`0.24.5 streaming layer missing ${pattern}`);
for(const pattern of [
  /__WAFT_IBERIA_WORLD_0246_READY__/,
  /PICADO ↓/,/flightDive:true/,
  /#waftSpecialMarkers\{display:none!important\}/,
  /Gibraltar','gibraltar'/,/Peñíscola','peniscola'/,/Ayódar','ayodar'/,
  /Sant Just Desvern|franceCityCount/,
  /regions\/france\/objects\.json/,
  /FRANCE 001 · MONDE CONTINU/,
  /FRANCE · \$\{franceCityCount\|\|461\} VILLES · TERRAIN CONTINU/
])assert.match(visible246,pattern,`0.24.6 visible layer missing ${pattern}`);

for(const pattern of [
  /animal\.type==='goat'\|\|animal\.type==='shark'\|\|animal\.type==='vulture'/,
  /api\.isAdventureVisible/,/visibilityCache/,/drawAnimatedGoat/,/drawAnimatedCow/,/terrainRoll/,/__WAFT_PARITY_0233_READY__/
])assert.match(parity,pattern,`parity layer missing ${pattern}`);
assert.match(mechanics,/#6d3d86/);assert.match(mechanics,/waftMegaPulse0232/);assert.match(mobilePolish,/installSharkRenderer/);assert.match(playability,/WAFTAnimalRenderer0230/);assert.match(plugin,/function mountAnimal/);assert.match(plugin,/function updateAnimals/);

for(const runtimeFile of ['region-runtime-baleares-013.html','region-runtime-catalunya-litoral-003.html']){
  const source=fs.readFileSync(path.join(mobile,runtimeFile),'utf8');
  for(const anchor of [
    'state.yaw -= dx * .0042;','gravity: 13.5,',
    'const collidesBuilding = (x, z) => collidesBuildingWithRadius(x, z, state.playerCollisionRadius);',
    'const resolveThirdPersonCamera = (target, desired) => {','const minimumDistance = Math.min(1.05, desiredDistance * .30);',
    'jump() { state.jumpQueued = true; },','drawCharacter(now, eye);'
  ])assert.ok(source.includes(anchor),`${runtimeFile} lost integration anchor: ${anchor}`);
}

const settlements=JSON.parse(fs.readFileSync(path.join(root,'regions/iberia/settlements.json'),'utf8')).items||[];
const objects=JSON.parse(fs.readFileSync(path.join(root,'regions/iberia/objects.json'),'utf8')).items||[];
const preview=JSON.parse(fs.readFileSync(path.join(root,'regions/iberia/preview/iberia-preview-v1.json'),'utf8'));
assert.ok(settlements.some(x=>x.name==='Sant Just Desvern'&&Number(x.population)>=20000),'Sant Just Desvern 20k+ missing');
assert.ok(objects.some(x=>x.name==='Sant Just Desvern'),'Sant Just Desvern physical object missing');
assert.ok(preview.counts.settlements>=368&&preview.counts.buildings>=365,`Iberia counts regressed: ${JSON.stringify(preview.counts)}`);
for(const name of ['Ayódar','Peñíscola','Gibraltar']){
  const place=settlements.find(x=>x.name===name);assert.ok(place?.specialMarker,`${name} special landmark missing`);
  assert.ok(!objects.some(x=>String(x.sourceId)===String(place.sourceId)),`${name} leaked into generic needle geometry`);
}

console.log('WAFT 0.24.6 verification passed: legacy parity, explicit low-FPS PICADO, physical Iberia landmarks, Sant Just coverage and continuous populated France are present.');