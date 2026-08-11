import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const p='mallorca-mobile/adventure-0210/index.html';
const full=path.join(root,p);
let s=fs.readFileSync(full,'utf8');

s=s.replaceAll("window.__WAFT_ADVENTURE_BUILD__='0.26.0'","window.__WAFT_ADVENTURE_BUILD__='0.26.1'");
s=s.replaceAll("window.__WAFT_ADVENTURE_BUILD__='0.25.3'","window.__WAFT_ADVENTURE_BUILD__='0.26.1'");

const oldSpeed="speed=bearded?(dive?(boosted?58:52):(inputLength<.06?24:(boosted||inputLength>.93?46:inputLength>.70?38:30)))";
const newSpeed="speed=bearded?(dive?(boosted?116:104):(inputLength<.06?48:(boosted||inputLength>.93?92:inputLength>.70?76:60)))";
if(s.includes(oldSpeed))s=s.replaceAll(oldSpeed,newSpeed);
else if(!s.includes(newSpeed))throw new Error('WAFT 0.26.1 vulture speed anchor missing');

const marker='      document.open();document.write(source);document.close();';
const oldBootstrap=/      \/\/ WAFT_SPHERICAL_BOOTSTRAP_0261: local tangent terrain \+ floating origin\.[\s\S]*?      }\n(?=      document\.open\(\);document\.write\(source\);document\.close\(\);)/;
const inject=`      // WAFT_SPHERICAL_BOOTSTRAP_0261: local tangent terrain + floating origin.\n      if(regionId==='iberia'){\n        window.__WAFT_SPHERICAL_WORLD_0261_ACTIVE__=true;\n        window.__WAFT_GLOBAL_ATLAS_0260_ACTIVE__=true;\n        source=source.replaceAll('adventure-0210/global-atlas-0260.js','adventure-0210/spherical-world-0261.js');\n        source=source.replaceAll('window.__WAFT_GLOBAL_ATLAS_0260_ACTIVE__=true;','window.__WAFT_SPHERICAL_WORLD_0261_ACTIVE__=true;window.__WAFT_GLOBAL_ATLAS_0260_ACTIVE__=true;');\n        const dynamicClamp='if(!streamedWorldSurface?.inside){';\n        const sphericalClamp='if(!window.__WAFT_SPHERICAL_WORLD_0261_ACTIVE__&&!streamedWorldSurface?.inside){';\n        if(source.includes(dynamicClamp))source=source.replaceAll(dynamicClamp,sphericalClamp);\n        else if(!source.includes(sphericalClamp))throw new Error('WAFT 0.26.1 dynamic terrain bounds clamp anchor missing');\n      }\n`;
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
fs.writeFileSync(runtimePath,r);
console.log('WAFT 0.26.1 spherical bootstrap prepared.');
