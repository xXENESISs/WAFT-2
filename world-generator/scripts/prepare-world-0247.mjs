import fs from 'node:fs';

const path='mallorca-mobile/adventure-0210/index.html';
let source=fs.readFileSync(path,'utf8');
if(source.includes('iberia-world-0247.js')){
  console.log('WAFT 0.24.7 continuity layer already installed.');
  process.exit(0);
}
const re=/iberia-world-0246\.js\?v=\$\{encodeURIComponent\(version\)\}"><\\\/script>/;
const match=source.match(re);
if(!match)throw new Error('index.html: 0.24.6 layer anchor not found');
const injection='<script src="adventure-0210/iberia-world-0247.js?v=${encodeURIComponent(version)}"><\\/script>';
source=source.replace(re,match[0]+injection);
fs.writeFileSync(path,source);
console.log('WAFT 0.24.7 prepared: smooth region retention, world city labels and Canarias streaming layer.');
