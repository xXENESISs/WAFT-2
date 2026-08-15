'use strict';
(() => {
  if (window.__WAFT_ADVENTURE_REGION__ !== 'iberia') return;
  const BIRD_ID = 'iberia-bearded-vulture';
  const VERSION = '0.24.2';
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  let settlements = [];
  let panelOpen = true;

  function injectUi(){
    const style=document.createElement('style');
    style.textContent=`
      #down{display:none!important;pointer-events:none!important}
      #waftIberiaPlaces{position:fixed;z-index:30;left:max(8px,env(safe-area-inset-left));bottom:max(8px,env(safe-area-inset-bottom));width:min(188px,39vw);max-height:42vh;border:1px solid #ffffff26;border-radius:12px;background:rgba(5,17,23,.84);backdrop-filter:blur(8px);box-shadow:0 8px 24px #0008;color:#eef5f1;overflow:hidden;font:700 9px/1.2 system-ui,sans-serif;pointer-events:auto}
      #waftIberiaPlaces header{height:27px;padding:0 6px 0 9px;display:flex;align-items:center;justify-content:space-between;color:#e9c66f;letter-spacing:.09em;font-size:8px;border-bottom:1px solid #ffffff18}
      #waftIberiaPlaces button{width:24px;height:22px;border:0;border-radius:8px;background:#ffffff12;color:#fff;font-weight:900}
      #waftIberiaPlaces .list{padding:4px 6px 6px;display:grid;gap:2px}
      #waftIberiaPlaces.collapsed .list{display:none}#waftIberiaPlaces.collapsed{width:92px}
      .waftPlace{display:grid;grid-template-columns:7px 1fr auto;gap:5px;align-items:center;min-width:0;padding:3px 2px;border-radius:6px}
      .waftPlace:nth-child(1){background:#ffffff09}.waftPlace i{display:block;border-radius:2px;background:#d9c28a}.waftPlace i.s{width:4px;height:4px}.waftPlace i.m{width:5px;height:7px}.waftPlace i.l{width:6px;height:10px;background:#f0d27e}
      .waftPlace span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.waftPlace span.capital{color:#f1d58d}.waftPlace em{font-style:normal;color:#9bb3ad;font-size:8px}
      #waftFlightTelemetry{display:none;position:fixed;z-index:31;left:50%;top:max(9px,env(safe-area-inset-top));transform:translateX(-50%);padding:5px 9px;border-radius:999px;background:rgba(4,16,22,.78);border:1px solid #ffffff26;color:#e8d3a1;font:900 9px system-ui;letter-spacing:.08em;pointer-events:none}
      #waftFlightTelemetry.visible{display:block}#waftFlightTelemetry.dive{color:#fff0b3;border-color:#e6b95c88;box-shadow:0 0 18px #e6b95c33}
      @media(max-width:700px){#waftIberiaPlaces{width:min(166px,38vw);font-size:8px;max-height:38vh}#waftIberiaPlaces header{height:24px;font-size:7px}.waftPlace{padding:2px}.waftPlace em{font-size:7px}}
    `;
    document.head.appendChild(style);
    const panel=document.createElement('aside');
    panel.id='waftIberiaPlaces';
    panel.innerHTML='<header><span>LUGARES · 20K+</span><button type="button" aria-label="Ocultar lugares">−</button></header><div class="list"><div class="waftPlace"><span>Cargando…</span></div></div>';
    document.body.appendChild(panel);
    panel.querySelector('button').addEventListener('click',()=>{
      panelOpen=!panelOpen;panel.classList.toggle('collapsed',!panelOpen);panel.querySelector('button').textContent=panelOpen?'−':'+';
    });
    const telemetry=document.createElement('div');telemetry.id='waftFlightTelemetry';document.body.appendChild(telemetry);
  }

  async function loadSettlements(){
    const url=new URL('../../regions/iberia/settlements.json',location.href);
    url.searchParams.set('v',VERSION);
    const response=await fetch(url,{cache:'no-store'});
    if(!response.ok)throw new Error(`${response.status} al cargar núcleos de Iberia`);
    const documentData=await response.json();
    settlements=(documentData.items||[]).filter(item=>Number(item.population)>=20000);
  }

  function nearestLand(api,x,z){
    let best=null;
    for(const radius of [2.8,4.5,6.5,9,12]){
      const count=radius<3?12:24;
      for(let i=0;i<count;i++){
        const angle=i/count*Math.PI*2,px=x+Math.cos(angle)*radius,pz=z+Math.sin(angle)*radius;
        const surface=api.sampleSurface(px,pz);
        if(!surface?.inside||!surface.land)continue;
        const candidate={x:px,z:pz,y:surface.height??0};
        if(!best||candidate.y>best.y)best=candidate;
      }
      if(best&&radius>=4.5)break;
    }
    if(best)return best;
    const surface=api.sampleSurface(x,z);
    return{x,z,y:surface?.height??0};
  }

  function addBird(){
    const api=window.WAFTRegionRuntime,game=window.__WAFT_INTERNAL_GAME__;
    if(!api||!game||game.animals.some(item=>item.id===BIRD_ID))return;
    const state=api.getState();
    const perch=nearestLand(api,state.position.x,state.position.z);
    game.animals.push({
      id:BIRD_ID,type:'vulture',species:'Gypaetus barbatus',name:'Quebrantahuesos',
      x:perch.x,z:perch.z,y:perch.y,originX:perch.x,originZ:perch.z,
      yaw:state.playerFacing+Math.PI,phase:.37,speed:0,radius:5.5,
      mountable:true,aquatic:false,flying:false,flightMountReady:true,landed:true,
      mission:null,fleeing:false,fleeTime:0,hidden:false,iberiaExplorer:true
    });
  }

  function installRenderer(){
    window.WAFTAnimalRenderer0230=({r,a,now,mounted,api,base,drawSphere,drawCylinderPart,M})=>{
      if(a.id!==BIRD_ID)return;
      const state=api.getState?.();
      const airborne=mounted||a.flying||!a.landed;
      const speed=Math.min(1.4,(state?.adventureCurrentSpeed||0)/36);
      const flap=airborne?Math.sin(now*.009+a.phase)*(.18+.18*Math.max(0,1-speed)):.035;
      const oriented=mounted&&state?M.compose(base,M.rx(state.terrainPitch||0),M.rz(-(state.terrainRoll||0))):base;
      const dark=[.105,.092,.074],dark2=[.155,.132,.10],cream=[.77,.65,.48],rust=[.58,.31,.15],head=[.84,.72,.54],black=[.025,.022,.019],gold=[.80,.57,.20];
      if(window.__WAFT_PLANET_WORLD_0274_ACTIVE__){
        drawSphere(r,oriented,0,.43,0,.46,.48,.92,cream);
        drawSphere(r,oriented,0,.54,.56,.31,.34,.40,rust);
        drawSphere(r,oriented,0,.62,.91,.25,.25,.30,head);
        drawSphere(r,oriented,0,.59,1.15,.13,.10,.22,gold);
        for(const side of[-1,1]){
          drawSphere(r,oriented,side*.92,.45,-.06,1.18,.07,.50,dark,M.rz(side*(-.17-flap)));
          drawSphere(r,oriented,side*1.82,.40,-.22,.82,.045,.29,dark2,M.rz(side*(-.25-flap*.7)));
        }
        return;
      }
      drawSphere(r,oriented,0,.43,0,.46,.48,.92,cream);
      drawSphere(r,oriented,0,.54,.54,.31,.34,.38,rust);
      drawSphere(r,oriented,0,.62,.88,.25,.25,.28,head);
      drawSphere(r,oriented,0,.60,1.12,.13,.10,.23,gold);
      drawSphere(r,oriented,-.105,.68,1.00,.095,.065,.08,black);
      drawSphere(r,oriented,.105,.68,1.00,.095,.065,.08,black);
      drawSphere(r,oriented,-.085,.70,1.08,.026,.028,.023,[.005,.005,.004]);
      drawSphere(r,oriented,.085,.70,1.08,.026,.028,.023,[.005,.005,.004]);
      drawCylinderPart(r,oriented,0,.47,1.10,.035,.27,.035,black,M.rx(.36));
      const wing=(side)=>{
        const sx=side<0?-1:1;
        drawSphere(r,oriented,sx*.88,.46,-.05,1.12,.075,.52,dark,M.rz(sx*(-.16-flap)));
        drawSphere(r,oriented,sx*1.63,.43,-.15,.78,.055,.34,dark2,M.rz(sx*(-.20-flap*.85)));
        drawSphere(r,oriented,sx*2.16,.39,-.28,.55,.045,.22,dark,M.rz(sx*(-.25-flap*.65)));
        for(let i=0;i<4;i++)drawSphere(r,oriented,sx*(1.45+i*.24),.37,-.31-i*.09,.30,.035,.16,dark,M.rz(sx*(-.28-i*.035-flap*.55)));
      };
      wing(-1);wing(1);
      drawSphere(r,oriented,-.16,.32,-.98,.22,.055,.63,dark,M.rz(-.08));
      drawSphere(r,oriented,.16,.32,-.98,.22,.055,.63,dark,M.rz(.08));
      drawSphere(r,oriented,0,.30,-1.48,.12,.045,.42,dark2);
      if(!airborne){
        drawCylinderPart(r,oriented,-.17,.16,.35,.045,.34,.045,[.44,.32,.18]);
        drawCylinderPart(r,oriented,.17,.16,.35,.045,.34,.045,[.44,.32,.18]);
      }
    };
  }

  function updatePlaces(){
    const api=window.WAFTRegionRuntime,state=api?.getState?.();
    const list=document.querySelector('#waftIberiaPlaces .list');
    if(!state||!list||!settlements.length)return;
    const nearest=settlements.map(item=>({item,d:Math.hypot(item.local.x-state.position.x,item.local.z-state.position.z)})).sort((a,b)=>a.d-b.d).slice(0,6);
    list.innerHTML=nearest.map(({item,d})=>{
      const cls=item.populationTier==='large'?'l':item.populationTier==='medium'?'m':'s';
      const km=d/(api.metadata?.projection?.unitsPerKm||1.45),capital=Boolean(item.capitalLevel),prefix=capital?'★ ':'';
      return `<div class="waftPlace" title="${item.name} · ${Number(item.population).toLocaleString('es-ES')} hab."><i class="${cls}"></i><span class="${capital?'capital':''}">${prefix}${item.name}</span><em>${km<10?km.toFixed(1):Math.round(km)} km</em></div>`;
    }).join('');
  }

  function updateFlightTelemetry(){
    const state=window.WAFTRegionRuntime?.getState?.(),game=window.__WAFT_INTERNAL_GAME__,el=document.getElementById('waftFlightTelemetry');
    if(!state||!game||!el)return;
    const mounted=game.mountedAnimalId===BIRD_ID&&state.adventureFlight;
    el.classList.toggle('visible',mounted);
    if(!mounted)return;
    const dive=Boolean(state.iberiaDive||state.adventureDive)||((state.adventureCurrentSpeed||0)>42&&state.movementMode==='flight');
    el.classList.toggle('dive',dive);
    el.textContent=dive?`PICADO · ${Math.round(state.adventureCurrentSpeed||0)}`:`QUEBRANTAHUESOS · ${Math.round(state.adventureCurrentSpeed||0)}`;
  }

  async function init(){
    injectUi();installRenderer();
    for(let i=0;i<600;i++){
      if(window.__WAFT_ADVENTURE_0210_READY__&&window.WAFTRegionRuntime&&window.__WAFT_INTERNAL_GAME__)break;
      await wait(100);
    }
    if(!window.WAFTRegionRuntime||!window.__WAFT_INTERNAL_GAME__)throw new Error('Iberia Explorer: runtime unavailable');
    document.getElementById('down')?.remove();
    if(window.__WAFT_PLANET_WORLD_0274_ACTIVE__){
      addBird();document.getElementById('waftIberiaPlaces')?.remove();document.getElementById('waftFlightTelemetry')?.remove();
      window.WAFTIberiaExplorer={version:'0.27.4-light',birdId:BIRD_ID,getState:()=>({settlements:0,bird:window.__WAFT_INTERNAL_GAME__.animals.find(item=>item.id===BIRD_ID)||null,panelOpen:false}),mountBird:()=>window.WAFTAdventure?.mount?.(BIRD_ID)};
      window.__WAFT_IBERIA_EXPLORER_0242_READY__=true;return;
    }
    await loadSettlements();
    addBird();updatePlaces();updateFlightTelemetry();
    setInterval(updatePlaces,350);setInterval(updateFlightTelemetry,100);
    window.WAFTIberiaExplorer={
      version:VERSION,birdId:BIRD_ID,
      getState:()=>({settlements:settlements.length,bird:window.__WAFT_INTERNAL_GAME__.animals.find(item=>item.id===BIRD_ID)||null,panelOpen}),
      mountBird:()=>window.WAFTAdventure?.mount?.(BIRD_ID)
    };
    window.__WAFT_IBERIA_EXPLORER_0242_READY__=true;
  }
  init().catch(error=>{console.error('WAFT Iberia Explorer 0.24.2 failed',error);window.__WAFT_IBERIA_EXPLORER_0242_ERROR__=String(error?.message||error);});
})();
