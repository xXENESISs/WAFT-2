import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createLocalProjection } from '../lib/projection.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=relative=>JSON.parse(fs.readFileSync(path.join(ROOT,relative),'utf8'));
const iberia=read('world-generator/configs/iberia.region.json');
const cat=read('world-generator/configs/catalunya-litoral.region.json');
const ip=createLocalProjection(iberia.geography),cp=createLocalProjection(cat.geography);
const width=p=>p.localBounds.maxX-p.localBounds.minX,height=p=>p.localBounds.maxZ-p.localBounds.minZ;
const wr=width(ip)/width(cp),hr=height(ip)/height(cp);
assert.ok(wr>=2.9&&wr<=3.15,`Iberia width ratio ${wr.toFixed(3)} is outside ~3x target`);
assert.ok(hr>=3.0&&hr<=3.3,`Iberia height ratio ${hr.toFixed(3)} is outside ~3x target`);
assert.deepEqual(iberia.countryCodes,['ES','PT','AD']);
assert.equal(iberia.geography.scale.horizontalUnitsPerKm,1.45);
assert.deepEqual(iberia.generation.terrain.grid,{columns:512,rows:416});
const triangles=(512-1)*(416-1)*2;
assert.ok(triangles<=iberia.performance.budgets.visibleTriangles,`${triangles} terrain triangles exceed mobile budget`);
assert.equal(iberia.generation.settlements.maxCount,0);
assert.equal(iberia.generation.buildings.maximumPerSector,0);
assert.equal(iberia.generation.landmarks.maximumCount,0);
assert.equal(iberia.generation.fauna.maximumActiveAnimals,0);

const regionDir=path.join(ROOT,'regions/iberia');
if(fs.existsSync(path.join(regionDir,'manifest.json'))){
  const manifest=read('regions/iberia/manifest.json');
  const preview=read('regions/iberia/preview/iberia-preview-v1.json');
  assert.equal(manifest.region.id,'iberia');
  assert.equal(manifest.content.settlements,0);
  assert.equal(manifest.content.landmarks,0);
  assert.equal(manifest.content.faunaSpecies,0);
  assert.ok(manifest.terrain.maximumElevationMeters>2500,`relief peak ${manifest.terrain.maximumElevationMeters}m too low`);
  assert.equal(preview.counts.buildings,0);
  assert.equal(preview.counts.roadSegments,0);
  assert.equal(preview.counts.landmarks,0);
  assert.equal(preview.counts.settlements,0);
  const expected=Number((.03*(1.45/3.2)).toFixed(6));
  assert.equal(preview.terrain.verticalScale,expected);
  assert.ok(preview.presets.some(item=>item.id==='overview'&&item.altitude===980),'Iberia overview preset missing');
}

console.log(JSON.stringify({ok:true,widthUnits:+width(ip).toFixed(1),heightUnits:+height(ip).toFixed(1),catalunyaWidthRatio:+wr.toFixed(3),catalunyaHeightRatio:+hr.toFixed(3),triangles},null,2));
