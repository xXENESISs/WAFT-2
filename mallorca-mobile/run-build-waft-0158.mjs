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
