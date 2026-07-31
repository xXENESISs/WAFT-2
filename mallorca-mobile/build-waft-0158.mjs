import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const input = 'mallorca-mobile/waft-0157.html';
const output = 'mallorca-mobile/waft-0158.html';
let html = fs.readFileSync(input, 'utf8');

function replaceOnce(search, replacement, label) {
  const next = html.replace(search, replacement);
  if (next === html) throw new Error(`Replacement failed: ${label}`);
  html = next;
}

replaceOnce('<title>WAFT Adventure 0.15.7 · Geografía de Llevant</title>', '<title>WAFT Adventure 0.15.8 · Mallorca poblada</title>', 'title');
replaceOnce('WAFT ADVENTURE 0.15.7 · GEOGRAFÍA DE LLEVANT', 'WAFT ADVENTURE 0.15.8 · MALLORCA POBLADA', 'HUD title');
replaceOnce('// WAFT 0.15.6: corrected climbable buildings, expanded landmarks and natural animal motion.', '// WAFT 0.15.8: deterministic urban network, solid buildings, flight and camera collision.', 'build comment');

replaceOnce(
  'hotelObj,monasteryObj,lighthouseObj',
  'hotelObj,capdeperaObj,monasteryObj,lighthouseObj',
  'Capdepera asset declaration'
);

replaceOnce(
  'function pigBodyMesh(){',
  `function capdeperaCastleMesh(){const b=makeBuilder(),stone=[.58,.54,.45],stone2=[.70,.65,.54],roof=[.43,.23,.14],white=[.78,.74,.65],dark=[.15,.14,.12];
 addBox(b,0,.24,0,11.4,.48,8.8,stone);addBox(b,0,1.34,-4.05,11.4,2.20,.58,stone2);addBox(b,0,1.34,4.05,11.4,2.20,.58,stone2);addBox(b,-5.42,1.34,0,.58,2.20,8.1,stone2);addBox(b,5.42,1.34,0,.58,2.20,8.1,stone2);
 for(const [x,z] of[[-5.35,-4],[5.35,-4],[-5.35,4],[5.35,4]]){addCylinder(b,x,2.05,z,1.05,4.10,stone,14);addCylinder(b,x,4.22,z,1.14,.28,stone2,14);for(let i=0;i<8;i++){const a=i*Math.PI/4;addBox(b,x+Math.sin(a)*.91,4.62,z+Math.cos(a)*.91,.34,.52,.38,stone2)}}
 addBox(b,-1.95,2.65,-.55,2.25,5.30,2.15,stone);addBox(b,-1.95,5.48,-.55,2.52,.38,2.42,roof);addBox(b,2.15,1.78,-1.45,3.05,3.56,2.35,white);addBox(b,2.15,3.73,-1.45,3.32,.34,2.62,roof);
 for(const [x,z,s] of[[-2.8,2.15,.82],[-.55,2.35,.72],[1.35,2.25,.78],[3.45,1.78,.64]]){addBox(b,x,1.15,z,1.75*s,2.30*s,1.52*s,white);addBox(b,x,2.42*s,z,1.92*s,.28,1.68*s,roof)}
 addBox(b,0,.95,4.13,1.22,1.90,.28,dark);return finishMesh(b)}
function pigBodyMesh(){`,
  'Capdepera castle mesh'
);

replaceOnce(
  'hotelObj=hotelMesh();monasteryObj=monasteryMesh();',
  'hotelObj=hotelMesh();capdeperaObj=capdeperaCastleMesh();monasteryObj=monasteryMesh();',
  'Capdepera asset creation'
);

