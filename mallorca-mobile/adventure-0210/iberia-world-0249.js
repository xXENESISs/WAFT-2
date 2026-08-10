'use strict';
(async()=>{
  if(window.__WAFT_IBERIA_WORLD_0249_READY__||window.__WAFT_ADVENTURE_REGION__!=='iberia')return;
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  for(let i=0;i<600&&(!window.WAFTRegionRuntime||!window.WAFTWorldContinuity0247||!window.WAFTWorldStreaming0245);i++)await wait(40);
  const api=window.WAFTRegionRuntime,continuity=window.WAFTWorldContinuity0247,stream=window.WAFTWorldStreaming0245;
  if(!api||!continuity||!stream)throw new Error('WAFT 0.24.9 UI runtime unavailable');

  const fmt=n=>Number(n||0).toLocaleString('es-ES');
  const VERTICAL=Number(api.metadata?.terrain?.verticalScale)||.013594;
  const UPK=Number(api.metadata?.projection?.unitsPerKm)||1.45;
  const hud=document.getElementById('hud');
  const hudTitle=document.getElementById('hudTitle');
  const originalNearest=document.getElementById('nearest');
  const presets=document.getElementById('presets');
  const oldFrance=document.getElementById('waftFranceBadge0246');
  const oldRegion=document.getElementById('waftRegionBadge0247');

  const style=document.createElement('style');
  style.id='waftWorldUi0249Style';
  style.textContent=`
    #waftFranceBadge0246,#waftRegionBadge0247,#presets,#placesGuide{display:none!important}
    #nearest{display:none!important}
    #waftNearest0249{font-size:11px;line-height:1.35;color:#d9e2df;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #waftWorldLabels0249{position:fixed;inset:0;z-index:18;pointer-events:none;overflow:hidden}
    .waftPlace0249{position:absolute;display:none;transform:translate(-50%,-100%);text-align:center;filter:drop-shadow(0 2px 4px #000c);will-change:left,top,transform}
    .waftPlace0249.visible{display:block}
    .waftPlace0249 .pin{width:7px;height:7px;margin:0 auto 2px;border-radius:50%;background:#e8c66d;border:1px solid #fff7d8;box-shadow:0 0 0 2px #07161daa}
    .waftPlace0249 .card{min-width:66px;max-width:130px;padding:3px 6px 4px;border-radius:8px;background:rgba(5,17,23,.84);border:1px solid rgba(232,198,109,.42);backdrop-filter:blur(3px)}
    .waftPlace0249 b{display:block;color:#fff4d0;font:900 8px/1.08 system-ui,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .waftPlace0249 small{display:block;margin-top:2px;color:#d5dfda;font:800 6.6px/1 system-ui,sans-serif;white-space:nowrap}
    .waftPlace0249 small .skull{color:#f0c1a8;margin-left:2px}
    .waftPlace0249.large .pin{width:9px;height:9px;background:#f1d47f}.waftPlace0249.large b{font-size:9px}.waftPlace0249.large .card{border-color:rgba(241,212,127,.64)}
    .waftPlace0249.medium b{font-size:8.5px}
    @media(max-width:700px){#waftNearest0249{font-size:9px}.waftPlace0249 .card{min-width:58px;max-width:112px;padding:2px 5px 3px}.waftPlace0249 b{font-size:7px}.waftPlace0249.medium b{font-size:7.5px}.waftPlace0249.large b{font-size:8px}.waftPlace0249 small{font-size:6px}}
  `;
  document.head.appendChild(style);
  if(presets)presets.setAttribute('aria-hidden','true');
  if(oldFrance)oldFrance.hidden=true;
  if(oldRegion)oldRegion.hidden=true;

  const nearest=document.createElement('div');
  nearest.id='waftNearest0249';
  if(originalNearest?.parentNode)originalNearest.parentNode.insertBefore(nearest,originalNearest.nextSibling);else hud?.appendChild(nearest);

  const labelRoot=document.createElement('div');
  labelRoot.id='waftWorldLabels0249';
  document.body.appendChild(labelRoot);
  const labelPool=[];
  const ensureLabel=index=>{
    while(labelPool.length<=index){
      const el=document.createElement('div');
      el.className='waftPlace0249';
      el.innerHTML='<div class="pin"></div><div class="card"><b></b><small></small></div>';
      labelRoot.appendChild(el);labelPool.push(el);
    }
    return labelPool[index];
  };

  const geoFromWorld=(x,z)=>continuity.geoFromWorld(Number(x),Number(z));
  const getProvider=state=>typeof window.WAFT_WORLD_ATLAS_PROVIDER==='function'?window.WAFT_WORLD_ATLAS_PROVIDER({api,state,defaultItems:[]}):null;
  const itemWorld=item=>item?._world||item?.local||null;
  const itemPopulation=item=>Number(item?.population||item?.tags?.population)||0;
  const itemTier=item=>item?.populationTier||(itemPopulation(item)>=250000?'large':itemPopulation(item)>=80000?'medium':'small');
  const radiusFor=item=>{const p=itemPopulation(item);return p>=500000?260:p>=200000?220:p>=80000?175:130;};
  const overlaps=(a,b)=>!(a.r<b.l||a.l>b.r||a.b<b.t||a.t>b.b);

  function worldToScreen(regionalX,worldY,regionalZ,state){
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

  const desiredHud=state=>{
    if(!state?.position)return'PENÍNSULA IBÉRICA · EXPLORACIÓN 0.24.9';
    const g=geoFromWorld(state.position.x,state.position.z);
    if(continuity.inCanarias?.(g))return'CANARIAS · MUNDO CONTINUO';
    if(continuity.inFrance?.(g))return'FRANCE · MONDE CONTINU';
    return'PENÍNSULA IBÉRICA · EXPLORACIÓN 0.24.9';
  };
  const normalizeVersionText=()=>{
    for(const el of document.querySelectorAll('div,span,p,b,small')){
      if(el.children.length)continue;
      const text=el.textContent||'';
      if(/^EXPEDICIÓN\s*·\s*0\.24\.[0-8]$/i.test(text.trim()))el.textContent='EXPEDICIÓN · 0.24.9';
      else if(/Península Ibérica\s*·\s*EXPLORACIÓN\s+0\.24\.[0-8]/i.test(text))el.textContent=text.replace(/0\.24\.[0-8]/g,'0.24.9');
    }
  };
  let guarding=false;
  const enforceHud=()=>{
    if(guarding)return;
    const state=api.getState?.();if(!state)return;
    const wanted=desiredHud(state);
    guarding=true;
    if(hudTitle&&hudTitle.textContent!==wanted)hudTitle.textContent=wanted;
    if(oldFrance)oldFrance.hidden=true;if(oldRegion)oldRegion.hidden=true;
    normalizeVersionText();
    guarding=false;
  };
  const observer=hudTitle?new MutationObserver(()=>queueMicrotask(enforceHud)):null;
  observer?.observe(hudTitle,{childList:true,subtree:true,characterData:true});

  const reservedUiRects=()=>{
    const out=[];
    for(const el of document.body.children){
      if(el===labelRoot||el.tagName==='CANVAS')continue;
      const cs=getComputedStyle(el);if(cs.position!=='fixed'||cs.display==='none'||cs.visibility==='hidden'||Number(cs.opacity||1)<.08||cs.pointerEvents==='none')continue;
      const r=el.getBoundingClientRect();if(r.width<4||r.height<4)continue;
      // Do not let a transparent full-screen helper reserve the whole viewport.
      if(r.width>innerWidth*.92&&r.height>innerHeight*.92)continue;
      const pad=8;out.push({l:r.left-pad,r:r.right+pad,t:r.top-pad,b:r.bottom+pad,id:el.id||el.className||el.tagName});
    }
    return out;
  };

  let lastCandidates=[],lastCandidateAt=0,lastSourceTitle='';
  const refreshCandidates=(state,now)=>{
    if(now-lastCandidateAt<140&&lastCandidates.length)return lastCandidates;
    lastCandidateAt=now;
    const supplied=getProvider(state),items=Array.isArray(supplied?.items)?supplied.items:[];lastSourceTitle=supplied?.title||'';
    const pos=state.position;
    lastCandidates=items.map(item=>{const w=itemWorld(item);if(!w||!Number.isFinite(Number(w.x))||!Number.isFinite(Number(w.z)))return null;const d=Math.hypot(Number(w.x)-pos.x,Number(w.z)-pos.z);return{item,w:{x:Number(w.x),z:Number(w.z)},d};}).filter(Boolean).sort((a,b)=>a.d-b.d);
    return lastCandidates;
  };

  function updateNearest(state,candidates){
    const best=candidates[0];
    if(!best){nearest.textContent='';return;}
    const km=best.d/UPK;
    nearest.textContent=`Cerca: ${best.item.name} · ${km<10?km.toFixed(1):Math.round(km)} km · ${fmt(itemPopulation(best.item))} hab ☠️`;
  }

  function updateLabels(now){
    const state=api.getState?.();
    if(!state?.position){for(const el of labelPool)el.classList.remove('visible');requestAnimationFrame(updateLabels);return;}
    enforceHud();
    const candidates=refreshCandidates(state,now);updateNearest(state,candidates);
    const eligible=candidates.filter(c=>c.d<=radiusFor(c.item)).slice(0,24);
    const occupied=reservedUiRects();let shown=0;
    for(const c of eligible){
      const surface=api.sampleSurface?.(c.w.x,c.w.z);const fallback=(Number(c.item?.local?.y)||0)*VERTICAL;
      const y=(Number.isFinite(surface?.height)?surface.height:fallback)+1.35;
      const p=worldToScreen(c.w.x,y,c.w.z,state);if(!p||p.x<-90||p.x>innerWidth+90||p.y<-60||p.y>innerHeight+80)continue;
      if(api.isAdventureVisible?.(c.w.x,y,c.w.z)===false&&c.d>18)continue;
      const tier=itemTier(c.item),wide=tier==='large'?122:tier==='medium'?106:94,high=30;
      const rect={l:p.x-wide*.5,r:p.x+wide*.5,t:p.y-high,b:p.y};
      if(occupied.some(o=>overlaps(rect,o)))continue;
      occupied.push(rect);
      const el=ensureLabel(shown++);el.className=`waftPlace0249 ${tier} visible`;
      el.querySelector('b').textContent=c.item.name||'Núcleo';
      el.querySelector('small').innerHTML=`${fmt(itemPopulation(c.item))} hab <span class="skull">☠️</span>`;
      el.style.left=`${p.x}px`;el.style.top=`${p.y}px`;const scale=Math.max(.72,Math.min(1.08,9/Math.sqrt(Math.max(1,p.depth))));el.style.transform=`translate(-50%,-100%) scale(${scale})`;
    }
    for(let i=shown;i<labelPool.length;i++)labelPool[i].classList.remove('visible');
    window.__WAFT_WORLD_LABELS_0249_LAST__={shown,eligible:eligible.length,source:lastSourceTitle,nearest:candidates[0]?.item?.name||null,reservedUi:occupied.length-shown};
    requestAnimationFrame(updateLabels);
  }

  enforceHud();requestAnimationFrame(updateLabels);
  window.WAFTWorldUi0249={
    version:'0.24.9',
    getState:()=>({...(window.__WAFT_WORLD_LABELS_0249_LAST__||{}),hud:hudTitle?.textContent||'',presetsHidden:getComputedStyle(presets||document.body).display==='none',oldFranceHidden:!oldFrance||getComputedStyle(oldFrance).display==='none',oldRegionHidden:!oldRegion||getComputedStyle(oldRegion).display==='none'}),
    refresh:()=>{lastCandidateAt=0;enforceHud();}
  };
  window.__WAFT_IBERIA_WORLD_0249_READY__=true;
})().catch(e=>{console.error('WAFT 0.24.9 UI failed',e);window.__WAFT_IBERIA_WORLD_0249_ERROR__=String(e?.message||e);});