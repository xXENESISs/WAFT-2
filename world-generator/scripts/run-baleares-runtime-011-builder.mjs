import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourcePath = path.join(ROOT, 'world-generator/scripts/build-baleares-runtime-011.mjs');
const temporaryPath = path.join(ROOT, 'world-generator/scripts/.build-baleares-runtime-011-generated.mjs');

function replaceOnce(source, search, replacement, label) {
  const first = source.indexOf(search);
  if (first < 0) throw new Error(`Could not find ${label}`);
  if (source.indexOf(search, first + search.length) >= 0) throw new Error(`${label} is not unique`);
  return source.slice(0, first) + replacement + source.slice(first + search.length);
}

let builder = fs.readFileSync(sourcePath, 'utf8');

builder = replaceOnce(
  builder,
  `html = replaceOnce(
  html,
  \`      updateScaleButton();
      return true;
    };
    const enterLocal = async\`,
  \`      updateScaleButton();
      if (window.__waftTravelSave) window.__waftTravelSave('exit-local');
      return true;
    };
    const enterLocal = async\`,
  'exit local travel save'
);`,
  `html = replaceOnce(
  html,
  \`      state.localRequestedZoneId = null;
      refreshLocalProximity(true);
      return true;
    };
    const enterLocal = async\`,
  \`      state.localRequestedZoneId = null;
      refreshLocalProximity(true);
      if (window.__waftTravelSave) window.__waftTravelSave('exit-local');
      return true;
    };
    const enterLocal = async\`,
  'exit local travel save'
);`,
  'runtime 011 exit-local builder anchor'
);

builder = replaceOnce(
  builder,
  `if (!surface.inside || !surface.land || collidesBuilding(start.x, start.z)) continue;`,
  `if (!surface.inside || !surface.land || collidesFullRegionalBuilding(start.x, start.z)) continue;`,
  'full regional collision at travel probe start'
);
builder = replaceOnce(
  builder,
  `if (!stepSurface.inside || !stepSurface.land || collidesBuilding(x, z)) { clear = false; break; }`,
  `if (!stepSurface.inside || !stepSurface.land || collidesFullRegionalBuilding(x, z)) { clear = false; break; }`,
  'full regional collision along travel probe'
);

builder = replaceOnce(
  builder,
  `      const startRadius = node.discoveryRadius + 2.6;
      for (let index = 0; index < 24; index++) {
        const angle = index / 24 * Math.PI * 2;
        const start = { x: node.x + Math.cos(angle) * startRadius, z: node.z + Math.sin(angle) * startRadius };`,
  `      const startRadius = node.discoveryRadius + 3.2;
      const targetRadius = Math.max(node.arrivalRadius + .6, node.discoveryRadius - 1.8);
      for (let index = 0; index < 48; index++) {
        const angle = index / 48 * Math.PI * 2;
        const directionX = Math.cos(angle);
        const directionZ = Math.sin(angle);
        const start = { x: node.x + directionX * startRadius, z: node.z + directionZ * startRadius };
        const target = { x: node.x + directionX * targetRadius, z: node.z + directionZ * targetRadius };`,
  'travel probe boundary points'
);
builder = replaceOnce(
  builder,
  `          const x = start.x + (node.x - start.x) * t;
          const z = start.z + (node.z - start.z) * t;`,
  `          const x = start.x + (target.x - start.x) * t;
          const z = start.z + (target.z - start.z) * t;`,
  'travel probe boundary path'
);
builder = replaceOnce(
  builder,
  `          const directionX = node.x - start.x;
          const directionZ = node.z - start.z;
          return { node: { ...node }, start, yaw: Math.atan2(directionX, directionZ), suggestedMilliseconds: 1800 };`,
  `          const travelX = target.x - start.x;
          const travelZ = target.z - start.z;
          return { node: { ...node }, start, target, yaw: Math.atan2(travelX, travelZ), suggestedMilliseconds: 3800 };`,
  'travel probe boundary heading'
);

builder = replaceOnce(
  builder,
  `assert(html.includes("version: '011'"), 'Runtime API version was not upgraded');`,
  `html = replaceOnce(html, 'suggestedMilliseconds: 700', 'suggestedMilliseconds: 1200', 'runtime 011 open-water probe duration');

assert(html.includes("version: '011'"), 'Runtime API version was not upgraded');`,
  'runtime 011 water probe duration patch'
);

fs.writeFileSync(temporaryPath, builder);
const result = spawnSync(process.execPath, [temporaryPath, ...process.argv.slice(2)], {
  cwd: ROOT,
  stdio: 'inherit'
});
fs.rmSync(temporaryPath, { force: true });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
