import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';

// WAFT 0.24.8 hotfix verification: preserve World 1/2 parity while forbidding the
// latitude-only France renderer and the separate floating-city UI that broke Android.
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
const continuity247=read('iberia-world-0247.js');

for(const [name,source] of [
  ['plugin-loader.js',loader],['gameplay-plugin.js',plugin],['playability-0230.js',playability],
  ['mobile-polish-0231.js',mobilePolish],['mechanics-0232.js',mechanics],['world1-parity-0233.js',parity],
  ['iberia-world-0244.js',world244],['iberia-world-0245.js',stream245],['iberia-world-0246.js',visible246],['iberia-world-0247.js',continuity247]
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
  /iberia-world-0247\.js/,
  /WAFT_WORLD_BOUNDS_0247/,
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

for(const pattern of [
  /__WAFT_IBERIA_WORLD_0244_READY__/,
  /LUGARES · PRE-GUERRA/,
  /nuclearWarDeaths/,
  /christmas-tree/,
  /waftCastleIcon/,
  /WAFT_WORLD_ATLAS_PROVIDER/,
  /item\._world\|\|item\.local/
])assert.match(world244,pattern,`shared Iberia atlas layer missing ${pattern}`);

for(const pattern of [
  /__WAFT_IBERIA_WORLD_0245_READY__/,
  /regions\/france\/terrain\.bin/,/regions\/france\/landcover\.bin/,
  /const LOD_MIN_LAT=42\.10;/,
  /const BORDER_OVERLAP=\.055;/,
  /const franceSouthLat=/,
  /const inFranceGeo=/,
  /const nearFrance=/,
  /centerLat<franceSouthLat\(centerLon\)-BORDER_OVERLAP/,
  /if\(!inFranceGeo\(geo\)/,
  /franceVisible:state\.lastVisible/,
  /deepFrance\(geo\)/,
  /france-full/,/france-lod/,/releaseRegionalTerrainGpu/,/restoreRegionalTerrainGpu/,/streamedRegion:'france'/
])assert.match(stream245,pattern,`0.24.8 geographic France streamer missing ${pattern}`);
assert.doesNotMatch(stream245,/MORPH_START_LAT|MORPH_END_LAT|franceLocalX|anchorFranceX/,'latitude-driven France projection morph survived 0.24.8');
assert.doesNotMatch(stream245,/geo\.lat>=FULL_SWITCH_LAT|geo\.lat>=REGION_SWITCH_LAT/,'latitude-only France switch survived 0.24.8');

for(const pattern of [
  /__WAFT_IBERIA_WORLD_0246_READY__/,
  /PICADO ↓/,/flightDive:true/,
  /#waftSpecialMarkers\{display:none!important\}/,
  /Gibraltar','gibraltar'/,/Peñíscola','peniscola'/,/Ayódar','ayodar'/,
  /franceCityCount/,
  /regions\/france\/objects\.json/,
  /const footprintSize=/,
  /stream\.nearFrance/,
  /stream\.inFranceGeo/
])assert.match(visible246,pattern,`0.24.8 physical France layer missing ${pattern}`);
assert.doesNotMatch(visible246,/Number\(ss\?\.geo\?\.lat\)>42\.62|Number\(s\?\.geo\?\.lat\)>42\.78/,'legacy latitude-only France city rendering survived');

for(const pattern of [
  /__WAFT_IBERIA_WORLD_0247_READY__/,
  /atlasSystem:'shared-iberia'/,
  /floatingCityLabels:false/,
  /WAFT_WORLD_ATLAS_PROVIDER/,
  /LIEUX · FRANCE/,
  /LUGARES · CANARIAS/,
  /const base='\.\.\/\.\.\/regions\/canarias\/'/,
  /streamedRegion:'canarias'/,
  /streamedRegion:'atlantic-corridor'/,
  /const atlanticHere=Boolean\(sampleAtlantic/,
  /const canariasHere=inCanarias/,
  /atlanticDrawFrames/,/canDrawFrames/
])assert.match(continuity247,pattern,`0.24.8 continuity layer missing ${pattern}`);
assert.doesNotMatch(continuity247,/const getMarker=city=>|function updateCityLabels/,'floating city label renderer survived 0.24.8');

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
const franceObjects=JSON.parse(fs.readFileSync(path.join(root,'regions/france/objects.json'),'utf8')).items||[];
const portugal=settlements.filter(x=>x.countryCode==='PT');
assert.ok(settlements.some(x=>x.name==='Sant Just Desvern'&&Number(x.population)>=20000),'Sant Just Desvern 20k+ missing');
assert.ok(objects.some(x=>x.name==='Sant Just Desvern'),'Sant Just Desvern physical object missing');
assert.ok(portugal.length>=100,`Portugal coverage regressed: ${portugal.length}`);
assert.ok(franceObjects.length>=450,`France physical marker coverage regressed: ${franceObjects.length}`);
assert.ok(preview.counts.settlements>=483&&preview.counts.buildings>=480,`Iberia/Portugal counts regressed: ${JSON.stringify(preview.counts)}`);
for(const name of ['Ayódar','Peñíscola','Gibraltar']){
  const place=settlements.find(x=>x.name===name);assert.ok(place?.specialMarker,`${name} special landmark missing`);
  assert.ok(!objects.some(x=>String(x.sourceId)===String(place.sourceId)),`${name} leaked into generic needle geometry`);
}

console.log(`WAFT 0.24.8 hotfix verification passed: legacy parity, PICADO, geographic France clipping, shared Iberia/Portugal/France/Canarias atlas, ${portugal.length} Portuguese settlements and ${franceObjects.length} French physical markers are present; floating city labels and latitude-only projection switches are absent.`);