replaceOnce(
  /const cathedralGeo=geoExact\(2\.64843,39\.56734\),bellverGeo=geoExact\(2\.61942,39\.56378\),palmaMonumentSpacing=1\.48;\nconst cathedralPoint=cathedralGeo,bellverPoint=[\s\S]*?calaMillorHotelPoint=point\(calaMillorPoint\.x-1\.15,calaMillorPoint\.z\+\.45\)\|\|calaMillorPoint;/,
  `const cathedralGeo=geoExact(2.64843,39.56734),bellverGeo=geoExact(2.61942,39.56378),palmaMonumentSpacing=3.50;
const cathedralPoint=cathedralGeo,bellverPoint=point(cathedralGeo.x+(bellverGeo.x-cathedralGeo.x)*palmaMonumentSpacing,cathedralGeo.z+(bellverGeo.z-cathedralGeo.z)*palmaMonumentSpacing)||bellverGeo,
 drachPoint=geoBuild(3.33054,39.53588,5,1,125,18),portoCristoPoint=geoBuild(3.33639,39.54167,5,1,125,18),llucPoint=geoExact(2.885,39.822),formentorPoint=geoExact(3.200,39.955),salinesPoint=geoExact(3.053,39.266),alcudiaPoint=geoBuild(3.12045,39.85325,5,1,125,20),portAlcudiaPoint=geoBuild(3.13291,39.84182,5,1,105,20),
 manacorPoint=geoBuild(3.21069,39.56866,6,1,135,18),pinarManacorPoint=geoExact(3.176,39.593),saComaPoint=geoBuild(3.37588,39.57578,5,1,110,18),puntaAmerPoint=geoBuild(3.39600,39.57998,6,1,125,20),calaMillorPoint=geoBuild(3.38611,39.60528,5,1,105,18),calaBonaPoint=geoBuild(3.39028,39.61278,5,1,105,18),
 capdeperaPoint=geoBuild(3.43319,39.70444,5,8,220,24),calaRajadaPoint=geoBuild(3.46194,39.71139,5,1,125,20),capdeperaLighthousePoint=geoBuild(3.47775,39.71547,4,1,180,22);`,
  'expanded geographic anchors'
);

replaceOnce(
  "place(caveObj,drachPoint,.92,.92,.92,2.55,0,{shape:'circle',r:2.92,height:3.72,standable:true});place(monasteryObj,llucPoint,.82,.82,.82,-.35,0,{shape:'box',hx:3.0,hz:2.2,height:4.8,standable:true});place(lighthouseObj,formentorPoint,.78,.78,.78,.15,0,{shape:'circle',r:.65,height:4.0,standable:true});place(lighthouseObj,salinesPoint,.70,.70,.70,-.35,0,{shape:'circle',r:.62,height:3.6,standable:true});",
  "place(caveObj,drachPoint,.92,.92,.92,2.55,0,{shape:'circle',r:2.92,height:3.72,standable:true});place(monasteryObj,llucPoint,.82,.82,.82,-.35,0,{shape:'box',hx:3.0,hz:2.2,height:4.8,standable:true});place(lighthouseObj,formentorPoint,.78,.78,.78,.15,0,{shape:'circle',r:.65,height:4.0,standable:true});place(lighthouseObj,salinesPoint,.70,.70,.70,-.35,0,{shape:'circle',r:.62,height:3.6,standable:true});place(lighthouseObj,capdeperaLighthousePoint,.68,.68,.68,.35,0,{shape:'circle',r:.58,height:5.0,standable:true});",
  'Capdepera lighthouse placement'
);

