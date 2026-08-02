import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourcePath = path.join(ROOT, 'mallorca-mobile/region-preview-baleares-001.html');
const outputPath = path.join(ROOT, 'mallorca-mobile/region-runtime-baleares-001.html');
const reportPath = path.join(ROOT, 'world-generator/baleares-runtime-build.json');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function replaceOnce(source, search, replacement, label) {
  const index = source.indexOf(search);
  assert(index >= 0, `Could not find ${label}`);
  assert(source.indexOf(search, index + search.length) < 0, `${label} is not unique`);
  return source.slice(0, index) + replacement + source.slice(index + search.length);
}

function replaceRegex(source, expression, replacement, label) {
  const match = source.match(expression);
  assert(match, `Could not find ${label}`);
  return source.replace(expression, replacement);
}

let html = fs.readFileSync(sourcePath, 'utf8');
html = html.replaceAll('WAFT · Visor regional de Baleares 001', 'WAFT · Runtime regional de Baleares 001');
html = html.replaceAll('VISOR REGIONAL 001', 'RUNTIME REGIONAL 001');
html = html.replaceAll('Preparando el primer visor regional…', 'Preparando el primer runtime regional jugable…');
html = html.replaceAll('No se pudo abrir el visor regional.', 'No se pudo abrir el runtime regional.');
html = html.replaceAll('El visor funciona mejor con el móvil en horizontal.', 'El runtime funciona mejor con el móvil en horizontal.');
html = html.replaceAll('Joystick: desplazarse · Arrastrar pantalla: mirar · ▲▼: altura', 'Joystick: caminar · Arrastrar: mirar · ⤒: saltar · ↺: reaparecer');
html = html.replaceAll('__WAFT_PREVIEW_ERROR__', '__WAFT_RUNTIME_ERROR__');
html = html.replaceAll('__WAFT_PREVIEW_READY__', '__WAFT_RUNTIME_READY__');
html = html.replaceAll('VISOR REGIONAL 001', 'RUNTIME REGIONAL 001');

html = replaceOnce(
  html,
  '<div id="vertical"><button id="up" aria-label="Subir">▲</button><button id="down" aria-label="Bajar">▼</button><button id="boost">VELOCIDAD ×1</button></div>',
  '<div id="vertical"><button id="up" aria-label="Saltar">⤒</button><button id="down" aria-label="Reaparecer">↺</button><button id="boost">CORRER ×1</button></div><div id="crosshair">＋</div>',
  'vertical controls'
);
html = replaceOnce(
  html,
  '#help{position:fixed;',
  '#crosshair{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:7;color:rgba(255,247,220,.78);font-size:23px;font-weight:300;text-shadow:0 1px 4px #000;pointer-events:none}\n#help{position:fixed;',
  'help css anchor'
);

html = replaceRegex(html, /  const state = \{[\s\S]*?\n  \};/, `  const state = {
    terrain: true,
    roads: true,
    buildings: true,
    hotels: true,
    landmarks: true,
    settlements: true,
    boost: false,
    joyX: 0,
    joyY: 0,
    yaw: .4,
    pitch: -.18,
    camera: { x: 0, y: 3, z: 0 },
    velocityY: 0,
    grounded: true,
    jumpQueued: false,
    respawnQueued: false,
    fps: 0,
    activePreset: null,
    activeBuildings: 0,
    loadedCells: 0,
    collisions: 0
  };`, 'runtime state');

