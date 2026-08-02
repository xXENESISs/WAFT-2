import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const BUILD_REVISION = 1;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourcePath = path.join(ROOT, 'mallorca-mobile/region-runtime-baleares-010.html');
const outputPath = path.join(ROOT, 'mallorca-mobile/region-runtime-baleares-011.html');
const reportPath = path.join(ROOT, 'world-generator/baleares-runtime-011-build.json');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function replaceOnce(source, search, replacement, label) {
  const first = source.indexOf(search);
  assert(first >= 0, `Could not find ${label}`);
  assert(source.indexOf(search, first + search.length) < 0, `${label} is not unique`);
  return source.slice(0, first) + replacement + source.slice(first + search.length);
}

function insertBefore(source, anchor, insertion, label) {
  const first = source.indexOf(anchor);
  assert(first >= 0, `Could not find ${label}`);
  assert(source.indexOf(anchor, first + anchor.length) < 0, `${label} is not unique`);
  return source.slice(0, first) + insertion + source.slice(first);
}

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

let html = fs.readFileSync(sourcePath, 'utf8');
html = html.replaceAll('Runtime regional de Baleares 010', 'Runtime regional de Baleares 011');
html = html.replaceAll('RUNTIME REGIONAL 010', 'RUNTIME REGIONAL 011');
html = html.replaceAll('__WAFT_RUNTIME_010_', '__WAFT_RUNTIME_011_');
html = html.replace("      version: '010',", "      version: '011',");
html = html.replace('Preparando locomoción terrestre, montaña y natación…', 'Recuperando rutas, conexiones y progreso regional…');
html = html.replace('Joystick: correr/nadar · Arrastrar: orbitar · ⤒: salto alto · ZONA LOCAL: acércate físicamente a Palma o Llevant para habilitar la entrada', 'Joystick: viajar · Arrastrar: orbitar · ⤒: salto · Las posiciones, rutas y conexiones se guardan en este dispositivo');

html = replaceOnce(
  html,
  `#hudStats,#nearest{font-size:11px;line-height:1.35;color:#d9e2df;margin-top:3px}`,
  `#hudStats,#nearest{font-size:11px;line-height:1.35;color:#d9e2df;margin-top:3px}
#travel{position:fixed;left:max(10px,env(safe-area-inset-left));top:94px;z-index:11;background:rgba(7,20,28,.86);border:1px solid rgba(126,207,181,.38);border-radius:12px;padding:8px 9px;min-width:205px;max-width:min(64vw,360px);backdrop-filter:blur(8px);box-shadow:0 8px 24px rgba(0,0,0,.22)}
#travelTitle{font-size:10px;color:#9fe3cc;font-weight:950;letter-spacing:.08em}
#travelStats{font-size:10px;line-height:1.35;color:#e2eee9;margin-top:3px}
#travelActions{display:flex;gap:5px;margin-top:6px}
#travelActions button{border:1px solid rgba(126,207,181,.45);background:rgba(29,66,61,.88);color:#effff9;border-radius:8px;font-weight:850;padding:5px 8px;font-size:9px}
#travelToast{min-height:12px;margin-top:3px;font-size:9px;color:#f0cf82;font-weight:750}`,
  'travel HUD styles'
);
html = html.replace('@media (max-width:700px){#help{display:none}', '@media (max-width:700px){#help{display:none}#travel{top:86px;min-width:180px;max-width:58vw}');

html = replaceOnce(
  html,
  `<div id="hud"><div id="hudTitle">RUNTIME REGIONAL 011</div><div id="hudStats">Cargando datos…</div><div id="nearest"></div></div>`,
  `<div id="hud"><div id="hudTitle">RUNTIME REGIONAL 011</div><div id="hudStats">Cargando datos…</div><div id="nearest"></div></div>
<div id="travel"><div id="travelTitle">VIAJE REGIONAL</div><div id="travelStats">Recuperando progreso…</div><div id="travelActions"><button id="saveTravel">GUARDAR</button><button id="resetTravel">REINICIAR</button></div><div id="travelToast"></div></div>`,
  'travel HUD markup'
);

