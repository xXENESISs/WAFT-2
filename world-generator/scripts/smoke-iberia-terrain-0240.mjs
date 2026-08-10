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
assert.ok(wr>=.64&&wr<=.75,`Compressed Iberia width ratio ${wr.toFixed(3)} is outside 0.30 u/km target`);
assert.ok(hr>=.61&&hr<=.78,`Compressed Iberia height ratio ${hr.toFixed(3)} is outside 0.30 u/km target`);
assert.deepEqual(iberia.countryCodes,['ES','PT','AD']);
assert.equal(iberia.geography.scale.horizontalUnitsPerKm,.3);
assert.ok(iberia.geography.bounds.east>=4.5,'Iberia east edge still clips Menorca');
assert.ok(iberia.geography.bounds.south<=35.3,'Iberia south edge still clips Melilla');
assert.deepEqual(iberia.generation.terrain.grid,{columns:560,rows:416});
const triangles=(560-1)*(416-1)*2;
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
  assert.equal(manifest.projection.unitsPerKm,.3);
  assert.equal(manifest.content.landmarks,0);
  assert.equal(manifest.content.faunaSpecies,0);
  assert.ok(manifest.terrain.maximumElevationMeters>2500,`relief peak ${manifest.terrain.maximumElevationMeters}m too low`);
  assert.equal(preview.counts.roadSegments,0);
  assert.equal(preview.counts.landmarks,0);
  const markerStage=Boolean(manifest.settlementMarkers);
  if(markerStage){
    assert.equal(manifest.settlementMarkers.minimumPopulation,20000);
    assert.ok(manifest.content.settlements>=483,`Too few Iberia/Portugal 20k+ markers: ${manifest.content.settlements}`);
    const manualExceptions=Number(manifest.settlementMarkers.manualPopulationExceptions||0);
    assert.ok(manualExceptions>=0&&manualExceptions<manifest.content.settlements,'Invalid manual special-place count');
    assert.equal(manifest.content.generatedBuildings,manifest.content.settlements-manualExceptions,'Special places must stay out of generic building geometry');
    assert.equal(preview.counts.settlements,manifest.content.settlements);
    assert.equal(preview.counts.buildings,manifest.content.generatedBuildings);
    const settlements=read('regions/iberia/settlements.json').items||[];
    const objects=read('regions/iberia/objects.json').items||[];
    assert.ok(settlements.some(item=>item.name==='Sant Just Desvern'),'Sant Just Desvern settlement parity lost');
    assert.ok(objects.some(item=>item.name==='Sant Just Desvern'),'Sant Just Desvern physical marker parity lost');
    const specials=settlements.filter(item=>item.specialMarker);
    assert.equal(specials.length,manualExceptions,'Manifest manual exception count must match special settlements');
    for(const place of specials)assert.ok(!objects.some(item=>String(item.sourceId)===String(place.sourceId)),`${place.name} leaked back into generic building geometry`);
  }else{
    assert.equal(manifest.content.settlements,0);
    assert.equal(preview.counts.buildings,0);
    assert.equal(preview.counts.settlements,0);
  }
  assert.equal(preview.terrain.verticalScale,.013594,'0.30 horizontal compression must not flatten mountain height');
  assert.ok(preview.presets.some(item=>item.id==='overview'&&item.altitude===980),'Iberia overview preset missing');
}

console.log(JSON.stringify({ok:true,widthUnits:+width(ip).toFixed(1),heightUnits:+height(ip).toFixed(1),catalunyaWidthRatio:+wr.toFixed(3),catalunyaHeightRatio:+hr.toFixed(3),triangles,unitsPerKm:.3,verticalScale:.013594},null,2));