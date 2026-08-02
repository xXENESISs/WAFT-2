import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RUNNER_VERSION = 2;
const directory = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(directory, 'build-baleares-runtime.mjs');
const patchedPath = path.join(directory, `.build-baleares-runtime-patched-v${RUNNER_VERSION}.mjs`);

let patched = fs.readFileSync(sourcePath, 'utf8');
const patches = [
  {
    oldText: 'window\\.__WAFT_PREVIEW_READY__=true',
    newText: 'window\\.__WAFT_RUNTIME_READY__=true',
    label: 'obsolete runtime-ready marker'
  },
  {
    oldText: "    assert(initial, 'No playable spawn presets were generated');",
    newText: "    if (!initial) throw new Error('No playable spawn presets were generated');",
    label: 'build-only browser assertion'
  }
];

for (const patch of patches) {
  const occurrences = patched.split(patch.oldText).length - 1;
  if (occurrences !== 1) {
    throw new Error(`Expected one ${patch.label}, found ${occurrences}`);
  }
  patched = patched.replace(patch.oldText, patch.newText);
}

fs.writeFileSync(patchedPath, patched);
try {
  const result = spawnSync(process.execPath, [patchedPath, ...process.argv.slice(2)], {
    cwd: path.resolve(directory, '../..'),
    stdio: 'inherit'
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  fs.rmSync(patchedPath, { force: true });
}
