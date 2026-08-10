'use strict';
(async()=>{
  if(window.__WAFT_IBERIA_WORLD_0246_READY__||window.__WAFT_ADVENTURE_REGION__!=='iberia')return;
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  for(let i=0;i<500&&(!window.WAFTRegionRuntime||!window.WAFTWorldStreaming0245);i++)await wait(40);
  const api=window.WAFTRegionRuntime,plugin=window.WAFTAdventurePlugin,stream=window.WAFTWorldStreaming0245;
  if(!api||!plugin||!stream)throw new Error('WAFT 0.24.6 runtime unavailable');

  const style=document.createElement('style');
  style.textContent=`#waftSpecialMarkers{display:none!important}#waftDive0246{position:fixed;right:max(142px,calc(env(safe-area-inset-right) + 142px));bottom:max(42px,calc(env(safe-area-inset-bottom) + 42px));z-index:45;width:92px;height:54px;border-radius:16px;border:2px solid #ffcf67;background:rgba(70,25,18,.91);color:#fff4d5;font:950 12px system-ui;box-shadow:0 8px 22px #0009;touch-action:none;user-select:none}#waftDive0246.active{transform:scale(.96);background:#8d2e20}#waftDive0246[hidden]{display:none!important}#waftFranceBadge0246{position:fixed;left:50%;top:max(12px,env(safe-area-inset-top));transform:translateX(-50%);z-index:42;padding:8px 13px;border-radius:13px;border:1px solid rgba(244,207,107,.58);background:rgba(9,27,34,.88);color:#ffe6a0;font:900 11px system-ui;letter-spacing:.055em;box-shadow:0 8px 25px #0008;pointer-events:none}#waftFranceBadge0246[hidden]{display:none!important}`;
  document.head.appendChild(style);
  const dive=document.createElement('button');dive.id='waftDive0246';dive.type='button';dive.textContent='PICADO ↓';dive.hidden=true;document.body.appendChild(dive);
  const franceBadge=document.createElement('div');franceBadge.id='waftFranceBadge0246';franceBadge.hidden=true;franceBadge.textContent='FRANCE · TERRAIN CONTINU';document.body.appendChild(franceBadge);
  const isBird=()=>window.__WAFT_INTERNAL_GAME__?.mountedAnimalId==='iberia-bearded-vulture';
  const setDive=value=>{dive.classList.toggle('active',value);if(value&&isBird())api.setAdventureModifiers?.({flight:true,mountType:'vulture',flightDive:true});else api.setAdventureModifiers?.({flightDive:false});};
  dive.addEventListener('pointerdown',e=>{e.preventDefault();try{dive.setPointerCapture?.(e.pointerId);}catch{}setDive(true);});
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])dive.addEventListener(ev,()=>setDive(false));
  addEventListener('keydown',e=>{if((e.code==='ControlLeft'||e.code==='KeyC')&&!e.repeat)setDive(true);});
  addEventListener('keyup',e=>{if(e.code==='ControlLeft'||e.code==='KeyC')setDive(false);});

  const canvas=document.querySelector('canvas'),gl=canvas?.getContext('webgl2');
  if(!gl)throw new Error('WebGL2 unavailable for 0.24.6 world layer');
  const compile=(type,src)=>{const sh=gl.createShader(type);gl.shaderSource(sh,src);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh)||'world shader');return sh;};
  const vs=compile(gl.VERTEX_SHADER,`#version 300 es\nlayout(location=0)in vec3 aP;layout(location=1)in vec3 aC;uniform mat4 uPV;uniform vec3 uO;out vec3 vC;void main(){vC=aC;gl_Position=uPV*vec4(aP+uO,1.0);}`);
  const fs=compile(gl.FRAGMENT_SHADER,`#version 300 es\nprecision highp float;in vec3 vC;out vec4 o;void main(){o=vec4(vC,1.0);}`);
  const prog=gl.createProgram();gl.attachShader(prog,vs);gl.attachShader(prog,fs);gl.linkProgram(prog);gl.deleteShader(vs);gl.deleteShader(fs);
  if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(prog)||'world program');
  const uPV=gl.getUniformLocation(prog,'uPV'),uO=gl.getUniformLocation(prog,'uO');
  const verts=[],inds=[];let vc=0;
  const reset=()=>{verts.length=0;inds.length=0;vc=0;};
  const tri=(a,b,c,col)=>{for(const p of [a,b,c])verts.push(...p,...col);inds.push(vc,vc+1,vc+2);vc+=3;};
  const box=(cx,cy,cz,sx,sy,sz,col)=>{const x=sx/2,y=sy/2,z=sz/2,p=[[cx-x,cy-y,cz-z],[cx+x,cy-y,cz-z],[cx+x,cy+y,cz-z],[cx-x,cy+y,cz-z],[cx-x,cy-y,cz+z],[cx+x,cy-y,cz+z],[cx+x,cy+y,cz+z],[cx-x,cy+y,cz+z]],f=[[0,1,2],[0,2,3],[4,6,5],[4,7,6],[0,4,5],[0,5,1],[3,2,6],[3,6,7],[1,5,6],[1,6,2],[0,3,7],[0,7,4]];for(const q of f)tri(p[q[0]],p[q[1]],p[q[2]],col);};
  const ridge=(sx,sy,sz,col)=>{const p=[[-sx/2,0,-sz/2],[sx/2,0,-sz/2],[sx/2,0,sz/2],[-sx/2,0,sz/2],[-sx*.18,sy,-sz*.22],[sx*.28,sy*.74,sz*.12]];for(const q of [[0,1,4],[1,5,4],[1,2,5],[2,3,5],[3,4,5],[3,0,4],[0,3,2],[0,2,1]])tri(p[q[0]],p[q[1]],p[q[2]],col);};
  const finish=()=>{const vao=gl.createVertexArray();gl.bindVertexArray(vao);const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(verts),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(inds),gl.STATIC_DRAW);gl.bindVertexArray(null);return{vao,count:inds.length,buffers:[vb,ib]};};
  const buildLandmark=kind=>{reset();if(kind==='gibraltar'){ridge(8.0,4.7,3.2,[.34,.33,.29]);ridge(5.5,2.9,3.8,[.43,.41,.35]);}else if(kind==='peniscola'){ridge(3.8,1.1,3.2,[.46,.40,.30]);box(0,1.55,0,2.6,1.8,2.2,[.63,.56,.43]);for(const [x,z]of[[-1.05,-.85],[1.05,-.85],[-1.05,.85],[1.05,.85]])box(x,2.65,z,.62,1.5,.62,[.70,.64,.50]);}else{ridge(3.5,1.25,3.1,[.35,.34,.29]);for(const [x,z]of[[-1.05,-.7],[0,-.75],[1.05,-.35],[-.7,.75],[.75,.7]]){box(x,1.02,z,.72,.85,.68,[.66,.53,.38]);tri([x-.36,1.45,z-.34],[x+.36,1.45,z-.34],[x,1.9,z],[.40,.20,.12]);tri([x-.36,1.45,z+.34],[x,1.9,z],[x+.36,1.45,z+.34],[.40,.20,.12]);}}return finish();};
  const meshes={gibraltar:buildLandmark('gibraltar'),peniscola:buildLandmark('peniscola'),ayodar:buildLandmark('ayodar')};

  let landmarks=[],franceCitiesMesh=null,franceCityCount=0;
  try{
    const [iberiaData,franceObjects]=await Promise.all([
      fetch(new URL('../../regions/iberia/settlements.json',location.href),{cache:'no-store'}).then(r=>r.json()),
      fetch(new URL('../../regions/france/objects.json',location.href),{cache:'no-store'}).then(r=>r.json())
    ]);
    const want=new Map([['Gibraltar','gibraltar'],['Peñíscola','peniscola'],['Ayódar','ayodar']]);
    landmarks=(iberiaData.items||[]).filter(x=>want.has(x.name)).map(x=>({kind:want.get(x.name),x:x.local.x,z:x.local.z,y:(Number(x.local.y)||0)*.013594+.08,name:x.name}));
    reset();
    const vertical=Number(api.metadata?.terrain?.verticalScale)||.013594;
    for(const city of franceObjects.items||[]){
      const lat=Number(city.position?.lat),lon=Number(city.position?.lon);if(!Number.isFinite(lat)||!Number.isFinite(lon))continue;
      const p=stream.worldFromGeo(lat,lon),pop=Number(city.tags?.population)||0,tier=pop>=250000?3:pop>=100000?2:pop>=50000?1:0;
      const w=[.28,.38,.50,.68][tier],h=Math.max(.25,Math.min(1.15,(Number(city.heightMeters)||18)*vertical)),base=(Number(city.local?.y)||0)*vertical;
      const col=tier>=2?[.92,.69,.25]:tier===1?[.82,.62,.25]:[.70,.55,.25];box(p.x,base+h*.5+.025,p.z,w,h,w,col);franceCityCount++;
    }
    if(franceCityCount)franceCitiesMesh=finish();
  }catch(e){console.error(e);}

  const drawMesh=(m,pv,ox=0,oy=0,oz=0)=>{if(!m?.vao)return;gl.uniform3f(uO,ox,oy,oz);gl.bindVertexArray(m.vao);gl.drawElements(gl.TRIANGLES,m.count,gl.UNSIGNED_INT,0);};
  const prev=plugin.afterWorldDraw?.bind(plugin);
  plugin.afterWorldDraw=(now,eye,pv)=>{
    prev?.(now,eye,pv);gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.useProgram(prog);gl.uniformMatrix4fv(uPV,false,pv);
    for(const l of landmarks)drawMesh(meshes[l.kind],pv,l.x,l.y,l.z);
    const ss=stream.getState?.();if(franceCitiesMesh&&ss?.prefetched&&Number(ss.geo?.lat)>42.62)drawMesh(franceCitiesMesh,pv,0,0,0);
    gl.bindVertexArray(null);
  };

  const hudTitle=document.getElementById('hudTitle'),originalHudTitle=hudTitle?.textContent||'';
  setInterval(()=>{
    const mounted=isBird();dive.hidden=!mounted;if(!mounted)setDive(false);
    const s=stream.getState?.(),inFrance=s?.activeRegion==='france'||Number(s?.geo?.lat)>42.78;
    franceBadge.hidden=!inFrance;if(inFrance)franceBadge.textContent=`FRANCE · ${franceCityCount||461} VILLES · TERRAIN CONTINU`;
    if(hudTitle){if(inFrance)hudTitle.textContent='FRANCE 001 · MONDE CONTINU';else if(hudTitle.textContent==='FRANCE 001 · MONDE CONTINU')hudTitle.textContent=originalHudTitle;}
  },120);

  window.WAFTIberiaWorld0246={version:'0.24.6',landmarks:()=>landmarks.map(x=>x.name),landmarkData:()=>landmarks.map(x=>({...x})),franceCityCount:()=>franceCityCount,diveButton:dive,setDive};
  window.__WAFT_IBERIA_WORLD_0246_READY__=true;
})().catch(e=>{console.error('WAFT 0.24.6 failed',e);window.__WAFT_IBERIA_WORLD_0246_ERROR__=String(e?.message||e);});
