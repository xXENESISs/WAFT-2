import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const json=p=>JSON.parse(read(p));
const need=(v,m)=>{if(!v)throw new Error(m);};
const SCALE=.30;

for(const id of ['iberia','france','canarias','northwest-africa']){
  const cfg=json(`world-generator/configs/${id}.region.json`);
  need(cfg.version==='0.25.1',`${id} version ${cfg.version}`);
  need(Math.abs(Number(cfg.geography.scale.horizontalUnitsPerKm)-SCALE)<1e-9,`${id} scale ${cfg.geography.scale.horizontalUnitsPerKm}`);
  if(fs.existsSync(`regions/${id}/manifest.json`)){
    const m=json(`regions/${id}/manifest.json`);
    need(Math.abs(Number(m.projection?.unitsPerKm)-SCALE)<1e-9,`${id} manifest scale ${m.projection?.unitsPerKm}`);
  }
  const pp=`regions/${id}/preview/${id}-preview-v1.json`;
  if(fs.existsSync(pp))need(Math.abs(Number(json(pp).terrain?.verticalScale)-.013594)<1e-9,`${id} vertical scale changed`);
}

const index=read('mallorca-mobile/adventure-0210/index.html');
const stream=read('mallorca-mobile/adventure-0210/iberia-world-0245.js');
const world=read('mallorca-mobile/adventure-0210/iberia-world-0250.js');
need(index.includes("__WAFT_ADVENTURE_BUILD__='0.25.1'"),'Adventure build is not 0.25.1');
need(stream.includes('||.30;'),'France streamer fallback is not 0.30');
need(world.includes('||.30;'),'World runtime fallback is not 0.30');
for(const token of ['LABEL_RANGE_KM=.15','NEAREST_RANGE_KM=1.0','LABEL_MAX_AGL_M=320','northwest-africa','atlantic-ocean'])need(world.includes(token),`World runtime lost ${token}`);

const settlements=json('regions/iberia/settlements.json').items||[];
const objects=json('regions/iberia/objects.json').items||[];
need(settlements.length>=483,`Iberia settlements regressed: ${settlements.length}`);
for(const name of ['Ayódar','Peñíscola','Gibraltar']){
  const place=settlements.find(x=>x.name===name);
  need(place?.specialMarker,`${name} special marker missing`);
  need(!objects.some(x=>String(x.sourceId)===String(place.sourceId)),`${name} generic spike returned`);
}
const africa=json('regions/northwest-africa/settlements.json').items||[];
need(africa.length>=150,`Africa settlements too sparse: ${africa.length}`);

console.log(JSON.stringify({valid:true,version:'0.25.1',unitsPerKm:SCALE,madridBarcelonaExpectedUnits:154.16,verticalScale:.013594,iberiaSettlements:settlements.length,africaSettlements:africa.length,labelRangeKm:.15,nearestRangeKm:1},null,2));
