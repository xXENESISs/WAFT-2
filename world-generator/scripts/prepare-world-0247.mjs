import fs from 'node:fs';

const indexPath='mallorca-mobile/adventure-0210/index.html';
const layerPath='mallorca-mobile/adventure-0210/iberia-world-0247.js';
let source=fs.readFileSync(indexPath,'utf8');
let indexChanged=false;

if(!source.includes('iberia-world-0247.js')){
  const re=/iberia-world-0246\.js\?v=\$\{encodeURIComponent\(version\)\}"><\\\/script>/;
  const match=source.match(re);
  if(!match)throw new Error('index.html: 0.24.6 layer anchor not found');
  const injection='<script src="adventure-0210/iberia-world-0247.js?v=${encodeURIComponent(version)}"><\\/script>';
  source=source.replace(re,match[0]+injection);
  indexChanged=true;
}

// The regional runtime may only clamp to Iberia when no streamed-world surface exists.
if(!source.includes('WAFT_WORLD_BOUNDS_0247')){
  const oldClamp=`      const activeTerrain = state.worldMode === 'local' ? localAssets.terrainMesh : terrainMesh;\n      const bounds = activeTerrain.bounds;\n      state.camera.x = Math.max(bounds.minX, Math.min(bounds.maxX, state.camera.x));\n      state.camera.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, state.camera.z));\n      if (state.worldMode === 'regional') runtimeControls.refreshLocalProximity();`;
  const newClamp=`      const activeTerrain = state.worldMode === 'local' ? localAssets.terrainMesh : terrainMesh;\n      const bounds = activeTerrain.bounds;\n      const streamedWorldSurface=state.worldMode==='regional'?window.WAFTWorldStreaming0245?.sampleSurface?.(state.camera.x,state.camera.z):null;\n      if(!streamedWorldSurface?.inside){\n        state.camera.x = Math.max(bounds.minX, Math.min(bounds.maxX, state.camera.x));\n        state.camera.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, state.camera.z));\n      }\n      if (state.worldMode === 'regional') runtimeControls.refreshLocalProximity();`;
  const anchor='      const uiSafety=';
  if(!source.includes(anchor))throw new Error('index.html: uiSafety insertion anchor not found');
  const injected=`      replaceOne(${JSON.stringify(oldClamp)}, ${JSON.stringify(newClamp)}, 'límites dinámicos del mundo 0.24.7'); // WAFT_WORLD_BOUNDS_0247\n\n`;
  source=source.replace(anchor,injected+anchor);
  indexChanged=true;
}
if(indexChanged)fs.writeFileSync(indexPath,source);

let layer=fs.readFileSync(layerPath,'utf8');
// 0.24.8 already contains the safer Atlantic sampler/draw gating and intentionally removed
// the floating DOM city overlay. Do not resurrect any 0.24.7 renderer here.
if(layer.includes("atlasSystem:'shared-iberia'")&&layer.includes('floatingCityLabels:false')){
  console.log('WAFT 0.24.8 prepare: shared atlas, geographic France and gated Atlantic/Canarias preserved.');
  process.exit(0);
}

let layerChanged=false;
const replaceLayer=(oldText,newText,label)=>{
  if(layer.includes(newText))return;
  if(!layer.includes(oldText))throw new Error(`iberia-world-0247.js: ${label} anchor not found`);
  layer=layer.replace(oldText,newText);layerChanged=true;
};
if(layer.includes('canariasDrawFrames')){layer=layer.replaceAll('canariasDrawFrames','canDrawFrames');layerChanged=true;}
if(!layer.includes('WAFT_ATLANTIC_MESH_0247')){
  replaceLayer(
    '  let canTerrain=null,canCover=null,canManifest=null,canMesh=null,canPrefetch=null,canDrawFrames=0;',
    '  let canTerrain=null,canCover=null,canManifest=null,canMesh=null,canPrefetch=null,canDrawFrames=0,atlanticMesh=null,atlanticDrawFrames=0; // WAFT_ATLANTIC_MESH_0247',
    'Atlantic state'
  );
  replaceLayer(
    "  const canPV=gl.getUniformLocation(canProgram,'uPV'),canV=gl.getUniformLocation(canProgram,'uV');",
    `  const canPV=gl.getUniformLocation(canProgram,'uPV'),canV=gl.getUniformLocation(canProgram,'uV');
  const atlanticEastLon=lat=>lat>=35?-5.05-(35.45-lat)*2.0:lat>=33?-5.95-(35-lat)*1.25:lat>=31?-8.45-(33-lat)*1.3:-11.05-(31-lat)*1.15;
  const buildAtlanticMesh=()=>{
    const lats=[35.45,35,33,31,29.35,27.25],pos=[],col=[],ind=[],water=[.026,.17,.30];
    for(const lat of lats)for(const lon of [-19.6,atlanticEastLon(lat)]){const w=worldFromGeo(lat,lon);pos.push(w.x,-7.75,w.z);col.push(...water);}
    for(let r=0;r<lats.length-1;r++){const a=r*2,b=a+1,c=a+2,d=a+3;ind.push(a,c,b,b,c,d);}
    const vao=gl.createVertexArray();gl.bindVertexArray(vao);const pb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,pb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(pos),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);const cb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,cb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(col),gl.STATIC_DRAW);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,0,0);const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(ind),gl.STATIC_DRAW);gl.bindVertexArray(null);return{vao,count:ind.length,triangles:ind.length/3,buffers:[pb,cb,ib]};
  };
  atlanticMesh=buildAtlanticMesh();`,
    'Atlantic mesh builder'
  );
  replaceLayer(
    "  const sampleAtlantic=(x,z)=>{const g=geoFromWorld(x,z);if(g.lat>35.45||g.lat<29.35||g.lon>-5.05||g.lon<-19.6)return null;return{inside:true,land:false,water:true,height:-8*VERTICAL,waterHeight:-8*VERTICAL,normal:{x:0,y:1,z:0},slopeAngle:0,streamedRegion:'atlantic-corridor',lat:g.lat,lon:g.lon};};",
    "  const sampleAtlantic=(x,z)=>{const g=geoFromWorld(x,z);if(g.lat>35.45||g.lat<27.25||g.lon<-19.6||g.lon>atlanticEastLon(g.lat))return null;return{inside:true,land:false,water:true,height:-8*VERTICAL,waterHeight:-8*VERTICAL,normal:{x:0,y:1,z:0},slopeAngle:0,streamedRegion:'atlantic-corridor',lat:g.lat,lon:g.lon};};",
    'Atlantic sampler'
  );
}
if(layerChanged)fs.writeFileSync(layerPath,layer);
console.log('WAFT 0.24.7 legacy prepare complete.');
