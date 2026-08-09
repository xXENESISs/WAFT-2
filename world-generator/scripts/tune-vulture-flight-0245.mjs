import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const indexFile=path.join(ROOT,'mallorca-mobile/adventure-0210/index.html');
let source=fs.readFileSync(indexFile,'utf8');

const oldFlap="if(state.adventureFlightFlap>0){const beardedFlap=window.__WAFT_INTERNAL_GAME__?.mountedAnimalId==='iberia-bearded-vulture',flapPower=beardedFlap?Math.max(60.0,state.adventureFlightFlap*3.25):state.adventureFlightFlap;state.adventureFlightVy=Math.max(state.adventureFlightVy,flapPower);if(beardedFlap)state.iberiaFlapMomentum=.42;state.adventureFlightFlap=0;}";
const newFlap="if(state.adventureFlightFlap>0){const beardedFlap=window.__WAFT_INTERNAL_GAME__?.mountedAnimalId==='iberia-bearded-vulture',flapPower=beardedFlap?Math.max(68.0,state.adventureFlightFlap*3.5):state.adventureFlightFlap;state.adventureFlightVy=Math.max(state.adventureFlightVy,flapPower);if(beardedFlap)state.iberiaFlapMomentum=.45;state.adventureFlightFlap=0;}";
const oldClamp="state.adventureFlightVy=Math.max(-58,Math.min(58,state.adventureFlightVy));";
const newClamp="state.adventureFlightVy=Math.max(-58,Math.min(68,state.adventureFlightVy));";

let changed=false;
if(source.includes(oldFlap)){
  source=source.replace(oldFlap,newFlap);changed=true;
}else if(!source.includes(newFlap)){
  throw new Error('index.html: expected 0.24.5 vulture flap block not found');
}
if(source.includes(oldClamp)){
  source=source.replace(oldClamp,newClamp);changed=true;
}else if(!source.includes(newClamp)){
  throw new Error('index.html: expected 0.24.5 vulture vertical clamp not found');
}

if(changed){
  fs.writeFileSync(indexFile,source);
  console.log('mallorca-mobile/adventure-0210/index.html: vulture climb ceiling raised to +68; dive floor remains -58');
}else{
  console.log('mallorca-mobile/adventure-0210/index.html: final vulture 0.24.5 tuning already present');
}
