import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const BUILD_REVISION = 1;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourcePath = path.join(ROOT, 'mallorca-mobile/region-runtime-baleares-005.html');
const outputPath = path.join(ROOT, 'mallorca-mobile/region-runtime-baleares-006.html');
const reportPath = path.join(ROOT, 'world-generator/baleares-runtime-006-build.json');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function replaceOnce(source, search, replacement, label) {
  const first = source.indexOf(search);
  assert(first >= 0, `Could not find ${label}`);
  assert(source.indexOf(search, first + search.length) < 0, `${label} is not unique`);
  return source.slice(0, first) + replacement + source.slice(first + search.length);
}

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

let html = fs.readFileSync(sourcePath, 'utf8');
html = html.replaceAll('Runtime regional de Baleares 005', 'Runtime regional de Baleares 006');
html = html.replaceAll('RUNTIME REGIONAL 005', 'RUNTIME REGIONAL 006');
html = html.replaceAll('__WAFT_RUNTIME_005_', '__WAFT_RUNTIME_006_');
html = html.replace("      version: '005',", "      version: '006',");

html = replaceOnce(
  html,
  `    localTerrainRows: 0,
    localBuildingCount: 0,
    localRoadVertexCount: 0`,
  `    localTerrainRows: 0,
    localBuildingCount: 0,
    localRoadVertexCount: 0,
    localPackageStatus: 'unloaded',
    localPackageLoadCount: 0,
    localPackageReleaseCount: 0,
    localPackageRequestCount: 0,
    localGpuResources: 0`,
  'on-demand package state'
);

html = replaceOnce(
  html,
  `  async function fetchBuffer(url) {
    const response = await fetch(\`${'${url}'}?v=${'${encodeURIComponent(cacheKey)}'}\`);
    if (!response.ok) throw new Error(\`${'${response.status}'} al descargar ${'${url}'}\`);
    return response.arrayBuffer();
  }
  async function fetchJson(url) {
    const response = await fetch(\`${'${url}'}?v=${'${encodeURIComponent(cacheKey)}'}\`);
    if (!response.ok) throw new Error(\`${'${response.status}'} al descargar ${'${url}'}\`);
    return response.json();
  }`,
  `  function versionedUrl(url, extra = '') {
    const separator = url.includes('?') ? '&' : '?';
    return \`${'${url}${separator}'}v=${'${encodeURIComponent(cacheKey)}'}${'${extra ? `&${extra}` : \'\'}'}\`;
  }
  async function fetchBuffer(url, extra = '') {
    const response = await fetch(versionedUrl(url, extra));
    if (!response.ok) throw new Error(\`${'${response.status}'} al descargar ${'${url}'}\`);
    return response.arrayBuffer();
  }
  async function fetchJson(url, extra = '') {
    const response = await fetch(versionedUrl(url, extra));
    if (!response.ok) throw new Error(\`${'${response.status}'} al descargar ${'${url}'}\`);
    return response.json();
  }`,
  'versioned fetch helpers'
);

html = replaceOnce(
  html,
  `  function buffer(gl, target, data, usage = gl.STATIC_DRAW) {
    const result = gl.createBuffer();
    gl.bindBuffer(target, result);
    gl.bufferData(target, data, usage);
    return result;
  }`,
  `  let bufferCapture = null;
  function buffer(gl, target, data, usage = gl.STATIC_DRAW) {
    const result = gl.createBuffer();
    if (bufferCapture) bufferCapture.push(result);
    gl.bindBuffer(target, result);
    gl.bufferData(target, data, usage);
    return result;
  }`,
  'captured WebGL buffers'
);

html = replaceOnce(
  html,
  `  function createBuildingStreamer(gl, mesh, records, cellSize = 36, radius = 2) {`,
  `  function captureMesh(factory) {
    const previousCapture = bufferCapture;
    const gpuBuffers = [];
    bufferCapture = gpuBuffers;
    try {
      const mesh = factory();
      mesh.gpuBuffers = gpuBuffers;
      return mesh;
    } finally {
      bufferCapture = previousCapture;
    }
  }
  function disposeMesh(gl, mesh) {
    if (!mesh) return 0;
    let released = 0;
    if (mesh.vao) { gl.deleteVertexArray(mesh.vao); released++; }
    for (const gpuBuffer of mesh.gpuBuffers || []) {
      if (gpuBuffer) { gl.deleteBuffer(gpuBuffer); released++; }
    }
    mesh.vao = null;
    mesh.gpuBuffers = [];
    return released;
  }

  function createBuildingStreamer(gl, mesh, records, cellSize = 36, radius = 2) {`,
  'local GPU resource lifecycle helpers'
);

