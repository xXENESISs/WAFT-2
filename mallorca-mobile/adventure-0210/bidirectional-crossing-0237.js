'use strict';
(() => {
  const REGION_ID=window.__WAFT_ADVENTURE_REGION__||'baleares';
  const TARGET_MALLORCA={lat:39.852,lon:3.1399999,name:"Port d'Alcúdia"};
  const STORAGE_ARRIVAL='waft.adventure.0230.sea-arrival';
  const STORAGE_SEA='waft.adventure.0235.sea-continuity';
  const STORAGE_AIR='waft.adventure.0236.air-continuity';
  const PROJECTION={origin:{lat:41.525,lon:2.15},kmPerDegreeLat:111.132,kmPerDegreeLon:83.34155778169932,unitsPerKm:3.2};
  const crossing={active:false,mode:null,startDistance:Infinity,bestDistance:Infinity,travelKm:0,lastGeo:null,loading:false,lastTickAt:0};
  const rad=v=>v*Math.PI/180,deg=v=>v*180/Math.PI,norm=v=>(v%360+360)%360;
  const angleDifference=(a,b)=>Math.abs(((a-b+540)%360)-180);
  const yawToBearing=yaw=>norm(180-deg(yaw||0));
  const compassName=bearing=>['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSO','SO','OSO','O','ONO','NO','NNO'][Math.round(norm(bearing)/22.5)%16];

  function regionalToGeo(x,z){return{lat:PROJECTION.origin.lat-z/PROJECTION.unitsPerKm/PROJECTION.kmPerDegreeLat,lon:PROJECTION.origin.lon+x/PROJECTION.unitsPerKm/PROJECTION.kmPerDegreeLon};}
  function geoDistanceBearing(a,b){
    const R=6371.0088,p1=rad(a.lat),p2=rad(b.lat),dp=rad(b.lat-a.lat),dl=rad(b.lon-a.lon);
    const h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
    const distance=2*R*Math.asin(Math.min(1,Math.sqrt(h)));
    const y=Math.sin(dl)*Math.cos(p2),x=Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl);
    return{distance,bearing:norm(deg(Math.atan2(y,x)))};
  }
  function mountedAnimal(){
    const game=window.__WAFT_INTERNAL_GAME__;return game?.animals?.find?.(item=>item.id===game.mountedAnimalId)||null;
  }
  function mountedType(state){return state?.adventureMountType||mountedAnimal()?.type||null;}
  function travelMode(state){
    if(state?.worldMode!=='regional')return null;
    if(state.movementMode==='flight'||mountedType(state)==='vulture')return'air';
    const surface=window.WAFTRegionRuntime?.sampleSurface?.(state.position.x,state.position.z);
    if(Boolean(surface?.water)&&Boolean(state.swimming||mountedType(state)==='shark'))return'sea';
    return null;
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
  function reset(){crossing.active=false;crossing.mode=null;crossing.startDistance=Infinity;crossing.bestDistance=Infinity;crossing.travelKm=0;crossing.lastGeo=null;}
  function routeEnabled(){const button=document.getElementById('waftBarcelonaRoute');return !button||button.classList.contains('active');}
  function setHud(text){const nav=document.getElementById('waftMallorcaNav');if(nav)nav.textContent=text;}
  function installReturnUi(){
    if(REGION_ID!=='catalunya-litoral'||document.getElementById('waftReturn0237Style'))return;
    const style=document.createElement('style');style.id='waftReturn0237Style';style.textContent=`
      body.waft-bcn-route #waftBcnNav{display:none!important}
      #waftMallorcaNav{display:none;position:fixed;z-index:36;left:50%;top:max(57px,calc(env(safe-area-inset-top) + 57px));transform:translateX(-50%);max-width:min(590px,64vw);padding:7px 12px;border-radius:999px;background:rgba(7,29,34,.94);border:1px solid rgba(231,189,99,.58);box-shadow:0 6px 20px #0008;color:#ffe5a0;font-size:10px;font-weight:950;letter-spacing:.025em;pointer-events:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      body.waft-bcn-route #waftMallorcaNav{display:block}
      @media (orientation:landscape) and (max-height:650px){#waftMallorcaNav{top:max(29px,calc(env(safe-area-inset-top) + 29px));max-width:46vw;padding:4px 8px;border-radius:9px;font-size:7.5px;box-shadow:0 4px 13px #0006}}
    `;document.head.appendChild(style);
    const nav=document.createElement('div');nav.id='waftMallorcaNav';nav.textContent='Mallorca · calculando rumbo…';document.body.appendChild(nav);
    const button=document.getElementById('waftBarcelonaRoute');if(button){button.textContent=button.classList.contains('active')?'MLL ✓':'MLL';button.setAttribute('aria-label','Ruta a Mallorca');const observer=new MutationObserver(()=>{button.textContent=button.classList.contains('active')?'MLL ✓':'MLL';});observer.observe(button,{attributes:true,attributeFilter:['class']});}
  }
  function setLoading(mode){
    const loading=document.getElementById('waftSeaLoading');if(!loading)return;
    loading.innerHTML=mode==='air'
      ?'<div><b>CORREDOR AÉREO CATALUNYA → BALEARES</b><span>El vuelo continúa sobre el Mediterráneo…<br>conservando buitre, rumbo y velocidad de viaje.</span></div>'
      :'<div><b>MEDITERRANI OCCIDENTAL → MAR BALEAR</b><span>La travesía continúa hacia Mallorca…<br>conservando rumbo, velocidad y montura.</span></div>';
    loading.classList.add('visible');
  }
  function beginReturn(api,state,bearing,mode){
    if(crossing.loading)return;crossing.loading=true;
    const createdAt=Date.now(),mountType=mountedType(state),boost=Boolean(state?.boost),speed=Math.max(0,Number(state?.adventureCurrentSpeed)||0),altitude=Math.max(0,Number(state?.position?.y)||0);
    try{window.WAFTAdventure?.save?.();}catch{}
    try{
      localStorage.setItem(STORAGE_ARRIVAL,JSON.stringify({target:'baleares',from:'catalunya-litoral',bearing,mode:`${mode}-corridor-0237`,createdAt}));
      if(mode==='air')localStorage.setItem(STORAGE_AIR,JSON.stringify({target:'baleares',from:'catalunya-litoral',bearing,mountType:'vulture',boost,speed,altitude,flight:true,mode:'air-corridor-0237',createdAt}));
      else localStorage.setItem(STORAGE_SEA,JSON.stringify({target:'baleares',from:'catalunya-litoral',bearing,mountType,boost,speed,mode:'sea-corridor-0237',createdAt}));
    }catch{}
    setLoading(mode);
    setTimeout(()=>{const url=new URL(location.href);url.searchParams.delete('region');url.searchParams.set('v',`0237-return-${Date.now()}`);location.href=url.href;},720);
  }
  function updateReturn(api,state){
    if(REGION_ID!=='catalunya-litoral')return;
    const geo=regionalToGeo(state.position.x,state.position.z),toMallorca=geoDistanceBearing(geo,TARGET_MALLORCA),heading=yawToBearing(state.playerFacing),mode=travelMode(state);
    if(!mode){reset();if(routeEnabled())setHud(`↙ MALLORCA · ${Math.round(toMallorca.distance)} km ${compassName(toMallorca.bearing)} · ve hasta la costa y entra al mar, o vuela`);return;}
    const surface=api.sampleSurface(state.position.x,state.position.z),overWater=Boolean(surface?.water)||surface?.inside===false;
    if(!overWater){reset();if(routeEnabled())setHud(mode==='air'?`✈ MALLORCA · ${Math.round(toMallorca.distance)} km ${compassName(toMallorca.bearing)} · vuela hacia mar abierto`:`MALLORCA · ${Math.round(toMallorca.distance)} km · busca la costa`);return;}
    if(!crossing.active||crossing.mode!==mode){crossing.active=true;crossing.mode=mode;crossing.startDistance=toMallorca.distance;crossing.bestDistance=toMallorca.distance;crossing.travelKm=0;crossing.lastGeo=geo;}
    if(crossing.lastGeo){const segment=geoDistanceBearing(crossing.lastGeo,geo).distance;if(segment<2.2)crossing.travelKm+=segment;}
    crossing.lastGeo=geo;crossing.bestDistance=Math.min(crossing.bestDistance,toMallorca.distance);
    const towardKm=Math.max(0,crossing.startDistance-crossing.bestDistance),open=openWaterToward(api,state,toMallorca.bearing),aligned=angleDifference(heading,toMallorca.bearing)<=58,progress=Math.min(1,towardKm),icon=mode==='air'?'✈':'≈';
    if(routeEnabled()){
      if(!open)setHud(`${icon} MALLORCA · ${Math.round(toMallorca.distance)} km · gana mar abierto`);
      else if(!aligned)setHud(`${icon} MALLORCA · gira hacia ${compassName(toMallorca.bearing)} · Mediterráneo`);
      else setHud(`${icon} MALLORCA · ${mode==='air'?'VUELO':'TRAVESÍA'} ${progress.toFixed(1)}/1.0 km · sigue ${compassName(toMallorca.bearing)}`);
    }
    if(!crossing.loading&&open&&aligned&&towardKm>=.65&&crossing.travelKm>=.8)beginReturn(api,state,toMallorca.bearing,mode);
  }
  function syncBalearesVultureBadge(state){
    if(REGION_ID!=='baleares'||mountedType(state)!=='vulture')return;
    const animal=mountedAnimal(),badge=document.getElementById('waftMountBadge');if(animal&&badge){badge.classList.add('visible');badge.textContent='MONTURA · '+animal.name.toUpperCase();}
  }
  async function init(){
    for(let i=0;i<400;i++){
      if(window.WAFTRegionRuntime?.getState&&window.__WAFT_ADVENTURE_0210_READY__&&window.__WAFT_INTERNAL_GAME__)break;
      await new Promise(resolve=>setTimeout(resolve,25));
    }
    const api=window.WAFTRegionRuntime;if(!api?.getState)return;
    installReturnUi();
    const tick=()=>{
      const state=api.getState?.();if(!state||crossing.loading){requestAnimationFrame(tick);return;}
      const now=performance.now();if(now-crossing.lastTickAt>=100){crossing.lastTickAt=now;updateReturn(api,state);syncBalearesVultureBadge(state);}
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    window.__WAFT_BIDIRECTIONAL_CROSSING_0237_READY__=true;
  }
  init().catch(error=>console.error('WAFT 0.23.7 bidirectional crossing failed',error));
})();
