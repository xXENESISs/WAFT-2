'use strict';
(() => {
  const REGION_ID=window.__WAFT_ADVENTURE_REGION__||'baleares';
  const TARGET_BCN={lat:41.3554,lon:2.1703,name:'Barcelona'};
  const STORAGE_ARRIVAL='waft.adventure.0230.sea-arrival';
  const STORAGE_AIR='waft.adventure.0236.air-continuity';
  const PROJECTIONS={
    baleares:{origin:{lat:39.6,lon:2.9},kmPerDegreeLat:111.132,kmPerDegreeLon:85.77353418580084,unitsPerKm:5,compression:.76,anchors:[
      {lat:39.65,lon:2.9},{lat:39.97,lon:4.08},{lat:38.98,lon:1.43},{lat:38.7,lon:1.47},{lat:39.15,lon:2.95}
    ]},
    'catalunya-litoral':{origin:{lat:41.525,lon:2.15},kmPerDegreeLat:111.132,kmPerDegreeLon:83.34155778169932,unitsPerKm:3.2,compression:1,anchors:[]}
  };
  const flight={active:false,startDistance:Infinity,bestDistance:Infinity,travelKm:0,lastGeo:null,loading:false,lastTickAt:0};
  const rad=v=>v*Math.PI/180,deg=v=>v*180/Math.PI,norm=v=>(v%360+360)%360;
  const angleDifference=(a,b)=>Math.abs(((a-b+540)%360)-180);
  const yawToBearing=yaw=>norm(180-deg(yaw||0));
  const compassName=bearing=>['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSO','SO','OSO','O','ONO','NO','NNO'][Math.round(norm(bearing)/22.5)%16];

  function projectRaw(regionId,lat,lon){const p=PROJECTIONS[regionId];return{x:(lon-p.origin.lon)*p.kmPerDegreeLon*p.unitsPerKm,z:(p.origin.lat-lat)*p.kmPerDegreeLat*p.unitsPerKm};}
  function regionalToGeo(regionId,x,z){
    const p=PROJECTIONS[regionId];let rawX=x,rawZ=z;
    if(regionId==='baleares'){
      let nearest=null;
      for(const anchor of p.anchors){const raw=projectRaw('baleares',anchor.lat,anchor.lon),cx=raw.x*p.compression,cz=raw.z*p.compression,d=Math.hypot(x-cx,z-cz);if(!nearest||d<nearest.d)nearest={raw,cx,cz,d};}
      if(nearest){rawX=x+(1-p.compression)*nearest.raw.x;rawZ=z+(1-p.compression)*nearest.raw.z;}
    }
    return{lat:p.origin.lat-rawZ/p.unitsPerKm/p.kmPerDegreeLat,lon:p.origin.lon+rawX/p.unitsPerKm/p.kmPerDegreeLon};
  }
  function geoDistanceBearing(a,b){
    const R=6371.0088,p1=rad(a.lat),p2=rad(b.lat),dp=rad(b.lat-a.lat),dl=rad(b.lon-a.lon);
    const h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
    const distance=2*R*Math.asin(Math.min(1,Math.sqrt(h)));
    const y=Math.sin(dl)*Math.cos(p2),x=Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl);
    return{distance,bearing:norm(deg(Math.atan2(y,x)))};
  }
  function mountedType(state){
    if(state?.adventureMountType)return state.adventureMountType;
    const game=window.__WAFT_INTERNAL_GAME__,mounted=game?.animals?.find?.(item=>item.id===game.mountedAnimalId);
    return mounted?.type||null;
  }
  function isVultureFlight(state){return state?.worldMode==='regional'&&(state.movementMode==='flight'||mountedType(state)==='vulture');}
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
  function resetFlight(){flight.active=false;flight.startDistance=Infinity;flight.bestDistance=Infinity;flight.travelKm=0;flight.lastGeo=null;}
  function setFlightHud(text){const nav=document.getElementById('waftBcnNav');if(nav)nav.textContent=text;}
  function setLoadingCopy(){
    const loading=document.getElementById('waftSeaLoading');if(!loading)return;
    loading.innerHTML='<div><b>CORREDOR AÉREO BALEAR → CATALUNYA</b><span>El vuelo continúa sobre el Mediterráneo…<br>conservando buitre, rumbo y velocidad de viaje.</span></div>';
  }

  function beginAirCrossing(api,state,bearing){
    if(flight.loading)return;flight.loading=true;
    const createdAt=Date.now(),boost=Boolean(state?.boost),speed=Math.max(0,Number(state?.adventureCurrentSpeed)||0),altitude=Math.max(0,Number(state?.position?.y)||0);
    try{window.WAFTAdventure?.save?.();}catch{}
    try{
      localStorage.setItem(STORAGE_ARRIVAL,JSON.stringify({target:'catalunya-litoral',from:'baleares',bearing,mode:'air-corridor-0236',createdAt}));
      localStorage.setItem(STORAGE_AIR,JSON.stringify({target:'catalunya-litoral',from:'baleares',bearing,mountType:'vulture',boost,speed,altitude,flight:true,mode:'air-corridor-0236',createdAt}));
    }catch{}
    setLoadingCopy();document.getElementById('waftSeaLoading')?.classList.add('visible');
    setTimeout(()=>{const url=new URL(location.href);url.searchParams.set('region','catalunya-litoral');url.searchParams.set('v',`0236-air-${Date.now()}`);location.href=url.href;},720);
  }

  function updateAirCrossing(api,state){
    if(REGION_ID!=='baleares'||!isVultureFlight(state)){resetFlight();return;}
    const geo=regionalToGeo('baleares',state.position.x,state.position.z),toBcn=geoDistanceBearing(geo,TARGET_BCN),heading=yawToBearing(state.playerFacing);
    const surface=api.sampleSurface(state.position.x,state.position.z),overWater=Boolean(surface?.water)||surface?.inside===false;
    if(!overWater){resetFlight();setFlightHud(`✈ BARCELONA · ${Math.round(toBcn.distance)} km ${compassName(toBcn.bearing)} · vuela hacia la costa`);return;}
    if(!flight.active){flight.active=true;flight.startDistance=toBcn.distance;flight.bestDistance=toBcn.distance;flight.travelKm=0;flight.lastGeo=geo;}
    if(flight.lastGeo){const segment=geoDistanceBearing(flight.lastGeo,geo).distance;if(segment<2.2)flight.travelKm+=segment;}
    flight.lastGeo=geo;flight.bestDistance=Math.min(flight.bestDistance,toBcn.distance);
    const towardKm=Math.max(0,flight.startDistance-flight.bestDistance),open=openWaterToward(api,state,toBcn.bearing),aligned=angleDifference(heading,toBcn.bearing)<=58,progress=Math.min(1,towardKm);
    if(!open)setFlightHud(`✈ BARCELONA · ${Math.round(toBcn.distance)} km · gana mar abierto`);
    else if(!aligned)setFlightHud(`✈ BARCELONA · gira hacia ${compassName(toBcn.bearing)} · vuelo sobre el mar`);
    else setFlightHud(`✈ BARCELONA · VUELO MARÍTIMO ${progress.toFixed(1)}/1.0 km · sigue ${compassName(toBcn.bearing)}`);
    if(!flight.loading&&open&&aligned&&towardKm>=.65&&flight.travelKm>=.8)beginAirCrossing(api,state,toBcn.bearing);
  }

  async function restoreAirContinuity(api){
    let pending=null;try{pending=JSON.parse(localStorage.getItem(STORAGE_AIR)||'null');}catch{}
    if(!pending||pending.target!==REGION_ID||Date.now()-Number(pending.createdAt||0)>180000)return;
    for(let i=0;i<120;i++){
      let arrivalPending=false;try{arrivalPending=Boolean(localStorage.getItem(STORAGE_ARRIVAL));}catch{}
      if(!arrivalPending)break;
      await new Promise(resolve=>setTimeout(resolve,25));
    }
    const game=window.__WAFT_INTERNAL_GAME__,state=api?.getState?.();if(!game||!state)return;
    const vulture=game.animals?.find?.(animal=>animal.type==='vulture'&&animal.mountable)||game.animals?.find?.(animal=>animal.type==='vulture');
    if(vulture){
      game.mountedAnimalId=vulture.id;vulture.hidden=true;vulture.x=state.position.x;vulture.z=state.position.z;vulture.y=state.position.y-.82;vulture.originX=vulture.x;vulture.originZ=vulture.z;
      api.setAdventureModifiers?.({mountType:'vulture',runSpeed:12.4,swimSpeed:5.2,boost:Boolean(pending.boost),flight:true,flightFlap:2.4});
      const badge=document.getElementById('waftMountBadge');if(badge){badge.classList.add('visible');badge.textContent='MONTURA · BUITRE LEONADO';}
      const jump=document.getElementById('waftJump');if(jump&&game.jumpPointer==null)jump.textContent='ALETEAR';
      const boostButton=document.getElementById('boost');if(boostButton)boostButton.classList.toggle('active',Boolean(pending.boost));
      const runButton=document.getElementById('waftRun');if(runButton){runButton.classList.toggle('active',Boolean(pending.boost));runButton.textContent=Boolean(pending.boost)?'CORRIENDO':'CORRER';}
      const toast=document.getElementById('waftToast')||document.getElementById('waftPlayToast');if(toast){toast.textContent='MEDITERRANI OCCIDENTAL · buitre y rumbo conservados';toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2600);}
    }
    try{localStorage.removeItem(STORAGE_AIR);}catch{}
  }

  async function init(){
    for(let i=0;i<400;i++){
      if(window.WAFTRegionRuntime?.getState&&window.__WAFT_ADVENTURE_0210_READY__&&window.__WAFT_INTERNAL_GAME__)break;
      await new Promise(resolve=>setTimeout(resolve,25));
    }
    const api=window.WAFTRegionRuntime;if(!api?.getState)return;
    await restoreAirContinuity(api);
    const tick=()=>{
      const state=api.getState?.();if(!state||flight.loading){requestAnimationFrame(tick);return;}
      const now=performance.now();if(now-flight.lastTickAt>=100){flight.lastTickAt=now;updateAirCrossing(api,state);}
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    window.__WAFT_MULTIMODAL_CROSSING_0236_READY__=true;
  }

  init().catch(error=>console.error('WAFT 0.23.6 multimodal crossing failed',error));
})();
