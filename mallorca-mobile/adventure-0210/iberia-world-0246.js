'use strict';
(async()=>{
  if(window.__WAFT_IBERIA_WORLD_0246_READY__||window.__WAFT_ADVENTURE_REGION__!=='iberia')return;
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  for(let i=0;i<500&&!window.WAFTRegionRuntime;i++)await wait(40);
  const api=window.WAFTRegionRuntime,plugin=window.WAFTAdventurePlugin;
  if(!api||!plugin)throw new Error('WAFT 0.24.6 runtime unavailable');

  const style=document.createElement('style');
  style.textContent=`#waftSpecialMarkers{display:none!important}#waftDive0246{position:fixed;right:max(18px,env(safe-area-inset-right));bottom:max(118px,calc(env(safe-area-inset-bottom) + 118px));z-index:45;width:86px;height:52px;border-radius:16px;border:2px solid #ffcf67;background:rgba(70,25,18,.88);color:#fff4d5;font:950 12px system-ui;box-shadow:0 8px 22px #0009;touch-action:none;user-select:none}#waftDive0246.active{transform:scale(.96);background:#8d2e20}#waftDive0246[hidden]{display:none!important}`;
  document.head.appendChild(style);
  const dive=document.createElement('button');dive.id='waftDive0246';dive.type='button';dive.textContent='PICADO ↓';dive.hidden=true;document.body.appendChild(dive);
  const setDive=value=>{dive.classList.toggle('active',value);api.setAdventureModifiers?.({flightDive:value});};
  dive.addEventListener('pointerdown',e=>{e.preventDefault();dive.setPointerCapture?.(e.pointerId);setDive(true);});
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])dive.addEventListener(ev,()=>setDive(false));
  addEventListener('keydown',e=>{if((e.code==='ControlLeft'||e.code==='KeyC')&&!e.repeat)setDive(true);});
  addEventListener('keyup',e=>{if(e.code==='ControlLeft'||e.code==='KeyC')setDive(false);});
  setInterval(()=>{const s=api.getState?.(),mounted=window.__WAFT_INTERNAL_GAME__?.mountedAnimalId==='iberia-bearded-vulture';dive.hidden=!(mounted&&s?.adventureFlight);if(dive.hidden)setDive(false);},180);

  const canvas=document.querySelector('canvas'),gl=canvas?.getContext('webgl2');
  if(!gl)throw new Error('WebGL2 unavailable for 0.24.6 landmarks');
  const compile=(type,src)=>{const sh=gl.createShader(type);gl.shaderSource(sh,src);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh)||'landmark shader');return sh;};
  const vs=compile(gl.VERTEX_SHADER,`#version 300 es\nlayout(location=0)in vec3 aP;layout(location=1)in vec3 aC;uniform mat4 uPV;uniform vec3 uO;out vec3 vC;void main(){vC=aC;gl_Position=uPV*vec4(aP+uO,1.0);}`);
  const fs=compile(gl.FRAGMENT_SHADER,`#version 300 es\nprecision highp float;in vec3 vC;out vec4 o;void main(){o=vec4(vC,1.0);}`);
  const prog=gl.createProgram();gl.attachShader(prog,vs);gl.attachShader(prog,fs);gl.linkProgram(prog);gl.deleteShader(vs);gl.deleteShader(fs);
  const uPV=gl.getUniformLocation(prog,'uPV'),uO=gl.getUniformLocation(prog,'uO');
  const verts=[],inds=[];let vc=0;
  const tri=(a,b,c,col)=>{for(const p of [a,b,c])verts.push(...p,...col);inds.push(vc,vc+1,vc+2);vc+=3;};
  const box=(cx,cy,cz,sx,sy,sz,col)=>{const x=sx/2,y=sy/2,z=sz/2,p=[[cx-x,cy-y,cz-z],[cx+x,cy-y,cz-z],[cx+x,cy+y,cz-z],[cx-x,cy+y,cz-z],[cx-x,cy-y,cz+z],[cx+x,cy-y,cz+z],[cx+x,cy+y,cz+z],[cx-x,cy+y,cz+z]],f=[[0,1,2],[0,2,3],[4,6,5],[4,7,6],[0,4,5],[0,5,1],[3,2,6],[3,6,7],[1,5,6],[1,6,2],[0,3,7],[0,7,4]];for(const q of f)tri(p[q[0]],p[q[1]],p[q[2]],col);};
  const ridge=(sx,sy,sz,col)=>{const p=[[-sx/2,0,-sz/2],[sx/2,0,-sz/2],[sx/2,0,sz/2],[-sx/2,0,sz/2],[-sx*.18,sy,-sz*.22],[sx*.28,sy*.74,sz*.12]];for(const q of [[0,1,4],[1,5,4],[1,2,5],[2,3,5],[3,4,5],[3,0,4],[0,3,2],[0,2,1]])tri(p[q[0]],p[q[1]],p[q[2]],col);};
  const build=(kind)=>{verts.length=inds.length=0;vc=0;if(kind==='gibraltar'){ridge(18,9,7,[.34,.33,.29]);ridge(12,5.5,9,[.43,.41,.35]);}else if(kind==='peniscola'){ridge(10,2.2,8,[.46,.40,.30]);box(0,3.1,0,6.2,3.2,5.0,[.63,.56,.43]);for(const [x,z]of[[-2.5,-2],[2.5,-2],[-2.5,2],[2.5,2]])box(x,5.1,z,1.5,3.2,1.5,[.70,.64,.50]);}else{ridge(10,2.7,9,[.35,.34,.29]);for(const [x,z]of[[-3,-2],[0,-2],[3,-1],[-2,2],[2,2]]){box(x,2.0,z,2.0,2.0,1.8,[.66,.53,.38]);tri([x-1,3,z-.9],[x+1,3,z-.9],[x,4.0,z],[.40,.20,.12]);tri([x-1,3,z+.9],[x,4.0,z],[x+1,3,z+.9],[.40,.20,.12]);}}const vao=gl.createVertexArray();gl.bindVertexArray(vao);const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(verts),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(inds),gl.STATIC_DRAW);gl.bindVertexArray(null);return{vao,count:inds.length};};
  const meshes={gibraltar:build('gibraltar'),peniscola:build('peniscola'),ayodar:build('ayodar')};
  let landmarks=[];
  try{const r=await fetch(new URL('../../regions/iberia/settlements.json',location.href),{cache:'no-store'}),d=await r.json();const want=new Map([['Gibraltar','gibraltar'],['Peñíscola','peniscola'],['Ayódar','ayodar']]);landmarks=(d.items||[]).filter(x=>want.has(x.name)).map(x=>({kind:want.get(x.name),x:x.local.x,z:x.local.z,y:(Number(x.local.y)||0)*.013594+.08,name:x.name}));}catch(e){console.error(e);}
  const prev=plugin.afterWorldDraw?.bind(plugin);
  plugin.afterWorldDraw=(now,eye,pv)=>{prev?.(now,eye,pv);if(!landmarks.length)return;gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.useProgram(prog);gl.uniformMatrix4fv(uPV,false,pv);for(const l of landmarks){const m=meshes[l.kind];gl.uniform3f(uO,l.x,l.y,l.z);gl.bindVertexArray(m.vao);gl.drawElements(gl.TRIANGLES,m.count,gl.UNSIGNED_INT,0);}gl.bindVertexArray(null);};
  window.WAFTIberiaWorld0246={version:'0.24.6',landmarks:()=>landmarks.map(x=>x.name),diveButton:dive};
  window.__WAFT_IBERIA_WORLD_0246_READY__=true;
})().catch(e=>{console.error('WAFT 0.24.6 failed',e);window.__WAFT_IBERIA_WORLD_0246_ERROR__=String(e?.message||e);});