replaceOnce(
  /const hotelYaw=-\.12,hotelSX=\.82,hotelSY=\.86;[\s\S]*?placeGeoTown\(calaMillorPoint,5,15704,3\.4,7\.0,\.62,\.82,\[\{p:puntaAmerPoint,r:7\.0\},\{p:calaMillorHotelPoint,r:4\.2\}\]\);/,
  `const urbanSites=[];
function urbanFree(p,r){return p&&urbanSites.every(s=>Math.hypot(p.x-s.x,p.z-s.z)>r+s.r+1.15)}
function findUrbanPoint(lon,lat,r,clearance=4,maxRadius=18){const desired=geoWorld(lon,lat),golden=Math.PI*(3-Math.sqrt(5));for(let ring=0;ring<13;ring++){const d=ring*1.15;for(let q=0;q<10;q++){const a=(q+ring*3)*golden,candidate=findBuildSiteNear(desired.x+Math.cos(a)*d,desired.z+Math.sin(a)*d,clearance,1,155,Math.max(5,maxRadius-ring*.5));if(urbanFree(candidate,r))return candidate}}const fallback=geoBuild(lon,lat,clearance,1,155,maxRadius);return fallback}
function placeUrban(kind,name,lon,lat,scale=.68,yaw=0){const hotel=kind==='hotel',r=hotel?4.45*scale:1.72*scale,p=findUrbanPoint(lon,lat,r,hotel?5:4,hotel?22:16);if(!p)return null;if(hotel)place(hotelObj,p,scale,scale*.96,scale,yaw,0,{shape:'box',hx:4.30*scale,hz:1.98*scale,height:7.92,standable:true});else{const sy=scale*1.18;place(houseObj,p,scale,sy,scale,yaw,0,{shape:'box',hx:1.50*scale,hz:1.28*scale,height:4.70,standable:true})}urbanSites.push({kind,name,x:p.x,y:p.y,z:p.z,r,top:p.y+(hotel?7.92*scale*.96:4.70*scale*1.18)});return p}
function placeUrbanSet(kind,prefix,specs){specs.forEach((s,i)=>placeUrban(kind,prefix+' '+(i+1),...s))}

placeUrbanSet('hotel','Palma',[[2.6710,39.5690,.62,-.12],[2.6850,39.5735,.66,.06],[2.6990,39.5770,.61,.12],[2.7130,39.5805,.58,-.04]]);
placeUrbanSet('house','Palma interior',[[2.6810,39.5900,.70,.18],[2.7040,39.5960,.68,-.20],[2.7260,39.5880,.66,.08]]);
placeUrbanSet('house','Alcúdia vila',[[3.1070,39.8500,.68,.10],[3.1170,39.8560,.66,-.16],[3.1280,39.8530,.70,.05],[3.1160,39.8630,.63,.22],[3.1340,39.8610,.65,-.08]]);
placeUrbanSet('hotel','Port d Alcúdia',[[3.1160,39.8375,.64,.06],[3.1270,39.8395,.69,.02],[3.1380,39.8420,.72,-.04],[3.1490,39.8440,.68,-.10],[3.1600,39.8460,.63,-.14],[3.1710,39.8480,.58,-.18]]);
placeUrbanSet('house','Manacor',[[3.1850,39.5590,.66,.08],[3.1940,39.5760,.70,-.12],[3.2050,39.5850,.64,.16],[3.2180,39.5830,.68,-.04],[3.2280,39.5740,.72,.10],[3.2220,39.5580,.65,-.18],[3.2010,39.5510,.67,.02]]);
placeUrbanSet('house','Porto Cristo',[[3.3190,39.5430,.62,.04],[3.3270,39.5510,.66,-.14],[3.3400,39.5530,.64,.12]]);
placeUrbanSet('hotel','Porto Cristo',[[3.3470,39.5450,.60,-.08],[3.3540,39.5520,.56,-.12]]);
placeUrbanSet('hotel','Sa Coma',[[3.3540,39.5680,.60,.08],[3.3650,39.5720,.65,.02],[3.3760,39.5780,.68,-.04],[3.3860,39.5840,.60,-.10]]);
placeUrbanSet('hotel','Cala Millor',[[3.3660,39.5920,.62,.08],[3.3750,39.5980,.68,.04],[3.3840,39.6040,.73,0],[3.3930,39.6090,.70,-.05],[3.4020,39.6140,.65,-.10],[3.4100,39.6190,.58,-.14]]);
placeUrbanSet('hotel','Cala Bona',[[3.3790,39.6195,.60,.06],[3.3890,39.6250,.66,0],[3.3990,39.6300,.62,-.06],[3.4080,39.6350,.56,-.12]]);
place(capdeperaObj,capdeperaPoint,1.12,1.12,1.12,-.18,0,{shape:'box',hx:6.10,hz:4.85,height:5.95,standable:true});
placeUrbanSet('house','Capdepera',[[3.4100,39.6940,.62,.12],[3.4200,39.7000,.66,-.08],[3.4300,39.7110,.61,.18],[3.4400,39.7140,.64,-.16],[3.4470,39.7030,.67,.04],[3.4180,39.7160,.59,-.02]]);
placeUrbanSet('hotel','Cala Rajada',[[3.4430,39.7010,.58,.08],[3.4530,39.7070,.64,.03],[3.4630,39.7130,.69,-.03],[3.4730,39.7190,.64,-.08],[3.4820,39.7250,.57,-.13]]);`,
  'deterministic urban network'
);

