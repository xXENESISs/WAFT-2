'use strict';
(() => {
  const REGION_ID = window.__WAFT_ADVENTURE_REGION__ || 'baleares';
  const TARGET_BCN = { lat: 41.3554, lon: 2.1703, name: 'Barcelona' };
  const STORAGE_ROUTE = 'waft.adventure.0234.route-bcn';
  const STORAGE_ARRIVAL = 'waft.adventure.0230.sea-arrival';
  const STORAGE_CONTINUITY = 'waft.adventure.0235.sea-continuity';
  const PROJECTIONS = {
    baleares: {
      origin: { lat: 39.6, lon: 2.9 }, kmPerDegreeLat: 111.132, kmPerDegreeLon: 85.77353418580084, unitsPerKm: 5,
      compression: .76,
      anchors: [
        { id:'mallorca', name:'Mallorca', lat:39.65, lon:2.9 }, { id:'menorca', name:'Menorca', lat:39.97, lon:4.08 },
        { id:'ibiza', name:'Ibiza', lat:38.98, lon:1.43 }, { id:'formentera', name:'Formentera', lat:38.7, lon:1.47 },
        { id:'cabrera', name:'Cabrera', lat:39.15, lon:2.95 }
      ]
    },
    'catalunya-litoral': {
      origin: { lat: 41.525, lon: 2.15 }, kmPerDegreeLat: 111.132, kmPerDegreeLon: 83.34155778169932, unitsPerKm: 3.2,
      compression: 1, anchors: []
    }
  };
  const EXTRA_PLACES = {
    baleares: [
      { id:'manual-orient', name:'Orient', place:'hamlet', position:{ lat:39.73454, lon:2.76062 } }
    ],
    'catalunya-litoral': []
  };

  const route = {
    active: readRoutePreference(),
    places: [],
    placeLoaded: false,
    lastPlaceUpdate: 0,
    lastEnteredPlace: null,
    seaActive: false,
    seaStartedAt: 0,
    seaStartDistance: Infinity,
    seaBestDistance: Infinity,
    seaWaterKm: 0,
    seaLastGeo: null,
    seaLoading: false,
    lastTickAt: 0
  };

  const rad = value => value * Math.PI / 180;
  const deg = value => value * 180 / Math.PI;
  const normDeg = value => (value % 360 + 360) % 360;
  const compassName = bearing => ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSO','SO','OSO','O','ONO','NO','NNO'][Math.round(normDeg(bearing)/22.5)%16];
  const yawToBearing = yaw => normDeg(180 - deg(yaw || 0));
  const angleDifference = (a,b) => Math.abs(((a-b+540)%360)-180);
  const relativeArrow = (target,heading) => {
    const d=((target-heading+540)%360)-180;
    if(Math.abs(d)<18)return '↑'; if(d>=18&&d<70)return '↗'; if(d>=70&&d<115)return '→'; if(d>=115&&d<162)return '↘';
    if(Math.abs(d)>=162)return '↓'; if(d<=-18&&d>-70)return '↖'; if(d<=-70&&d>-115)return '←'; return '↙';
  };

  function readRoutePreference(){
    try {
      const raw=localStorage.getItem(STORAGE_ROUTE);
      return raw===null ? true : raw==='1';
    } catch { return true; }
  }
  function saveRoutePreference(){ try{localStorage.setItem(STORAGE_ROUTE,route.active?'1':'0');}catch{} }

  function projectRaw(regionId,lat,lon){
    const p=PROJECTIONS[regionId];
    return {x:(lon-p.origin.lon)*p.kmPerDegreeLon*p.unitsPerKm,z:(p.origin.lat-lat)*p.kmPerDegreeLat*p.unitsPerKm};
  }
  function compressedAnchor(p,anchor){const raw=projectRaw('baleares',anchor.lat,anchor.lon);return{x:raw.x*p.compression,z:raw.z*p.compression,rawX:raw.x,rawZ:raw.z};}
  function closestCompressedAnchor(x,z){
    const p=PROJECTIONS.baleares;let best=null;
    for(const anchor of p.anchors){const c=compressedAnchor(p,anchor),d=Math.hypot(x-c.x,z-c.z);if(!best||d<best.d)best={anchor,c,d};}
    return best;
  }
  function regionalToGeo(regionId,x,z){
    const p=PROJECTIONS[regionId];let rawX=x,rawZ=z;
    if(regionId==='baleares'){
      const nearest=closestCompressedAnchor(x,z);
      if(nearest){rawX=x+(1-p.compression)*nearest.c.rawX;rawZ=z+(1-p.compression)*nearest.c.rawZ;}
    }
    return {lat:p.origin.lat-rawZ/p.unitsPerKm/p.kmPerDegreeLat,lon:p.origin.lon+rawX/p.unitsPerKm/p.kmPerDegreeLon};
  }
  function geoDistanceBearing(a,b){
    const R=6371.0088,p1=rad(a.lat),p2=rad(b.lat),dp=rad(b.lat-a.lat),dl=rad(b.lon-a.lon);
    const h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
    const distance=2*R*Math.asin(Math.min(1,Math.sqrt(h)));
    const y=Math.sin(dl)*Math.cos(p2),x=Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl);
    return {distance,bearing:normDeg(deg(Math.atan2(y,x)))};
  }
  function areaLabel(geo){
    if(REGION_ID!=='baleares')return 'Catalunya';
    let best=null;
    for(const anchor of PROJECTIONS.baleares.anchors){const info=geoDistanceBearing(geo,anchor);if(!best||info.distance<best.distance)best={name:anchor.name,distance:info.distance};}
    return best&&best.distance<=62?best.name:'Baleares';
  }
  function toast(text){
    const el=document.getElementById('waftToast')||document.getElementById('waftPlayToast');
    if(!el)return;
    el.textContent=text;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),2600);
  }

  function installUi(){
    if(document.getElementById('waftNavigation0234Style'))return;
    const style=document.createElement('style');
    style.id='waftNavigation0234Style';
    style.textContent=`
      #waftPlaceHud{margin-top:2px;color:#cbdad6;font-size:9px;font-weight:850;line-height:1.12;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #waftBcnNav{display:none;position:fixed;z-index:35;left:50%;top:max(57px,calc(env(safe-area-inset-top) + 57px));transform:translateX(-50%);max-width:min(560px,62vw);padding:7px 12px;border-radius:999px;background:rgba(7,29,34,.94);border:1px solid rgba(231,189,99,.58);box-shadow:0 6px 20px #0008;color:#ffe5a0;font-size:10px;font-weight:950;letter-spacing:.025em;pointer-events:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      body.waft-bcn-route #waftBcnNav{display:block}body.waft-bcn-route #waftPortNav{display:none!important}
      #waftSeaLoading{display:none;position:fixed;z-index:90;inset:0;background:radial-gradient(circle at 50% 40%,rgba(18,78,96,.94),rgba(2,18,27,.985) 72%);place-items:center;text-align:center;padding:28px;color:#fff}
      #waftSeaLoading.visible{display:grid}#waftSeaLoading b{display:block;color:#f1ca72;font-size:clamp(22px,4vw,38px);letter-spacing:.12em}#waftSeaLoading span{display:block;margin-top:9px;color:#cfe8e5;font-size:12px;font-weight:800;line-height:1.45}
      #waftBarcelonaRoute.active{background:#80672f!important;color:#fff7e4!important}
      @media (orientation:landscape) and (max-height:650px){#waftPlaceHud{font-size:7.2px;margin-top:1px}#waftBcnNav{top:max(29px,calc(env(safe-area-inset-top) + 29px));max-width:43vw;padding:4px 8px;border-radius:9px;font-size:7.5px;box-shadow:0 4px 13px #0006}body.waft-bcn-route #waftPortNav{display:none!important}}
    `;
    document.head.appendChild(style);

    const hud=document.getElementById('hud');
    if(hud&&!document.getElementById('waftPlaceHud')){
      const place=document.createElement('div');place.id='waftPlaceHud';place.textContent='Localizando población…';
      const title=document.getElementById('hudTitle');if(title?.nextSibling)hud.insertBefore(place,title.nextSibling);else hud.appendChild(place);
    }
    if(!document.getElementById('waftBcnNav')){
      const nav=document.createElement('div');nav.id='waftBcnNav';nav.textContent='Barcelona · calculando rumbo…';document.body.appendChild(nav);
    }
    if(!document.getElementById('waftSeaLoading')){
      const loading=document.createElement('div');loading.id='waftSeaLoading';loading.innerHTML='<div><b>MAR BALEAR → MEDITERRANI OCCIDENTAL</b><span>La ruta continúa en mar abierto…<br>conservando rumbo y estado de la expedición.</span></div>';document.body.appendChild(loading);
    }
    const top=document.getElementById('waftTopActions');
    if(top&&!document.getElementById('waftBarcelonaRoute')){
      const button=document.createElement('button');button.id='waftBarcelonaRoute';button.type='button';button.textContent='BCN';button.setAttribute('aria-pressed',String(route.active));top.appendChild(button);
      button.addEventListener('click',()=>{route.active=!route.active;saveRoutePreference();syncRouteUi();});
    }
    syncRouteUi();
  }

  function syncRouteUi(){
    document.body.classList.toggle('waft-bcn-route',route.active);
    const button=document.getElementById('waftBarcelonaRoute');if(button){button.classList.toggle('active',route.active);button.setAttribute('aria-pressed',String(route.active));button.textContent=route.active?'BCN ✓':'BCN';}
  }

  async function loadPlaces(){
    try{
      const url=new URL(`../../regions/${REGION_ID}/settlements.json`,location.href);
      const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error(String(response.status));
      const data=await response.json();const items=Array.isArray(data?.items)?data.items:[];
      route.places=items.filter(item=>item?.name&&Number.isFinite(Number(item?.position?.lat))&&Number.isFinite(Number(item?.position?.lon))).map(item=>({name:item.name,place:item.place||'settlement',position:{lat:Number(item.position.lat),lon:Number(item.position.lon)}}));
    }catch(error){console.warn('WAFT 0.23.5 settlements unavailable',error);route.places=[];}
    for(const extra of EXTRA_PLACES[REGION_ID]||[]){if(!route.places.some(item=>item.name===extra.name))route.places.push(extra);}
    route.placeLoaded=true;
  }

  function updatePlace(geo){
    const el=document.getElementById('waftPlaceHud');if(!el)return;
    if(!route.placeLoaded){el.textContent='Localizando población…';return;}
    let best=null;
    for(const place of route.places){const info=geoDistanceBearing(geo,place.position);if(!best||info.distance<best.distance)best={...place,...info};}
    const area=areaLabel(geo);
    if(!best){el.textContent=area;return;}
    if(best.distance<.9)el.textContent=`${best.name.toUpperCase()} · ${area}`;
    else if(best.distance<8)el.textContent=`Cerca de ${best.name} · ${best.distance.toFixed(1)} km · ${area}`;
    else el.textContent=`${best.name} · ${Math.round(best.distance)} km ${compassName(best.bearing)} · ${area}`;
    if(best.distance<1.15&&route.lastEnteredPlace!==best.name){route.lastEnteredPlace=best.name;toast(`${best.name.toUpperCase()} · ${area}`);}
    else if(best.distance>=2&&route.lastEnteredPlace===best.name)route.lastEnteredPlace=null;
  }

  function openWaterToward(api,state,bearing){
    const a=rad(bearing),dx=Math.sin(a),dz=-Math.cos(a);let open=0;
    for(const distance of [3,6,10,15]){
      const sample=api.sampleSurface(state.position.x+dx*distance,state.position.z+dz*distance);
      if(!sample?.inside){open++;continue;}
      if(!sample.water)return false;
      open++;
    }
    return open>=3;
  }

  function resetSea(){
    route.seaActive=false;route.seaStartedAt=0;route.seaStartDistance=Infinity;route.seaBestDistance=Infinity;route.seaWaterKm=0;route.seaLastGeo=null;
  }

  function updateSeaCrossing(api,state,geo,heading,toBcn){
    const surface=api.sampleSurface(state.position.x,state.position.z);
    const inWater=state.worldMode==='regional'&&Boolean(surface?.water)&&Boolean(state.swimming||state.adventureMountType==='shark');
    if(!inWater){resetSea();return {inWater:false,open:false,progress:0};}
    if(!route.seaActive){route.seaActive=true;route.seaStartedAt=performance.now();route.seaStartDistance=toBcn.distance;route.seaBestDistance=toBcn.distance;route.seaWaterKm=0;route.seaLastGeo=geo;}
    if(route.seaLastGeo){const segment=geoDistanceBearing(route.seaLastGeo,geo).distance;if(segment<2.2)route.seaWaterKm+=segment;}
    route.seaLastGeo=geo;route.seaBestDistance=Math.min(route.seaBestDistance,toBcn.distance);
    const towardKm=Math.max(0,route.seaStartDistance-route.seaBestDistance);
    const open=openWaterToward(api,state,toBcn.bearing),aligned=angleDifference(heading,toBcn.bearing)<=58;
    const elapsed=performance.now()-route.seaStartedAt;
    const progress=Math.min(1,towardKm);
    if(!route.seaLoading&&REGION_ID==='baleares'&&open&&aligned&&towardKm>=.65&&route.seaWaterKm>=.8){beginBarcelonaCrossing(api,state,toBcn.bearing);}
    return {inWater:true,open,aligned,progress,towardKm,waterKm:route.seaWaterKm,elapsed};
  }

  function mountedType(state){
    if(state?.adventureMountType)return state.adventureMountType;
    const game=window.__WAFT_INTERNAL_GAME__,mounted=game?.animals?.find?.(item=>item.id===game.mountedAnimalId);
    return mounted?.type||null;
  }

  function beginBarcelonaCrossing(api,state,bearing){
    if(route.seaLoading)return;route.seaLoading=true;
    const createdAt=Date.now(),mountType=mountedType(state),boost=Boolean(state?.boost),speed=Math.max(0,Number(state?.adventureCurrentSpeed)||0);
    try{window.WAFTAdventure?.save?.();}catch{}
    try{
      localStorage.setItem(STORAGE_ARRIVAL,JSON.stringify({target:'catalunya-litoral',from:'baleares',bearing,mode:'corridor-0235',createdAt}));
      localStorage.setItem(STORAGE_CONTINUITY,JSON.stringify({target:'catalunya-litoral',from:'baleares',bearing,mountType,boost,speed,mode:'corridor-0235',createdAt}));
    }catch{}
    document.getElementById('waftSeaLoading')?.classList.add('visible');
    setTimeout(()=>{
      const url=new URL(location.href);url.searchParams.set('region','catalunya-litoral');url.searchParams.set('v',`0235-bcn-${Date.now()}`);location.href=url.href;
    },720);
  }

  async function restoreCrossingContinuity(api){
    let pending=null;
    try{pending=JSON.parse(localStorage.getItem(STORAGE_CONTINUITY)||'null');}catch{}
    if(!pending||pending.target!==REGION_ID||Date.now()-Number(pending.createdAt||0)>180000)return;
    for(let i=0;i<120;i++){
      let arrivalPending=false;try{arrivalPending=Boolean(localStorage.getItem(STORAGE_ARRIVAL));}catch{}
      if(!arrivalPending)break;
      await new Promise(resolve=>setTimeout(resolve,25));
    }
    const game=window.__WAFT_INTERNAL_GAME__,state=api?.getState?.();
    if(!game||!state)return;
    const boost=Boolean(pending.boost);
    if(pending.mountType==='shark'){
      const surface=api.sampleSurface(state.position.x,state.position.z);
      const shark=game.animals?.find?.(animal=>animal.type==='shark'&&animal.mountable)||game.animals?.find?.(animal=>animal.type==='shark');
      if(shark&&surface?.water){
        game.mountedAnimalId=shark.id;shark.hidden=true;shark.x=state.position.x;shark.z=state.position.z;shark.y=(surface.waterHeight??state.position.y)-.68;shark.originX=shark.x;shark.originZ=shark.z;
        api.setAdventureModifiers?.({mountType:'shark',runSpeed:7.2,swimSpeed:18,boost,flight:false});
        const badge=document.getElementById('waftMountBadge');if(badge){badge.classList.add('visible');badge.textContent='MONTURA · TINTORERA';}
        const jump=document.getElementById('waftJump');if(jump&&window.__WAFT_INTERNAL_GAME__?.jumpPointer==null)jump.textContent='IMPULSO';
        toast('MEDITERRANI OCCIDENTAL · tintorera y rumbo conservados');
      }
    }else{
      api.setAdventureModifiers?.({boost});
      toast('MEDITERRANI OCCIDENTAL · rumbo conservado');
    }
    const boostButton=document.getElementById('boost');if(boostButton)boostButton.classList.toggle('active',boost);
    const runButton=document.getElementById('waftRun');if(runButton){runButton.classList.toggle('active',boost);runButton.textContent=boost?'CORRIENDO':'CORRER';}
    try{localStorage.removeItem(STORAGE_CONTINUITY);}catch{}
  }

  function updateNavigation(api,state,geo){
    const heading=yawToBearing(state.playerFacing),toBcn=geoDistanceBearing(geo,TARGET_BCN),arrow=relativeArrow(toBcn.bearing,heading),cardinal=compassName(toBcn.bearing);
    const nav=document.getElementById('waftBcnNav');if(!nav)return;
    if(REGION_ID==='baleares'){
      const sea=updateSeaCrossing(api,state,geo,heading,toBcn);
      if(!sea.inWater)nav.textContent=`${arrow} BARCELONA · ${Math.round(toBcn.distance)} km ${cardinal} · entra al mar para cruzar`;
      else if(!sea.open)nav.textContent=`${arrow} BARCELONA · ${Math.round(toBcn.distance)} km · bordea la costa hasta tener mar abierto`;
      else if(!sea.aligned)nav.textContent=`${arrow} BARCELONA · gira hacia ${cardinal} · mar abierto`;
      else nav.textContent=`${arrow} BARCELONA · MAR ABIERTO ${sea.progress.toFixed(1)}/1.0 km · sigue ${cardinal}`;
    }else{
      if(toBcn.distance<1.5)nav.textContent='★ BARCELONA · HAS LLEGADO';
      else nav.textContent=`${arrow} BARCELONA · ${toBcn.distance<10?toBcn.distance.toFixed(1):Math.round(toBcn.distance)} km ${cardinal} · continúa hasta la costa`;
    }
  }

  async function init(){
    for(let i=0;i<400;i++){
      if(window.WAFTRegionRuntime?.getState&&window.__WAFT_ADVENTURE_0210_READY__&&document.getElementById('hud'))break;
      await new Promise(resolve=>setTimeout(resolve,25));
    }
    if(!window.WAFTRegionRuntime?.getState)return;
    installUi();loadPlaces();
    await restoreCrossingContinuity(window.WAFTRegionRuntime);
    const tick=()=>{
      const api=window.WAFTRegionRuntime,state=api?.getState?.();if(!api||!state||route.seaLoading){requestAnimationFrame(tick);return;}
      const now=performance.now();
      if(now-route.lastTickAt>=120){
        route.lastTickAt=now;const geo=regionalToGeo(REGION_ID,state.position.x,state.position.z);
        if(now-route.lastPlaceUpdate>=450){route.lastPlaceUpdate=now;updatePlace(geo);}
        if(route.active)updateNavigation(api,state,geo);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    window.__WAFT_NAVIGATION_0234_READY__=true;
    window.__WAFT_NAVIGATION_0235_CONTINUITY_READY__=true;
  }

  init().catch(error=>console.error('WAFT 0.23.5 navigation failed',error));
})();
