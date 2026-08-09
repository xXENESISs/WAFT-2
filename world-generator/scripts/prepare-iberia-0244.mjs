import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');

function patch(relative,changes,marker){
  const file=path.join(ROOT,relative);let source=fs.readFileSync(file,'utf8');
  if(marker&&source.includes(marker)){console.log(`${relative}: already prepared 0.24.4`);return;}
  for(const [search,replacement,label] of changes){const count=source.split(search).length-1;if(count!==1)throw new Error(`${relative}: expected one ${label}, found ${count}`);source=source.replace(search,replacement);}
  fs.writeFileSync(file,source);console.log(`${relative}: patched for 0.24.4`);
}

const flap0243="if(state.adventureFlightFlap>0){const beardedFlap=window.__WAFT_INTERNAL_GAME__?.mountedAnimalId==='iberia-bearded-vulture',flapPower=beardedFlap?Math.max(18.5,state.adventureFlightFlap*1.85):state.adventureFlightFlap;state.adventureFlightVy=Math.max(state.adventureFlightVy,flapPower);if(beardedFlap)state.iberiaFlapMomentum=.42;state.adventureFlightFlap=0;}";
const flap0244="if(state.adventureFlightFlap>0){const beardedFlap=window.__WAFT_INTERNAL_GAME__?.mountedAnimalId==='iberia-bearded-vulture',flapPower=beardedFlap?Math.max(24.0,state.adventureFlightFlap*2.05):state.adventureFlightFlap;state.adventureFlightVy=Math.max(state.adventureFlightVy,flapPower);if(beardedFlap)state.iberiaFlapMomentum=.58;state.adventureFlightFlap=0;}";
const flight0243="const beardedFlight=window.__WAFT_INTERNAL_GAME__?.mountedAnimalId==='iberia-bearded-vulture';state.iberiaDive=Boolean(beardedFlight&&state.joyY>.55);if(beardedFlight){if(state.iberiaDive){state.iberiaFlapMomentum=0;const diveAmount=Math.min(1,Math.max(0,(state.joyY-.55)/.45)),targetDiveVy=-(30+28*diveAmount),diveBlend=1-Math.exp(-dt*15);state.adventureFlightVy+=(targetDiveVy-state.adventureFlightVy)*diveBlend;}else{state.iberiaFlapMomentum=Math.max(0,(state.iberiaFlapMomentum||0)-dt);if(state.iberiaFlapMomentum>0)state.adventureFlightVy*=Math.exp(-dt*1.15);else state.adventureFlightVy=0;}state.adventureFlightVy=Math.max(-58,Math.min(26,state.adventureFlightVy));}";
const flight0244="const beardedFlight=window.__WAFT_INTERNAL_GAME__?.mountedAnimalId==='iberia-bearded-vulture';state.iberiaDive=Boolean(beardedFlight&&state.joyY>.55);if(beardedFlight){if(state.iberiaDive){state.iberiaFlapMomentum=0;const diveAmount=Math.min(1,Math.max(0,(state.joyY-.55)/.45)),targetDiveVy=-(30+28*diveAmount),diveBlend=1-Math.exp(-dt*15);state.adventureFlightVy+=(targetDiveVy-state.adventureFlightVy)*diveBlend;}else{state.iberiaFlapMomentum=Math.max(0,(state.iberiaFlapMomentum||0)-dt);if(state.iberiaFlapMomentum>0)state.adventureFlightVy*=Math.exp(-dt*.86);else state.adventureFlightVy=0;}state.adventureFlightVy=Math.max(-58,Math.min(30,state.adventureFlightVy));}";

patch('mallorca-mobile/adventure-0210/index.html',[
  [flap0243,flap0244,'stronger bearded-vulture flap'],
  [flight0243,flight0244,'longer bearded-vulture climb impulse'],
  ["window.__WAFT_ADVENTURE_BUILD__='0.24.3';<\\/script>\\n<script src=\"adventure-0210/plugin-loader.js?v=${encodeURIComponent(version)}\"><\\/script>\\n${regionId==='iberia'?`<script src=\"adventure-0210/iberia-explorer-0242.js?v=${encodeURIComponent(version)}\"><\\/script>\\n<script src=\"adventure-0210/iberia-polish-0243.js?v=${encodeURIComponent(version)}\"><\\/script>\\n`:''}${uiSafety}",
   "window.__WAFT_ADVENTURE_BUILD__='0.24.4';<\\/script>\\n<script src=\"adventure-0210/plugin-loader.js?v=${encodeURIComponent(version)}\"><\\/script>\\n${regionId==='iberia'?`<script src=\"adventure-0210/iberia-explorer-0242.js?v=${encodeURIComponent(version)}\"><\\/script>\\n<script src=\"adventure-0210/iberia-polish-0243.js?v=${encodeURIComponent(version)}\"><\\/script>\\n<script src=\"adventure-0210/iberia-world-0244.js?v=${encodeURIComponent(version)}\"><\\/script>\\n`:''}${uiSafety}",'0.24.4 bootstrap'],
  ["// WAFT_IBERIA_POLISH_0243: stable level flight, stronger dive, remount/follow and compact geo HUD.\n      document.open();document.write(source);document.close();",
   "// WAFT_IBERIA_POLISH_0243: stable level flight, stronger dive, remount/follow and compact geo HUD.\n      // WAFT_IBERIA_WORLD_0244: stronger climb, special places, population lore and adjacent-chunk prefetch.\n      document.open();document.write(source);document.close();",'0.24.4 marker']
], 'WAFT_IBERIA_WORLD_0244');

patch('mallorca-mobile/adventure-0210/plugin-loader.js',[
  ["Península Ibérica · EXPLORACIÓN 0.24.3 · guardados ","Península Ibérica · EXPLORACIÓN 0.24.4 · guardados ",'Iberia HUD version']
], 'EXPLORACIÓN 0.24.4');

console.log('WAFT 0.24.4 Iberia world preparation complete.');
// Deterministic pass: legacy preparers may safely no-op after this layer is present.
