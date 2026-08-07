import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const here=path.dirname(new URL(import.meta.url).pathname);
const adventure=path.resolve(here,'..');
const mobile=path.resolve(adventure,'..');
const index=fs.readFileSync(path.join(adventure,'index.html'),'utf8');
const bootScripts=[...index.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(Boolean);
assert.equal(bootScripts.length,1);
const boot=bootScripts[0];

for(const test of [
  {id:'baleares',search:'',file:'region-runtime-baleares-013.html'},
  {id:'catalunya-litoral',search:'?region=catalunya-litoral',file:'region-runtime-catalunya-litoral-003.html'}
]){
  const runtimeSource=fs.readFileSync(path.join(mobile,test.file),'utf8');
  let written='';
  const elements=new Map();
  const document={
    getElementById(id){if(!elements.has(id))elements.set(id,{textContent:'',style:{}});return elements.get(id);},
    open(){written='';},write(value){written+=String(value);},close(){}
  };
  const context={console,document,location:{search:test.search,href:`https://example.test/adventure-0210/index.html${test.search}`},URL,URLSearchParams,JSON,encodeURIComponent,setTimeout,clearTimeout,fetch:async()=>({ok:true,status:200,text:async()=>runtimeSource})};
  context.window=context;context.globalThis=context;vm.createContext(context);
  new vm.Script(boot,{filename:`boot-${test.id}.js`}).runInContext(context);
  for(let i=0;i<100&&!written;i++)await new Promise(resolve=>setTimeout(resolve,5));
  if(!written)throw new Error(`${test.id}: boot failed: ${elements.get('error')?.textContent||elements.get('status')?.textContent||'unknown'}`);

  for(const pattern of [
    /state\.yaw -= dx \* \.0053/,
    /Math\.max\(-1\.05, Math\.min\(1\.46, state\.pitch \+ dy \* \.0043\)\)/,
    /gravity: 20\.5/,
    /adventureWaterJump: false/,
    /adventureSharkBreachSpeed: 0/,
    /waterDrive=boosted\|\|inputLength>\.93\?42/,
    /adventureFlight\?'flight':state\.adventureWaterJump\?'water-jump'/,
    /buildingContactAt/,
    /adventureVisible/,
    /isAdventureVisible/,
    /queueAdventureJump\(velocity,options=\{\}\)/,
    /plugin-loader\.js/,
    /__WAFT_ADVENTURE_BUILD__='0\.23\.3'/
  ])assert.match(written,pattern,`${test.id}: missing ${pattern}`);
  assert.doesNotMatch(written,/state\.pitch = Math\.max\(-\.12, Math\.min\(\.72, state\.pitch - dy/);

  const scripts=[...written.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(Boolean);
  assert.ok(scripts.length>=2,`${test.id}: expected runtime plus bootstrap`);
  for(const source of scripts)new vm.Script(source,{filename:`patched-${test.id}.js`});
  console.log(`${test.id}: patched 0.23.3 runtime compiled (${written.length} chars)`);
}
console.log('Both World 2 regional runtimes survive the complete 0.23.3 World 1 parity patch.');