html = replaceOnce(
  html,
  `    swimStroke: 0`,
  `    swimStroke: 0,
    travelSchemaVersion: 1,
    travelSaveKey: 'waft.baleares.travel.v1',
    travelLoaded: false,
    travelRestored: false,
    travelSaveCount: 0,
    travelResetCount: 0,
    travelLastSavedAt: 0,
    travelLastSaveReason: null,
    travelDirty: false,
    travelDistance: 0,
    travelLandDistance: 0,
    travelWaterDistance: 0,
    travelTrailPoints: 0,
    travelDiscoveredNodes: 0,
    travelDiscoveredRoutes: 0,
    travelLastNodeId: null,
    travelNearestNodeId: null,
    travelNearestNodeDistance: null,
    travelDiscoveryArmed: true,
    travelMovementSinceTeleport: 0,
    travelAutoSaveClock: 0,
    travelSaveErrors: 0`,
  'travel state'
);

html = replaceOnce(
  html,
  `    const spawn = preset => {
      state.activePreset = preset.id;`,
  `    const spawn = preset => {
      if (window.__waftTravelTeleport) window.__waftTravelTeleport('preset-' + preset.id);
      state.activePreset = preset.id;`,
  'preset teleport hook'
);
html = replaceOnce(
  html,
  `      updateScaleButton();
      return true;
    };
    const enterLocal = async`,
  `      updateScaleButton();
      if (window.__waftTravelSave) window.__waftTravelSave('exit-local');
      return true;
    };
    const enterLocal = async`,
  'exit local travel save'
);
html = replaceOnce(
  html,
  `      state.cameraDistance = 5.8;
      updateScaleButton();
      return true;`,
  `      state.cameraDistance = 5.8;
      updateScaleButton();
      if (window.__waftTravelSave) window.__waftTravelSave('enter-local');
      return true;`,
  'enter local travel save'
);

