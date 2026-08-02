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

fs.writeFileSync(temporaryPath, builder);
const result = spawnSync(process.execPath, [temporaryPath, ...process.argv.slice(2)], {
  cwd: ROOT,
  stdio: 'inherit'
});
fs.rmSync(temporaryPath, { force: true });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
