import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const input = 'mallorca-mobile/waft-0156.html';
const output = 'mallorca-mobile/waft-0157.html';
let html = fs.readFileSync(input, 'utf8');

function replaceOnce(search, replacement, label) {
  const next = html.replace(search, replacement);
  if (next === html) throw new Error(`Replacement failed: ${label}`);
  html = next;
}

replaceOnce('<title>WAFT Adventure 0.15.6 · Mallorca habitable</title>', '<title>WAFT Adventure 0.15.7 · Geografía de Llevant</title>', 'title');
replaceOnce('WAFT ADVENTURE 0.15.6 · MALLORCA HABITABLE', 'WAFT ADVENTURE 0.15.7 · GEOGRAFÍA DE LLEVANT', 'HUD title');

replaceOnce(
  "function geoBuild(lon,lat,clearance=7,minV=1,maxV=145,maxRadius=95){const p=geoWorld(lon,lat);return findBuildSiteNear(p.x,p.z,clearance,minV,maxV,maxRadius)}",
  "function geoBuild(lon,lat,clearance=7,minV=1,maxV=145,maxRadius=95){const p=geoWorld(lon,lat);return findBuildSiteNear(p.x,p.z,clearance,minV,maxV,maxRadius)}\nfunction geoExact(lon,lat){const p=geoWorld(lon,lat),h=terrainHeight(p.x,p.z);return h!==null?{x:p.x,y:h,z:p.z}:findLandNear(p.x,p.z,1,190,.18)}",
  'geoExact helper'
);

