import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const p='mallorca-mobile/adventure-0210/index.html';
const full=path.join(root,p);
let s=fs.readFileSync(full,'utf8');

s=s.replaceAll("window.__WAFT_ADVENTURE_BUILD__='0.26.0'","window.__WAFT_ADVENTURE_BUILD__='0.26.1'");
s=s.replaceAll("window.__WAFT_ADVENTURE_BUILD__='0.25.3'","window.__WAFT_ADVENTURE_BUILD__='0.26.1'");
if(!s.includes("const experimentalPlanet=params.get('renderer')==='0270';")){
  const rendererAnchor="    const requestedRegion=params.get('region');";
  if(!s.includes(rendererAnchor))throw new Error('WAFT 0.27.0 renderer query anchor missing');
  s=s.replace(rendererAnchor,rendererAnchor+"\n    const experimentalPlanet=params.get('renderer')==='0270';");
}

const oldSpeed="speed=bearded?(dive?(boosted?58:52):(inputLength<.06?24:(boosted||inputLength>.93?46:inputLength>.70?38:30)))";
const newSpeed="speed=bearded?(dive?(boosted?116:104):(inputLength<.06?48:(boosted||inputLength>.93?92:inputLength>.70?76:60)))";
if(s.includes(oldSpeed))s=s.replaceAll(oldSpeed,newSpeed);
else if(!s.includes(newSpeed))throw new Error('WAFT 0.26.1 vulture speed anchor missing');

const marker='      document.open();document.write(source);document.close();';
const oldBootstrap=/      \/\/ WAFT_SPHERICAL_BOOTSTRAP_0261: local tangent terrain \+ floating origin\.[\s\S]*?      }\n(?=      document\.open\(\);document\.write\(source\);document\.close\(\);)/;
const inject=`      // WAFT_SPHERICAL_BOOTSTRAP_0261: local tangent terrain + floating origin.\n      if(regionId==='iberia'){\n        window.__WAFT_SPHERICAL_WORLD_0261_ACTIVE__=true;\n        window.__WAFT_GLOBAL_ATLAS_0260_ACTIVE__=true;\n        if(experimentalPlanet)window.__WAFT_PLANET_WORLD_0270_ACTIVE__=true;\n        const worldRuntime=experimentalPlanet?'adventure-0210/planet-world-0270.js':'adventure-0210/spherical-world-0261.js';\n        const worldFlags=experimentalPlanet?'window.__WAFT_PLANET_WORLD_0270_ACTIVE__=true;window.__WAFT_SPHERICAL_WORLD_0261_ACTIVE__=true;window.__WAFT_GLOBAL_ATLAS_0260_ACTIVE__=true;':'window.__WAFT_SPHERICAL_WORLD_0261_ACTIVE__=true;window.__WAFT_GLOBAL_ATLAS_0260_ACTIVE__=true;';\n        source=source.replaceAll('adventure-0210/global-atlas-0260.js',worldRuntime);\n        source=source.replaceAll('window.__WAFT_GLOBAL_ATLAS_0260_ACTIVE__=true;',worldFlags);\n        const dynamicClamp='if(!streamedWorldSurface?.inside){';\n        const sphericalClamp='if(!window.__WAFT_SPHERICAL_WORLD_0261_ACTIVE__&&!streamedWorldSurface?.inside){';\n        if(source.includes(dynamicClamp))source=source.replaceAll(dynamicClamp,sphericalClamp);\n        else if(!source.includes(sphericalClamp))throw new Error('WAFT 0.26.1 dynamic terrain bounds clamp anchor missing');\n        if(experimentalPlanet){\n          source=source.replace("window.__WAFT_ADVENTURE_BUILD__='0.26.1'","window.__WAFT_ADVENTURE_BUILD__='0.27.0-experimental'");\n          source=source.replace("perspective(projection, Math.PI / 3, canvas.width / canvas.height, .06, state.worldMode === 'local' ? 2400 : 1450);","perspective(projection,Math.PI/3,canvas.width/canvas.height,Math.max(.12,Math.min(8,state.camera.y*.0005)),state.worldMode==='local'?2400:12000);");\n          source=source.replace("const center=[target[0],target[1]+.18+lookUpLift,target[2]];","const planetOrbitBlend=Math.max(0,Math.min(1,(state.camera.y-320)/900));const center=[target[0],(target[1]+.18+lookUpLift)*(1-planetOrbitBlend)-2102.432904*planetOrbitBlend,target[2]];");\n        }\n      }\n`;
if(oldBootstrap.test(s))s=s.replace(oldBootstrap,inject);
else if(!s.includes('WAFT_SPHERICAL_BOOTSTRAP_0261')){
  if(!s.includes(marker))throw new Error('WAFT 0.26.1 document.write anchor missing');
  s=s.replace(marker,inject+marker);
}

s=s.replaceAll('MUNDO · CONTINUO 0.26.0','MUNDO · ESFÉRICO 0.26.1');
fs.writeFileSync(full,s);

