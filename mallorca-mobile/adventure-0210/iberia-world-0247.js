'use strict';
(async()=>{
  if(window.__WAFT_IBERIA_WORLD_0247_READY__||window.__WAFT_ADVENTURE_REGION__!=='iberia')return;
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  for(let i=0;i<600&&(!window.WAFTRegionRuntime||!window.WAFTWorldStreaming0245||!window.__WAFT_IBERIA_WORLD_0246_READY__);i++)await wait(40);
  const api=window.WAFTRegionRuntime,stream=window.WAFTWorldStreaming0245,plugin=window.WAFTAdventurePlugin;
  if(!api||!stream||!plugin)throw new Error('WAFT 0.24.8 hotfix runtime unavailable');

  const VERTICAL=Number(api.metadata?.terrain?.verticalScale)||.013594;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const geoFromWorld=(x,z)=>stream.geoFromWorld(Number(x),Number(z));
  const worldFromGeo=(lat,lon)=>stream.worldFromGeo(Number(lat),Number(lon));
  const inFrance=geo=>stream.inFranceGeo?stream.inFranceGeo(geo):Boolean(geo&&geo.lat>=42.9);
  const deepFrance=geo=>inFrance(geo)&&geo.lat>=(stream.franceSouthLat?.(geo.lon)??42.9)+1.10;
  const inCanarias=geo=>Boolean(geo&&geo.lat>=27.25&&geo.lat<=29.85&&geo.lon>=-19.25&&geo.lon<=-13.15);
  const deepCanarias=geo=>inCanarias(geo)&&geo.lat<=29.45;

  document.getElementById('waftCityLabels0247')?.remove();
  for(const el of document.querySelectorAll('.waftCity0247'))el.remove();
  const style=document.createElement('style');
  style.textContent=`
    #waftCityLabels0247,.waftCity0247{display:none!important}
    #waftRegionBadge0247{position:fixed;left:50%;top:max(12px,env(safe-area-inset-top));transform:translateX(-50%);z-index:44;padding:7px 11px;border-radius:12px;border:1px solid rgba(244,207,107,.48);background:rgba(9,27,34,.84);color:#ffe6a0;font:900 10px system-ui;letter-spacing:.045em;box-shadow:0 7px 20px #0007;pointer-events:none}
    #waftRegionBadge0247[hidden]{display:none!important}
  `;
  document.head.appendChild(style);
  const regionBadge=document.createElement('div');regionBadge.id='waftRegionBadge0247';regionBadge.hidden=true;document.body.appendChild(regionBadge);

  const canvas=document.querySelector('canvas'),gl=canvas?.getContext('webgl2');
  if(!gl)throw new Error('WebGL2 unavailable for Canarias 0.24.8');
  let canTerrain=null,canCover=null,canManifest=null,canMesh=null,canPrefetch=null,canDrawFrames=0,atlanticMesh=null,atlanticDrawFrames=0;
  let canariasReleased=false;
  const palette=[[.026,.17,.30],[.73,.61,.35],[.42,.43,.41],[.31,.47,.19],[.055,.29,.12],[.50,.53,.20],[.45,.44,.40],[.16,.39,.28],[.49,.40,.29],[.38,.56,.20]];
  const compile=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)||'Canarias shader');return s;};
  const vs=compile(gl.VERTEX_SHADER,`#version 300 es\nlayout(location=0)in vec3 aP;layout(location=1)in vec3 aC;uniform mat4 uPV;uniform float uV;out vec3 vC;void main(){vC=aC;gl_Position=uPV*vec4(aP.x,aP.y*uV,aP.z,1.0);}`);
  const fs=compile(gl.FRAGMENT_SHADER,`#version 300 es\nprecision highp float;in vec3 vC;out vec4 o;void main(){o=vec4(vC,1.0);}`);
  const canProgram=gl.createProgram();gl.attachShader(canProgram,vs);gl.attachShader(canProgram,fs);gl.linkProgram(canProgram);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(canProgram,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(canProgram)||'Canarias program');
  const canPV=gl.getUniformLocation(canProgram,'uPV'),canV=gl.getUniformLocation(canProgram,'uV');

  const atlanticEastLon=lat=>lat>=35?-5.05-(35.45-lat)*2.0:lat>=33?-5.95-(35-lat)*1.25:lat>=31?-8.45-(33-lat)*1.3:-11.05-(31-lat)*1.15;
  const buildAtlanticMesh=()=>{
    const lats=[35.45,35,33,31,29.35,27.25],pos=[],col=[],ind=[],water=[.026,.17,.30];
    for(const lat of lats)for(const lon of [-19.6,atlanticEastLon(lat)]){const w=worldFromGeo(lat,lon);pos.push(w.x,-7.75,w.z);col.push(...water);}
    for(let r=0;r<lats.length-1;r++){const a=r*2,b=a+1,c=a+2,d=a+3;ind.push(a,c,b,b,c,d);}
    const vao=gl.createVertexArray();gl.bindVertexArray(vao);const pb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,pb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(pos),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);const cb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,cb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(col),gl.STATIC_DRAW);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,0,0);const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(ind),gl.STATIC_DRAW);gl.bindVertexArray(null);return{vao,count:ind.length,triangles:ind.length/3,buffers:[pb,cb,ib]};
  };
  atlanticMesh=null; // WAFT 0.25.0: no artificial Atlantic corridor geometry

  const parseTerrain=buffer=>{const v=new DataView(buffer),magic=new TextDecoder().decode(new Uint8Array(buffer,0,8));if(magic!=='WAFTHGT1')throw new Error(`Canarias terrain magic ${magic}`);const headerBytes=v.getUint16(10,true),columns=v.getUint16(12,true),rows=v.getUint16(14,true);return{headerBytes,columns,rows,west:v.getFloat64(16,true),east:v.getFloat64(24,true),south:v.getFloat64(32,true),north:v.getFloat64(40,true),nodata:v.getInt32(56,true),elevations:new Int16Array(buffer,headerBytes,columns*rows)};};
  const parseCover=buffer=>{const v=new DataView(buffer),magic=new TextDecoder().decode(new Uint8Array(buffer,0,8));if(magic!=='WAFTLCV1')throw new Error(`Canarias cover magic ${magic}`);const headerBytes=v.getUint16(10,true),columns=v.getUint16(12,true),rows=v.getUint16(14,true);return{columns,rows,classes:new Uint8Array(buffer,headerBytes,columns*rows)};};
  const buildCanMesh=()=>{
    const t=canTerrain,c=canCover,positions=new Float32Array(t.rows*t.columns*3),colors=new Float32Array(t.rows*t.columns*3);let p=0;
    for(let r=0;r<t.rows;r++){const lat=t.north-r/(t.rows-1)*(t.north-t.south);for(let col=0;col<t.columns;col++){const lon=t.west+col/(t.columns-1)*(t.east-t.west),idx=r*t.columns+col,w=worldFromGeo(lat,lon),raw=t.elevations[idx],water=raw===t.nodata,clr=palette[c.classes[idx]]||palette[0];positions[p]=w.x;positions[p+1]=water?-8:raw;positions[p+2]=w.z;colors[p]=clr[0];colors[p+1]=clr[1];colors[p+2]=clr[2];p+=3;}}
    const indices=new Uint32Array((t.rows-1)*(t.columns-1)*6);let q=0;for(let r=0;r<t.rows-1;r++)for(let col=0;col<t.columns-1;col++){const a=r*t.columns+col,b=a+1,d=a+t.columns,e=d+1;indices[q++]=a;indices[q++]=d;indices[q++]=b;indices[q++]=b;indices[q++]=d;indices[q++]=e;}
    const vao=gl.createVertexArray();gl.bindVertexArray(vao);const pb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,pb);gl.bufferData(gl.ARRAY_BUFFER,positions,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);const cb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,cb);gl.bufferData(gl.ARRAY_BUFFER,colors,gl.STATIC_DRAW);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,0,0);const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);gl.bindVertexArray(null);return{vao,count:indices.length,triangles:indices.length/3,buffers:[pb,cb,ib]};
  };
  const prefetchCanarias=()=>canPrefetch||(canPrefetch=(async()=>{const base='../../regions/canarias/';const [m,tb,cb]=await Promise.all([fetch(new URL(base+'manifest.json',location.href),{cache:'force-cache'}).then(r=>{if(!r.ok)throw new Error('Canarias manifest '+r.status);return r.json();}),fetch(new URL(base+'terrain.bin',location.href),{cache:'force-cache'}).then(r=>r.arrayBuffer()),fetch(new URL(base+'landcover.bin',location.href),{cache:'force-cache'}).then(r=>r.arrayBuffer())]);canManifest=m;canTerrain=parseTerrain(tb);canCover=parseCover(cb);canMesh=buildCanMesh();return true;})());
  const sampleCanarias=(x,z)=>{if(!canTerrain)return null;const g=geoFromWorld(x,z),t=canTerrain;if(g.lat<t.south||g.lat>t.north||g.lon<t.west||g.lon>t.east)return null;const fx=(g.lon-t.west)/(t.east-t.west)*(t.columns-1),fz=(t.north-g.lat)/(t.north-t.south)*(t.rows-1),col=clamp(Math.round(fx),0,t.columns-1),row=clamp(Math.round(fz),0,t.rows-1),raw=t.elevations[row*t.columns+col],land=raw!==t.nodata;return{inside:true,land,water:!land,height:(land?raw:-8)*VERTICAL,waterHeight:-8*VERTICAL,normal:{x:0,y:1,z:0},slopeAngle:0,streamedRegion:'canarias',lat:g.lat,lon:g.lon};};
  const sampleAtlantic=()=>null; // WAFT 0.25.0: no artificial Atlantic corridor surface
  const previousStreamSample=stream.sampleSurface?.bind(stream);
  if(previousStreamSample)stream.sampleSurface=(x,z)=>sampleCanarias(x,z)||previousStreamSample(x,z);

  const previousDraw=plugin.afterWorldDraw?.bind(plugin);
  plugin.afterWorldDraw=(now,eye,pv)=>{
    previousDraw?.(now,eye,pv);
    const state=api.getState?.(),g=state?.position?geoFromWorld(state.position.x,state.position.z):null;if(!g||!state?.position)return;
    const atlanticHere=false,canariasHere=inCanarias(g);
    if(!atlanticHere&&!canariasHere)return;
    gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.useProgram(canProgram);gl.uniformMatrix4fv(canPV,false,pv);gl.uniform1f(canV,VERTICAL);
    if(atlanticMesh&&atlanticHere){gl.bindVertexArray(atlanticMesh.vao);gl.drawElements(gl.TRIANGLES,atlanticMesh.count,gl.UNSIGNED_INT,0);atlanticDrawFrames++;}
    if(canMesh&&canariasHere){gl.bindVertexArray(canMesh.vao);gl.drawElements(gl.TRIANGLES,canMesh.count,gl.UNSIGNED_INT,0);canDrawFrames++;}
    gl.bindVertexArray(null);
  };

  let iberiaCities=[],franceCities=[],canariasCities=[];
  const loadJson=path=>fetch(new URL(path,location.href),{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`${r.status} ${path}`);return r.json();});
  const [ib,fr,ca]=await Promise.all([loadJson('../../regions/iberia/settlements.json'),loadJson('../../regions/france/settlements.json'),loadJson('../../regions/canarias/settlements.json')]);
  iberiaCities=(ib.items||[]).map(c=>({...c,_world:{x:Number(c.local?.x),z:Number(c.local?.z)},_region:'iberia'}));
  franceCities=(fr.items||[]).map(c=>({...c,_world:worldFromGeo(Number(c.position?.lat),Number(c.position?.lon)),_region:'france'}));
  canariasCities=(ca.items||[]).map(c=>({...c,_world:worldFromGeo(Number(c.position?.lat),Number(c.position?.lon)),_region:'canarias'}));

  window.WAFT_WORLD_ATLAS_PROVIDER=({state})=>{
    if(!state?.position)return{title:'LUGARES · PRE-GUERRA',items:iberiaCities};
    const g=geoFromWorld(state.position.x,state.position.z);
    if(inCanarias(g))return{title:'LUGARES · CANARIAS',items:canariasCities};
    if(inFrance(g))return{title:'LIEUX · FRANCE',items:franceCities};
    return{title:'LUGARES · PRE-GUERRA',items:iberiaCities};
  };

  const oldFrance=document.getElementById('waftFranceBadge0246');if(oldFrance)oldFrance.hidden=true;
  const updateWorldState=()=>{
    const state=api.getState?.();if(!state?.position)return;const g=geoFromWorld(state.position.x,state.position.z),french=inFrance(g),can=inCanarias(g),african=Boolean(window.WAFTWorld0250?.inAfrica?.(g)),hud=document.getElementById('hudTitle'),status=document.getElementById('waftWorldStream0245');
    if(oldFrance)oldFrance.hidden=true;
    if(african){regionBadge.hidden=true;if(hud)hud.textContent='NOROESTE DE ÁFRICA · MUNDO CONTINUO 0.25.0';}
    else if(can){regionBadge.hidden=false;regionBadge.textContent=`CANARIAS · ${canariasCities.length} NÚCLEOS`;if(hud)hud.textContent='CANARIAS · MUNDO CONTINUO';}
    else if(french){regionBadge.hidden=false;regionBadge.textContent=`FRANCE · ${franceCities.length} VILLES`;if(hud)hud.textContent='FRANCE · MONDE CONTINU';}
    else{regionBadge.hidden=true;if(hud&&(hud.textContent==='FRANCE · MONDE CONTINU'||hud.textContent==='FRANCE 001 · MONDE CONTINU'||hud.textContent==='CANARIAS · MUNDO CONTINUO'))hud.textContent='PENÍNSULA IBÉRICA · EXPLORACIÓN 0.25.0';}
    const streamState=stream.getState?.(),released=Boolean(streamState?.iberiaGpuReleased||state.adventureRegionalTerrainReleased);
    if(status){const region=african?'AFRICA':can?'CANARIAS':french?'FRANCE':'IBERIA';status.textContent=`MUNDO · ${region} · continuidad geográfica${released?' · región anterior liberada':''}`;}
    if(g.lat<36&&!canTerrain)prefetchCanarias().catch(e=>console.error(e));
    if(deepCanarias(g)&&!canariasReleased&&!released){const count=api.releaseRegionalTerrainGpu?.()||0;canariasReleased=count>0||Boolean(api.getState?.()?.adventureRegionalTerrainReleased);}
    else if(canariasReleased&&!inCanarias(g)&&g.lat>30.2){api.restoreRegionalTerrainGpu?.();canariasReleased=false;}
  };
  setInterval(updateWorldState,180);updateWorldState();

  window.WAFTWorldContinuity0247={version:'0.25.0-compat',geoFromWorld,worldFromGeo,inFrance,inCanarias,prefetchCanarias,atlasSystem:'shared-iberia',floatingCityLabels:false,getState:()=>{const s=api.getState?.(),geo=s?.position?geoFromWorld(s.position.x,s.position.z):null,streamState=stream.getState?.();return{geo,inFrance:inFrance(geo),inCanarias:inCanarias(geo),deepFrance:deepFrance(geo),behindReleased:Boolean(streamState?.iberiaGpuReleased||s?.adventureRegionalTerrainReleased),iberiaCities:iberiaCities.length,franceCities:franceCities.length,canariasCities:canariasCities.length,canariasReady:Boolean(canMesh),canariasTriangles:canMesh?.triangles||0,canDrawFrames,atlanticReady:Boolean(atlanticMesh),atlanticTriangles:atlanticMesh?.triangles||0,atlanticDrawFrames,atlasSystem:'shared-iberia',floatingCityLabels:false};}};
  window.__WAFT_IBERIA_WORLD_0247_READY__=true;
})().catch(e=>{console.error('WAFT 0.24.8 hotfix failed',e);window.__WAFT_IBERIA_WORLD_0247_ERROR__=String(e?.message||e);});
