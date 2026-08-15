'use strict';
(async()=>{
  if(window.__WAFT_PLANET_WORLD_0270_READY__||window.__WAFT_ADVENTURE_REGION__!=='iberia')return;
  const requestedRenderer=new URLSearchParams(location.search).get('renderer');
  if(requestedRenderer!=='0270'&&requestedRenderer!=='0274')return;
  const smoothPlanet=requestedRenderer==='0274';
  window.__WAFT_PLANET_WORLD_0270_ACTIVE__=true;
  if(smoothPlanet)window.__WAFT_PLANET_WORLD_0274_ACTIVE__=true;
  window.__WAFT_SPHERICAL_WORLD_0261_ACTIVE__=true;
  window.__WAFT_GLOBAL_ATLAS_0260_ACTIVE__=true;

  const scriptVersion=new URL(document.currentScript?.src||location.href).searchParams.get('v')||(smoothPlanet?'0.27.4':'0.27.3');
  const core=await import(`./planet-0270/cube-sphere-core.mjs?v=${encodeURIComponent(scriptVersion)}`);
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  for(let i=0;i<750&&(!window.WAFTRegionRuntime||!window.WAFTAdventurePlugin||!document.querySelector('canvas'));i++)await wait(40);
  const api=window.WAFTRegionRuntime;
  const plugin=window.WAFTAdventurePlugin;
  const canvas=document.querySelector('canvas');
  const gl=canvas?.getContext('webgl2');
  if(!api||!plugin||!gl)throw new Error(`WAFT ${smoothPlanet?'0.27.4':'0.27.3'} experimental planet runtime unavailable`);
  const rendererInfo=gl.getExtension('WEBGL_debug_renderer_info');
  const gpuRenderer=String(rendererInfo?gl.getParameter(rendererInfo.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER));
  const softwareRenderer=/SwiftShader|llvmpipe|software rasterizer/i.test(gpuRenderer);

  const U=.33;
  const VERTICAL=.0028;
  const WATER_METERS=-20;
  const EARTH_KM=6371.0088;
  const EARTH_U=EARTH_KM*U;
  const DEG=Math.PI/180;
  const RAD=180/Math.PI;
  const TILE_RESOLUTION=17;
  const MIN_LEVEL=3;
  const MAX_LEVEL=6;
  // 0.27.4 rebases before the camera matrices are calculated. Keeping the
  // tangent origin under the player prevents spherical sagitta from building up
  // and then snapping the terrain several units at a time.
  const RECENTER_DISTANCE=smoothPlanet?8:240;
  const STATIC_TILE_LIMIT=720;
  const STATIC_BOOT_BATCH=8;
  const LAND_EDGE_BIN_DEGREES=.25;
  const LAND_EDGE_BIN_COUNT=Math.ceil(180/LAND_EDGE_BIN_DEGREES);
  const SKIRT_DEPTH=.22;
  // The quadtree is selected once from geographic content zones and fully uploaded before
  // gameplay. Player movement, flapping, camera rotation and floating-origin shifts can only
  // cull these immutable leaves; they can never rebuild or replace their physical geometry.
  const STATIC_REFINEMENT_ZONES=Object.freeze([
    Object.freeze({name:'europe',lat:52,lon:10,radians:.43,level:4}),
    Object.freeze({name:'iberia',lat:40,lon:-3,radians:.13,level:6})
  ]);
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
    terrain:null,cover:null,europeTerrain:null,europeCover:null,landMask:null,cache:new Map(),batchCache:new Map(),desired:new Map(),prefetch:new Map(),staticTiles:[],renderKeys:[],renderBatchKeys:[],renderMeshes:[],
    drawFrames:0,visibleTriangles:0,tileBuilds:0,tileEvictions:0,lodUpdates:0,floatingOriginShifts:0,poleCrossings:0,datelineCrossings:0,
    speedEstimate:0,prefetchLead:0,lastGeo:null,lastFrameAt:performance.now(),lastSelectionAt:0,lastSaveAt:0,lastBuildMs:0,maxBuildMs:0,maxCacheTiles:0,
    readyTileBuilds:0,staticPlanHash:null,staticGeometryHash:null,staticBuildMs:0,drawCalls:0,selectionMs:0,maxSelectionMs:0,
    cameraFrameMismatches:0,lastPreCameraAt:0,lastRecenterDistance:0,maxRecenterDistance:0
  };
  const runtimeState=()=>api.getPlanetFrameState?.()||api.getState?.();

  const geoFromLocal=(x,z)=>{
    const distanceUnits=Math.hypot(Number(x)||0,Number(z)||0);
    if(distanceUnits<1e-8)return{...state.originGeo};
    return destination(state.originGeo,Math.atan2(Number(x)||0,-(Number(z)||0)),distanceUnits/U);
  };
  const localFromGeoAt=(origin,lat,lon)=>{
    const geo=normalizeGeo(lat,lon);
    const distance=haversineKm(origin,geo)*U;
    const direction=bearing(origin,geo);
    return{x:Math.sin(direction)*distance,z:-Math.cos(direction)*distance};
  };
  const localFromGeo=(lat,lon)=>localFromGeoAt(state.originGeo,lat,lon);

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
  function parseLandMask(buffer){
    const view=new DataView(buffer),magic=new TextDecoder().decode(new Uint8Array(buffer,0,8));
    if(magic!=='WAFTLND1')throw new Error(`land mask magic ${magic}`);
    const headerBytes=view.getUint16(10,true),polygonCount=view.getUint32(12,true),polygons=[];let offset=headerBytes;
    for(let polygonIndex=0;polygonIndex<polygonCount;polygonIndex++){
      const west=view.getFloat32(offset,true),east=view.getFloat32(offset+4,true),south=view.getFloat32(offset+8,true),north=view.getFloat32(offset+12,true),ringCount=view.getUint16(offset+16,true),rings=[];offset+=20;
      for(let ringIndex=0;ringIndex<ringCount;ringIndex++){
        const pointCount=view.getUint32(offset,true),points=new Float32Array(pointCount*2);offset+=4;
        for(let pointIndex=0;pointIndex<points.length;pointIndex++){points[pointIndex]=view.getFloat32(offset,true);offset+=4;}
        const edgeBins=new Map();
        for(let index=0,previous=points.length-2;index<points.length;previous=index,index+=2){
          const y0=points[previous+1],y1=points[index+1];
          if(y0===y1)continue;
          const first=clamp(Math.floor((Math.min(y0,y1)+90)/LAND_EDGE_BIN_DEGREES),0,LAND_EDGE_BIN_COUNT-1);
          const last=clamp(Math.floor((Math.max(y0,y1)+90)/LAND_EDGE_BIN_DEGREES),0,LAND_EDGE_BIN_COUNT-1);
          for(let bin=first;bin<=last;bin++){let edges=edgeBins.get(bin);if(!edges)edgeBins.set(bin,edges=[]);edges.push(index);}
        }
        rings.push({points,edgeBins});
      }
      polygons.push({west,east,south,north,rings});
    }
    const columns=72,rows=36,cells=Array.from({length:columns*rows},()=>[]);
    for(const polygon of polygons){
      const column0=clamp(Math.floor((polygon.west+180)/5),0,columns-1),column1=clamp(Math.floor((polygon.east+180)/5),0,columns-1);
      const row0=clamp(Math.floor((polygon.south+90)/5),0,rows-1),row1=clamp(Math.floor((polygon.north+90)/5),0,rows-1);
      for(let row=row0;row<=row1;row++)for(let column=column0;column<=column1;column++)cells[row*columns+column].push(polygon);
    }
    return{polygons,cells,columns,rows,lastPolygon:null};
  }
  function ringContains(ring,lon,lat){
    const points=ring.points,bin=clamp(Math.floor((lat+90)/LAND_EDGE_BIN_DEGREES),0,LAND_EDGE_BIN_COUNT-1),edges=ring.edgeBins.get(bin);
    if(!edges)return false;
    let inside=false;
    for(const index of edges){
      const previous=index===0?points.length-2:index-2,xi=points[index],yi=points[index+1],xj=points[previous],yj=points[previous+1];
      if((yi>lat)!==(yj>lat)&&lon<(xj-xi)*(lat-yi)/(yj-yi)+xi)inside=!inside;
    }
    return inside;
  }
  function polygonContains(polygon,lon,lat){
    let inside=false;
    for(const ring of polygon.rings)if(ringContains(ring,lon,lat))inside=!inside;
    return inside;
  }
  function vectorLand(geo){
    const mask=state.landMask;if(!mask)return null;
    const cached=mask.lastPolygon;
    if(cached&&geo.lon>=cached.west&&geo.lon<=cached.east&&geo.lat>=cached.south&&geo.lat<=cached.north&&polygonContains(cached,geo.lon,geo.lat))return true;
    const column=clamp(Math.floor((geo.lon+180)/5),0,mask.columns-1),row=clamp(Math.floor((geo.lat+90)/5),0,mask.rows-1);
    for(const polygon of mask.cells[row*mask.columns+column]){
      if(polygon===cached||geo.lon<polygon.west||geo.lon>polygon.east||geo.lat<polygon.south||geo.lat>polygon.north)continue;
      if(polygonContains(polygon,geo.lon,geo.lat)){mask.lastPolygon=polygon;return true;}
    }
    mask.lastPolygon=null;return false;
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
  const sampleGeo=geo=>{
    const base=sampleDataset(state.europeTerrain,state.europeCover,geo)||sampleDataset(state.terrain,state.cover,geo)||{land:false,meters:WATER_METERS,cover:0},land=vectorLand(geo);
    if(land===null||land===base.land)return base;
    return land?{land:true,meters:0,cover:3}:{land:false,meters:WATER_METERS,cover:0};
  };
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
layout(location=0)in vec3 aP;layout(location=2)in vec3 aC;
uniform mat4 uPV;uniform vec3 uOrigin;uniform vec3 uEast;uniform vec3 uNorth;uniform vec3 uUp;
out vec3 vC;
void main(){vec3 rel=aP-uOrigin;vec3 local=vec3(dot(rel,uEast),dot(rel,uUp),-dot(rel,uNorth));vC=aC;gl_Position=uPV*vec4(local,1.0);}`);
  const fragmentShader=compile(gl.FRAGMENT_SHADER,`#version 300 es
precision mediump float;in vec3 vC;out vec4 o;
void main(){o=vec4(vC,1.0);}`);
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
  function createTileGeometry(tile){
    // CPU rasterizers cannot sustain the hardware mesh density. They receive
    // the same immutable 705-tile planet and coastline data, but with the
    // lowest per-tile tessellation; hardware keeps the full visual profile.
    const resolution=smoothPlanet?(softwareRenderer?3:tile.level>=6?9:tile.level===5?7:tile.level===4?5:3):TILE_RESOLUTION;
    const grid=core.buildTileGrid(tile,resolution),baseCount=resolution*resolution;
    const boundary=[];
    for(let column=0;column<resolution;column++)boundary.push(column);
    for(let row=1;row<resolution;row++)boundary.push(row*resolution+resolution-1);
    for(let column=resolution-2;column>=0;column--)boundary.push((resolution-1)*resolution+column);
    for(let row=resolution-2;row>0;row--)boundary.push(row*resolution);
    const vertexCount=baseCount+boundary.length;
    const positions=new Float32Array(vertexCount*3),normals=new Float32Array(vertexCount*3),colors=new Float32Array(vertexCount*3);
    let surfaceHash=2166136261;
    const hashByte=value=>{surfaceHash^=value&255;surfaceHash=Math.imul(surfaceHash,16777619)>>>0;};
    for(let index=0;index<baseCount;index++){
      const offset=index*3,direction=[grid.directions[offset],grid.directions[offset+1],grid.directions[offset+2]],geo=core.unitToLatLon(direction),sample=sampleGeo(geo);
      const radial=EARTH_U+(sample.land?sample.meters:WATER_METERS)*VERTICAL,color=palette[sample.cover]||palette[sample.land?3:0],sun=Math.max(0,direction[0]*-.42+direction[1]*.86+direction[2]*.28),shade=.48+.48*sun;
      const heightCode=Math.round(sample.land?sample.meters:WATER_METERS);hashByte(sample.land?1:0);hashByte(sample.cover);hashByte(heightCode);hashByte(heightCode>>8);
      positions[offset]=direction[0]*radial;positions[offset+1]=direction[1]*radial;positions[offset+2]=direction[2]*radial;
      normals[offset]=direction[0];normals[offset+1]=direction[1];normals[offset+2]=direction[2];
      colors[offset]=color[0]*shade;colors[offset+1]=color[1]*shade;colors[offset+2]=color[2]*shade;
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
    return{key:tile.key||core.tileKey(tile),tile:{face:tile.face,level:tile.level,x:tile.x,y:tile.y},resolution,positions,normals,colors,indices,vertexCount,triangles:indices.length/3,surfaceHash:surfaceHash.toString(16).padStart(8,'0')};
  }
  function uploadBatchMesh(key,geometries){
    const vertexCount=geometries.reduce((total,geometry)=>total+geometry.vertexCount,0),indexCount=geometries.reduce((total,geometry)=>total+geometry.indices.length,0);
    const positions=new Float32Array(vertexCount*3),normals=new Float32Array(vertexCount*3),colors=new Float32Array(vertexCount*3),IndexArray=vertexCount<=65535?Uint16Array:Uint32Array,indices=new IndexArray(indexCount);
    let vertexCursor=0,indexCursor=0,triangles=0;
    for(const geometry of geometries){
      positions.set(geometry.positions,vertexCursor*3);normals.set(geometry.normals,vertexCursor*3);colors.set(geometry.colors,vertexCursor*3);
      for(let index=0;index<geometry.indices.length;index++)indices[indexCursor+index]=geometry.indices[index]+vertexCursor;
      vertexCursor+=geometry.vertexCount;indexCursor+=geometry.indices.length;triangles+=geometry.triangles;
    }
    const vao=gl.createVertexArray();gl.bindVertexArray(vao);const buffers=[];
    const add=(slot,data)=>{const buffer=gl.createBuffer();buffers.push(buffer);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);gl.enableVertexAttribArray(slot);gl.vertexAttribPointer(slot,3,gl.FLOAT,false,0,0);};
    add(0,positions);add(1,normals);add(2,colors);
    const indexBuffer=gl.createBuffer();buffers.push(indexBuffer);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);gl.bindVertexArray(null);
    return{key,vao,buffers,count:indexCount,indexType:IndexArray===Uint16Array?gl.UNSIGNED_SHORT:gl.UNSIGNED_INT,triangles,tiles:geometries.length,vertexCount};
  }

  const hashTokens=tokens=>{
    let hash=2166136261;
    for(const token of tokens)for(let index=0;index<token.length;index++){const code=token.charCodeAt(index);hash^=code&255;hash=Math.imul(hash,16777619)>>>0;hash^=code>>8;hash=Math.imul(hash,16777619)>>>0;}
    return hash.toString(16).padStart(8,'0');
  };
  async function buildStaticPlanet(){
    const plan=core.selectFixedQuadtreeTiles({baseLevel:MIN_LEVEL,zones:STATIC_REFINEMENT_ZONES});
    if(plan.tiles.length>STATIC_TILE_LIMIT)throw new Error(`static planet budget ${plan.tiles.length}/${STATIC_TILE_LIMIT}`);
    state.staticTiles=plan.tiles.map(tile=>{
      const shift=tile.level-MIN_LEVEL,batchTile={face:tile.face,level:MIN_LEVEL,x:tile.x>>shift,y:tile.y>>shift},visibilityRadius=Math.min(Math.PI,tile.angularRadius+.015);
      const batchKey=smoothPlanet?'planet/full':core.tileKey(batchTile);
      return{face:tile.face,level:tile.level,x:tile.x,y:tile.y,key:core.tileKey(tile),batchKey,center:tile.center,angularRadius:tile.angularRadius,visibilityCos:Math.cos(visibilityRadius),visibilitySin:Math.sin(visibilityRadius)};
    });
    state.staticPlanHash=hashTokens(state.staticTiles.map(tile=>`${core.tileKey(tile)};`));
    const allStarted=performance.now(),batchGeometries=new Map();
    for(let index=0;index<state.staticTiles.length;index++){
      const started=performance.now(),tile=state.staticTiles[index],geometry=createTileGeometry(tile);
      state.cache.set(geometry.key,{key:geometry.key,tile:geometry.tile,triangles:geometry.triangles,surfaceHash:geometry.surfaceHash});
      let batch=batchGeometries.get(tile.batchKey);if(!batch)batchGeometries.set(tile.batchKey,batch=[]);batch.push(geometry);state.tileBuilds++;
      state.lastBuildMs=performance.now()-started;state.maxBuildMs=Math.max(state.maxBuildMs,state.lastBuildMs);state.maxCacheTiles=Math.max(state.maxCacheTiles,state.cache.size);
      if((index+1)%STATIC_BOOT_BATCH===0)await wait(0);
    }
    let batchIndex=0;
    for(const [key,geometries] of batchGeometries){state.batchCache.set(key,uploadBatchMesh(key,geometries));if(++batchIndex%16===0)await wait(0);}
    state.staticBuildMs=performance.now()-allStarted;
    state.staticGeometryHash=hashTokens([...state.cache.values()].sort((a,b)=>a.key.localeCompare(b.key)).map(mesh=>`${mesh.key}:${mesh.surfaceHash};`));
    state.readyTileBuilds=state.tileBuilds;
  }

  function updateSpeed(now){
    const runtime=runtimeState(),position=runtime?.position;if(!position)return;
    const geo=geoFromLocal(position.x,position.z),commanded=Math.abs(Number(runtime.adventureCurrentSpeed)||0);
    if(state.lastGeo){
      const dt=Math.max(.001,(now-state.lastFrameAt)/1000),instant=clamp(haversineKm(state.lastGeo,geo)*U/dt,0,420),target=Math.max(commanded,instant);
      state.speedEstimate+= (target-state.speedEstimate)*(1-Math.exp(-dt*(target>state.speedEstimate?10:3.5)));
    }else state.speedEstimate=commanded;
    state.lastGeo=geo;state.lastFrameAt=now;state.prefetchLead=0;
  }
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  function selectionFor(geo,altitude){
    const cameraDirection=core.latLonToUnit(geo.lat,geo.lon),safeAltitude=Math.max(.8,Number(altitude)||0),horizonCos=clamp(EARTH_U/(EARTH_U+safeAltitude),-1,1),horizonSin=Math.sqrt(Math.max(0,1-horizonCos*horizonCos)),selected=[];
    for(const tile of state.staticTiles){
      if(dot(cameraDirection,tile.center)>=horizonCos*tile.visibilityCos-horizonSin*tile.visibilitySin)selected.push(tile);
    }
    return selected;
  }
  function updateSelection(now,force=false){
    if(smoothPlanet&&state.renderMeshes.length){state.lastSelectionAt=now;return;}
    if(!force&&now-state.lastSelectionAt<120)return;
    const runtime=runtimeState(),position=runtime?.position;if(!position)return;
    const started=performance.now();
    const geo=geoFromLocal(position.x,position.z),altitude=Math.max(.8,Number(position.y)||0);
    // 0.27.4 always renders the same immutable full-planet mesh. No camera,
    // movement or altitude change is allowed to swap terrain underneath the user.
    const visible=smoothPlanet?state.staticTiles:selectionFor(geo,altitude);
    state.desired=new Map(visible.map(tile=>[tile.key,tile]));
    state.renderKeys=visible.map(tile=>tile.key);state.renderBatchKeys=[...new Set(visible.map(tile=>tile.batchKey))];state.renderMeshes=state.renderBatchKeys.map(key=>state.batchCache.get(key)).filter(Boolean);state.prefetch.clear();
    state.selectionMs=performance.now()-started;state.maxSelectionMs=Math.max(state.maxSelectionMs,state.selectionMs);
    state.lastSelectionAt=now;state.lodUpdates++;
  }

  function saveGeographicPosition(){
    if(!state.ready)return false;
    try{
      const runtime=runtimeState(),position=runtime?.position;if(!position)return false;
      const geo=geoFromLocal(position.x,position.z);
      localStorage.setItem(SAVE_KEY,JSON.stringify({schemaVersion:1,lat:geo.lat,lon:geo.lon,altitudeMeters:(Number(position.y)||0)/VERTICAL,localYUnits:Number(position.y)||0,heading:Number(runtime.playerFacing)||0,savedAt:Date.now()}));
      state.lastSaveAt=performance.now();return true;
    }catch{return false;}
  }
  function maybeRecenter(force=false){
    const runtime=runtimeState(),position=runtime?.position;
    const recenterDistance=position?Math.hypot(position.x,position.z):0;
    if(!position||(!force&&recenterDistance<RECENTER_DISTANCE))return false;
    state.lastRecenterDistance=recenterDistance;state.maxRecenterDistance=Math.max(state.maxRecenterDistance,recenterDistance);
    const old={...state.originGeo},next=geoFromLocal(position.x,position.z),heading=Number(runtime.playerFacing)||0,cameraYaw=Number(runtime.cameraYaw)||0;
    const reprojectAngle=angle=>{
      const aheadGeo=geoFromLocal(position.x+Math.sin(angle)*2,position.z+Math.cos(angle)*2),ahead=localFromGeoAt(next,aheadGeo.lat,aheadGeo.lon);
      return Math.atan2(ahead.x,ahead.z);
    };
    const nextHeading=reprojectAngle(heading),nextCameraYaw=reprojectAngle(cameraYaw);
    // Adventure fauna, NPCs and route points live in the regional tangent plane. Reproject
    // them before changing that plane so cylinders cannot stretch across the screen and
    // nearby content keeps the same geographic position after a floating-origin shift.
    plugin.rebaseRegionalEntities?.((x,z,yaw)=>{
      const geo=geoFromLocal(x,z),local=localFromGeoAt(next,geo.lat,geo.lon);
      if(Number.isFinite(yaw)){
        const aheadGeo=geoFromLocal(x+Math.sin(yaw)*2,z+Math.cos(yaw)*2),ahead=localFromGeoAt(next,aheadGeo.lat,aheadGeo.lon);
        local.heading=Math.atan2(ahead.x-local.x,ahead.z-local.z);
      }
      return local;
    });
    state.originGeo=next;
    const lonJump=Math.abs(wrapLon(next.lon-old.lon));
    if(lonJump>90&&Math.abs(old.lat)>70&&Math.abs(next.lat)>70)state.poleCrossings++;
    else if(lonJump>150)state.datelineCrossings++;
    if(smoothPlanet&&api.rebasePlanetFrame)api.rebasePlanetFrame(0,0,position.y,nextHeading,nextCameraYaw);
    else{api.setRegionalPosition?.(0,0,position.y);api.setHeading?.(nextHeading);}
    state.floatingOriginShifts++;
    if(!smoothPlanet)updateSelection(performance.now(),true);
    return true;
  }

  function beforeCameraFrame(now){
    if(!smoothPlanet||!state.ready)return false;
    state.lastPreCameraAt=Number(now)||performance.now();
    updateSpeed(state.lastPreCameraAt);
    return maybeRecenter(false);
  }

  const previousDraw=plugin.afterWorldDraw?.bind(plugin);
  plugin.afterWorldDraw=(now,eye,pv)=>{
    if(!window.__WAFT_PLANET_DEBUG_ISOLATE__)previousDraw?.(now,eye,pv);if(!state.ready)return;
    if(!smoothPlanet){updateSpeed(now);maybeRecenter();updateSelection(now);}
    else{
      const runtime=runtimeState(),distance=Math.hypot(Number(runtime?.position?.x)||0,Number(runtime?.position?.z)||0);
      if(distance>RECENTER_DISTANCE+.01)state.cameraFrameMismatches++;
    }
    const frame=core.tangentFrame(state.originGeo.lat,state.originGeo.lon),origin=frame.up.map(component=>component*EARTH_U);
    gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.FRONT);gl.disable(gl.BLEND);gl.depthMask(true);gl.useProgram(program);gl.uniformMatrix4fv(uniforms.pv,false,pv);gl.uniform3f(uniforms.eye,...eye);
    gl.uniform3f(uniforms.origin,...origin);gl.uniform3f(uniforms.east,...frame.east);gl.uniform3f(uniforms.north,...frame.north);gl.uniform3f(uniforms.up,...frame.up);
    const runtime=runtimeState(),altitude=Math.max(0,Number(runtime?.position?.y)||0);gl.uniform1f(uniforms.fogFar,Math.max(1200,1500+altitude*1.6));
    let triangles=0,drawCalls=0;
    for(const mesh of state.renderMeshes){gl.bindVertexArray(mesh.vao);gl.drawElements(gl.TRIANGLES,mesh.count,mesh.indexType,0);triangles+=mesh.triangles;drawCalls++;}
    gl.bindVertexArray(null);state.visibleTriangles=triangles;state.drawCalls=drawCalls;state.drawFrames++;
  };

  const uiStyle=document.createElement('style');uiStyle.id='waftPlanetUiClean0270';uiStyle.textContent='#waftIberiaAtlas,#waftSpecialMarkers,#waftStreamHint,#presets,#waftWorldLabels0249,#waftFranceBadge0246,#waftProgress{display:none!important}';document.head.appendChild(uiStyle);
  function updateHud(){
    if(!state.ready)return;
    const runtime=runtimeState(),position=runtime?.position,geo=position?geoFromLocal(position.x,position.z):state.originGeo;
    const title=document.getElementById('hudTitle'),stats=document.getElementById('hudStats'),coords=document.getElementById('waftIberiaCoords'),objective=document.getElementById('waftObjective');
    if(title)title.textContent=smoothPlanet?'MUNDO · PLANETA 0.27.4 FLUIDO':'MUNDO · PLANETA 0.27.3 EXP';
    if(stats)stats.textContent=`CUBE-SPHERE FIJA · ${Math.round(state.visibleTriangles/1000)}k tri · ${state.renderKeys.length}/${state.staticTiles.length} tiles`;
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

  function anchorTileSnapshot(){
    const runtime=runtimeState(),position=runtime?.position;if(!position)return null;
    const geo=geoFromLocal(position.x,position.z);
    let tile=null,key=null;
    for(let level=MAX_LEVEL;level>=0;level--){
      const candidate=core.tileContainingLatLon(geo.lat,geo.lon,level),candidateKey=core.tileKey(candidate);
      if(state.desired.has(candidateKey)){tile=candidate;key=candidateKey;break;}
    }
    if(!tile){tile=core.tileContainingLatLon(geo.lat,geo.lon,0);key=core.tileKey(tile);}
    const mesh=state.cache.get(key);
    return{key,level:tile.level,resident:Boolean(mesh),surfaceHash:mesh?.surfaceHash||null,lat:geo.lat,lon:geo.lon};
  }

  const compat={
    worldFromGeo:(lat,lon)=>localFromGeo(lat,lon),geoFromWorld:(x,z)=>geoFromLocal(x,z),sampleSurface,
    getState:()=>({ready:state.ready,phase:state.phase,activeRegion:'planet-world',renderMode:'cube-sphere-quadtree',prefetched:state.ready,atlasReady:state.ready,atlasTriangles:state.visibleTriangles,atlasDrawFrames:state.drawFrames,atlasVerticalScale:VERTICAL,geo:state.lastGeo,error:state.error,speedEstimate:state.speedEstimate,prefetchLead:state.prefetchLead,floatingOriginShifts:state.floatingOriginShifts,poleCrossings:state.poleCrossings,datelineCrossings:state.datelineCrossings,visibleTiles:state.renderKeys.length,desiredTiles:state.desired.size,cacheTiles:state.cache.size}),
    prefetchFrance:async()=>true,nearFrance:()=>false,inFranceGeo:()=>false,franceSouthLat:()=>42.3
  };
  window.WAFTWorldStreaming0245=compat;window.WAFTWorldContinuity0247={getState:compat.getState,prefetchCanarias:async()=>true,inCanarias:()=>false};
  window.WAFTPlanetWorld0270={getState:()=>({...compat.getState(),originGeo:{...state.originGeo},tileBuilds:state.tileBuilds,tileBuildsDuringGameplay:Math.max(0,state.tileBuilds-state.readyTileBuilds),tileEvictions:state.tileEvictions,lodUpdates:state.lodUpdates,prefetchTiles:state.prefetch.size,residentDesiredTiles:[...state.desired.keys()].filter(key=>state.cache.has(key)).length,residentPrefetchTiles:0,desiredTileKeys:[...state.desired.keys()].sort(),renderTileKeys:[...state.renderKeys].sort(),renderBatchKeys:[...state.renderBatchKeys].sort(),terrainFingerprint:terrainFingerprint(),anchorTile:anchorTileSnapshot(),coastlineScale:'50m',coastlinePolygons:state.landMask?.polygons.length||0,coastlineEdgeBins:LAND_EDGE_BIN_COUNT,cacheLimit:STATIC_TILE_LIMIT,buildQueue:0,lastBuildMs:state.lastBuildMs,maxBuildMs:state.maxBuildMs,maxCacheTiles:state.maxCacheTiles,selectionMs:state.selectionMs,maxSelectionMs:state.maxSelectionMs,drawCalls:state.drawCalls,selectionProfile:smoothPlanet?'fixed-full-planet-v4':'fixed-geographic-quadtree-v3',staticTiles:state.staticTiles.length,staticBatches:state.batchCache.size,staticPlanHash:state.staticPlanHash,staticGeometryHash:state.staticGeometryHash,staticBuildMs:state.staticBuildMs,smoothPlanet,softwareRenderer,gpuRenderer,cameraFrameMismatches:state.cameraFrameMismatches,lastPreCameraAt:state.lastPreCameraAt,lastRecenterDistance:state.lastRecenterDistance,maxRecenterDistance:state.maxRecenterDistance,refinementZones:STATIC_REFINEMENT_ZONES.map(zone=>({...zone}))}),worldFromGeo:compat.worldFromGeo,geoFromWorld:compat.geoFromWorld,sampleSurface,destination,normalizeGeo,saveGeographicPosition,recenterAtCurrentPosition:()=>maybeRecenter(true),refreshSelection:()=>updateSelection(performance.now(),true),beforeCameraFrame};
  window.WAFTGlobalAtlas0260=window.WAFTPlanetWorld0270;

  try{
    state.phase='loading';const globalBase='../../regions/global-atlas/',europeBase='../../regions/europe-atlas/';
    const [globalTerrain,globalCover,europeTerrain,europeCover,landMask]=await Promise.all([loadBuffer(globalBase+'terrain.bin'),loadBuffer(globalBase+'landcover.bin'),loadBuffer(europeBase+'terrain.bin'),loadBuffer(europeBase+'landcover.bin'),loadBuffer('./planet-0270/land-50m.bin')]);
    state.terrain=parseTerrain(globalTerrain);state.cover=parseCover(globalCover);state.europeTerrain=parseTerrain(europeTerrain);state.europeCover=parseCover(europeCover);state.landMask=parseLandMask(landMask);
    const runtime=runtimeState(),position=runtime?.position;
    if(restoredLocation&&position)api.setRegionalPosition?.(0,0,Number.isFinite(restoredLocation.localYUnits)?restoredLocation.localYUnits:position.y);
    if(restoredLocation&&Number.isFinite(restoredLocation.heading))api.setHeading?.(restoredLocation.heading);
    state.phase='building-static-planet';await buildStaticPlanet();
    state.ready=true;state.phase='ready';api.releaseRegionalTerrainGpu?.();updateSelection(performance.now(),true);window.__WAFT_PLANET_WORLD_0270_READY__=true;window.__WAFT_GLOBAL_ATLAS_0260_READY__=true;
    updateHud();setInterval(updateHud,250);setInterval(saveGeographicPosition,30000);addEventListener('beforeunload',saveGeographicPosition);document.addEventListener('visibilitychange',()=>{if(document.hidden)saveGeographicPosition();});
  }catch(error){state.error=String(error?.stack||error);state.phase='error';console.error(error);}
})();
