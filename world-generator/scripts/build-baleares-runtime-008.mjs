import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const BUILD_REVISION = 1;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourcePath = path.join(ROOT, 'mallorca-mobile/region-runtime-baleares-007.html');
const outputPath = path.join(ROOT, 'mallorca-mobile/region-runtime-baleares-008.html');
const reportPath = path.join(ROOT, 'world-generator/baleares-runtime-008-build.json');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function replaceOnce(source, search, replacement, label) {
  const first = source.indexOf(search);
  assert(first >= 0, `Could not find ${label}`);
  assert(source.indexOf(search, first + search.length) < 0, `${label} is not unique`);
  return source.slice(0, first) + replacement + source.slice(first + search.length);
}

function replaceBetween(source, start, end, replacement, label) {
  const startIndex = source.indexOf(start);
  assert(startIndex >= 0, `Could not find start of ${label}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert(endIndex >= 0, `Could not find end of ${label}`);
  assert(source.indexOf(start, startIndex + start.length) < 0, `${label} start is not unique`);
  return source.slice(0, startIndex) + replacement + source.slice(endIndex + end.length);
}

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

let html = fs.readFileSync(sourcePath, 'utf8');
html = html.replaceAll('Runtime regional de Baleares 007', 'Runtime regional de Baleares 008');
html = html.replaceAll('RUNTIME REGIONAL 007', 'RUNTIME REGIONAL 008');
html = html.replaceAll('__WAFT_RUNTIME_007_', '__WAFT_RUNTIME_008_');
html = html.replace("      version: '007',", "      version: '008',");
html = html.replace(
  'ZONA LOCAL: cargar Palma o Llevant según el destino seleccionado',
  'ZONA LOCAL: acércate físicamente a Palma o Llevant para habilitar la entrada'
);

html = replaceOnce(
  html,
  `    localRequestedZoneId: null,
    localLastLoadedZoneId: null`,
  `    localRequestedZoneId: null,
    localLastLoadedZoneId: null,
    localProximityZoneId: null,
    localProximityDistance: null,
    localProximityStatus: 'outside',
    localEntryRadius: 0,
    localDiscoveryRadius: 0,
    localProximityUpdates: 0`,
  'position-aware local-zone state'
);

html = replaceBetween(
  html,
  `    const zoneById = new Map(localRegistry.zones.map(zone => [zone.id, zone]));`,
  `    const terrainAt = (x, z) => {`,
  `    const zoneById = new Map(localRegistry.zones.map(zone => [zone.id, zone]));
    const zoneByPreset = new Map(localRegistry.zones.map(zone => [zone.presetId, zone]));
    const shortZoneName = zone => zone.name.split(' · ')[0].toUpperCase();
    const zoneForPreset = presetId => zoneByPreset.get(presetId) || null;
    const entryRadiusFor = zone => Math.max(6, Math.min(10, Number(zone.regionalRadius) * .32));
    const discoveryRadiusFor = zone => entryRadiusFor(zone) * 2.25;
    const nearestZoneAt = (x, z) => {
      let nearest = null;
      for (const zone of localRegistry.zones) {
        const distance = Math.hypot(x - zone.center.x, z - zone.center.z);
        if (!nearest || distance < nearest.distance) nearest = { zone, distance };
      }
      return nearest;
    };
    const updateScaleButton = () => {
      if (state.worldMode === 'local') {
        scaleModeButton.disabled = false;
        scaleModeButton.textContent = 'SALIR A REGIONAL';
        scaleModeButton.classList.add('active');
        return;
      }
      scaleModeButton.classList.remove('active');
      const proximityZone = state.localProximityZoneId ? zoneById.get(state.localProximityZoneId) : null;
      const requestedZone = state.localRequestedZoneId ? zoneById.get(state.localRequestedZoneId) : null;
      if (state.localPackageStatus === 'loading') {
        const loadingZone = requestedZone || proximityZone;
        scaleModeButton.disabled = true;
        scaleModeButton.textContent = loadingZone ? 'CARGANDO ' + shortZoneName(loadingZone) + '…' : 'CARGANDO ZONA…';
        return;
      }
      if (state.localProximityStatus === 'available' && proximityZone) {
        scaleModeButton.disabled = false;
        const retry = state.localPackageStatus === 'error' && state.localRequestedZoneId === proximityZone.id;
        scaleModeButton.textContent = (retry ? 'REINTENTAR ' : 'ENTRAR EN ') + shortZoneName(proximityZone);
        return;
      }
      if (state.localProximityStatus === 'nearby' && proximityZone) {
        scaleModeButton.disabled = true;
        scaleModeButton.textContent = 'ACÉRCATE A ' + shortZoneName(proximityZone) + ' · ' + state.localProximityDistance.toFixed(1);
        return;
      }
      scaleModeButton.disabled = true;
      scaleModeButton.textContent = 'SIN ZONA CERCANA';
    };
    const refreshLocalProximity = (force = false) => {
      if (state.worldMode === 'local') return {
        zoneId: state.localZoneId,
        distance: 0,
        status: 'inside',
        entryRadius: state.localEntryRadius,
        discoveryRadius: state.localDiscoveryRadius
      };
      const nearest = nearestZoneAt(state.camera.x, state.camera.z);
      const entryRadius = nearest ? entryRadiusFor(nearest.zone) : 0;
      const discoveryRadius = nearest ? discoveryRadiusFor(nearest.zone) : 0;
      const status = !nearest || nearest.distance > discoveryRadius
        ? 'outside'
        : nearest.distance <= entryRadius ? 'available' : 'nearby';
      const zoneId = status === 'outside' ? null : nearest.zone.id;
      const distance = nearest ? nearest.distance : null;
      const changed = force
        || state.localProximityZoneId !== zoneId
        || state.localProximityStatus !== status
        || Math.abs((state.localProximityDistance ?? -1) - (distance ?? -1)) >= .15;
      state.localProximityZoneId = zoneId;
      state.localProximityDistance = distance;
      state.localProximityStatus = status;
      state.localEntryRadius = entryRadius;
      state.localDiscoveryRadius = discoveryRadius;
      if (changed) {
        state.localProximityUpdates++;
        updateScaleButton();
      }
      return { zoneId, distance, status, entryRadius, discoveryRadius };
    };
    const terrainAt = (x, z) => {`,
  'position-based zone detector'
);

html = replaceOnce(
  html,
  `      if (state.worldMode === 'regional') streamer.update(state.camera.x, state.camera.z, true);
      updateScaleButton();
    };`,
  `      if (state.worldMode === 'regional') streamer.update(state.camera.x, state.camera.z, true);
      refreshLocalProximity(true);
    };`,
  'spawn proximity refresh'
);

html = replaceBetween(
  html,
  `    let localTransitionGeneration = 0;`,
  `    scaleModeButton.addEventListener('click', async () => {
      try {
        if (state.worldMode === 'local') exitLocal();
        else await enterLocal();
      } catch (error) {
        updateScaleButton();
        fail(error);
      }
    });`,
  `    let localTransitionGeneration = 0;
    const exitLocal = () => {
      localTransitionGeneration++;
      state.worldMode = 'regional';
      state.worldScale = 1;
      state.footprintScale = 1;
      state.localZoneId = null;
      state.renderDataset = 'regional-streamed';
      state.cameraDistance = 6.4;
      streamer.update(state.camera.x, state.camera.z, true);
      localAssets.release();
      state.localRequestedZoneId = null;
      refreshLocalProximity(true);
      return true;
    };
    const enterLocal = async (requestedZoneId = null) => {
      const transitionGeneration = ++localTransitionGeneration;
      const proximity = refreshLocalProximity(true);
      const zoneEntry = requestedZoneId
        ? zoneById.get(String(requestedZoneId))
        : proximity.zoneId ? zoneById.get(proximity.zoneId) : null;
      if (!zoneEntry) throw new Error('No hay una zona local suficientemente cerca.');
      if (proximity.status !== 'available' || proximity.zoneId !== zoneEntry.id) {
        throw new Error('Debes acercarte físicamente a ' + zoneEntry.name + ' antes de entrar.');
      }
      const preset = playable.find(item => item.id === zoneEntry.presetId);
      if (!preset) throw new Error('El punto regional de ' + zoneEntry.name + ' no está configurado.');
      state.activePreset = preset.id;
      for (const button of presets.children) button.classList.toggle('active', button.dataset.id === preset.id);
      state.localRequestedZoneId = zoneEntry.id;
      updateScaleButton();
      await localAssets.load(zoneEntry);
      if (transitionGeneration !== localTransitionGeneration) {
        localAssets.release(false);
        return false;
      }
      state.localCenter.x = localAssets.metadata.center.x;
      state.localCenter.z = localAssets.metadata.center.z;
      state.localZoneId = localAssets.metadata.zoneId;
      state.worldMode = 'local';
      state.worldScale = localAssets.metadata.worldScale;
      state.footprintScale = localAssets.metadata.footprintScale;
      state.localRadius = localAssets.metadata.regionalRadius;
      state.renderDataset = 'local-package';
      state.activeBuildings = localAssets.metadata.counts.buildings;
      state.loadedCells = 1;
      state.cameraDistance = 7.2;
      updateScaleButton();
      return true;
    };
    scaleModeButton.addEventListener('click', async () => {
      try {
        if (state.worldMode === 'local') exitLocal();
        else await enterLocal();
      } catch (error) {
        updateScaleButton();
        fail(error);
      }
    });`,
  'proximity-gated local transition'
);

html = replaceOnce(
  html,
  `    return { spawn, playable, enterLocal, exitLocal };`,
  `    return { spawn, playable, enterLocal, exitLocal, refreshLocalProximity, nearestZoneAt, entryRadiusFor, discoveryRadiusFor };`,
  'proximity controls export'
);

html = replaceOnce(
  html,
  `      state.camera.x = Math.max(bounds.minX, Math.min(bounds.maxX, state.camera.x));
      state.camera.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, state.camera.z));
      const displayPosition = toDisplayXZ(state.camera.x, state.camera.z);`,
  `      state.camera.x = Math.max(bounds.minX, Math.min(bounds.maxX, state.camera.x));
      state.camera.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, state.camera.z));
      if (state.worldMode === 'regional') runtimeControls.refreshLocalProximity();
      const displayPosition = toDisplayXZ(state.camera.x, state.camera.z);`,
  'continuous position detection'
);

html = replaceOnce(
  html,
  `        const localLabel = localAssets.metadata?.name?.split(' · ')[0]?.toUpperCase() || state.localZoneId?.toUpperCase() || 'ZONA';
        const modeLabel = state.worldMode === 'local' ? 'LOCAL ' + localLabel + ' · PAQUETE ×' + state.worldScale : 'REGIONAL ×1';`,
  `        const localLabel = localAssets.metadata?.name?.split(' · ')[0]?.toUpperCase() || state.localZoneId?.toUpperCase() || 'ZONA';
        const proximityZone = state.localProximityZoneId ? localRegistry.zones.find(zone => zone.id === state.localProximityZoneId) : null;
        const proximityHint = state.worldMode !== 'regional' || !proximityZone
          ? ''
          : state.localProximityStatus === 'available'
            ? ' · ACCESO ' + proximityZone.name.split(' · ')[0].toUpperCase()
            : ' · ' + proximityZone.name.split(' · ')[0].toUpperCase() + ' A ' + state.localProximityDistance.toFixed(1);
        const modeLabel = state.worldMode === 'local' ? 'LOCAL ' + localLabel + ' · PAQUETE ×' + state.worldScale : 'REGIONAL ×1' + proximityHint;`,
  'geographic proximity HUD'
);

html = replaceOnce(
  html,
  `          localLastLoadedZoneId: state.localLastLoadedZoneId,
          playerFacing: state.playerFacing,`,
  `          localLastLoadedZoneId: state.localLastLoadedZoneId,
          localProximityZoneId: state.localProximityZoneId,
          localProximityDistance: state.localProximityDistance,
          localProximityStatus: state.localProximityStatus,
          localEntryRadius: state.localEntryRadius,
          localDiscoveryRadius: state.localDiscoveryRadius,
          localProximityUpdates: state.localProximityUpdates,
          playerFacing: state.playerFacing,`,
  'periodic proximity stats'
);

html = html.replaceAll(
  `localLastLoadedZoneId: state.localLastLoadedZoneId, renderDataset`,
  `localLastLoadedZoneId: state.localLastLoadedZoneId, localProximityZoneId: state.localProximityZoneId, localProximityDistance: state.localProximityDistance, localProximityStatus: state.localProximityStatus, localEntryRadius: state.localEntryRadius, localDiscoveryRadius: state.localDiscoveryRadius, localProximityUpdates: state.localProximityUpdates, renderDataset`
);

html = replaceOnce(
  html,
  `        runtimeControls.spawn(preset);
      },
      enterLocal(zoneId = null) { return runtimeControls.enterLocal(zoneId); },`,
  `        runtimeControls.spawn(preset);
      },
      setRegionalPosition(x, z) {
        if (state.worldMode === 'local') runtimeControls.exitLocal();
        const nextX = Number(x), nextZ = Number(z);
        if (!Number.isFinite(nextX) || !Number.isFinite(nextZ)) throw new Error('Las coordenadas regionales deben ser numéricas.');
        state.camera.x = nextX;
        state.camera.z = nextZ;
        const terrainInfo = sampleTerrainInfo(nextX, nextZ);
        if (terrainInfo.land) state.camera.y = terrainInfo.height + 1.35;
        state.velocityY = 0;
        state.grounded = true;
        streamer.update(state.camera.x, state.camera.z, true);
        return runtimeControls.refreshLocalProximity(true);
      },
      detectLocalZone() { return runtimeControls.refreshLocalProximity(true); },
      enterLocal(zoneId = null) { return runtimeControls.enterLocal(zoneId); },`,
  'position-aware public API'
);

html = replaceOnce(
  html,
  `      availableZones: localRegistry.zones.map(zone => ({ id: zone.id, presetId: zone.presetId, name: zone.name, buildId: zone.buildId })),`,
  `      availableZones: localRegistry.zones.map(zone => ({ id: zone.id, presetId: zone.presetId, name: zone.name, buildId: zone.buildId, center: { ...zone.center }, entryRadius: Math.max(6, Math.min(10, Number(zone.regionalRadius) * .32)), discoveryRadius: Math.max(6, Math.min(10, Number(zone.regionalRadius) * .32)) * 2.25 })),`,
  'public proximity contracts'
);

assert(html.includes("version: '008'"), 'Runtime 008 API version is missing');
assert(html.includes('refreshLocalProximity'), 'Runtime 008 has no position detector');
assert(html.includes("localProximityStatus: 'outside'"), 'Runtime 008 has no proximity state');
assert(html.includes("scaleModeButton.textContent = 'SIN ZONA CERCANA'"), 'Runtime 008 has no out-of-range state');
assert(html.includes("'ACÉRCATE A ' + shortZoneName"), 'Runtime 008 has no discovery-range state');
assert(html.includes('runtimeControls.refreshLocalProximity();'), 'Runtime 008 does not update proximity while moving');
assert(html.includes('setRegionalPosition(x, z)'), 'Runtime 008 lacks the geographic test/navigation API');
assert(!html.includes('según el destino seleccionado'), 'Runtime 008 still describes preset-only activation');

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, html);
const outputBuffer = fs.readFileSync(outputPath);
const report = {
  formatVersion: 1,
  buildRevision: BUILD_REVISION,
  runtimeVersion: '008',
  source: path.relative(ROOT, sourcePath).replaceAll(path.sep, '/'),
  output: path.relative(ROOT, outputPath).replaceAll(path.sep, '/'),
  sourceSha256: sha256(fs.readFileSync(sourcePath)),
  outputSha256: sha256(outputBuffer),
  outputBytes: outputBuffer.length,
  behavior: {
    registryLoadsAtBoot: true,
    localPackagesLoadAtBoot: false,
    zoneDiscoveryUsesPlayerPosition: true,
    entryIsProximityGated: true,
    discoveryAndEntryRadiiAreDerivedFromZoneSize: true,
    directDestinationButtonsRemainForTesting: true,
    previousZoneReleasesBeforeNextLoad: true
  }
};
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
