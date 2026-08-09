import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const indexFile=path.join(ROOT,'mallorca-mobile/adventure-0210/index.html');
const loaderFile=path.join(ROOT,'mallorca-mobile/adventure-0210/plugin-loader.js');
let source=fs.readFileSync(indexFile,'utf8');

const replaceExact=(search,replacement,label)=>{
  const count=source.split(search).length-1;
  if(count!==1)throw new Error(`index.html: expected one ${label}, found ${count}`);
  source=source.replace(search,replacement);
};

const flap0245BeforeStrongMargin="if(state.adventureFlightFlap>0){const beardedFlap=window.__WAFT_INTERNAL_GAME__?.mountedAnimalId==='iberia-bearded-vulture',flapPower=beardedFlap?Math.max(56.0,state.adventureFlightFlap*3.1):state.adventureFlightFlap;state.adventureFlightVy=Math.max(state.adventureFlightVy,flapPower);if(beardedFlap)state.iberiaFlapMomentum=.34;state.adventureFlightFlap=0;}";
const flap0245StrongMargin="if(state.adventureFlightFlap>0){const beardedFlap=window.__WAFT_INTERNAL_GAME__?.mountedAnimalId==='iberia-bearded-vulture',flapPower=beardedFlap?Math.max(60.0,state.adventureFlightFlap*3.25):state.adventureFlightFlap;state.adventureFlightVy=Math.max(state.adventureFlightVy,flapPower);if(beardedFlap)state.iberiaFlapMomentum=.42;state.adventureFlightFlap=0;}";
const flight0245BeforeDiveInterrupt="const beardedFlight=window.__WAFT_INTERNAL_GAME__?.mountedAnimalId==='iberia-bearded-vulture';state.iberiaDive=Boolean(beardedFlight&&state.joyY>.55);if(beardedFlight){if(state.iberiaDive){state.iberiaFlapMomentum=0;const diveAmount=Math.min(1,Math.max(0,(state.joyY-.55)/.45)),targetDiveVy=-(30+28*diveAmount),diveBlend=1-Math.exp(-dt*15);state.adventureFlightVy+=(targetDiveVy-state.adventureFlightVy)*diveBlend;}else{state.iberiaFlapMomentum=Math.max(0,(state.iberiaFlapMomentum||0)-dt);if(state.iberiaFlapMomentum>0)state.adventureFlightVy*=Math.exp(-dt*1.45);else state.adventureFlightVy=0;}state.adventureFlightVy=Math.max(-58,Math.min(58,state.adventureFlightVy));}";
const flight0245WithDiveInterrupt="const beardedFlight=window.__WAFT_INTERNAL_GAME__?.mountedAnimalId==='iberia-bearded-vulture',wasIberiaDive=Boolean(state.iberiaDive);state.iberiaDive=Boolean(beardedFlight&&state.joyY>.55);if(beardedFlight){if(state.iberiaDive){state.iberiaFlapMomentum=0;if(!wasIberiaDive&&state.adventureFlightVy>0)state.adventureFlightVy=0;const diveAmount=Math.min(1,Math.max(0,(state.joyY-.55)/.45)),targetDiveVy=-(30+28*diveAmount),diveBlend=1-Math.exp(-dt*15);state.adventureFlightVy+=(targetDiveVy-state.adventureFlightVy)*diveBlend;}else{state.iberiaFlapMomentum=Math.max(0,(state.iberiaFlapMomentum||0)-dt);if(state.iberiaFlapMomentum>0)state.adventureFlightVy*=Math.exp(-dt*1.45);else state.adventureFlightVy=0;}state.adventureFlightVy=Math.max(-58,Math.min(60,state.adventureFlightVy));}";

