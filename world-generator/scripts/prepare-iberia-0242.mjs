import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');

function patch(relative,changes,marker){
  const file=path.join(ROOT,relative);
  let source=fs.readFileSync(file,'utf8');
  if(marker&&source.includes(marker)){console.log(`${relative}: already prepared 0.24.2`);return;}
  for(const [search,replacement,label] of changes){
    const count=source.split(search).length-1;
    if(count!==1)throw new Error(`${relative}: expected one ${label}, found ${count}`);
    source=source.replace(search,replacement);
  }
  fs.writeFileSync(file,source);
  console.log(`${relative}: patched for 0.24.2`);
}

patch('mallorca-mobile/adventure-0210/index.html',[
  [
    "      if(state.adventureFlight) speed=inputLength<.06?8.2:(boosted||inputLength>.93?26.5:inputLength>.70?19.0:12.4);",
    "      if(state.adventureFlight){const bearded=window.__WAFT_INTERNAL_GAME__?.mountedAnimalId==='iberia-bearded-vulture',dive=bearded&&state.joyY>.55;speed=bearded?(dive?(boosted?58:52):(inputLength<.06?18:(boosted||inputLength>.93?38:inputLength>.70?30:22))):(inputLength<.06?8.2:(boosted||inputLength>.93?26.5:inputLength>.70?19.0:12.4));}",
    'quebrantahuesos flight speed'
  ],
  [
    "        if(state.adventureFlightFlap>0){state.adventureFlightVy=Math.max(state.adventureFlightVy,state.adventureFlightFlap);state.adventureFlightFlap=0;}",
    "        if(state.adventureFlightFlap>0){const beardedFlap=window.__WAFT_INTERNAL_GAME__?.mountedAnimalId==='iberia-bearded-vulture',flapPower=beardedFlap?Math.max(18.5,state.adventureFlightFlap*1.85):state.adventureFlightFlap;state.adventureFlightVy=Math.max(state.adventureFlightVy,flapPower);state.adventureFlightFlap=0;}",
    'quebrantahuesos stronger flap'
  ],
  [
    "        state.adventureFlightVy-=2.0*dt;if(inputLength>.93)state.adventureFlightVy-=1.25*dt;state.adventureFlightVy=Math.max(-5.2,Math.min(12,state.adventureFlightVy));state.camera.y+=state.adventureFlightVy*dt;",
    "        const beardedFlight=window.__WAFT_INTERNAL_GAME__?.mountedAnimalId==='iberia-bearded-vulture';state.iberiaDive=Boolean(beardedFlight&&state.joyY>.55);if(beardedFlight){if(state.iberiaDive){const diveAmount=Math.min(1,Math.max(0,(state.joyY-.55)/.45));state.adventureFlightVy-=(25+21*diveAmount)*dt;}else{state.adventureFlightVy-=.28*dt;}state.adventureFlightVy=Math.max(-40,Math.min(26,state.adventureFlightVy));}else{state.adventureFlightVy-=2.0*dt;if(inputLength>.93)state.adventureFlightVy-=1.25*dt;state.adventureFlightVy=Math.max(-5.2,Math.min(12,state.adventureFlightVy));state.iberiaDive=false;}state.camera.y+=state.adventureFlightVy*dt;",
    'quebrantahuesos dive physics'
  ],
  [
    "adventureLastWaterZ: state.adventureLastWaterZ, adventureCurrentSpeed: state.adventureCurrentSpeed,",
    "adventureLastWaterZ: state.adventureLastWaterZ, adventureCurrentSpeed: state.adventureCurrentSpeed, iberiaDive: Boolean(state.iberiaDive),",
    'public dive state'
  ],
  [
    "window.__WAFT_ADVENTURE_BUILD__='0.24.0';<\\/script>\\n<script src=\"adventure-0210/plugin-loader.js?v=${encodeURIComponent(version)}\"><\\/script>\\n${uiSafety}\\n</body>`",
    "window.__WAFT_ADVENTURE_BUILD__='0.24.2';<\\/script>\\n<script src=\"adventure-0210/plugin-loader.js?v=${encodeURIComponent(version)}\"><\\/script>\\n${regionId==='iberia'?`<script src=\"adventure-0210/iberia-explorer-0242.js?v=${encodeURIComponent(version)}\"><\\/script>\\n`:''}${uiSafety}\\n</body>`",
    'Iberia explorer bootstrap'
  ],
  [
    "      document.open();document.write(source);document.close();",
    "      if(regionId==='iberia'){source=source.replaceAll('state.respawnQueued = true',\"if(window.__WAFT_ADVENTURE_REGION__!=='iberia')state.respawnQueued = true\");source=source.replace('</head>','<style>#down{display:none!important;pointer-events:none!important}</style></head>');} // WAFT_IBERIA_EXPLORER_0242\n      document.open();document.write(source);document.close();",
    'Iberia ghost respawn guard'
  ]
], 'WAFT_IBERIA_EXPLORER_0242');

patch('mallorca-mobile/adventure-0210/plugin-loader.js',[
  [
    "if (REGION_ID === 'iberia') return 'Prueba de escala peninsular · solo terreno y relieve.';",
    "if (REGION_ID === 'iberia') return 'Explora Iberia · mantén el joystick abajo en vuelo para entrar en picado.';",
    'Iberia objective'
  ],
  [
    "'Península Ibérica · TERRENO 0.24.0 · guardados '",
    "'Península Ibérica · EXPLORACIÓN 0.24.2 · guardados '",
    'Iberia HUD version'
  ]
], 'EXPLORACIÓN 0.24.2');

console.log('WAFT 0.24.2 Iberia explorer preparation complete.');
