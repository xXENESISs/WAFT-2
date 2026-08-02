import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const logPath = path.join(ROOT, 'world-generator/baleares-runtime-diagnostic.log');
const statusPath = path.join(ROOT, 'world-generator/baleares-runtime-diagnostic-status.json');
const generatedPath = path.join(ROOT, 'mallorca-mobile/region-runtime-baleares-001.html');
const inlinePath = '/tmp/region-runtime-inline.mjs';
const log = [];

function run(command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8' });
  log.push(`$ ${command} ${args.join(' ')}`);
  if (result.stdout) log.push(result.stdout.trimEnd());
  if (result.stderr) log.push(result.stderr.trimEnd());
  log.push(`exit=${result.status ?? 99}`);
  return result.status ?? 99;
}

const syntax = run(process.execPath, ['--check', 'world-generator/scripts/build-baleares-runtime.mjs']);
const build = run(process.execPath, ['world-generator/scripts/build-baleares-runtime.mjs']);
let inlineSyntax = 99;
if (build === 0) {
  try {
    const html = fs.readFileSync(generatedPath, 'utf8');
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
    if (scripts.length !== 1) throw new Error(`Expected one inline script, found ${scripts.length}`);
    fs.writeFileSync(inlinePath, scripts[0][1]);
    inlineSyntax = run(process.execPath, ['--check', inlinePath]);
  } catch (error) {
    log.push(error.stack || error.message);
    inlineSyntax = 98;
  }
}

const status = {
  diagnosticVersion: 3,
  syntax,
  build,
  inlineSyntax,
  valid: syntax === 0 && build === 0 && inlineSyntax === 0
};
fs.writeFileSync(logPath, `${log.join('\n')}\n`);
fs.writeFileSync(statusPath, `${JSON.stringify(status, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(status, null, 2)}\n`);
process.exitCode = status.valid ? 0 : 1;
