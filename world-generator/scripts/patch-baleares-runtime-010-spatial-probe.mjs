import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const runtimePath = path.join(ROOT, 'mallorca-mobile/region-runtime-baleares-010.html');
const reportPath = path.join(ROOT, 'world-generator/baleares-runtime-010-build.json');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

const oldBlock = `    const collidesFullRegionalBuilding = (x, z, radius = state.playerCollisionRadius) => {
      const records = preview.buildings;
      const exaggeration = metadata.display.buildingHorizontalExaggeration;
      for (let offset = 0; offset < records.length; offset += 8) {
        const dx = x - records[offset];
        const dz = z - records[offset + 2];
        const angle = records[offset + 6];
        const c = Math.cos(angle), s = Math.sin(angle);
        const localX = dx * c + dz * s;
        const localZ = -dx * s + dz * c;
        const halfX = records[offset + 3] * exaggeration * .5 + radius;
        const halfZ = records[offset + 5] * exaggeration * .5 + radius;
        if (Math.abs(localX) < halfX && Math.abs(localZ) < halfZ) return true;
      }
      return false;
    };`;

const newBlock = `    const regionalProbeCellSize = 24;
    const regionalProbeBuildingCells = new Map();
    for (let offset = 0; offset < preview.buildings.length; offset += 8) {
      const cellX = Math.floor(preview.buildings[offset] / regionalProbeCellSize);
      const cellZ = Math.floor(preview.buildings[offset + 2] / regionalProbeCellSize);
      const key = cellX + ':' + cellZ;
      let offsets = regionalProbeBuildingCells.get(key);
      if (!offsets) regionalProbeBuildingCells.set(key, offsets = []);
      offsets.push(offset);
    }
    const collidesFullRegionalBuilding = (x, z, radius = state.playerCollisionRadius) => {
      const records = preview.buildings;
      const exaggeration = metadata.display.buildingHorizontalExaggeration;
      const centerCellX = Math.floor(x / regionalProbeCellSize);
      const centerCellZ = Math.floor(z / regionalProbeCellSize);
      for (let cellZ = centerCellZ - 1; cellZ <= centerCellZ + 1; cellZ++) {
        for (let cellX = centerCellX - 1; cellX <= centerCellX + 1; cellX++) {
          const offsets = regionalProbeBuildingCells.get(cellX + ':' + cellZ);
          if (!offsets) continue;
          for (const offset of offsets) {
            const dx = x - records[offset];
            const dz = z - records[offset + 2];
            const angle = records[offset + 6];
            const c = Math.cos(angle), s = Math.sin(angle);
            const localX = dx * c + dz * s;
            const localZ = -dx * s + dz * c;
            const halfX = records[offset + 3] * exaggeration * .5 + radius;
            const halfZ = records[offset + 5] * exaggeration * .5 + radius;
            if (Math.abs(localX) < halfX && Math.abs(localZ) < halfZ) return true;
          }
        }
      }
      return false;
    };`;

const oldProbeErrors = `      assert(mountain, 'No mountain locomotion probe could be generated');
      assert(water, 'No open-water locomotion probe could be generated');`;
const newProbeErrors = `      if (!mountain) throw new Error('No mountain locomotion probe could be generated');
      if (!water) throw new Error('No open-water locomotion probe could be generated');`;

let html = fs.readFileSync(runtimePath, 'utf8');
const oldCount = html.split(oldBlock).length - 1;
const newCount = html.split('const regionalProbeBuildingCells = new Map();').length - 1;
if (oldCount === 1) html = html.replace(oldBlock, newBlock);
else assert(newCount === 1, `Expected one unpatched or patched spatial probe, found old=${oldCount} new=${newCount}`);
assert(html.includes("regionalProbeBuildingCells.get(cellX + ':' + cellZ)"), 'Spatial building lookup was not installed');
const oldErrorCount = html.split(oldProbeErrors).length - 1;
if (oldErrorCount === 1) html = html.replace(oldProbeErrors, newProbeErrors);
else assert(html.includes(newProbeErrors), `Expected browser-safe probe errors, found old=${oldErrorCount}`);
assert(!html.includes("assert(mountain, 'No mountain locomotion probe could be generated')"), 'Node-only mountain assertion remains in the browser runtime');
const oldMountainDuration = '                suggestedMilliseconds: 260';
const newMountainDuration = '                suggestedMilliseconds: 850';
const durationCount = html.split(oldMountainDuration).length - 1;
if (durationCount === 1) html = html.replace(oldMountainDuration, newMountainDuration);
else assert(html.includes(newMountainDuration), `Expected one mountain probe duration, found old=${durationCount}`);
fs.writeFileSync(runtimePath, html);

const buffer = fs.readFileSync(runtimePath);
const report = fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath, 'utf8')) : {};
report.buildRevision = Math.max(4, Number(report.buildRevision) || 0);
report.outputSha256 = sha256(buffer);
report.outputBytes = buffer.length;
report.behavior = {
  ...(report.behavior || {}),
  spatiallyIndexedLocomotionProbe: true,
  regionalProbeCellSize: 24,
  browserSafeLocomotionProbeErrors: true,
  mountainProbeMilliseconds: 850
};
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({
  valid: true,
  runtime: path.relative(ROOT, runtimePath).replaceAll(path.sep, '/'),
  outputBytes: buffer.length,
  outputSha256: report.outputSha256,
  regionalProbeCellSize: 24,
  browserSafeLocomotionProbeErrors: true,
  mountainProbeMilliseconds: 850
}, null, 2)}\n`);
