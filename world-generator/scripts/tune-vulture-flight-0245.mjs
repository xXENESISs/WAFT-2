import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const indexFile=path.join(ROOT,'mallorca-mobile/adventure-0210/index.html');
let source=fs.readFileSync(indexFile,'utf8');

const flap60="if(state.adventureFlightFlap>0){const beardedFlap=window.__WAFT_INTERNAL_GAME__?.mountedAnimalId==='iberia-bearded-vulture',flapPower=beardedFlap?Math.max(60.0,state.adventureFlightFlap*3.25):state.adventureFlightFlap;state.adventureFlightVy=Math.max(state.adventureFlightVy,flapPower);if(beardedFlap)state.iberiaFlapMomentum=.42;state.adventureFlightFlap=0;}";
const flap68="if(state.adventureFlightFlap>0){const beardedFlap=window.__WAFT_INTERNAL_GAME__?.mountedAnimalId==='iberia-bearded-vulture',flapPower=beardedFlap?Math.max(68.0,state.adventureFlightFlap*3.5):state.adventureFlightFlap;state.adventureFlightVy=Math.max(state.adventureFlightVy,flapPower);if(beardedFlap)state.iberiaFlapMomentum=.45;state.adventureFlightFlap=0;}";
const flap96="if(state.adventureFlightFlap>0){const beardedFlap=window.__WAFT_INTERNAL_GAME__?.mountedAnimalId==='iberia-bearded-vulture',flapPower=beardedFlap?Math.max(96.0,state.adventureFlightFlap*4.0):state.adventureFlightFlap;state.adventureFlightVy=Math.max(state.adventureFlightVy,flapPower);if(beardedFlap)state.iberiaFlapMomentum=.50;state.adventureFlightFlap=0;}";
const flapTimed="if(state.adventureFlightFlap>0){const beardedFlap=window.__WAFT_INTERNAL_GAME__?.mountedAnimalId==='iberia-bearded-vulture',flapPower=beardedFlap?Math.max(72.0,state.adventureFlightFlap*3.6):state.adventureFlightFlap;state.adventureFlightVy=Math.max(state.adventureFlightVy,flapPower);if(beardedFlap){state.iberiaFlapMomentum=.38;state.iberiaFlapUntil=performance.now()+380;}state.adventureFlightFlap=0;}";
const flapFinal="if(state.adventureFlightFlap>0){const beardedFlap=window.__WAFT_INTERNAL_GAME__?.mountedAnimalId==='iberia-bearded-vulture',flapPower=beardedFlap?Math.max(72.0,state.adventureFlightFlap*3.6):state.adventureFlightFlap;state.adventureFlightVy=Math.max(state.adventureFlightVy,flapPower);if(beardedFlap){state.camera.y+=4.0;state.iberiaFlapMomentum=.38;state.iberiaFlapUntil=performance.now()+380;}state.adventureFlightFlap=0;}";

const flightBase="const beardedFlight=window.__WAFT_INTERNAL_GAME__?.mountedAnimalId==='iberia-bearded-vulture',wasIberiaDive=Boolean(state.iberiaDive);state.iberiaDive=Boolean(beardedFlight&&state.joyY>.55);if(beardedFlight){if(state.iberiaDive){state.iberiaFlapMomentum=0;if(!wasIberiaDive&&state.adventureFlightVy>0)state.adventureFlightVy=0;const diveAmount=Math.min(1,Math.max(0,(state.joyY-.55)/.45)),targetDiveVy=-(30+28*diveAmount),diveBlend=1-Math.exp(-dt*15);state.adventureFlightVy+=(targetDiveVy-state.adventureFlightVy)*diveBlend;}else{state.iberiaFlapMomentum=Math.max(0,(state.iberiaFlapMomentum||0)-dt);if(state.iberiaFlapMomentum>0)state.adventureFlightVy*=Math.exp(-dt*1.45);else state.adventureFlightVy=0;}state.adventureFlightVy=Math.max(-58,Math.min(58,state.adventureFlightVy));}";
const flight68=flightBase.replace('Math.min(58,state.adventureFlightVy)','Math.min(68,state.adventureFlightVy)');
const flight96=flightBase.replace('Math.min(58,state.adventureFlightVy)','Math.min(96,state.adventureFlightVy)');
const flightFinal="const beardedFlight=window.__WAFT_INTERNAL_GAME__?.mountedAnimalId==='iberia-bearded-vulture',wasIberiaDive=Boolean(state.iberiaDive);state.iberiaDive=Boolean(beardedFlight&&state.joyY>.55);if(beardedFlight){if(state.iberiaDive){state.iberiaFlapMomentum=0;state.iberiaFlapUntil=0;if(!wasIberiaDive&&state.adventureFlightVy>0)state.adventureFlightVy=0;const diveAmount=Math.min(1,Math.max(0,(state.joyY-.55)/.45)),targetDiveVy=-(30+28*diveAmount),diveBlend=1-Math.exp(-dt*15);state.adventureFlightVy+=(targetDiveVy-state.adventureFlightVy)*diveBlend;}else{const flapActive=(state.iberiaFlapUntil||0)>performance.now();if(flapActive){state.iberiaFlapMomentum=Math.max(0,(state.iberiaFlapMomentum||0)-dt);state.adventureFlightVy*=Math.exp(-dt*1.45);}else{state.iberiaFlapMomentum=0;state.iberiaFlapUntil=0;state.adventureFlightVy=0;}}state.adventureFlightVy=Math.max(-58,Math.min(72,state.adventureFlightVy));}";

let changed=false;
for(const oldFlap of [flap60,flap68,flap96,flapTimed]){
  if(source.includes(oldFlap)){source=source.replace(oldFlap,flapFinal);changed=true;break;}
}
if(!source.includes(flapFinal))throw new Error('index.html: expected 0.24.5 vulture flap block not found');
for(const oldFlight of [flight96,flight68,flightBase]){
  if(source.includes(oldFlight)){source=source.replace(oldFlight,flightFinal);changed=true;break;}
}
if(!source.includes(flightFinal))throw new Error('index.html: expected 0.24.5 vulture flight block not found');

if(changed){
  fs.writeFileSync(indexFile,source);
  console.log('mallorca-mobile/adventure-0210/index.html: vulture flap +4 immediate lift, 72 impulse, 380ms real-time window, deterministic neutral; dive floor remains -58');
}else console.log('mallorca-mobile/adventure-0210/index.html: final vulture 0.24.5 tuning already present');
