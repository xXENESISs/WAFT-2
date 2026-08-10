import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import './verify.mjs';

const here=path.dirname(new URL(import.meta.url).pathname),root=path.resolve(here,'../..');
const index=fs.readFileSync(path.join(here,'index.html'),'utf8');
const ui=fs.readFileSync(path.join(here,'iberia-world-0249.js'),'utf8');
new vm.Script(ui,{filename:'iberia-world-0249.js'});

for(const pattern of [
  /iberia-world-0249\.js/,
  /waftWorldLabels0249/,
  /waftNearest0249/,
  /WAFTWorldUi0249/,
  /PENÍNSULA IBÉRICA · EXPLORACIÓN 0\.24\.9/
])assert.match(index+ui,pattern,`0.24.9 bootstrap/UI missing ${pattern}`);
for(const pattern of [
  /#waftFranceBadge0246,#waftRegionBadge0247,#presets,#placesGuide\{display:none!important\}/,
  /WAFT_WORLD_ATLAS_PROVIDER/,
  /MutationObserver/,
  /itemPopulation/,
  /itemTier/,
  /radiusFor/,
  /isAdventureVisible/,
  /☠️/,
  /hab <span class="skull">☠️<\/span>/
])assert.match(ui,pattern,`0.24.9 unified settlement labels missing ${pattern}`);
assert.doesNotMatch(ui,/FRANCE · \d+ VILLES · TERRAIN CONTINU/,'0.24.9 UI reintroduced duplicate France terrain badge');

const settlements=JSON.parse(fs.readFileSync(path.join(root,'regions/iberia/settlements.json'),'utf8')).items||[];
const france=JSON.parse(fs.readFileSync(path.join(root,'regions/france/settlements.json'),'utf8')).items||[];
const canarias=JSON.parse(fs.readFileSync(path.join(root,'regions/canarias/settlements.json'),'utf8')).items||[];
const portugal=settlements.filter(x=>x.countryCode==='PT');
assert.ok(portugal.length>=100,`0.24.9 Portugal coverage regressed: ${portugal.length}`);
assert.ok(france.length>=450,`0.24.9 France coverage regressed: ${france.length}`);
assert.ok(canarias.length>=30,`0.24.9 Canarias coverage regressed: ${canarias.length}`);
console.log(`WAFT 0.24.9 verification passed: legacy parity + geographic streaming + one HUD + shared nearby settlement labels with population/☠️ for Iberia, Portugal, France and Canarias.`);