const travelSystem = `    const travelStatsElement = document.getElementById('travelStats');
    const travelToastElement = document.getElementById('travelToast');
    const saveTravelButton = document.getElementById('saveTravel');
    const resetTravelButton = document.getElementById('resetTravel');
    const travelNodeIds = ['palma','alcúdia','llevant','menorca','eivissa'];
    const travelPresetById = new Map(metadata.presets.map(preset => [preset.id, preset]));
    const travelNodes = travelNodeIds.map(id => {
      const preset = travelPresetById.get(id);
      if (!preset) throw new Error('Falta el nodo regional ' + id);
      return {
        id,
        name: preset.name,
        x: preset.x,
        z: preset.z,
        discoveryRadius: id === 'palma' || id === 'llevant' ? 12 : 14,
        arrivalRadius: id === 'palma' || id === 'llevant' ? 8 : 9
      };
    });
    const travelNodeById = new Map(travelNodes.map(node => [node.id, node]));
    const travelRoutes = [
      { id: 'palma-alcudia', from: 'palma', to: 'alcúdia', mode: 'land', name: 'Palma · Alcúdia' },
      { id: 'alcudia-llevant', from: 'alcúdia', to: 'llevant', mode: 'land', name: 'Alcúdia · Llevant' },
      { id: 'palma-llevant', from: 'palma', to: 'llevant', mode: 'land', name: 'Palma · Llevant' },
      { id: 'palma-eivissa', from: 'palma', to: 'eivissa', mode: 'water', name: 'Palma · Eivissa' },
      { id: 'alcudia-menorca', from: 'alcúdia', to: 'menorca', mode: 'water', name: 'Alcúdia · Menorca' }
    ];
    const travelRouteById = new Map(travelRoutes.map(route => [route.id, route]));
    const discoveredTravelNodes = new Set();
    const discoveredTravelRoutes = new Set();
    let travelTrail = [];
    let travelLastTrailPoint = null;
    let travelResetConfirmUntil = 0;
    const travelTrailVao = gl.createVertexArray();
    const travelTrailBuffer = gl.createBuffer();
    gl.bindVertexArray(travelTrailVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, travelTrailBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, 0, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 16, 12);
    gl.bindVertexArray(null);
    const travelRouteVao = gl.createVertexArray();
    const travelRouteBuffer = gl.createBuffer();
    gl.bindVertexArray(travelRouteVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, travelRouteBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, 0, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 16, 12);
    gl.bindVertexArray(null);
    let travelTrailVertexCount = 0;
    let travelRouteVertexCount = 0;

    const nearestTravelNodeAt = (x, z) => {
      let nearest = null;
      for (const node of travelNodes) {
        const distance = Math.hypot(x - node.x, z - node.z);
        if (!nearest || distance < nearest.distance) nearest = { node, distance };
      }
      return nearest;
    };
    const routeHeightRaw = node => {
      const surface = sampleTerrainInfo(node.x, node.z);
      return surface.land ? surface.height / terrainMesh.verticalScale : surface.waterHeight / terrainMesh.verticalScale;
    };
    const rebuildTravelRouteMesh = () => {
      const values = [];
      for (const route of travelRoutes) {
        if (!discoveredTravelRoutes.has(route.id)) continue;
        const from = travelNodeById.get(route.from);
        const to = travelNodeById.get(route.to);
        const roadClass = route.mode === 'water' ? 1 : 3;
        values.push(from.x, routeHeightRaw(from), from.z, roadClass, to.x, routeHeightRaw(to), to.z, roadClass);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, travelRouteBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(values), gl.DYNAMIC_DRAW);
      travelRouteVertexCount = values.length / 4;
    };
    const rebuildTravelTrailMesh = () => {
      const values = [];
      for (const point of travelTrail) {
        const surface = sampleTerrainInfo(point.x, point.z);
        const raw = surface.land ? surface.height / terrainMesh.verticalScale : surface.waterHeight / terrainMesh.verticalScale;
        values.push(point.x, raw, point.z, point.mode === 'water' ? 1 : 2);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, travelTrailBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(values), gl.DYNAMIC_DRAW);
      travelTrailVertexCount = values.length / 4;
      state.travelTrailPoints = travelTrail.length;
    };
    const travelStateSnapshot = () => ({
      schemaVersion: state.travelSchemaVersion,
      regionId: 'baleares',
      loaded: state.travelLoaded,
      restored: state.travelRestored,
      saveCount: state.travelSaveCount,
      resetCount: state.travelResetCount,
      lastSavedAt: state.travelLastSavedAt,
      lastSaveReason: state.travelLastSaveReason,
      dirty: state.travelDirty,
      distance: state.travelDistance,
      landDistance: state.travelLandDistance,
      waterDistance: state.travelWaterDistance,
      trailPoints: travelTrail.length,
      discoveredNodes: [...discoveredTravelNodes],
      discoveredRoutes: [...discoveredTravelRoutes],
      lastNodeId: state.travelLastNodeId,
      nearestNodeId: state.travelNearestNodeId,
      nearestNodeDistance: state.travelNearestNodeDistance,
      discoveryArmed: state.travelDiscoveryArmed,
      movementSinceTeleport: state.travelMovementSinceTeleport,
      saveErrors: state.travelSaveErrors,
      position: { x: state.camera.x, y: state.camera.y, z: state.camera.z },
      yaw: state.yaw,
      pitch: state.pitch,
      preset: state.activePreset
    });
    const updateTravelPanel = () => {
      state.travelDiscoveredNodes = discoveredTravelNodes.size;
      state.travelDiscoveredRoutes = discoveredTravelRoutes.size;
      state.travelTrailPoints = travelTrail.length;
      const nearest = state.travelNearestNodeId ? travelNodeById.get(state.travelNearestNodeId) : null;
      const nearestLabel = nearest && Number.isFinite(state.travelNearestNodeDistance)
        ? ' · ' + nearest.name + ' ' + state.travelNearestNodeDistance.toFixed(1) + 'u'
        : '';
      const saveLabel = state.travelDirty ? ' · SIN GUARDAR' : state.travelRestored ? ' · RECUPERADO' : state.travelLastSavedAt ? ' · GUARDADO' : '';
      travelStatsElement.textContent = 'Zonas ' + discoveredTravelNodes.size + '/' + travelNodes.length + ' · conexiones ' + discoveredTravelRoutes.size + '/' + travelRoutes.length + ' · ' + state.travelDistance.toFixed(1) + 'u' + nearestLabel + saveLabel;
    };
    const showTravelToast = text => {
      travelToastElement.textContent = text;
      state.travelToast = text;
      clearTimeout(showTravelToast.timer);
      showTravelToast.timer = setTimeout(() => {
        if (travelToastElement.textContent === text) travelToastElement.textContent = '';
        if (state.travelToast === text) state.travelToast = '';
      }, 2600);
    };
    const updateDiscoveredTravelRoutes = () => {
      let changed = false;
      for (const route of travelRoutes) {
        if (discoveredTravelNodes.has(route.from) && discoveredTravelNodes.has(route.to) && !discoveredTravelRoutes.has(route.id)) {
          discoveredTravelRoutes.add(route.id);
          changed = true;
          showTravelToast('Conexión descubierta: ' + route.name);
        }
      }
      if (changed) {
        state.travelDirty = true;
        rebuildTravelRouteMesh();
      }
      return changed;
    };
    const discoverTravelNode = (nodeId, reason = 'physical-arrival') => {
      const node = travelNodeById.get(nodeId);
      if (!node || discoveredTravelNodes.has(nodeId)) return false;
      discoveredTravelNodes.add(nodeId);
      state.travelLastNodeId = nodeId;
      state.travelDirty = true;
      showTravelToast('Zona descubierta: ' + node.name);
      updateDiscoveredTravelRoutes();
      updateTravelPanel();
      return true;
    };
    const serializableTravelProgress = reason => ({
      schemaVersion: state.travelSchemaVersion,
      regionId: 'baleares',
      savedAt: Date.now(),
      reason,
      saveCount: state.travelSaveCount + 1,
      resetCount: state.travelResetCount,
      position: { x: state.camera.x, y: state.camera.y, z: state.camera.z },
      yaw: state.yaw,
      pitch: state.pitch,
      preset: state.activePreset,
      distance: state.travelDistance,
      landDistance: state.travelLandDistance,
      waterDistance: state.travelWaterDistance,
      discoveredNodes: [...discoveredTravelNodes],
      discoveredRoutes: [...discoveredTravelRoutes],
      lastNodeId: state.travelLastNodeId,
      trail: travelTrail.slice(-384)
    });
    const saveTravelProgress = (reason = 'manual') => {
      try {
        const payload = serializableTravelProgress(reason);
        localStorage.setItem(state.travelSaveKey, JSON.stringify(payload));
        state.travelSaveCount = payload.saveCount;
        state.travelLastSavedAt = payload.savedAt;
        state.travelLastSaveReason = reason;
        state.travelDirty = false;
        updateTravelPanel();
        if (reason === 'manual') showTravelToast('Progreso guardado');
        return travelStateSnapshot();
      } catch (error) {
        state.travelSaveErrors++;
        showTravelToast('No se pudo guardar');
        console.warn('WAFT travel save failed', error);
        return null;
      }
    };
    const restoreTravelProgress = () => {
      state.travelLoaded = true;
      let payload = null;
      try {
        const raw = localStorage.getItem(state.travelSaveKey);
        if (raw) payload = JSON.parse(raw);
      } catch (error) {
        state.travelSaveErrors++;
        console.warn('WAFT travel restore failed', error);
      }
      if (!payload || payload.schemaVersion !== state.travelSchemaVersion || payload.regionId !== 'baleares') return false;
      for (const id of Array.isArray(payload.discoveredNodes) ? payload.discoveredNodes : []) if (travelNodeById.has(id)) discoveredTravelNodes.add(id);
      for (const id of Array.isArray(payload.discoveredRoutes) ? payload.discoveredRoutes : []) if (travelRouteById.has(id)) discoveredTravelRoutes.add(id);
      travelTrail = (Array.isArray(payload.trail) ? payload.trail : []).filter(point => Number.isFinite(point?.x) && Number.isFinite(point?.z)).slice(-384).map(point => ({ x: point.x, z: point.z, mode: point.mode === 'water' ? 'water' : 'land' }));
      travelLastTrailPoint = travelTrail.at(-1) || null;
      state.travelDistance = Math.max(0, Number(payload.distance) || 0);
      state.travelLandDistance = Math.max(0, Number(payload.landDistance) || 0);
      state.travelWaterDistance = Math.max(0, Number(payload.waterDistance) || 0);
      state.travelLastNodeId = travelNodeById.has(payload.lastNodeId) ? payload.lastNodeId : null;
      state.travelSaveCount = Math.max(0, Number(payload.saveCount) || 0);
      state.travelResetCount = Math.max(0, Number(payload.resetCount) || 0);
      state.travelLastSavedAt = Math.max(0, Number(payload.savedAt) || 0);
      state.travelLastSaveReason = payload.reason || 'restore';
      const x = Number(payload.position?.x), z = Number(payload.position?.z);
      if (Number.isFinite(x) && Number.isFinite(z) && x >= terrainMesh.bounds.minX && x <= terrainMesh.bounds.maxX && z >= terrainMesh.bounds.minZ && z <= terrainMesh.bounds.maxZ) {
        const savedPreset = runtimeControls.playable.find(item => item.id === payload.preset);
        if (savedPreset) runtimeControls.spawn(savedPreset);
        state.camera.x = x;
        state.camera.z = z;
        const surface = sampleTerrainInfo(x, z);
        state.swimming = surface.inside && !surface.land;
        state.movementMode = state.swimming ? 'swimming' : 'ground';
        state.camera.y = state.swimming ? surface.waterHeight + state.playerSwimEyeHeight : surface.height + state.playerEyeHeight;
        state.grounded = !state.swimming;
        state.velocityY = 0;
        state.yaw = Number.isFinite(Number(payload.yaw)) ? Number(payload.yaw) : state.yaw;
        state.playerFacing = state.yaw;
        state.pitch = Number.isFinite(Number(payload.pitch)) ? Math.max(-.12, Math.min(.72, Number(payload.pitch))) : state.pitch;
        streamer.update(state.camera.x, state.camera.z, true);
        runtimeControls.refreshLocalProximity(true);
      }
      state.travelRestored = true;
      state.travelDirty = false;
      state.travelDiscoveryArmed = false;
      state.travelMovementSinceTeleport = 0;
      rebuildTravelTrailMesh();
      rebuildTravelRouteMesh();
      updateTravelPanel();
      showTravelToast('Viaje recuperado');
      return true;
    };
    const resetTravelProgress = () => {
      try { localStorage.removeItem(state.travelSaveKey); } catch (error) { state.travelSaveErrors++; }
      discoveredTravelNodes.clear();
      discoveredTravelRoutes.clear();
      travelTrail = [];
      travelLastTrailPoint = null;
      state.travelDistance = 0;
      state.travelLandDistance = 0;
      state.travelWaterDistance = 0;
      state.travelLastNodeId = null;
      state.travelRestored = false;
      state.travelResetCount++;
      state.travelDiscoveryArmed = true;
      state.travelMovementSinceTeleport = 0;
      const palmaPreset = runtimeControls.playable.find(item => item.id === 'palma') || runtimeControls.playable[0];
      if (state.worldMode === 'local') runtimeControls.exitLocal();
      runtimeControls.spawn(palmaPreset);
      state.travelDiscoveryArmed = true;
      discoverTravelNode('palma', 'reset-start');
      travelTrail.push({ x: state.camera.x, z: state.camera.z, mode: 'land' });
      travelLastTrailPoint = travelTrail[0];
      rebuildTravelTrailMesh();
      rebuildTravelRouteMesh();
      const snapshot = saveTravelProgress('reset');
      showTravelToast('Viaje reiniciado');
      return snapshot;
    };
    const recordTravelMovement = (beforeX, beforeZ, moveResult, wasSwimming) => {
      if (state.worldMode !== 'regional') return;
      const distance = Math.hypot(state.camera.x - beforeX, state.camera.z - beforeZ);
      const steps = (moveResult?.landSteps || 0) + (moveResult?.waterSteps || 0);
      if (distance > .0001) {
        const waterShare = steps > 0 ? (moveResult.waterSteps || 0) / steps : wasSwimming ? 1 : 0;
        const waterDistance = distance * waterShare;
        const landDistance = distance - waterDistance;
        state.travelDistance += distance;
        state.travelLandDistance += landDistance;
        state.travelWaterDistance += waterDistance;
        state.travelMovementSinceTeleport += distance;
        if (state.travelMovementSinceTeleport >= 1.2) state.travelDiscoveryArmed = true;
        const pointMode = waterShare >= .5 ? 'water' : 'land';
        if (!travelLastTrailPoint || Math.hypot(state.camera.x - travelLastTrailPoint.x, state.camera.z - travelLastTrailPoint.z) >= 1.05) {
          const point = { x: state.camera.x, z: state.camera.z, mode: pointMode };
          travelTrail.push(point);
          if (travelTrail.length > 384) travelTrail.shift();
          travelLastTrailPoint = point;
          rebuildTravelTrailMesh();
        }
        state.travelDirty = true;
      }
      const nearest = nearestTravelNodeAt(state.camera.x, state.camera.z);
      state.travelNearestNodeId = nearest?.node.id || null;
      state.travelNearestNodeDistance = nearest?.distance ?? null;
      if (state.travelDiscoveryArmed && nearest && nearest.distance <= nearest.node.discoveryRadius) discoverTravelNode(nearest.node.id);
      updateTravelPanel();
    };
    const travelProbeFor = nodeId => {
      const node = travelNodeById.get(nodeId);
      if (!node) throw new Error('Nodo de viaje desconocido: ' + nodeId);
      const startRadius = node.discoveryRadius + 2.6;
      for (let index = 0; index < 24; index++) {
        const angle = index / 24 * Math.PI * 2;
        const start = { x: node.x + Math.cos(angle) * startRadius, z: node.z + Math.sin(angle) * startRadius };
        const surface = sampleTerrainInfo(start.x, start.z);
        if (!surface.inside || !surface.land || collidesBuilding(start.x, start.z)) continue;
        let clear = true;
        for (let sample = 1; sample <= 8; sample++) {
          const t = sample / 8;
          const x = start.x + (node.x - start.x) * t;
          const z = start.z + (node.z - start.z) * t;
          const stepSurface = sampleTerrainInfo(x, z);
          if (!stepSurface.inside || !stepSurface.land || collidesBuilding(x, z)) { clear = false; break; }
        }
        if (clear) {
          const directionX = node.x - start.x;
          const directionZ = node.z - start.z;
          return { node: { ...node }, start, yaw: Math.atan2(directionX, directionZ), suggestedMilliseconds: 1800 };
        }
      }
      throw new Error('No se encontró una aproximación física segura a ' + node.name);
    };

    window.__waftTravelTeleport = reason => {
      state.travelDiscoveryArmed = false;
      state.travelMovementSinceTeleport = 0;
      state.travelLastSaveReason = reason;
    };
    window.__waftTravelSave = reason => saveTravelProgress(reason);
    saveTravelButton.addEventListener('click', () => saveTravelProgress('manual'));
    resetTravelButton.addEventListener('click', () => {
      const now = performance.now();
      if (now > travelResetConfirmUntil) {
        travelResetConfirmUntil = now + 3200;
        showTravelToast('Pulsa REINICIAR otra vez');
        return;
      }
      travelResetConfirmUntil = 0;
      resetTravelProgress();
    });
    addEventListener('beforeunload', () => saveTravelProgress('beforeunload'));
    document.addEventListener('visibilitychange', () => { if (document.hidden && state.travelDirty) saveTravelProgress('hidden'); });
    const restoredTravel = restoreTravelProgress();
    if (!restoredTravel) {
      discoverTravelNode('palma', 'initial-start');
      travelTrail.push({ x: state.camera.x, z: state.camera.z, mode: 'land' });
      travelLastTrailPoint = travelTrail[0];
      rebuildTravelTrailMesh();
      rebuildTravelRouteMesh();
      saveTravelProgress('initial');
    }
    updateTravelPanel();

`;
html = insertBefore(html, `    const collidesBuildingWithRadius = (x, z, radius) => {`, travelSystem, 'regional travel system');

