'use strict';
(() => {
  if (window.__WAFT_ADVENTURE_REGION__ !== 'iberia') return;
  const VERSION='0.24.4';
  const PROJECTION={origin:{lat:39.775,lon:-3.125},kmPerDegreeLat:111.132,kmPerDegreeLon:85.55640544079021,unitsPerKm:1.45,verticalScale:0.013594};
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  let settlements=[];
  let atlasOpen=true;
  let lastPrefetch='';
  const specialEls=new Map();

  const fmt=n=>Number(n||0).toLocaleString('es-ES');
  const geoToRegional=(lat,lon)=>({x:(lon-PROJECTION.origin.lon)*PROJECTION.kmPerDegreeLon*PROJECTION.unitsPerKm,z:-(lat-PROJECTION.origin.lat)*PROJECTION.kmPerDegreeLat*PROJECTION.unitsPerKm});

  function injectStyle(){
    const style=document.createElement('style');
    style.textContent=`
      #waftIberiaPlaces{display:none!important}
      #waftIberiaAtlas{position:fixed;z-index:31;left:max(8px,env(safe-area-inset-left));bottom:max(8px,env(safe-area-inset-bottom));width:min(205px,43vw);max-height:45vh;border:1px solid #ffffff26;border-radius:12px;background:rgba(5,17,23,.86);backdrop-filter:blur(8px);box-shadow:0 8px 24px #0008;color:#eef5f1;overflow:hidden;font:700 9px/1.15 system-ui,sans-serif;pointer-events:auto;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
      #waftIberiaAtlas header{height:28px;padding:0 6px 0 9px;display:flex;align-items:center;justify-content:space-between;color:#e9c66f;letter-spacing:.08em;font-size:8px;border-bottom:1px solid #ffffff18}
      #waftIberiaAtlas button{width:24px;height:22px;border:0;border-radius:8px;background:#ffffff12;color:#fff;font-weight:900}
      #waftIberiaAtlas .list{padding:4px 6px 6px;display:grid;gap:2px}#waftIberiaAtlas.closed .list{display:none}#waftIberiaAtlas.closed{width:112px}
      .waftAtlasRow{display:grid;grid-template-columns:8px 1fr auto;column-gap:5px;row-gap:0;align-items:center;padding:3px 2px;border-radius:6px}.waftAtlasRow:first-child{background:#ffffff09}
      .waftAtlasRow i{grid-row:1/3;display:block;border-radius:2px;background:#d9c28a}.waftAtlasRow i.s{width:4px;height:4px}.waftAtlasRow i.m{width:5px;height:7px}.waftAtlasRow i.l{width:6px;height:10px;background:#f0d27e}.waftAtlasRow i.special{width:7px;height:11px;background:#e7bd63;box-shadow:0 0 7px #e7bd6366}
      .waftAtlasRow b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:8.5px}.waftAtlasRow em{font-style:normal;color:#9bb3ad;font-size:7.5px}.waftAtlasRow small{grid-column:2/4;color:#8fa8a3;font-size:6.8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.waftAtlasRow .capital{color:#f1d58d}
      #waftSpecialMarkers{position:fixed;inset:0;z-index:19;pointer-events:none;overflow:hidden}.waftWorldMark{position:absolute;transform:translate(-50%,-100%);display:none;filter:drop-shadow(0 2px 5px #000b);text-align:center}.waftWorldMark.visible{display:block}.waftWorldMark .label{margin-top:2px;padding:2px 5px;border-radius:7px;background:rgba(4,15,20,.76);border:1px solid #ffffff24;color:#fff5d4;font:800 7px system-ui;white-space:nowrap}
      .waftTreeIcon{position:relative;width:22px;height:34px}.waftTreeIcon:before,.waftTreeIcon:after{content:'';position:absolute;left:50%;transform:translateX(-50%);width:0;height:0;border-left:10px solid transparent;border-right:10px solid transparent;border-bottom:18px solid #2f7852}.waftTreeIcon:before{top:7px}.waftTreeIcon:after{top:15px;border-left-width:12px;border-right-width:12px;border-bottom-width:20px;border-bottom-color:#245f43}.waftTreeIcon .star{position:absolute;z-index:2;top:-2px;left:50%;transform:translateX(-50%);color:#ffd55e;font-size:14px;text-shadow:0 0 6px #ffd55e}.waftTreeIcon .trunk{position:absolute;bottom:0;left:9px;width:5px;height:8px;background:#714927}
      .waftCastleIcon{position:relative;width:30px;height:25px;background:#a99572;border:1px solid #e1d2ae;clip-path:polygon(0 22%,18% 22%,18% 0,34% 0,34% 22%,66% 22%,66% 0,82% 0,82% 22%,100% 22%,100% 100%,0 100%)}.waftCastleIcon:after{content:'';position:absolute;left:11px;bottom:0;width:8px;height:12px;border-radius:7px 7px 0 0;background:#34291f}
      .waftRockIcon{width:29px;height:23px;background:linear-gradient(145deg,#7d796e,#494a46);clip-path:polygon(4% 93%,18% 53%,38% 18%,67% 5%,95% 94%);border-radius:4px}
      #waftStreamHint{position:fixed;z-index:20;right:max(8px,env(safe-area-inset-right));top:max(52px,env(safe-area-inset-top));padding:3px 6px;border-radius:7px;background:rgba(5,17,23,.65);color:#8db9ad;font:700 7px system-ui;pointer-events:none;opacity:0;transition:.2s}#waftStreamHint.show{opacity:1}
      @media(max-width:700px){#waftIberiaAtlas{width:min(184px,42vw);font-size:8px;max-height:40vh}.waftAtlasRow b{font-size:7.5px}.waftAtlasRow small{font-size:6.2px}.waftWorldMark .label{font-size:6px}}
    `;
    document.head.appendChild(style);
  }

  function installAtlas(){
    const panel=document.createElement('aside');panel.id='waftIberiaAtlas';
    panel.innerHTML='<header><span>LUGARES · PRE-GUERRA</span><button type="button" aria-label="Ocultar lugares">−</button></header><div class="list"><div class="waftAtlasRow"><b>Cargando…</b></div></div>';
    document.body.appendChild(panel);
    panel.querySelector('button').addEventListener('click',()=>{atlasOpen=!atlasOpen;panel.classList.toggle('closed',!atlasOpen);panel.querySelector('button').textContent=atlasOpen?'−':'+';});
    const marks=document.createElement('div');marks.id='waftSpecialMarkers';document.body.appendChild(marks);
    const hint=document.createElement('div');hint.id='waftStreamHint';hint.textContent='PRECARGANDO REGIÓN…';document.body.appendChild(hint);
  }

  async function loadSettlements(){
    const url=new URL('../../regions/iberia/settlements.json',location.href);url.searchParams.set('v',VERSION);
    const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error(`${response.status} al cargar atlas Iberia`);
    const data=await response.json();settlements=data.items||[];
    buildSpecialMarkers();
  }

  function markerIcon(type){
    if(type==='christmas-tree')return '<div class="waftTreeIcon"><span class="star">★</span><span class="trunk"></span></div>';
    if(type==='castle')return '<div class="waftCastleIcon"></div>';
    return '<div class="waftRockIcon"></div>';
  }

  function buildSpecialMarkers(){
    const root=document.getElementById('waftSpecialMarkers');if(!root)return;
    root.innerHTML='';specialEls.clear();
    for(const item of settlements.filter(x=>x.specialMarker)){
      const el=document.createElement('div');el.className='waftWorldMark';el.dataset.id=item.id;
      el.innerHTML=markerIcon(item.specialMarker)+`<div class="label">${item.name}</div>`;root.appendChild(el);specialEls.set(item.id,el);
    }
  }

  function updateAtlas(){
    const api=window.WAFTRegionRuntime,state=api?.getState?.(),list=document.querySelector('#waftIberiaAtlas .list');
    if(!api||!state||!list||!settlements.length)return;
    const upk=api.metadata?.projection?.unitsPerKm||1.45;
    const nearest=settlements.map(item=>({item,d:Math.hypot(item.local.x-state.position.x,item.local.z-state.position.z)})).sort((a,b)=>a.d-b.d).slice(0,6);
    list.innerHTML=nearest.map(({item,d})=>{
      const special=Boolean(item.specialMarker),cls=special?'special':item.populationTier==='large'?'l':item.populationTier==='medium'?'m':'s';
      const km=d/upk,capital=Boolean(item.capitalLevel),prefix=item.specialMarker==='christmas-tree'?'🎄 ':item.specialMarker==='castle'?'🏰 ':item.specialMarker==='rock'?'⛰ ':capital?'★ ':'';
      const deaths=item.warImpact?.nuclearWarDeaths??0;
      return `<div class="waftAtlasRow"><i class="${cls}"></i><b class="${capital?'capital':''}">${prefix}${item.name}</b><em>${km<10?km.toFixed(1):Math.round(km)} km</em><small>${fmt(item.population)} hab · ☢ ${fmt(deaths)} muertos (lore)</small></div>`;
    }).join('');
  }

  function worldToScreen(regionalX,worldY,regionalZ,state,api){
    const d=api.regionalToDisplay?.(regionalX,regionalZ);if(!d||!state?.cameraEye||!state?.displayPosition)return null;
    const eye=state.cameraEye,target={x:state.displayPosition.x,y:state.position.y,z:state.displayPosition.z};
    let fx=target.x-eye.x,fy=target.y-eye.y,fz=target.z-eye.z,fl=Math.hypot(fx,fy,fz);if(fl<.001)return null;fx/=fl;fy/=fl;fz/=fl;
    let rx=-fz,ry=0,rz=fx,rl=Math.hypot(rx,rz);if(rl<.001)return null;rx/=rl;rz/=rl;
    const ux=fy*rz-fz*ry,uy=fz*rx-fx*rz,uz=fx*ry-fy*rx;
    const px=d.x-eye.x,py=worldY-eye.y,pz=d.z-eye.z,depth=px*fx+py*fy+pz*fz;if(depth<=.25)return null;
    const vx=px*rx+py*ry+pz*rz,vy=px*ux+py*uy+pz*uz;
    const h=innerHeight,w=innerWidth,f=(h*.5)/Math.tan(Math.PI/6),x=w*.5+vx*f/depth,y=h*.5-vy*f/depth;
    return{x,y,depth};
  }

  function updateSpecialMarkers(){
    const api=window.WAFTRegionRuntime,state=api?.getState?.();if(!api||!state)return;
    for(const item of settlements.filter(x=>x.specialMarker)){
      const el=specialEls.get(item.id);if(!el)continue;
      const worldY=(Number(item.local.y)||0)*PROJECTION.verticalScale+3.3;
      const p=worldToScreen(item.local.x,worldY,item.local.z,state,api);
      const regionalDistance=Math.hypot(item.local.x-state.position.x,item.local.z-state.position.z);
      const visible=Boolean(p&&p.x>-80&&p.x<innerWidth+80&&p.y>-70&&p.y<innerHeight+70&&regionalDistance<330&&api.isAdventureVisible?.(item.local.x,worldY,item.local.z)!==false);
      el.classList.toggle('visible',visible);if(!visible)continue;
      el.style.left=`${p.x}px`;el.style.top=`${p.y}px`;const scale=Math.max(.62,Math.min(1.25,8/Math.sqrt(Math.max(1,p.depth))));el.style.transform=`translate(-50%,-100%) scale(${scale})`;
    }
    requestAnimationFrame(updateSpecialMarkers);
  }

  async function prefetchAdjacent(){
    const state=window.WAFTRegionRuntime?.getState?.();if(!state)return;
    const lat=PROJECTION.origin.lat-state.position.z/(PROJECTION.kmPerDegreeLat*PROJECTION.unitsPerKm);
    const jobs=[];
    if(lat>42.2)jobs.push(['france','../../regions/france/manifest.json']);
    if(state.position.z>560)jobs.push(['canarias','../../regions/canarias/manifest.json']);
    const key=jobs.map(x=>x[0]).join(',');if(key===lastPrefetch||!jobs.length)return;lastPrefetch=key;
    const hint=document.getElementById('waftStreamHint');hint?.classList.add('show');
    await Promise.allSettled(jobs.map(async([name,path])=>{const r=await fetch(new URL(path,location.href),{cache:'force-cache'});if(r.ok)await r.arrayBuffer();window.__WAFT_STREAM_PREFETCH__=window.__WAFT_STREAM_PREFETCH__||{};window.__WAFT_STREAM_PREFETCH__[name]=r.ok;}));
    setTimeout(()=>hint?.classList.remove('show'),900);
  }

  function boostFlapInput(){
    const jump=document.getElementById('waftJump');if(!jump||jump.dataset.waft0244)return;jump.dataset.waft0244='1';
    jump.addEventListener('pointerdown',()=>{
      const game=window.__WAFT_INTERNAL_GAME__,api=window.WAFTRegionRuntime;if(game?.mountedAnimalId==='iberia-bearded-vulture'&&api?.getState?.()?.adventureFlight){api.setAdventureModifiers?.({flightFlap:12});}
    },{capture:true});
  }

  async function init(){
    injectStyle();installAtlas();
    for(let i=0;i<600;i++){if(window.__WAFT_IBERIA_POLISH_0243_READY__&&window.WAFTRegionRuntime&&window.__WAFT_INTERNAL_GAME__)break;await wait(100);}
    if(!window.WAFTRegionRuntime)throw new Error('Iberia World 0.24.4: runtime unavailable');
    boostFlapInput();await loadSettlements();updateAtlas();setInterval(updateAtlas,400);setInterval(prefetchAdjacent,1200);requestAnimationFrame(updateSpecialMarkers);
    window.WAFTIberiaWorld0244={version:VERSION,getState:()=>({settlements:settlements.length,specials:settlements.filter(x=>x.specialMarker).map(x=>x.name),prefetch:window.__WAFT_STREAM_PREFETCH__||{}})};
    window.__WAFT_IBERIA_WORLD_0244_READY__=true;
  }
  init().catch(error=>{console.error('WAFT Iberia World 0.24.4 failed',error);window.__WAFT_IBERIA_WORLD_0244_ERROR__=String(error?.message||error);});
})();
