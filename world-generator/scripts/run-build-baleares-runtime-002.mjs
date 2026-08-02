import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RUNNER_VERSION = 1;
const directory = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(directory, 'build-baleares-runtime-002.mjs');
const patchedPath = path.join(directory, `.build-baleares-runtime-002-patched-v${RUNNER_VERSION}.mjs`);

let source = fs.readFileSync(sourcePath, 'utf8');
const startToken = 'const characterProgram = String.raw`';
const endToken = '`;\nhtml = replaceOnce(';
const start = source.indexOf(startToken);
if (start < 0) throw new Error('Character shader template start was not found');
const contentStart = start + startToken.length;
const end = source.indexOf(endToken, contentStart);
if (end < 0) throw new Error('Character shader template end was not found');
const block = source.slice(contentStart, end);
const nestedBackticks = [...block].filter(character => character === '`').length;
if (nestedBackticks !== 4) throw new Error(`Expected four nested shader backticks, found ${nestedBackticks}`);
const escapedBlock = block.replaceAll('`', '\\`');
source = source.slice(0, contentStart) + escapedBlock + source.slice(end);

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
