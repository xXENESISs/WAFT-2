import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Effective runner revision 1.
const directory = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(directory, 'build-baleares-runtime-005.mjs');
const patchedPath = path.join(directory, '.build-baleares-runtime-005-effective.mjs');
let source = fs.readFileSync(sourcePath, 'utf8');

const oldBlock = `html = replaceOnce(
  html,
  '      const records = streamer.active;\\n      const exaggeration = metadata.display.buildingHorizontalExaggeration;',
  "      const records = state.worldMode === 'local' ? localAssets.preview.buildings : streamer.active;\\n      const exaggeration = metadata.display.buildingHorizontalExaggeration;",
  'local safe-spawn building records'
);`;

const newBlock = `html = replaceOnce(
  html,
  "    const spawnBlocked = (x, z) => {\\n      const records = streamer.active;\\n      const exaggeration = metadata.display.buildingHorizontalExaggeration;",
  "    const spawnBlocked = (x, z) => {\\n      const records = state.worldMode === 'local' ? localAssets.preview.buildings : streamer.active;\\n      const exaggeration = metadata.display.buildingHorizontalExaggeration;",
  'local safe-spawn building records'
);`;

const occurrences = source.split(oldBlock).length - 1;
if (occurrences !== 1) throw new Error(`Expected one unsafe safe-spawn patch block, found ${occurrences}`);
source = source.replace(oldBlock, newBlock);
fs.writeFileSync(patchedPath, source);

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