html = replaceOnce(
  html,
  `    const exitLocal = () => {
      state.worldMode = 'regional';
      state.worldScale = 1;
      state.footprintScale = 1;
      state.localZoneId = null;
      state.renderDataset = 'regional-streamed';
      state.cameraDistance = 6.4;
      scaleModeButton.textContent = 'ENTRAR EN LLEVANT';
      scaleModeButton.classList.remove('active');
      streamer.update(state.camera.x, state.camera.z, true);
    };
    const enterLocal = () => {
      const llevant = playable.find(item => item.id === 'llevant' || item.name.toLowerCase().includes('llevant'));
      if (!llevant) throw new Error('La zona local de Llevant no está configurada.');
      if (!state.localPackageLoaded) throw new Error('El paquete local de Llevant no está cargado.');
      if (state.activePreset !== llevant.id) spawn(llevant);
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
      scaleModeButton.textContent = 'SALIR A REGIONAL';
      scaleModeButton.classList.add('active');
    };
    scaleModeButton.addEventListener('click', () => state.worldMode === 'local' ? exitLocal() : enterLocal());`,
  `    let localTransitionGeneration = 0;
    const exitLocal = () => {
      localTransitionGeneration++;
      state.worldMode = 'regional';
      state.worldScale = 1;
      state.footprintScale = 1;
      state.localZoneId = null;
      state.renderDataset = 'regional-streamed';
      state.cameraDistance = 6.4;
      scaleModeButton.textContent = 'ENTRAR EN LLEVANT';
      scaleModeButton.classList.remove('active');
      streamer.update(state.camera.x, state.camera.z, true);
      localAssets.release();
      return true;
    };
    const enterLocal = async () => {
      const transitionGeneration = ++localTransitionGeneration;
      const llevant = playable.find(item => item.id === 'llevant' || item.name.toLowerCase().includes('llevant'));
      if (!llevant) throw new Error('La zona local de Llevant no está configurada.');
      if (state.activePreset !== llevant.id) spawn(llevant);
      await localAssets.load();
      if (transitionGeneration !== localTransitionGeneration) {
        localAssets.release();
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
      scaleModeButton.disabled = false;
      scaleModeButton.textContent = 'SALIR A REGIONAL';
      scaleModeButton.classList.add('active');
      return true;
    };
    scaleModeButton.addEventListener('click', async () => {
      try {
        if (state.worldMode === 'local') exitLocal();
        else await enterLocal();
      } catch (error) {
        fail(error);
      }
    });`,
  'asynchronous local transition'
);

html = replaceOnce(
  html,
  `    const [metadata, localMetadata] = await Promise.all([
      fetchJson(\`${'${previewBase}'}baleares-preview-v1.json\`),
      fetchJson(\`${'${localBase}'}llevant-local-v1.json\`)
    ]);
    const [previewBuffer, terrainBuffer, landcoverBuffer, localBuffer] = await Promise.all([
      fetchBuffer(\`${'${previewBase}${metadata.binary.file}'}\`),
      fetchBuffer(\`${'${base}'}terrain.bin\`),
      fetchBuffer(\`${'${base}'}landcover.bin\`),
      fetchBuffer(\`${'${localBase}${localMetadata.binary.file}'}\`)
    ]);`,
  `    const metadata = await fetchJson(\`${'${previewBase}'}baleares-preview-v1.json\`);
    const [previewBuffer, terrainBuffer, landcoverBuffer] = await Promise.all([
      fetchBuffer(\`${'${previewBase}${metadata.binary.file}'}\`),
      fetchBuffer(\`${'${base}'}terrain.bin\`),
      fetchBuffer(\`${'${base}'}landcover.bin\`)
    ]);`,
  'regional-only boot downloads'
);

html = replaceOnce(
  html,
  `    const digest = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', previewBuffer)));
    if (digest !== metadata.binary.sha256) throw new Error('El paquete visual no coincide con su SHA-256.');
    const localDigest = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', localBuffer)));
    if (localDigest !== localMetadata.binary.sha256) throw new Error('El paquete local no coincide con su SHA-256.');
    const preview = parsePreview(previewBuffer);
    const localPreview = parseLocalZone(localBuffer);`,
  `    const digest = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', previewBuffer)));
    if (digest !== metadata.binary.sha256) throw new Error('El paquete visual no coincide con su SHA-256.');
    const preview = parsePreview(previewBuffer);`,
  'deferred local integrity check'
);

