import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const write=(p,s)=>fs.writeFileSync(path.join(root,p),s);

for(const region of ['iberia','france','canarias','northwest-africa']){
  const p=`world-generator/configs/${region}.region.json`;
  const cfg=JSON.parse(read(p));
  cfg.version='0.25.0';
  cfg.geography.scale.horizontalUnitsPerKm=1.0;
  if(region==='iberia'){
    const atl=cfg.travel?.entryPoints?.find(x=>x.id==='atlantic-canarias');
    if(atl)atl.name='Atlántico oriental · Canarias';
    if(!cfg.travel.connections.some(x=>x.targetRegionId==='northwest-africa'))cfg.travel.connections.push({
      id:'iberia-africa-continuous',targetRegionId:'northwest-africa',entryPointId:'gibraltar-south',requiredCapabilities:['water'],distanceClass:'regional',enabled:true
    });
  }
  if(region==='canarias'){
    const ep=cfg.travel?.entryPoints?.find(x=>x.id==='atlantic-iberia');
    if(ep)ep.name='Atlántico oriental · África/Iberia';
    if(!cfg.travel.connections.some(x=>x.targetRegionId==='northwest-africa'))cfg.travel.connections.push({
      id:'canarias-africa-continuous',targetRegionId:'northwest-africa',entryPointId:'atlantic-iberia',requiredCapabilities:['long_water'],distanceClass:'long',enabled:true
    });
  }
  write(p,JSON.stringify(cfg,null,2)+'\n');
}

{
  const p='mallorca-mobile/adventure-0210/iberia-world-0245.js';
  let s=read(p);
  s=s.replace("const VERSION=new URL(document.currentScript?.src||location.href).searchParams.get('v')||'0.24.8';","const VERSION=new URL(document.currentScript?.src||location.href).searchParams.get('v')||'0.25.0';");
  s=s.replace('const U=1.45;','const U=Number(api.metadata?.projection?.unitsPerKm)||1.0;');
  s=s.replace('const LOD_MIN_LAT=42.10;','const LOD_MIN_LAT=43.62;');
  s=s.replace("if(manifest?.region?.id!=='france'||Number(manifest?.projection?.unitsPerKm)!==1.45)throw new Error('Manifest France incompatible con 0.24.5');","if(manifest?.region?.id!=='france'||Math.abs(Number(manifest?.projection?.unitsPerKm)-U)>.0001)throw new Error('Manifest France incompatible con la escala mundial');");
  s=s.replace("const mesh=state.mesh;state.lastVisible=Boolean(mesh?.vao&&nearFrance(geo,.55));if(!state.lastVisible)return;","const mesh=state.mesh;state.lastVisible=Boolean(mesh?.vao&&nearFrance(geo,.55)&&geo?.lat>=43.56);if(!state.lastVisible)return;");
  if(s.includes('const U=1.45;')||s.includes("unitsPerKm)!==1.45")||s.includes('const LOD_MIN_LAT=42.10;'))throw new Error('Old France scale/overlap survived');
  write(p,s);
}

{
  const p='mallorca-mobile/adventure-0210/iberia-world-0247.js';
  let s=read(p);
  s=s.replace("const sampleAtlantic=(x,z)=>{const g=geoFromWorld(x,z);if(g.lat>35.45||g.lat<27.25||g.lon<-19.6||g.lon>atlanticEastLon(g.lat))return null;return{inside:true,land:false,water:true,height:-8*VERTICAL,waterHeight:-8*VERTICAL,normal:{x:0,y:1,z:0},slopeAngle:0,streamedRegion:'atlantic-corridor',lat:g.lat,lon:g.lon};};","const sampleAtlantic=()=>null; // WAFT 0.25.0: no artificial Atlantic corridor surface");
  s=s.replace('atlanticMesh=buildAtlanticMesh();','atlanticMesh=null; // WAFT 0.25.0: no artificial Atlantic corridor geometry');
  s=s.replace('sampleCanarias(x,z)||sampleAtlantic(x,z)||previousStreamSample(x,z)','sampleCanarias(x,z)||previousStreamSample(x,z)');
  s=s.replace('const atlanticHere=Boolean(sampleAtlantic(state.position.x,state.position.z)),canariasHere=inCanarias(g);','const atlanticHere=false,canariasHere=inCanarias(g);');
  s=s.replace("const state=api.getState?.();if(!state?.position)return;const g=geoFromWorld(state.position.x,state.position.z),french=inFrance(g),can=inCanarias(g),hud=document.getElementById('hudTitle'),status=document.getElementById('waftWorldStream0245');","const state=api.getState?.();if(!state?.position)return;const g=geoFromWorld(state.position.x,state.position.z),french=inFrance(g),can=inCanarias(g),african=Boolean(window.WAFTWorld0250?.inAfrica?.(g)),hud=document.getElementById('hudTitle'),status=document.getElementById('waftWorldStream0245');");
  s=s.replace("if(can){regionBadge.hidden=false;regionBadge.textContent=`CANARIAS · ${canariasCities.length} NÚCLEOS`;if(hud)hud.textContent='CANARIAS · MUNDO CONTINUO';}","if(african){regionBadge.hidden=true;if(hud)hud.textContent='NOROESTE DE ÁFRICA · MUNDO CONTINUO 0.25.0';}\n    else if(can){regionBadge.hidden=false;regionBadge.textContent=`CANARIAS · ${canariasCities.length} NÚCLEOS`;if(hud)hud.textContent='CANARIAS · MUNDO CONTINUO';}");
  s=s.replace("const region=can?'CANARIAS':french?'FRANCE':'IBERIA';","const region=african?'AFRICA':can?'CANARIAS':french?'FRANCE':'IBERIA';");
  s=s.replace("window.WAFTWorldContinuity0247={version:'0.24.8-hotfix'","window.WAFTWorldContinuity0247={version:'0.25.0-compat'");
  if(s.includes("streamedRegion:'atlantic-corridor'"))throw new Error('Artificial Atlantic surface survived 0.25.0 preparation');
  write(p,s);
}

{
  const p='mallorca-mobile/adventure-0210/index.html';
  let s=read(p);
  s=s.replace("window.__WAFT_ADVENTURE_BUILD__='0.24.6'","window.__WAFT_ADVENTURE_BUILD__='0.25.0'");
  const needle='<script src="adventure-0210/iberia-world-0249.js?v=${encodeURIComponent(version)}"><\\/script>';
  const injection=needle+'<script src="adventure-0210/iberia-world-0250.js?v=${encodeURIComponent(version)}"><\\/script>';
  if(!s.includes('iberia-world-0250.js')){
    if(!s.includes(needle))throw new Error('0.24.9 bootstrap marker not found');
    s=s.replace(needle,injection);
  }
  write(p,s);
}

console.log('WAFT 0.25.0 prepared: 1.00 u/km world scale, France overlap delayed to physical Iberia edge, real Africa bootstrap, artificial Atlantic corridor disabled.');
