import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const here=path.dirname(new URL(import.meta.url).pathname);
const mobile=path.resolve(here,'..');
const read=name=>fs.readFileSync(path.join(here,name),'utf8');
const index=read('index.html');
const loader=read('plugin-loader.js');
const plugin=read('gameplay-plugin.js');
const playability=read('playability-0230.js');
const mobilePolish=read('mobile-polish-0231.js');
const mechanics=read('mechanics-0232.js');
const parity=read('world1-parity-0233.js');

for(const [name,source] of [['plugin-loader.js',loader],['gameplay-plugin.js',plugin],['playability-0230.js',playability],['mobile-polish-0231.js',mobilePolish],['mechanics-0232.js',mechanics],['world1-parity-0233.js',parity]]){
  new vm.Script(source,{filename:name});
}
for(const script of [...index.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(Boolean))new vm.Script(script,{filename:'adventure-index-inline.js'});

for(const pattern of [
  /WAFT Adventure 0\.23\.3/,
  /state\.yaw -= dx \* \.0053/,
  /Math\.max\(-1\.05, Math\.min\(1\.46, state\.pitch \+ dy \* \.0043\)\)/,
  /lookUpLift=Math\.max\(0,-state\.pitch\)\*state\.cameraDistance\*\.92/,
  /minimumDistance=Math\.min\(\.28,desiredDistance\*\.055\)/,
  /const steps=Math\.max\(12,Math\.min\(24,Math\.ceil\(desiredDistance\/\.28\)\)\)/,
  /roof=buildingTopAt\(regional\.x,regional\.z,0\)/,
  /terrain\.land&&terrain\.height\+\.20>point\[1\]/,
  /adventureBuildingGrid/,
  /ensureAdventureBuildingGrid/,
  /grid\.cells\.get\(Math\.floor\(x\/grid\.cellSize\)/,
  /adventureStepSize=state\.adventureFlight\?\.72:state\.adventureWaterJump\?\.52/,
  /adventureMaxSteps=state\.adventureFlight\?10:state\.adventureWaterJump\?14:26/,
  /Math\.min\(adventureMaxSteps,Math\.ceil\(distance\/adventureStepSize\)\)/,
  /__WAFT_UI_SAFETY_READY__/,
  /waftPanelClose/,
  /aria-expanded/,
  /gravity: 20\.5/,
  /adventureWaterJump/,
  /adventureSharkBreachSpeed/,
  /adventureLastWaterX/,
  /adventureMountEject/,
  /waterDrive=boosted\|\|inputLength>\.93\?42:inputLength>\.70\?30:18/,
  /inputLength<\.06\?8\.2:\(boosted\|\|inputLength>\.93\?26\.5:inputLength>\.70\?19\.0:12\.4\)/,
  /state\.adventureMountType==='goat'.*15\.8/,
  /isAdventureVisible/,
  /buildingContactAt/,
  /standOnRoof/,
  /queueAdventureJump\(velocity,options=\{\}\)/,
  /horizontalBoost/,
  /__WAFT_ADVENTURE_BUILD__='0\.24\.2'/
]) assert.match(index,pattern,`index missing ${pattern}`);
assert.doesNotMatch(index,/state\.yaw \+= dx/,'camera drag was re-inverted');
assert.doesNotMatch(index,/minimumDistance = Math\.min\(1\.05, desiredDistance \* \.30\)/,'old near-camera terrain blind spot survived');
assert.doesNotMatch(index,/let blocked=false;const steps=40/,'40-probe camera hot path survived');

for(const pattern of [
  /world1-parity-0233\.js/,
  /BUILD_ID = window\.__WAFT_ADVENTURE_BUILD__ \|\| '0\.23\.3'/,
  /fromWater \? 0\.42 : 0\.17/,
  /fromWater \? 0\.38 : 0\.27/,
  /mountType:'shark'/,
  /swimSpeed:18/,
  /mountType:'vulture'/,
  /runSpeed:12\.4/,
  /mountType:'goat'/,
  /runSpeed:4\.0/,
  /adventureMountEject==='shark-land'/,
  /adventureLastWaterX/,
  /baseY=mounted\?a\.y/,
  /mountedEye=mounted\.type==='shark'\?0\.46:0\.82/,
  /mounted\.type==='shark'\?0\.52/,
  /¡MEGA!/
]) assert.match(loader,pattern,`loader missing ${pattern}`);

for(const pattern of [
  /animal\.type==='goat'\|\|animal\.type==='shark'\|\|animal\.type==='vulture'/,
  /api\.isAdventureVisible/,
  /visibilityCache/,
  /drawAnimatedGoat/,
  /drawAnimatedCow/,
  /terrainRoll/,
  /__WAFT_PARITY_0233_READY__/
]) assert.match(parity,pattern,`parity layer missing ${pattern}`);

assert.match(mechanics,/#6d3d86/);
assert.match(mechanics,/waftMegaPulse0232/);
assert.match(mobilePolish,/installSharkRenderer/);
assert.match(playability,/WAFTAnimalRenderer0230/);
assert.match(plugin,/function mountAnimal/);
assert.match(plugin,/function updateAnimals/);

for(const runtimeFile of ['region-runtime-baleares-013.html','region-runtime-catalunya-litoral-003.html']){
  const source=fs.readFileSync(path.join(mobile,runtimeFile),'utf8');
  for(const anchor of [
    'state.yaw -= dx * .0042;',
    'state.pitch = Math.max(-.12, Math.min(.72, state.pitch - dy * .0035));',
    'gravity: 13.5,',
    'const collidesBuilding = (x, z) => collidesBuildingWithRadius(x, z, state.playerCollisionRadius);',
    'const resolveThirdPersonCamera = (target, desired) => {',
    'const minimumDistance = Math.min(1.05, desiredDistance * .30);',
    'const center = [target[0], target[1] + .18, target[2]];',
    'const swimmingBeforeMove = terrainBeforeMove.inside && !terrainBeforeMove.land;',
    'const wasSwimming = state.swimming;',
    'const steps = Math.max(1, Math.ceil(distance / .12));',
    'jump() { state.jumpQueued = true; },',
    'drawCharacter(now, eye);'
  ]) assert.ok(source.includes(anchor),`${runtimeFile} lost integration anchor: ${anchor}`);
}

const reference=path.join(here,'reference','world1-015-source.html');
if(fs.existsSync(reference)){
  const world1=fs.readFileSync(reference,'utf8');
  for(const feature of ['desiredYaw-=dx*.0053','Math.max(-1.05,Math.min(1.46,desiredPitch+dy*.0043))','Math.max(0,-pitch)*radius*.92','megaMax=(fromWater?21.30:23.55)','player.coyote=.12'])assert.ok(world1.includes(feature),`World 1 reference lost ${feature}`);
}

console.log('WAFT 0.24.2 verification passed: World 1 parity remains intact while Iberia explorer uses the current Adventure build marker.');
