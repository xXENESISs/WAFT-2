'use strict';
(async()=>{
  if(window.__WAFT_IBERIA_WORLD_0246_READY__||window.__WAFT_ADVENTURE_REGION__!=='iberia')return;
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  for(let i=0;i<750&&(!window.WAFTRegionRuntime||!window.WAFTWorldStreaming0245||(window.__WAFT_EUROPE_ATLAS_0252_ACTIVE__&&!window.WAFTEuropeAtlas0252?.getState?.().ready));i++)await wait(40);
  const api=window.WAFTRegionRuntime,plugin=window.WAFTAdventurePlugin,stream=window.WAFTWorldStreaming0245;
  if(!api||!plugin||!stream)throw new Error('WAFT 0.25.3 runtime unavailable');

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
  if(!gl)throw new Error('WebGL2 unavailable for 0.25.3 world layer');
  const compile=(type,src)=>{const sh=gl.createShader(type);gl.shaderSource(sh,src);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh)||'world shader');return sh;};
  const vs=compile(gl.VERTEX_SHADER,`#version 300 es\nlayout(location=0)in vec3 aP;layout(location=1)in vec3 aC;uniform mat4 uPV;uniform vec3 uO;out vec3 vC;void main(){vC=aC;gl_Position=uPV*vec4(aP+uO,1.0);}`);
  const fs=compile(gl.FRAGMENT_SHADER,`#version 300 es\nprecision highp float;in vec3 vC;out vec4 o;void main(){o=vec4(vC,1.0);}`);
  const prog=gl.createProgram();gl.attachShader(prog,vs);gl.attachShader(prog,fs);gl.linkProgram(prog);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(prog)||'world program');
  const uPV=gl.getUniformLocation(prog,'uPV'),uO=gl.getUniformLocation(prog,'uO');
  const verts=[],inds=[];let vc=0;
  const reset=()=>{verts.length=0;inds.length=0;vc=0;};
  const tri=(a,b,c,col)=>{for(const p of [a,b,c])verts.push(...p,...col);inds.push(vc,vc+1,vc+2);vc+=3;};
  const box=(cx,cy,cz,sx,sy,sz,col)=>{const x=sx/2,y=sy/2,z=sz/2,p=[[cx-x,cy-y,cz-z],[cx+x,cy-y,cz-z],[cx+x,cy+y,cz-z],[cx-x,cy+y,cz-z],[cx-x,cy-y,cz+z],[cx+x,cy-y,cz+z],[cx+x,cy+y,cz+z],[cx-x,cy+y,cz+z]],f=[[0,1,2],[0,2,3],[4,6,5],[4,7,6],[0,4,5],[0,5,1],[3,2,6],[3,6,7],[1,5,6],[1,6,2],[0,3,7],[0,7,4]];for(const q of f)tri(p[q[0]],p[q[1]],p[q[2]],col);};
  const rock=(cx,cy,cz,sx,sy,sz,col,lean=.12)=>{const bx=sx/2,bz=sz/2,tx=bx*.48,tz=bz*.48,topY=cy+sy,dx=sx*lean,p=[[cx-bx,cy,cz-bz],[cx+bx,cy,cz-bz],[cx+bx,cy,cz+bz],[cx-bx,cy,cz+bz],[cx+dx-tx,topY,cz-tz],[cx+dx+tx,topY,cz-tz],[cx+dx+tx,topY,cz+tz],[cx+dx-tx,topY,cz+tz]],f=[[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7],[4,5,6],[4,6,7],[0,3,2],[0,2,1]];for(const q of f)tri(p[q[0]],p[q[1]],p[q[2]],col);};
  const roof=(cx,cy,cz,sx,sy,sz,col)=>{const x=sx/2,z=sz/2,p=[[cx-x,cy,cz-z],[cx+x,cy,cz-z],[cx+x,cy,cz+z],[cx-x,cy,cz+z],[cx,cy+sy,cz-z],[cx,cy+sy,cz+z]],f=[[0,1,4],[3,5,2],[0,4,5],[0,5,3],[1,2,5],[1,5,4]];for(const q of f)tri(p[q[0]],p[q[1]],p[q[2]],col);};
  const finish=()=>{const vao=gl.createVertexArray();gl.bindVertexArray(vao);const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(verts),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(inds),gl.STATIC_DRAW);gl.bindVertexArray(null);return{vao,count:inds.length,buffers:[vb,ib]};};
  const buildLandmark=kind=>{
    reset();
    if(kind==='gibraltar'){
      rock(0,0,0,7.2,.48,2.9,[.30,.30,.28],.02);
      rock(-.15,.18,0,6.45,4.15,2.35,[.43,.41,.36],.08);
      rock(1.7,.24,.12,2.35,2.1,2.15,[.35,.35,.32],-.03);
    }else if(kind==='peniscola'){
      rock(0,0,0,3.5,.72,3.0,[.43,.39,.32],.02);box(0,1.2,0,2.0,1.35,1.65,[.64,.57,.45]);box(0,1.95,0,2.35,.22,1.95,[.72,.65,.51]);
      for(const [x,z]of[[-.9,-.72],[.9,-.72],[-.9,.72],[.9,.72]]){box(x,1.72,z,.48,1.55,.48,[.70,.63,.49]);box(x,2.52,z,.62,.12,.62,[.77,.70,.55]);}
      box(0,.92,-1.05,2.65,.58,.18,[.67,.60,.47]);box(0,.92,1.05,2.65,.58,.18,[.67,.60,.47]);
    }else{
      rock(0,0,0,3.8,.62,3.1,[.37,.35,.29],-.03);
      const homes=[[-1.1,-.65,.62,.70],[-.3,-.9,.58,.66],[.55,-.72,.66,.72],[1.1,-.18,.54,.62],[-.82,.42,.64,.70],[.05,.35,.72,.76],[.88,.62,.60,.66],[-.25,1.02,.52,.60]];
      for(const [x,z,w,h]of homes){box(x,.62+h*.5,z,w,h,w*.82,[.66,.53,.38]);roof(x,.62+h,z,w*1.1,.38,w*.95,[.42,.22,.13]);}
      box(-1.45,.77,.65,.16,.55,1.5,[.72,.64,.49]);
    }
    return finish();
  };
  const meshes={gibraltar:buildLandmark('gibraltar'),peniscola:buildLandmark('peniscola'),ayodar:buildLandmark('ayodar')};

  const footprintSize=city=>{
    const pts=(city.footprint||[]).filter(p=>Array.isArray(p)&&Number.isFinite(Number(p[0]))&&Number.isFinite(Number(p[1])));if(!pts.length)return{w:.28,d:.28};
    let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;for(const p of pts){minX=Math.min(minX,Number(p[0]));maxX=Math.max(maxX,Number(p[0]));minZ=Math.min(minZ,Number(p[1]));maxZ=Math.max(maxZ,Number(p[1]));}
    return{w:Math.max(.08,Math.min(2.8,maxX-minX)),d:Math.max(.08,Math.min(2.8,maxZ-minZ))};
  };
  let landmarks=[],franceCitiesMesh=null,franceCityCount=0;
  try{
    const [iberiaData,franceObjects]=await Promise.all([fetch(new URL('../../regions/iberia/settlements.json',location.href),{cache:'no-store'}).then(r=>r.json()),fetch(new URL('../../regions/france/objects.json',location.href),{cache:'no-store'}).then(r=>r.json())]);
    const want=new Map([['Gibraltar','gibraltar'],['Peñíscola','peniscola'],['Ayódar','ayodar']]);
    landmarks=(iberiaData.items||[]).filter(x=>want.has(x.name)).map(x=>{const px=Number(x.local.x),pz=Number(x.local.z),surface=api.sampleSurface?.(px,pz),fallback=(Number(x.local.y)||0)*.013594;return{kind:want.get(x.name),x:px,z:pz,y:Number.isFinite(surface?.height)?surface.height+.03:fallback+.03,name:x.name};});
    reset();const vertical=Number(api.metadata?.terrain?.verticalScale)||.013594;
    for(const city of (window.__WAFT_EUROPE_ATLAS_0252_ACTIVE__?[]:(franceObjects.items||[]))){
      const lat=Number(city.position?.lat),lon=Number(city.position?.lon);if(!Number.isFinite(lat)||!Number.isFinite(lon))continue;
      const p=stream.worldFromGeo(lat,lon),pop=Number(city.tags?.population)||0,tier=pop>=250000?3:pop>=100000?2:pop>=50000?1:0,size=footprintSize(city),h=Math.max(.25,Math.min(1.25,(Number(city.heightMeters)||18)*vertical)),base=(Number(city.local?.y)||0)*vertical,col=tier>=2?[.92,.69,.25]:tier===1?[.82,.62,.25]:[.70,.55,.25];
      box(p.x,base+h*.5+.025,p.z,size.w,h,size.d,col);franceCityCount++;
    }
    if(franceCityCount)franceCitiesMesh=finish();
  }catch(e){console.error(e);}

  const drawMesh=(m,ox=0,oy=0,oz=0)=>{if(!m?.vao)return;gl.uniform3f(uO,ox,oy,oz);gl.bindVertexArray(m.vao);gl.drawElements(gl.TRIANGLES,m.count,gl.UNSIGNED_INT,0);};
  const prev=plugin.afterWorldDraw?.bind(plugin);
  plugin.afterWorldDraw=(now,eye,pv)=>{
    prev?.(now,eye,pv);gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.useProgram(prog);gl.uniformMatrix4fv(uPV,false,pv);
    const pos=api.getState?.()?.position;
    for(const l of landmarks){const near=pos&&Math.hypot(pos.x-l.x,pos.z-l.z)<35;if(near)gl.disable(gl.DEPTH_TEST);drawMesh(meshes[l.kind],l.x,l.y,l.z);if(near)gl.enable(gl.DEPTH_TEST);}
    const ss=stream.getState?.(),nearFrance=stream.nearFrance?.(ss?.geo,.55)??false;if(franceCitiesMesh&&ss?.prefetched&&nearFrance)drawMesh(franceCitiesMesh);gl.bindVertexArray(null);
  };

  const hudTitle=document.getElementById('hudTitle'),originalHudTitle=hudTitle?.textContent||'';
  const refreshHint=()=>{for(const el of document.querySelectorAll('div,span,p')){if(el.children.length===0&&/mantén el joystick abajo en vuelo para entrar en picado/i.test(el.textContent||''))el.textContent='Explora Iberia · ALETEAR para subir · PICADO ↓ para descender rápido.';}};
  refreshHint();
  setInterval(()=>{const mounted=isBird();dive.hidden=!mounted;if(!mounted)setDive(false);const s=stream.getState?.(),inFrance=stream.inFranceGeo?.(s?.geo)??s?.activeRegion==='france';franceBadge.hidden=!inFrance;if(inFrance)franceBadge.textContent=`FRANCE · ${franceCityCount||461} VILLES · TERRAIN CONTINU`;if(hudTitle){if(inFrance)hudTitle.textContent='FRANCE 001 · MONDE CONTINU';else if(hudTitle.textContent==='FRANCE 001 · MONDE CONTINU')hudTitle.textContent=originalHudTitle;}refreshHint();},220);

  window.WAFTIberiaWorld0246={version:'0.24.8-hotfix',landmarks:()=>landmarks.map(x=>x.name),landmarkData:()=>landmarks.map(x=>({...x})),franceCityCount:()=>franceCityCount,diveButton:dive,setDive};
  window.__WAFT_IBERIA_WORLD_0246_READY__=true;
})().catch(e=>{console.error('WAFT 0.25.3 failed',e);window.__WAFT_IBERIA_WORLD_0246_ERROR__=String(e?.message||e);});
