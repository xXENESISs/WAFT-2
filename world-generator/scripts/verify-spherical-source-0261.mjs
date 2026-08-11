import fs from 'node:fs';
const runtime=fs.readFileSync('mallorca-mobile/adventure-0210/spherical-world-0261.js','utf8');
if(runtime.includes('originGeo:legacyGeo(start.x,start.z)'))throw new Error('spherical runtime still recenters at boot');
if(!runtime.includes("originGeo:{lat:legacyP.lat0,lon:legacyP.lon0}"))throw new Error('fixed tangent origin missing');
if(runtime.includes('api.setRegionalPosition?.(0,0,start.y)'))throw new Error('boot position would detach Iberia mount coordinates');
console.log('WAFT 0.26.1 source normalization verified.');
