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
  {id:'catalunya-litoral',search:'?region=catalunya-litoral',file:'region-runtime-catalunya-litoral-003.html'},
  {id:'iberia-planet',search:'?region=iberia&renderer=0270',file:'region-runtime-catalunya-litoral-003.html',experimental:true}
]){
  const runtimeSource=fs.readFileSync(path.join(mobile,test.file),'utf8');
  let written='';
  const elements=new Map();
  const document={getElementById(id){if(!elements.has(id))elements.set(id,{textContent:'',style:{}});return elements.get(id);},open(){written='';},write(value){written+=String(value);},close(){}};
  const context={console,document,location:{search:test.search,href:`https://example.test/adventure-0210/index.html${test.search}`},URL,URLSearchParams,JSON,encodeURIComponent,setTimeout,clearTimeout,fetch:async()=>({ok:true,status:200,text:async()=>runtimeSource})};
  context.window=context;context.globalThis=context;vm.createContext(context);
  new vm.Script(boot,{filename:`boot-${test.id}.js`}).runInContext(context);
  for(let i=0;i<100&&!written;i++)await new Promise(resolve=>setTimeout(resolve,5));
  if(!written)throw new Error(`${test.id}: boot failed: ${elements.get('error')?.textContent||elements.get('status')?.textContent||'unknown'}`);

  for(const pattern of [
    /state\.yaw -= dx \* \.0053/,
    /Math\.max\(-1\.05, Math\.min\(1\.46, state\.pitch \+ dy \* \.0043\)\)/,
    /lookUpLift=Math\.max\(0,-state\.pitch\)\*state\.cameraDistance\*\.92/,
    /minimumDistance=Math\.min\(\.28,desiredDistance\*\.055\)/,
    /const steps=Math\.max\(12,Math\.min\(24,Math\.ceil\(desiredDistance\/\.28\)\)\)/,
    /roof=buildingTopAt\(regional\.x,regional\.z,0\)/,
    /adventureBuildingGrid/,
    /ensureAdventureBuildingGrid/,
    /grid\.cells\.get\(Math\.floor\(x\/grid\.cellSize\)/,
    /adventureStepSize=state\.adventureFlight\?\.72:state\.adventureWaterJump\?\.52/,
    /adventureMaxSteps=state\.adventureFlight\?10:state\.adventureWaterJump\?14:26/,
    /Math\.min\(adventureMaxSteps,Math\.ceil\(distance\/adventureStepSize\)\)/,
    /__WAFT_UI_SAFETY_READY__/,
    /waftPanelClose/,
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
    /releaseRegionalTerrainGpu/,
    /restoreRegionalTerrainGpu/
  ])assert.match(written,pattern,`${test.id}: missing ${pattern}`);
  assert.match(written,test.experimental?/__WAFT_ADVENTURE_BUILD__='0\.27\.3-experimental'/:/__WAFT_ADVENTURE_BUILD__='0\.26\.1'/,`${test.id}: wrong build identity`);
  if(test.experimental){
    for(const pattern of [
      /__WAFT_PLANET_WORLD_0270_ACTIVE__=true/,
      /if\(window\.__WAFT_PLANET_WORLD_0270_ACTIVE__&&state\.adventureFlight\)\{state\.cameraBlocked=false;return desired;\}/,
      /if\(!window\.__WAFT_PLANET_WORLD_0270_ACTIVE__\)streamer\.update/,
      /boosted\?348:312/,
      /cameraPitch: state\.pitch/
    ])assert.match(written,pattern,`${test.id}: missing ${pattern}`);
  }
  assert.doesNotMatch(written,/state\.pitch = Math\.max\(-\.12, Math\.min\(\.72, state\.pitch - dy/);
  assert.doesNotMatch(written,/minimumDistance = Math\.min\(1\.05, desiredDistance \* \.30\)/);
  assert.doesNotMatch(written,/const center = \[target\[0\], target\[1\] \+ \.18, target\[2\]\];/);
  assert.doesNotMatch(written,/let blocked=false;const steps=40/);

  const scripts=[...written.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match=>match[1]).filter(Boolean);
  assert.ok(scripts.length>=3,`${test.id}: expected runtime, Adventure bootstrap and UI safety scripts`);
  for(const source of scripts)new vm.Script(source,{filename:`patched-${test.id}.js`});
  console.log(`${test.id}: optimized patched ${test.experimental?'0.27.3':'0.26.1'} runtime compiled (${written.length} chars)`);
}

{
  const loader=fs.readFileSync(path.join(adventure,'plugin-loader.js'),'utf8');
  let patchedGameplay='';
  const document={currentScript:{src:'https://example.test/adventure-0210/plugin-loader.js?v=smoke'},getElementById(){return null;}};
  const context={
    console,document,URL,window:null,globalThis:null,innerWidth:1280,
    __WAFT_ADVENTURE_REGION__:'iberia',
    fetch:async value=>{
      const name=path.basename(new URL(String(value)).pathname);
      const source=fs.readFileSync(path.join(adventure,name),'utf8');
      return{ok:true,status:200,text:async()=>source};
    },
    eval(source){patchedGameplay=String(source);}
  };
  context.window=context;context.globalThis=context;vm.createContext(context);
  new vm.Script(loader,{filename:'plugin-loader-smoke.js'}).runInContext(context);
  for(let i=0;i<100&&!patchedGameplay&&!context.__WAFT_ADVENTURE_0210_ERROR__;i++)await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal(context.__WAFT_ADVENTURE_0210_ERROR__,undefined,`plugin loader failed: ${context.__WAFT_ADVENTURE_0210_ERROR__}`);
  assert.match(patchedGameplay,/function frameRuntimeState\(api\)/,'plugin loader erased the allocation-free frame state helper');
  assert.match(patchedGameplay,/const state=frameRuntimeState\(api\)/,'plugin loader did not retain the allocation-free frame state call');
  new vm.Script(patchedGameplay,{filename:'patched-gameplay-plugin.js'});
  console.log('Adventure plugin loader patched and compiled the generated gameplay runtime.');
}
console.log('Existing World 2 runtimes and the 0.27.3 planet patch compile while retaining the shared 0.26.1 contracts.');