if(!source.includes('WAFT_IBERIA_WORLD_0245')){
  const oldSpeed="if(state.adventureFlight){const bearded=window.__WAFT_INTERNAL_GAME__?.mountedAnimalId==='iberia-bearded-vulture',dive=bearded&&state.joyY>.55;speed=bearded?(dive?(boosted?58:52):(inputLength<.06?18:(boosted||inputLength>.93?38:inputLength>.70?30:22))):(inputLength<.06?8.2:(boosted||inputLength>.93?26.5:inputLength>.70?19.0:12.4));}";
  const newSpeed="if(state.adventureFlight){const bearded=window.__WAFT_INTERNAL_GAME__?.mountedAnimalId==='iberia-bearded-vulture',dive=bearded&&state.joyY>.55;speed=bearded?(dive?(boosted?58:52):(inputLength<.06?24:(boosted||inputLength>.93?46:inputLength>.70?38:30))):(inputLength<.06?8.2:(boosted||inputLength>.93?26.5:inputLength>.70?19.0:12.4));}";
  replaceExact(oldSpeed,newSpeed,'buff horizontal del quebrantahuesos');

  const oldFlap="if(state.adventureFlightFlap>0){const beardedFlap=window.__WAFT_INTERNAL_GAME__?.mountedAnimalId==='iberia-bearded-vulture',flapPower=beardedFlap?Math.max(42.0,state.adventureFlightFlap*2.4):state.adventureFlightFlap;state.adventureFlightVy=Math.max(state.adventureFlightVy,flapPower);if(beardedFlap)state.iberiaFlapMomentum=.42;state.adventureFlightFlap=0;}";
  replaceExact(oldFlap,flap0245StrongMargin,'impulso vertical del quebrantahuesos');

  const oldFlight="const beardedFlight=window.__WAFT_INTERNAL_GAME__?.mountedAnimalId==='iberia-bearded-vulture';state.iberiaDive=Boolean(beardedFlight&&state.joyY>.55);if(beardedFlight){if(state.iberiaDive){state.iberiaFlapMomentum=0;const diveAmount=Math.min(1,Math.max(0,(state.joyY-.55)/.45)),targetDiveVy=-(30+28*diveAmount),diveBlend=1-Math.exp(-dt*15);state.adventureFlightVy+=(targetDiveVy-state.adventureFlightVy)*diveBlend;}else{state.iberiaFlapMomentum=Math.max(0,(state.iberiaFlapMomentum||0)-dt);if(state.iberiaFlapMomentum>0)state.adventureFlightVy*=Math.exp(-dt*1.15);else state.adventureFlightVy=0;}state.adventureFlightVy=Math.max(-58,Math.min(44,state.adventureFlightVy));}";
  replaceExact(oldFlight,flight0245WithDiveInterrupt,'recuperación neutral y entrada inmediata en picado');

  const runtimeAnchor='      const uiSafety=`<script>(()=>{';
  const runtimePatches=`      // WAFT 0.24.5: real adjacent terrain sampler plus explicit regional GPU release/restore.\n      replaceOne('    const terrainMesh = createTerrainMesh(gl, terrain, landcover, metadata);',\n        \`    let terrainMesh=captureMesh(()=>createTerrainMesh(gl,terrain,landcover,metadata));\\n    state.adventureRegionalTerrainReleased=false;\`, 'captura GPU terreno regional 0.24.5');\n      replaceOne('    const sampleTerrainInfo = (x, z) => {',\n        \`    const sampleTerrainInfo=(x,z)=>{\\n      if(state.worldMode==='regional'){const streamed=window.WAFTWorldStreaming0245?.sampleSurface?.(x,z);if(streamed)return streamed;}\`, 'sampler France 0.24.5');\n      replaceOne('      if (state.terrain) { gl.useProgram(terrainProgram);',\n        \`      if(state.terrain&&!(state.worldMode==='regional'&&state.adventureRegionalTerrainReleased)){ gl.useProgram(terrainProgram);\`, 'release visual Iberia 0.24.5');\n      replaceOne('      sampleSurface(x, z) { return sampleTerrainInfo(Number(x), Number(z)); },',\n        \`      sampleSurface(x,z){return sampleTerrainInfo(Number(x),Number(z));},\\n      releaseRegionalTerrainGpu(){if(state.adventureRegionalTerrainReleased)return 0;const released=disposeMesh(gl,terrainMesh);state.adventureRegionalTerrainReleased=true;return released;},\\n      restoreRegionalTerrainGpu(){if(!state.adventureRegionalTerrainReleased)return 0;terrainMesh=captureMesh(()=>createTerrainMesh(gl,terrain,landcover,metadata));state.adventureRegionalTerrainReleased=false;return 1+(terrainMesh.gpuBuffers?.length||0);},\`, 'API release/restore Iberia 0.24.5');\n      replaceOne('adventureCurrentSpeed: state.adventureCurrentSpeed, iberiaDive: Boolean(state.iberiaDive),',\n        'adventureCurrentSpeed: state.adventureCurrentSpeed, iberiaDive: Boolean(state.iberiaDive), adventureRegionalTerrainReleased: Boolean(state.adventureRegionalTerrainReleased),', 'estado GPU público 0.24.5');\n\n`;
  replaceExact(runtimeAnchor,runtimePatches+runtimeAnchor,'ancla de runtime streaming');

  replaceExact("window.__WAFT_ADVENTURE_BUILD__='0.24.4';","window.__WAFT_ADVENTURE_BUILD__='0.24.5';",'build 0.24.5');
  const world0244='<script src="adventure-0210/iberia-world-0244.js?v=${encodeURIComponent(version)}"><\\/script>\\n';
  const world0245=world0244+'<script src="adventure-0210/iberia-world-0245.js?v=${encodeURIComponent(version)}"><\\/script>\\n';
  replaceExact(world0244,world0245,'bootstrap world 0.24.5');
  replaceExact('      // WAFT_IBERIA_WORLD_0244: stronger climb, special places, population lore and adjacent-chunk prefetch.\n',
    '      // WAFT_IBERIA_WORLD_0244: stronger climb, special places, population lore and adjacent-chunk prefetch.\n      // WAFT_IBERIA_WORLD_0245: local markers fixed, faster vulture and real Iberia -> France terrain seam.\n', 'marcador 0.24.5');

  fs.writeFileSync(indexFile,source);
  console.log('mallorca-mobile/adventure-0210/index.html: prepared 0.24.5');
}else{
  console.log('mallorca-mobile/adventure-0210/index.html: already prepared 0.24.5');
}

