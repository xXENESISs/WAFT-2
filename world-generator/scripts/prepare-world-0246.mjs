import fs from 'node:fs';

const indexPath='mallorca-mobile/adventure-0210/index.html';
const francePath='mallorca-mobile/adventure-0210/iberia-world-0245.js';
let index=fs.readFileSync(indexPath,'utf8');
let france=fs.readFileSync(francePath,'utf8');
const replace=(src,a,b,label)=>{if(src.includes(b))return src;if(!src.includes(a))throw new Error(`0.24.6 missing ${label}`);return src.replace(a,b);};

index=replace(index,"__WAFT_ADVENTURE_BUILD__='0.24.5'","__WAFT_ADVENTURE_BUILD__='0.24.6'",'build id');
index=replace(index,"Península Ibérica · EXPLORACIÓN 0.24.5","Península Ibérica · EXPLORACIÓN 0.24.6",'exploration label');
index=replace(index,"EXPEDICIÓN · 0.24.5","EXPEDICIÓN · 0.24.6",'expedition label');
index=replace(index,
  "state.iberiaDive=Boolean(beardedFlight&&state.joyY>.55);",
  "state.iberiaDive=Boolean(beardedFlight&&(state.iberiaDiveButton||state.joyY>.55));",
  'explicit dive input');
index=replace(index,
  "diveAmount=Math.min(1,Math.max(0,(state.joyY-.55)/.45))",
  "diveAmount=state.iberiaDiveButton?1:Math.min(1,Math.max(0,(state.joyY-.55)/.45))",
  'full dive amount');
index=replace(index,
  "if('boost'in modifiers)state.boost=Boolean(modifiers.boost);",
  "if('boost'in modifiers)state.boost=Boolean(modifiers.boost);if('flightDive'in modifiers)state.iberiaDiveButton=Boolean(modifiers.flightDive);",
  'dive modifier api');
index=replace(index,
  '<script src="adventure-0210/iberia-world-0245.js?v=${encodeURIComponent(version)}"><\\/script>\\\n`,',
  '<script src="adventure-0210/iberia-world-0245.js?v=${encodeURIComponent(version)}"><\\/script>\\\n<script src="adventure-0210/iberia-world-0246.js?v=${encodeURIComponent(version)}"><\\/script>\\\n`,',
  '0246 bootstrap');

france=replace(france,'const LOD_MIN_LAT=43.54;','const LOD_MIN_LAT=42.10;','France overlap start');
france=replace(france,'const FRANCE_SAMPLE_LAT=43.50;','const FRANCE_SAMPLE_LAT=42.65;','France surface start');
france=replace(france,'const FULL_SWITCH_LAT=43.64;','const FULL_SWITCH_LAT=43.20;','France full switch');
france=replace(france,'const RESTORE_IBERIA_LAT=43.42;','const RESTORE_IBERIA_LAT=42.98;','Iberia restore switch');
france=replace(france,'const MORPH_START_LAT=43.30;','const MORPH_START_LAT=42.45;','projection morph start');
france=replace(france,'const MORPH_END_LAT=44.60;','const MORPH_END_LAT=43.30;','projection morph end');
france=france.replaceAll('buildMesh(5,LOD_MIN_LAT)','buildMesh(4,LOD_MIN_LAT)');
france=replace(france,"mode:stride===1?'france-full':'france-lod',lift:stride===1?0:.025","mode:stride===1?'france-full':'france-lod',lift:stride===1?0:-.08",'LOD underlay');

fs.writeFileSync(indexPath,index);
fs.writeFileSync(francePath,france);
console.log('WAFT 0.24.6 prepared: explicit dive, physical landmark layer and hidden-under-Iberia France overlap.');
