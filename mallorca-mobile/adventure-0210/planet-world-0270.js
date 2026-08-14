'use strict';
(async()=>{
  if(window.__WAFT_PLANET_WORLD_0270_READY__||window.__WAFT_ADVENTURE_REGION__!=='iberia')return;
  if(new URLSearchParams(location.search).get('renderer')!=='0270')return;
  window.__WAFT_PLANET_WORLD_0270_ACTIVE__=true;
  window.__WAFT_SPHERICAL_WORLD_0261_ACTIVE__=true;
  window.__WAFT_GLOBAL_ATLAS_0260_ACTIVE__=true;

  const scriptVersion=new URL(document.currentScript?.src||location.href).searchParams.get('v')||'0.27.0';
  const core=await import(`./planet-0270/cube-sphere-core.mjs?v=${encodeURIComponent(scriptVersion)}`);
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  for(let i=0;i<750&&(!window.WAFTRegionRuntime||!window.WAFTAdventurePlugin||!document.querySelector('canvas'));i++)await wait(40);
  const api=window.WAFTRegionRuntime;
  const plugin=window.WAFTAdventurePlugin;
  const canvas=document.querySelector('canvas');
  const gl=canvas?.getContext('webgl2');
  if(!api||!plugin||!gl)throw new Error('WAFT 0.27.0 experimental planet runtime unavailable');

  const U=.33;
  const VERTICAL=.0028;
  const WATER_METERS=-20;
  const EARTH_KM=6371.0088;
  const EARTH_U=EARTH_KM*U;
  const DEG=Math.PI/180;
  const RAD=180/Math.PI;
  const TILE_RESOLUTION=17;
  const MIN_LEVEL=1;
  const MAX_LEVEL=8;
  const TARGET_ERROR_PIXELS=28;
  const RECENTER_DISTANCE=240;
  const CACHE_LIMIT=512;
  const BUILDS_PER_FRAME=3;
  const PREFETCH_TILE_LIMIT=128;
  const SKIRT_DEPTH=.9;
  const SAVE_KEY='waft.adventure.0210.planet-location.v1';
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const wrapLon=lon=>((Number(lon)+180)%360+360)%360-180;
  const normalizeGeo=(lat,lon)=>{
    lat=Number(lat)||0;
    lon=Number(lon)||0;
    let guard=0;
    while((lat>90||lat<-90)&&guard++<12){
      if(lat>90){lat=180-lat;lon+=180;}
      else{lat=-180-lat;lon+=180;}
    }
    return{lat:clamp(lat,-90,90),lon:wrapLon(lon)};
  };
  const haversineKm=(a,b)=>{
    const p1=a.lat*DEG,p2=b.lat*DEG,dp=(b.lat-a.lat)*DEG,dl=wrapLon(b.lon-a.lon)*DEG;
    const q=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
    return 2*EARTH_KM*Math.asin(Math.min(1,Math.sqrt(q)));
  };
  const bearing=(a,b)=>{
    const p1=a.lat*DEG,p2=b.lat*DEG,dl=wrapLon(b.lon-a.lon)*DEG;
    return Math.atan2(Math.sin(dl)*Math.cos(p2),Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl));
  };
  const destination=(origin,bearingRad,distanceKm)=>{
    const d=distanceKm/EARTH_KM,p1=origin.lat*DEG,l1=origin.lon*DEG,s1=Math.sin(p1),c1=Math.cos(p1),sd=Math.sin(d),cd=Math.cos(d);
    const p2=Math.asin(clamp(s1*cd+c1*sd*Math.cos(bearingRad),-1,1));
    const l2=l1+Math.atan2(Math.sin(bearingRad)*sd*c1,cd-s1*Math.sin(p2));
    return normalizeGeo(p2*RAD,l2*RAD);
  };

  const restoredLocation=(()=>{
    try{
      const value=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');
      if(value?.schemaVersion!==1||!Number.isFinite(Number(value.lat))||!Number.isFinite(Number(value.lon)))return null;
      return{lat:Number(value.lat),lon:Number(value.lon),localYUnits:Number(value.localYUnits),heading:Number(value.heading)};
    }catch{return null;}
  })();
  const legacyOrigin={lat:39.775,lon:-3.125};
  const state={
    ready:false,phase:'boot',error:null,originGeo:restoredLocation?normalizeGeo(restoredLocation.lat,restoredLocation.lon):legacyOrigin,
    terrain:null,cover:null,europeTerrain:null,europeCover:null,cache:new Map(),desired:new Map(),prefetch:new Map(),queue:[],queued:new Set(),renderKeys:[],
    drawFrames:0,visibleTriangles:0,tileBuilds:0,tileEvictions:0,lodUpdates:0,floatingOriginShifts:0,poleCrossings:0,datelineCrossings:0,
    speedEstimate:0,prefetchLead:180,lastGeo:null,lastFrameAt:performance.now(),lastSelectionAt:0,lastSaveAt:0
  };

  const geoFromLocal=(x,z)=>{
    const distanceUnits=Math.hypot(Number(x)||0,Number(z)||0);
    if(distanceUnits<1e-8)return{...state.originGeo};
    return destination(state.originGeo,Math.atan2(Number(x)||0,-(Number(z)||0)),distanceUnits/U);
  };
  const localFromGeo=(lat,lon)=>{
    const geo=normalizeGeo(lat,lon);
    const distance=haversineKm(state.originGeo,geo)*U;
    const direction=bearing(state.originGeo,geo);
    return{x:Math.sin(direction)*distance,z:-Math.cos(direction)*distance};
  };

  const loadBuffer=path=>fetch(new URL(path,location.href),{cache:'force-cache'}).then(response=>{
    if(!response.ok)throw new Error(`${response.status} ${path}`);
    return response.arrayBuffer();
  });
  function parseTerrain(buffer){
    const view=new DataView(buffer),magic=new TextDecoder().decode(new Uint8Array(buffer,0,8));
    if(magic!=='WAFTHGT1')throw new Error(`terrain magic ${magic}`);
    const headerBytes=view.getUint16(10,true),columns=view.getUint16(12,true),rows=view.getUint16(14,true);
    return{headerBytes,columns,rows,west:view.getFloat64(16,true),east:view.getFloat64(24,true),south:view.getFloat64(32,true),north:view.getFloat64(40,true),nodata:view.getInt32(56,true),elevations:new Int16Array(buffer,headerBytes,columns*rows)};
  }
  function parseCover(buffer){
    const view=new DataView(buffer),magic=new TextDecoder().decode(new Uint8Array(buffer,0,8));
    if(magic!=='WAFTLCV1')throw new Error(`cover magic ${magic}`);
    const headerBytes=view.getUint16(10,true),columns=view.getUint16(12,true),rows=view.getUint16(14,true);
    return{columns,rows,classes:new Uint8Array(buffer,headerBytes,columns*rows)};
  }
  const inDataset=(terrain,geo)=>terrain&&geo.lat>=terrain.south&&geo.lat<=terrain.north&&geo.lon>=terrain.west&&geo.lon<=terrain.east;
  function sampleDataset(terrain,cover,geo){
    if(!inDataset(terrain,geo))return null;
    const fx=(geo.lon-terrain.west)/(terrain.east-terrain.west)*(terrain.columns-1);
    const fz=(terrain.north-geo.lat)/(terrain.north-terrain.south)*(terrain.rows-1);
    const c0=clamp(Math.floor(fx),0,terrain.columns-1),r0=clamp(Math.floor(fz),0,terrain.rows-1);
    const c1=Math.min(terrain.columns-1,c0+1),r1=Math.min(terrain.rows-1,r0+1),tx=fx-c0,tz=fz-r0;
    const at=(column,row)=>terrain.elevations[row*terrain.columns+column];
    const near=at(clamp(Math.round(fx),0,terrain.columns-1),clamp(Math.round(fz),0,terrain.rows-1));
    if(near===terrain.nodata)return{land:false,meters:WATER_METERS,cover:0};
    const valid=(column,row)=>{const value=at(column,row);return value===terrain.nodata?near:value;};
    const h00=valid(c0,r0),h10=valid(c1,r0),h01=valid(c0,r1),h11=valid(c1,r1);
    const meters=(h00*(1-tx)+h10*tx)*(1-tz)+(h01*(1-tx)+h11*tx)*tz;
    const ci=clamp(Math.round(fx),0,terrain.columns-1),ri=clamp(Math.round(fz),0,terrain.rows-1);
    return{land:true,meters,cover:cover?.classes?.[ri*terrain.columns+ci]??3};
  }
  const sampleGeo=geo=>sampleDataset(state.europeTerrain,state.europeCover,geo)||sampleDataset(state.terrain,state.cover,geo)||{land:false,meters:WATER_METERS,cover:0};
  const sampleSurface=(x,z)=>{
    const geo=geoFromLocal(x,z),sample=sampleGeo(geo),height=(sample.land?sample.meters:WATER_METERS)*VERTICAL;
    return{inside:true,land:sample.land,water:!sample.land,height,waterHeight:WATER_METERS*VERTICAL,normal:{x:0,y:1,z:0},slopeAngle:0,streamedRegion:inDataset(state.europeTerrain,geo)?'planet-europe-detail':'planet-global',lat:geo.lat,lon:geo.lon};
  };

  const palette=[[.026,.17,.30],[.73,.61,.35],[.42,.43,.41],[.31,.47,.19],[.055,.29,.12],[.50,.53,.20],[.45,.44,.40],[.16,.39,.28],[.49,.40,.29],[.38,.56,.20]];
  const compile=(type,source)=>{
    const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader)||'planet shader');
    return shader;
  };
  const vertexShader=compile(gl.VERTEX_SHADER,`#version 300 es
layout(location=0)in vec3 aP;layout(location=1)in vec3 aN;layout(location=2)in vec3 aC;
uniform mat4 uPV;uniform vec3 uOrigin;uniform vec3 uEast;uniform vec3 uNorth;uniform vec3 uUp;
out vec3 vN;out vec3 vC;out vec3 vW;
void main(){vec3 rel=aP-uOrigin;vW=vec3(dot(rel,uEast),dot(rel,uUp),-dot(rel,uNorth));vN=normalize(vec3(dot(aN,uEast),dot(aN,uUp),-dot(aN,uNorth)));vC=aC;gl_Position=uPV*vec4(vW,1.0);}`);
  const fragmentShader=compile(gl.FRAGMENT_SHADER,`#version 300 es
precision highp float;in vec3 vN;in vec3 vC;in vec3 vW;uniform vec3 uEye;uniform float uFogFar;out vec4 o;
void main(){vec3 light=normalize(vec3(-.42,.86,.28));float nd=max(dot(normalize(vN),light),0.0);float slope=1.0-clamp(normalize(vN).y,0.0,1.0);float shade=.48+.48*nd-.06*slope;float fog=smoothstep(uFogFar*.62,uFogFar,distance(vW,uEye));o=vec4(mix(vC*shade,vec3(.25,.43,.56),fog*.72),1.0);}`);
  const program=gl.createProgram();
  gl.attachShader(program,vertexShader);gl.attachShader(program,fragmentShader);gl.linkProgram(program);
  gl.deleteShader(vertexShader);gl.deleteShader(fragmentShader);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||'planet program');
  const uniforms={
    pv:gl.getUniformLocation(program,'uPV'),eye:gl.getUniformLocation(program,'uEye'),origin:gl.getUniformLocation(program,'uOrigin'),
    east:gl.getUniformLocation(program,'uEast'),north:gl.getUniformLocation(program,'uNorth'),up:gl.getUniformLocation(program,'uUp'),fogFar:gl.getUniformLocation(program,'uFogFar')
  };

  function disposeMesh(mesh){
    if(!mesh)return;
    try{gl.deleteVertexArray(mesh.vao);for(const buffer of mesh.buffers)gl.deleteBuffer(buffer);}catch{}
  }
  function createTileMesh(tile){
    const grid=core.buildTileGrid(tile,TILE_RESOLUTION),baseCount=TILE_RESOLUTION*TILE_RESOLUTION;
    const boundary=[];
    for(let column=0;column<TILE_RESOLUTION;column++)boundary.push(column);
    for(let row=1;row<TILE_RESOLUTION;row++)boundary.push(row*TILE_RESOLUTION+TILE_RESOLUTION-1);
    for(let column=TILE_RESOLUTION-2;column>=0;column--)boundary.push((TILE_RESOLUTION-1)*TILE_RESOLUTION+column);
    for(let row=TILE_RESOLUTION-2;row>0;row--)boundary.push(row*TILE_RESOLUTION);
    const vertexCount=baseCount+boundary.length;
    const positions=new Float32Array(vertexCount*3),normals=new Float32Array(vertexCount*3),colors=new Float32Array(vertexCount*3);
    let surfaceHash=2166136261;
    const hashByte=value=>{surfaceHash^=value&255;surfaceHash=Math.imul(surfaceHash,16777619)>>>0;};
    for(let index=0;index<baseCount;index++){
      const offset=index*3,direction=[grid.directions[offset],grid.directions[offset+1],grid.directions[offset+2]],geo=core.unitToLatLon(direction),sample=sampleGeo(geo);
      const radial=EARTH_U+(sample.land?sample.meters:WATER_METERS)*VERTICAL,color=palette[sample.cover]||palette[sample.land?3:0];
      const heightCode=Math.round(sample.land?sample.meters:WATER_METERS);hashByte(sample.land?1:0);hashByte(sample.cover);hashByte(heightCode);hashByte(heightCode>>8);
      positions[offset]=direction[0]*radial;positions[offset+1]=direction[1]*radial;positions[offset+2]=direction[2]*radial;
      normals[offset]=direction[0];normals[offset+1]=direction[1];normals[offset+2]=direction[2];
      colors[offset]=color[0];colors[offset+1]=color[1];colors[offset+2]=color[2];
    }
    for(let index=0;index<boundary.length;index++){
      const source=boundary[index]*3,target=(baseCount+index)*3,direction=[grid.directions[source],grid.directions[source+1],grid.directions[source+2]];
      const radial=Math.hypot(positions[source],positions[source+1],positions[source+2])-SKIRT_DEPTH;
      positions[target]=direction[0]*radial;positions[target+1]=direction[1]*radial;positions[target+2]=direction[2]*radial;
      normals[target]=normals[source];normals[target+1]=normals[source+1];normals[target+2]=normals[source+2];
      colors[target]=colors[source]*.72;colors[target+1]=colors[source+1]*.72;colors[target+2]=colors[source+2]*.72;
    }
    const indices=new Uint16Array(grid.indices.length+boundary.length*6);
    indices.set(grid.indices);
    let cursor=grid.indices.length;
    for(let index=0;index<boundary.length;index++){
      const next=(index+1)%boundary.length,a=boundary[index],b=boundary[next],c=baseCount+index,d=baseCount+next;
      indices[cursor++]=a;indices[cursor++]=c;indices[cursor++]=b;indices[cursor++]=b;indices[cursor++]=c;indices[cursor++]=d;
    }
    const vao=gl.createVertexArray();gl.bindVertexArray(vao);const buffers=[];
    const add=(slot,data)=>{const buffer=gl.createBuffer();buffers.push(buffer);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);gl.enableVertexAttribArray(slot);gl.vertexAttribPointer(slot,3,gl.FLOAT,false,0,0);};
    add(0,positions);add(1,normals);add(2,colors);
    const indexBuffer=gl.createBuffer();buffers.push(indexBuffer);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);gl.bindVertexArray(null);
    return{key:core.tileKey(tile),tile:{face:tile.face,level:tile.level,x:tile.x,y:tile.y},vao,buffers,count:indices.length,triangles:indices.length/3,surfaceHash:surfaceHash.toString(16).padStart(8,'0'),lastUsed:performance.now()};
  }

  function enqueue(tile,prefetch=false){
    const key=core.tileKey(tile);
    if(state.cache.has(key)||state.queued.has(key))return;
    state.queued.add(key);state.queue.push({key,tile:{face:tile.face,level:tile.level,x:tile.x,y:tile.y},prefetch});
  }
  function processBuildQueue(){
    let built=0;
    while(built<BUILDS_PER_FRAME&&state.queue.length){
      const item=state.queue.shift();state.queued.delete(item.key);
      if(state.cache.has(item.key))continue;
      const mesh=createTileMesh(item.tile);state.cache.set(item.key,mesh);state.tileBuilds++;built++;
    }
  }
  function nearestReadyAncestor(tile){
    let current={face:tile.face,level:tile.level,x:tile.x,y:tile.y};
    while(current){const key=core.tileKey(current);if(state.cache.has(key))return key;current=core.parentTile(current);}
    return null;
  }
  function hasAncestorIn(set,key){
    let tile=core.parentTile(core.parseTileKey(key));
    while(tile){if(set.has(core.tileKey(tile)))return true;tile=core.parentTile(tile);}
    return false;
  }
  function resolveRenderKeys(){
    const candidates=new Set();
    for(const tile of state.desired.values()){
      const key=nearestReadyAncestor(tile);if(key)candidates.add(key);
    }
    const ordered=[...candidates].sort((a,b)=>core.parseTileKey(a).level-core.parseTileKey(b).level||a.localeCompare(b));
    const resolved=new Set();
    for(const key of ordered)if(!hasAncestorIn(resolved,key))resolved.add(key);
    state.renderKeys=[...resolved];
  }
  function evictCache(){
    if(state.cache.size<=CACHE_LIMIT)return;
    const protectedKeys=new Set([...state.renderKeys,...state.desired.keys(),...state.prefetch.keys()]);
    const candidates=[...state.cache.values()].filter(mesh=>mesh.tile.level>0&&!protectedKeys.has(mesh.key)).sort((a,b)=>a.lastUsed-b.lastUsed);
    while(state.cache.size>CACHE_LIMIT&&candidates.length){const mesh=candidates.shift();state.cache.delete(mesh.key);disposeMesh(mesh);state.tileEvictions++;}
  }

  function updateSpeed(now){
    const runtime=api.getState?.(),position=runtime?.position;if(!position)return;
    const geo=geoFromLocal(position.x,position.z),commanded=Math.abs(Number(runtime.adventureCurrentSpeed)||0);
    if(state.lastGeo){
      const dt=Math.max(.001,(now-state.lastFrameAt)/1000),instant=clamp(haversineKm(state.lastGeo,geo)*U/dt,0,180),target=Math.max(commanded,instant);
      state.speedEstimate+= (target-state.speedEstimate)*(1-Math.exp(-dt*(target>state.speedEstimate?10:3.5)));
    }else state.speedEstimate=commanded;
    state.lastGeo=geo;state.lastFrameAt=now;state.prefetchLead=clamp(Math.max(commanded,state.speedEstimate)*6,180,700);
  }
  function selectionFor(geo,altitude){
    return core.selectVisibleTiles({cameraDirection:core.latLonToUnit(geo.lat,geo.lon),radius:EARTH_U,altitude:Math.max(.8,altitude),minLevel:MIN_LEVEL,maxLevel:MAX_LEVEL,resolution:TILE_RESOLUTION,viewportHeight:canvas.height||720,fovY:Math.PI/3,targetPixels:TARGET_ERROR_PIXELS}).tiles;
  }
  function updateSelection(now,force=false){
    if(!force&&now-state.lastSelectionAt<240)return;
    const runtime=api.getState?.(),position=runtime?.position;if(!position)return;
    const geo=geoFromLocal(position.x,position.z),altitude=Math.max(.8,Number(position.y)||0);
    const visible=selectionFor(geo,altitude),heading=Number(runtime.playerFacing)||0;
    const predicted=destination(geo,Math.PI-heading,state.prefetchLead/U),predictedTiles=selectionFor(predicted,altitude);
    state.desired=new Map(visible.map(tile=>[core.tileKey(tile),tile]));
    const predictedMaxLevel=predictedTiles.reduce((maximum,tile)=>Math.max(maximum,tile.level),0);
    const prefetch=predictedTiles.filter(tile=>tile.level>=Math.max(2,predictedMaxLevel-1)&&!state.desired.has(core.tileKey(tile))).sort((a,b)=>a.angularDistance-b.angularDistance||b.level-a.level||core.tileKey(a).localeCompare(core.tileKey(b))).slice(0,PREFETCH_TILE_LIMIT);
    state.prefetch=new Map(prefetch.map(tile=>[core.tileKey(tile),tile]));
    const wanted=new Set([...state.desired.keys(),...state.prefetch.keys()]);
    state.queue=state.queue.filter(item=>wanted.has(item.key));state.queued=new Set(state.queue.map(item=>item.key));
    for(const tile of visible)enqueue(tile,false);
    for(const tile of prefetch)enqueue(tile,true);
    state.queue.sort((a,b)=>Number(a.prefetch)-Number(b.prefetch)||a.tile.level-b.tile.level||a.key.localeCompare(b.key));
    state.lastSelectionAt=now;state.lodUpdates++;
  }

  function saveGeographicPosition(){
    if(!state.ready)return false;
    try{
      const runtime=api.getState?.(),position=runtime?.position;if(!position)return false;
      const geo=geoFromLocal(position.x,position.z);
      localStorage.setItem(SAVE_KEY,JSON.stringify({schemaVersion:1,lat:geo.lat,lon:geo.lon,altitudeMeters:(Number(position.y)||0)/VERTICAL,localYUnits:Number(position.y)||0,heading:Number(runtime.playerFacing)||0,savedAt:Date.now()}));
      state.lastSaveAt=performance.now();return true;
    }catch{return false;}
  }
  function maybeRecenter(force=false){
    const runtime=api.getState?.(),position=runtime?.position;
    if(!position||(!force&&Math.hypot(position.x,position.z)<RECENTER_DISTANCE))return false;
    const old={...state.originGeo},next=geoFromLocal(position.x,position.z),heading=Number(runtime.playerFacing)||0;
    const forward=geoFromLocal(position.x+Math.sin(heading)*2,position.z+Math.cos(heading)*2),nextHeading=Math.atan2(Math.sin(Math.PI-bearing(next,forward)),Math.cos(Math.PI-bearing(next,forward)));
    state.originGeo=next;
    const lonJump=Math.abs(wrapLon(next.lon-old.lon));
    if(lonJump>90&&Math.abs(old.lat)>70&&Math.abs(next.lat)>70)state.poleCrossings++;
    else if(lonJump>150)state.datelineCrossings++;
    api.setRegionalPosition?.(0,0,position.y);api.setHeading?.(nextHeading);state.floatingOriginShifts++;saveGeographicPosition();updateSelection(performance.now(),true);return true;
  }

  const previousDraw=plugin.afterWorldDraw?.bind(plugin);
  plugin.afterWorldDraw=(now,eye,pv)=>{
    if(!window.__WAFT_PLANET_DEBUG_ISOLATE__)previousDraw?.(now,eye,pv);if(!state.ready)return;
    updateSpeed(now);maybeRecenter();updateSelection(now);processBuildQueue();resolveRenderKeys();evictCache();
    const frame=core.tangentFrame(state.originGeo.lat,state.originGeo.lon),origin=frame.up.map(component=>component*EARTH_U);
    gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.depthMask(true);gl.useProgram(program);gl.uniformMatrix4fv(uniforms.pv,false,pv);gl.uniform3f(uniforms.eye,...eye);
    gl.uniform3f(uniforms.origin,...origin);gl.uniform3f(uniforms.east,...frame.east);gl.uniform3f(uniforms.north,...frame.north);gl.uniform3f(uniforms.up,...frame.up);
    const runtime=api.getState?.(),altitude=Math.max(0,Number(runtime?.position?.y)||0);gl.uniform1f(uniforms.fogFar,Math.max(1200,1500+altitude*1.6));
    let triangles=0;
    for(const key of state.renderKeys){const mesh=state.cache.get(key);if(!mesh)continue;mesh.lastUsed=now;gl.bindVertexArray(mesh.vao);gl.drawElements(gl.TRIANGLES,mesh.count,gl.UNSIGNED_SHORT,0);triangles+=mesh.triangles;}
    gl.bindVertexArray(null);state.visibleTriangles=triangles;state.drawFrames++;
  };

  const uiStyle=document.createElement('style');uiStyle.id='waftPlanetUiClean0270';uiStyle.textContent='#waftIberiaAtlas,#waftSpecialMarkers,#waftStreamHint,#presets,#waftWorldLabels0249,#waftFranceBadge0246,#waftProgress{display:none!important}';document.head.appendChild(uiStyle);
  function updateHud(){
    if(!state.ready)return;
    const runtime=api.getState?.(),position=runtime?.position,geo=position?geoFromLocal(position.x,position.z):state.originGeo;
    const title=document.getElementById('hudTitle'),stats=document.getElementById('hudStats'),coords=document.getElementById('waftIberiaCoords'),objective=document.getElementById('waftObjective');
    if(title)title.textContent='MUNDO · PLANETA 0.27.0 EXP';
    if(stats)stats.textContent=`CUBE-SPHERE · ${Math.round(state.visibleTriangles/1000)}k tri · ${state.renderKeys.length}/${state.desired.size} tiles · caché ${state.cache.size}`;
    if(coords)coords.textContent=`ALT ${Math.round((position?.y||0)/VERTICAL)} m · LAT ${geo.lat.toFixed(4)} · LON ${geo.lon.toFixed(4)}`;
    if(objective)objective.textContent='Renderer planetario experimental · ALETEAR para subir · PICADO ↓ para descender.';
  }

  function terrainFingerprint(){
    let hash=2166136261;
    for(const key of [...state.desired.keys()].sort()){
      const token=`${key}:${state.cache.get(key)?.surfaceHash||'missing'};`;
      for(let index=0;index<token.length;index++){const code=token.charCodeAt(index);hash^=code&255;hash=Math.imul(hash,16777619)>>>0;hash^=code>>8;hash=Math.imul(hash,16777619)>>>0;}
    }
    return hash.toString(16).padStart(8,'0');
  }

  const compat={
    worldFromGeo:(lat,lon)=>localFromGeo(lat,lon),geoFromWorld:(x,z)=>geoFromLocal(x,z),sampleSurface,
    getState:()=>({ready:state.ready,phase:state.phase,activeRegion:'planet-world',renderMode:'cube-sphere-quadtree',prefetched:state.ready,atlasReady:state.ready,atlasTriangles:state.visibleTriangles,atlasDrawFrames:state.drawFrames,atlasVerticalScale:VERTICAL,geo:state.lastGeo,error:state.error,speedEstimate:state.speedEstimate,prefetchLead:state.prefetchLead,floatingOriginShifts:state.floatingOriginShifts,poleCrossings:state.poleCrossings,datelineCrossings:state.datelineCrossings,visibleTiles:state.renderKeys.length,desiredTiles:state.desired.size,cacheTiles:state.cache.size}),
    prefetchFrance:async()=>true,nearFrance:()=>false,inFranceGeo:()=>false,franceSouthLat:()=>42.3
  };
  window.WAFTWorldStreaming0245=compat;window.WAFTWorldContinuity0247={getState:compat.getState,prefetchCanarias:async()=>true,inCanarias:()=>false};
  window.WAFTPlanetWorld0270={getState:()=>({...compat.getState(),originGeo:{...state.originGeo},tileBuilds:state.tileBuilds,tileEvictions:state.tileEvictions,lodUpdates:state.lodUpdates,prefetchTiles:state.prefetch.size,residentDesiredTiles:[...state.desired.keys()].filter(key=>state.cache.has(key)).length,residentPrefetchTiles:[...state.prefetch.keys()].filter(key=>state.cache.has(key)).length,desiredTileKeys:[...state.desired.keys()].sort(),renderTileKeys:[...state.renderKeys].sort(),terrainFingerprint:terrainFingerprint()}),worldFromGeo:compat.worldFromGeo,geoFromWorld:compat.geoFromWorld,sampleSurface,destination,normalizeGeo,saveGeographicPosition,recenterAtCurrentPosition:()=>maybeRecenter(true)};
  window.WAFTGlobalAtlas0260=window.WAFTPlanetWorld0270;

  try{
    state.phase='loading';const globalBase='../../regions/global-atlas/',europeBase='../../regions/europe-atlas/';
    const [globalTerrain,globalCover,europeTerrain,europeCover]=await Promise.all([loadBuffer(globalBase+'terrain.bin'),loadBuffer(globalBase+'landcover.bin'),loadBuffer(europeBase+'terrain.bin'),loadBuffer(europeBase+'landcover.bin')]);
    state.terrain=parseTerrain(globalTerrain);state.cover=parseCover(globalCover);state.europeTerrain=parseTerrain(europeTerrain);state.europeCover=parseCover(europeCover);
    const runtime=api.getState?.(),position=runtime?.position;
    if(restoredLocation&&position)api.setRegionalPosition?.(0,0,Number.isFinite(restoredLocation.localYUnits)?restoredLocation.localYUnits:position.y);
    if(restoredLocation&&Number.isFinite(restoredLocation.heading))api.setHeading?.(restoredLocation.heading);
    for(let face=0;face<core.FACE_NAMES.length;face++){const tile={face,level:0,x:0,y:0},mesh=createTileMesh(tile);state.cache.set(mesh.key,mesh);state.tileBuilds++;}
    state.ready=true;state.phase='ready';api.releaseRegionalTerrainGpu?.();updateSelection(performance.now(),true);window.__WAFT_PLANET_WORLD_0270_READY__=true;window.__WAFT_GLOBAL_ATLAS_0260_READY__=true;
    updateHud();setInterval(updateHud,250);setInterval(saveGeographicPosition,5000);addEventListener('beforeunload',saveGeographicPosition);document.addEventListener('visibilitychange',()=>{if(document.hidden)saveGeographicPosition();});
  }catch(error){state.error=String(error?.stack||error);state.phase='error';console.error(error);}
})();
