import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const json=p=>JSON.parse(read(p));
const need=(v,m)=>{if(!v)throw new Error(m);};
for(const id of ['iberia','france','canarias','northwest-africa']){
  const cfg=json(`world-generator/configs/${id}.region.json`);
  need(cfg.version==='0.25.0',`${id} config version ${cfg.version}`);
  need(Math.abs(cfg.geography.scale.horizontalUnitsPerKm-1.0)<1e-9,`${id} still uses ${cfg.geography.scale.horizontalUnitsPerKm} u/km`);
  if(fs.existsSync(`regions/${id}/manifest.json`)){
    const m=json(`regions/${id}/manifest.json`);need(Math.abs(Number(m.projection?.unitsPerKm)-1.0)<1e-9,`${id} manifest scale ${m.projection?.unitsPerKm}`);
  }
}
const f=read('mallorca-mobile/adventure-0210/iberia-world-0245.js');
const c=read('mallorca-mobile/adventure-0210/iberia-world-0247.js');
const w=read('mallorca-mobile/adventure-0210/iberia-world-0250.js');
const index=read('mallorca-mobile/adventure-0210/index.html');
need(!f.includes('const U=1.45;'),'France streamer still hardcodes 1.45');
need(!f.includes('const LOD_MIN_LAT=42.10;'),'France LOD still overlays southern-France Iberia overlap');
need(!c.includes("streamedRegion:'atlantic-corridor'"),'Artificial Atlantic corridor surface survived');
need(c.includes('atlanticMesh=null'),'Artificial Atlantic mesh not disabled');
need(index.includes('iberia-world-0250.js'),'0.25.0 runtime not bootstrapped');
for(const token of ['LABEL_RANGE_KM=1.5','NEAREST_RANGE_KM=5.0','LABEL_MAX_AGL_M=320','northwest-africa','atlantic-ocean','#waftWorldLabels0249,#waftNearest0249{display:none!important}'])need(w.includes(token),`0.25 runtime missing ${token}`);
const africa=json('world-generator/configs/northwest-africa.region.json');
need(africa.geography.bounds.north<=35.98&&africa.geography.bounds.south<=27.0,'Africa bounds no longer cover Strait-to-Sahara target');
need(africa.countryCodes.includes('MA')&&africa.countryCodes.includes('ES'),'Africa settlement countries missing Morocco/Ceuta-Melilla');
console.log(JSON.stringify({valid:true,version:'0.25.0',scale:1.0,labelRangeKm:1.5,nearestRangeKm:5,africaBounds:africa.geography.bounds,artificialAtlanticCorridor:false},null,2));
