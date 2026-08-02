import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RUNNER_VERSION = 3;
const directory = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(directory, 'build-baleares-runtime-002.mjs');
const patchedPath = path.join(directory, `.build-baleares-runtime-002-patched-v${RUNNER_VERSION}.mjs`);

let source = fs.readFileSync(sourcePath, 'utf8');
const startToken = 'const characterProgram = String.raw`';
const patchedStartToken = 'const characterProgram = `';
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
source = source.slice(0, start) + patchedStartToken + escapedBlock + source.slice(end);

const oldCameraResolver = `    const resolveThirdPersonCamera = (target, desired) => {
      let last = [target[0], target[1] + .35, target[2]];
      let blocked = false;
      const steps = 20;
      for (let step = 1; step <= steps; step++) {
        const t = step / steps;
        const point = [
          target[0] + (desired[0] - target[0]) * t,
          target[1] + (desired[1] - target[1]) * t,
          target[2] + (desired[2] - target[2]) * t
        ];
        const terrain = sampleTerrainInfo(point[0], point[2]);
        if (!terrain.land || terrain.height + .28 > point[1] || collidesBuilding(point[0], point[2])) {
          blocked = true;
          break;
        }
        last = point;
      }
      state.cameraBlocked = blocked;
      return last;
    };`;
const newCameraResolver = `    const resolveThirdPersonCamera = (target, desired) => {
      const deltaX = desired[0] - target[0];
      const deltaY = desired[1] - target[1];
      const deltaZ = desired[2] - target[2];
      const desiredDistance = Math.hypot(deltaX, deltaY, deltaZ) || 1;
      const minimumDistance = Math.min(1.55, desiredDistance * .32);
      const minimumT = minimumDistance / desiredDistance;
      let last = [
        target[0] + deltaX * minimumT,
        target[1] + deltaY * minimumT,
        target[2] + deltaZ * minimumT
      ];
      let blocked = false;
      const steps = 24;
      for (let step = 1; step <= steps; step++) {
        const t = step / steps;
        const point = [
          target[0] + deltaX * t,
          target[1] + deltaY * t,
          target[2] + deltaZ * t
        ];
        if (t <= minimumT) {
          last = point;
          continue;
        }
        const terrain = sampleTerrainInfo(point[0], point[2]);
        if (!terrain.land || terrain.height + .28 > point[1] || collidesBuilding(point[0], point[2])) {
          blocked = true;
          break;
        }
        last = point;
      }
      state.cameraBlocked = blocked;
      return last;
    };`;
const cameraOccurrences = source.split(oldCameraResolver).length - 1;
if (cameraOccurrences !== 1) throw new Error(`Expected one third-person camera resolver, found ${cameraOccurrences}`);
source = source.replace(oldCameraResolver, newCameraResolver);

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
