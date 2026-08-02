import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RUNNER_VERSION = 3;
const directory = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(directory, 'build-baleares-runtime.mjs');
const patchedPath = path.join(directory, `.build-baleares-runtime-patched-v${RUNNER_VERSION}.mjs`);

let patched = fs.readFileSync(sourcePath, 'utf8');
const patches = [
  {
    oldText: 'window\\.__WAFT_PREVIEW_READY__=true',
    newText: 'window\\.__WAFT_RUNTIME_READY__=true',
    label: 'obsolete runtime-ready marker'
  },
  {
    oldText: "    assert(initial, 'No playable spawn presets were generated');",
    newText: "    if (!initial) throw new Error('No playable spawn presets were generated');",
    label: 'build-only browser assertion'
  },
  {
    oldText: String.raw`    const presets = document.getElementById('presets');
    const playable = metadata.presets.filter(item => item.id !== 'overview');
    const spawn = preset => {
      state.activePreset = preset.id;
      for (const button of presets.children) button.classList.toggle('active', button.dataset.id === preset.id);
      state.camera.x = preset.x;
      state.camera.z = preset.z;
      state.camera.y = preset.terrainMeters * terrainMesh.verticalScale + 1.35;
      state.velocityY = 0;
      state.grounded = true;
      state.jumpQueued = false;
      state.respawnQueued = false;
      state.yaw = .4;
      state.pitch = -.18;
      streamer.update(state.camera.x, state.camera.z, true);
    };`,
    newText: String.raw`    const presets = document.getElementById('presets');
    const playable = metadata.presets.filter(item => item.id !== 'overview');
    const terrainAt = (x, z) => {
      const bounds = terrainMesh.bounds;
      const fx = (x - bounds.minX) / (bounds.maxX - bounds.minX) * (terrainMesh.columns - 1);
      const fz = (z - bounds.minZ) / (bounds.maxZ - bounds.minZ) * (terrainMesh.rows - 1);
      if (fx < 0 || fz < 0 || fx > terrainMesh.columns - 1 || fz > terrainMesh.rows - 1) return null;
      const column = Math.max(0, Math.min(terrainMesh.columns - 1, Math.round(fx)));
      const row = Math.max(0, Math.min(terrainMesh.rows - 1, Math.round(fz)));
      const value = terrainMesh.elevations[row * terrainMesh.columns + column];
      return value === terrainMesh.nodata ? null : value * terrainMesh.verticalScale;
    };
    const spawnBlocked = (x, z) => {
      const records = streamer.active;
      const exaggeration = metadata.display.buildingHorizontalExaggeration;
      const radius = .55;
      for (let offset = 0; offset < records.length; offset += 8) {
        const dx = x - records[offset];
        const dz = z - records[offset + 2];
        const angle = records[offset + 6];
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        const localX = dx * c + dz * s;
        const localZ = -dx * s + dz * c;
        if (Math.abs(localX) < records[offset + 3] * exaggeration * .5 + radius && Math.abs(localZ) < records[offset + 5] * exaggeration * .5 + radius) return true;
      }
      return false;
    };
    const findSafeSpawn = preset => {
      const radii = [0, 1.5, 3, 5, 8, 12, 18];
      for (const radius of radii) {
        const samples = radius === 0 ? 1 : 20;
        for (let sample = 0; sample < samples; sample++) {
          const angle = samples === 1 ? 0 : sample / samples * Math.PI * 2;
          const x = preset.x + Math.cos(angle) * radius;
          const z = preset.z + Math.sin(angle) * radius;
          streamer.update(x, z, true);
          const terrain = terrainAt(x, z);
          if (terrain !== null && !spawnBlocked(x, z)) return { x, z, terrain };
        }
      }
      return { x: preset.x, z: preset.z, terrain: preset.terrainMeters * terrainMesh.verticalScale };
    };
    const spawn = preset => {
      state.activePreset = preset.id;
      for (const button of presets.children) button.classList.toggle('active', button.dataset.id === preset.id);
      const safe = findSafeSpawn(preset);
      state.camera.x = safe.x;
      state.camera.z = safe.z;
      state.camera.y = safe.terrain + 1.35;
      state.velocityY = 0;
      state.grounded = true;
      state.jumpQueued = false;
      state.respawnQueued = false;
      state.yaw = .4;
      state.pitch = -.18;
      streamer.update(state.camera.x, state.camera.z, true);
    };`,
    label: 'unsafe exact spawn placement'
  }
];

for (const patch of patches) {
  const occurrences = patched.split(patch.oldText).length - 1;
  if (occurrences !== 1) {
    throw new Error(`Expected one ${patch.label}, found ${occurrences}`);
  }
  patched = patched.replace(patch.oldText, patch.newText);
}

fs.writeFileSync(patchedPath, patched);
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
