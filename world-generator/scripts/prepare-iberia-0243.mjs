import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');

function patch(relative,changes,marker){
  const file=path.join(ROOT,relative);
  let source=fs.readFileSync(file,'utf8');
  if(marker&&source.includes(marker)){console.log(`${relative}: already prepared 0.24.3`);return;}
  for(const [search,replacement,label] of changes){
    const count=source.split(search).length-1;
    if(count!==1)throw new Error(`${relative}: expected one ${label}, found ${count}`);
    source=source.replace(search,replacement);
  }
  fs.writeFileSync(file,source);
  console.log(`${relative}: patched for 0.24.3`);
}

const flap0242="if(state.adventureFlightFlap>0){const beardedFlap=window.__WAFT_INTERNAL_GAME__?.mountedAnimalId==='iberia-bearded-vulture',flapPower=beardedFlap?Math.max(18.5,state.adventureFlightFlap*1.85):state.adventureFlightFlap;state.adventureFlightVy=Math.max(state.adventureFlightVy,flapPower);state.adventureFlightFlap=0;}";
const flap0243="if(state.adventureFlightFlap>0){const beardedFlap=window.__WAFT_INTERNAL_GAME__?.mountedAnimalId==='iberia-bearded-vulture',flapPower=beardedFlap?Math.max(18.5,state.adventureFlightFlap*1.85):state.adventureFlightFlap;state.adventureFlightVy=Math.max(state.adventureFlightVy,flapPower);if(beardedFlap)state.iberiaFlapMomentum=.42;state.adventureFlightFlap=0;}";
const flight0242="const beardedFlight=window.__WAFT_INTERNAL_GAME__?.mountedAnimalId==='iberia-bearded-vulture';state.iberiaDive=Boolean(beardedFlight&&state.joyY>.55);if(beardedFlight){if(state.iberiaDive){const diveAmount=Math.min(1,Math.max(0,(state.joyY-.55)/.45)),targetDiveVy=-(18+22*diveAmount),diveBlend=1-Math.exp(-dt*11);state.adventureFlightVy+=(targetDiveVy-state.adventureFlightVy)*diveBlend;}else{state.adventureFlightVy-=.28*dt;}state.adventureFlightVy=Math.max(-40,Math.min(26,state.adventureFlightVy));}";
const flight0243="const beardedFlight=window.__WAFT_INTERNAL_GAME__?.mountedAnimalId==='iberia-bearded-vulture';state.iberiaDive=Boolean(beardedFlight&&state.joyY>.55);if(beardedFlight){if(state.iberiaDive){state.iberiaFlapMomentum=0;const diveAmount=Math.min(1,Math.max(0,(state.joyY-.55)/.45)),targetDiveVy=-(30+28*diveAmount),diveBlend=1-Math.exp(-dt*15);state.adventureFlightVy+=(targetDiveVy-state.adventureFlightVy)*diveBlend;}else{state.iberiaFlapMomentum=Math.max(0,(state.iberiaFlapMomentum||0)-dt);if(state.iberiaFlapMomentum>0)state.adventureFlightVy*=Math.exp(-dt*1.15);else state.adventureFlightVy=0;}state.adventureFlightVy=Math.max(-58,Math.min(26,state.adventureFlightVy));}";

patch('mallorca-mobile/adventure-0210/index.html',[
  [flap0242,flap0243,'quebrantahuesos flap momentum'],
  [flight0242,flight0243,'quebrantahuesos level flight and stronger dive'],
  [
    "window.__WAFT_ADVENTURE_BUILD__='0.24.2';<\\/script>\\n<script src=\"adventure-0210/plugin-loader.js?v=${encodeURIComponent(version)}\"><\\/script>\\n${regionId==='iberia'?`<script src=\"adventure-0210/iberia-explorer-0242.js?v=${encodeURIComponent(version)}\"><\\/script>\\n`:''}${uiSafety}",
    "window.__WAFT_ADVENTURE_BUILD__='0.24.3';<\\/script>\\n<script src=\"adventure-0210/plugin-loader.js?v=${encodeURIComponent(version)}\"><\\/script>\\n${regionId==='iberia'?`<script src=\"adventure-0210/iberia-explorer-0242.js?v=${encodeURIComponent(version)}\"><\\/script>\\n<script src=\"adventure-0210/iberia-polish-0243.js?v=${encodeURIComponent(version)}\"><\\/script>\\n`:''}${uiSafety}",
    '0.24.3 polish bootstrap'
  ],
  [
    "// WAFT_IBERIA_EXPLORER_0242\n      document.open();document.write(source);document.close();",
    "// WAFT_IBERIA_EXPLORER_0242\n      // WAFT_IBERIA_POLISH_0243: stable level flight, stronger dive, remount/follow and compact geo HUD.\n      document.open();document.write(source);document.close();",
    '0.24.3 marker'
  ]
], 'WAFT_IBERIA_POLISH_0243');

patch('mallorca-mobile/adventure-0210/plugin-loader.js',[
  [
    "Península Ibérica · EXPLORACIÓN 0.24.2 · guardados ",
    "Península Ibérica · EXPLORACIÓN 0.24.3 · guardados ",
    'Iberia HUD version'
  ]
], 'EXPLORACIÓN 0.24.3');

// Keep an already-generated 0.24.3 runtime upgradable when flight tuning changes inside the same release.
{
  const file=path.join(ROOT,'mallorca-mobile/adventure-0210/index.html');
  let source=fs.readFileSync(file,'utf8'),changed=false;
  const oldFlap="if(state.adventureFlightFlap>0){const beardedFlap=window.__WAFT_INTERNAL_GAME__?.mountedAnimalId==='iberia-bearded-vulture',flapPower=beardedFlap?Math.max(18.5,state.adventureFlightFlap*1.85):state.adventureFlightFlap;state.adventureFlightVy=Math.max(state.adventureFlightVy,flapPower);state.adventureFlightFlap=0;}";
  const oldLevel="const beardedFlight=window.__WAFT_INTERNAL_GAME__?.mountedAnimalId==='iberia-bearded-vulture';state.iberiaDive=Boolean(beardedFlight&&state.joyY>.55);if(beardedFlight){if(state.iberiaDive){const diveAmount=Math.min(1,Math.max(0,(state.joyY-.55)/.45)),targetDiveVy=-(30+28*diveAmount),diveBlend=1-Math.exp(-dt*15);state.adventureFlightVy+=(targetDiveVy-state.adventureFlightVy)*diveBlend;}else{const levelBlend=1-Math.exp(-dt*5.2);state.adventureFlightVy+=(0-state.adventureFlightVy)*levelBlend;if(Math.abs(state.adventureFlightVy)<.035)state.adventureFlightVy=0;}state.adventureFlightVy=Math.max(-58,Math.min(26,state.adventureFlightVy));}";
  if(source.includes(oldFlap)){source=source.replace(oldFlap,flap0243);changed=true;}
  if(source.includes(oldLevel)){source=source.replace(oldLevel,flight0243);changed=true;}
  if(changed){fs.writeFileSync(file,source);console.log('mallorca-mobile/adventure-0210/index.html: upgraded 0.24.3 level-flight tuning');}
}

console.log('WAFT 0.24.3 Iberia polish preparation complete.');
