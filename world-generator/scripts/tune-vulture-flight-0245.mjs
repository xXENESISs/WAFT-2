import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const indexFile=path.join(ROOT,'mallorca-mobile/adventure-0210/index.html');
let source=fs.readFileSync(indexFile,'utf8');

const flap60="if(state.adventureFlightFlap>0){const beardedFlap=window.__WAFT_INTERNAL_GAME__?.mountedAnimalId==='iberia-bearded-vulture',flapPower=beardedFlap?Math.max(60.0,state.adventureFlightFlap*3.25):state.adventureFlightFlap;state.adventureFlightVy=Math.max(state.adventureFlightVy,flapPower);if(beardedFlap)state.iberiaFlapMomentum=.42;state.adventureFlightFlap=0;}";
const flap68="if(state.adventureFlightFlap>0){const beardedFlap=window.__WAFT_INTERNAL_GAME__?.mountedAnimalId==='iberia-bearded-vulture',flapPower=beardedFlap?Math.max(68.0,state.adventureFlightFlap*3.5):state.adventureFlightFlap;state.adventureFlightVy=Math.max(state.adventureFlightVy,flapPower);if(beardedFlap)state.iberiaFlapMomentum=.45;state.adventureFlightFlap=0;}";
const flapFinal="if(state.adventureFlightFlap>0){const beardedFlap=window.__WAFT_INTERNAL_GAME__?.mountedAnimalId==='iberia-bearded-vulture',flapPower=beardedFlap?Math.max(96.0,state.adventureFlightFlap*4.0):state.adventureFlightFlap;state.adventureFlightVy=Math.max(state.adventureFlightVy,flapPower);if(beardedFlap)state.iberiaFlapMomentum=.50;state.adventureFlightFlap=0;}";
const clamp58="state.adventureFlightVy=Math.max(-58,Math.min(58,state.adventureFlightVy));";
const clamp68="state.adventureFlightVy=Math.max(-58,Math.min(68,state.adventureFlightVy));";
const clampFinal="state.adventureFlightVy=Math.max(-58,Math.min(96,state.adventureFlightVy));";

let changed=false;
if(source.includes(flap60)){
  source=source.replace(flap60,flapFinal);changed=true;
}else if(source.includes(flap68)){
  source=source.replace(flap68,flapFinal);changed=true;
}else if(!source.includes(flapFinal)){
  throw new Error('index.html: expected 0.24.5 vulture flap block not found');
}
if(source.includes(clamp58)){
  source=source.replace(clamp58,clampFinal);changed=true;
}else if(source.includes(clamp68)){
  source=source.replace(clamp68,clampFinal);changed=true;
}else if(!source.includes(clampFinal)){
  throw new Error('index.html: expected 0.24.5 vulture vertical clamp not found');
}

if(changed){
  fs.writeFileSync(indexFile,source);
  console.log('mallorca-mobile/adventure-0210/index.html: vulture flap raised to 96 with 0.50s momentum; dive floor remains -58');
}else{
  console.log('mallorca-mobile/adventure-0210/index.html: final vulture 0.24.5 tuning already present');
}