html = replaceOnce(
  html,
  `      movePlayer(moveX / state.worldScale, moveZ / state.worldScale);`,
  `      const travelBeforeX = state.camera.x;
      const travelBeforeZ = state.camera.z;
      const travelMoveResult = movePlayer(moveX / state.worldScale, moveZ / state.worldScale);
      recordTravelMovement(travelBeforeX, travelBeforeZ, travelMoveResult, swimmingBeforeMove);`,
  'travel movement recording'
);

html = replaceOnce(
  html,
  `      if (state.settlements) { gl.useProgram(settlementProgram); gl.uniformMatrix4fv(gl.getUniformLocation(settlementProgram,'uPV'),false,pv); gl.uniform1f(gl.getUniformLocation(settlementProgram,'uTerrainScale'),activeTerrain.verticalScale); gl.uniform2f(gl.getUniformLocation(settlementProgram,'uWorldCenter'),state.localCenter.x,state.localCenter.z); gl.uniform1f(gl.getUniformLocation(settlementProgram,'uWorldScale'),state.worldScale); gl.bindVertexArray(activeSettlementMesh.vao); gl.drawArrays(gl.POINTS,0,activeSettlementMesh.count); }
      drawCharacter(now, eye);`,
  `      if (state.settlements) { gl.useProgram(settlementProgram); gl.uniformMatrix4fv(gl.getUniformLocation(settlementProgram,'uPV'),false,pv); gl.uniform1f(gl.getUniformLocation(settlementProgram,'uTerrainScale'),activeTerrain.verticalScale); gl.uniform2f(gl.getUniformLocation(settlementProgram,'uWorldCenter'),state.localCenter.x,state.localCenter.z); gl.uniform1f(gl.getUniformLocation(settlementProgram,'uWorldScale'),state.worldScale); gl.bindVertexArray(activeSettlementMesh.vao); gl.drawArrays(gl.POINTS,0,activeSettlementMesh.count); }
      if (state.worldMode === 'regional' && travelRouteVertexCount > 0) { gl.useProgram(roadProgram); gl.uniformMatrix4fv(gl.getUniformLocation(roadProgram,'uPV'),false,pv); gl.uniform1f(gl.getUniformLocation(roadProgram,'uTerrainScale'),terrainMesh.verticalScale); gl.uniform1f(gl.getUniformLocation(roadProgram,'uLift'),.46); gl.uniform2f(gl.getUniformLocation(roadProgram,'uWorldCenter'),0,0); gl.uniform1f(gl.getUniformLocation(roadProgram,'uWorldScale'),1); gl.bindVertexArray(travelRouteVao); gl.drawArrays(gl.LINES,0,travelRouteVertexCount); }
      if (state.worldMode === 'regional' && travelTrailVertexCount > 1) { gl.useProgram(roadProgram); gl.uniformMatrix4fv(gl.getUniformLocation(roadProgram,'uPV'),false,pv); gl.uniform1f(gl.getUniformLocation(roadProgram,'uTerrainScale'),terrainMesh.verticalScale); gl.uniform1f(gl.getUniformLocation(roadProgram,'uLift'),.64); gl.uniform2f(gl.getUniformLocation(roadProgram,'uWorldCenter'),0,0); gl.uniform1f(gl.getUniformLocation(roadProgram,'uWorldScale'),1); gl.bindVertexArray(travelTrailVao); gl.drawArrays(gl.LINE_STRIP,0,travelTrailVertexCount); }
      drawCharacter(now, eye);`,
  'travel route and trail rendering'
);

