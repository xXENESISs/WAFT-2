import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const adventure=path.resolve(here,'..');
const source=fs.readFileSync(path.join(adventure,'bidirectional-crossing-0237.js'),'utf8');
new vm.Script(source,{filename:'bidirectional-crossing-0237.js'});

for(const pattern of [
  /TARGET_MALLORCA=\{lat:39\.852,lon:3\.1399999/,
  /state\.movementMode==='flight'/,
  /mountedType\(state\)==='vulture'/,
  /state\.swimming\|\|mountedType\(state\)==='shark'/,
  /target:'baleares'/,
  /from:'catalunya-litoral'/,
  /sea-corridor-0237/,
  /air-corridor-0237/,
  /STORAGE_SEA/,
  /STORAGE_AIR/,
  /url\.searchParams\.delete\('region'\)/,
  /towardKm>=\.65/,
  /crossing\.travelKm>=\.8/,
  /MLL ✓/,
  /CORREDOR AÉREO CATALUNYA → BALEARES/,
  /MEDITERRANI OCCIDENTAL → MAR BALEAR/,
  /__WAFT_BIDIRECTIONAL_CROSSING_0237_READY__/
])assert.match(source,pattern,`0.23.7 return corridor missing ${pattern}`);

assert.doesNotMatch(source,/mountType:'goat'.*air-corridor-0237/,'goat must not cross the Mediterranean as an air mount');
assert.match(source,/mode==='air'.*STORAGE_AIR[\s\S]*else localStorage\.setItem\(STORAGE_SEA/,'air and sea return continuity must use their matching storage channels');
console.log('WAFT 0.23.7 restores Catalunya → Mallorca travel by swimming, shark and vulture, preserving the matching continuity state.');