html = replaceRegex(html, /  function setupControls\(metadata, terrainMesh, preview\) \{[\s\S]*?\n  \}\n\n  async function boot\(\) \{/, `  function createBuildingStreamer(gl, mesh, records, cellSize = 36, radius = 2) {
    const stride = 8;
    const cells = new Map();
    for (let index = 0; index < records.length; index += stride) {
      const cellX = Math.floor(records[index] / cellSize);
      const cellZ = Math.floor(records[index + 2] / cellSize);
      const key = cellX + ':' + cellZ;
      let list = cells.get(key);
      if (!list) cells.set(key, list = []);
      list.push(index);
    }
    let active = new Float32Array(0);
    let lastCell = '';
    let loadedCells = 0;
    const update = (x, z, force = false) => {
      const centerX = Math.floor(x / cellSize);
      const centerZ = Math.floor(z / cellSize);
      const cellKey = centerX + ':' + centerZ;
      if (!force && cellKey === lastCell) return false;
      lastCell = cellKey;
      const offsets = [];
      loadedCells = 0;
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const list = cells.get((centerX + dx) + ':' + (centerZ + dz));
          if (!list) continue;
          loadedCells++;
          offsets.push(...list);
        }
      }
      active = new Float32Array(offsets.length * stride);
      let cursor = 0;
      for (const offset of offsets) {
        active.set(records.subarray(offset, offset + stride), cursor);
        cursor += stride;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.instanceBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, active, gl.DYNAMIC_DRAW);
      mesh.instanceCount = active.length / stride;
      state.activeBuildings = mesh.instanceCount;
      state.loadedCells = loadedCells;
      return true;
    };
    return {
      update,
      get active() { return active; },
      get loadedCells() { return loadedCells; },
      cellSize,
      radius,
      totalCells: cells.size
    };
  }

  function setupControls(metadata, terrainMesh, preview, streamer) {
    const joystick = document.getElementById('joystick');
    const stick = document.getElementById('stick');
    let joyPointer = null;
    const updateJoy = event => {
      const rect = joystick.getBoundingClientRect();
      let x = event.clientX - (rect.left + rect.width / 2);
      let y = event.clientY - (rect.top + rect.height / 2);
      const radius = rect.width * .31;
      const length = Math.hypot(x, y);
      if (length > radius) { x *= radius / length; y *= radius / length; }
      state.joyX = x / radius;
      state.joyY = y / radius;
      stick.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    };
    joystick.addEventListener('pointerdown', event => { event.preventDefault(); event.stopPropagation(); joyPointer = event.pointerId; joystick.setPointerCapture(event.pointerId); updateJoy(event); });
    joystick.addEventListener('pointermove', event => { if (event.pointerId === joyPointer) updateJoy(event); });
    const releaseJoy = event => { if (event.pointerId !== joyPointer) return; joyPointer = null; state.joyX = state.joyY = 0; stick.style.transform = 'translate(0,0)'; };
    joystick.addEventListener('pointerup', releaseJoy);
    joystick.addEventListener('pointercancel', releaseJoy);

    let lookPointer = null, lastX = 0, lastY = 0;
    canvas.addEventListener('pointerdown', event => { if (lookPointer !== null) return; lookPointer = event.pointerId; lastX = event.clientX; lastY = event.clientY; canvas.setPointerCapture(event.pointerId); });
    canvas.addEventListener('pointermove', event => {
      if (event.pointerId !== lookPointer) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      state.yaw -= dx * .0042;
      state.pitch = Math.max(-1.18, Math.min(.62, state.pitch - dy * .0035));
    });
    const releaseLook = event => { if (event.pointerId === lookPointer) lookPointer = null; };
    canvas.addEventListener('pointerup', releaseLook);
    canvas.addEventListener('pointercancel', releaseLook);

    const queueJump = event => { event?.preventDefault(); state.jumpQueued = true; };
    document.getElementById('up').addEventListener('pointerdown', queueJump);
    document.getElementById('down').addEventListener('pointerdown', event => { event.preventDefault(); state.respawnQueued = true; });
    const boost = document.getElementById('boost');
    boost.addEventListener('click', () => {
      state.boost = !state.boost;
      boost.classList.toggle('active', state.boost);
      boost.textContent = state.boost ? 'CORRER ×2.4' : 'CORRER ×1';
    });

    const keys = new Set();
    addEventListener('keydown', event => {
      keys.add(event.code);
      if (event.code === 'Space') { event.preventDefault(); state.jumpQueued = true; }
      if (event.code === 'KeyR') state.respawnQueued = true;
    });
    addEventListener('keyup', event => keys.delete(event.code));
    state.keyboard = keys;
    for (const [id, key] of [['terrainLayer','terrain'],['roadLayer','roads'],['buildingLayer','buildings'],['hotelLayer','hotels'],['landmarkLayer','landmarks'],['settlementLayer','settlements']]) {
      document.getElementById(id).addEventListener('change', event => state[key] = event.target.checked);
    }

    const presets = document.getElementById('presets');
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
    };
    for (const preset of playable) {
      const button = document.createElement('button');
      button.textContent = preset.name;
      button.dataset.id = preset.id;
      button.addEventListener('click', () => spawn(preset));
      presets.appendChild(button);
    }
    const initial = playable.find(item => item.name.toLowerCase().includes('palma')) || playable[0];
    assert(initial, 'No playable spawn presets were generated');
    spawn(initial);
    return { spawn, playable };
  }

  async function boot() {`, 'streamer and runtime controls');

html = replaceOnce(
  html,
  '    const buildingMesh = createCubeGeometry(gl, preview.buildings);',
  '    const buildingMesh = createCubeGeometry(gl, new Float32Array(8));\n    const streamer = createBuildingStreamer(gl, buildingMesh, preview.buildings);',
  'building mesh creation'
);
html = replaceOnce(
  html,
  '    const jump = setupControls(metadata, terrainMesh, preview);',
  '    const runtimeControls = setupControls(metadata, terrainMesh, preview, streamer);',
  'controls setup call'
);

html = replaceRegex(html, /    const sampleTerrainWorld = \(x,z\) => \{[\s\S]*?\n    \};/, `    const sampleTerrainInfo = (x, z) => {
      const bounds = terrainMesh.bounds;
      const fx = (x - bounds.minX) / (bounds.maxX - bounds.minX) * (terrainMesh.columns - 1);
      const fz = (z - bounds.minZ) / (bounds.maxZ - bounds.minZ) * (terrainMesh.rows - 1);
      if (fx < 0 || fz < 0 || fx > terrainMesh.columns - 1 || fz > terrainMesh.rows - 1) return { land: false, height: 0 };
      const column = Math.max(0, Math.min(terrainMesh.columns - 1, Math.round(fx)));
      const row = Math.max(0, Math.min(terrainMesh.rows - 1, Math.round(fz)));
      const value = terrainMesh.elevations[row * terrainMesh.columns + column];
      return value === terrainMesh.nodata
        ? { land: false, height: 0 }
        : { land: true, height: value * terrainMesh.verticalScale };
    };
    const collidesBuilding = (x, z) => {
      const records = streamer.active;
      const exaggeration = metadata.display.buildingHorizontalExaggeration;
      const radius = .34;
      for (let offset = 0; offset < records.length; offset += 8) {
        const dx = x - records[offset];
        const dz = z - records[offset + 2];
        const angle = records[offset + 6];
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        const localX = dx * c + dz * s;
        const localZ = -dx * s + dz * c;
        const halfX = records[offset + 3] * exaggeration * .5 + radius;
        const halfZ = records[offset + 5] * exaggeration * .5 + radius;
        if (Math.abs(localX) < halfX && Math.abs(localZ) < halfZ) return true;
      }
      return false;
    };
    const movePlayer = (dx, dz) => {
      const distance = Math.hypot(dx, dz);
      if (distance < 1e-6) return;
      const steps = Math.max(1, Math.ceil(distance / .2));
      const stepX = dx / steps;
      const stepZ = dz / steps;
      for (let step = 0; step < steps; step++) {
        const currentGround = sampleTerrainInfo(state.camera.x, state.camera.z).height;
        const nextX = state.camera.x + stepX;
        const xTerrain = sampleTerrainInfo(nextX, state.camera.z);
        if (xTerrain.land && xTerrain.height <= currentGround + 1.05 && !collidesBuilding(nextX, state.camera.z)) state.camera.x = nextX;
        else state.collisions++;
        const nextZ = state.camera.z + stepZ;
        const zTerrain = sampleTerrainInfo(state.camera.x, nextZ);
        if (zTerrain.land && zTerrain.height <= currentGround + 1.05 && !collidesBuilding(state.camera.x, nextZ)) state.camera.z = nextZ;
        else state.collisions++;
      }
    };`, 'terrain and collision runtime');

html = replaceRegex(html, /    const draw = now => \{[\s\S]*?    window\.__WAFT_PREVIEW_READY__=true;/, `    const draw = now => {
      const dt = Math.min(.05, (now - lastTime) / 1000);
      lastTime = now;
      const keys = state.keyboard;
      const strafe = state.joyX + (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
      const forward = -state.joyY + (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      const inputLength = Math.hypot(strafe, forward);
      const normalizedStrafe = inputLength > 1 ? strafe / inputLength : strafe;
      const normalizedForward = inputLength > 1 ? forward / inputLength : forward;
      const speed = 7.2 * (state.boost || keys.has('ShiftLeft') || keys.has('ShiftRight') ? 2.4 : 1);
      const sin = Math.sin(state.yaw);
      const cos = Math.cos(state.yaw);
      movePlayer(
        (sin * normalizedForward + cos * normalizedStrafe) * speed * dt,
        (cos * normalizedForward - sin * normalizedStrafe) * speed * dt
      );
      streamer.update(state.camera.x, state.camera.z);

      const terrainNow = sampleTerrainInfo(state.camera.x, state.camera.z);
      const ground = terrainNow.height + 1.35;
      if (state.respawnQueued) {
        const preset = runtimeControls.playable.find(item => item.id === state.activePreset) || runtimeControls.playable[0];
        runtimeControls.spawn(preset);
      }
      if (state.jumpQueued && state.grounded) {
        state.velocityY = 5.25;
        state.grounded = false;
      }
      state.jumpQueued = false;
      if (!state.grounded) {
        state.velocityY -= 13.5 * dt;
        state.camera.y += state.velocityY * dt;
        if (state.camera.y <= ground) {
          state.camera.y = ground;
          state.velocityY = 0;
          state.grounded = true;
        }
      } else {
        state.camera.y = ground;
      }

      const bounds = terrainMesh.bounds;
      state.camera.x = Math.max(bounds.minX, Math.min(bounds.maxX, state.camera.x));
      state.camera.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, state.camera.z));
      const cp = Math.cos(state.pitch);
      const fx = Math.sin(state.yaw) * cp;
      const fy = Math.sin(state.pitch);
      const fz = Math.cos(state.yaw) * cp;
      const eye = [state.camera.x, state.camera.y, state.camera.z];
      const center = [eye[0] + fx, eye[1] + fy, eye[2] + fz];
      perspective(projection, Math.PI / 3, canvas.width / canvas.height, .12, 1450);
      lookAt(view, eye, center, [0,1,0]);
      multiply(pv, projection, view);
      gl.clearColor(.25,.40,.46,1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      if (state.terrain) { gl.useProgram(terrainProgram); gl.uniformMatrix4fv(gl.getUniformLocation(terrainProgram,'uPV'),false,pv); gl.uniform1f(gl.getUniformLocation(terrainProgram,'uVerticalScale'),terrainMesh.verticalScale); gl.uniform3f(gl.getUniformLocation(terrainProgram,'uCamera'),...eye); gl.bindVertexArray(terrainMesh.vao); gl.drawElements(gl.TRIANGLES,terrainMesh.count,gl.UNSIGNED_INT,0); }
      if (state.roads) { gl.useProgram(roadProgram); gl.uniformMatrix4fv(gl.getUniformLocation(roadProgram,'uPV'),false,pv); gl.uniform1f(gl.getUniformLocation(roadProgram,'uTerrainScale'),terrainMesh.verticalScale); gl.uniform1f(gl.getUniformLocation(roadProgram,'uLift'),metadata.display.roadLift); gl.bindVertexArray(roadMesh.vao); gl.drawArrays(gl.LINES,0,roadMesh.count); }
      if (state.buildings) { gl.useProgram(buildingProgram); gl.uniformMatrix4fv(gl.getUniformLocation(buildingProgram,'uPV'),false,pv); gl.uniform1f(gl.getUniformLocation(buildingProgram,'uTerrainScale'),terrainMesh.verticalScale); gl.uniform1f(gl.getUniformLocation(buildingProgram,'uBuildingScale'),metadata.display.buildingVerticalScale); gl.uniform1f(gl.getUniformLocation(buildingProgram,'uHorizontalExaggeration'),metadata.display.buildingHorizontalExaggeration); gl.uniform3f(gl.getUniformLocation(buildingProgram,'uCamera'),...eye); gl.uniform1i(gl.getUniformLocation(buildingProgram,'uShowHotels'),state.hotels?1:0); gl.bindVertexArray(buildingMesh.vao); gl.drawElementsInstanced(gl.TRIANGLES,buildingMesh.indexCount,gl.UNSIGNED_SHORT,0,buildingMesh.instanceCount); }
      if (state.landmarks) { gl.useProgram(landmarkProgram); gl.uniformMatrix4fv(gl.getUniformLocation(landmarkProgram,'uPV'),false,pv); gl.uniform1f(gl.getUniformLocation(landmarkProgram,'uTerrainScale'),terrainMesh.verticalScale); gl.uniform1f(gl.getUniformLocation(landmarkProgram,'uLift'),metadata.display.landmarkLift); gl.bindVertexArray(landmarkMesh.vao); gl.drawArrays(gl.POINTS,0,landmarkMesh.count); }
      if (state.settlements) { gl.useProgram(settlementProgram); gl.uniformMatrix4fv(gl.getUniformLocation(settlementProgram,'uPV'),false,pv); gl.uniform1f(gl.getUniformLocation(settlementProgram,'uTerrainScale'),terrainMesh.verticalScale); gl.bindVertexArray(settlementMesh.vao); gl.drawArrays(gl.POINTS,0,settlementMesh.count); }
      gl.bindVertexArray(null);

      frames++;
      if (now - fpsTime >= 1000) {
        state.fps = Math.round(frames * 1000 / (now - fpsTime));
        frames = 0;
        fpsTime = now;
        hudStats.textContent = state.activeBuildings.toLocaleString('es-ES') + ' edificios activos / ' + metadata.counts.buildings.toLocaleString('es-ES') + ' · ' + state.loadedCells + ' celdas · ' + metadata.counts.selectedRoads.toLocaleString('es-ES') + ' vías · ' + state.fps + ' FPS';
        window.__WAFT_RUNTIME_STATS__ = {
          totalBuildings: metadata.counts.buildings,
          activeBuildings: state.activeBuildings,
          loadedCells: state.loadedCells,
          collisions: state.collisions,
          grounded: state.grounded,
          webgl2: true,
          buildId: metadata.buildId,
          binarySha256: metadata.binary.sha256,
          position: { x: state.camera.x, y: state.camera.y, z: state.camera.z }
        };
      }
      nearestClock += dt;
      if (nearestClock > .45) { nearestClock = 0; nearestUpdate(); }
      requestAnimationFrame(draw);
    };

    window.WAFTRegionRuntime = {
      spawn(id) {
        const preset = runtimeControls.playable.find(item => item.id === id || item.name.toLowerCase() === String(id).toLowerCase());
        if (!preset) throw new Error('Punto de aparición desconocido: ' + id);
        runtimeControls.spawn(preset);
      },
      setInput(x, y) { state.joyX = Math.max(-1, Math.min(1, Number(x) || 0)); state.joyY = Math.max(-1, Math.min(1, Number(y) || 0)); },
      jump() { state.jumpQueued = true; },
      respawn() { state.respawnQueued = true; },
      setLayer(name, value) { if (!(name in state)) throw new Error('Capa desconocida: ' + name); state[name] = Boolean(value); },
      probeCollision() {
        const records = streamer.active;
        return records.length >= 8 ? collidesBuilding(records[0], records[2]) : false;
      },
      getState() { return { position: { ...state.camera }, grounded: state.grounded, activeBuildings: state.activeBuildings, loadedCells: state.loadedCells, collisions: state.collisions, preset: state.activePreset }; },
      metadata
    };
    window.__WAFT_RUNTIME_STATS__ = { totalBuildings: metadata.counts.buildings, activeBuildings: state.activeBuildings, loadedCells: state.loadedCells, collisions: 0, grounded: true, webgl2: true, buildId: metadata.buildId, binarySha256: metadata.binary.sha256, position: { ...state.camera } };
    window.__WAFT_RUNTIME_READY__=true;`, 'runtime draw and API');

html = html.replaceAll('window.WAFTPreview', 'window.WAFTRegionRuntime');
html = html.replaceAll('__WAFT_PREVIEW_STATS__', '__WAFT_RUNTIME_STATS__');
assert(html.includes('window.__WAFT_RUNTIME_READY__=true'), 'Runtime ready marker missing');
assert(html.includes('createBuildingStreamer'), 'Streaming implementation missing');
assert(html.includes('probeCollision'), 'Collision probe missing');
assert(!html.includes('window.__WAFT_PREVIEW_READY__'), 'Preview ready marker leaked into runtime');

fs.writeFileSync(outputPath, html);
const report = {
  formatVersion: 1,
  valid: true,
  source: path.relative(ROOT, sourcePath).replaceAll(path.sep, '/'),
  output: path.relative(ROOT, outputPath).replaceAll(path.sep, '/'),
  sourceSha256: sha256(fs.readFileSync(sourcePath)),
  outputSha256: sha256(Buffer.from(html)),
  outputBytes: Buffer.byteLength(html),
  features: [
    'first-person-ground-runtime',
    'gravity-and-jump',
    'land-and-coast-constraint',
    'oriented-building-collision',
    'building-cell-streaming',
    'regional-spawn-presets',
    'mobile-touch-controls'
  ]
};
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
