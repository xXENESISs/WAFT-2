import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const here=path.dirname(new URL(import.meta.url).pathname);
const adventure=path.resolve(here,'..');
const loader=fs.readFileSync(path.join(adventure,'plugin-loader.js'),'utf8');
const files=new Map([
  ['gameplay-plugin.js',fs.readFileSync(path.join(adventure,'gameplay-plugin.js'),'utf8')],
  ['playability-0230.js',fs.readFileSync(path.join(adventure,'playability-0230.js'),'utf8')],
  ['mobile-polish-0231.js',fs.readFileSync(path.join(adventure,'mobile-polish-0231.js'),'utf8')],
  ['mechanics-0232.js',fs.readFileSync(path.join(adventure,'mechanics-0232.js'),'utf8')],
  ['world1-parity-0233.js',fs.readFileSync(path.join(adventure,'world1-parity-0233.js'),'utf8')],
  ['navigation-0234.js',fs.readFileSync(path.join(adventure,'navigation-0234.js'),'utf8')],
  ['multimodal-crossing-0236.js',fs.readFileSync(path.join(adventure,'multimodal-crossing-0236.js'),'utf8')]
]);
const captured=[],errors=[];
const testConsole={...console,error:(...args)=>{errors.push(args.map(value=>value?.stack||value?.message||String(value)).join(' '));console.error(...args);}};
const currentScript={src:'https://example.test/mallorca-mobile/adventure-0210/plugin-loader.js?v=ci'};
const context={
  console:testConsole,URL,Promise,setTimeout,clearTimeout,innerWidth:700,
  document:{currentScript,getElementById(){return null;}},
  fetch:async url=>{const name=new URL(String(url)).pathname.split('/').pop(),body=files.get(name);return{ok:body!==undefined,status:body!==undefined?200:404,text:async()=>body??''};},
  eval:source=>{captured.push(String(source));}
};
context.window=context;context.globalThis=context;vm.createContext(context);
new vm.Script(loader,{filename:'plugin-loader.js'}).runInContext(context);
for(let i=0;i<100&&captured.length<7&&!errors.length;i++)await new Promise(resolve=>setTimeout(resolve,5));
if(errors.length){console.log(`::error title=Loader0236::${errors.join(' | ').replace(/%/g,'%25').replace(/\r/g,'%0D').replace(/\n/g,'%0A')}`);throw new Error(errors.join(' | '));}
assert.equal(captured.length,7,'loader should produce gameplay + six support modules');

for(const [index,source] of captured.entries()){
  try{new vm.Script(source,{filename:`loader-output-${index}.js`});}
  catch(error){console.log(`::error title=LoaderOutput${index}::${String(error.message).replace(/%/g,'%25')}`);throw error;}
}
const gameplay=captured[0];
for(const pattern of [
  /const fromWater=Boolean\(state\?\.swimming\|\|mounted\?\.type==='shark'\)/,
  /horizontalBoost=.*fromWater \? 0\.42 : 0\.17/,
  /mountType:'shark'.*swimSpeed:18/,
  /mountType:'vulture'.*runSpeed:12\.4/,
  /mountType:'goat'.*runSpeed:4\.0/,
  /function dismountAnimal\(reason=''/,
  /adventureMountEject==='shark-land'/,
  /baseY=mounted\?a\.y/,
  /eyeOffset=mountType==='shark'\?0\.46/,
  /mountedEye=mounted\.type==='shark'\?0\.46:0\.82/,
  /drawPenguin\(this,player,now,mounted\.type==='shark'\?0\.52/,
  /¡MEGA!/
])assert.match(gameplay,pattern,`patched gameplay missing ${pattern}`);
assert.doesNotMatch(gameplay,/baseY=a\.flying\?a\.y:\(surface\?\.height\?\?a\.y\)/,'mounted animal still snaps to surface');

const navigation=captured[5];
for(const pattern of [
  /TARGET_BCN/,
  /manual-orient/,
  /waftPlaceHud/,
  /waftBarcelonaRoute/,
  /openWaterToward/,
  /towardKm>=\.65/,
  /seaWaterKm>=\.8/,
  /target:'catalunya-litoral'/,
  /corridor-0235/,
  /STORAGE_CONTINUITY/,
  /pending\.mountType==='shark'/,
  /__WAFT_NAVIGATION_0234_READY__/,
  /__WAFT_NAVIGATION_0235_CONTINUITY_READY__/
])assert.match(navigation,pattern,`navigation layer missing ${pattern}`);
assert.doesNotMatch(navigation,/elapsed>=8000/,'loader output must not restore the old terrain-edge race');

const multimodal=captured[6];
for(const pattern of [
  /air-corridor-0236/,
  /movementMode==='flight'/,
  /mountedType\(state\)==='vulture'/,
  /CORREDOR AÉREO BALEAR → CATALUNYA/,
  /mountType:'vulture'.*flight:true/,
  /game\.mountedAnimalId=vulture\.id/,
  /__WAFT_MULTIMODAL_CROSSING_0236_READY__/
])assert.match(multimodal,pattern,`multimodal layer missing ${pattern}`);

console.log('Actual 0.23.6 plugin-loader output compiles and supports both sea and vulture crossings from Baleares to Catalunya.');