replaceOnce(
  "scatter(pinarManacorPoint,15,12,40,rock,.34,.82,'rock');scatter(manacorPoint,12,10,31,bush,.45,.92);scatter(puntaAmerPoint,16,7,31,bush,.45,.96);scatter(puntaAmerPoint,10,10,34,tree,.56,1.02,'tree');scatter(calaMillorHotelPoint,12,7,26,bush,.44,.90);",
  "scatter(pinarManacorPoint,15,12,40,rock,.34,.82,'rock');scatter(manacorPoint,12,10,31,bush,.45,.92);scatter(puntaAmerPoint,16,7,31,bush,.45,.96);scatter(puntaAmerPoint,10,10,34,tree,.56,1.02,'tree');scatter(calaMillorPoint,9,9,25,bush,.42,.82);scatter(calaBonaPoint,7,8,22,bush,.40,.78);scatter(capdeperaPoint,12,10,30,rock,.34,.76,'rock');",
  'updated urban vegetation anchors'
);

replaceOnce(
  " {id:'puntaamer',name:'Castell de sa Punta de n Amer',short:'Punta de n Amer',point:puntaAmerPoint,r:9,lines:['La torre defensiva ocupa el espacio abierto entre Sa Coma y Cala Millor.','Desde la azotea se domina la franja de costa y los hoteles quedan a distancia.']}\n];",
  " {id:'puntaamer',name:'Castell de sa Punta de n Amer',short:'Punta de n Amer',point:puntaAmerPoint,r:9,lines:['La torre defensiva ocupa el espacio abierto entre Sa Coma y Cala Millor.','Desde la azotea se domina la franja de costa y los hoteles quedan a distancia.']},\n {id:'capdepera',name:'Castell de Capdepera',short:'Castell de Capdepera',point:capdeperaPoint,r:12,lines:['La fortaleza y su pequeño recinto urbano coronan el monte sobre el nordeste de Mallorca.','Murallas, torres y casas forman una silueta compacta visible desde la costa.']},\n {id:'capdeperafar',name:'Far de Capdepera',short:'Far de Capdepera',point:capdeperaLighthousePoint,r:7,lines:['El faro ocupa el extremo oriental, más allá de Cala Rajada.','Desde aquí la costa se abre hacia el canal de Menorca.']}\n];",
  'Capdepera landmarks'
);

replaceOnce(
  "function eye(){const cp=Math.cos(pitch),e=[target[0]+radius*cp*Math.sin(cameraYaw),target[1]+radius*Math.sin(pitch),target[2]+radius*cp*Math.cos(cameraYaw)];if(followMode){const floor=terrainHeight(e[0],e[2])??WATER_Y;if(e[1]<floor+.65)e[1]=floor+.65}return e}",
  `function cameraPointBlocked(x,y,z){for(const o of colliders)if(y>o.bottom-.20&&y<o.top+.30&&shapeContains(o,x,z,.20))return true;return false}
function eye(){const cp=Math.cos(pitch),desired=[target[0]+radius*cp*Math.sin(cameraYaw),target[1]+radius*Math.sin(pitch),target[2]+radius*cp*Math.cos(cameraYaw)];if(!followMode)return desired;const dx=desired[0]-target[0],dy=desired[1]-target[1],dz=desired[2]-target[2],steps=Math.max(14,Math.ceil(Math.hypot(dx,dy,dz)*3.2));let safe=[target[0],target[1]+.08,target[2]];for(let i=1;i<=steps;i++){const t=i/steps,p=[target[0]+dx*t,target[1]+dy*t,target[2]+dz*t],floor=terrainHeight(p[0],p[2])??WATER_Y;p[1]=Math.max(p[1],floor+.65);if(cameraPointBlocked(p[0],p[1],p[2]))break;safe=p}return safe}`,
  'camera building collision'
);

replaceOnce(
  "function approach(v,target,maxDelta){return v<target?Math.min(v+maxDelta,target):Math.max(v-maxDelta,target)}",
  `function moveFlightHorizontal(nx,nz){const sx=player.x,sz=player.z,dx=nx-sx,dz=nz-sz,steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.28));for(let i=1;i<=steps;i++){const t=i/steps,x=sx+dx*t,z=sz+dz*t;if(sideBlocked(x,z,player.y+.45)){player.vx*=-.10;player.vz*=-.10;return false}}player.x=nx;player.z=nz;return true}
function approach(v,target,maxDelta){return v<target?Math.min(v+maxDelta,target):Math.max(v-maxDelta,target)}`,
  'flight building collision helper'
);