replaceOnce(
  /const cathedralPoint=geoBuild\([^\n]+calaMillorHotelPoint=geoBuild\([^;]+;/,
  `const cathedralGeo=geoExact(2.64843,39.56734),bellverGeo=geoExact(2.61942,39.56378),palmaMonumentSpacing=1.48;
const cathedralPoint=cathedralGeo,bellverPoint=point(cathedralGeo.x+(bellverGeo.x-cathedralGeo.x)*palmaMonumentSpacing,cathedralGeo.z+(bellverGeo.z-cathedralGeo.z)*palmaMonumentSpacing)||bellverGeo,
 drachPoint=geoExact(3.33054,39.53588),portoCristoPoint=geoExact(3.33639,39.54167),llucPoint=geoExact(2.885,39.822),formentorPoint=geoExact(3.200,39.955),salinesPoint=geoExact(3.053,39.266),alcudiaPoint=geoExact(3.105,39.835),
 manacorPoint=geoExact(3.21069,39.56866),pinarManacorPoint=geoExact(3.176,39.593),saComaPoint=geoExact(3.37588,39.57578),puntaAmerPoint=geoExact(3.39600,39.57998),calaMillorPoint=geoExact(3.38480,39.60470),calaMillorHotelPoint=point(calaMillorPoint.x-1.15,calaMillorPoint.z+.45)||calaMillorPoint;`,
  'real geographic anchors'
);

replaceOnce(
  "function addBoxRoof(p,yaw,lx,lz,hx,hz,top){const w=localToWorld(p,yaw,lx,lz);return addCollider({shape:'box',x:w.x,z:w.z,bottom:p.y,yaw,hx,hz,top:p.y+top,standable:true})}\nfunction addCircleRoof(p,yaw,lx,lz,r,top){const w=localToWorld(p,yaw,lx,lz);return addCollider({shape:'circle',x:w.x,z:w.z,bottom:p.y,yaw,r,top:p.y+top,standable:true})}",
  "function addBoxRoof(p,yaw,lx,lz,hx,hz,top,standMin=null){const w=localToWorld(p,yaw,lx,lz);return addCollider({shape:'box',x:w.x,z:w.z,bottom:p.y,yaw,hx,hz,top:p.y+top,standMin:standMin===null?null:p.y+standMin,standable:true})}\nfunction addCircleRoof(p,yaw,lx,lz,r,top,standMin=null){const w=localToWorld(p,yaw,lx,lz);return addCollider({shape:'circle',x:w.x,z:w.z,bottom:p.y,yaw,r,top:p.y+top,standMin:standMin===null?null:p.y+standMin,standable:true})}",
  'height-aware roof colliders'
);

replaceOnce(
  /const bellverYaw=\.24,bellverSX=1\.90,bellverSY=2\.00;[^\n]+/,
  "const bellverYaw=.24,bellverSX=1.90,bellverSY=2.00;place(castleObj,bellverPoint,bellverSX,bellverSY,bellverSX,bellverYaw,0);addCircleRoof(bellverPoint,bellverYaw,0,0,4.08*bellverSX,5.07*bellverSY);for(const a of[0,Math.PI*2/3,Math.PI*4/3])addCircleRoof(bellverPoint,bellverYaw,Math.sin(a)*3.48*bellverSX,Math.cos(a)*3.48*bellverSX,1.34*bellverSX,6.20*bellverSY,5.24*bellverSY);addCircleRoof(bellverPoint,bellverYaw,-4.15*bellverSX,1.05*bellverSX,1.66*bellverSX,8.34*bellverSY,6.03*bellverSY);",
  'Bellver solid towers and landing levels'
);

replaceOnce(
  "place(caveObj,drachPoint,1.58,1.58,1.58,2.55,0,{shape:'circle',r:4.7,height:5.0,standable:true});",
  "place(caveObj,drachPoint,.92,.92,.92,2.55,0,{shape:'circle',r:2.92,height:3.72,standable:true});",
  'Drach scale'
);
replaceOnce(
  "const hotelYaw=-.12,hotelSX=1.08,hotelSY=1.04;place(hotelObj,calaMillorHotelPoint,hotelSX,hotelSY,hotelSX,hotelYaw,0);addBoxRoof(calaMillorHotelPoint,hotelYaw,0,0,4.30*hotelSX,1.98*hotelSX,7.92*hotelSY);",
  "const hotelYaw=-.12,hotelSX=.82,hotelSY=.86;place(hotelObj,calaMillorHotelPoint,hotelSX,hotelSY,hotelSX,hotelYaw,0);addBoxRoof(calaMillorHotelPoint,hotelYaw,0,0,4.30*hotelSX,1.98*hotelSX,7.92*hotelSY);",
  'Cala Millor hotel scale'
);

replaceOnce(
  /placeTown\(cathedralPoint,18,15101,31\);placeTown\(drachPoint,5,15102,18\);placeTown\(alcudiaPoint,10,15103,24\);placeTown\(manacorPoint,9,15104,23\);placeTown\(calaMillorHotelPoint,4,15105,16\);/,
  `placeTown(cathedralPoint,14,15101,28);placeTown(alcudiaPoint,10,15103,24);
function placeGeoTown(center,count,seed,minR,maxR,scaleMin=.62,scaleMax=.82,avoid=[]){const rand=seeded(seed),placed=[];for(let i=0;i<count;i++){let p=null;for(let tries=0;tries<64;tries++){const a=rand()*Math.PI*2,d=minR+Math.sqrt(rand())*(maxR-minR),cand=point(center.x+Math.cos(a)*d,center.z+Math.sin(a)*d);if(!cand)continue;if(avoid.some(site=>Math.hypot(cand.x-site.p.x,cand.z-site.p.z)<site.r))continue;if(placed.some(q=>Math.hypot(cand.x-q.x,cand.z-q.z)<3.25))continue;p=cand;break}if(!p)continue;placed.push(p);const sc=scaleMin+rand()*(scaleMax-scaleMin),sy=sc*(1.08+rand()*.22);place(houseObj,p,sc,sy,sc,rand()*Math.PI*2,0,{shape:'box',hx:1.50*sc,hz:1.28*sc,height:4.70,standable:true})}}
placeGeoTown(manacorPoint,7,15701,5.4,12.5,.66,.86,[{p:manacorPoint,r:4.9}]);
placeGeoTown(portoCristoPoint,5,15702,3.8,7.0,.60,.78,[{p:drachPoint,r:4.6}]);
placeGeoTown(saComaPoint,4,15703,3.2,6.0,.60,.78,[{p:puntaAmerPoint,r:6.2}]);
placeGeoTown(calaMillorPoint,5,15704,3.4,7.0,.62,.82,[{p:puntaAmerPoint,r:7.0},{p:calaMillorHotelPoint,r:4.2}]);`,
  'separated Llevant settlements'
);

replaceOnce(
  "scatter(drachPoint,24,8,40,rock,.42,1.12,'rock');scatter(drachPoint,18,12,48,tree,.55,1.20,'tree');",
  "scatter(drachPoint,8,5,15,rock,.34,.72,'rock');scatter(drachPoint,7,7,18,tree,.48,.88,'tree');",
  'Drach surroundings'
);

replaceOnce(
  "return{x:p.x,y:p.y,z:p.z,yaw:a,phase:i*1.11,homeX:p.x,homeZ:p.z,rng:seeded(14600+i),targetX:null,targetZ:null,wait:rand()*3.0,moveSpeed:0}",
  "return{x:p.x,y:p.y,z:p.z,yaw:a,phase:i*1.11,homeX:p.x,homeZ:p.z,rng:seeded(14600+i),targetX:null,targetZ:null,wait:rand()*3.0,moveSpeed:0,mounted:false}",
  'mountable pigs state'
);

replaceOnce(
  "flightPitch:0,flightBank:0};",
  "flightPitch:0,flightBank:0,pigDash:0,pigDashSpeed:0};",
  'pig dash player state'
);

replaceOnce(
  "...pigs.map(a=>({x:a.x,z:a.z,r:.64,top:a.y+1.16,standable:false}))",
  "...pigs.filter((a,i)=>!(player.mount==='pig'&&player.mountId===i)).map(a=>({x:a.x,z:a.z,r:.68,top:a.y+1.28,standable:true}))",
  'pig actor shapes'
);
replaceOnce(
  "function objectTopAt(x,z){let top=null;for(const o of colliders)if(o.standable&&shapeContains(o,x,z,.02))top=top===null?o.top:Math.max(top,o.top);for(const a of actorShapes())if(a.standable&&(x-a.x)**2+(z-a.z)**2<(a.r*.86)**2)top=top===null?a.top:Math.max(top,a.top);return top}\nfunction surfaceAt(x,z){const land=terrainHeight(x,z),obj=objectTopAt(x,z);",
  "function objectTopAt(x,z,y=player.y){let top=null;for(const o of colliders)if(o.standable&&shapeContains(o,x,z,.02)&&(o.standMin===null||o.standMin===undefined||y>=o.standMin))top=top===null?o.top:Math.max(top,o.top);for(const a of actorShapes())if(a.standable&&(x-a.x)**2+(z-a.z)**2<(a.r*.86)**2)top=top===null?a.top:Math.max(top,a.top);return top}\nfunction surfaceAt(x,z,y=player.y){const land=terrainHeight(x,z),obj=objectTopAt(x,z,y);",
  'height-sensitive surface selection'
);

replaceOnce(
  "const names={goat:'CABRA MALLORQUINA',cow:'VACA MENORQUINA',shark:'TINTORERA',vulture:'BUITRE NEGRO'},name=names[player.mount];mountBadge.textContent=name?`MONTURA · ${name}`:'';mountBadge.classList.toggle('visible',!!name);jumpBtn.textContent=player.mount==='vulture'?'ALETEAR':'SALTAR'",
  "const names={goat:'CABRA MALLORQUINA',cow:'VACA MENORQUINA',pig:'PORC NEGRE MALLORQUÍ',shark:'TINTORERA',vulture:'BUITRE NEGRO'},name=names[player.mount];mountBadge.textContent=name?`MONTURA · ${name}`:'';mountBadge.classList.toggle('visible',!!name);jumpBtn.textContent=player.mount==='vulture'?'ALETEAR':player.mount==='pig'?'EMBESTIR':'SALTAR'",
  'pig mount UI'
);
replaceOnce(
  "if((type==='goat'||type==='cow')&&(type==='goat'?goats[id]:cows[id])){const a=type==='goat'?goats[id]:cows[id];",
  "if((type==='goat'||type==='cow'||type==='pig')&&(type==='goat'?goats[id]:type==='cow'?cows[id]:pigs[id])){const a=type==='goat'?goats[id]:type==='cow'?cows[id]:pigs[id];",
  'pig dismount'
);
replaceOnce(
  "const a=type==='goat'?goats[id]:type==='cow'?cows[id]:type==='shark'?sharks[id]:vultures[id];",
  "const a=type==='goat'?goats[id]:type==='cow'?cows[id]:type==='pig'?pigs[id]:type==='shark'?sharks[id]:vultures[id];",
  'pig mount lookup'
);
replaceOnce("player.grounded=type==='goat'||type==='cow';", "player.grounded=type==='goat'||type==='cow'||type==='pig';", 'pig grounded mount');
replaceOnce(
  "showToast(type==='goat'?'Cabra montada':type==='cow'?'Vaca menorquina montada':type==='shark'?'Tintorera montada':'Buitre montado')",
  "showToast(type==='goat'?'Cabra montada':type==='cow'?'Vaca menorquina montada':type==='pig'?'Porc negre montado · mantén EMBESTIR':type==='shark'?'Tintorera montada':'Buitre montado')",
  'pig mount toast'
);

replaceOnce(
  "pigs.forEach(a=>add(a.x,a.z,4.8,'OBSERVAR PORC NEGRE',()=>observeMountAnimal('pig'),a.y,null,null,3.5));",
  "pigs.forEach((a,i)=>{if(!a.mounted)add(a.x,a.z,5.0,'MONTAR PORC NEGRE',()=>mountAnimal('pig',i),a.y,'OBSERVAR PORC NEGRE',()=>observeMountAnimal('pig'),4.0)});",
  'pig interaction'
);
replaceOnce("pigs.forEach(a=>updateWanderAnimal(a,dt,11.5,.66));", "pigs.forEach(a=>{if(!a.mounted)updateWanderAnimal(a,dt,11.5,.66)});", 'mounted pig movement');

replaceOnce(
  "if(player.mount==='vulture'){player.charging=true;player.charge=0;player.chargeStarted=performance.now();jumpBtn.classList.add('charging');jumpBtn.textContent='ALETEO';return}",
  "if(player.mount==='vulture'){player.charging=true;player.charge=0;player.chargeStarted=performance.now();jumpBtn.classList.add('charging');jumpBtn.textContent='ALETEO';return}if(player.mount==='pig'){player.charging=true;player.charge=0;player.chargeStarted=performance.now();jumpBtn.classList.add('charging');jumpBtn.textContent='EMBESTIDA';return}",
  'pig charge start'
);
replaceOnce(
  "jumpBtn.textContent=player.mount==='vulture'?'ALETEAR':'SALTAR';\n if(player.mount==='vulture'){player.vy=Math.max(player.vy,3.8+charge*6.4);player.flightPitch=-.18;return}",
  "jumpBtn.textContent=player.mount==='vulture'?'ALETEAR':player.mount==='pig'?'EMBESTIR':'SALTAR';\n if(player.mount==='vulture'){player.vy=Math.max(player.vy,3.8+charge*6.4);player.flightPitch=-.18;return}\n if(player.mount==='pig'){const power=15.0+Math.min(1.45,charge)*11.5;player.pigDash=.52+Math.min(1.45,charge)*.30;player.pigDashSpeed=power;player.vx=Math.sin(player.yaw)*power;player.vz=Math.cos(player.yaw)*power;player.vy=2.0+Math.min(1.45,charge)*1.4;player.grounded=false;player.coyote=0;player.aquaticJump=false;showToast('¡Embestida del porc negre!');return}",
  'pig charge release'
);

replaceOnce(
  "const isFlight=player.mount==='vulture',isShark=player.mount==='shark',isGoat=player.mount==='goat',isCow=player.mount==='cow',hasInput=inputMag>.06,",
  "const isFlight=player.mount==='vulture',isShark=player.mount==='shark',isGoat=player.mount==='goat',isCow=player.mount==='cow',isPig=player.mount==='pig',hasInput=inputMag>.06,",
  'pig movement flag'
);
replaceOnce(
  "player.yaw+=delta*Math.min(1,dt*(isFlight?3.2:player.swimming?6.5:player.grounded?10:4.5))",
  "player.yaw+=delta*Math.min(1,dt*(isPig&&player.pigDash>0?1.35:isFlight?3.2:player.swimming?6.5:player.grounded?10:4.5))",
  'pig dash steering'
);
replaceOnce(
  "else if(isCow)targetSpeed=hasInput?(player.sprinting?12.6:player.running?7.4:3.2)*Math.max(.45,inputMag):0;else if(isGoat)",
  "else if(isCow)targetSpeed=hasInput?(player.sprinting?12.6:player.running?7.4:3.2)*Math.max(.45,inputMag):0;else if(isPig){if(player.pigDash>0){player.pigDash=Math.max(0,player.pigDash-dt);targetSpeed=player.pigDashSpeed*(.72+.28*player.pigDash/.95);dirX=Math.sin(player.yaw);dirZ=Math.cos(player.yaw)}else targetSpeed=hasInput?(player.sprinting?13.4:player.running?8.2:3.4)*Math.max(.45,inputMag):0}else if(isGoat)",
  'pig movement speeds'
);
replaceOnce(
  "accel=isFlight?10.5:isShark?34:player.swimming?",
  "accel=isFlight?10.5:isShark?34:isPig&&player.pigDash>0?46:isPig?14:player.swimming?",
  'pig acceleration'
);
html = html.replaceAll('(isGoat||isCow)', '(isGoat||isCow||isPig)');

replaceOnce(
  "else if(player.mount==='cow')base=compose(T(player.x,player.y+1.72,player.z),RY(player.yaw),RX(-.06),S(.70,.70,.70));else if(player.mount==='shark')",
  "else if(player.mount==='cow')base=compose(T(player.x,player.y+1.72,player.z),RY(player.yaw),RX(-.06),S(.70,.70,.70));else if(player.mount==='pig')base=compose(T(player.x,player.y+1.14,player.z),RY(player.yaw),RX(-.14),S(.66,.66,.66));else if(player.mount==='shark')",
  'penguin pig riding position'
);
replaceOnce(
  "pigs.forEach(a=>drawRunningAnimal(pigBodyObj,a,now,1.04,'pig',false));",
  "pigs.forEach((a,i)=>{if(player.mount==='pig'&&player.mountId===i)return;drawRunningAnimal(pigBodyObj,a,now,1.04,'pig',false)});",
  'hide mounted pig duplicate'
);
replaceOnce(
  "else if(player.mount==='cow')drawRunningAnimal(cowBodyObj,{x:player.x,y:player.y,z:player.z,yaw:player.yaw,phase:0},now,1.46,'cow',true);else if(player.mount==='shark')",
  "else if(player.mount==='cow')drawRunningAnimal(cowBodyObj,{x:player.x,y:player.y,z:player.z,yaw:player.yaw,phase:0},now,1.46,'cow',true);else if(player.mount==='pig')drawRunningAnimal(pigBodyObj,{x:player.x,y:player.y,z:player.z,yaw:player.yaw,phase:0},now,1.15,'pig',true);else if(player.mount==='shark')",
  'draw mounted pig'
);

replaceOnce("version:152,", "version:157,", 'save version');
replaceOnce(
  "window.WAFT_DEBUG={player,goats,cows,pigs,warblers,sharks,vultures,landmarks,landmarkDiscoveries,colliders,regionAt,terrainHeight,waterInfo,mountAnimal,dismountAnimal,teleportPlayer,observeMountAnimal};",
  "window.WAFT_DEBUG={player,goats,cows,pigs,warblers,sharks,vultures,landmarks,landmarkDiscoveries,colliders,cathedralPoint,bellverPoint,drachPoint,portoCristoPoint,manacorPoint,saComaPoint,puntaAmerPoint,calaMillorPoint,regionAt,terrainHeight,waterInfo,mountAnimal,dismountAnimal,teleportPlayer,observeMountAnimal};",
  'debug geography'
);

if (!html.includes('WAFT Adventure 0.15.7 · Geografía de Llevant')) throw new Error('Version title missing');
if (!html.includes("MONTAR PORC NEGRE")) throw new Error('Pig mount interaction missing');
if (!html.includes('portoCristoPoint=geoExact(3.33639,39.54167)')) throw new Error('Porto Cristo geographic anchor missing');
if (!html.includes('standMin')) throw new Error('Layered Bellver collision missing');
if (/<script[^>]+src=/i.test(html)) throw new Error('External script dependency detected');

const scriptBlocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
if (scriptBlocks.length < 2) throw new Error('Expected inline terrain and game scripts');
const mainScript = scriptBlocks.at(-1);
const tmp = '/tmp/waft-0157-main.js';
fs.writeFileSync(tmp, mainScript);
execFileSync(process.execPath, ['--check', tmp], { stdio: 'inherit' });
fs.rmSync(tmp, { force: true });

fs.writeFileSync(output, html);
console.log(`Built ${output}: ${Buffer.byteLength(html)} bytes`);