// 0.24.5 vertical buff: keep a clear margin over 0.24.4 without introducing neutral drift.
if(source.includes(flap0245BeforeStrongMargin)){
  source=source.replace(flap0245BeforeStrongMargin,flap0245StrongMargin);
  fs.writeFileSync(indexFile,source);
  console.log('mallorca-mobile/adventure-0210/index.html: stronger climb margin applied');
}else if(source.includes(flap0245StrongMargin)){
  console.log('mallorca-mobile/adventure-0210/index.html: stronger climb margin already present');
}else{
  throw new Error('index.html: 0.24.5 bearded-vulture flap block not found');
}

// Stronger flap must never make the first dive frame keep climbing.
if(source.includes(flight0245BeforeDiveInterrupt)){
  source=source.replace(flight0245BeforeDiveInterrupt,flight0245WithDiveInterrupt);
  fs.writeFileSync(indexFile,source);
  console.log('mallorca-mobile/adventure-0210/index.html: dive interrupt hotfix applied');
}else if(source.includes(flight0245WithDiveInterrupt)){
  console.log('mallorca-mobile/adventure-0210/index.html: dive interrupt hotfix already present');
}else{
  throw new Error('index.html: 0.24.5 bearded-vulture flight block not found');
}

let loader=fs.readFileSync(loaderFile,'utf8');
if(loader.includes('Península Ibérica · EXPLORACIÓN 0.24.4 · guardados ')){
  loader=loader.replace('Península Ibérica · EXPLORACIÓN 0.24.4 · guardados ','Península Ibérica · EXPLORACIÓN 0.24.5 · guardados ');
  fs.writeFileSync(loaderFile,loader);
  console.log('mallorca-mobile/adventure-0210/plugin-loader.js: HUD 0.24.5');
}else if(loader.includes('Península Ibérica · EXPLORACIÓN 0.24.5 · guardados ')){
  console.log('mallorca-mobile/adventure-0210/plugin-loader.js: already 0.24.5');
}else{
  throw new Error('plugin-loader.js: Iberia HUD version marker not found');
}

console.log('WAFT 0.24.5 Iberia/France preparation complete.');