import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const BUILD_REVISION = 1;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourcePath = path.join(ROOT, 'mallorca-mobile/region-runtime-baleares-006.html');
const outputPath = path.join(ROOT, 'mallorca-mobile/region-runtime-baleares-007.html');
const reportPath = path.join(ROOT, 'world-generator/baleares-runtime-007-build.json');

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
html = html.replaceAll('Runtime regional de Baleares 006', 'Runtime regional de Baleares 007');
html = html.replaceAll('RUNTIME REGIONAL 006', 'RUNTIME REGIONAL 007');
html = html.replaceAll('__WAFT_RUNTIME_006_', '__WAFT_RUNTIME_007_');
html = html.replace("      version: '006',", "      version: '007',");
html = html.replace('<button id="scaleMode">ENTRAR EN LLEVANT</button>', '<button id="scaleMode">ZONA LOCAL</button>');
html = html.replace('ENTRAR EN LLEVANT: cambiar entre viaje regional y exploración local', 'ZONA LOCAL: cargar Palma o Llevant según el destino seleccionado');

html = replaceOnce(
  html,
  "  const localBase = `${base}local/llevant/`;",
  "  const localBase = `${base}local/`;",
  'generic local base path'
);

html = replaceOnce(
  html,
  `    localPackageRequestCount: 0,
    localGpuResources: 0`,
  `    localPackageRequestCount: 0,
    localGpuResources: 0,
    localRegistryLoaded: false,
    localRegistryBuildId: null,
    localZoneCount: 0,
    localRequestedZoneId: null,
    localLastLoadedZoneId: null`,
  'multi-zone registry state'
);

html = replaceOnce(
  html,
  '  function setupControls(metadata, terrainMesh, preview, streamer, localAssets) {',
  '  function setupControls(metadata, terrainMesh, preview, streamer, localAssets, localRegistry) {',
  'multi-zone control signature'
);

html = replaceOnce(
  html,
  `    const presets = document.getElementById('presets');
    const playable = metadata.presets.filter(item => item.id !== 'overview');
    const terrainAt = (x, z) => {`,
  `    const presets = document.getElementById('presets');
    const playable = metadata.presets.filter(item => item.id !== 'overview');
    const zoneById = new Map(localRegistry.zones.map(zone => [zone.id, zone]));
    const zoneByPreset = new Map(localRegistry.zones.map(zone => [zone.presetId, zone]));
    const shortZoneName = zone => zone.name.split(' · ')[0].toUpperCase();
    const zoneForPreset = presetId => zoneByPreset.get(presetId) || null;
    const updateScaleButton = () => {
      if (state.worldMode === 'local') {
        scaleModeButton.disabled = false;
        scaleModeButton.textContent = 'SALIR A REGIONAL';
        scaleModeButton.classList.add('active');
        return;
      }
      const zone = zoneForPreset(state.activePreset);
      scaleModeButton.classList.remove('active');
      if (!zone) {
        scaleModeButton.disabled = true;
        scaleModeButton.textContent = 'SIN ZONA LOCAL';
        return;
      }
      scaleModeButton.disabled = state.localPackageStatus === 'loading';
      const retry = state.localPackageStatus === 'error' && state.localRequestedZoneId === zone.id;
      scaleModeButton.textContent = (retry ? 'REINTENTAR ' : 'ENTRAR EN ') + shortZoneName(zone);
    };
    const terrainAt = (x, z) => {`,
  'zone registry control maps'
);

html = replaceOnce(
  html,
  `      if (state.worldMode === 'regional') streamer.update(state.camera.x, state.camera.z, true);
    };
    let localTransitionGeneration = 0;`,
  `      if (state.worldMode === 'regional') streamer.update(state.camera.x, state.camera.z, true);
      updateScaleButton();
    };
    let localTransitionGeneration = 0;`,
  'spawn zone-button refresh'
);

