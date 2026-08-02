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
  return `${JSON.stringify(value, null, 2)}\n`;
}

function near(actual, expected, tolerance, label) {
  assert(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, got ${actual}`);
}

function verify() {
  const regionId = process.argv[2] ?? 'baleares';
  const configPath = path.join(ROOT, 'world-generator', 'configs', `${regionId}-local-zones.json`);
  assert(fs.existsSync(configPath), `Missing local-zone config ${configPath}`);
  const config = readJson(configPath);
  const registryPath = path.join(ROOT, 'regions', regionId, 'local', config.registryFile ?? 'zones-v1.json');
  assert(fs.existsSync(registryPath), `Missing local-zone registry ${registryPath}`);
  const registry = readJson(registryPath);

  assert(registry.formatVersion === 1, 'Unsupported local-zone registry version');
  assert(registry.registryType === 'waft-local-zone-registry', 'Invalid local-zone registry type');
  assert(registry.regionId === regionId, 'Local-zone registry region mismatch');
  assert(registry.deterministic === true, 'Local-zone registry is not deterministic');
  assert(registry.zoneCount === config.zones.length, 'Local-zone registry count mismatch');
  assert(registry.zones.length === registry.zoneCount, 'Local-zone registry array length mismatch');
  assert(registry.zoneCount >= 2, 'Local-zone registry does not prove multi-zone support');
  assert(registry.source.configFile === path.relative(ROOT, configPath).replaceAll(path.sep, '/'), 'Registry config provenance mismatch');
  assert(/^[a-f0-9]{64}$/.test(registry.source.fingerprint), 'Registry fingerprint is invalid');
  assert(registry.buildId === `${regionId}-local-zones-${registry.source.fingerprint.slice(0, 12)}`, 'Registry build id mismatch');

  const ids = new Set();
  const presetIds = new Set();
  let totalBytes = 0;
  const verifiedZones = [];
  for (let index = 0; index < config.zones.length; index++) {
    const contract = config.zones[index];
    const entry = registry.zones[index];
    assert(entry.id === contract.id, `Registry order/id mismatch at ${index}`);
    assert(entry.presetId === contract.presetId, `Registry preset mismatch for ${entry.id}`);
    assert(entry.name === contract.name, `Registry name mismatch for ${entry.id}`);
    assert(!ids.has(entry.id), `Duplicate registry zone ${entry.id}`);
    assert(!presetIds.has(entry.presetId), `Duplicate registry preset ${entry.presetId}`);
    ids.add(entry.id);
    presetIds.add(entry.presetId);

    const metadataPath = path.join(ROOT, 'regions', regionId, 'local', entry.metadataFile);
    const binaryPath = path.join(ROOT, 'regions', regionId, 'local', entry.binaryFile);
    assert(fs.existsSync(metadataPath), `Missing registry metadata ${entry.metadataFile}`);
    assert(fs.existsSync(binaryPath), `Missing registry binary ${entry.binaryFile}`);
    const metadataBuffer = fs.readFileSync(metadataPath);
    const binary = fs.readFileSync(binaryPath);
    const metadata = JSON.parse(metadataBuffer.toString('utf8'));
    assert(entry.metadataSha256 === sha256(metadataBuffer), `Metadata SHA-256 mismatch for ${entry.id}`);
    assert(entry.binarySha256 === sha256(binary), `Binary SHA-256 mismatch for ${entry.id}`);
    assert(entry.binarySha256 === metadata.binary.sha256, `Metadata binary SHA mismatch for ${entry.id}`);
    assert(entry.binaryBytes === binary.length && entry.binaryBytes === metadata.binary.bytes, `Binary byte count mismatch for ${entry.id}`);
    assert(entry.buildId === metadata.buildId, `Build id mismatch for ${entry.id}`);
    assert(metadata.zoneId === entry.id && metadata.presetId === entry.presetId, `Package identity mismatch for ${entry.id}`);
    near(entry.center.x, metadata.center.x, 1e-9, `${entry.id} center x`);
    near(entry.center.z, metadata.center.z, 1e-9, `${entry.id} center z`);
    near(entry.regionalRadius, metadata.regionalRadius, 1e-9, `${entry.id} radius`);
    near(entry.worldScale, metadata.worldScale, 1e-9, `${entry.id} world scale`);
    near(entry.footprintScale, metadata.footprintScale, 1e-9, `${entry.id} footprint scale`);
    assert(entry.terrain.columns === metadata.terrain.columns && entry.terrain.rows === metadata.terrain.rows, `Terrain mismatch for ${entry.id}`);
    assert(entry.terrain.landCells === metadata.terrain.landCells, `Land-cell mismatch for ${entry.id}`);
    assert(JSON.stringify(entry.counts) === JSON.stringify(metadata.counts), `Feature-count mismatch for ${entry.id}`);
    totalBytes += entry.binaryBytes;
    verifiedZones.push({
      id: entry.id,
      presetId: entry.presetId,
      buildId: entry.buildId,
      binaryBytes: entry.binaryBytes,
      counts: entry.counts
    });
  }

  assert(ids.has('llevant'), 'Llevant is missing from the registry');
  assert(ids.has('palma'), 'Palma is missing from the registry');
  assert(totalBytes < 8 * 1024 * 1024, `Combined local packages are too large: ${totalBytes}`);

  const report = {
    formatVersion: 1,
    valid: true,
    regionId,
    buildId: registry.buildId,
    registryFile: path.relative(ROOT, registryPath).replaceAll(path.sep, '/'),
    zoneCount: registry.zoneCount,
    totalBinaryBytes: totalBytes,
    zones: verifiedZones
  };
  const reportPath = path.join(ROOT, 'world-generator', `${regionId}-local-zone-registry-validation.json`);
  fs.writeFileSync(reportPath, stableJson(report));
  process.stdout.write(stableJson(report));
}

try {
  verify();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
