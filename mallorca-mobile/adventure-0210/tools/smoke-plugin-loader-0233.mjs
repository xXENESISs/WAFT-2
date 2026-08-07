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
  ['world1-parity-0233.js',fs.readFileSync(path.join(adventure,'world1-parity-0233.js'),'utf8')]
]);
const captured=[];
const currentScript={src:'https://example.test/mallorca-mobile/adventure-0210/plugin-loader.js?v=ci'};
const context={
  console,URL,Promise,setTimeout,clearTimeout,innerWidth:700,
  document:{currentScript,getElementById(){return null;}},
  fetch:async url=>{
    const name=new URL(String(url)).pathname.split('/').pop();
    const body=files.get(name);
    return {ok:body!==undefined,status:body!==undefined?200:404,text:async()=>body??''};
  },
  eval:source=>{captured.push(String(source));}
};
context.window=context;context.globalThis=context;
vm.createContext(context);
new vm.Script(loader,{filename:'plugin-loader.js'}).runInContext(context);
for(let i=0;i<100&&captured.length<5;i++)await new Promise(resolve=>setTimeout(resolve,5));
assert.equal(captured.length,5,'loader should produce gameplay + four support modules');

for(const [index,source] of captured.entries())new vm.Script(source,{filename:`loader-output-${index}.js`});
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
console.log('Actual 0.23.3 plugin-loader transformations compile and preserve unified mount physics.');