html = replaceBetween(
  html,
  `    let localTransitionGeneration = 0;`,
  `    scaleModeButton.addEventListener('click', async () => {
      try {
        if (state.worldMode === 'local') exitLocal();
        else await enterLocal();
      } catch (error) {
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
      updateScaleButton();
      return true;
    };
    const enterLocal = async (requestedZoneId = null) => {
      const transitionGeneration = ++localTransitionGeneration;
      const zoneEntry = requestedZoneId ? zoneById.get(String(requestedZoneId)) : zoneForPreset(state.activePreset);
      if (!zoneEntry) throw new Error('No hay una zona local registrada para este destino.');
      const preset = playable.find(item => item.id === zoneEntry.presetId);
      if (!preset) throw new Error('El punto regional de ' + zoneEntry.name + ' no está configurado.');
      if (state.activePreset !== preset.id) spawn(preset);
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
  'multi-zone local transition'
);

html = replaceOnce(
  html,
  `    const metadata = await fetchJson(\`${'${previewBase}'}baleares-preview-v1.json\`);
    const [previewBuffer, terrainBuffer, landcoverBuffer] = await Promise.all([`,
  `    const [metadata, localRegistry] = await Promise.all([
      fetchJson(\`${'${previewBase}'}baleares-preview-v1.json\`),
      fetchJson(\`${'${localBase}'}zones-v1.json\`)
    ]);
    if (localRegistry.registryType !== 'waft-local-zone-registry' || localRegistry.regionId !== 'baleares') throw new Error('El registro de zonas locales no es válido.');
    if (!Array.isArray(localRegistry.zones) || localRegistry.zones.length < 2) throw new Error('El registro local no contiene suficientes zonas.');
    state.localRegistryLoaded = true;
    state.localRegistryBuildId = localRegistry.buildId;
    state.localZoneCount = localRegistry.zones.length;
    const [previewBuffer, terrainBuffer, landcoverBuffer] = await Promise.all([`,
  'registry boot download'
);

html = replaceBetween(
  html,
  `    const localAssets = {`,
  `    const characterMesh = createSphereGeometry(gl);`,
  `    const localAssets = {
      zoneEntry: null,
      metadata: null,
      preview: null,
      terrainMesh: null,
      buildingMesh: null,
      roadMesh: null,
      landmarkMesh: null,
      settlementMesh: null,
      loadPromise: null,
      async load(zoneEntry) {
        if (!zoneEntry) throw new Error('No se indicó una zona local.');
        if (state.localPackageLoaded && this.zoneEntry?.id === zoneEntry.id) return this;
        if (state.localPackageLoaded || this.metadata) this.release();
        if (this.loadPromise) return this.loadPromise;
        const loadNumber = state.localPackageLoadCount + 1;
        const scaleModeButton = document.getElementById('scaleMode');
        state.localPackageStatus = 'loading';
        state.localRequestedZoneId = zoneEntry.id;
        scaleModeButton.disabled = true;
        scaleModeButton.textContent = 'CARGANDO ' + zoneEntry.name.split(' · ')[0].toUpperCase() + '…';
        this.loadPromise = (async () => {
          state.localPackageRequestCount++;
          const localMetadata = await fetchJson(\`${'${localBase}${zoneEntry.metadataFile}'}\`, \`zone=${'${encodeURIComponent(zoneEntry.id)}'}&load=${'${loadNumber}'}\`);
          if (localMetadata.zoneId !== zoneEntry.id || localMetadata.presetId !== zoneEntry.presetId || localMetadata.buildId !== zoneEntry.buildId) throw new Error('Los metadatos locales no coinciden con el registro.');
          if (localMetadata.binary.sha256 !== zoneEntry.binarySha256 || localMetadata.binary.bytes !== zoneEntry.binaryBytes) throw new Error('La referencia binaria local no coincide con el registro.');
          state.localPackageRequestCount++;
          const localBuffer = await fetchBuffer(\`${'${localBase}${zoneEntry.binaryFile}'}\`, \`zone=${'${encodeURIComponent(zoneEntry.id)}'}&load=${'${loadNumber}'}\`);
          const localDigest = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', localBuffer)));
          if (localDigest !== zoneEntry.binarySha256 || localDigest !== localMetadata.binary.sha256) throw new Error('El paquete local no coincide con su SHA-256.');
          if (localBuffer.byteLength !== zoneEntry.binaryBytes) throw new Error('El paquete local tiene un tamaño inesperado.');
          const localPreview = parseLocalZone(localBuffer);
          const localRenderMetadata = { terrain: { localBounds: localMetadata.regionalBounds, verticalScale: metadata.terrain.verticalScale } };
          this.zoneEntry = zoneEntry;
          this.metadata = localMetadata;
          this.preview = localPreview;
          this.terrainMesh = captureMesh(() => createTerrainMesh(gl, localPreview.terrain, localPreview.landcover, localRenderMetadata));
          this.buildingMesh = captureMesh(() => createCubeGeometry(gl, localPreview.buildings));
          this.roadMesh = captureMesh(() => createRoadGeometry(gl, localPreview.roads));
          this.landmarkMesh = captureMesh(() => createPointGeometry(gl, localPreview.landmarks, 5));
          this.settlementMesh = captureMesh(() => createPointGeometry(gl, localPreview.settlements, 4));
          state.localPackageLoaded = true;
          state.localPackageStatus = 'loaded';
          state.localPackageLoadCount = loadNumber;
          state.localLastLoadedZoneId = zoneEntry.id;
          state.localPackageBuildId = localMetadata.buildId;
          state.localPackageBytes = localMetadata.binary.bytes;
          state.localTerrainColumns = localMetadata.terrain.columns;
          state.localTerrainRows = localMetadata.terrain.rows;
          state.localBuildingCount = localMetadata.counts.buildings;
          state.localRoadVertexCount = localMetadata.counts.roadVertices;
          state.localGpuResources = [this.terrainMesh, this.buildingMesh, this.roadMesh, this.landmarkMesh, this.settlementMesh]
            .reduce((total, mesh) => total + (mesh?.vao ? 1 : 0) + (mesh?.gpuBuffers?.length || 0), 0);
          return this;
        })();
        try {
          return await this.loadPromise;
        } catch (error) {
          this.release(false);
          state.localPackageStatus = 'error';
          state.localRequestedZoneId = zoneEntry.id;
          throw error;
        } finally {
          this.loadPromise = null;
          if (state.worldMode === 'regional') {
            scaleModeButton.disabled = false;
            const prefix = state.localPackageStatus === 'error' ? 'REINTENTAR ' : 'ENTRAR EN ';
            scaleModeButton.textContent = prefix + zoneEntry.name.split(' · ')[0].toUpperCase();
          }
        }
      },
      release(countRelease = true) {
        const hadPackage = Boolean(this.metadata || this.preview || this.terrainMesh || this.buildingMesh || this.roadMesh || this.landmarkMesh || this.settlementMesh);
        disposeMesh(gl, this.terrainMesh);
        disposeMesh(gl, this.buildingMesh);
        disposeMesh(gl, this.roadMesh);
        disposeMesh(gl, this.landmarkMesh);
        disposeMesh(gl, this.settlementMesh);
        this.zoneEntry = null;
        this.metadata = null;
        this.preview = null;
        this.terrainMesh = null;
        this.buildingMesh = null;
        this.roadMesh = null;
        this.landmarkMesh = null;
        this.settlementMesh = null;
        state.localPackageLoaded = false;
        state.localPackageStatus = 'unloaded';
        state.localPackageBuildId = null;
        state.localPackageBytes = 0;
        state.localTerrainColumns = 0;
        state.localTerrainRows = 0;
        state.localBuildingCount = 0;
        state.localRoadVertexCount = 0;
        state.localGpuResources = 0;
        if (countRelease && hadPackage) state.localPackageReleaseCount++;
      }
    };
    const characterMesh = createSphereGeometry(gl);`,
  'multi-zone local asset manager'
);

html = replaceOnce(
  html,
  `    const runtimeControls = setupControls(metadata, terrainMesh, preview, streamer, localAssets);`,
  `    const runtimeControls = setupControls(metadata, terrainMesh, preview, streamer, localAssets, localRegistry);`,
  'registry control wiring'
);

html = replaceOnce(
  html,
  `        const modeLabel = state.worldMode === 'local' ? 'LOCAL LLEVANT · PAQUETE ×' + state.worldScale : 'REGIONAL ×1';`,
  `        const localLabel = localAssets.metadata?.name?.split(' · ')[0]?.toUpperCase() || state.localZoneId?.toUpperCase() || 'ZONA';
        const modeLabel = state.worldMode === 'local' ? 'LOCAL ' + localLabel + ' · PAQUETE ×' + state.worldScale : 'REGIONAL ×1';`,
  'dynamic local HUD label'
);

html = replaceOnce(
  html,
  `          localGpuResources: state.localGpuResources,
          playerFacing: state.playerFacing,`,
  `          localGpuResources: state.localGpuResources,
          localRegistryLoaded: state.localRegistryLoaded,
          localRegistryBuildId: state.localRegistryBuildId,
          localZoneCount: state.localZoneCount,
          localRequestedZoneId: state.localRequestedZoneId,
          localLastLoadedZoneId: state.localLastLoadedZoneId,
          playerFacing: state.playerFacing,`,
  'periodic registry stats'
);

html = replaceOnce(
  html,
  `      enterLocal() { return runtimeControls.enterLocal(); },
      exitLocal() { return runtimeControls.exitLocal(); },
      toggleScale() { return state.worldMode === 'local' ? runtimeControls.exitLocal() : runtimeControls.enterLocal(); },`,
  `      enterLocal(zoneId = null) { return runtimeControls.enterLocal(zoneId); },
      exitLocal() { return runtimeControls.exitLocal(); },
      toggleScale(zoneId = null) { return state.worldMode === 'local' ? runtimeControls.exitLocal() : runtimeControls.enterLocal(zoneId); },`,
  'zone-selecting public transitions'
);

html = replaceOnce(
  html,
  `      getState() { const displayPosition = toDisplayXZ(state.camera.x, state.camera.z); return { position: { ...state.camera }, displayPosition: { x: displayPosition.x, y: state.camera.y, z: displayPosition.z }, cameraEye: { ...state.cameraEye }, cameraYaw: state.yaw, playerFacing: state.playerFacing, cameraMode: 'third-person', characterVisible: true, cameraBlocked: state.cameraBlocked, lateralControls: 'screen-relative', worldMode: state.worldMode, worldScale: state.worldScale, footprintScale: state.footprintScale, localCenter: { ...state.localCenter }, localRadius: state.localRadius, localZoneId: state.localZoneId, localPackageLoaded: state.localPackageLoaded, localPackageStatus: state.localPackageStatus, localPackageLoadCount: state.localPackageLoadCount, localPackageReleaseCount: state.localPackageReleaseCount, localPackageRequestCount: state.localPackageRequestCount, localGpuResources: state.localGpuResources, renderDataset: state.renderDataset, localPackageBuildId: state.localPackageBuildId, localPackageBytes: state.localPackageBytes, localTerrain: { columns: state.localTerrainColumns, rows: state.localTerrainRows }, localCounts: { buildings: state.localBuildingCount, roadVertices: state.localRoadVertexCount }, grounded: state.grounded, activeBuildings: state.activeBuildings, loadedCells: state.loadedCells, collisions: state.collisions, preset: state.activePreset }; },`,
  `      getState() { const displayPosition = toDisplayXZ(state.camera.x, state.camera.z); return { position: { ...state.camera }, displayPosition: { x: displayPosition.x, y: state.camera.y, z: displayPosition.z }, cameraEye: { ...state.cameraEye }, cameraYaw: state.yaw, playerFacing: state.playerFacing, cameraMode: 'third-person', characterVisible: true, cameraBlocked: state.cameraBlocked, lateralControls: 'screen-relative', worldMode: state.worldMode, worldScale: state.worldScale, footprintScale: state.footprintScale, localCenter: { ...state.localCenter }, localRadius: state.localRadius, localZoneId: state.localZoneId, localPackageLoaded: state.localPackageLoaded, localPackageStatus: state.localPackageStatus, localPackageLoadCount: state.localPackageLoadCount, localPackageReleaseCount: state.localPackageReleaseCount, localPackageRequestCount: state.localPackageRequestCount, localGpuResources: state.localGpuResources, localRegistryLoaded: state.localRegistryLoaded, localRegistryBuildId: state.localRegistryBuildId, localZoneCount: state.localZoneCount, localRequestedZoneId: state.localRequestedZoneId, localLastLoadedZoneId: state.localLastLoadedZoneId, renderDataset: state.renderDataset, localPackageBuildId: state.localPackageBuildId, localPackageBytes: state.localPackageBytes, localTerrain: { columns: state.localTerrainColumns, rows: state.localTerrainRows }, localCounts: { buildings: state.localBuildingCount, roadVertices: state.localRoadVertexCount }, grounded: state.grounded, activeBuildings: state.activeBuildings, loadedCells: state.loadedCells, collisions: state.collisions, preset: state.activePreset }; },`,
  'registry lifecycle state'
);

html = replaceOnce(
  html,
  `      metadata,
      get localMetadata() { return localAssets.metadata; }
    };`,
  `      metadata,
      localRegistry,
      availableZones: localRegistry.zones.map(zone => ({ id: zone.id, presetId: zone.presetId, name: zone.name, buildId: zone.buildId })),
      get localMetadata() { return localAssets.metadata; }
    };`,
  'public local-zone registry'
);

html = replaceOnce(
  html,
  `localGpuResources: state.localGpuResources, renderDataset: state.renderDataset`,
  `localGpuResources: state.localGpuResources, localRegistryLoaded: state.localRegistryLoaded, localRegistryBuildId: state.localRegistryBuildId, localZoneCount: state.localZoneCount, localRequestedZoneId: state.localRequestedZoneId, localLastLoadedZoneId: state.localLastLoadedZoneId, renderDataset: state.renderDataset`,
  'initial registry stats'
);

assert(!html.includes("localBase = `${base}local/llevant/`"), 'Runtime 007 still hardcodes the Llevant directory');
assert(!html.includes('CARGANDO LLEVANT…'), 'Runtime 007 still hardcodes the Llevant loading state');
assert(!html.includes("const llevant = playable.find"), 'Runtime 007 still hardcodes the Llevant preset');
assert(html.includes('zones-v1.json'), 'Runtime 007 does not load the local-zone registry');
assert(html.includes('zoneByPreset'), 'Runtime 007 has no preset-to-zone lookup');
assert(html.includes('async load(zoneEntry)'), 'Runtime 007 asset manager is not zone-aware');
assert(html.includes("version: '007'"), 'Runtime 007 API version is missing');
assert(html.includes('availableZones: localRegistry.zones.map'), 'Runtime 007 does not expose available zones');

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, html);
const outputBuffer = fs.readFileSync(outputPath);
const report = {
  formatVersion: 1,
  buildRevision: BUILD_REVISION,
  runtimeVersion: '007',
  source: path.relative(ROOT, sourcePath).replaceAll(path.sep, '/'),
  output: path.relative(ROOT, outputPath).replaceAll(path.sep, '/'),
  sourceSha256: sha256(fs.readFileSync(sourcePath)),
  outputSha256: sha256(outputBuffer),
  outputBytes: outputBuffer.length,
  behavior: {
    registryLoadsAtBoot: true,
    localPackagesLoadAtBoot: false,
    registeredZones: ['palma', 'llevant'],
    activePresetSelectsZone: true,
    previousZoneReleasesBeforeNextLoad: true,
    localGpuResourcesAreDeleted: true
  }
};
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
