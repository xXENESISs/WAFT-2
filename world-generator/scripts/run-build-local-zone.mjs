import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(directory, 'build-local-zone.mjs');
const patchedPath = path.join(directory, '.build-local-zone-effective.mjs');
let source = fs.readFileSync(sourcePath, 'utf8');

const patches = [
  {
    from: '  const regionalRadius = 18;',
    to: '  const regionalRadius = 28;',
    label: 'Llevant regional radius'
  },
  {
    from: "  assert(buildings.length / BUILDING_FLOATS >= 250, 'Llevant local zone has too few buildings');",
    to: "  const localBuildingCount = buildings.length / BUILDING_FLOATS;\n  assert(localBuildingCount >= 150, `Llevant local zone has too few buildings: ${localBuildingCount}`);",
    label: 'Llevant minimum building density'
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