html = replaceOnce(
  html,
  `      nearestClock += dt;
      if (nearestClock > .45) { nearestClock = 0; nearestUpdate(); }`,
  `      state.travelAutoSaveClock += dt;
      if (state.travelAutoSaveClock >= 5) {
        state.travelAutoSaveClock = 0;
        if (state.travelDirty) saveTravelProgress('autosave');
      }
      nearestClock += dt;
      if (nearestClock > .45) { nearestClock = 0; nearestUpdate(); updateTravelPanel(); }`,
  'travel autosave timer'
);

html = replaceOnce(
  html,
  `      setRegionalPosition(x, z) {
        if (state.worldMode === 'local') runtimeControls.exitLocal();`,
  `      setRegionalPosition(x, z) {
        if (window.__waftTravelTeleport) window.__waftTravelTeleport('api-position');
        if (state.worldMode === 'local') runtimeControls.exitLocal();`,
  'API teleport suppression'
);

html = replaceOnce(
  html,
  `      sampleSurface(x, z) { return sampleTerrainInfo(Number(x), Number(z)); },`,
  `      sampleSurface(x, z) { return sampleTerrainInfo(Number(x), Number(z)); },
      getTravelState() { return travelStateSnapshot(); },
      getTravelProbe(nodeId) { return travelProbeFor(String(nodeId)); },
      saveProgress() { return saveTravelProgress('api'); },
      resetProgress() { return resetTravelProgress(); },`,
  'travel API methods'
);