html = replaceOnce(
  html,
  `    const terrainMesh = createTerrainMesh(gl, terrain, landcover, metadata);
    const buildingMesh = createCubeGeometry(gl, new Float32Array(8));
    const streamer = createBuildingStreamer(gl, buildingMesh, preview.buildings);
    const roadMesh = createRoadGeometry(gl, preview.roads);
    const landmarkMesh = createPointGeometry(gl, preview.landmarks, 5);
    const settlementMesh = createPointGeometry(gl, preview.settlements, 4);
    const localRenderMetadata = { terrain: { localBounds: localMetadata.regionalBounds, verticalScale: metadata.terrain.verticalScale } };
    const localTerrainMesh = createTerrainMesh(gl, localPreview.terrain, localPreview.landcover, localRenderMetadata);
    const localBuildingMesh = createCubeGeometry(gl, localPreview.buildings);
    const localRoadMesh = createRoadGeometry(gl, localPreview.roads);
    const localLandmarkMesh = createPointGeometry(gl, localPreview.landmarks, 5);
    const localSettlementMesh = createPointGeometry(gl, localPreview.settlements, 4);
    const localAssets = {
      metadata: localMetadata,
      preview: localPreview,
      terrainMesh: localTerrainMesh,
      buildingMesh: localBuildingMesh,
      roadMesh: localRoadMesh,
      landmarkMesh: localLandmarkMesh,
      settlementMesh: localSettlementMesh
    };
    state.localPackageLoaded = true;
    state.localPackageBuildId = localMetadata.buildId;
    state.localPackageBytes = localMetadata.binary.bytes;
    state.localTerrainColumns = localMetadata.terrain.columns;
    state.localTerrainRows = localMetadata.terrain.rows;
    state.localBuildingCount = localMetadata.counts.buildings;
    state.localRoadVertexCount = localMetadata.counts.roadVertices;
    const characterMesh = createSphereGeometry(gl);`,
  `    const terrainMesh = createTerrainMesh(gl, terrain, landcover, metadata);
    const buildingMesh = createCubeGeometry(gl, new Float32Array(8));
    const streamer = createBuildingStreamer(gl, buildingMesh, preview.buildings);
    const roadMesh = createRoadGeometry(gl, preview.roads);
    const landmarkMesh = createPointGeometry(gl, preview.landmarks, 5);
    const settlementMesh = createPointGeometry(gl, preview.settlements, 4);
    const localAssets = {
      metadata: null,
      preview: null,
      terrainMesh: null,
      buildingMesh: null,
      roadMesh: null,
      landmarkMesh: null,
      settlementMesh: null,
      loadPromise: null,
      async load() {
        if (state.localPackageLoaded) return this;
        if (this.loadPromise) return this.loadPromise;
        const loadNumber = state.localPackageLoadCount + 1;
        const scaleModeButton = document.getElementById('scaleMode');
        state.localPackageStatus = 'loading';
        scaleModeButton.disabled = true;
        scaleModeButton.textContent = 'CARGANDO LLEVANT…';
        this.loadPromise = (async () => {
          state.localPackageRequestCount++;
          const localMetadata = await fetchJson(\`${'${localBase}'}llevant-local-v1.json\`, \`load=${'${loadNumber}'}\`);
          state.localPackageRequestCount++;
          const localBuffer = await fetchBuffer(\`${'${localBase}${localMetadata.binary.file}'}\`, \`load=${'${loadNumber}'}\`);
          const localDigest = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', localBuffer)));
          if (localDigest !== localMetadata.binary.sha256) throw new Error('El paquete local no coincide con su SHA-256.');
          const localPreview = parseLocalZone(localBuffer);
          const localRenderMetadata = { terrain: { localBounds: localMetadata.regionalBounds, verticalScale: metadata.terrain.verticalScale } };
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
          throw error;
        } finally {
          this.loadPromise = null;
          if (state.worldMode === 'regional') {
            scaleModeButton.disabled = false;
            scaleModeButton.textContent = state.localPackageStatus === 'error' ? 'REINTENTAR LLEVANT' : 'ENTRAR EN LLEVANT';
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
  'on-demand local asset manager'
);

html = html.replaceAll("state.worldMode === 'local' ? localTerrainMesh : terrainMesh", "state.worldMode === 'local' ? localAssets.terrainMesh : terrainMesh");
html = html.replaceAll("state.worldMode === 'local' ? localPreview.buildings : streamer.active", "state.worldMode === 'local' ? localAssets.preview.buildings : streamer.active");
html = html.replaceAll("state.worldMode === 'local' ? localPreview : preview", "state.worldMode === 'local' ? localAssets.preview : preview");
html = html.replaceAll("state.worldMode === 'local' ? localMetadata.labels.landmarks : metadata.landmarks", "state.worldMode === 'local' ? localAssets.metadata.labels.landmarks : metadata.landmarks");
html = html.replaceAll("state.worldMode === 'local' ? localMetadata.labels.settlements : metadata.settlements", "state.worldMode === 'local' ? localAssets.metadata.labels.settlements : metadata.settlements");
html = html.replaceAll("localMetadata.counts.buildings", "localAssets.metadata.counts.buildings");
html = html.replaceAll("state.worldMode === 'local' ? localRoadMesh : roadMesh", "state.worldMode === 'local' ? localAssets.roadMesh : roadMesh");
html = html.replaceAll("state.worldMode === 'local' ? localBuildingMesh : buildingMesh", "state.worldMode === 'local' ? localAssets.buildingMesh : buildingMesh");
html = html.replaceAll("state.worldMode === 'local' ? localLandmarkMesh : landmarkMesh", "state.worldMode === 'local' ? localAssets.landmarkMesh : landmarkMesh");
html = html.replaceAll("state.worldMode === 'local' ? localSettlementMesh : settlementMesh", "state.worldMode === 'local' ? localAssets.settlementMesh : settlementMesh");

html = replaceOnce(
  html,
  `          localRoadVertexCount: state.localRoadVertexCount,
          playerFacing: state.playerFacing,`,
  `          localRoadVertexCount: state.localRoadVertexCount,
          localPackageStatus: state.localPackageStatus,
          localPackageLoadCount: state.localPackageLoadCount,
          localPackageReleaseCount: state.localPackageReleaseCount,
          localPackageRequestCount: state.localPackageRequestCount,
          localGpuResources: state.localGpuResources,
          playerFacing: state.playerFacing,`,
  'runtime stats lifecycle fields'
);

html = replaceOnce(
  html,
  `      enterLocal() { runtimeControls.enterLocal(); },
      exitLocal() { runtimeControls.exitLocal(); },
      toggleScale() { state.worldMode === 'local' ? runtimeControls.exitLocal() : runtimeControls.enterLocal(); },`,
  `      enterLocal() { return runtimeControls.enterLocal(); },
      exitLocal() { return runtimeControls.exitLocal(); },
      toggleScale() { return state.worldMode === 'local' ? runtimeControls.exitLocal() : runtimeControls.enterLocal(); },`,
  'promise-returning runtime transitions'
);

html = replaceOnce(
  html,
  `      getState() { const displayPosition = toDisplayXZ(state.camera.x, state.camera.z); return { position: { ...state.camera }, displayPosition: { x: displayPosition.x, y: state.camera.y, z: displayPosition.z }, cameraEye: { ...state.cameraEye }, cameraYaw: state.yaw, playerFacing: state.playerFacing, cameraMode: 'third-person', characterVisible: true, cameraBlocked: state.cameraBlocked, lateralControls: 'screen-relative', worldMode: state.worldMode, worldScale: state.worldScale, footprintScale: state.footprintScale, localCenter: { ...state.localCenter }, localRadius: state.localRadius, localZoneId: state.localZoneId, localPackageLoaded: state.localPackageLoaded, renderDataset: state.renderDataset, localPackageBuildId: state.localPackageBuildId, localPackageBytes: state.localPackageBytes, localTerrain: { columns: state.localTerrainColumns, rows: state.localTerrainRows }, localCounts: { buildings: state.localBuildingCount, roadVertices: state.localRoadVertexCount }, grounded: state.grounded, activeBuildings: state.activeBuildings, loadedCells: state.loadedCells, collisions: state.collisions, preset: state.activePreset }; },`,
  `      getState() { const displayPosition = toDisplayXZ(state.camera.x, state.camera.z); return { position: { ...state.camera }, displayPosition: { x: displayPosition.x, y: state.camera.y, z: displayPosition.z }, cameraEye: { ...state.cameraEye }, cameraYaw: state.yaw, playerFacing: state.playerFacing, cameraMode: 'third-person', characterVisible: true, cameraBlocked: state.cameraBlocked, lateralControls: 'screen-relative', worldMode: state.worldMode, worldScale: state.worldScale, footprintScale: state.footprintScale, localCenter: { ...state.localCenter }, localRadius: state.localRadius, localZoneId: state.localZoneId, localPackageLoaded: state.localPackageLoaded, localPackageStatus: state.localPackageStatus, localPackageLoadCount: state.localPackageLoadCount, localPackageReleaseCount: state.localPackageReleaseCount, localPackageRequestCount: state.localPackageRequestCount, localGpuResources: state.localGpuResources, renderDataset: state.renderDataset, localPackageBuildId: state.localPackageBuildId, localPackageBytes: state.localPackageBytes, localTerrain: { columns: state.localTerrainColumns, rows: state.localTerrainRows }, localCounts: { buildings: state.localBuildingCount, roadVertices: state.localRoadVertexCount }, grounded: state.grounded, activeBuildings: state.activeBuildings, loadedCells: state.loadedCells, collisions: state.collisions, preset: state.activePreset }; },`,
  'runtime lifecycle state'
);

html = replaceOnce(
  html,
  `      metadata,
      localMetadata
    };`,
  `      metadata,
      get localMetadata() { return localAssets.metadata; }
    };`,
  'dynamic local metadata getter'
);

html = replaceOnce(
  html,
  `    window.__WAFT_RUNTIME_006_STATS__ = { totalBuildings: metadata.counts.buildings, activeBuildings: state.activeBuildings, loadedCells: state.loadedCells, collisions: 0, grounded: true, cameraMode: 'third-person', characterVisible: true, lateralControls: 'screen-relative', worldMode: state.worldMode, worldScale: state.worldScale, footprintScale: state.footprintScale, localZoneId: state.localZoneId, localPackageLoaded: state.localPackageLoaded, renderDataset: state.renderDataset, localPackageBuildId: state.localPackageBuildId, localPackageBytes: state.localPackageBytes, localTerrainColumns: state.localTerrainColumns, localTerrainRows: state.localTerrainRows, localBuildingCount: state.localBuildingCount, localRoadVertexCount: state.localRoadVertexCount, playerFacing: state.playerFacing, cameraBlocked: state.cameraBlocked, cameraEye: { ...state.cameraEye }, webgl2: true, buildId: metadata.buildId, binarySha256: metadata.binary.sha256, position: { ...state.camera } };`,
  `    window.__WAFT_RUNTIME_006_STATS__ = { totalBuildings: metadata.counts.buildings, activeBuildings: state.activeBuildings, loadedCells: state.loadedCells, collisions: 0, grounded: true, cameraMode: 'third-person', characterVisible: true, lateralControls: 'screen-relative', worldMode: state.worldMode, worldScale: state.worldScale, footprintScale: state.footprintScale, localZoneId: state.localZoneId, localPackageLoaded: state.localPackageLoaded, localPackageStatus: state.localPackageStatus, localPackageLoadCount: state.localPackageLoadCount, localPackageReleaseCount: state.localPackageReleaseCount, localPackageRequestCount: state.localPackageRequestCount, localGpuResources: state.localGpuResources, renderDataset: state.renderDataset, localPackageBuildId: state.localPackageBuildId, localPackageBytes: state.localPackageBytes, localTerrainColumns: state.localTerrainColumns, localTerrainRows: state.localTerrainRows, localBuildingCount: state.localBuildingCount, localRoadVertexCount: state.localRoadVertexCount, playerFacing: state.playerFacing, cameraBlocked: state.cameraBlocked, cameraEye: { ...state.cameraEye }, webgl2: true, buildId: metadata.buildId, binarySha256: metadata.binary.sha256, position: { ...state.camera } };`,
  'initial lifecycle stats'
);

assert(!html.includes('const [metadata, localMetadata]'), 'Runtime 006 still preloads local metadata');
assert(!html.includes('const localPreview = parseLocalZone(localBuffer);\n    const terrain'), 'Runtime 006 still parses the local package during boot');
assert(html.includes("localPackageStatus: 'unloaded'"), 'Runtime 006 does not start unloaded');
assert(html.includes("scaleModeButton.textContent = 'CARGANDO LLEVANT…'"), 'Runtime 006 has no visible loading state');
assert(html.includes('localAssets.release();'), 'Runtime 006 does not release local assets');
assert(html.includes('disposeMesh(gl, this.terrainMesh);'), 'Runtime 006 does not delete local GPU resources');
assert(html.includes("version: '006'"), 'Runtime 006 API version is missing');

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, html);
const outputBuffer = fs.readFileSync(outputPath);
const report = {
  formatVersion: 1,
  buildRevision: BUILD_REVISION,
  runtimeVersion: '006',
  source: path.relative(ROOT, sourcePath).replaceAll(path.sep, '/'),
  output: path.relative(ROOT, outputPath).replaceAll(path.sep, '/'),
  sourceSha256: sha256(fs.readFileSync(sourcePath)),
  outputSha256: sha256(outputBuffer),
  outputBytes: outputBuffer.length,
  behavior: {
    bootLoadsLocalPackage: false,
    enterLoadsLocalPackage: true,
    exitReleasesLocalPackage: true,
    deletesLocalWebglResources: true,
    preservesRegionalPosition: true
  }
};
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
