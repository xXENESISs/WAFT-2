'use strict';
(async()=>{
  if(window.__WAFT_IBERIA_WORLD_0245_READY__||window.__WAFT_EUROPE_ATLAS_0252_ACTIVE__)return;

  const waitFor=async(test,timeout=30000)=>{const start=performance.now();while(!test()){if(performance.now()-start>timeout)throw new Error('Timeout esperando runtime 0.24.5');await new Promise(r=>setTimeout(r,40));}};
  await waitFor(()=>window.WAFTRegionRuntime&&window.WAFTAdventurePlugin&&document.querySelector('canvas'));

  const api=window.WAFTRegionRuntime;
  const plugin=window.WAFTAdventurePlugin;
  const canvas=document.querySelector('canvas');
  const gl=canvas.getContext('webgl2');
  if(!gl)throw new Error('WebGL2 no disponible para streaming 0.24.5');

  const VERSION=new URL(document.currentScript?.src||location.href).searchParams.get('v')||'0.26.0';
  const U=Number(api.metadata?.projection?.unitsPerKm)||.30;
  const I={lat0:39.775,lon0:-3.125,kmLat:111.132,kmLon:85.55640544079021};
  const LOD_MIN_LAT=43.62;
  const BORDER_OVERLAP=.055;
  const PAGE_INSTANCE_ID=window.__WAFT_PAGE_INSTANCE_0245__||(window.__WAFT_PAGE_INSTANCE_0245__=`waft-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const franceSouthLat=lon=>{
    if(lon<-5.2)return 49.0;
    if(lon<-2.05)return 43.72+(-2.05-lon)*1.55;
    if(lon<-1.55)return 43.58;
    if(lon<-.65)return 43.58-(lon+1.55)*.62;
    if(lon<1.55)return 42.90-(lon+.65)*.12;
    if(lon<3.35)return 42.64-(lon-1.55)*.10;
    return 42.90;
  };
  const inFranceGeo=geo=>Boolean(geo&&geo.lon>-5.7&&geo.lon<9.8&&geo.lat>=franceSouthLat(geo.lon));
  const nearFrance=(geo,margin=.65)=>Boolean(geo&&geo.lon>-5.7&&geo.lon<9.8&&geo.lat>=franceSouthLat(geo.lon)-margin);
  const deepFrance=geo=>inFranceGeo(geo)&&geo.lat>=franceSouthLat(geo.lon)+1.10;
  const worldFromGeo=(lat,lon)=>({x:(lon-I.lon0)*I.kmLon*U,z:-(lat-I.lat0)*I.kmLat*U});
  const geoFromWorld=(x,z)=>({lat:I.lat0-z/(I.kmLat*U),lon:I.lon0+x/(I.kmLon*U)});

  const state={
    phase:'idle',activeRegion:'iberia',prefetched:false,prefetchStarted:false,error:null,
    terrain:null,landcover:null,manifest:null,mesh:null,renderMode:'none',drawFrames:0,lastDrawTriangles:0,
    iberiaGpuReleased:false,franceBytes:0,transition:null,lastGeo:null,pageInstanceId:PAGE_INSTANCE_ID,lastVisible:false
  };

  function parseTerrain(buffer){
    const view=new DataView(buffer),magic=new TextDecoder().decode(new Uint8Array(buffer,0,8));
    if(magic!=='WAFTHGT1')throw new Error(`France terrain magic ${magic}`);
    const headerBytes=view.getUint16(10,true),columns=view.getUint16(12,true),rows=view.getUint16(14,true);
    const west=view.getFloat64(16,true),east=view.getFloat64(24,true),south=view.getFloat64(32,true),north=view.getFloat64(40,true),nodata=view.getInt32(56,true);
    return{headerBytes,columns,rows,west,east,south,north,nodata,elevations:new Int16Array(buffer,headerBytes,columns*rows)};
  }
  function parseLandcover(buffer){
    const view=new DataView(buffer),magic=new TextDecoder().decode(new Uint8Array(buffer,0,8));
    if(magic!=='WAFTLCV1')throw new Error(`France landcover magic ${magic}`);
    const headerBytes=view.getUint16(10,true),columns=view.getUint16(12,true),rows=view.getUint16(14,true);
    return{columns,rows,classes:new Uint8Array(buffer,headerBytes,columns*rows)};
  }

  const palette=[
    [.026,.17,.30],[.73,.61,.35],[.42,.43,.41],[.31,.47,.19],[.055,.29,.12],
    [.50,.53,.20],[.45,.44,.40],[.16,.39,.28],[.49,.40,.29],[.38,.56,.20]
  ];
  const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const log=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw new Error(log||'Shader France inválido');}return shader;};
  const makeProgram=()=>{
    const vs=compile(gl.VERTEX_SHADER,`#version 300 es
      layout(location=0) in vec3 aPosition;layout(location=1) in vec3 aColor;
      uniform mat4 uPV;uniform float uVerticalScale;uniform float uLift;out vec3 vColor;out vec3 vWorld;
      void main(){vWorld=vec3(aPosition.x,aPosition.y*uVerticalScale+uLift,aPosition.z);vColor=aColor;gl_Position=uPV*vec4(vWorld,1.0);}`);
    const fs=compile(gl.FRAGMENT_SHADER,`#version 300 es
      precision highp float;in vec3 vColor;in vec3 vWorld;uniform vec3 uCamera;out vec4 outColor;
      void main(){float altitude=clamp(vWorld.y/95.0,0.0,1.0);float detail=.94+.06*sin(vWorld.x*.31+vWorld.z*.23);vec3 base=mix(vColor*vec3(1.06,1.02,.92),vColor*vec3(.84,.94,1.06),altitude*.30)*detail;float fog=smoothstep(310.0,820.0,distance(vWorld.xz,uCamera.xz));outColor=vec4(mix(base,vec3(.39,.555,.655),fog),1.0);}`);
    const p=gl.createProgram();gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(p,gl.LINK_STATUS)){const log=gl.getProgramInfoLog(p);gl.deleteProgram(p);throw new Error(log||'Programa France inválido');}return p;
  };
  const program=makeProgram();
  const uniforms={pv:gl.getUniformLocation(program,'uPV'),vertical:gl.getUniformLocation(program,'uVerticalScale'),lift:gl.getUniformLocation(program,'uLift'),camera:gl.getUniformLocation(program,'uCamera')};

  function sampledIndices(total,stride,endInclusive=total-1){
    const out=[];for(let i=0;i<=endInclusive;i+=stride)out.push(i);if(out[out.length-1]!==endInclusive)out.push(endInclusive);return out;
  }
  function buildMesh(stride=5,minLat=null){
    const t=state.terrain,lc=state.landcover;if(!t||!lc)throw new Error('France no está prefetched');
    const endRow=minLat==null?t.rows-1:clamp(Math.floor((t.north-minLat)/(t.north-t.south)*(t.rows-1)),1,t.rows-1);
    const rows=sampledIndices(t.rows,stride,endRow),cols=sampledIndices(t.columns,stride,t.columns-1);
    const vertexCount=rows.length*cols.length,positions=new Float32Array(vertexCount*3),colors=new Float32Array(vertexCount*3),geoGrid=new Array(vertexCount);
    let cursor=0,vertex=0;
    for(const row of rows){
      const lat=t.north-(row/(t.rows-1))*(t.north-t.south);
      for(const col of cols){
        const lon=t.west+(col/(t.columns-1))*(t.east-t.west),idx=row*t.columns+col,raw=t.elevations[idx],water=raw===t.nodata,world=worldFromGeo(lat,lon),color=palette[lc.classes[idx]]||palette[0];
        positions[cursor]=world.x;positions[cursor+1]=water?-8:raw;positions[cursor+2]=world.z;
        colors[cursor]=color[0];colors[cursor+1]=color[1];colors[cursor+2]=color[2];geoGrid[vertex++]={lat,lon};cursor+=3;
      }
    }
    const indices=[];
    for(let r=0;r<rows.length-1;r++)for(let c=0;c<cols.length-1;c++){
      const a=r*cols.length+c,b=a+1,d=a+cols.length,e=d+1;
      const centerLat=(geoGrid[a].lat+geoGrid[b].lat+geoGrid[d].lat+geoGrid[e].lat)*.25;
      const centerLon=(geoGrid[a].lon+geoGrid[b].lon+geoGrid[d].lon+geoGrid[e].lon)*.25;
      if(centerLat<franceSouthLat(centerLon)-BORDER_OVERLAP)continue;
      indices.push(a,d,b,b,d,e);
    }
    const indexData=new Uint32Array(indices);
    const vao=gl.createVertexArray();gl.bindVertexArray(vao);
    const positionBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,positionBuffer);gl.bufferData(gl.ARRAY_BUFFER,positions,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);
    const colorBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,colorBuffer);gl.bufferData(gl.ARRAY_BUFFER,colors,gl.STATIC_DRAW);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,0,0);
    const indexBuffer=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indexData,gl.STATIC_DRAW);gl.bindVertexArray(null);
    return{vao,buffers:[positionBuffer,colorBuffer,indexBuffer],count:indexData.length,triangles:indexData.length/3,stride,minLat,mode:stride===1?'france-full':'france-lod',lift:stride===1?0:-.08};
  }
  function disposeMesh(mesh){if(!mesh)return;try{if(mesh.vao)gl.deleteVertexArray(mesh.vao);for(const buffer of mesh.buffers||[])if(buffer)gl.deleteBuffer(buffer);}catch{} }
  function setMesh(mesh){disposeMesh(state.mesh);state.mesh=mesh;state.renderMode=mesh?.mode||'none';}

  async function fetchChecked(url,type='arrayBuffer'){
    const join=url.includes('?')?'&':'?';const response=await fetch(`${url}${join}v=${encodeURIComponent(VERSION)}`,{cache:'no-store'});if(!response.ok)throw new Error(`${response.status} al cargar ${url}`);return type==='json'?response.json():response.arrayBuffer();
  }
  async function prefetchFrance(){
    if(state.prefetchStarted)return state.prefetchPromise;
    state.prefetchStarted=true;state.phase='prefetching';
    state.prefetchPromise=(async()=>{
      const [manifest,terrainBuffer,landcoverBuffer]=await Promise.all([
        fetchChecked('../regions/france/manifest.json','json'),fetchChecked('../regions/france/terrain.bin'),fetchChecked('../regions/france/landcover.bin')
      ]);
      const terrain=parseTerrain(terrainBuffer),landcover=parseLandcover(landcoverBuffer);
      if(terrain.columns!==landcover.columns||terrain.rows!==landcover.rows)throw new Error('France terrain/landcover incompatibles');
      if(manifest?.region?.id!=='france'||Math.abs(Number(manifest?.projection?.unitsPerKm)-U)>.0001)throw new Error('Manifest France incompatible con la escala mundial');
      state.manifest=manifest;state.terrain=terrain;state.landcover=landcover;state.franceBytes=terrainBuffer.byteLength+landcoverBuffer.byteLength;state.prefetched=true;
      setMesh(buildMesh(4,LOD_MIN_LAT));state.phase='lod-ready';return true;
    })().catch(error=>{state.phase='error';state.error=String(error?.message||error);throw error;});
    return state.prefetchPromise;
  }

  function rawAt(col,row){const t=state.terrain;col=clamp(col,0,t.columns-1);row=clamp(row,0,t.rows-1);return t.elevations[row*t.columns+col];}
  function sampleFrance(x,z){
    if(!state.prefetched)return null;
    const geo=geoFromWorld(x,z),t=state.terrain;
    if(!inFranceGeo(geo)||geo.lat>t.north||geo.lon<t.west||geo.lon>t.east)return null;
    const fx=(geo.lon-t.west)/(t.east-t.west)*(t.columns-1),fz=(t.north-geo.lat)/(t.north-t.south)*(t.rows-1);
    if(fx<0||fz<0||fx>t.columns-1||fz>t.rows-1)return null;
    const col=Math.round(fx),row=Math.round(fz),raw=rawAt(col,row),vertical=Number(api.metadata?.terrain?.verticalScale)||.0138,waterHeight=-8*vertical,land=raw!==t.nodata;
    return{inside:true,land,water:!land,height:land?raw*vertical:waterHeight,waterHeight,normal:{x:0,y:1,z:0},slopeAngle:0,streamedRegion:'france',lat:geo.lat,lon:geo.lon};
  }

  function transitionSnapshot(before,after,kind){
    const game=window.__WAFT_INTERNAL_GAME__;
    return{kind,at:Date.now(),altitudeBefore:before?.position?.y??null,altitudeAfter:after?.position?.y??null,speedBefore:before?.adventureCurrentSpeed??null,speedAfter:after?.adventureCurrentSpeed??null,mountBefore:game?.mountedAnimalId||null,mountAfter:game?.mountedAnimalId||null};
  }
  function activateFranceFull(){
    if(!state.prefetched||state.renderMode==='france-full')return;
    const before=api.getState?.();
    try{
      const released=api.releaseRegionalTerrainGpu?.()||0;state.iberiaGpuReleased=released>0||Boolean(api.getState?.().adventureRegionalTerrainReleased);
      setMesh(null);setMesh(buildMesh(1,null));state.phase='france-full';state.activeRegion='france';
      const after=api.getState?.();state.transition=transitionSnapshot(before,after,'iberia-to-france');
    }catch(error){try{api.restoreRegionalTerrainGpu?.();state.iberiaGpuReleased=false;if(!state.mesh)setMesh(buildMesh(4,LOD_MIN_LAT));}catch{}state.phase='error';state.error=String(error?.message||error);throw error;}
  }
  function restoreIberiaOverlap(){
    if(!state.iberiaGpuReleased)return;
    const before=api.getState?.();
    try{
      api.restoreRegionalTerrainGpu?.();state.iberiaGpuReleased=false;setMesh(buildMesh(4,LOD_MIN_LAT));state.phase='lod-ready';state.activeRegion='iberia';
      state.transition=transitionSnapshot(before,api.getState?.(),'france-to-iberia');
    }catch(error){state.phase='error';state.error=String(error?.message||error);throw error;}
  }

  const previousDraw=typeof plugin.afterWorldDraw==='function'?plugin.afterWorldDraw.bind(plugin):null;
  plugin.afterWorldDraw=(now,eye,pv)=>{
    previousDraw?.(now,eye,pv);
    const player=api.getState?.(),geo=player?.position?geoFromWorld(player.position.x,player.position.z):null;
    const mesh=state.mesh;state.lastVisible=Boolean(mesh?.vao&&nearFrance(geo,.55)&&geo?.lat>=43.56);if(!state.lastVisible)return;
    gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.useProgram(program);gl.uniformMatrix4fv(uniforms.pv,false,pv);gl.uniform1f(uniforms.vertical,Number(api.metadata?.terrain?.verticalScale)||.0138);gl.uniform1f(uniforms.lift,mesh.lift||0);gl.uniform3f(uniforms.camera,...eye);gl.bindVertexArray(mesh.vao);gl.drawElements(gl.TRIANGLES,mesh.count,gl.UNSIGNED_INT,0);gl.bindVertexArray(null);state.drawFrames++;state.lastDrawTriangles=mesh.triangles;
  };

  const streamApi=window.WAFTWorldStreaming0245={
    sampleSurface(x,z){return sampleFrance(Number(x),Number(z));},
    prefetchFrance,
    worldFromGeo(lat,lon){return worldFromGeo(Number(lat),Number(lon));},
    geoFromWorld(x,z){return geoFromWorld(Number(x),Number(z));},
    franceSouthLat,
    inFranceGeo,
    nearFrance,
    getState(){const player=api.getState?.(),geo=player?.position?geoFromWorld(player.position.x,player.position.z):null;return{phase:state.phase,activeRegion:state.activeRegion,prefetched:state.prefetched,prefetchStarted:state.prefetchStarted,renderMode:state.renderMode,franceGpuTriangles:state.mesh?.triangles||0,franceStride:state.mesh?.stride||null,franceDrawFrames:state.drawFrames,lastDrawTriangles:state.lastDrawTriangles,franceVisible:state.lastVisible,iberiaGpuReleased:state.iberiaGpuReleased,franceBytes:state.franceBytes,transition:state.transition,error:state.error,geo,pageInstanceId:PAGE_INSTANCE_ID};}
  };

  const status=document.createElement('div');status.id='waftWorldStream0245';status.style.cssText='position:fixed;left:max(8px,env(safe-area-inset-left));bottom:max(7px,env(safe-area-inset-bottom));z-index:18;padding:5px 8px;border-radius:9px;background:rgba(4,17,23,.76);border:1px solid rgba(155,218,196,.32);font:700 9px/1.25 system-ui;color:#dff5ed;pointer-events:none;max-width:55vw';document.body.appendChild(status);
  let busy=false;
  const tick=async()=>{
    if(busy)return;busy=true;
    try{
      const player=api.getState?.();if(!player?.position)return;
      const geo=geoFromWorld(player.position.x,player.position.z);state.lastGeo=geo;
      if(nearFrance(geo,.75)&&!state.prefetchStarted)prefetchFrance().catch(()=>{});
      if(state.prefetched){
        const inside=inFranceGeo(geo),deep=deepFrance(geo),south=franceSouthLat(geo.lon);
        state.activeRegion=inside?'france':'iberia';
        if(deep&&!state.iberiaGpuReleased)activateFranceFull();
        else if((!inside||geo.lat<=south+.72)&&state.iberiaGpuReleased)restoreIberiaOverlap();
      }
      const label=state.phase==='prefetching'?'FRANCE · precargando':state.renderMode==='france-full'?'FRANCE · terreno completo':state.renderMode==='france-lod'?'FRANCE · LOD preparado':'IBERIA';
      status.textContent=`MUNDO · ${state.activeRegion.toUpperCase()} · ${label}${state.error?' · ERROR':''}`;
    }finally{busy=false;}
  };
  setInterval(()=>{tick().catch(error=>{state.error=String(error?.message||error);state.phase='error';console.error(error);});},180);
  tick().catch(console.error);

  window.__WAFT_IBERIA_WORLD_0245_READY__=true;
})();