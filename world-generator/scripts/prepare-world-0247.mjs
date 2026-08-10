import fs from 'node:fs';

const indexPath='mallorca-mobile/adventure-0210/index.html';
const layerPath='mallorca-mobile/adventure-0210/iberia-world-0247.js';
let source=fs.readFileSync(indexPath,'utf8');
if(!source.includes('iberia-world-0247.js')){
  const re=/iberia-world-0246\.js\?v=\$\{encodeURIComponent\(version\)\}"><\\\/script>/;
  const match=source.match(re);
  if(!match)throw new Error('index.html: 0.24.6 layer anchor not found');
  const injection='<script src="adventure-0210/iberia-world-0247.js?v=${encodeURIComponent(version)}"><\\/script>';
  source=source.replace(re,match[0]+injection);
  fs.writeFileSync(indexPath,source);
}
let layer=fs.readFileSync(layerPath,'utf8');
if(layer.includes('canariasDrawFrames')){
  layer=layer.replaceAll('canariasDrawFrames','canDrawFrames');
  fs.writeFileSync(layerPath,layer);
}
console.log('WAFT 0.24.7 prepared: smooth region retention, world city labels, Portugal and Canarias streaming layer.');
