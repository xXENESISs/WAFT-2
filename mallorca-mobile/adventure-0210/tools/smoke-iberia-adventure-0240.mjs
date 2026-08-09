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
const preview=JSON.parse(fs.readFileSync(path.join(root,'regions/iberia/preview/iberia-preview-v1.json'),'utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'regions/iberia/manifest.json'),'utf8'));

for(const pattern of [
  /requestedRegion==='iberia'/,
  /iberia:'\.\.\/region-runtime-catalunya-litoral-003\.html'/,
  /replaceAll\('catalunya-litoral','iberia'\)/,
  /registryType:'waft-local-zone-registry',regionId:'iberia',zones:\[\]/,
  /__WAFT_ADVENTURE_BUILD__='0\.24\.0'/
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
assert.equal(captured.length,1,'Iberia terrain-only mode must evaluate gameplay only, not fauna/navigation layers');
new vm.Script(captured[0],{filename:'iberia-gameplay-output.js'});
for(const pattern of [
  /iberia: 'Península Ibérica'/,
  /waft\.adventure\.integration\.0240\.iberia/,
  /Prueba de escala peninsular · solo terreno y relieve/,
  /Península Ibérica · TERRENO 0\.24\.0/,
  /REGION_ID === 'iberia'\) \{ game\.npc=null; game\.animals=\[\]/
])assert.match(captured[0],pattern,`Iberia gameplay patch missing ${pattern}`);
assert.match(loader,/__WAFT_IBERIA_TERRAIN_0240_READY__/);

assert.equal(preview.regionId,'iberia');
assert.deepEqual(preview.counts,{buildings:0,hotels:0,landmarks:0,namedBuildings:0,roadSegments:0,roadVertices:0,selectedRoads:0,settlements:0});
assert.equal(preview.terrain.verticalScale,0.013594);
assert.ok(preview.presets.some(item=>item.id==='overview'&&item.altitude===980));
assert.equal(manifest.content.faunaSpecies,0);
assert.equal(manifest.content.generatedBuildings,0);
assert.equal(manifest.content.landmarks,0);
assert.equal(manifest.content.settlements,0);
assert.equal(manifest.terrain.columns,512);
assert.equal(manifest.terrain.rows,416);
assert.equal(manifest.terrain.maximumElevationMeters,3460);
assert.equal(manifest.projection.unitsPerKm,1.45);

console.log('WAFT 0.24.0 Iberia loads the real compressed terrain package with one gameplay layer and zero fauna/cities/events.');
