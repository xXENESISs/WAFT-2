import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createLocalProjection} from '../lib/projection.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const cfg=id=>read(`world-generator/configs/${id}.region.json`);
const tri=c=>(c.generation.terrain.grid.columns-1)*(c.generation.terrain.grid.rows-1)*2;
for(const id of ['iberia','france','canarias','northwest-africa']){
  const c=cfg(id);assert.equal(c.geography.scale.horizontalUnitsPerKm,1,`${id} scale drift`);assert.ok(tri(c)<=c.performance.budgets.visibleTriangles,`${id} terrain budget exceeded`);
  const p=createLocalProjection(c.geography);assert.ok(Number.isFinite(p.localBounds.minX)&&Number.isFinite(p.localBounds.maxZ),`${id} projection invalid`);
  const dir=path.join(ROOT,`regions/${id}`);if(fs.existsSync(path.join(dir,'manifest.json'))){
    const m=read(`regions/${id}/manifest.json`);assert.equal(m.region.id,id);assert.equal(m.projection.unitsPerKm,1,`${id} manifest scale drift`);const minPeak=id==='canarias'?1000:id==='northwest-africa'?3500:2000;assert.ok(m.terrain.maximumElevationMeters>minPeak,`${id} relief peak too low`);assert.ok(m.content.settlements>0,`${id} settlement layer missing`);
  }
}
const ib=cfg('iberia');assert.ok(ib.geography.bounds.south<=35.3,'Melilla still outside Iberia terrain');
if(fs.existsSync(path.join(ROOT,'regions/iberia/settlements.json'))){
  const names=new Set(read('regions/iberia/settlements.json').items.map(x=>x.name));for(const name of ['Ayódar','Peñíscola','Gibraltar','Ceuta','Melilla','Sant Just Desvern'])assert.ok(names.has(name),`${name} missing from Iberia atlas`);
}
if(fs.existsSync(path.join(ROOT,'regions/france/settlements.json'))){
  const names=new Set(read('regions/france/settlements.json').items.map(x=>x.name));for(const name of ['Montpellier','Nîmes','Avignon','Bayonne'])assert.ok(names.has(name),`${name} missing from France atlas`);
}
if(fs.existsSync(path.join(ROOT,'regions/canarias/settlements.json'))){
  const items=read('regions/canarias/settlements.json').items;assert.ok(items.length>=8,'Canarias 20k+ layer unexpectedly sparse');
}
if(fs.existsSync(path.join(ROOT,'regions/northwest-africa/settlements.json'))){
  const items=read('regions/northwest-africa/settlements.json').items;assert.ok(items.length>=150,`Northwest Africa 20k+ layer unexpectedly sparse: ${items.length}`);assert.ok(items.some(x=>x.countryCode==='MA'),'Morocco missing from Northwest Africa atlas');
}
console.log(JSON.stringify({ok:true,scale:1,triangles:{iberia:tri(cfg('iberia')),france:tri(cfg('france')),canarias:tri(cfg('canarias')),'northwest-africa':tri(cfg('northwest-africa'))}},null,2));
