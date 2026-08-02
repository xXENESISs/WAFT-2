import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(directory, 'build-local-zone.mjs');
const result = spawnSync(process.execPath, [sourcePath, ...process.argv.slice(2)], {
  cwd: path.resolve(directory, '../..'),
  stdio: 'inherit'
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
