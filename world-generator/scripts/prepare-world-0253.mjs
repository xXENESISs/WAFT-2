import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const VERSION='0.25.3';
const SCALE=.33;
const VERTICAL=.0028;
const RELIEF_META=.72;
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const write=(p,s)=>{const full=path.join(root,p);fs.mkdirSync(path.dirname(full),{recursive:true});fs.writeFileSync(full,s);};
const patch=(p,fn)=>{const before=read(p),after=fn(before);if(after!==before)write(p,after);};

const configPath='world-generator/configs/europe-atlas.region.json';
const atlas=JSON.parse(read(configPath));
if(atlas.id!=='europe-atlas')throw new Error('europe-atlas config missing');
atlas.version=VERSION;
atlas.geography.scale.horizontalUnitsPerKm=SCALE;
atlas.geography.scale.verticalExaggeration=RELIEF_META;
atlas.generation.terrain.smoothingPasses=1;
atlas.performance.budgets.visibleTriangles=Math.max(480000,Number(atlas.performance?.budgets?.visibleTriangles)||0);
write(configPath,JSON.stringify(atlas,null,2)+'\n');

patch('mallorca-mobile/adventure-0210/index.html',s=>{
  s=s.replaceAll("window.__WAFT_ADVENTURE_BUILD__='0.25.2'","window.__WAFT_ADVENTURE_BUILD__='0.25.3'");
  return s;
});

patch('mallorca-mobile/adventure-0210/iberia-world-0244.js',s=>s
  .replace("const VERSION='0.25.2';","const VERSION='0.25.3';")
  .replace('unitsPerKm:.30,verticalScale:.0024','unitsPerKm:.33,verticalScale:.0028'));
for(const p of ['iberia-world-0245.js','iberia-world-0246.js','iberia-world-0247.js','iberia-world-0249.js','iberia-world-0250.js']){
  patch('mallorca-mobile/adventure-0210/'+p,s=>s.replaceAll('0.25.2','0.25.3'));
}

patch('mallorca-mobile/adventure-0210/europe-atlas-0252.js',s=>{
  s=s.replaceAll('0.25.2','0.25.3');
  const oldScale='const U=.30,VERTICAL=.0024,WATER_METERS=-20;';
  const newScale='const U=.33,VERTICAL=.0028,WATER_METERS=-20;';
  if(s.includes(oldScale))s=s.replace(oldScale,newScale);
  else if(!s.includes(newScale))throw new Error('Europe atlas 0.25.3 scale anchor missing');

  const oldShade='float d=.72+.28*max(dot(normalize(vN),light),0.0);float fog=smoothstep(600.0,1350.0,distance(vW.xz,uEye.xz));vec3 c=vC*d;o=vec4(mix(c,vec3(.39,.555,.655),fog*.82),1.0);';
  const newShade='/*WAFT_RELIEF_0253*/float nd=max(dot(normalize(vN),light),0.0);float slope=1.0-clamp(normalize(vN).y,0.0,1.0);float elev=clamp((vW.y-.20)/7.5,0.0,1.0);float d=.50+.44*nd-.08*slope;float fog=smoothstep(650.0,1450.0,distance(vW.xz,uEye.xz));vec3 mountain=mix(vC,vec3(.47,.45,.41),elev*.52);vec3 c=mountain*d;o=vec4(mix(c,vec3(.39,.555,.655),fog*.78),1.0);';
  if(!s.includes('WAFT_RELIEF_0253')){
    if(!s.includes(oldShade))throw new Error('Europe atlas terrain shading anchor missing');
    s=s.replace(oldShade,newShade);
  }
  return s;
});

console.log(JSON.stringify({
  valid:true,
  version:VERSION,
  unitsPerKm:SCALE,
  verticalScale:VERTICAL,
  verticalExaggeration:RELIEF_META,
  smoothingPasses:1,
  triangleBudget:atlas.performance.budgets.visibleTriangles
},null,2));