const runtimePath=path.join(root,'mallorca-mobile/adventure-0210/spherical-world-0261.js');
let r=fs.readFileSync(runtimePath,'utf8');
r=r.replace("originGeo:legacyGeo(start.x,start.z)","originGeo:{lat:legacyP.lat0,lon:legacyP.lon0}");
r=r.replace("api.releaseRegionalTerrainGpu?.();api.setRegionalPosition?.(0,0,start.y);rebuildPatch(true);","api.releaseRegionalTerrainGpu?.();rebuildPatch(true);");
r=r.replace("if(Math.abs(wrapLon(newGeo.lon-oldLon))>150)state.datelineCrossings++;if(Math.sign(oldLat)!==Math.sign(newGeo.lat)&&Math.abs(oldLat)>75&&Math.abs(newGeo.lat)>75)state.poleCrossings++;","const lonJump=Math.abs(wrapLon(newGeo.lon-oldLon));if(lonJump>90&&Math.abs(oldLat)>70&&Math.abs(newGeo.lat)>70)state.poleCrossings++;else if(lonJump>150)state.datelineCrossings++;");
const oldEstimator="function updateSpeed(now){const s=api.getState?.(),pos=s?.position;if(!pos)return;const g=geoFromLocal(pos.x,pos.z);if(state.lastGeo){const dt=Math.max(.001,(now-state.lastFrameAt)/1000),instant=haversineKm(state.lastGeo,g)*U/dt;state.speedEstimate+= (clamp(instant,0,160)-state.speedEstimate)*(1-Math.exp(-dt*3.5));}state.lastGeo=g;state.lastFrameAt=now;state.prefetchLead=clamp(state.speedEstimate*6,180,700);}";
const newEstimator="function updateSpeed(now){const s=api.getState?.(),pos=s?.position;if(!pos)return;const g=geoFromLocal(pos.x,pos.z),commanded=Math.abs(Number(s.adventureCurrentSpeed)||0);if(state.lastGeo){const dt=Math.max(.001,(now-state.lastFrameAt)/1000),instant=clamp(haversineKm(state.lastGeo,g)*U/dt,0,160),target=Math.max(commanded,instant),smoothed=state.speedEstimate+(target-state.speedEstimate)*(1-Math.exp(-dt*(target>state.speedEstimate?10:3.5)));state.speedEstimate=Math.max(commanded,smoothed);}else state.speedEstimate=Math.max(state.speedEstimate,commanded);state.lastGeo=g;state.lastFrameAt=now;state.prefetchLead=clamp(Math.max(commanded,state.speedEstimate)*6,180,700);}";
if(r.includes(oldEstimator))r=r.replace(oldEstimator,newEstimator);else if(!r.includes('commanded=Math.abs(Number(s.adventureCurrentSpeed)||0)'))throw new Error('WAFT 0.26.1 speed estimator anchor missing');
if(!r.includes('WAFT_SPHERICAL_UI_CLEAN_0261')){
  const anchor="  if(!api||!plugin||!gl)throw new Error('WAFT 0.26.1 spherical runtime unavailable');\n";
  if(!r.includes(anchor))throw new Error('WAFT 0.26.1 spherical UI cleanup anchor missing');
  const clean=`\n  // WAFT_SPHERICAL_UI_CLEAN_0261: regional navigation/UI cannot follow a floating origin around the planet.\n  const sphericalUiStyle=document.createElement('style');\n  sphericalUiStyle.id='waftSphericalUiClean0261';\n  sphericalUiStyle.textContent='#waftIberiaAtlas,#waftSpecialMarkers,#waftStreamHint,#presets,#waftWorldLabels0249,#waftFranceBadge0246,#waftRegionBadge0247,#waftProgress{display:none!important}';\n  document.head.appendChild(sphericalUiStyle);\n`;
  r=r.replace(anchor,anchor+clean);
}else{
  r=r.replace('#waftRegionBadge0247{display:none!important}', '#waftRegionBadge0247,#waftProgress{display:none!important}');
}
const objectiveText="Explora el mundo · ALETEAR para subir · PICADO ↓ para descender rápido.";
if(!r.includes(objectiveText)){
  const hudAnchor="function updateHud(){if(!state.ready)return;const title=document.getElementById('hudTitle')";
  const hudReplacement=`function updateHud(){if(!state.ready)return;const objective=document.getElementById('waftObjective');if(objective)objective.textContent='${objectiveText}';const title=document.getElementById('hudTitle')`;
  if(!r.includes(hudAnchor))throw new Error('WAFT 0.26.1 objective HUD anchor missing');
  r=r.replace(hudAnchor,hudReplacement);
}
fs.writeFileSync(runtimePath,r);

const visiblePath=path.join(root,'mallorca-mobile/adventure-0210/iberia-world-0246.js');
let v=fs.readFileSync(visiblePath,'utf8');
const oldHint="el.textContent='Explora Iberia · ALETEAR para subir · PICADO ↓ para descender rápido.';";
const newHint="el.textContent=window.__WAFT_SPHERICAL_WORLD_0261_ACTIVE__?'Explora el mundo · ALETEAR para subir · PICADO ↓ para descender rápido.':'Explora Iberia · ALETEAR para subir · PICADO ↓ para descender rápido.';";
if(v.includes(oldHint))v=v.replace(oldHint,newHint);else if(!v.includes(newHint))throw new Error('WAFT 0.26.1 Adventure hint anchor missing');
fs.writeFileSync(visiblePath,v);
console.log('WAFT 0.26.1 spherical bootstrap prepared.');
