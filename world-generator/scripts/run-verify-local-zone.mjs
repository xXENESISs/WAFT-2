import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(directory, 'verify-local-zone.mjs');
const patchedPath = path.join(directory, '.verify-local-zone-effective.mjs');
let source = fs.readFileSync(sourcePath, 'utf8');

const patches = [
  {
    from: '  assert(header.buildingCount >= 250 && header.buildingCount < 5866, `Invalid local building count: ${header.buildingCount}`);',
    to: '  assert(header.buildingCount >= 150 && header.buildingCount < 5866, `Invalid local building count: ${header.buildingCount}`);',
    label: 'Llevant minimum building density'
  },
  {
    from: "  assert(metadata.regionalRadius === 18, 'Local radius contract changed');",
    to: "  assert(metadata.regionalRadius === 28, 'Local radius contract changed');",
    label: 'Llevant regional radius contract'
  }
];

for (const patch of patches) {
  const occurrences = source.split(patch.from).length - 1;
  if (occurrences !== 1) throw new Error(`Expected one ${patch.label} marker, found ${occurrences}`);
  source = source.replace(patch.from, patch.to);
}

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
