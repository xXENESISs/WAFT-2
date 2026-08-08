import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const adventure=path.resolve(here,'..');
const source=fs.readFileSync(path.join(adventure,'navigation-0234.js'),'utf8');

new vm.Script(source,{filename:'navigation-0234.js'});

for(const pattern of [
  /waft\.adventure\.0235\.sea-continuity/,
  /mountType/,
  /MONTURA · TINTORERA/,
  /setAdventureModifiers\?\.\(\{mountType:'shark'/,
  /Mallorca/,
  /Menorca/,
  /Formentera/,
  /Cerca de \$\{best\.name\}/,
  /MAR BALEAR → MEDITERRANI OCCIDENTAL/,
  /towardKm>=\.65/,
  /seaWaterKm>=\.8/,
  /__WAFT_NAVIGATION_0235_CONTINUITY_READY__/
]) assert.match(source,pattern,`navigation continuity missing ${pattern}`);

assert.doesNotMatch(source,/elapsed>=8000/,'Barcelona seam must not wait long enough to collide with the Baleares terrain edge');
assert.match(source,/localStorage\.setItem\(STORAGE_ARRIVAL,[\s\S]*mode:'corridor-0235'/,'sea arrival must use the 0.23.5 corridor marker');
assert.match(source,/localStorage\.setItem\(STORAGE_CONTINUITY,[\s\S]*mountType,boost,speed/,'crossing must persist mount and movement state');
assert.match(source,/pending\.mountType==='shark'[\s\S]*game\.mountedAnimalId=shark\.id/,'Catalunya arrival must remount a tintorera');

console.log('WAFT 0.23.5 navigation preserves place context and crosses before the Baleares terrain edge while keeping mount continuity.');
