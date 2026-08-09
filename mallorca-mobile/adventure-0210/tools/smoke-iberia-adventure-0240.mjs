import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// This smoke runs again after the deterministic generated 0.24.2 package is committed.
const here=path.dirname(new URL(import.meta.url).pathname);
const adventure=path.resolve(here,'..');
const root=path.resolve(adventure,'../..');
const names=['gameplay-plugin.js','playability-0230.js','mobile-polish-0231.js','mechanics-0232.js','world1-parity-0233.js','navigation-0234.js','multimodal-crossing-0236.js','bidirectional-crossing-0237.js','barcelona-playability-0238.js','ecology-0239.js'];
const files=new Map(names.map(name=>[name,fs.readFileSync(path.join(adventure,name),'utf8')]));
const loader=fs.readFileSync(path.join(adventure,'plugin-loader.js'),'utf8');
const index=fs.readFileSync(path.join(adventure,'index.html'),'utf8');
const explorer=fs.readFileSync(path.join(adventure,'iberia-explorer-0242.js'),'utf8');
const preview=JSON.parse(fs.readFileSync(path.join(root,'regions/iberia/preview/iberia-preview-v1.json'),'utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'regions/iberia/manifest.json'),'utf8'));

for(const pattern of [
  /requestedRegion==='iberia'/,
  /iberia:'\.\.\/region-runtime-catalunya-litoral-003\.html'/,
  /replaceAll\('catalunya-litoral','iberia'\)/,
  /registryType:'waft-local-zone-registry',regionId:'iberia',zones:\[\]/,
  /travelNodeIds = \['barcelona','tarragona','girona','subregion-montserrat','subregion-montseny','subregion-maresme'\]/,
  /travelNodeIds = \[\]/,
  /WAFT_IBERIA_RUNTIME_0241/,
  /WAFT_IBERIA_EXPLORER_0242/,
  /__WAFT_ADVENTURE_BUILD__='0\.24\.2'/,
  /iberia-explorer-0242\.js/,
  /state\.joyY>\.55/,
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
  /Península Ibérica · EXPLORACIÓN 0\.24\.2/,
  /REGION_ID === 'iberia'\) \{ game\.npc=null; game\.animals=\[\]/
])assert.match(captured[0],pattern,`Iberia gameplay patch missing ${pattern}`);
assert.match(loader,/__WAFT_IBERIA_TERRAIN_0240_READY__/);
for(const pattern of [/iberia-bearded-vulture/,/Quebrantahuesos/,/Gypaetus barbatus/,/LUGARES · 20K\+/,/__WAFT_IBERIA_EXPLORER_0242_READY__/])assert.match(explorer,pattern,`Iberia explorer missing ${pattern}`);

assert.equal(preview.regionId,'iberia');
assert.ok(preview.counts.settlements>=100);
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
assert.equal(manifest.terrain.columns,512);
assert.equal(manifest.terrain.rows,416);
assert.equal(manifest.terrain.maximumElevationMeters,3460);
assert.equal(manifest.projection.unitsPerKm,1.45);

console.log(`WAFT 0.24.2 Iberia explorer: ${preview.counts.settlements} Spanish 20k+ markers, one runtime bearded-vulture mount, no Catalunya nodes, super jump and dive hooks present.`);
