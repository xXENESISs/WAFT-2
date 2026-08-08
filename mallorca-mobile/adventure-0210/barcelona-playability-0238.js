'use strict';
(() => {
  const REGION_ID=window.__WAFT_ADVENTURE_REGION__||'baleares';
  const BARCELONA_ZONE='catalunya-litoral-barcelona-0170';
  const PROJECTION={origin:{lat:41.525,lon:2.15},kmPerDegreeLat:111.132,kmPerDegreeLon:83.34155778169932,unitsPerKm:3.2};
  const POIS=[
    {id:'port',name:'PORT DE BARCELONA',lat:41.35,lon:2.17},
    {id:'montjuic',name:'MONTJUÏC',lat:41.3631512,lon:2.1656148},
    {id:'centre',name:'CENTRE DE BARCELONA',lat:41.3851,lon:2.1734},
    {id:'cathedral',name:'CATEDRAL',lat:41.3839,lon:2.1761},
    {id:'sagrada',name:'SAGRADA FAMÍLIA',lat:41.4036,lon:2.1744}
  ];
  const ui={button:null,guide:null,lastTickAt:0,lastZoneStatus:null,notifiedAvailable:false,busy:false};
  const rad=v=>v*Math.PI/180,deg=v=>v*180/Math.PI,norm=v=>(v%360+360)%360;
  const yawToBearing=yaw=>norm(180-deg(yaw||0));
  const relativeArrow=(target,heading)=>{const d=((target-heading+540)%360)-180;if(Math.abs(d)<18)return'↑';if(d>=18&&d<70)return'↗';if(d>=70&&d<115)return'→';if(d>=115&&d<162)return'↘';if(Math.abs(d)>=162)return'↓';if(d<=-18&&d>-70)return'↖';if(d<=-70&&d>-115)return'←';return'↙';};
  function regionalToGeo(x,z){return{lat:PROJECTION.origin.lat-z/PROJECTION.unitsPerKm/PROJECTION.kmPerDegreeLat,lon:PROJECTION.origin.lon+x/PROJECTION.unitsPerKm/PROJECTION.kmPerDegreeLon};}
  function geoDistanceBearing(a,b){
    const R=6371.0088,p1=rad(a.lat),p2=rad(b.lat),dp=rad(b.lat-a.lat),dl=rad(b.lon-a.lon);
    const h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
    const distance=2*R*Math.asin(Math.min(1,Math.sqrt(h)));
    const y=Math.sin(dl)*Math.cos(p2),x=Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl);
    return{distance,bearing:norm(deg(Math.atan2(y,x)))};
  }
  function toast(text){
    const el=document.getElementById('waftToast')||document.getElementById('waftPlayToast');if(!el)return;
    el.textContent=text;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),2600);
  }
  function formatDistance(km){if(km<.095)return'AQUÍ';if(km<1)return`${Math.max(1,Math.round(km*1000))} m`;return`${km.toFixed(km<10?1:0)} km`;}
  function nearestPoi(geo){let best=null;for(const poi of POIS){const info=geoDistanceBearing(geo,poi);if(!best||info.distance<best.distance)best={...poi,...info};}return best;}
  function installUi(){
    if(REGION_ID!=='catalunya-litoral'||document.getElementById('waftBarcelona0238Style'))return;
    const style=document.createElement('style');style.id='waftBarcelona0238Style';style.textContent=`
      #waftBarcelonaGuide{display:none;margin-top:3px;color:#f3d58b;font-size:8.5px;font-weight:900;line-height:1.12;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #waftBarcelonaGuide.visible{display:block}
      #waftLocalZoneAction{display:none}
      #waftLocalZoneAction.visible{display:block}
      #waftLocalZoneAction.ready{background:#2f6d58!important;color:#fff!important;border-color:#a8efd2!important;box-shadow:0 0 0 2px rgba(115,225,184,.14),0 6px 20px #0008!important}
      #waftLocalZoneAction:disabled{opacity:.58}
      @media (orientation:landscape) and (max-height:650px){#waftBarcelonaGuide{font-size:7px;margin-top:1px}#waftLocalZoneAction{font-size:8px!important;padding:6px 7px!important}}
    `;document.head.appendChild(style);
    const geoHud=document.getElementById('waftGeoHud');if(geoHud&&!document.getElementById('waftBarcelonaGuide')){const guide=document.createElement('div');guide.id='waftBarcelonaGuide';geoHud.appendChild(guide);ui.guide=guide;}
    const top=document.getElementById('waftTopActions');if(top&&!document.getElementById('waftLocalZoneAction')){const button=document.createElement('button');button.id='waftLocalZoneAction';button.type='button';button.textContent='BCN ×5';button.addEventListener('click',toggleLocal);top.appendChild(button);ui.button=button;}
    ui.guide=ui.guide||document.getElementById('waftBarcelonaGuide');ui.button=ui.button||document.getElementById('waftLocalZoneAction');
  }
  async function toggleLocal(){
    if(ui.busy)return;const api=window.WAFTRegionRuntime,state=api?.getState?.();if(!api||!state)return;
    try{
      ui.busy=true;if(ui.button){ui.button.disabled=true;ui.button.textContent='CARGANDO…';}
      if(state.worldMode==='local')api.exitLocal?.();
      else if(state.localProximityZoneId===BARCELONA_ZONE&&state.localProximityStatus==='available')await api.enterLocal?.(BARCELONA_ZONE);
    }catch(error){console.error('WAFT 0.23.8 Barcelona local transition failed',error);toast('No se pudo cambiar la escala de Barcelona');}
    finally{ui.busy=false;}
  }
  function updateZoneUi(state){
    const button=ui.button;if(!button)return;
    const inBarcelonaLocal=state.worldMode==='local'&&state.localZoneId===BARCELONA_ZONE;
    const tracksBarcelona=state.worldMode==='regional'&&state.localProximityZoneId===BARCELONA_ZONE;
    const available=tracksBarcelona&&state.localProximityStatus==='available';
    const nearby=tracksBarcelona&&state.localProximityStatus==='nearby';
    button.classList.toggle('visible',inBarcelonaLocal||available||nearby);
    button.classList.toggle('ready',available||inBarcelonaLocal);
    if(ui.busy)return;
    if(inBarcelonaLocal){button.disabled=false;button.textContent='SALIR BCN';}
    else if(available){button.disabled=false;button.textContent='ENTRAR BCN ×5';}
    else if(nearby){button.disabled=true;button.textContent=`BCN ${Math.max(0,Number(state.localProximityDistance)||0).toFixed(1)}`;}
    else{button.disabled=true;button.textContent='BCN ×5';}
    const status=inBarcelonaLocal?'local':available?'available':nearby?'nearby':'outside';
    if(status==='available'&&!ui.notifiedAvailable){ui.notifiedAvailable=true;toast('BARCELONA · zona urbana densa disponible');}
    if(status==='outside')ui.notifiedAvailable=false;
    ui.lastZoneStatus=status;
  }
  function updateGuide(state){
    const guide=ui.guide;if(!guide)return;
    if(state.worldMode==='local'&&state.localZoneId===BARCELONA_ZONE){
      const buildings=Number(state.localCounts?.buildings)||560,scale=Number(state.worldScale)||5.2;
      guide.textContent=`BARCELONA · ZONA URBANA ×${scale.toFixed(1)} · ${buildings} EDIFICIOS`;guide.classList.add('visible');return;
    }
    if(state.worldMode!=='regional'){guide.classList.remove('visible');return;}
    const geo=regionalToGeo(state.position.x,state.position.z),centre=geoDistanceBearing(geo,POIS[2]);
    if(centre.distance>28&&state.localProximityZoneId!==BARCELONA_ZONE){guide.classList.remove('visible');return;}
    const poi=nearestPoi(geo),arrow=relativeArrow(poi.bearing,yawToBearing(state.playerFacing));
    guide.textContent=`◈ ${poi.name} · ${formatDistance(poi.distance)}${poi.distance>=.095?' '+arrow:''}${state.localProximityStatus==='available'&&state.localProximityZoneId===BARCELONA_ZONE?' · BCN ×5':''}`;
    guide.classList.add('visible');
  }
  async function init(){
    if(REGION_ID!=='catalunya-litoral'){window.__WAFT_BARCELONA_PLAYABILITY_0238_READY__=true;return;}
    for(let i=0;i<400;i++){
      if(window.WAFTRegionRuntime?.getState&&window.__WAFT_ADVENTURE_0210_READY__&&window.__WAFT_INTERNAL_GAME__)break;
      await new Promise(resolve=>setTimeout(resolve,25));
    }
    const api=window.WAFTRegionRuntime;if(!api?.getState)return;
    installUi();
    const tick=()=>{
      const state=api.getState?.();if(!state){requestAnimationFrame(tick);return;}
      const now=performance.now();if(now-ui.lastTickAt>=140){ui.lastTickAt=now;updateZoneUi(state);updateGuide(state);}
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    window.__WAFT_BARCELONA_PLAYABILITY_0238_READY__=true;
  }
  init().catch(error=>console.error('WAFT 0.23.8 Barcelona playability failed',error));
})();
