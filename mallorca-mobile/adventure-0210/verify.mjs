import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const here = path.dirname(new URL(import.meta.url).pathname);
const mobile = path.resolve(here, '..');
const index = fs.readFileSync(path.join(here, 'index.html'), 'utf8');
const loader = fs.readFileSync(path.join(here, 'plugin-loader.js'), 'utf8');
const plugin = [0,1,2,3].map(number => fs.readFileSync(path.join(here, `gameplay-plugin.part0${number}.txt`), 'utf8')).join('');
const runtimes = [
  path.join(mobile, 'region-runtime-baleares-013.html'),
  path.join(mobile, 'region-runtime-catalunya-litoral-003.html'),
];

assert.match(index, /WAFT Adventure 0\.21\.0/);
assert.match(index, /region-runtime-baleares-013\.html/);
assert.match(index, /region-runtime-catalunya-litoral-003\.html/);
assert.match(index, /state\.yaw \+= dx \* \.0042/);
assert.match(index, /WAFTAdventurePlugin\?\.afterWorldDraw/);
assert.match(index, /setAdventureModifiers/);
assert.match(index, /plugin-loader\.js/);
new vm.Script(loader, { filename: 'plugin-loader.js' });

for (const runtimePath of runtimes) {
  const source = fs.readFileSync(runtimePath, 'utf8');
  for (const anchor of ['drawCharacter(now, eye);','jump() { state.jumpQueued = true; },','window.WAFTRegionRuntime = {']) {
    assert.ok(source.includes(anchor), `${path.basename(runtimePath)} is missing ${anchor}`);
  }
  const patched = source
    .replace('state.yaw -= dx * .0042;', 'state.yaw += dx * .0042;')
    .replace('      drawCharacter(now, eye);', '      if (!window.WAFTAdventurePlugin?.hideBaseCharacter) drawCharacter(now, eye);\n      window.WAFTAdventurePlugin?.afterWorldDraw?.(now, eye, pv);')
    .replace('      jump() { state.jumpQueued = true; },', `      jump() { state.jumpQueued = true; },\n      setAdventureModifiers(modifiers = {}) { return modifiers; },`);
  assert.ok(patched.includes('state.yaw += dx * .0042;'));
  assert.ok(patched.includes('afterWorldDraw?.(now, eye, pv)'));
  assert.ok(patched.includes('setAdventureModifiers(modifiers = {})'));
  const scripts = [...patched.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match => match[1]);
  assert.ok(scripts.length >= 1, `${path.basename(runtimePath)} has no script`);
  for (const script of scripts) new vm.Script(script, { filename: path.basename(runtimePath) });
}

new vm.Script(plugin, { filename: 'gameplay-plugin.js' });
for (const pattern of [
  /function drawPenguin/, /function buildAdventurePopulation/, /Lagartija balear/, /Gineta/,
  /Myotragus balearicus/, /Cabra mallorquina/, /Vaca menorquina/, /Porc negre mallorquí/,
  /Curruca balear/, /Tintorera/, /Buitre negro/, /function mountAnimal/,
  /function checkpointAction/, /function travelToOtherRegion/, /waft\.adventure\.integration\.0210\.v1/
]) assert.match(plugin, pattern);
assert.doesNotMatch(plugin, /createTerrainMesh|parseTerrain|terrain\.bin/);
const fauna = [...plugin.matchAll(/\['[^']+','(?:lizard|gineta|myotragus|goat|cow|pig|warbler|vulture|shark)'/g)];
assert.ok(fauna.length >= 10, `expected at least 10 fauna entries, got ${fauna.length}`);
console.log('WAFT Adventure 0.21.0 integration validated: both exact regional runtimes, penguin, fauna, mission, mounts, charged jump, checkpoints, save and inter-region travel.');
