'use strict';
(() => {
  const BUILD = '0.23.0';
  const REGION_ID = window.__WAFT_ADVENTURE_REGION__ || 'baleares';
  const PROJECTIONS = {
    baleares: {
      origin: { lat: 39.6, lon: 2.9 }, kmPerDegreeLat: 111.132, kmPerDegreeLon: 85.77353418580084, unitsPerKm: 5,
      compression: .76,
      anchors: [
        { id:'mallorca', lat:39.65, lon:2.9 }, { id:'menorca', lat:39.97, lon:4.08 },
        { id:'ibiza', lat:38.98, lon:1.43 }, { id:'formentera', lat:38.7, lon:1.47 },
        { id:'cabrera', lat:39.15, lon:2.95 }
      ]
    },
    'catalunya-litoral': {
      origin: { lat: 41.525, lon: 2.15 }, kmPerDegreeLat: 111.132, kmPerDegreeLon: 83.34155778169932, unitsPerKm: 3.2,
      compression: 1, anchors: []
    }
  };
  const PORTS = {
    baleares: { x:102.9282, z:-133.3584, name:"Port d'Alcúdia", target:'catalunya-litoral', targetName:'Barcelona' },
    'catalunya-litoral': { x:5.3339, z:62.2339, name:'Port de Barcelona', target:'baleares', targetName:'Mallorca' }
  };
  const SEA_ARRIVALS = {
    'catalunya-litoral': { lat:40.965, lon:2.17, bearing:350 },
    baleares: { lat:40.01, lon:3.07, bearing:165 }
  };
  let crossingLocked = false;
  let densityApplied = false;

  const normDeg = value => (value % 360 + 360) % 360;
  const rad = deg => deg * Math.PI / 180;
  const deg = radian => radian * 180 / Math.PI;
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  function projectRaw(regionId, lat, lon) {
    const p = PROJECTIONS[regionId];
    return {
      x: (lon - p.origin.lon) * p.kmPerDegreeLon * p.unitsPerKm,
      z: (p.origin.lat - lat) * p.kmPerDegreeLat * p.unitsPerKm
    };
  }
  function compressedAnchor(p, anchor) {
    const raw = projectRaw('baleares', anchor.lat, anchor.lon);
    return { x: raw.x * p.compression, z: raw.z * p.compression, rawX: raw.x, rawZ: raw.z };
  }
  function closestCompressedAnchor(x,z) {
    const p = PROJECTIONS.baleares;
    let best = null;
    for (const anchor of p.anchors) {
      const c = compressedAnchor(p, anchor);
      const d = Math.hypot(x-c.x,z-c.z);
      if (!best || d < best.d) best = { anchor, c, d };
    }
    return best;
  }
  function closestRealAnchor(lat,lon) {
    const p = PROJECTIONS.baleares;
    let best = null;
    for (const anchor of p.anchors) {
      const dx=(lon-anchor.lon)*p.kmPerDegreeLon, dz=(lat-anchor.lat)*p.kmPerDegreeLat;
      const d=Math.hypot(dx,dz);
      if(!best||d<best.d) best={anchor,d};
    }
    return best;
  }
  function regionalToGeo(regionId,x,z) {
    const p = PROJECTIONS[regionId];
    let rawX=x, rawZ=z;
    if (regionId === 'baleares') {
      const nearest = closestCompressedAnchor(x,z);
      if (nearest) {
        rawX = x + (1-p.compression) * nearest.c.rawX;
        rawZ = z + (1-p.compression) * nearest.c.rawZ;
      }
    }
    return {
      lat: p.origin.lat - rawZ / p.unitsPerKm / p.kmPerDegreeLat,
      lon: p.origin.lon + rawX / p.unitsPerKm / p.kmPerDegreeLon
    };
  }
  function geoToRegional(regionId,lat,lon) {
    const p=PROJECTIONS[regionId];
    const raw=projectRaw(regionId,lat,lon);
    if(regionId!=='baleares') return raw;
    const nearest=closestRealAnchor(lat,lon);
    if(!nearest) return raw;
    const aRaw=projectRaw('baleares',nearest.anchor.lat,nearest.anchor.lon);
    return { x:raw.x-(1-p.compression)*aRaw.x, z:raw.z-(1-p.compression)*aRaw.z };
  }
  function geoDistanceBearing(a,b) {
    const R=6371.0088, p1=rad(a.lat), p2=rad(b.lat), dp=rad(b.lat-a.lat), dl=rad(b.lon-a.lon);
    const h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
    const distance=2*R*Math.asin(Math.min(1,Math.sqrt(h)));
    const y=Math.sin(dl)*Math.cos(p2), x=Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl);
    return {distance,bearing:normDeg(deg(Math.atan2(y,x)))};
  }
  function yawToBearing(yaw){ return normDeg(180 - deg(yaw || 0)); }
  function bearingToYaw(bearing){ return rad(180 - bearing); }
  function compassName(bearing){ return ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSO','SO','OSO','O','ONO','NO','NNO'][Math.round(normDeg(bearing)/22.5)%16]; }
  function relativeArrow(target, heading){
    let d=((target-heading+540)%360)-180;
    if(Math.abs(d)<18)return '↑'; if(d>=18&&d<70)return '↗'; if(d>=70&&d<115)return '→'; if(d>=115&&d<162)return '↘';
    if(Math.abs(d)>=162)return '↓'; if(d<=-18&&d>-70)return '↖'; if(d<=-70&&d>-115)return '←'; return '↙';
  }
  function toast(text){
    const el=document.getElementById('waftToast')||document.getElementById('waftPlayToast');
    if(!el)return;
    el.textContent=text; el.classList.add('show'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove('show'),2600);
  }

  function injectPlayabilityUi(){
    if(document.getElementById('waftGeoHud'))return;
    const style=document.createElement('style');
    style.id='waftPlayability0230Style';
    style.textContent=`
      #vertical,#help{display:none!important}
      #presets{display:none!important;opacity:1!important;bottom:max(12px,env(safe-area-inset-bottom))!important;max-width:min(68vw,760px)!important;z-index:32!important;background:rgba(5,18,24,.94)!important}
      body.waft-destinations-open #presets{display:flex!important}
      #waftTopActions{top:max(10px,env(safe-area-inset-top))!important;right:max(10px,env(safe-area-inset-right))!important;max-width:44vw!important}
      #waftTopActions button{min-height:38px}
      #waftGeoHud{position:fixed;z-index:34;left:50%;top:max(9px,env(safe-area-inset-top));transform:translateX(-50%);min-width:330px;max-width:44vw;padding:7px 12px;border-radius:13px;background:rgba(5,18,24,.90);border:1px solid rgba(168,239,210,.38);box-shadow:0 7px 24px #0007;backdrop-filter:blur(9px);text-align:center;pointer-events:none}
      #waftGeoLine{font-size:11px;font-weight:900;color:#f3f6f1;letter-spacing:.025em;white-space:nowrap}#waftGeoSub{margin-top:2px;font-size:9px;font-weight:750;color:#9fd9c8;white-space:nowrap}
      #waftPortNav{position:fixed;z-index:33;left:50%;top:max(57px,calc(env(safe-area-inset-top) + 57px));transform:translateX(-50%);padding:7px 11px;border-radius:999px;background:rgba(7,29,34,.90);border:1px solid rgba(231,189,99,.48);box-shadow:0 6px 20px #0007;color:#ffe5a0;font-size:10px;font-weight:950;letter-spacing:.025em;pointer-events:none;white-space:nowrap}
      #waftUtility{position:fixed;z-index:29;right:max(18px,env(safe-area-inset-right));bottom:max(119px,calc(env(safe-area-inset-bottom) + 119px));display:flex;gap:7px;align-items:center}
      #waftUtility button{height:38px;border-radius:11px;border:1px solid #ffffff32;background:rgba(7,22,28,.93);color:#fff;padding:0 10px;font-size:10px;font-weight:950;box-shadow:0 6px 18px #0008;touch-action:none}
      #waftUtility #waftRespawn{width:40px;padding:0;font-size:18px}
      #waftJump{right:max(18px,env(safe-area-inset-right))!important;bottom:max(22px,env(safe-area-inset-bottom))!important;width:82px!important;height:82px!important}
      #waftMountBadge{right:max(108px,calc(env(safe-area-inset-right) + 108px))!important;bottom:max(31px,calc(env(safe-area-inset-bottom) + 31px))!important}
      #waftAdventureAction,#waftObserveAction{left:50%!important;right:auto!important;transform:translateX(-50%)!important;min-width:150px!important}
      #waftAdventureAction{bottom:max(82px,calc(env(safe-area-inset-bottom) + 82px))!important}
      #waftObserveAction{bottom:max(126px,calc(env(safe-area-inset-bottom) + 126px))!important}
      #waftTravelAction{top:max(94px,calc(env(safe-area-inset-top) + 94px))!important;bottom:auto!important;min-width:260px!important}
      #waftAdventureHud{top:82px!important}
      #waftPlayToast{position:fixed;z-index:60;left:50%;top:128px;transform:translate(-50%,-10px);opacity:0;pointer-events:none;padding:8px 13px;border-radius:999px;background:rgba(4,17,22,.96);border:1px solid #fff3;color:#fff4cf;font-size:10px;font-weight:900;transition:.2s}#waftPlayToast.show{opacity:1;transform:translate(-50%,0)}
      @media(max-width:900px){#waftGeoHud{min-width:280px;max-width:39vw;padding:6px 9px}#waftGeoLine{font-size:9px}#waftGeoSub{font-size:8px}#waftPortNav{font-size:8px;top:51px}#waftAdventureHud{top:64px!important}#waftTopActions button{font-size:9px;padding:7px 8px}.waft-hide-narrow{display:none!important}}
      @media(max-width:700px){#waftGeoHud{left:50%;top:6px;min-width:0;width:35vw;max-width:none}#waftGeoSub{display:none}#waftPortNav{top:42px;max-width:38vw;overflow:hidden;text-overflow:ellipsis}#waftAdventureHud{top:58px!important;width:min(238px,52vw)!important}#waftJump{width:72px!important;height:72px!important}#waftUtility{bottom:101px}#waftAdventureAction{bottom:80px!important}#waftObserveAction{bottom:119px!important}body.waft-destinations-open #presets{max-width:66vw!important}}
    `;
    document.head.appendChild(style);
    const geo=document.createElement('div'); geo.id='waftGeoHud'; geo.innerHTML='<div id="waftGeoLine">Calculando posición…</div><div id="waftGeoSub"></div>'; document.body.appendChild(geo);
    const port=document.createElement('div'); port.id='waftPortNav'; port.textContent='Localizando puerto…'; document.body.appendChild(port);
    const utility=document.createElement('div'); utility.id='waftUtility'; utility.innerHTML='<button id="waftRun" type="button">CORRER</button><button id="waftRespawn" type="button" aria-label="Reaparecer">↺</button>'; document.body.appendChild(utility);
    const toastEl=document.createElement('div'); toastEl.id='waftPlayToast'; document.body.appendChild(toastEl);
    const top=document.getElementById('waftTopActions');
    if(top && !document.getElementById('waftDestinations')){
      const b=document.createElement('button'); b.id='waftDestinations'; b.type='button'; b.textContent='DESTINOS'; b.className='waft-hide-narrow'; top.appendChild(b);
      b.addEventListener('click',()=>{document.body.classList.toggle('waft-destinations-open'); b.classList.toggle('active',document.body.classList.contains('waft-destinations-open'));});
    }
    document.getElementById('waftRun')?.addEventListener('click',()=>{document.getElementById('boost')?.click(); syncUtilityLabels();});
    document.getElementById('waftRespawn')?.addEventListener('click',()=>document.getElementById('down')?.click());
    addEventListener('keydown',e=>{if(e.code==='KeyM'&&!e.repeat){document.body.classList.toggle('waft-destinations-open');document.getElementById('waftDestinations')?.classList.toggle('active',document.body.classList.contains('waft-destinations-open'));}});
  }
  function syncUtilityLabels(){
    const original=document.getElementById('boost'), own=document.getElementById('waftRun'); if(!original||!own)return;
    own.textContent=original.classList.contains('active')?'CORRIENDO':'CORRER'; own.classList.toggle('active',original.classList.contains('active'));
  }

  function safeSurface(api,x,z,kind){
    const wantsWater=kind==='water';
    for(const radius of [0,1.5,3,5,8,12,18,25,34]){
      const samples=radius?20:1;
      for(let i=0;i<samples;i++){
        const angle=i/samples*Math.PI*2, px=x+Math.cos(angle)*radius, pz=z+Math.sin(angle)*radius, s=api.sampleSurface(px,pz);
        if(!s?.inside)continue;
        if((wantsWater&&s.water)||(!wantsWater&&s.land))return {x:px,z:pz,y:s.height??s.waterHeight??0};
      }
    }
    return null;
  }
  function seeded(seed){let t=seed>>>0;return()=>{t+=0x6D2B79F5;let r=t;r=Math.imul(r^r>>>15,r|1);r^=r+Math.imul(r^r>>>7,r|61);return((r^r>>>14)>>>0)/4294967296;};}
  function makeAnimal(id,type,name,p,options={}){
    return {id,type,name,x:p.x,z:p.z,originX:p.x,originZ:p.z,y:p.y||0,yaw:options.yaw||0,phase:options.phase||0,speed:options.speed||0,radius:options.radius||5,mountable:!!options.mountable,aquatic:!!options.aquatic,flying:!!options.flying,flightMountReady:false,landed:false,mission:null,fleeing:false,fleeTime:0,hidden:false};
  }
  function densifyFauna(){
    if(densityApplied)return;
    const game=window.__WAFT_INTERNAL_GAME__, api=window.WAFTRegionRuntime; if(!game||!api||!Array.isArray(game.animals))return;
    densityApplied=true;
    const presets=api.metadata?.presets?.filter(p=>p.id!=='overview')||[]; if(!presets.length)return;
    const rnd=seeded(REGION_ID==='baleares'?230031:230071);
    const targetCount=matchMedia('(max-width: 800px)').matches?(REGION_ID==='baleares'?50:42):(REGION_ID==='baleares'?68:54);
    const species=REGION_ID==='baleares'
      ? [['lizard','Sargantana balear',.10,2.4],['rabbit','Conejo europeo',.38,3.4],['weasel','Comadreja',.34,4.6],['gineta','Gineta',.22,6.8],['salamander','Salamandra',.07,2.2],['goat','Cabra mallorquina',.28,8],['pig','Porc negre mallorquí',.20,8],['cow','Vaca vermella menorquina',.15,8],['warbler','Curruca balear',.42,5],['vulture','Buitre negro',.32,12]]
      : [['lizard','Lagartija ibérica',.11,2.5],['rabbit','Conejo europeo',.38,3.5],['weasel','Comadreja',.34,4.5],['gineta','Gineta',.22,6.5],['salamander','Salamandra',.07,2.2],['goat','Cabra montés',.29,8],['pig','Jabalí',.23,8],['cow','Vaca pirenaica',.15,8],['warbler','Curruca cabecinegra',.42,5],['vulture','Buitre leonado',.32,12]];
    let sequence=0;
    while(game.animals.length<targetCount){
      const spec=species[sequence%species.length], base=presets[Math.floor(rnd()*presets.length)], angle=rnd()*Math.PI*2, dist=8+rnd()*42;
      const p=safeSurface(api,base.x+Math.cos(angle)*dist,base.z+Math.sin(angle)*dist,'land'); sequence++;
      if(!p||sequence>targetCount*10)break;
      const [type,name,speed,radius]=spec, flying=type==='warbler'||type==='vulture';
      game.animals.push(makeAnimal(`ambient-0230-${sequence}`,type,name,p,{speed,flying,radius,yaw:rnd()*Math.PI*2,phase:rnd()*Math.PI*2}));
    }
    const waterBases=presets.slice(0,Math.min(3,presets.length));
    for(let i=0;i<(REGION_ID==='baleares'?4:3);i++){
      const base=waterBases[i%waterBases.length], angle=rnd()*Math.PI*2, p=safeSurface(api,base.x+Math.cos(angle)*(18+rnd()*28),base.z+Math.sin(angle)*(18+rnd()*28),'water');
      if(p)game.animals.push(makeAnimal(`shark-ambient-0230-${i}`,'shark','Tintorera',p,{speed:.32,aquatic:true,radius:12,yaw:rnd()*Math.PI*2,phase:rnd()*Math.PI*2}));
    }
    const observed=Object.values(game.observed||{}).filter(Boolean).length;
    const progress=document.getElementById('waftProgress'); if(progress)progress.textContent=`${REGION_ID==='baleares'?'Baleares':'Catalunya litoral'} · fauna ${observed}/${game.animals.length} · guardados ${game.saveCount||0}`;
    toast(`Fauna regional ampliada · ${game.animals.length} animales activos`);
  }

  function updateNavigation(){
    const api=window.WAFTRegionRuntime, state=api?.getState?.(); if(!api||!state)return;
    const geo=regionalToGeo(REGION_ID,state.position.x,state.position.z), surface=api.sampleSurface(state.position.x,state.position.z);
    const verticalScale=Number(api.metadata?.terrain?.verticalScale)||.03;
    const altitude=surface?.land?Math.max(0,(surface.height||0)/verticalScale):0;
    const heading=yawToBearing(state.playerFacing), cardinal=compassName(heading);
    const line=document.getElementById('waftGeoLine'), sub=document.getElementById('waftGeoSub');
    if(line)line.textContent=`${geo.lat.toFixed(5)}° N · ${geo.lon.toFixed(5)}° E · ${Math.round(altitude)} m s.n.m.`;
    if(sub)sub.textContent=`Rumbo ${String(Math.round(heading)).padStart(3,'0')}° ${cardinal} · ${state.swimming?'NADANDO':state.movementMode==='flight'?'VOLANDO':'TIERRA'} · norte geográfico ↑`;
    const port=PORTS[REGION_ID], portGeo=regionalToGeo(REGION_ID,port.x,port.z), toPort=geoDistanceBearing(geo,portGeo), arrow=relativeArrow(toPort.bearing,heading);
    const targetGeo=REGION_ID==='baleares'?{lat:41.35,lon:2.17}:{lat:39.84,lon:3.14};
    const toTarget=geoDistanceBearing(geo,targetGeo);
    const nav=document.getElementById('waftPortNav');
    if(nav)nav.textContent=`${arrow} ${port.name} · ${toPort.distance.toFixed(toPort.distance<10?1:0)} km · ${port.targetName} ${Math.round(toTarget.distance)} km ${compassName(toTarget.bearing)}`;
    syncUtilityLabels(); updateSeaGate(api,state,heading);
  }
  function updateSeaGate(api,state,heading){
    if(crossingLocked||!state.swimming||state.worldMode!=='regional')return;
    const bounds=api.metadata?.terrain?.localBounds; if(!bounds)return;
    const margin=8;
    if(REGION_ID==='baleares'){
      if(state.position.z<=bounds.minZ+margin&&(heading>=300||heading<=30))beginSeaCrossing('catalunya-litoral',heading);
    }else{
      if(state.position.z>=bounds.maxZ-margin&&heading>=145&&heading<=225)beginSeaCrossing('baleares',heading);
    }
  }
  function beginSeaCrossing(target,bearing){
    crossingLocked=true; try{window.WAFTAdventure?.save?.();}catch{}
    try{localStorage.setItem('waft.adventure.0230.sea-arrival',JSON.stringify({target,from:REGION_ID,bearing,createdAt:Date.now()}));}catch{}
    toast(target==='catalunya-litoral'?'Mar abierto · continuando hacia Barcelona…':'Mar abierto · continuando hacia Mallorca…');
    setTimeout(()=>{const url=new URL(location.href);if(target==='baleares')url.searchParams.delete('region');else url.searchParams.set('region',target);url.searchParams.set('v',`0230-sea-${Date.now()}`);location.href=url.href;},550);
  }
  function applySeaArrival(){
    const api=window.WAFTRegionRuntime; if(!api)return;
    let pending=null; try{pending=JSON.parse(localStorage.getItem('waft.adventure.0230.sea-arrival')||'null');}catch{}
    if(!pending||pending.target!==REGION_ID||Date.now()-pending.createdAt>180000)return;
    localStorage.removeItem('waft.adventure.0230.sea-arrival');
    const arrival=SEA_ARRIVALS[REGION_ID], initial=geoToRegional(REGION_ID,arrival.lat,arrival.lon), water=safeSurface(api,initial.x,initial.z,'water')||initial;
    api.setRegionalPosition(water.x,water.z); api.setHeading(bearingToYaw(Number.isFinite(pending.bearing)?pending.bearing:arrival.bearing));
    toast(REGION_ID==='catalunya-litoral'?'Has cruzado el mar hacia Catalunya':'Has cruzado el mar hacia Baleares');
  }

  window.WAFTAnimalRenderer0230 = function(ctx){
    const {r,a,now,mounted,api,display,base,drawSphere,drawCylinderPart,M}=ctx;
    const state=api.getState?.(), pd=state?.displayPosition, dist=pd?Math.hypot(display.x-pd.x,display.z-pd.z):0;
    const small=['lizard','rabbit','weasel','salamander'].includes(a.type);
    if(!mounted && dist>(small?72:145))return;
    const detail=mounted||dist<42;
    const eye=(b,x,y,z,s=.035)=>drawSphere(r,b,x,y,z,s,s*.82,s*.70,[.012,.014,.012]);
    const leg=(b,x,z,color,h=.55,spread=.08)=>{drawCylinderPart(r,b,x,h*.50,z,spread,h,spread,color);drawSphere(r,b,x,.06,z+.04,spread*1.25,.07,.16,[.10,.09,.075]);};
    const tailSegments=(b,startY,startZ,count,step,rad0,color,curve=.04)=>{for(let i=0;i<count;i++){const t=i/Math.max(1,count-1),rr=rad0*(1-t*.72);drawSphere(r,b,Math.sin(i*.7)*curve,startY-i*.01,startZ-i*step,rr,rr*.88,step*.63,color);}};
    const quadruped=(color,sx,sy,sz,headColor=color)=>{drawSphere(r,base,0,.68,0,sx,sy,sz,color);if(detail){for(const x of[-sx*.58,sx*.58])for(const z of[-sz*.54,sz*.54])leg(base,x,z,color,Math.max(.42,sy*1.45),Math.max(.055,sx*.09));}drawSphere(r,base,0,.80,sz*.86,sx*.44,sy*.58,sz*.38,headColor);};
    switch(a.type){
      case'lizard':{const c=[.28,.47,.18],c2=[.42,.60,.25];drawSphere(r,base,0,.12,0,.13,.10,.43,c);drawSphere(r,base,0,.14,.40,.16,.12,.20,c2);tailSegments(base,.10,-.42,detail?6:3,.16,.09,c,.025);if(detail){for(const z of[-.20,.22])for(const x of[-.12,.12])drawCylinderPart(r,base,x,.09,z,.035,.23,.035,c,M.rz(x<0?-.85:.85));eye(base,-.07,.18,.52,.024);eye(base,.07,.18,.52,.024);for(const z of[-.18,.02,.20])drawSphere(r,base,0,.205,z,.035,.018,.055,[.73,.68,.23]);}break;}
      case'gineta':{const c=[.43,.39,.31];quadruped(c,.55,.30,.88,[.47,.42,.34]);drawSphere(r,base,0,.76,1.02,.27,.20,.34,[.45,.40,.32]);drawSphere(r,base,0,.70,1.27,.20,.13,.18,[.68,.61,.49]);if(detail){drawSphere(r,base,-.16,.96,.98,.09,.14,.08,[.32,.28,.23]);drawSphere(r,base,.16,.96,.98,.09,.14,.08,[.32,.28,.23]);eye(base,-.10,.84,1.23,.03);eye(base,.10,.84,1.23,.03);for(let i=0;i<7;i++){const z=-.82-i*.18,dark=i%2?[.20,.18,.16]:[.48,.43,.35];drawSphere(r,base,0,.57-i*.018,z,.12-i*.009,.105-i*.007,.18,dark);}}break;}
      case'myotragus':{quadruped([.48,.37,.24],.70,.43,1.00,[.56,.43,.28]);drawSphere(r,base,0,.89,.94,.30,.28,.38,[.58,.45,.29]);drawSphere(r,base,0,.80,1.25,.23,.17,.24,[.45,.34,.23]);if(detail){eye(base,-.11,.96,1.26,.03);eye(base,.11,.96,1.26,.03);drawCylinderPart(r,base,-.17,1.17,.91,.045,.34,.045,[.71,.65,.50],M.rz(-.38));drawCylinderPart(r,base,.17,1.17,.91,.045,.34,.045,[.71,.65,.50],M.rz(.38));drawCylinderPart(r,base,-.23,1.40,.88,.035,.22,.035,[.65,.59,.46],M.rz(-.58));drawCylinderPart(r,base,.23,1.40,.88,.035,.22,.035,[.65,.59,.46],M.rz(.58));}break;}
      case'goat':{quadruped([.55,.43,.29],.77,.44,1.06,[.65,.51,.35]);drawSphere(r,base,0,.93,.98,.31,.29,.39,[.65,.51,.35]);drawSphere(r,base,0,.84,1.31,.22,.17,.25,[.58,.44,.31]);if(detail){eye(base,-.11,1.00,1.29,.032);eye(base,.11,1.00,1.29,.032);drawCylinderPart(r,base,-.18,1.25,.92,.045,.38,.045,[.74,.68,.54],M.rz(-.42));drawCylinderPart(r,base,.18,1.25,.92,.045,.38,.045,[.74,.68,.54],M.rz(.42));drawSphere(r,base,0,.65,1.22,.08,.18,.07,[.30,.24,.19]);}break;}
      case'cow':{const c=[.70,.58,.44];quadruped(c,1.18,.64,1.48,[.64,.49,.35]);drawSphere(r,base,0,1.21,1.38,.51,.39,.48,[.63,.47,.34]);drawSphere(r,base,0,1.05,1.76,.37,.24,.28,[.79,.68,.54]);if(detail){for(const x of[-.23,.23])eye(base,x,1.34,1.66,.043);drawSphere(r,base,-.43,1.46,1.30,.15,.10,.23,[.58,.44,.32]);drawSphere(r,base,.43,1.46,1.30,.15,.10,.23,[.58,.44,.32]);drawCylinderPart(r,base,-.29,1.52,1.31,.04,.28,.04,[.76,.70,.59],M.rz(-.55));drawCylinderPart(r,base,.29,1.52,1.31,.04,.28,.04,[.76,.70,.59],M.rz(.55));drawSphere(r,base,-.55,.78,-.35,.35,.28,.43,[.26,.22,.19]);}break;}
      case'pig':{const c=[.18,.135,.12];quadruped(c,.88,.50,1.15,c);drawSphere(r,base,0,.69,1.05,.43,.34,.46,[.21,.15,.13]);drawSphere(r,base,0,.61,1.47,.28,.20,.24,[.34,.22,.20]);if(detail){eye(base,-.14,.78,1.39,.03);eye(base,.14,.78,1.39,.03);drawSphere(r,base,-.27,.94,1.05,.12,.19,.08,[.20,.14,.12]);drawSphere(r,base,.27,.94,1.05,.12,.19,.08,[.20,.14,.12]);drawSphere(r,base,-.09,.63,1.66,.035,.028,.025,[.05,.04,.035]);drawSphere(r,base,.09,.63,1.66,.035,.028,.025,[.05,.04,.035]);tailSegments(base,.75,-1.15,4,.10,.055,[.20,.14,.13],.07);}break;}
      case'rabbit':{const c=[.48,.39,.29];drawSphere(r,base,0,.34,-.05,.36,.31,.48,c);drawSphere(r,base,0,.49,.42,.27,.25,.28,[.53,.44,.33]);drawSphere(r,base,-.11,.82,.43,.075,.34,.07,[.55,.46,.35],M.rz(-.08));drawSphere(r,base,.11,.82,.43,.075,.34,.07,[.55,.46,.35],M.rz(.08));drawSphere(r,base,0,.34,-.50,.13,.13,.15,[.88,.84,.73]);if(detail){eye(base,-.10,.57,.61,.03);eye(base,.10,.57,.61,.03);drawSphere(r,base,-.25,.14,-.08,.23,.13,.30,[.45,.36,.27]);drawSphere(r,base,.25,.14,-.08,.23,.13,.30,[.45,.36,.27]);}break;}
      case'weasel':{const c=[.40,.29,.19];drawSphere(r,base,0,.22,0,.24,.18,.78,c);drawSphere(r,base,0,.28,.70,.22,.19,.29,[.44,.32,.21]);drawSphere(r,base,0,.23,.91,.14,.11,.16,[.62,.50,.34]);tailSegments(base,.19,-.70,detail?6:3,.17,.095,[.34,.24,.17],.025);if(detail){eye(base,-.075,.34,.86,.025);eye(base,.075,.34,.86,.025);for(const z of[-.30,.35])for(const x of[-.16,.16])drawCylinderPart(r,base,x,.10,z,.035,.18,.035,c,M.rz(x<0?-.65:.65));}break;}
      case'salamander':{const c=[.06,.07,.055];drawSphere(r,base,0,.075,0,.13,.07,.48,c);drawSphere(r,base,0,.095,.43,.15,.09,.20,c);tailSegments(base,.06,-.43,detail?5:3,.14,.07,c,.018);if(detail){for(const z of[-.18,.18])for(const x of[-.12,.12])drawCylinderPart(r,base,x,.055,z,.028,.17,.028,c,M.rz(x<0?-.9:.9));for(const z of[-.26,-.02,.21,.39])drawSphere(r,base,Math.sin(z*18)*.055,.14,z,.04,.022,.055,[.88,.54,.08]);eye(base,-.06,.14,.54,.018);eye(base,.06,.14,.54,.018);}break;}
      case'warbler':{const flap=Math.sin(now*.018+a.phase)*.46,c=[.34,.30,.24];drawSphere(r,base,0,.24,0,.25,.28,.47,c);drawSphere(r,base,0,.34,.44,.20,.19,.22,[.42,.37,.29]);drawSphere(r,base,0,.30,.66,.09,.075,.20,[.71,.56,.24]);drawSphere(r,base,-.34,.24,0,.43,.055,.28,[.30,.28,.23],M.rz(.22+flap));drawSphere(r,base,.34,.24,0,.43,.055,.28,[.30,.28,.23],M.rz(-.22-flap));drawSphere(r,base,0,.18,-.50,.15,.07,.34,[.28,.27,.23]);if(detail){eye(base,-.075,.41,.57,.022);eye(base,.075,.41,.57,.022);}break;}
      case'vulture':{const air=!a.landed||mounted,flap=air?Math.sin(now*.010+a.phase)*.32:.06,c=[.075,.068,.058];drawSphere(r,base,0,.40,0,.48,.44,.82,c);drawSphere(r,base,0,.61,.68,.25,.30,.27,[.23,.20,.17]);drawSphere(r,base,0,.58,.95,.20,.20,.22,[.55,.36,.21]);drawSphere(r,base,0,.55,1.18,.12,.09,.22,[.76,.58,.28]);drawSphere(r,base,-.82,.43,-.04,1.02,.075,.48,[.065,.060,.053],M.rz(.18+flap));drawSphere(r,base,.82,.43,-.04,1.02,.075,.48,[.065,.060,.053],M.rz(-.18-flap));drawSphere(r,base,0,.35,-.78,.29,.10,.48,[.055,.052,.047]);if(detail){eye(base,-.08,.68,.99,.03);eye(base,.08,.68,.99,.03);if(a.landed&&!mounted){drawCylinderPart(r,base,-.18,.15,.36,.045,.32,.045,[.45,.34,.20]);drawCylinderPart(r,base,.18,.15,.36,.045,.32,.045,[.45,.34,.20]);}}break;}
      case'shark':{const c=[.18,.36,.48];drawSphere(r,base,0,.06,0,.58,.39,1.72,c);drawSphere(r,base,0,.07,1.42,.43,.28,.55,[.16,.32,.44]);drawSphere(r,base,-.63,.02,.18,.70,.055,.82,[.14,.29,.40],M.rz(.09));drawSphere(r,base,.63,.02,.18,.70,.055,.82,[.14,.29,.40],M.rz(-.09));drawSphere(r,base,0,.42,-.20,.11,.48,.27,[.13,.28,.39],M.rx(.14));drawSphere(r,base,0,.05,-1.63,.18,.15,.62,c);drawSphere(r,base,-.34,.07,-2.02,.38,.055,.32,[.14,.29,.40],M.rz(.33));drawSphere(r,base,.34,.07,-2.02,.38,.055,.32,[.14,.29,.40],M.rz(-.33));if(detail){eye(base,-.24,.18,1.53,.034);eye(base,.24,.18,1.53,.034);for(const x of[-.36,.36])for(let i=0;i<3;i++)drawSphere(r,base,x,.04,1.05-i*.12,.018,.10,.018,[.06,.12,.16]);}break;}
      default:drawSphere(r,base,0,.35,0,.35,.35,.55,[.45,.40,.30]);
    }
  };

  async function init(){
    injectPlayabilityUi();
    for(let i=0;i<600;i++){
      if(window.__WAFT_ADVENTURE_0210_READY__&&window.WAFTRegionRuntime&&window.__WAFT_INTERNAL_GAME__)break;
      await wait(100);
    }
    if(!window.WAFTRegionRuntime||!window.__WAFT_INTERNAL_GAME__){console.warn('WAFT 0.23 playability patch: runtime unavailable');return;}
    densifyFauna(); applySeaArrival(); updateNavigation();
    setInterval(updateNavigation,180);
    setInterval(()=>{if(!densityApplied)densifyFauna();},1000);
    window.__WAFT_PLAYABILITY_0230_READY__=true;
    toast('WAFT 0.23 · navegación, fauna y HUD mejorados');
  }
  init().catch(error=>console.error('WAFT 0.23 playability patch failed',error));
})();