html = replaceOnce(
  html,
  `      getState() { const displayPosition = toDisplayXZ(state.camera.x, state.camera.z); return { movementMode: state.movementMode,`,
  `      getState() { const displayPosition = toDisplayXZ(state.camera.x, state.camera.z); return { travelLoaded: state.travelLoaded, travelRestored: state.travelRestored, travelSaveCount: state.travelSaveCount, travelResetCount: state.travelResetCount, travelLastSavedAt: state.travelLastSavedAt, travelLastSaveReason: state.travelLastSaveReason, travelDirty: state.travelDirty, travelDistance: state.travelDistance, travelLandDistance: state.travelLandDistance, travelWaterDistance: state.travelWaterDistance, travelTrailPoints: state.travelTrailPoints, travelDiscoveredNodes: state.travelDiscoveredNodes, travelDiscoveredRoutes: state.travelDiscoveredRoutes, travelLastNodeId: state.travelLastNodeId, travelNearestNodeId: state.travelNearestNodeId, travelNearestNodeDistance: state.travelNearestNodeDistance, travelDiscoveryArmed: state.travelDiscoveryArmed, movementMode: state.movementMode,`,
  'travel fields in runtime state'
);

html = replaceOnce(
  html,
  `      playerMetrics: { visualScale: state.playerVisualScale, collisionRadius: state.playerCollisionRadius, eyeHeight: state.playerEyeHeight, swimEyeHeight: state.playerSwimEyeHeight, previousCollisionRadius: state.playerPreviousCollisionRadius, graphicsProfile: state.graphicsProfile, runSpeed: state.runSpeed, swimSpeed: state.swimSpeed, jumpVelocity: state.jumpVelocity, gravity: state.gravity, terrainAdaptation: true, swimming: true },
      metadata,`,
  `      playerMetrics: { visualScale: state.playerVisualScale, collisionRadius: state.playerCollisionRadius, eyeHeight: state.playerEyeHeight, swimEyeHeight: state.playerSwimEyeHeight, previousCollisionRadius: state.playerPreviousCollisionRadius, graphicsProfile: state.graphicsProfile, runSpeed: state.runSpeed, swimSpeed: state.swimSpeed, jumpVelocity: state.jumpVelocity, gravity: state.gravity, terrainAdaptation: true, swimming: true },
      travelGraph: { schemaVersion: state.travelSchemaVersion, regionId: 'baleares', nodes: travelNodes.map(node => ({ ...node })), routes: travelRoutes.map(route => ({ ...route })) },
      metadata,`,
  'travel graph API'
);

