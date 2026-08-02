import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function stableJson(value) {
  const sort = input => {
    if (Array.isArray(input)) return input.map(sort);
    if (input && typeof input === 'object') return Object.fromEntries(Object.keys(input).sort().map(key => [key, sort(input[key])]));
    return input;
  };
  return `${JSON.stringify(sort(value), null, 2)}\n`;
}

function build() {
  const regionId = process.argv[2] ?? 'baleares';
  const configPath = path.join(ROOT, 'world-generator', 'configs', `${regionId}-local-zones.json`);
  assert(fs.existsSync(configPath), `Missing local-zone config ${configPath}`);
  const config = readJson(configPath);
  assert(config.formatVersion === 1 && config.regionId === regionId, 'Invalid local-zone config');
  assert(Array.isArray(config.zones) && config.zones.length >= 2, 'The local-zone registry requires at least two zones');

  const localDirectory = path.join(ROOT, 'regions', regionId, 'local');
  const zoneEntries = [];
  const fingerprintParts = [fs.readFileSync(configPath), fs.readFileSync(fileURLToPath(import.meta.url))];
  const ids = new Set();
  const presetIds = new Set();

  for (const zone of config.zones) {
    assert(!ids.has(zone.id), `Duplicate local zone id ${zone.id}`);
    assert(!presetIds.has(zone.presetId), `Duplicate local-zone preset ${zone.presetId}`);
    ids.add(zone.id);
    presetIds.add(zone.presetId);
    const metadataRelative = `${zone.id}/${zone.id}-local-v1.json`;
    const metadataPath = path.join(localDirectory, metadataRelative);
    assert(fs.existsSync(metadataPath), `Missing local-zone metadata ${metadataPath}`);
    const metadataBuffer = fs.readFileSync(metadataPath);
    const metadata = JSON.parse(metadataBuffer.toString('utf8'));
    assert(metadata.packageType === 'waft-local-zone', `Invalid package type for ${zone.id}`);
    assert(metadata.regionId === regionId && metadata.zoneId === zone.id, `Metadata mismatch for ${zone.id}`);
    assert(metadata.presetId === zone.presetId, `Preset mismatch for ${zone.id}`);
    assert(metadata.name === zone.name, `Name mismatch for ${zone.id}`);
    const binaryRelative = `${zone.id}/${metadata.binary.file}`;
    const binaryPath = path.join(localDirectory, binaryRelative);
    assert(fs.existsSync(binaryPath), `Missing local-zone binary ${binaryPath}`);
    const binary = fs.readFileSync(binaryPath);
    assert(sha256(binary) === metadata.binary.sha256, `Binary SHA-256 mismatch for ${zone.id}`);
    assert(binary.length === metadata.binary.bytes, `Binary byte count mismatch for ${zone.id}`);
    fingerprintParts.push(metadataBuffer, binary);
    zoneEntries.push({
      id: zone.id,
      presetId: zone.presetId,
      name: zone.name,
      metadataFile: metadataRelative,
      metadataSha256: sha256(metadataBuffer),
      binaryFile: binaryRelative,
      binarySha256: metadata.binary.sha256,
      binaryBytes: metadata.binary.bytes,
      buildId: metadata.buildId,
      center: metadata.center,
      regionalRadius: metadata.regionalRadius,
      worldScale: metadata.worldScale,
      footprintScale: metadata.footprintScale,
      terrain: {
        columns: metadata.terrain.columns,
        rows: metadata.terrain.rows,
        landCells: metadata.terrain.landCells
      },
      counts: metadata.counts
    });
  }

  const fingerprint = sha256(Buffer.concat(fingerprintParts));
  const registry = {
    formatVersion: 1,
    registryType: 'waft-local-zone-registry',
    regionId,
    buildId: `${regionId}-local-zones-${fingerprint.slice(0, 12)}`,
    deterministic: true,
    zoneCount: zoneEntries.length,
    zones: zoneEntries,
    source: {
      configFile: path.relative(ROOT, configPath).replaceAll(path.sep, '/'),
      fingerprint
    }
  };
  const outputName = config.registryFile ?? 'zones-v1.json';
  const outputPath = path.join(localDirectory, outputName);
  fs.mkdirSync(localDirectory, { recursive: true });
  fs.writeFileSync(outputPath, stableJson(registry));

  const report = {
    formatVersion: 1,
    valid: true,
    regionId,
    buildId: registry.buildId,
    registryFile: path.relative(ROOT, outputPath).replaceAll(path.sep, '/'),
    zoneCount: registry.zoneCount,
    zones: registry.zones.map(zone => ({
      id: zone.id,
      presetId: zone.presetId,
      buildId: zone.buildId,
      binaryBytes: zone.binaryBytes,
      counts: zone.counts
    }))
  };
  fs.writeFileSync(path.join(ROOT, 'world-generator', `${regionId}-local-zone-registry-build.json`), stableJson(report));
  process.stdout.write(stableJson(report));
}

try {
  build();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
