import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// Deterministic head verification: generated 0.24.4 package must remain current.
const here=path.dirname(new URL(import.meta.url).pathname);
const adventure=path.resolve(here,'..');
const root=path.resolve(adventure,'../..');
const names=['gameplay-plugin.js','playability-0230.js','mobile-polish-0231.js','mechanics-0232.js','world1-parity-0233.js','navigation-0234.js','multimodal-crossing-0236.js','bidirectional-crossing-0237.js','barcelona-playability-0238.js','ecology-0239.js'];
const files=new Map(names.map(name=>[name,fs.readFileSync(path.join(adventure,name),'utf8')]));
const loader=fs.readFileSync(path.join(adventure,'plugin-loader.js'),'utf8');
const index=fs.readFileSync(path.join(adventure,'index.html'),'utf8');
const explorer=fs.readFileSync(path.join(adventure,'iberia-explorer-0242.js'),'utf8');
const polish=fs.readFileSync(path.join(adventure,'iberia-polish-0243.js'),'utf8');
const world=fs.readFileSync(path.join(adventure,'iberia-world-0244.js'),'utf8');
const preview=JSON.parse(fs.readFileSync(path.join(root,'regions/iberia/preview/iberia-preview-v1.json'),'utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'regions/iberia/manifest.json'),'utf8'));
const settlements=JSON.parse(fs.readFileSync(path.join(root,'regions/iberia/settlements.json'),'utf8'));

for(const pattern of [
  /requestedRegion==='iberia'/,
  /iberia:'\.\.\/region-runtime-catalunya-litoral-003\.html'/,
  /replaceAll\('catalunya-litoral','iberia'\)/,
  /registryType:'waft-local-zone-registry',regionId:'iberia',zones:\[\]/,
  /travelNodeIds = \['barcelona','tarragona','girona','subregion-montserrat','subregion-montseny','subregion-maresme'\]/,
  /travelNodeIds = \[\]/,
  /WAFT_IBERIA_RUNTIME_0241/,
  /WAFT_IBERIA_EXPLORER_0242/,
  /WAFT_IBERIA_POLISH_0243/,
  /WAFT_IBERIA_WORLD_0244/,
  /__WAFT_ADVENTURE_BUILD__='0\.24\.4'/,
  /iberia-explorer-0242\.js/,
  /iberia-polish-0243\.js/,
  /iberia-world-0244\.js/,
  /state\.joyY>\.55/,
  /targetDiveVy=-\(30\+28\*diveAmount\)/,
  /Math\.max\(24\.0,state\.adventureFlightFlap\*2\.05\)/,
  /state\.iberiaFlapMomentum=\.58/,
  /else state\.adventureFlightVy=0/,
  /if\(window\.__WAFT_ADVENTURE_REGION__!=='iberia'\)state\.respawnQueued = true/
])assert.match(index,pattern,`Iberia index bootstrap missing ${pattern}`);

const captured=[],errors=[];
const context={
  console:{...console,error:(...args)=>errors.push(args.map(value=>String(value)).join(' '))},
  URL,Promise,setTimeout,clearTimeout,innerWidth:700,
  __WAFT_ADVENTURE_REGION__:'iberia',
  document:{currentScript:{src:'https://example.test/plugin-loader.js?v=ci'},getElementById(){return null;}},
  fetch:async url=>{const name=new URL(String(url)).pathname.split('/').pop(),body=files.get(name);return{ok:body!==undefined,status:body!==undefined?200:404,text:async()=>body??''};},
  eval:source=>captured.push(String(source))
};
context.window=context;context.globalThis=context;vm.createContext(context);
new vm.Script(loader,{filename:'plugin-loader.js'}).runInContext(context);
for(let i=0;i<120&&captured.length<1&&!errors.length;i++)await new Promise(resolve=>setTimeout(resolve,5));
await new Promise(resolve=>setTimeout(resolve,20));
assert.deepEqual(errors,[],'Iberia loader errors');
assert.equal(captured.length,1,'Iberia terrain/explorer mode must evaluate gameplay only, not Catalunya fauna/navigation layers');
new vm.Script(captured[0],{filename:'iberia-gameplay-output.js'});
for(const pattern of [
  /iberia: 'Península Ibérica'/,
  /waft\.adventure\.integration\.0240\.iberia/,
  /Explora Iberia · mantén el joystick abajo en vuelo para entrar en picado/,
  /Península Ibérica · EXPLORACIÓN 0\.24\.4/,
  /REGION_ID === 'iberia'\) \{ game\.npc=null; game\.animals=\[\]/
])assert.match(captured[0],pattern,`Iberia gameplay patch missing ${pattern}`);
assert.match(loader,/__WAFT_IBERIA_TERRAIN_0240_READY__/);
for(const pattern of [/iberia-bearded-vulture/,/Quebrantahuesos/,/Gypaetus barbatus/,/LUGARES · 20K\+/,/__WAFT_IBERIA_EXPLORER_0242_READY__/])assert.match(explorer,pattern,`Iberia explorer missing ${pattern}`);
for(const pattern of [/__WAFT_IBERIA_POLISH_0243_READY__/,/#help,#waftFlightTelemetry/,/ALT — · LAT — · LON —/,/flightMountReady=true/,/requestAnimationFrame\(followBird\)/])assert.match(polish,pattern,`Iberia polish missing ${pattern}`);
for(const pattern of [/__WAFT_IBERIA_WORLD_0244_READY__/,/LUGARES · PRE-GUERRA/,/nuclearWarDeaths/,/christmas-tree/,/waftCastleIcon/,/flightFlap:12/,/regions\/france\/manifest\.json/])assert.match(world,pattern,`Iberia world layer missing ${pattern}`);

assert.equal(preview.regionId,'iberia');
assert.ok(preview.counts.settlements>=365);
assert.equal(preview.counts.buildings,preview.counts.settlements);
assert.equal(preview.counts.namedBuildings,preview.counts.settlements);
assert.equal(preview.counts.hotels,0);
assert.equal(preview.counts.landmarks,0);
assert.equal(preview.counts.roadSegments,0);
assert.equal(preview.terrain.verticalScale,0.013594);
assert.ok(preview.presets.some(item=>item.id==='overview'&&item.altitude===980));
assert.equal(manifest.content.faunaSpecies,0);
assert.equal(manifest.content.generatedBuildings,manifest.content.settlements);
assert.equal(manifest.content.landmarks,0);
assert.equal(manifest.content.settlements,preview.counts.settlements);
assert.equal(manifest.settlementMarkers.minimumPopulation,20000);
assert.equal(manifest.terrain.columns,560);
assert.equal(manifest.terrain.rows,416);
assert.ok(manifest.terrain.maximumElevationMeters>=3400);
assert.equal(manifest.projection.unitsPerKm,1.45);
assert.ok(manifest.projection.localBounds.maxX>900,'Expanded east edge must include Menorca without shrinking Iberia scale');
const byName=new Map(settlements.items.map(item=>[item.name,item]));
for(const name of ['Ayódar','Peñíscola','Gibraltar','Ceuta','Melilla'])assert.ok(byName.has(name),`${name} missing from Iberia 0.24.4 atlas`);
assert.equal(byName.get('Ayódar').specialMarker,'christmas-tree');
assert.equal(byName.get('Peñíscola').specialMarker,'castle');
for(const name of ['Ayódar','Peñíscola','Gibraltar','Ceuta','Melilla'])assert.equal(byName.get(name).warImpact?.fictional,true,`${name} war lore must remain explicitly fictional`);

console.log(`WAFT 0.24.4 Iberia world: ${preview.counts.settlements} regional/special markers, Menorca + Gibraltar/Ceuta/Melilla, stronger bearded-vulture climb and streaming foundation present.`);
