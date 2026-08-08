import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const adventure=path.resolve(here,'..');
const source=fs.readFileSync(path.join(adventure,'barcelona-playability-0238.js'),'utf8');
new vm.Script(source,{filename:'barcelona-playability-0238.js'});

for(const pattern of [
  /REGION_ID!=='catalunya-litoral'/,
  /BARCELONA_ZONE='catalunya-litoral-barcelona-0170'/,
  /PORT_LOCAL=\{x:5\.3339,z:62\.2339\}/,
  /PORT DE BARCELONA/,
  /CENTRE DE BARCELONA/,
  /MONTJUÏC/,
  /CATEDRAL/,
  /SAGRADA FAMÍLIA/,
  /\^\(0235-sea-\|0236-air-\)/,
  /toCentre\.distance<=18/,
  /api\.setRegionalPosition\?\.\(water\.x,water\.z\)/,
  /mount==='vulture'.*flight:true/,
  /mount==='shark'.*swimSpeed:18/,
  /state\.localProximityZoneId===BARCELONA_ZONE/,
  /state\.localProximityStatus==='available'/,
  /api\.enterLocal\?\.\(BARCELONA_ZONE\)/,
  /api\.exitLocal\?\.\(\)/,
  /ENTRAR BCN ×5/,
  /SALIR BCN/,
  /ZONA URBANA/,
  /__WAFT_BARCELONA_PLAYABILITY_0238_READY__/
]) assert.match(source,pattern,`0.23.8 Barcelona playability missing ${pattern}`);

assert.doesNotMatch(source,/40\.965/,'0.23.8 must not preserve the obsolete south-of-Barcelona arrival coordinate');
console.log('WAFT 0.23.8 Barcelona layer reconnects incoming crossings to Port de Barcelona, exposes dense local mode, and provides city landmark orientation.');
