'use strict';
(async()=>{
  if(window.__WAFT_IBERIA_WORLD_0247_READY__||window.__WAFT_ADVENTURE_REGION__!=='iberia')return;
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  for(let i=0;i<600&&(!window.WAFTRegionRuntime||!window.WAFTWorldStreaming0245||!window.__WAFT_IBERIA_WORLD_0246_READY__);i++)await wait(40);
  const api=window.WAFTRegionRuntime,stream=window.WAFTWorldStreaming0245,plugin=window.WAFTAdventurePlugin;
  if(!api||!stream||!plugin)throw new Error('WAFT 0.24.7 runtime unavailable');

  const U=1.45,I={lat0:39.775,lon0:-3.125,kmLat:111.132,kmLon:85.55640544079021};
  const VERTICAL=Number(api.metadata?.terrain?.verticalScale)||.013594;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const geoFromWorld=(x,z)=>({lat:I.lat0-z/(I.kmLat*U),lon:I.lon0+x/(I.kmLon*U)});
  const worldFromGeo=(lat,lon)=>({x:(lon-I.lon0)*I.kmLon*U,z:-(lat-I.lat0)*I.kmLat*U});
  const franceBorderLat=lon=>{
    if(lon<-2.05)return 43.72;
    if(lon<-1.55)return 43.58;
    if(lon<-.65)return 43.58-(lon+1.55)*.62;
    if(lon<1.55)return 42.90-(lon+.65)*.12;
    if(lon<3.35)return 42.64-(lon-1.55)*.10;
    return 43.35;
  };
  const inFrance=geo=>Boolean(geo&&geo.lon>-5.7&&geo.lon<9.8&&geo.lat>=franceBorderLat(geo.lon));
  const deepFrance=geo=>inFrance(geo)&&geo.lat>=franceBorderLat(geo.lon)+1.10;
  const inCanarias=geo=>Boolean(geo&&geo.lat>=27.25&&geo.lat<=29.85&&geo.lon>=-19.25&&geo.lon<=-13.15);
  const deepCanarias=geo=>inCanarias(geo)&&geo.lat<=29.45;

  // 0.24.5 released Iberia as soon as latitude crossed a single threshold. Keep it resident
  // until the player is genuinely >~120 km inside France/Canarias, then release behind them.
  const originalRelease=api.releaseRegionalTerrainGpu?.bind(api),originalRestore=api.restoreRegionalTerrainGpu?.bind(api);
  if(originalRelease)api.releaseRegionalTerrainGpu=()=>0;
  let behindReleased=false;
  const setBehindReleased=value=>{
    if(value===behindReleased)return;
    if(value){const released=originalRelease?.()||0;behindReleased=released>0||Boolean(api.getState?.()?.adventureRegionalTerrainReleased);}
    else{originalRestore?.();behindReleased=false;}
  };

  const style=document.createElement('style');
  style.textContent=`
    #waftCityLabels0247{position:fixed;inset:0;z-index:39;pointer-events:none;overflow:hidden}
    .waftCity0247{position:absolute;transform:translate(-50%,-100%);display:none;white-space:nowrap;filter:drop-shadow(0 2px 4px #000c)}
    .waftCity0247.visible{display:flex;align-items:center;gap:4px}
    .waftCity0247 .dot{width:6px;height:6px;border-radius:50%;background:#f4d06f;border:1px solid #fff7d7;box-shadow:0 0 0 2px #07161daa}
    .waftCity0247 .name{padding:2px 5px;border-radius:7px;background:rgba(5,18,24,.80);border:1px solid #ffffff2b;color:#fff;font:850 8px/1 system-ui}
    .waftCity0247 .cc{color:#9cc9bb;font-size:6px;margin-left:3px}
    .waftCity0247.capital .dot{width:8px;height:8px;background:#ffe391}.waftCity0247.capital .name{color:#fff0b9;border-color:#e9c66f80}
    #waftRegionBadge0247{position:fixed;left:50%;top:max(12px,env(safe-area-inset-top));transform:translateX(-50%);z-index:44;padding:8px 13px;border-radius:13px;border:1px solid rgba(244,207,107,.58);background:rgba(9,27,34,.88);color:#ffe6a0;font:900 11px system-ui;letter-spacing:.055em;box-shadow:0 8px 25px #0008;pointer-events:none}
    #waftRegionBadge0247[hidden]{display:none!important}
    @media(max-width:700px){.waftCity0247 .name{font-size:7px}.waftCity0247 .dot{width:5px;height:5px}}
  `;
  document.head.appendChild(style);
  const labelRoot=document.createElement('div');labelRoot.id='waftCityLabels0247';document.body.appendChild(labelRoot);
  const regionBadge=document.createElement('div');regionBadge.id='waftRegionBadge0247';regionBadge.hidden=true;document.body.appendChild(regionBadge);
  const markerEls=new Map();

  // Canarias real terrain package: same world coordinates, no reload/teleport. The Atlantic gap
  // is a real water corridor so flight/swimming can continue between southern Iberia and the islands.
  const canvas=document.querySelector('canvas'),gl=canvas?.getContext('webgl2');
  if(!gl)throw new Error('WebGL2 unavailable for Canarias 0.24.7');
  let canTerrain=null,canCover=null,canManifest=null,canMesh=null,canPrefetch=null,canDrawFrames=0,atlanticMesh=null,atlanticDrawFrames=0; // WAFT_ATLANTIC_MESH_0247
  const palette=[[.026,.17,.30],[.73,.61,.35],[.42,.43,.41],[.31,.47,.19],[.055,.29,.12],[.50,.53,.20],[.45,.44,.40],[.16,.39,.28],[.49,.40,.29],[.38,.56,.20]];
  const compile=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)||'Canarias shader');return s;};
  const vs=compile(gl.VERTEX_SHADER,`#version 300 es\nlayout(location=0)in vec3 aP;layout(location=1)in vec3 aC;uniform mat4 uPV;uniform float uV;out vec3 vC;void main(){vC=aC;gl_Position=uPV*vec4(aP.x,aP.y*uV,aP.z,1.0);}`);
  const fs=compile(gl.FRAGMENT_SHADER,`#version 300 es\nprecision highp float;in vec3 vC;out vec4 o;void main(){o=vec4(vC,1.0);}`);
  const canProgram=gl.createProgram();gl.attachShader(canProgram,vs);gl.attachShader(canProgram,fs);gl.linkProgram(canProgram);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(canProgram,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(canProgram)||'Canarias program');
  const canPV=gl.getUniformLocation(canProgram,'uPV'),canV=gl.getUniformLocation(canProgram,'uV');
  // A narrow Atlantic water corridor follows the ocean west of Morocco instead of painting a giant rectangle over Africa.
  const atlanticEastLon=lat=>lat>=35?-5.05-(35.45-lat)*2.0:lat>=33?-5.95-(35-lat)*1.25:lat>=31?-8.45-(33-lat)*1.3:-11.05-(31-lat)*1.15;
  const buildAtlanticMesh=()=>{
    const lats=[35.45,35,33,31,29.35,27.25],pos=[],col=[],ind=[],water=[.026,.17,.30];
    for(const lat of lats)for(const lon of [-19.6,atlanticEastLon(lat)]){const w=worldFromGeo(lat,lon);pos.push(w.x,-7.75,w.z);col.push(...water);}
    for(let r=0;r<lats.length-1;r++){const a=r*2,b=a+1,c=a+2,d=a+3;ind.push(a,c,b,b,c,d);}
    const vao=gl.createVertexArray();gl.bindVertexArray(vao);const pb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,pb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(pos),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);const cb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,cb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(col),gl.STATIC_DRAW);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,0,0);const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(ind),gl.STATIC_DRAW);gl.bindVertexArray(null);return{vao,count:ind.length,triangles:ind.length/3,buffers:[pb,cb,ib]};
  };
  atlanticMesh=buildAtlanticMesh();
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
  const sampleAtlantic=(x,z)=>{const g=geoFromWorld(x,z);if(g.lat>35.45||g.lat<27.25||g.lon<-19.6||g.lon>atlanticEastLon(g.lat))return null;return{inside:true,land:false,water:true,height:-8*VERTICAL,waterHeight:-8*VERTICAL,normal:{x:0,y:1,z:0},slopeAngle:0,streamedRegion:'atlantic-corridor',lat:g.lat,lon:g.lon};};
  const previousStreamSample=stream.sampleSurface?.bind(stream);
  if(previousStreamSample)stream.sampleSurface=(x,z)=>sampleCanarias(x,z)||sampleAtlantic(x,z)||previousStreamSample(x,z);

  const previousDraw=plugin.afterWorldDraw?.bind(plugin);
  plugin.afterWorldDraw=(now,eye,pv)=>{previousDraw?.(now,eye,pv);const state=api.getState?.(),g=state?.position?geoFromWorld(state.position.x,state.position.z):null;if(!g)return;gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.useProgram(canProgram);gl.uniformMatrix4fv(canPV,false,pv);gl.uniform1f(canV,VERTICAL);if(atlanticMesh&&g.lat<36.6&&g.lon<-4.5){gl.bindVertexArray(atlanticMesh.vao);gl.drawElements(gl.TRIANGLES,atlanticMesh.count,gl.UNSIGNED_INT,0);atlanticDrawFrames++;}if(canMesh&&g.lat<31.6){gl.bindVertexArray(canMesh.vao);gl.drawElements(gl.TRIANGLES,canMesh.count,gl.UNSIGNED_INT,0);canDrawFrames++;}gl.bindVertexArray(null);};

  let iberiaCities=[],franceCities=[],canariasCities=[];
  const loadJson=path=>fetch(new URL(path,location.href),{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`${r.status} ${path}`);return r.json();});
  const [ib,fr,ca]=await Promise.all([loadJson('../../regions/iberia/settlements.json'),loadJson('../../regions/france/settlements.json'),loadJson('../../regions/canarias/settlements.json')]);
  iberiaCities=(ib.items||[]).map(c=>({...c,_world:{x:Number(c.local?.x),z:Number(c.local?.z)},_y:(Number(c.local?.y)||0)*VERTICAL,_region:'iberia'}));
  franceCities=(fr.items||[]).map(c=>{const w=stream.worldFromGeo(Number(c.position?.lat),Number(c.position?.lon));return{...c,_world:w,_y:(Number(c.local?.y)||0)*VERTICAL,_region:'france'};});
  canariasCities=(ca.items||[]).map(c=>{const w=worldFromGeo(Number(c.position?.lat),Number(c.position?.lon));return{...c,_world:w,_y:(Number(c.local?.y)||0)*VERTICAL,_region:'canarias'};});

  function worldToScreen(x,y,z,state){const d=api.regionalToDisplay?.(x,z);if(!d||!state?.cameraEye||!state?.displayPosition)return null;const eye=state.cameraEye,target={x:state.displayPosition.x,y:state.position.y,z:state.displayPosition.z};let fx=target.x-eye.x,fy=target.y-eye.y,fz=target.z-eye.z,fl=Math.hypot(fx,fy,fz);if(fl<.001)return null;fx/=fl;fy/=fl;fz/=fl;let rx=-fz,rz=fx,rl=Math.hypot(rx,rz);if(rl<.001)return null;rx/=rl;rz/=rl;const ux=fy*rz,uy=fz*rx-fx*rz,uz=-fy*rx,px=d.x-eye.x,py=y-eye.y,pz=d.z-eye.z,depth=px*fx+py*fy+pz*fz;if(depth<=.25)return null;const vx=px*rx+pz*rz,vy=px*ux+py*uy+pz*uz,h=innerHeight,w=innerWidth,f=(h*.5)/Math.tan(Math.PI/6);return{x:w*.5+vx*f/depth,y:h*.5-vy*f/depth,depth};}
  const getMarker=city=>{const id=`${city._region}:${city.id||city.name}`;let el=markerEls.get(id);if(el)return el;el=document.createElement('div');el.className='waftCity0247'+(city.capitalLevel?' capital':'');el.innerHTML=`<span class="dot"></span><span class="name"></span>`;el.querySelector('.name').textContent=city.name;const cc=document.createElement('span');cc.className='cc';cc.textContent=city.countryCode||city._region.toUpperCase().slice(0,2);el.querySelector('.name').appendChild(cc);labelRoot.appendChild(el);markerEls.set(id,el);return el;};
  function updateCityLabels(){
    const state=api.getState?.();if(!state?.position)return;const g=geoFromWorld(state.position.x,state.position.z),all=[...iberiaCities,...franceCities,...canariasCities];
    const candidates=all.map(city=>({city,d:Math.hypot(city._world.x-state.position.x,city._world.z-state.position.z)})).filter(x=>x.d<190).sort((a,b)=>a.d-b.d||Number(b.city.population||0)-Number(a.city.population||0)).slice(0,24);const active=new Set();
    for(const {city,d} of candidates){const id=`${city._region}:${city.id||city.name}`,el=getMarker(city);active.add(id);let y=city._y+.7;if(city._region==='france'){const s=previousStreamSample?.(city._world.x,city._world.z);if(Number.isFinite(s?.height))y=s.height+.75;}else if(city._region==='canarias'){const s=sampleCanarias(city._world.x,city._world.z);if(Number.isFinite(s?.height))y=s.height+.75;}const p=worldToScreen(city._world.x,y,city._world.z,state),visible=Boolean(p&&p.x>-100&&p.x<innerWidth+100&&p.y>-80&&p.y<innerHeight+80);el.classList.toggle('visible',visible);if(visible){el.style.left=`${p.x}px`;el.style.top=`${p.y}px`;const scale=clamp(1.05-d/340,.66,1.08);el.style.transform=`translate(-50%,-100%) scale(${scale})`;}}
    for(const [id,el] of markerEls)if(!active.has(id))el.classList.remove('visible');
    const oldFrance=document.getElementById('waftFranceBadge0246'),hud=document.getElementById('hudTitle'),status=document.getElementById('waftWorldStream0245');
    const french=inFrance(g),can=inCanarias(g);if(oldFrance)oldFrance.hidden=true;
    if(can){regionBadge.hidden=false;regionBadge.textContent=`CANARIAS · ${canariasCities.length} NÚCLEOS · MUNDO CONTINUO`;if(hud)hud.textContent='CANARIAS · MUNDO CONTINUO';}
    else if(french){regionBadge.hidden=false;regionBadge.textContent=`FRANCE · ${franceCities.length} VILLES · MONDE CONTINU`;if(hud)hud.textContent='FRANCE · MONDE CONTINU';}
    else{regionBadge.hidden=true;if(hud&&(hud.textContent==='FRANCE · MONDE CONTINU'||hud.textContent==='FRANCE 001 · MONDE CONTINU'||hud.textContent==='CANARIAS · MUNDO CONTINUO'))hud.textContent='PENÍNSULA IBÉRICA · EXPLORACIÓN 0.24.7';}
    if(status){const region=can?'CANARIAS':french?'FRANCE':'IBERIA';status.textContent=`MUNDO · ${region} · continuidad suave${behindReleased?' · región anterior liberada':''}`;}
    if(g.lat<36&&!canTerrain)prefetchCanarias().catch(e=>console.error(e));
    setBehindReleased(deepFrance(g)||deepCanarias(g));
  }
  setInterval(updateCityLabels,120);updateCityLabels();

  window.WAFTWorldContinuity0247={version:'0.24.7',geoFromWorld,worldFromGeo,inFrance,inCanarias,prefetchCanarias,getState:()=>{const s=api.getState?.(),geo=s?.position?geoFromWorld(s.position.x,s.position.z):null;return{geo,inFrance:inFrance(geo),inCanarias:inCanarias(geo),deepFrance:deepFrance(geo),behindReleased,iberiaCities:iberiaCities.length,franceCities:franceCities.length,canariasCities:canariasCities.length,canariasReady:Boolean(canMesh),canariasTriangles:canMesh?.triangles||0,canDrawFrames,atlanticReady:Boolean(atlanticMesh),atlanticTriangles:atlanticMesh?.triangles||0,atlanticDrawFrames};}};
  window.__WAFT_IBERIA_WORLD_0247_READY__=true;
})().catch(e=>{console.error('WAFT 0.24.7 failed',e);window.__WAFT_IBERIA_WORLD_0247_ERROR__=String(e?.message||e);});
