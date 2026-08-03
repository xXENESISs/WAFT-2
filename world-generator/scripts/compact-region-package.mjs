import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_THRESHOLD_BYTES = 1024 * 1024;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted(value[key])]));
  }
  return value;
}

function stableJson(value) {
  return `${JSON.stringify(sorted(value), null, 2)}\n`;
}

function compactJson(value) {
  return `${JSON.stringify(value)}\n`;
}

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function parseArguments(argv) {
  const args = [...argv];
  const regionId = args.shift();
  if (!regionId) throw new Error('Usage: node compact-region-package.mjs <region-id> [--output-dir <path>] [--threshold-bytes <n>]');
  let outputDirectory = null;
  let thresholdBytes = DEFAULT_THRESHOLD_BYTES;
  while (args.length) {
    const flag = args.shift();
    if (flag === '--output-dir') outputDirectory = args.shift();
    else if (flag === '--threshold-bytes') thresholdBytes = Number(args.shift());
    else throw new Error(`Unknown argument ${flag}`);
  }
  if (!Number.isFinite(thresholdBytes) || thresholdBytes < 0) throw new Error('thresholdBytes must be a non-negative number');
  return { regionId, outputDirectory, thresholdBytes };
}

function compactRegionPackage({ regionId, outputDirectory, thresholdBytes }) {
  const config = readJson(path.join(ROOT, 'world-generator/configs', `${regionId}.region.json`));
  const packageDirectory = path.resolve(ROOT, outputDirectory ?? config.outputs.directory);
  const manifestPath = path.join(packageDirectory, config.outputs.manifest);
  const manifest = readJson(manifestPath);
  const compacted = [];

  for (const record of manifest.files) {
    const filePath = path.join(packageDirectory, record.path);
    if (!record.path.endsWith('.json') || !fs.existsSync(filePath)) continue;
    const beforeBytes = fs.statSync(filePath).size;
    if (beforeBytes < thresholdBytes) continue;
    const data = Buffer.from(compactJson(readJson(filePath)));
    if (data.length >= beforeBytes) continue;
    fs.writeFileSync(filePath, data);
    compacted.push({ path: record.path, beforeBytes, afterBytes: data.length });
  }

  manifest.files = manifest.files.map(record => {
    const data = fs.readFileSync(path.join(packageDirectory, record.path));
    return { path: record.path, bytes: data.length, sha256: sha256(data) };
  });
  manifest.packageBytesWithoutManifest = manifest.files.reduce((sum, record) => sum + record.bytes, 0);
  manifest.packageEncoding = {
    ...(manifest.packageEncoding ?? {}),
    json: 'compact-utf8-v1',
    deterministic: true
  };
  fs.writeFileSync(manifestPath, stableJson(manifest));

  const manifestBytes = fs.statSync(manifestPath).size;
  const packageBytes = manifest.packageBytesWithoutManifest + manifestBytes;
  const budgetBytes = config.performance.budgets.downloadMb * 1024 * 1024;
  if (packageBytes > budgetBytes) {
    throw new Error(`Compacted package still exceeds ${config.performance.budgets.downloadMb} MB (${packageBytes} bytes)`);
  }

  process.stdout.write(stableJson({
    regionId,
    packageDirectory: path.relative(ROOT, packageDirectory),
    compacted,
    packageBytes,
    budgetBytes
  }));
}

try {
  compactRegionPackage(parseArguments(process.argv.slice(2)));
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
