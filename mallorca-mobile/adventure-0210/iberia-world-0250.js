'use strict';
(async()=>{
  if(window.__WAFT_IBERIA_WORLD_0250_READY__||window.__WAFT_ADVENTURE_REGION__!=='iberia'||window.__WAFT_EUROPE_ATLAS_0252_ACTIVE__)return;
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  for(let i=0;i<600&&(!window.WAFTRegionRuntime||!window.WAFTWorldStreaming0245||!window.WAFTWorldContinuity0247);i++)await wait(40);
  const api=window.WAFTRegionRuntime,stream=window.WAFTWorldStreaming0245,continuity=window.WAFTWorldContinuity0247,plugin=window.WAFTAdventurePlugin;
  if(!api||!stream||!continuity||!plugin)throw new Error('WAFT 0.25.2 runtime unavailable');
  const canvas=document.querySelector('canvas'),gl=canvas?.getContext('webgl2');
  if(!gl)throw new Error('WebGL2 unavailable for WAFT 0.25.2');

  const VERSION=new URL(document.currentScript?.src||location.href).searchParams.get('v')||'0.25.2';
  const VERTICAL=Number(api.metadata?.terrain?.verticalScale)||.013594;
  const U=Number(api.metadata?.projection?.unitsPerKm)||.30;
  const LABEL_RANGE_KM=.15,NEAREST_RANGE_KM=1.0,LABEL_MAX_AGL_M=320;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const geoFromWorld=(x,z)=>stream.geoFromWorld(Number(x),Number(z));
  const worldFromGeo=(lat,lon)=>stream.worldFromGeo(Number(lat),Number(lon));
  const inAfrica=g=>Boolean(g&&g.lat>=27.0&&g.lat<=35.98&&g.lon>=-13.0&&g.lon<=0.0);
  const nearAfrica=g=>Boolean(g&&g.lat>=26.5&&g.lat<=36.55&&g.lon>=-13.8&&g.lon<=.7);
  const inAtlantic=g=>Boolean(g&&g.lat>=26.4&&g.lat<=36.25&&g.lon>=-19.4&&g.lon<=0.2&&!inAfrica(g)&&!continuity.inCanarias?.(g));

  const state={phase:'idle',manifest:null,terrain:null,cover:null,mesh:null,ocean:null,drawFrames:0,oceanFrames:0,bytes:0,error:null,settlements:[],lastGeo:null,lastSurface:null,shownLabels:0,nearest:null};
  const palette=[
    [.026,.17,.30],[.73,.61,.35],[.42,.43,.41],[.31,.47,.19],[.055,.29,.12],
    [.50,.53,.20],[.45,.44,.40],[.16,.39,.28],[.49,.40,.29],[.38,.56,.20]
  ];
  const parseTerrain=buffer=>{const v=new DataView(buffer),magic=new TextDecoder().decode(new Uint8Array(buffer,0,8));if(magic!=='WAFTHGT1')throw new Error(`Africa terrain magic ${magic}`);const h=v.getUint16(10,true),columns=v.getUint16(12,true),rows=v.getUint16(14,true);return{headerBytes:h,columns,rows,west:v.getFloat64(16,true),east:v.getFloat64(24,true),south:v.getFloat64(32,true),north:v.getFloat64(40,true),nodata:v.getInt32(56,true),elevations:new Int16Array(buffer,h,columns*rows)};};
  const parseCover=buffer=>{const v=new DataView(buffer),magic=new TextDecoder().decode(new Uint8Array(buffer,0,8));if(magic!=='WAFTLCV1')throw new Error(`Africa cover magic ${magic}`);const h=v.getUint16(10,true),columns=v.getUint16(12,true),rows=v.getUint16(14,true);return{columns,rows,classes:new Uint8Array(buffer,h,columns*rows)};};
  const compile=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)||'0.25 shader');return s;};
  const vs=compile(gl.VERTEX_SHADER,`#version 300 es\nlayout(location=0)in vec3 aP;layout(location=1)in vec3 aN;layout(location=2)in vec3 aC;uniform mat4 uPV;uniform float uV;out vec3 vN;out vec3 vC;out vec3 vW;void main(){vW=vec3(aP.x,aP.y*uV,aP.z);vN=normalize(vec3(aN.x,aN.y,aN.z));vC=aC;gl_Position=uPV*vec4(vW,1.0);}`);
  const fs=compile(gl.FRAGMENT_SHADER,`#version 300 es\nprecision highp float;in vec3 vN;in vec3 vC;in vec3 vW;uniform vec3 uEye;out vec4 o;void main(){vec3 light=normalize(vec3(-.42,.86,.28));float diffuse=.72+.28*max(dot(normalize(vN),light),0.0);float haze=smoothstep(520.0,1050.0,distance(vW.xz,uEye.xz));vec3 base=vC*diffuse;o=vec4(mix(base,vec3(.39,.555,.655),haze*.72),1.0);}`);
  const program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||'0.25 program');
  const uPV=gl.getUniformLocation(program,'uPV'),uV=gl.getUniformLocation(program,'uV'),uEye=gl.getUniformLocation(program,'uEye');

  const makeMesh=(terrain,cover)=>{
    const n=terrain.columns*terrain.rows,pos=new Float32Array(n*3),norm=new Float32Array(n*3),col=new Float32Array(n*3);
    const rawAt=(c,r)=>{c=clamp(c,0,terrain.columns-1);r=clamp(r,0,terrain.rows-1);const v=terrain.elevations[r*terrain.columns+c];return v===terrain.nodata?-8:v;};
    let p=0;
    for(let r=0;r<terrain.rows;r++){
      const lat=terrain.north-r/(terrain.rows-1)*(terrain.north-terrain.south);
      for(let c=0;c<terrain.columns;c++){
        const lon=terrain.west+c/(terrain.columns-1)*(terrain.east-terrain.west),idx=r*terrain.columns+c,w=worldFromGeo(lat,lon),raw=terrain.elevations[idx],h=raw===terrain.nodata?-8:raw,clr=palette[cover.classes[idx]]||palette[0];
        pos[p]=w.x;pos[p+1]=h;pos[p+2]=w.z;
        const l=rawAt(c-1,r),rr=rawAt(c+1,r),up=rawAt(c,r-1),dn=rawAt(c,r+1),dx=Math.max(.001,Math.abs(worldFromGeo(lat,lon+(terrain.east-terrain.west)/(terrain.columns-1)).x-w.x)),dz=Math.max(.001,Math.abs(worldFromGeo(lat-(terrain.north-terrain.south)/(terrain.rows-1),lon).z-w.z));
        let nx=-(rr-l)*VERTICAL/(2*dx),ny=1,nz=-(dn-up)*VERTICAL/(2*dz),len=Math.hypot(nx,ny,nz)||1;norm[p]=nx/len;norm[p+1]=ny/len;norm[p+2]=nz/len;
        col[p]=clr[0];col[p+1]=clr[1];col[p+2]=clr[2];p+=3;
      }
    }
    const ind=new Uint32Array((terrain.rows-1)*(terrain.columns-1)*6);let q=0;for(let r=0;r<terrain.rows-1;r++)for(let c=0;c<terrain.columns-1;c++){const a=r*terrain.columns+c,b=a+1,d=a+terrain.columns,e=d+1;ind[q++]=a;ind[q++]=d;ind[q++]=b;ind[q++]=b;ind[q++]=d;ind[q++]=e;}
    const vao=gl.createVertexArray();gl.bindVertexArray(vao);const buffers=[];
    const add=(slot,data)=>{const b=gl.createBuffer();buffers.push(b);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);gl.enableVertexAttribArray(slot);gl.vertexAttribPointer(slot,3,gl.FLOAT,false,0,0);};add(0,pos);add(1,norm);add(2,col);
    const ib=gl.createBuffer();buffers.push(ib);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,ind,gl.STATIC_DRAW);gl.bindVertexArray(null);return{vao,buffers,count:ind.length,triangles:ind.length/3};
  };

  const makeOcean=()=>{
    const corners=[[18,-32],[48,-32],[18,12],[48,12]].map(([lat,lon])=>worldFromGeo(lat,lon));
    const pos=new Float32Array([corners[0].x,-8,corners[0].z,corners[1].x,-8,corners[1].z,corners[2].x,-8,corners[2].z,corners[3].x,-8,corners[3].z]);
    const norm=new Float32Array([0,1,0,0,1,0,0,1,0,0,1,0]),water=palette[0],col=new Float32Array([...water,...water,...water,...water]),ind=new Uint32Array([0,1,2,2,1,3]);
    const vao=gl.createVertexArray();gl.bindVertexArray(vao);const buffers=[];for(const [slot,data] of [[0,pos],[1,norm],[2,col]]){const b=gl.createBuffer();buffers.push(b);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);gl.enableVertexAttribArray(slot);gl.vertexAttribPointer(slot,3,gl.FLOAT,false,0,0);}const ib=gl.createBuffer();buffers.push(ib);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,ind,gl.STATIC_DRAW);gl.bindVertexArray(null);return{vao,buffers,count:6,triangles:2};
  };
  state.ocean=makeOcean();

  let prefetchPromise=null;
  const loadJson=path=>fetch(new URL(path,location.href),{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`${r.status} ${path}`);return r.json();});
  const loadBuffer=path=>fetch(new URL(path,location.href),{cache:'force-cache'}).then(r=>{if(!r.ok)throw new Error(`${r.status} ${path}`);return r.arrayBuffer();});
  const prefetchAfrica=()=>prefetchPromise||(prefetchPromise=(async()=>{
    state.phase='prefetching';const base='../../regions/northwest-africa/';
    const [manifest,tb,cb,settlements]=await Promise.all([loadJson(base+'manifest.json'),loadBuffer(base+'terrain.bin'),loadBuffer(base+'landcover.bin'),loadJson(base+'settlements.json')]);
    if(manifest?.region?.id!=='northwest-africa'||Math.abs(Number(manifest?.projection?.unitsPerKm)-U)>.001)throw new Error('Northwest Africa scale mismatch');
    state.manifest=manifest;state.terrain=parseTerrain(tb);state.cover=parseCover(cb);if(state.terrain.columns!==state.cover.columns||state.terrain.rows!==state.cover.rows)throw new Error('Africa terrain/cover mismatch');
    state.mesh=makeMesh(state.terrain,state.cover);state.bytes=tb.byteLength+cb.byteLength;state.settlements=(settlements.items||[]).map(c=>({...c,_world:worldFromGeo(Number(c.position?.lat),Number(c.position?.lon)),_region:'northwest-africa'}));state.phase='ready';return true;
  })().catch(e=>{state.phase='error';state.error=String(e?.message||e);throw e;}));

  const sampleAfrica=(x,z)=>{if(!state.terrain)return null;const g=geoFromWorld(x,z),t=state.terrain;if(!inAfrica(g)||g.lat<t.south||g.lat>t.north||g.lon<t.west||g.lon>t.east)return null;const c=clamp(Math.round((g.lon-t.west)/(t.east-t.west)*(t.columns-1)),0,t.columns-1),r=clamp(Math.round((t.north-g.lat)/(t.north-t.south)*(t.rows-1)),0,t.rows-1),raw=t.elevations[r*t.columns+c],land=raw!==t.nodata;return{inside:true,land,water:!land,height:(land?raw:-8)*VERTICAL,waterHeight:-8*VERTICAL,normal:{x:0,y:1,z:0},slopeAngle:0,streamedRegion:'northwest-africa',lat:g.lat,lon:g.lon};};
  const sampleOcean=(x,z)=>{const g=geoFromWorld(x,z);if(!inAtlantic(g))return null;return{inside:true,land:false,water:true,height:-8*VERTICAL,waterHeight:-8*VERTICAL,normal:{x:0,y:1,z:0},slopeAngle:0,streamedRegion:'atlantic-ocean',lat:g.lat,lon:g.lon};};
  const previousSample=stream.sampleSurface?.bind(stream);
  stream.sampleSurface=(x,z)=>sampleAfrica(Number(x),Number(z))||sampleOcean(Number(x),Number(z))||previousSample?.(x,z)||null;

  const previousDraw=plugin.afterWorldDraw?.bind(plugin);
  plugin.afterWorldDraw=(now,eye,pv)=>{
    previousDraw?.(now,eye,pv);const s=api.getState?.(),g=s?.position?geoFromWorld(s.position.x,s.position.z):null;if(!g)return;
    const drawOcean=inAtlantic(g)||inAfrica(g)||continuity.inCanarias?.(g);const drawAfrica=Boolean(state.mesh&&nearAfrica(g));if(!drawOcean&&!drawAfrica)return;
    gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.useProgram(program);gl.uniformMatrix4fv(uPV,false,pv);gl.uniform1f(uV,VERTICAL);gl.uniform3f(uEye,...eye);
    if(drawOcean&&state.ocean){gl.bindVertexArray(state.ocean.vao);gl.drawElements(gl.TRIANGLES,state.ocean.count,gl.UNSIGNED_INT,0);state.oceanFrames++;}
    if(drawAfrica){gl.bindVertexArray(state.mesh.vao);gl.drawElements(gl.TRIANGLES,state.mesh.count,gl.UNSIGNED_INT,0);state.drawFrames++;}
    gl.bindVertexArray(null);
  };

  // 0.25 labels: arrival markers only. The 0.24.9 long-range overlay remains in DOM for compatibility but is never visible.
  const style=document.createElement('style');style.id='waftWorldUi0250Style';style.textContent=`#waftWorldLabels0249,#waftNearest0249{display:none!important}#waftWorldLabels0250{position:fixed;inset:0;z-index:18;pointer-events:none;overflow:hidden}.waftPlace0250{position:absolute;display:none;transform:translate(-50%,-100%);text-align:center;filter:drop-shadow(0 2px 4px #000c)}.waftPlace0250.visible{display:block}.waftPlace0250 .pin{width:6px;height:6px;margin:0 auto 2px;border-radius:50%;background:#e8c66d;border:1px solid #fff7d8}.waftPlace0250 .card{padding:3px 6px;border-radius:7px;background:rgba(5,17,23,.88);border:1px solid rgba(232,198,109,.42)}.waftPlace0250 b{display:block;color:#fff4d0;font:900 8px/1.08 system-ui;white-space:nowrap}.waftPlace0250 small{display:block;color:#dbe8e3;font:750 7px/1.1 system-ui;margin-top:1px}#waftNearest0250{font-size:11px;line-height:1.35;color:#d9e2df;margin-top:3px}`;document.head.appendChild(style);
  const labelsRoot=document.createElement('div');labelsRoot.id='waftWorldLabels0250';document.body.appendChild(labelsRoot);
  const nearest=document.createElement('div');nearest.id='waftNearest0250';document.getElementById('hud')?.appendChild(nearest);
  const nodes=Array.from({length:8},()=>{const n=document.createElement('div');n.className='waftPlace0250';n.innerHTML='<div class="pin"></div><div class="card"><b></b><small></small></div>';labelsRoot.appendChild(n);return n;});
  const fmt=n=>Number(n||0).toLocaleString('es-ES');
  const distance=(a,b)=>Math.hypot(Number(a?._world?.x)-b.x,Number(a?._world?.z)-b.z)/U;
  const project=(x,y,z)=>{const m=window.__WAFT_LAST_PV_MATRIX__;if(!m)return null;const cx=m[0]*x+m[4]*y+m[8]*z+m[12],cy=m[1]*x+m[5]*y+m[9]*z+m[13],cw=m[3]*x+m[7]*y+m[11]*z+m[15];if(cw<=.01)return null;const nx=cx/cw,ny=cy/cw;if(Math.abs(nx)>1.08||Math.abs(ny)>1.08)return null;return{x:(nx*.5+.5)*innerWidth,y:(-.5*ny+.5)*innerHeight};};
  const oldDrawForMatrix=plugin.afterWorldDraw?.bind(plugin);plugin.afterWorldDraw=(now,eye,pv)=>{window.__WAFT_LAST_PV_MATRIX__=new Float32Array(pv);oldDrawForMatrix?.(now,eye,pv);};

  let iberia=[],france=[],canarias=[];
  try{const [ib,fr,ca]=await Promise.all([loadJson('../../regions/iberia/settlements.json'),loadJson('../../regions/france/settlements.json'),loadJson('../../regions/canarias/settlements.json')]);iberia=(ib.items||[]).map(c=>({...c,_world:{x:Number(c.local?.x),z:Number(c.local?.z)},_region:'iberia'}));france=(fr.items||[]).map(c=>({...c,_world:worldFromGeo(Number(c.position?.lat),Number(c.position?.lon)),_region:'france'}));canarias=(ca.items||[]).map(c=>({...c,_world:worldFromGeo(Number(c.position?.lat),Number(c.position?.lon)),_region:'canarias'}));}catch(e){console.error(e);}
  const provider=({state:s})=>{if(!s?.position)return{title:'LUGARES',items:iberia};const g=geoFromWorld(s.position.x,s.position.z);if(inAfrica(g))return{title:'LUGARES · NOROESTE DE ÁFRICA',items:state.settlements};if(continuity.inCanarias?.(g))return{title:'LUGARES · CANARIAS',items:canarias};if(continuity.inFrance?.(g))return{title:'LIEUX · FRANCE',items:france};return{title:'LUGARES · PENÍNSULA IBÉRICA',items:iberia};};
  window.WAFT_WORLD_ATLAS_PROVIDER=provider;

  const reserved=()=>[...document.querySelectorAll('#hud,#joystick,#vertical,#waftCheckpoints,#waftCheckpointPanel')].filter(e=>e.offsetParent!==null).map(e=>e.getBoundingClientRect());
  const overlaps=(p,boxes)=>boxes.some(b=>p.x>b.left-70&&p.x<b.right+70&&p.y>b.top-38&&p.y<b.bottom+18);
  const updateLabels=()=>{
    const s=api.getState?.();if(!s?.position)return;const g=geoFromWorld(s.position.x,s.position.z);state.lastGeo=g;if(nearAfrica(g)&&!state.mesh)prefetchAfrica().catch(console.error);
    const source=provider({state:s}),items=(source.items||[]).filter(x=>Number.isFinite(Number(x?._world?.x))&&Number.isFinite(Number(x?._world?.z))).map(x=>({x,d:distance(x,s.position)})).sort((a,b)=>a.d-b.d);
    const first=items[0];state.nearest=first?.x||null;
    const under=stream.sampleSurface?.(s.position.x,s.position.z),agl=under?.inside?Math.max(0,(s.position.y-under.height)/VERTICAL):Infinity,allowAltitude=agl<=LABEL_MAX_AGL_M,boxes=reserved();let shown=0;
    nearest.textContent=allowAltitude&&first&&first.d<=NEAREST_RANGE_KM?`Cerca: ${first.x.name} · ${first.d.toFixed(1)} km · ${fmt(first.x.population)} hab ☠️`:'';
    for(const entry of items){if(shown>=nodes.length||entry.d>LABEL_RANGE_KM||!allowAltitude)break;const place=entry.x,surf=stream.sampleSurface?.(place._world.x,place._world.z);if(!surf?.inside||!surf.land)continue;const p=project(place._world.x,surf.height+.42,place._world.z);if(!p||overlaps(p,boxes))continue;const node=nodes[shown++];node.style.left=`${p.x}px`;node.style.top=`${p.y}px`;node.querySelector('b').textContent=place.name;node.querySelector('small').textContent=`${fmt(place.population)} hab ☠️`;node.classList.add('visible');
    }
    for(let i=shown;i<nodes.length;i++)nodes[i].classList.remove('visible');state.shownLabels=shown;state.lastSurface=under;
    const hud=document.getElementById('hudTitle');if(hud&&inAfrica(g))hud.textContent='NOROESTE DE ÁFRICA · MUNDO CONTINUO 0.25.2';
  };
  setInterval(updateLabels,120);updateLabels();

  window.WAFTWorld0250={version:'0.25.2',inAfrica,inAtlantic,prefetchAfrica,sampleAfrica,sampleOcean,getState:()=>({phase:state.phase,scale:U,africaReady:Boolean(state.mesh),africaTriangles:state.mesh?.triangles||0,africaDrawFrames:state.drawFrames,oceanTriangles:state.ocean?.triangles||0,oceanDrawFrames:state.oceanFrames,africaBytes:state.bytes,africaSettlements:state.settlements.length,shownLabels:state.shownLabels,nearest:state.nearest?.name||null,labelRangeKm:LABEL_RANGE_KM,nearestRangeKm:NEAREST_RANGE_KM,labelMaxAglM:LABEL_MAX_AGL_M,geo:state.lastGeo,error:state.error})};
  window.__WAFT_IBERIA_WORLD_0250_READY__=true;
})().catch(e=>{console.error('WAFT 0.25.2 failed',e);window.__WAFT_IBERIA_WORLD_0250_ERROR__=String(e?.message||e);});
