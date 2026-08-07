import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const here = path.dirname(new URL(import.meta.url).pathname);
const adventure = path.resolve(here, '..');
const mobile = path.resolve(adventure, '..');
const index = fs.readFileSync(path.join(adventure, 'index.html'), 'utf8');
const bootScripts = [...index.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match => match[1]).filter(Boolean);
assert.equal(bootScripts.length, 1, `expected one inline boot script, got ${bootScripts.length}`);
const boot = bootScripts[0];

const cases = [
  { id: 'baleares', search: '', file: 'region-runtime-baleares-013.html' },
  { id: 'catalunya-litoral', search: '?region=catalunya-litoral', file: 'region-runtime-catalunya-litoral-003.html' }
];

for (const test of cases) {
  const runtimeSource = fs.readFileSync(path.join(mobile, test.file), 'utf8');
  let written = '';
  const elements = new Map();
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, { textContent: '', style: {} });
      return elements.get(id);
    },
    open() { written = ''; },
    write(value) { written += String(value); },
    close() {}
  };
  const context = {
    console,
    document,
    location: { search: test.search, href: `https://example.test/adventure-0210/index.html${test.search}` },
    URL,
    URLSearchParams,
    JSON,
    encodeURIComponent,
    setTimeout,
    clearTimeout,
    fetch: async () => ({ ok: true, status: 200, text: async () => runtimeSource })
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  new vm.Script(boot, { filename: `boot-${test.id}.js` }).runInContext(context);
  for (let i = 0; i < 80 && !written; i++) await new Promise(resolve => setTimeout(resolve, 5));
  if (!written) {
    const bootError = elements.get('error')?.textContent || elements.get('status')?.textContent || 'unknown boot error';
    throw new Error(`${test.id}: boot did not write patched runtime: ${bootError}`);
  }

  for (const pattern of [
    /WAFTAdventurePlugin\?\.afterWorldDraw/,
    /setAdventureModifiers/,
    /queueAdventureJump/,
    /adventureFlight: false/,
    /adventureCoyote: \.12/,
    /adventureJumpBuffer: 0/,
    /buildingContactAt/,
    /buildingTopAt/,
    /collidesBuildingAtPlayerHeight/,
    /resolveBuildingOverlap/,
    /standOnRoof/,
    /drop > \.42/,
    /state\.yaw \+= dx \* \.0042/,
    /plugin-loader\.js/
  ]) assert.match(written, pattern, `${test.id}: missing patched mechanic ${pattern}`);

  assert.doesNotMatch(written, /state\.adventureFlight \|\| !xTerrain\.land \|\| !collidesBuilding\(nextX/, `${test.id}: infinite-height building collision survived`);

  const scripts = [...written.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match => match[1]).filter(Boolean);
  assert.ok(scripts.length >= 2, `${test.id}: expected runtime + Adventure bootstrap scripts`);
  for (const script of scripts) {
    try {
      new vm.Script(script, { filename: `patched-${test.id}.js` });
    } catch (error) {
      throw new Error(`${test.id}: patched runtime JavaScript does not compile: ${error.message}`, { cause: error });
    }
  }
  console.log(`${test.id}: patched 0.23.2 runtime compiled (${written.length} chars)`);
}

console.log('Both exact World 2 runtimes survive the complete Adventure 0.23.2 mobility patch.');