html = replaceOnce(
  html,
  `    window.__WAFT_RUNTIME_011_STATS__ = { movementMode: state.movementMode,`,
  `    window.__WAFT_RUNTIME_011_STATS__ = { travelLoaded: state.travelLoaded, travelRestored: state.travelRestored, travelSaveCount: state.travelSaveCount, travelDistance: state.travelDistance, travelTrailPoints: state.travelTrailPoints, travelDiscoveredNodes: state.travelDiscoveredNodes, travelDiscoveredRoutes: state.travelDiscoveredRoutes, movementMode: state.movementMode,`,
  'travel initial stats'
);

assert(html.includes("version: '011'"), 'Runtime API version was not upgraded');
assert(html.includes('getTravelState()'), 'Travel state API is missing');
assert(html.includes('waft.baleares.travel.v1'), 'Travel persistence key is missing');
assert(html.includes('gl.LINE_STRIP'), 'Travel trail rendering is missing');
assert(!html.includes('__WAFT_RUNTIME_010_'), 'Runtime 010 globals remain in runtime 011');

fs.writeFileSync(outputPath, html);
const output = fs.readFileSync(outputPath);
const source = fs.readFileSync(sourcePath);
const report = {
  formatVersion: 1,
  buildRevision: BUILD_REVISION,
  runtimeVersion: '011',
  source: path.relative(ROOT, sourcePath).replaceAll(path.sep, '/'),
  output: path.relative(ROOT, outputPath).replaceAll(path.sep, '/'),
  sourceSha256: sha256(source),
  outputSha256: sha256(output),
  outputBytes: output.length,
  travel: {
    schemaVersion: 1,
    saveKey: 'waft.baleares.travel.v1',
    nodes: 5,
    routes: 5,
    physicalDiscovery: true,
    teleportDiscoverySuppressed: true,
    breadcrumbTrail: true,
    maximumTrailPoints: 384,
    routeRendering: true,
    manualSave: true,
    autosaveSeconds: 5,
    restorePosition: true,
    resetConfirmation: true
  },
  preserved: {
    terrainAdaptation: true,
    mountainClimbing: true,
    swimming: true,
    highJump: true,
    localZonePackages: true,
    protectedRuntime010: true
  }
};
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
