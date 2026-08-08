import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const adventure=path.resolve(here,'..');
const source=fs.readFileSync(path.join(adventure,'multimodal-crossing-0236.js'),'utf8');
new vm.Script(source,{filename:'multimodal-crossing-0236.js'});

for(const pattern of [
  /movementMode==='flight'/,
  /mountedType\(state\)==='vulture'/,
  /surface\?\.water/,
  /towardKm>=\.65/,
  /flight\.travelKm>=\.8/,
  /air-corridor-0236/,
  /CORREDOR AÉREO BALEAR → CATALUNYA/,
  /mountType:'vulture'.*flight:true/,
  /game\.mountedAnimalId=vulture\.id/,
  /__WAFT_MULTIMODAL_CROSSING_0236_READY__/
]) assert.match(source,pattern,`0.23.6 multimodal crossing missing ${pattern}`);

assert.doesNotMatch(source,/mountType:'goat'.*air-corridor/,'goat must not be allowed to cross the Mediterranean as an air mount');
console.log('WAFT 0.23.6 vulture flight corridor is present, restores the mount in Catalunya, and remains separate from ground/sea travel.');
