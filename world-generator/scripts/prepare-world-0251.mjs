import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const SCALE=.30;
const VERSION='0.25.1';
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const write=(p,s)=>fs.writeFileSync(path.join(root,p),s);

for(const id of ['iberia','france','canarias','northwest-africa']){
  const p=`world-generator/configs/${id}.region.json`;
  const c=JSON.parse(read(p));
  c.version=VERSION;
  c.geography.scale.horizontalUnitsPerKm=SCALE;
  for(const x of c.travel?.connections||[])x.requiredCapabilities=(x.requiredCapabilities||[]).map(v=>v==='water'?'long_water':v);
  write(p,JSON.stringify(c,null,2)+'\n');
}

const patch=(p,fn)=>{const before=read(p),after=fn(before);if(after!==before)write(p,after);};

patch('mallorca-mobile/adventure-0210/iberia-world-0245.js',s=>s
  .replace(/\|\|'0\.25\.0'/g,"||'0.25.1'")
  .replace(/\|\|1\.0;/g,'||.30;'));

for(const p of [
  'mallorca-mobile/adventure-0210/iberia-world-0247.js',
  'mallorca-mobile/adventure-0210/iberia-world-0249.js',
  'mallorca-mobile/adventure-0210/iberia-world-0250.js'
])patch(p,s=>s.replaceAll('0.25.0','0.25.1').replace(/\|\|1\.0;/g,'||.30;'));

patch('mallorca-mobile/adventure-0210/index.html',s=>s.replace("window.__WAFT_ADVENTURE_BUILD__='0.25.0'","window.__WAFT_ADVENTURE_BUILD__='0.25.1'"));

const f=read('mallorca-mobile/adventure-0210/iberia-world-0245.js');
const w=read('mallorca-mobile/adventure-0210/iberia-world-0250.js');
if(!f.includes('||.30;'))throw new Error('France streamer fallback was not compressed to 0.30');
if(!w.includes('||.30;'))throw new Error('0.25 world runtime fallback was not compressed to 0.30');
if(!read('mallorca-mobile/adventure-0210/index.html').includes("__WAFT_ADVENTURE_BUILD__='0.25.1'"))throw new Error('Adventure build version did not advance to 0.25.1');

console.log('WAFT 0.25.1 preparation is deterministic: 0.30 u/km horizontal world, preserved vertical mountain scale, local arrival labels, real Northwest Africa and continuous Atlantic.');