replaceOnce(
  "if(isFlight){player.x=Math.max(SEA_MIN_X,Math.min(SEA_MAX_X,player.x+player.vx*dt));player.z=Math.max(SEA_MIN_Z,Math.min(SEA_MAX_Z,player.z+player.vz*dt));const surf=surfaceAt(player.x,player.z),floor=surf&&surf.type!=='water'?surf.y:WATER_Y;",
  "if(isFlight){const flightX=Math.max(SEA_MIN_X,Math.min(SEA_MAX_X,player.x+player.vx*dt)),flightZ=Math.max(SEA_MIN_Z,Math.min(SEA_MAX_Z,player.z+player.vz*dt));moveFlightHorizontal(flightX,flightZ);const surf=surfaceAt(player.x,player.z),floor=surf&&surf.type!=='water'?surf.y:WATER_Y;",
  'solid vulture flight'
);

replaceOnce(
  "const ground=terrainHeight(player.x,player.z),meters=Math.round((ground||0)/MAX_HEIGHT*REAL_MAX_METERS),mountState=player.mount==='goat'?'en cabra':player.mount==='cow'?'en vaca':player.mount==='shark'?'sobre tintorera':player.mount==='vulture'?'volando en buitre':null,",
  "const ground=terrainHeight(player.x,player.z),meters=Math.round((ground||0)/MAX_HEIGHT*REAL_MAX_METERS),mountState=player.mount==='goat'?'en cabra':player.mount==='cow'?'en vaca':player.mount==='pig'?'en porc negre':player.mount==='shark'?'sobre tintorera':player.mount==='vulture'?'volando en buitre':null,",
  'pig HUD state'
);

replaceOnce('version:157,', 'version:158,', 'save version');

replaceOnce(
  "window.WAFT_DEBUG={player,goats,cows,pigs,warblers,sharks,vultures,landmarks,landmarkDiscoveries,colliders,cathedralPoint,bellverPoint,drachPoint,portoCristoPoint,manacorPoint,saComaPoint,puntaAmerPoint,calaMillorPoint,regionAt,terrainHeight,waterInfo,mountAnimal,dismountAnimal,teleportPlayer,observeMountAnimal};",
  "window.WAFT_DEBUG={player,goats,cows,pigs,warblers,sharks,vultures,landmarks,landmarkDiscoveries,colliders,urbanSites,cathedralPoint,bellverPoint,drachPoint,portoCristoPoint,manacorPoint,portAlcudiaPoint,saComaPoint,puntaAmerPoint,calaMillorPoint,calaBonaPoint,capdeperaPoint,calaRajadaPoint,capdeperaLighthousePoint,regionAt,terrainHeight,waterInfo,shapeContains,sideBlocked,cameraPointBlocked,moveFlightHorizontal,mountAnimal,dismountAnimal,teleportPlayer,observeMountAnimal};",
  'debug urban and collision hooks'
);

if (!html.includes('WAFT Adventure 0.15.8 · Mallorca poblada')) throw new Error('0.15.8 title missing');
if (!html.includes("id:'capdepera'")) throw new Error('Capdepera landmark missing');
if (!html.includes('cameraPointBlocked')) throw new Error('Camera collision missing');
if (!html.includes('moveFlightHorizontal')) throw new Error('Flight collision missing');
if (!html.includes("placeUrbanSet('hotel','Cala Rajada'")) throw new Error('Cala Rajada hotels missing');
if (/\<script[^>]+src=/i.test(html)) throw new Error('External script dependency detected');

const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
if (scripts.length < 2) throw new Error(`Expected at least two inline scripts, got ${scripts.length}`);
const jsPath = '/tmp/waft-0158-main.js';
fs.writeFileSync(jsPath, scripts[scripts.length - 1][1]);
execFileSync(process.execPath, ['--check', jsPath], { stdio: 'inherit' });
fs.writeFileSync(output, html);
console.log(`Built ${output}: ${Buffer.byteLength(html)} bytes`);
