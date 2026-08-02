import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RUNNER_VERSION = 1;
const directory = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(directory, 'build-baleares-runtime.mjs');
const patchedPath = path.join(directory, `.build-baleares-runtime-patched-v${RUNNER_VERSION}.mjs`);

const source = fs.readFileSync(sourcePath, 'utf8');
const oldMarker = 'window\\.__WAFT_PREVIEW_READY__=true';
const newMarker = 'window\\.__WAFT_RUNTIME_READY__=true';
const occurrences = source.split(oldMarker).length - 1;
if (occurrences !== 1) {
  throw new Error(`Expected one obsolete runtime-ready marker, found ${occurrences}`);
}

const patched = source.replace(oldMarker, newMarker);
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
