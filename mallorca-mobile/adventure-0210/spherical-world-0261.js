'use strict';
(async()=>{
  if(window.__WAFT_SPHERICAL_WORLD_0261_READY__||window.__WAFT_ADVENTURE_REGION__!=='iberia')return;
  window.__WAFT_SPHERICAL_WORLD_0261_ACTIVE__=true;
  window.__WAFT_GLOBAL_ATLAS_0260_ACTIVE__=true;
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  for(let i=0;i<750&&(!window.WAFTRegionRuntime||!window.WAFTAdventurePlugin||!document.querySelector('canvas'));i++)await wait(40);
  const api=window.WAFTRegionRuntime,plugin=window.WAFTAdventurePlugin,canvas=document.querySelector('canvas'),gl=canvas?.getContext('webgl2');
  if(!api||!plugin||!gl)throw new Error('WAFT 0.26.1 spherical runtime unavailable');

  // WAFT_SPHERICAL_UI_CLEAN_0261: regional navigation/UI cannot follow a floating origin around the planet.
  const sphericalUiStyle=document.createElement('style');
  sphericalUiStyle.id='waftSphericalUiClean0261';
  sphericalUiStyle.textContent='#waftIberiaAtlas,#waftSpecialMarkers,#waftStreamHint,#presets,#waftWorldLabels0249,#waftFranceBadge0246,#waftRegionBadge0247,#waftProgress{display:none!important}';
  document.head.appendChild(sphericalUiStyle);

  const U=.33,VERTICAL=.0028,WATER_METERS=-20,EARTH_KM=6371.0088,EARTH_U=EARTH_KM*U;
  const DEG=Math.PI/180,RAD=180/Math.PI;
  const PATCH_N=241,PATCH_HALF=900,RECENTER=480,REBUILD_DISTANCE=170;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const wrapLon=lon=>((Number(lon)+180)%360+360)%360-180;
  const normalizeGeo=(lat,lon)=>{
    lat=Number(lat)||0;lon=Number(lon)||0;
    let guard=0;
    while((lat>90||lat<-90)&&guard++<12){
      if(lat>90){lat=180-lat;lon+=180;}
      else if(lat<-90){lat=-180-lat;lon+=180;}
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
  const legacyP={lat0:39.775,lon0:-3.125,kmLat:111.132,kmLon:85.55640544079021};
  const legacyGeo=(x,z)=>normalizeGeo(legacyP.lat0-Number(z)/(legacyP.kmLat*U),legacyP.lon0+Number(x)/(legacyP.kmLon*U));

  const start=api.getState?.()?.position||{x:0,y:3,z:0};
  const state={ready:false,phase:'boot',originGeo:{lat:legacyP.lat0,lon:legacyP.lon0},terrain:null,cover:null,europeTerrain:null,europeCover:null,mesh:null,cityMesh:null,objects:[],drawFrames:0,triangles:0,visibleCities:0,patchRebuilds:0,floatingOriginShifts:0,poleCrossings:0,datelineCrossings:0,speedEstimate:0,prefetchLead:180,lastGeo:null,lastFrameAt:performance.now(),lastBuildPlayer:{x:Infinity,z:Infinity},lastBuildHeading:0,lastBuildAt:0,error:null};

  const geoFromLocal=(x,z)=>{
    const dU=Math.hypot(Number(x)||0,Number(z)||0);if(dU<1e-7)return{...state.originGeo};
    const br=Math.atan2(Number(x)||0,-(Number(z)||0));return destination(state.originGeo,br,dU/U);
  };
  const localFromGeo=(lat,lon)=>{
    const g=normalizeGeo(lat,lon),d=haversineKm(state.originGeo,g)*U,br=bearing(state.originGeo,g);
    return{x:Math.sin(br)*d,z:-Math.cos(br)*d};
  };
  const worldFromGeo=(lat,lon)=>localFromGeo(lat,lon);
  const geoFromWorld=(x,z)=>geoFromLocal(x,z);

  const loadJson=p=>fetch(new URL(p,location.href),{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`${r.status} ${p}`);return r.json();});
  const loadBuffer=p=>fetch(new URL(p,location.href),{cache:'force-cache'}).then(r=>{if(!r.ok)throw new Error(`${r.status} ${p}`);return r.arrayBuffer();});
  function parseTerrain(buffer){const v=new DataView(buffer),magic=new TextDecoder().decode(new Uint8Array(buffer,0,8));if(magic!=='WAFTHGT1')throw new Error(`terrain magic ${magic}`);const h=v.getUint16(10,true),columns=v.getUint16(12,true),rows=v.getUint16(14,true);return{headerBytes:h,columns,rows,west:v.getFloat64(16,true),east:v.getFloat64(24,true),south:v.getFloat64(32,true),north:v.getFloat64(40,true),nodata:v.getInt32(56,true),elevations:new Int16Array(buffer,h,columns*rows)};}
  function parseCover(buffer){const v=new DataView(buffer),magic=new TextDecoder().decode(new Uint8Array(buffer,0,8));if(magic!=='WAFTLCV1')throw new Error(`cover magic ${magic}`);const h=v.getUint16(10,true),columns=v.getUint16(12,true),rows=v.getUint16(14,true);return{columns,rows,classes:new Uint8Array(buffer,h,columns*rows)};}
  const inDataset=(t,g)=>t&&g.lat>=t.south&&g.lat<=t.north&&g.lon>=t.west&&g.lon<=t.east;
  function sampleDataset(t,cover,g){
    if(!inDataset(t,g))return null;
    const fx=(g.lon-t.west)/(t.east-t.west)*(t.columns-1),fz=(t.north-g.lat)/(t.north-t.south)*(t.rows-1),c0=clamp(Math.floor(fx),0,t.columns-1),r0=clamp(Math.floor(fz),0,t.rows-1),c1=Math.min(t.columns-1,c0+1),r1=Math.min(t.rows-1,r0+1),tx=fx-c0,tz=fz-r0;
    const at=(c,r)=>t.elevations[r*t.columns+c],near=at(clamp(Math.round(fx),0,t.columns-1),clamp(Math.round(fz),0,t.rows-1));
    if(near===t.nodata)return{land:false,meters:WATER_METERS,cover:0};
    const val=(c,r)=>{const v=at(c,r);return v===t.nodata?near:v;},h00=val(c0,r0),h10=val(c1,r0),h01=val(c0,r1),h11=val(c1,r1),meters=(h00*(1-tx)+h10*tx)*(1-tz)+(h01*(1-tx)+h11*tx)*tz,ci=clamp(Math.round(fx),0,t.columns-1),ri=clamp(Math.round(fz),0,t.rows-1),klass=cover?.classes?.[ri*t.columns+ci]??3;
    return{land:true,meters,cover:klass};
  }
  const sampleGeo=g=>sampleDataset(state.europeTerrain,state.europeCover,g)||sampleDataset(state.terrain,state.cover,g)||{land:false,meters:WATER_METERS,cover:0};
  function sampleSurface(x,z){const g=geoFromLocal(x,z),s=sampleGeo(g),height=s.meters*VERTICAL,waterHeight=WATER_METERS*VERTICAL;return{inside:true,land:s.land,water:!s.land,height:s.land?height:waterHeight,waterHeight,normal:{x:0,y:1,z:0},slopeAngle:0,streamedRegion:inDataset(state.europeTerrain,g)?'spherical-europe-detail':'spherical-global',lat:g.lat,lon:g.lon};}

  const palette=[[.026,.17,.30],[.73,.61,.35],[.42,.43,.41],[.31,.47,.19],[.055,.29,.12],[.50,.53,.20],[.45,.44,.40],[.16,.39,.28],[.49,.40,.29],[.38,.56,.20]];
  const compile=(type,src)=>{const sh=gl.createShader(type);gl.shaderSource(sh,src);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh)||'shader');return sh;};
  const vs=compile(gl.VERTEX_SHADER,`#version 300 es\nlayout(location=0)in vec3 aP;layout(location=1)in vec3 aN;layout(location=2)in vec3 aC;uniform mat4 uPV;uniform vec2 uPlayerXZ;uniform float uRadius;out vec3 vN;out vec3 vC;out vec3 vW;void main(){vec2 d=aP.xz-uPlayerXZ;float curve=dot(d,d)/(2.0*uRadius);vW=vec3(aP.x,aP.y-curve,aP.z);vN=normalize(vec3(aN.x,aN.y+length(d)/uRadius,aN.z));vC=aC;gl_Position=uPV*vec4(vW,1.0);}`);
  const fs=compile(gl.FRAGMENT_SHADER,`#version 300 es\nprecision highp float;in vec3 vN;in vec3 vC;in vec3 vW;uniform vec3 uEye;out vec4 o;void main(){vec3 light=normalize(vec3(-.42,.86,.28));float nd=max(dot(normalize(vN),light),0.0);float slope=1.0-clamp(normalize(vN).y,0.0,1.0);float d=.52+.43*nd-.08*slope;float fog=smoothstep(600.0,1050.0,distance(vW.xz,uEye.xz));vec3 c=vC*d;o=vec4(mix(c,vec3(.39,.555,.655),fog*.82),1.0);}`);
  const program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||'program');
  const uPV=gl.getUniformLocation(program,'uPV'),uEye=gl.getUniformLocation(program,'uEye'),uPlayerXZ=gl.getUniformLocation(program,'uPlayerXZ'),uRadius=gl.getUniformLocation(program,'uRadius');

  function disposeMesh(mesh){if(!mesh)return;try{gl.deleteVertexArray(mesh.vao);for(const b of mesh.buffers)gl.deleteBuffer(b);}catch{}}
  function buildPatch(playerX,playerZ,heading,speed){
    const lead=clamp(speed*6,180,700),bias=Math.min(360,lead*.55),cx=playerX+Math.sin(heading)*bias,cz=playerZ+Math.cos(heading)*bias,n=PATCH_N,count=n*n,pos=new Float32Array(count*3),norm=new Float32Array(count*3),col=new Float32Array(count*3),heights=new Float32Array(count);let p=0;
    for(let r=0;r<n;r++){const z=cz-PATCH_HALF+r/(n-1)*PATCH_HALF*2;for(let c=0;c<n;c++){const x=cx-PATCH_HALF+c/(n-1)*PATCH_HALF*2,g=geoFromLocal(x,z),s=sampleGeo(g),h=(s.land?s.meters:WATER_METERS)*VERTICAL,clr=palette[s.cover]||palette[s.land?3:0],i=r*n+c;heights[i]=h;pos[p]=x;pos[p+1]=h;pos[p+2]=z;col[p]=clr[0];col[p+1]=clr[1];col[p+2]=clr[2];p+=3;}}
    p=0;const step=PATCH_HALF*2/(n-1);for(let r=0;r<n;r++)for(let c=0;c<n;c++){const l=heights[r*n+Math.max(0,c-1)],rr=heights[r*n+Math.min(n-1,c+1)],up=heights[Math.max(0,r-1)*n+c],dn=heights[Math.min(n-1,r+1)*n+c];let nx=-(rr-l)/(2*step),ny=1,nz=-(dn-up)/(2*step),len=Math.hypot(nx,ny,nz)||1;norm[p]=nx/len;norm[p+1]=ny/len;norm[p+2]=nz/len;p+=3;}
    const ind=new Uint32Array((n-1)*(n-1)*6);let q=0;for(let r=0;r<n-1;r++)for(let c=0;c<n-1;c++){const a=r*n+c,b=a+1,d=a+n,e=d+1;ind[q++]=a;ind[q++]=d;ind[q++]=b;ind[q++]=b;ind[q++]=d;ind[q++]=e;}
    const vao=gl.createVertexArray();gl.bindVertexArray(vao);const buffers=[],add=(slot,data)=>{const b=gl.createBuffer();buffers.push(b);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);gl.enableVertexAttribArray(slot);gl.vertexAttribPointer(slot,3,gl.FLOAT,false,0,0);};add(0,pos);add(1,norm);add(2,col);const ib=gl.createBuffer();buffers.push(ib);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,ind,gl.STATIC_DRAW);gl.bindVertexArray(null);return{vao,buffers,count:ind.length,triangles:ind.length/3,cx,cz,lead};
  }
  function rebuildPatch(force=false){const s=api.getState?.(),pos=s?.position;if(!pos||!state.ready)return;const h=Number(s.playerFacing)||0,desiredLead=clamp(state.speedEstimate*6,180,700),dc=state.mesh?Math.hypot(pos.x-state.lastBuildPlayer.x,pos.z-state.lastBuildPlayer.z):Infinity,dh=Math.abs(Math.atan2(Math.sin(h-state.lastBuildHeading),Math.cos(h-state.lastBuildHeading))),age=performance.now()-state.lastBuildAt;if(!force&&dc<REBUILD_DISTANCE&&dh<.30&&age<2600)return;const next=buildPatch(pos.x,pos.z,h,state.speedEstimate);disposeMesh(state.mesh);state.mesh=next;state.triangles=next.triangles;state.prefetchLead=desiredLead;state.lastBuildPlayer={x:pos.x,z:pos.z};state.lastBuildHeading=h;state.lastBuildAt=performance.now();state.patchRebuilds++;}

  function maybeRecenter(){const s=api.getState?.(),pos=s?.position;if(!pos||Math.hypot(pos.x,pos.z)<RECENTER)return false;const oldOrigin={...state.originGeo},newGeo=geoFromLocal(pos.x,pos.z),h=Number(s.playerFacing)||0,forwardGeo=geoFromLocal(pos.x+Math.sin(h)*2,pos.z+Math.cos(h)*2),geoBearing=bearing(newGeo,forwardGeo),newHeading=Math.atan2(Math.sin(Math.PI-geoBearing),Math.cos(Math.PI-geoBearing));const oldLon=oldOrigin.lon,oldLat=oldOrigin.lat;state.originGeo=newGeo;const lonJump=Math.abs(wrapLon(newGeo.lon-oldLon));if(lonJump>90&&Math.abs(oldLat)>70&&Math.abs(newGeo.lat)>70)state.poleCrossings++;else if(lonJump>150)state.datelineCrossings++;api.setRegionalPosition?.(0,0,pos.y);api.setHeading?.(newHeading);state.floatingOriginShifts++;state.lastBuildPlayer={x:Infinity,z:Infinity};rebuildPatch(true);return true;}

  function updateSpeed(now){const s=api.getState?.(),pos=s?.position;if(!pos)return;const g=geoFromLocal(pos.x,pos.z),commanded=Math.abs(Number(s.adventureCurrentSpeed)||0);if(state.lastGeo){const dt=Math.max(.001,(now-state.lastFrameAt)/1000),instant=clamp(haversineKm(state.lastGeo,g)*U/dt,0,160),target=Math.max(commanded,instant),smoothed=state.speedEstimate+(target-state.speedEstimate)*(1-Math.exp(-dt*(target>state.speedEstimate?10:3.5)));state.speedEstimate=Math.max(commanded,smoothed);}else state.speedEstimate=Math.max(state.speedEstimate,commanded);state.lastGeo=g;state.lastFrameAt=now;state.prefetchLead=clamp(Math.max(commanded,state.speedEstimate)*6,180,700);}

  const compat={worldFromGeo,geoFromWorld,sampleSurface,getState:()=>({phase:state.phase,activeRegion:'spherical-world',renderMode:'spherical-local-tangent',prefetched:state.ready,atlasReady:state.ready,atlasTriangles:state.triangles,atlasDrawFrames:state.drawFrames,atlasVerticalScale:VERTICAL,geo:state.lastGeo,error:state.error,speedEstimate:state.speedEstimate,prefetchLead:state.prefetchLead,floatingOriginShifts:state.floatingOriginShifts,poleCrossings:state.poleCrossings,datelineCrossings:state.datelineCrossings}),prefetchFrance:async()=>true,nearFrance:()=>false,inFranceGeo:()=>false,franceSouthLat:()=>42.3};
  window.WAFTWorldStreaming0245=compat;window.WAFTWorldContinuity0247={getState:compat.getState,prefetchCanarias:async()=>true,inCanarias:()=>false};

  const previousDraw=plugin.afterWorldDraw?.bind(plugin);
  plugin.afterWorldDraw=(now,eye,pv)=>{previousDraw?.(now,eye,pv);if(!state.ready)return;updateSpeed(now);if(!maybeRecenter())rebuildPatch(false);const s=api.getState?.(),pos=s?.position;if(!pos||!state.mesh)return;gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.useProgram(program);gl.uniformMatrix4fv(uPV,false,pv);gl.uniform3f(uEye,...eye);gl.uniform2f(uPlayerXZ,pos.x,pos.z);gl.uniform1f(uRadius,EARTH_U);gl.bindVertexArray(state.mesh.vao);gl.drawElements(gl.TRIANGLES,state.mesh.count,gl.UNSIGNED_INT,0);gl.bindVertexArray(null);state.drawFrames++;};

  function updateHud(){if(!state.ready)return;const objective=document.getElementById('waftObjective');if(objective)objective.textContent='Explora el mundo · ALETEAR para subir · PICADO ↓ para descender rápido.';const title=document.getElementById('hudTitle'),stats=document.getElementById('hudStats'),coords=document.getElementById('waftIberiaCoords'),s=api.getState?.(),p=s?.position,g=p?geoFromLocal(p.x,p.z):state.originGeo;if(title)title.textContent='MUNDO · ESFÉRICO 0.26.1';if(stats)stats.textContent=`TERRENO LOCAL · ${Math.round(state.triangles/1000)}k tri · ${state.speedEstimate.toFixed(0)} u/s · prefetch ${Math.round(state.prefetchLead)} u`;if(coords&&g)coords.textContent=`ALT ${Math.round((p?.y||0)/VERTICAL)} m · LAT ${g.lat.toFixed(4)} · LON ${g.lon.toFixed(4)}`;}

  window.WAFTSphericalWorld0261={getState:()=>({...state,mesh:state.mesh?{triangles:state.mesh.triangles,cx:state.mesh.cx,cz:state.mesh.cz}:null}),worldFromGeo,geoFromWorld,sampleSurface,destination,normalizeGeo,rebuildPatch};
  window.WAFTGlobalAtlas0260=window.WAFTSphericalWorld0261;
  try{
    state.phase='loading';const gb='../../regions/global-atlas/',eb='../../regions/europe-atlas/';const [gt,gc,et,ec,objects]=await Promise.all([loadBuffer(gb+'terrain.bin'),loadBuffer(gb+'landcover.bin'),loadBuffer(eb+'terrain.bin'),loadBuffer(eb+'landcover.bin'),loadJson(eb+'objects.json')]);state.terrain=parseTerrain(gt);state.cover=parseCover(gc);state.europeTerrain=parseTerrain(et);state.europeCover=parseCover(ec);state.objects=Array.isArray(objects?.items)?objects.items:[];state.ready=true;state.phase='ready';api.releaseRegionalTerrainGpu?.();rebuildPatch(true);window.__WAFT_SPHERICAL_WORLD_0261_READY__=true;window.__WAFT_GLOBAL_ATLAS_0260_READY__=true;updateHud();setInterval(updateHud,250);
  }catch(err){state.error=String(err?.stack||err);state.phase='error';console.error(err);}
})();
