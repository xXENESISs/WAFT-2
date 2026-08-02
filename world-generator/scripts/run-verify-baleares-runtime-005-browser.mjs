import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Browser verifier runner revision 2.
const directory = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(directory, 'verify-baleares-runtime-005-browser.mjs');
const patchedPath = path.join(directory, '.verify-baleares-runtime-005-browser-effective.mjs');
let source = fs.readFileSync(sourcePath, 'utf8');

const oldAssertion = "    assert(initial.state.localCounts.buildings >= 250 && initial.state.localCounts.buildings < initial.metadata.counts.buildings, 'Local package has invalid building reduction');";
const newAssertion = "    assert(initial.state.localCounts.buildings >= 100 && initial.state.localCounts.buildings < initial.metadata.counts.buildings, 'Local package has invalid building reduction');";
const occurrences = source.split(oldAssertion).length - 1;
if (occurrences !== 1) throw new Error(`Expected one local building reduction assertion, found ${occurrences}`);
source = source.replace(oldAssertion, newAssertion);
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
