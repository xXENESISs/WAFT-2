import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const here=path.dirname(new URL(import.meta.url).pathname);
const adventure=path.resolve(here,'..');
const root=path.resolve(adventure,'../..');
const names=['gameplay-plugin.js','playability-0230.js','mobile-polish-0231.js','mechanics-0232.js','world1-parity-0233.js','navigation-0234.js','multimodal-crossing-0236.js','bidirectional-crossing-0237.js','barcelona-playability-0238.js','ecology-0239.js'];
const files=new Map(names.map(name=>[name,fs.readFileSync(path.join(adventure,name),'utf8')]));
const loader=fs.readFileSync(path.join(adventure,'plugin-loader.js'),'utf8');
const index=fs.readFileSync(path.join(adventure,'index.html'),'utf8');
const explorer=fs.readFileSync(path.join(adventure,'iberia-explorer-0242.js'),'utf8');
const polish=fs.readFileSync(path.join(adventure,'iberia-polish-0243.js'),'utf8');
const world244=fs.readFileSync(path.join(adventure,'iberia-world-0244.js'),'utf8');
const stream245=fs.readFileSync(path.join(adventure,'iberia-world-0245.js'),'utf8');
const visible246=fs.readFileSync(path.join(adventure,'iberia-world-0246.js'),'utf8');
const continuity247=fs.readFileSync(path.join(adventure,'iberia-world-0247.js'),'utf8');
const world250=fs.readFileSync(path.join(adventure,'iberia-world-0250.js'),'utf8');
const atlas252=fs.readFileSync(path.join(adventure,'europe-atlas-0252.js'),'utf8');
const global260=fs.readFileSync(path.join(adventure,'global-atlas-0260.js'),'utf8');
const preview=JSON.parse(fs.readFileSync(path.join(root,'regions/iberia/preview/iberia-preview-v1.json'),'utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'regions/iberia/manifest.json'),'utf8'));
const settlements=JSON.parse(fs.readFileSync(path.join(root,'regions/iberia/settlements.json'),'utf8'));
const objects=JSON.parse(fs.readFileSync(path.join(root,'regions/iberia/objects.json'),'utf8'));
const globalManifest=JSON.parse(fs.readFileSync(path.join(root,'regions/global-atlas/manifest.json'),'utf8'));

for(const pattern of [
  /requestedRegion==='iberia'/,/iberia:'\.\.\/region-runtime-catalunya-litoral-003\.html'/,/replaceAll\('catalunya-litoral','iberia'\)/,
  /WAFT_IBERIA_RUNTIME_0241/,/WAFT_IBERIA_EXPLORER_0242/,/WAFT_IBERIA_POLISH_0243/,/WAFT_IBERIA_WORLD_0244/,/WAFT_IBERIA_WORLD_0245/,
  /__WAFT_ADVENTURE_BUILD__='0\.26\.0'/,/global-atlas-0260\.js/,/__WAFT_GLOBAL_ATLAS_0260_ACTIVE__/,/europe-atlas-0252\.js/,/WAFT_ATLAS_CORE_SUPPRESSION_0252/,/WAFT_GLOBAL_POSITION_API_0260/,/setRegionalPosition\(x,z,y=null\)/,/iberia-world-0246\.js/,/iberia-world-0247\.js/,/iberia-world-0250\.js/,/WAFT_WORLD_BOUNDS_0247/,
  /state\.iberiaDiveButton\|\|state\.joyY>\.55/,/state\.iberiaDiveButton\)state\.adventureFlightVy=-58/,/iberiaVerticalDt/,
  /'flightDive'in modifiers/,/releaseRegionalTerrainGpu/,/restoreRegionalTerrainGpu/
])assert.match(index,pattern,`Iberia/bootstrap contract missing ${pattern}`);

const captured=[],errors=[];
const context={console:{...console,error:(...args)=>errors.push(args.map(String).join(' '))},URL,Promise,setTimeout,clearTimeout,innerWidth:700,__WAFT_ADVENTURE_REGION__:'iberia',document:{currentScript:{src:'https://example.test/plugin-loader.js?v=ci'},getElementById(){return null;}},fetch:async url=>{const name=new URL(String(url)).pathname.split('/').pop(),body=files.get(name);return{ok:body!==undefined,status:body!==undefined?200:404,text:async()=>body??''};},eval:source=>captured.push(String(source))};
context.window=context;context.globalThis=context;vm.createContext(context);
new vm.Script(loader,{filename:'plugin-loader.js'}).runInContext(context);
for(let i=0;i<120&&captured.length<1&&!errors.length;i++)await new Promise(resolve=>setTimeout(resolve,5));
await new Promise(resolve=>setTimeout(resolve,20));
assert.deepEqual(errors,[],'Iberia loader errors');
assert.equal(captured.length,1,'Iberia terrain/explorer mode must evaluate gameplay only');
new vm.Script(captured[0],{filename:'iberia-gameplay-output.js'});
for(const pattern of [/iberia: 'Península Ibérica'/,/waft\.adventure\.integration\.0240\.iberia/,/REGION_ID === 'iberia'\) \{ game\.npc=null; game\.animals=\[\]/])assert.match(captured[0],pattern,`Iberia gameplay patch missing ${pattern}`);

assert.match(loader,/__WAFT_IBERIA_TERRAIN_0240_READY__/);
for(const pattern of [/iberia-bearded-vulture/,/Quebrantahuesos/,/Gypaetus barbatus/,/LUGARES · 20K\+/,/__WAFT_IBERIA_EXPLORER_0242_READY__/])assert.match(explorer,pattern,`Iberia explorer missing ${pattern}`);
for(const pattern of [/__WAFT_IBERIA_POLISH_0243_READY__/,/ALT — · LAT — · LON —/,/flightMountReady=true/])assert.match(polish,pattern,`Iberia polish missing ${pattern}`);
for(const pattern of [/__WAFT_IBERIA_WORLD_0244_READY__/,/LUGARES · PRE-GUERRA/,/nuclearWarDeaths/,/christmas-tree/,/waftCastleIcon/,/WAFT_WORLD_ATLAS_PROVIDER/])assert.match(world244,pattern,`shared Iberia atlas missing ${pattern}`);
for(const pattern of [
  /__WAFT_IBERIA_WORLD_0245_READY__/,
  /const LOD_MIN_LAT=43\.62;/,
  /const BORDER_OVERLAP=\.055;/,
  /franceSouthLat/,
  /inFranceGeo/,
  /nearFrance/,
  /franceVisible/,
  /france-full/,
  /france-lod/,
  /streamedRegion:'france'/,
  /iberiaGpuReleased/,
  /__WAFT_EUROPE_ATLAS_0252_ACTIVE__/
])assert.match(stream245,pattern,`legacy geographic layer contract missing ${pattern}`);
assert.doesNotMatch(stream245,/const U=1\.45;|FULL_SWITCH_LAT|REGION_SWITCH_LAT|MORPH_START_LAT|franceLocalX/,'obsolete France scale/transition survived');
for(const pattern of [/__WAFT_IBERIA_WORLD_0246_READY__/,/PICADO ↓/,/#waftSpecialMarkers\{display:none!important\}/,/regions\/france\/objects\.json/,/franceCityCount/,/footprintSize/,/stream\.nearFrance/,/stream\.inFranceGeo/])assert.match(visible246,pattern,`visible layer missing ${pattern}`);
for(const pattern of [/__WAFT_IBERIA_WORLD_0247_READY__/,/atlasSystem:'shared-iberia'/,/floatingCityLabels:false/,/WAFT_WORLD_ATLAS_PROVIDER/,/streamedRegion:'canarias'/,/atlanticMesh=null/,/__WAFT_EUROPE_ATLAS_0252_ACTIVE__/])assert.match(continuity247,pattern,`continuity compatibility layer missing ${pattern}`);
assert.doesNotMatch(continuity247,/streamedRegion:'atlantic-corridor'|const getMarker=city=>|function updateCityLabels/,'obsolete corridor/floating city renderer survived');
for(const pattern of [/__WAFT_IBERIA_WORLD_0250_READY__/,/LABEL_RANGE_KM=\.15/,/NEAREST_RANGE_KM=1\.0/,/LABEL_MAX_AGL_M=320/,/northwest-africa/,/streamedRegion:'atlantic-ocean'/,/waftWorldLabels0250/,/#waftWorldLabels0249,#waftNearest0249\{display:none!important\}/,/__WAFT_EUROPE_ATLAS_0252_ACTIVE__/])assert.match(world250,pattern,`legacy real-world layer contract missing ${pattern}`);
for(const pattern of [/europe-atlas-single-surface/,/inFranceGeo:\(\)=>false/,/VERTICAL=\.0028/,/B=\{west:-26,east:60,south:26,north:72\.5\}/,/WAFT_WORLD_ATLAS_PROVIDER/,/releaseRegionalTerrainGpu/,/WAFT_RELIEF_0253/])assert.match(atlas252,pattern,`Europe detail atlas missing ${pattern}`);
for(const pattern of [/global-atlas-single-surface/,/VERTICAL=\.0028/,/B=\{west:-180,east:180,south:-90,north:90\}/,/WORLD_WIDTH/,/wrapLon/,/state\.wraps\+\+/,/regions\/global-atlas/,/regions\/europe-atlas/,/window\.WAFTEuropeAtlas0252=window\.WAFTGlobalAtlas0260/])assert.match(global260,pattern,`0.26.0 global atlas missing ${pattern}`);

assert.equal(preview.regionId,'iberia');
assert.ok(preview.counts.settlements>=483,`Expected >=483 settlements, got ${preview.counts.settlements}`);
assert.ok(preview.counts.buildings>=480,`Expected >=480 physical generic markers, got ${preview.counts.buildings}`);
assert.equal(preview.counts.namedBuildings,preview.counts.buildings);
assert.equal(preview.counts.hotels,0);assert.equal(preview.counts.landmarks,0);assert.equal(preview.counts.roadSegments,0);
assert.equal(preview.terrain.verticalScale,0.013594);
assert.ok(preview.presets.some(item=>item.id==='overview'&&item.altitude===980));
assert.equal(manifest.content.faunaSpecies,0);assert.equal(manifest.content.landmarks,0);
assert.equal(manifest.settlementMarkers.minimumPopulation,20000);
assert.equal(manifest.terrain.columns,560);assert.equal(manifest.terrain.rows,416);assert.ok(manifest.terrain.maximumElevationMeters>=3400);assert.equal(manifest.projection.unitsPerKm,.3);
assert.equal(globalManifest.region.id,'global-atlas');assert.equal(globalManifest.terrain.columns,690);assert.equal(globalManifest.terrain.rows,345);assert.equal(globalManifest.projection.unitsPerKm,.33);
const byName=new Map(settlements.items.map(item=>[item.name,item]));
for(const name of ['Ayódar','Peñíscola','Gibraltar','Ceuta','Melilla','Sant Just Desvern'])assert.ok(byName.has(name),`${name} missing from Iberia atlas`);
assert.ok(Number(byName.get('Sant Just Desvern').population)>=20000,'Sant Just population regressed');
assert.ok(objects.items.some(x=>x.name==='Sant Just Desvern'),'Sant Just physical object missing');
assert.ok(settlements.items.filter(x=>x.countryCode==='PT').length>=100,'Portugal coverage regressed');
for(const name of ['Ayódar','Peñíscola','Gibraltar']){const place=byName.get(name);assert.ok(place?.specialMarker,`${name} must remain special`);assert.ok(!objects.items.some(item=>String(item.sourceId)===String(place.sourceId)),`${name} must not become a generic needle again`);}

console.log(`WAFT 0.26.0 preserves the proven Iberia mechanics and Europe detail while the Global Atlas owns one continuous planetary surface with Pacific wrap.`);
