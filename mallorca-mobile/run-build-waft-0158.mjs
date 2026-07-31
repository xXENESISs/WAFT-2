import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const sourcePath = 'mallorca-mobile/build-waft-0158.mjs';
let source = fs.readFileSync(sourcePath, 'utf8');

function patch(search, replacement, label) {
  const next = source.replace(search, replacement);
  if (next === source) throw new Error(`Builder patch failed: ${label}`);
  source = next;
}

patch(
  "function findUrbanPoint(lon,lat,r,clearance=4,maxRadius=18){const desired=geoWorld(lon,lat),golden=Math.PI*(3-Math.sqrt(5));for(let ring=0;ring<13;ring++){const d=ring*1.15;for(let q=0;q<10;q++){const a=(q+ring*3)*golden,candidate=findBuildSiteNear(desired.x+Math.cos(a)*d,desired.z+Math.sin(a)*d,clearance,1,155,Math.max(5,maxRadius-ring*.5));if(urbanFree(candidate,r))return candidate}}const fallback=geoBuild(lon,lat,clearance,1,155,maxRadius);return fallback}",
  "function findUrbanPoint(lon,lat,r,clearance=4,maxRadius=18){const desired=geoWorld(lon,lat),golden=Math.PI*(3-Math.sqrt(5)),searchRadius=maxRadius*1.65;for(let n=0;n<520;n++){const d=n===0?0:Math.sqrt(n/519)*searchRadius,a=n*golden,x=desired.x+Math.cos(a)*d,z=desired.z+Math.sin(a)*d,h=terrainHeight(x,z),g=gridInfo(x,z);if(h===null||!g||g.v>155||coastDistance[g.i]<clearance)continue;const candidate={x,y:h,z};if(urbanFree(candidate,r))return candidate}return null}",
  'search only genuinely free urban parcels'
);

patch(
  "place(capdeperaObj,capdeperaPoint,1.12,1.12,1.12,-.18,0,{shape:'box',hx:6.10,hz:4.85,height:5.95,standable:true});\nplaceUrbanSet('house','Capdepera'",
  "place(capdeperaObj,capdeperaPoint,1.12,1.12,1.12,-.18,0,{shape:'box',hx:6.10,hz:4.85,height:5.95,standable:true});urbanSites.push({kind:'castle',name:'Castell de Capdepera',x:capdeperaPoint.x,y:capdeperaPoint.y,z:capdeperaPoint.z,r:7.15,top:capdeperaPoint.y+6.66});\nplaceUrbanSet('house','Capdepera'",
  'reserve Capdepera castle footprint'
);

patch(
  "function cameraPointBlocked(x,y,z){for(const o of colliders)if(y>o.bottom-.20&&y<o.top+.30&&shapeContains(o,x,z,.20))return true;return false}",
  "function cameraPointBlocked(x,y,z){for(const o of colliders){const broad=o.shape==='box'?(o.hx>.72&&o.hz>.62):o.r>.72;if(broad&&y>o.bottom-.20&&y<o.top+.30&&shapeContains(o,x,z,.20))return true}return false}",
  'camera blocks buildings rather than vegetation'
);

const temporary = path.resolve('mallorca-mobile/.build-waft-0158-refined.mjs');
fs.writeFileSync(temporary, source);
try {
  await import(`${pathToFileURL(temporary).href}?run=${Date.now()}`);
} finally {
  fs.rmSync(temporary, { force: true });
}
