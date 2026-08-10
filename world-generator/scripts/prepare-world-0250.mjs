import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(),read=p=>fs.readFileSync(path.join(root,p),'utf8'),write=(p,s)=>fs.writeFileSync(path.join(root,p),s);

for(const id of ['iberia','france','canarias','northwest-africa']){
  const p=`world-generator/configs/${id}.region.json`,c=JSON.parse(read(p));
  c.version='0.25.0';c.geography.scale.horizontalUnitsPerKm=1;
  for(const x of c.travel?.connections||[])x.requiredCapabilities=(x.requiredCapabilities||[]).map(v=>v==='water'?'long_water':v);
  if(id==='iberia'&&!c.travel.connections.some(x=>x.targetRegionId==='northwest-africa'))c.travel.connections.push({id:'iberia-africa-continuous',targetRegionId:'northwest-africa',entryPointId:'gibraltar-south',requiredCapabilities:['long_water'],distanceClass:'regional',enabled:true});
  if(id==='canarias'&&!c.travel.connections.some(x=>x.targetRegionId==='northwest-africa'))c.travel.connections.push({id:'canarias-africa-continuous',targetRegionId:'northwest-africa',entryPointId:'atlantic-iberia',requiredCapabilities:['long_water'],distanceClass:'long',enabled:true});
  write(p,JSON.stringify(c,null,2)+'\n');
}

{
  const p='mallorca-mobile/adventure-0210/iberia-world-0245.js';let s=read(p);
  s=s.replace("const VERSION=new URL(document.currentScript?.src||location.href).searchParams.get('v')||'0.24.8';","const VERSION=new URL(document.currentScript?.src||location.href).searchParams.get('v')||'0.25.0';")
     .replace('const U=1.45;','const U=Number(api.metadata?.projection?.unitsPerKm)||1.0;')
     .replace('const LOD_MIN_LAT=42.10;','const LOD_MIN_LAT=43.62;')
     .replace("if(manifest?.region?.id!=='france'||Number(manifest?.projection?.unitsPerKm)!==1.45)throw new Error('Manifest France incompatible con 0.24.5');","if(manifest?.region?.id!=='france'||Math.abs(Number(manifest?.projection?.unitsPerKm)-U)>.0001)throw new Error('Manifest France incompatible con la escala mundial');")
     .replace("const mesh=state.mesh;state.lastVisible=Boolean(mesh?.vao&&nearFrance(geo,.55));if(!state.lastVisible)return;","const mesh=state.mesh;state.lastVisible=Boolean(mesh?.vao&&nearFrance(geo,.55)&&geo?.lat>=43.56);if(!state.lastVisible)return;");
  if(s.includes('const U=1.45;')||s.includes('const LOD_MIN_LAT=42.10;'))throw new Error('Old France scale survived');write(p,s);
}

{
  const p='mallorca-mobile/adventure-0210/iberia-world-0247.js';let s=read(p);
  s=s.replace("const sampleAtlantic=(x,z)=>{const g=geoFromWorld(x,z);if(g.lat>35.45||g.lat<27.25||g.lon<-19.6||g.lon>atlanticEastLon(g.lat))return null;return{inside:true,land:false,water:true,height:-8*VERTICAL,waterHeight:-8*VERTICAL,normal:{x:0,y:1,z:0},slopeAngle:0,streamedRegion:'atlantic-corridor',lat:g.lat,lon:g.lon};};","const sampleAtlantic=()=>null; // WAFT 0.25.0: no artificial Atlantic corridor surface")
     .replace('atlanticMesh=buildAtlanticMesh();','atlanticMesh=null; // WAFT 0.25.0: no artificial Atlantic corridor geometry')
     .replace('sampleCanarias(x,z)||sampleAtlantic(x,z)||previousStreamSample(x,z)','sampleCanarias(x,z)||previousStreamSample(x,z)')
     .replace('const atlanticHere=Boolean(sampleAtlantic(state.position.x,state.position.z)),canariasHere=inCanarias(g);','const atlanticHere=false,canariasHere=inCanarias(g);')
     .replace("const state=api.getState?.();if(!state?.position)return;const g=geoFromWorld(state.position.x,state.position.z),french=inFrance(g),can=inCanarias(g),hud=document.getElementById('hudTitle'),status=document.getElementById('waftWorldStream0245');","const state=api.getState?.();if(!state?.position)return;const g=geoFromWorld(state.position.x,state.position.z),french=inFrance(g),can=inCanarias(g),african=Boolean(window.WAFTWorld0250?.inAfrica?.(g)),hud=document.getElementById('hudTitle'),status=document.getElementById('waftWorldStream0245');")
     .replace("const region=can?'CANARIAS':french?'FRANCE':'IBERIA';","const region=african?'AFRICA':can?'CANARIAS':french?'FRANCE':'IBERIA';")
     .replace("window.WAFTWorldContinuity0247={version:'0.24.8-hotfix'","window.WAFTWorldContinuity0247={version:'0.25.0-compat'")
     .replace("hud.textContent='PENÍNSULA IBÉRICA · EXPLORACIÓN 0.24.8'","hud.textContent='PENÍNSULA IBÉRICA · EXPLORACIÓN 0.25.0'");
  s=s.split('\n').filter(l=>!l.includes("if(african){regionBadge.hidden=true;if(hud)hud.textContent='NOROESTE DE ÁFRICA · MUNDO CONTINUO 0.25.0';}")).join('\n');
  const can="    else if(can){regionBadge.hidden=false;regionBadge.textContent=`CANARIAS · ${canariasCities.length} NÚCLEOS`;if(hud)hud.textContent='CANARIAS · MUNDO CONTINUO';}";
  const legacy=can.replace('else if','if');
  const africa="    if(african){regionBadge.hidden=true;if(hud)hud.textContent='NOROESTE DE ÁFRICA · MUNDO CONTINUO 0.25.0';}";
  if(s.includes(can))s=s.replace(can,`${africa}\n${can}`);else if(s.includes(legacy))s=s.replace(legacy,`${africa}\n${can}`);else throw new Error('Canarias HUD branch missing');
  if((s.match(/if\(african\)\{regionBadge\.hidden=true/g)||[]).length!==1)throw new Error('Africa HUD patch is not deterministic');
  if(s.includes("streamedRegion:'atlantic-corridor'"))throw new Error('Artificial Atlantic corridor survived');write(p,s.endsWith('\n')?s:s+'\n');
}

{
  const p='mallorca-mobile/adventure-0210/index.html';let s=read(p);s=s.replace("window.__WAFT_ADVENTURE_BUILD__='0.24.6'","window.__WAFT_ADVENTURE_BUILD__='0.25.0'");
  if(!s.includes('iberia-world-0250.js')){const n='<script src="adventure-0210/iberia-world-0249.js?v=${encodeURIComponent(version)}"><\\/script>';if(!s.includes(n))throw new Error('0.24.9 bootstrap missing');s=s.replace(n,n+'<script src="adventure-0210/iberia-world-0250.js?v=${encodeURIComponent(version)}"><\\/script>');}write(p,s);
}
console.log('WAFT 0.25.0 preparation is deterministic.');
