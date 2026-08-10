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

// The legacy regional runtime clamps camera x/z to the static Iberia terrain bounds every frame.
// That makes any streamed region outside Iberia impossible even when its surface is already loaded.
// Keep the old clamp only when there is no streamed-world surface at the current coordinate.
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
let layerChanged=false;
if(layer.includes('canariasDrawFrames')){
  layer=layer.replaceAll('canariasDrawFrames','canDrawFrames');
  layerChanged=true;
}
if(layerChanged)fs.writeFileSync(layerPath,layer);

console.log('WAFT 0.24.7 prepared: dynamic streamed-world bounds, smooth France retention, world city labels, Portugal and Canarias streaming.');
