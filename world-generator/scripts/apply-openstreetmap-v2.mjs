import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const BASE_SCRIPT = path.join(SCRIPT_DIRECTORY, 'apply-openstreetmap.mjs');
const COMPACTOR = path.join(SCRIPT_DIRECTORY, 'compact-region-package.mjs');

function parseRegionId(argv) {
  return argv.find(argument => !argument.startsWith('-')) ?? 'baleares';
}

function outputDirectoryArguments(argv) {
  const index = argv.indexOf('--output-dir');
  return index >= 0 && argv[index + 1] ? ['--output-dir', argv[index + 1]] : [];
}

function run(script, args) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: path.resolve(SCRIPT_DIRECTORY, '../..'),
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024
  });
}

const args = process.argv.slice(2);
const regionId = parseRegionId(args);
const applied = run(BASE_SCRIPT, args);
if (applied.stdout) process.stdout.write(applied.stdout);
if (applied.stderr) process.stderr.write(applied.stderr);

if (applied.error) throw applied.error;
if (applied.status === 0) process.exit(0);

const output = `${applied.stdout ?? ''}\n${applied.stderr ?? ''}`;
if (!output.includes('OpenStreetMap package exceeds')) process.exit(applied.status ?? 1);

process.stderr.write(`Recovering ${regionId} package by compacting generated JSON without dropping regional data.\n`);
const compacted = run(COMPACTOR, [regionId, ...outputDirectoryArguments(args)]);
if (compacted.stdout) process.stdout.write(compacted.stdout);
if (compacted.stderr) process.stderr.write(compacted.stderr);
if (compacted.error) throw compacted.error;
process.exit(compacted.status ?? 1);
