import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const BUILD_REVISION = 1;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourcePath = path.join(ROOT, 'mallorca-mobile/region-runtime-baleares-004.html');
const outputPath = path.join(ROOT, 'mallorca-mobile/region-runtime-baleares-005.html');
const reportPath = path.join(ROOT, 'world-generator/baleares-runtime-005-build.json');

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
html = html.replaceAll('Runtime regional de Baleares 004', 'Runtime regional de Baleares 005');
html = html.replaceAll('RUNTIME REGIONAL 004', 'RUNTIME REGIONAL 005');
html = html.replaceAll('__WAFT_RUNTIME_004_', '__WAFT_RUNTIME_005_');

html = replaceOnce(
  html,
  "  const previewBase = `${base}preview/`;",
  "  const previewBase = `${base}preview/`;\n  const localBase = `${base}local/llevant/`;",
  'local package base path'
);

html = replaceOnce(
  html,
  "    localRadius: 18,\n    localZoneId: null",
  "    localRadius: 18,\n    localZoneId: null,\n    localPackageLoaded: false,\n    renderDataset: 'regional-streamed',\n    localPackageBuildId: null,\n    localPackageBytes: 0,\n    localTerrainColumns: 0,\n    localTerrainRows: 0,\n    localBuildingCount: 0,\n    localRoadVertexCount: 0",
  'local package runtime state'
);

html = replaceOnce(
  html,
  `  function parseLandcover(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    const magic = new TextDecoder().decode(new Uint8Array(arrayBuffer, 0, 8));
    if (magic !== 'WAFTLCV1') throw new Error(\`Cobertura desconocida: \${magic}\`);
    const columns = view.getUint16(12, true), rows = view.getUint16(14, true), headerBytes = view.getUint16(10, true);
    return { columns, rows, classes: new Uint8Array(arrayBuffer, headerBytes, columns * rows) };
  }
`,
  `  function parseLandcover(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    const magic = new TextDecoder().decode(new Uint8Array(arrayBuffer, 0, 8));
    if (magic !== 'WAFTLCV1') throw new Error(\`Cobertura desconocida: \${magic}\`);
    const columns = view.getUint16(12, true), rows = view.getUint16(14, true), headerBytes = view.getUint16(10, true);
    return { columns, rows, classes: new Uint8Array(arrayBuffer, headerBytes, columns * rows) };
  }
  function parseLocalZone(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    const magic = new TextDecoder().decode(new Uint8Array(arrayBuffer, 0, 8));
    if (magic !== 'WAFTLZ01') throw new Error(\`Paquete local desconocido: \${magic}\`);
    const header = {
      version: view.getUint16(8, true), headerBytes: view.getUint16(10, true),
      columns: view.getUint16(12, true), rows: view.getUint16(14, true),
      buildingCount: view.getUint32(16, true), roadVertexCount: view.getUint32(20, true),
      landmarkCount: view.getUint32(24, true), settlementCount: view.getUint32(28, true),
      terrainOffset: view.getUint32(32, true), landcoverOffset: view.getUint32(36, true),
      buildingOffset: view.getUint32(40, true), roadOffset: view.getUint32(44, true),
      landmarkOffset: view.getUint32(48, true), settlementOffset: view.getUint32(52, true),
      buildingStride: view.getUint16(56, true), roadStride: view.getUint16(58, true),
      landmarkStride: view.getUint16(60, true), settlementStride: view.getUint16(62, true),
      totalBytes: view.getUint32(64, true), terrainCells: view.getUint32(68, true),
      nodata: view.getInt32(72, true), floatAlignmentPadding: view.getUint32(76, true)
    };
    if (header.version !== 1 || header.headerBytes !== 80 || header.totalBytes !== arrayBuffer.byteLength) throw new Error('El paquete local está incompleto.');
    if (header.buildingOffset % 4 !== 0 || header.roadOffset % 4 !== 0 || header.landmarkOffset % 4 !== 0 || header.settlementOffset % 4 !== 0) throw new Error('El paquete local no está alineado.');
    return {
      header,
      terrain: { columns: header.columns, rows: header.rows, nodata: header.nodata, elevations: new Int16Array(arrayBuffer, header.terrainOffset, header.terrainCells) },
      landcover: { columns: header.columns, rows: header.rows, classes: new Uint8Array(arrayBuffer, header.landcoverOffset, header.terrainCells) },
      buildings: new Float32Array(arrayBuffer, header.buildingOffset, header.buildingCount * header.buildingStride),
      roads: new Float32Array(arrayBuffer, header.roadOffset, header.roadVertexCount * header.roadStride),
      landmarks: new Float32Array(arrayBuffer, header.landmarkOffset, header.landmarkCount * header.landmarkStride),
      settlements: new Float32Array(arrayBuffer, header.settlementOffset, header.settlementCount * header.settlementStride)
    };
  }
`,
  'local package parser'
);

html = replaceOnce(
  html,
  '  function setupControls(metadata, terrainMesh, preview, streamer) {',
  '  function setupControls(metadata, terrainMesh, preview, streamer, localAssets) {',
  'local assets control signature'
);

html = replaceOnce(
  html,
  `    const terrainAt = (x, z) => {
      const bounds = terrainMesh.bounds;
      const fx = (x - bounds.minX) / (bounds.maxX - bounds.minX) * (terrainMesh.columns - 1);
      const fz = (z - bounds.minZ) / (bounds.maxZ - bounds.minZ) * (terrainMesh.rows - 1);
      if (fx < 0 || fz < 0 || fx > terrainMesh.columns - 1 || fz > terrainMesh.rows - 1) return null;
      const column = Math.max(0, Math.min(terrainMesh.columns - 1, Math.round(fx)));
      const row = Math.max(0, Math.min(terrainMesh.rows - 1, Math.round(fz)));
      const value = terrainMesh.elevations[row * terrainMesh.columns + column];
      return value === terrainMesh.nodata ? null : value * terrainMesh.verticalScale;
    };`,
  `    const terrainAt = (x, z) => {
      const sourceTerrain = state.worldMode === 'local' ? localAssets.terrainMesh : terrainMesh;
      const bounds = sourceTerrain.bounds;
      const fx = (x - bounds.minX) / (bounds.maxX - bounds.minX) * (sourceTerrain.columns - 1);
      const fz = (z - bounds.minZ) / (bounds.maxZ - bounds.minZ) * (sourceTerrain.rows - 1);
      if (fx < 0 || fz < 0 || fx > sourceTerrain.columns - 1 || fz > sourceTerrain.rows - 1) return null;
      const column = Math.max(0, Math.min(sourceTerrain.columns - 1, Math.round(fx)));
      const row = Math.max(0, Math.min(sourceTerrain.rows - 1, Math.round(fz)));
      const value = sourceTerrain.elevations[row * sourceTerrain.columns + column];
      return value === sourceTerrain.nodata ? null : value * sourceTerrain.verticalScale;
    };`,
  'scale-aware control terrain source'
);

html = replaceOnce(
  html,
  '      const records = streamer.active;\n      const exaggeration = metadata.display.buildingHorizontalExaggeration;',
  "      const records = state.worldMode === 'local' ? localAssets.preview.buildings : streamer.active;\n      const exaggeration = metadata.display.buildingHorizontalExaggeration;",
  'local safe-spawn building records'
);

html = replaceOnce(
  html,
  '          streamer.update(x, z, true);\n          const terrain = terrainAt(x, z);',
  "          if (state.worldMode === 'regional') streamer.update(x, z, true);\n          const terrain = terrainAt(x, z);",
  'conditional safe-spawn streamer update'
);

html = replaceOnce(
  html,
  '      streamer.update(state.camera.x, state.camera.z, true);\n    };\n    const exitLocal = () => {',
  "      if (state.worldMode === 'regional') streamer.update(state.camera.x, state.camera.z, true);\n    };\n    const exitLocal = () => {",
  'conditional spawn streamer update'
);

html = replaceOnce(
  html,
  `    const exitLocal = () => {
      state.worldMode = 'regional';
      state.worldScale = 1;
      state.footprintScale = 1;
      state.localZoneId = null;
      state.cameraDistance = 6.4;
      scaleModeButton.textContent = 'ENTRAR EN LLEVANT';
      scaleModeButton.classList.remove('active');
      streamer.update(state.camera.x, state.camera.z, true);
    };
    const enterLocal = () => {
      const llevant = playable.find(item => item.id === 'llevant' || item.name.toLowerCase().includes('llevant'));
      if (!llevant) throw new Error('La zona local de Llevant no está configurada.');
      if (state.activePreset !== llevant.id) spawn(llevant);
      state.localCenter.x = state.camera.x;
      state.localCenter.z = state.camera.z;
      state.localZoneId = 'llevant';
      state.worldMode = 'local';
      state.worldScale = 12;
      state.footprintScale = 4;
      state.cameraDistance = 7.2;
      scaleModeButton.textContent = 'SALIR A REGIONAL';
      scaleModeButton.classList.add('active');
      streamer.update(state.camera.x, state.camera.z, true);
    };`,
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
    };`,
  'local package mode transition'
);

html = replaceOnce(
  html,
  `    const metadata = await fetchJson(\`${'${previewBase}'}baleares-preview-v1.json\`);
    const [previewBuffer, terrainBuffer, landcoverBuffer] = await Promise.all([
      fetchBuffer(\`${'${previewBase}${metadata.binary.file}'}\`),
      fetchBuffer(\`${'${base}'}terrain.bin\`),
      fetchBuffer(\`${'${base}'}landcover.bin\`)
    ]);`,
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
  'local package downloads'
);

html = replaceOnce(
  html,
  `    const digest = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', previewBuffer)));
    if (digest !== metadata.binary.sha256) throw new Error('El paquete visual no coincide con su SHA-256.');
    const preview = parsePreview(previewBuffer);`,
  `    const digest = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', previewBuffer)));
    if (digest !== metadata.binary.sha256) throw new Error('El paquete visual no coincide con su SHA-256.');
    const localDigest = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', localBuffer)));
    if (localDigest !== localMetadata.binary.sha256) throw new Error('El paquete local no coincide con su SHA-256.');
    const preview = parsePreview(previewBuffer);
    const localPreview = parseLocalZone(localBuffer);`,
  'local package integrity and parse'
);

html = replaceOnce(
  html,
  `    const terrainMesh = createTerrainMesh(gl, terrain, landcover, metadata);
    const buildingMesh = createCubeGeometry(gl, new Float32Array(8));
    const streamer = createBuildingStreamer(gl, buildingMesh, preview.buildings);
    const roadMesh = createRoadGeometry(gl, preview.roads);
    const landmarkMesh = createPointGeometry(gl, preview.landmarks, 5);
    const settlementMesh = createPointGeometry(gl, preview.settlements, 4);
    const characterMesh = createSphereGeometry(gl);`,
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
  'local package GPU assets'
);

html = replaceOnce(
  html,
  '    const runtimeControls = setupControls(metadata, terrainMesh, preview, streamer);',
  '    const runtimeControls = setupControls(metadata, terrainMesh, preview, streamer, localAssets);',
  'local package controls call'
);

html = replaceOnce(
  html,
  `    const sampleTerrainInfo = (x, z) => {
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
    };`,
  `    const sampleTerrainInfo = (x, z) => {
      const sourceTerrain = state.worldMode === 'local' ? localTerrainMesh : terrainMesh;
      const bounds = sourceTerrain.bounds;
      const fx = (x - bounds.minX) / (bounds.maxX - bounds.minX) * (sourceTerrain.columns - 1);
      const fz = (z - bounds.minZ) / (bounds.maxZ - bounds.minZ) * (sourceTerrain.rows - 1);
      if (fx < 0 || fz < 0 || fx > sourceTerrain.columns - 1 || fz > sourceTerrain.rows - 1) return { land: false, height: 0 };
      const column = Math.max(0, Math.min(sourceTerrain.columns - 1, Math.round(fx)));
      const row = Math.max(0, Math.min(sourceTerrain.rows - 1, Math.round(fz)));
      const value = sourceTerrain.elevations[row * sourceTerrain.columns + column];
      return value === sourceTerrain.nodata
        ? { land: false, height: 0 }
        : { land: true, height: value * sourceTerrain.verticalScale };
    };`,
  'local physics terrain source'
);

html = replaceOnce(
  html,
  '      const records = streamer.active;\n      const exaggeration = metadata.display.buildingHorizontalExaggeration;\n      const radius = .34;',
  "      const records = state.worldMode === 'local' ? localPreview.buildings : streamer.active;\n      const exaggeration = metadata.display.buildingHorizontalExaggeration;\n      const radius = .34;",
  'local collision building records'
);

html = replaceOnce(
  html,
  `    const nearestUpdate = () => {
      let best = null;
      for (let index=0;index<preview.header.landmarkCount;index++) {
        const offset=index*5, dx=preview.landmarks[offset]-state.camera.x, dz=preview.landmarks[offset+2]-state.camera.z, distance=Math.hypot(dx,dz);
        if (!best||distance<best.distance) best={distance:distance*state.worldScale,name:metadata.landmarks[index]?.name||'Monumento',kind:'monumento'};
      }
      for (let index=0;index<preview.header.settlementCount;index++) {
        const offset=index*4, dx=preview.settlements[offset]-state.camera.x, dz=preview.settlements[offset+2]-state.camera.z, distance=Math.hypot(dx,dz);
        const displayDistance=distance*state.worldScale;
        if (!best||displayDistance<best.distance) best={distance:displayDistance,name:metadata.settlements[index]?.name||'Población',kind:'población'};
      }
      nearestText.textContent = best ? \`Cerca: \${best.name} · \${best.distance.toFixed(1)} u \${state.worldMode === 'local' ? 'locales' : 'regionales'}\` : '';
    };`,
  `    const nearestUpdate = () => {
      const sourcePreview = state.worldMode === 'local' ? localPreview : preview;
      const landmarkLabels = state.worldMode === 'local' ? localMetadata.labels.landmarks : metadata.landmarks;
      const settlementLabels = state.worldMode === 'local' ? localMetadata.labels.settlements : metadata.settlements;
      let best = null;
      for (let index=0;index<sourcePreview.header.landmarkCount;index++) {
        const offset=index*5, dx=sourcePreview.landmarks[offset]-state.camera.x, dz=sourcePreview.landmarks[offset+2]-state.camera.z, distance=Math.hypot(dx,dz);
        if (!best||distance<best.distance) best={distance:distance*state.worldScale,name:landmarkLabels[index]?.name||'Monumento',kind:'monumento'};
      }
      for (let index=0;index<sourcePreview.header.settlementCount;index++) {
        const offset=index*4, dx=sourcePreview.settlements[offset]-state.camera.x, dz=sourcePreview.settlements[offset+2]-state.camera.z, distance=Math.hypot(dx,dz);
        const displayDistance=distance*state.worldScale;
        if (!best||displayDistance<best.distance) best={distance:displayDistance,name:settlementLabels[index]?.name||'Población',kind:'población'};
      }
      nearestText.textContent = best ? \`Cerca: \${best.name} · \${best.distance.toFixed(1)} u \${state.worldMode === 'local' ? 'locales' : 'regionales'}\` : '';
    };`,
  'local nearest-source selection'
);

html = replaceOnce(
  html,
  '      streamer.update(state.camera.x, state.camera.z);',
  "      if (state.worldMode === 'regional') streamer.update(state.camera.x, state.camera.z);\n      else { state.activeBuildings = localMetadata.counts.buildings; state.loadedCells = 1; }",
  'local dataset movement update'
);

html = replaceOnce(
  html,
  '      const bounds = terrainMesh.bounds;\n      state.camera.x = Math.max(bounds.minX, Math.min(bounds.maxX, state.camera.x));',
  "      const activeTerrain = state.worldMode === 'local' ? localTerrainMesh : terrainMesh;\n      const bounds = activeTerrain.bounds;\n      state.camera.x = Math.max(bounds.minX, Math.min(bounds.maxX, state.camera.x));",
  'active terrain bounds'
);

html = replaceOnce(
  html,
  `      if (state.terrain) { gl.useProgram(terrainProgram); gl.uniformMatrix4fv(gl.getUniformLocation(terrainProgram,'uPV'),false,pv); gl.uniform1f(gl.getUniformLocation(terrainProgram,'uVerticalScale'),terrainMesh.verticalScale); gl.uniform2f(gl.getUniformLocation(terrainProgram,'uWorldCenter'),state.localCenter.x,state.localCenter.z); gl.uniform1f(gl.getUniformLocation(terrainProgram,'uWorldScale'),state.worldScale); gl.uniform3f(gl.getUniformLocation(terrainProgram,'uCamera'),...eye); gl.bindVertexArray(terrainMesh.vao); gl.drawElements(gl.TRIANGLES,terrainMesh.count,gl.UNSIGNED_INT,0); }
      if (state.roads) { gl.useProgram(roadProgram); gl.uniformMatrix4fv(gl.getUniformLocation(roadProgram,'uPV'),false,pv); gl.uniform1f(gl.getUniformLocation(roadProgram,'uTerrainScale'),terrainMesh.verticalScale); gl.uniform1f(gl.getUniformLocation(roadProgram,'uLift'),metadata.display.roadLift); gl.uniform2f(gl.getUniformLocation(roadProgram,'uWorldCenter'),state.localCenter.x,state.localCenter.z); gl.uniform1f(gl.getUniformLocation(roadProgram,'uWorldScale'),state.worldScale); gl.bindVertexArray(roadMesh.vao); gl.drawArrays(gl.LINES,0,roadMesh.count); }
      if (state.buildings) { gl.useProgram(buildingProgram); gl.uniformMatrix4fv(gl.getUniformLocation(buildingProgram,'uPV'),false,pv); gl.uniform1f(gl.getUniformLocation(buildingProgram,'uTerrainScale'),terrainMesh.verticalScale); gl.uniform1f(gl.getUniformLocation(buildingProgram,'uBuildingScale'),metadata.display.buildingVerticalScale); gl.uniform1f(gl.getUniformLocation(buildingProgram,'uHorizontalExaggeration'),metadata.display.buildingHorizontalExaggeration); gl.uniform2f(gl.getUniformLocation(buildingProgram,'uWorldCenter'),state.localCenter.x,state.localCenter.z); gl.uniform1f(gl.getUniformLocation(buildingProgram,'uWorldScale'),state.worldScale); gl.uniform1f(gl.getUniformLocation(buildingProgram,'uFootprintScale'),state.footprintScale); gl.uniform3f(gl.getUniformLocation(buildingProgram,'uCamera'),...eye); gl.uniform1i(gl.getUniformLocation(buildingProgram,'uShowHotels'),state.hotels?1:0); gl.bindVertexArray(buildingMesh.vao); gl.drawElementsInstanced(gl.TRIANGLES,buildingMesh.indexCount,gl.UNSIGNED_SHORT,0,buildingMesh.instanceCount); }
      if (state.landmarks) { gl.useProgram(landmarkProgram); gl.uniformMatrix4fv(gl.getUniformLocation(landmarkProgram,'uPV'),false,pv); gl.uniform1f(gl.getUniformLocation(landmarkProgram,'uTerrainScale'),terrainMesh.verticalScale); gl.uniform1f(gl.getUniformLocation(landmarkProgram,'uLift'),metadata.display.landmarkLift); gl.uniform2f(gl.getUniformLocation(landmarkProgram,'uWorldCenter'),state.localCenter.x,state.localCenter.z); gl.uniform1f(gl.getUniformLocation(landmarkProgram,'uWorldScale'),state.worldScale); gl.bindVertexArray(landmarkMesh.vao); gl.drawArrays(gl.POINTS,0,landmarkMesh.count); }
      if (state.settlements) { gl.useProgram(settlementProgram); gl.uniformMatrix4fv(gl.getUniformLocation(settlementProgram,'uPV'),false,pv); gl.uniform1f(gl.getUniformLocation(settlementProgram,'uTerrainScale'),terrainMesh.verticalScale); gl.uniform2f(gl.getUniformLocation(settlementProgram,'uWorldCenter'),state.localCenter.x,state.localCenter.z); gl.uniform1f(gl.getUniformLocation(settlementProgram,'uWorldScale'),state.worldScale); gl.bindVertexArray(settlementMesh.vao); gl.drawArrays(gl.POINTS,0,settlementMesh.count); }`,
  `      const activeRoadMesh = state.worldMode === 'local' ? localRoadMesh : roadMesh;
      const activeBuildingMesh = state.worldMode === 'local' ? localBuildingMesh : buildingMesh;
      const activeLandmarkMesh = state.worldMode === 'local' ? localLandmarkMesh : landmarkMesh;
      const activeSettlementMesh = state.worldMode === 'local' ? localSettlementMesh : settlementMesh;
      if (state.terrain) { gl.useProgram(terrainProgram); gl.uniformMatrix4fv(gl.getUniformLocation(terrainProgram,'uPV'),false,pv); gl.uniform1f(gl.getUniformLocation(terrainProgram,'uVerticalScale'),activeTerrain.verticalScale); gl.uniform2f(gl.getUniformLocation(terrainProgram,'uWorldCenter'),state.localCenter.x,state.localCenter.z); gl.uniform1f(gl.getUniformLocation(terrainProgram,'uWorldScale'),state.worldScale); gl.uniform3f(gl.getUniformLocation(terrainProgram,'uCamera'),...eye); gl.bindVertexArray(activeTerrain.vao); gl.drawElements(gl.TRIANGLES,activeTerrain.count,gl.UNSIGNED_INT,0); }
      if (state.roads) { gl.useProgram(roadProgram); gl.uniformMatrix4fv(gl.getUniformLocation(roadProgram,'uPV'),false,pv); gl.uniform1f(gl.getUniformLocation(roadProgram,'uTerrainScale'),activeTerrain.verticalScale); gl.uniform1f(gl.getUniformLocation(roadProgram,'uLift'),metadata.display.roadLift); gl.uniform2f(gl.getUniformLocation(roadProgram,'uWorldCenter'),state.localCenter.x,state.localCenter.z); gl.uniform1f(gl.getUniformLocation(roadProgram,'uWorldScale'),state.worldScale); gl.bindVertexArray(activeRoadMesh.vao); gl.drawArrays(gl.LINES,0,activeRoadMesh.count); }
      if (state.buildings) { gl.useProgram(buildingProgram); gl.uniformMatrix4fv(gl.getUniformLocation(buildingProgram,'uPV'),false,pv); gl.uniform1f(gl.getUniformLocation(buildingProgram,'uTerrainScale'),activeTerrain.verticalScale); gl.uniform1f(gl.getUniformLocation(buildingProgram,'uBuildingScale'),metadata.display.buildingVerticalScale); gl.uniform1f(gl.getUniformLocation(buildingProgram,'uHorizontalExaggeration'),metadata.display.buildingHorizontalExaggeration); gl.uniform2f(gl.getUniformLocation(buildingProgram,'uWorldCenter'),state.localCenter.x,state.localCenter.z); gl.uniform1f(gl.getUniformLocation(buildingProgram,'uWorldScale'),state.worldScale); gl.uniform1f(gl.getUniformLocation(buildingProgram,'uFootprintScale'),state.footprintScale); gl.uniform3f(gl.getUniformLocation(buildingProgram,'uCamera'),...eye); gl.uniform1i(gl.getUniformLocation(buildingProgram,'uShowHotels'),state.hotels?1:0); gl.bindVertexArray(activeBuildingMesh.vao); gl.drawElementsInstanced(gl.TRIANGLES,activeBuildingMesh.indexCount,gl.UNSIGNED_SHORT,0,activeBuildingMesh.instanceCount); }
      if (state.landmarks) { gl.useProgram(landmarkProgram); gl.uniformMatrix4fv(gl.getUniformLocation(landmarkProgram,'uPV'),false,pv); gl.uniform1f(gl.getUniformLocation(landmarkProgram,'uTerrainScale'),activeTerrain.verticalScale); gl.uniform1f(gl.getUniformLocation(landmarkProgram,'uLift'),metadata.display.landmarkLift); gl.uniform2f(gl.getUniformLocation(landmarkProgram,'uWorldCenter'),state.localCenter.x,state.localCenter.z); gl.uniform1f(gl.getUniformLocation(landmarkProgram,'uWorldScale'),state.worldScale); gl.bindVertexArray(activeLandmarkMesh.vao); gl.drawArrays(gl.POINTS,0,activeLandmarkMesh.count); }
      if (state.settlements) { gl.useProgram(settlementProgram); gl.uniformMatrix4fv(gl.getUniformLocation(settlementProgram,'uPV'),false,pv); gl.uniform1f(gl.getUniformLocation(settlementProgram,'uTerrainScale'),activeTerrain.verticalScale); gl.uniform2f(gl.getUniformLocation(settlementProgram,'uWorldCenter'),state.localCenter.x,state.localCenter.z); gl.uniform1f(gl.getUniformLocation(settlementProgram,'uWorldScale'),state.worldScale); gl.bindVertexArray(activeSettlementMesh.vao); gl.drawArrays(gl.POINTS,0,activeSettlementMesh.count); }`,
  'active regional or local render meshes'
);

html = replaceOnce(
  html,
  "        const modeLabel = state.worldMode === 'local' ? 'LOCAL LLEVANT ×' + state.worldScale : 'REGIONAL ×1';\n        hudStats.textContent = modeLabel + ' · ' + state.activeBuildings.toLocaleString('es-ES') + ' edificios activos / ' + metadata.counts.buildings.toLocaleString('es-ES') + ' · ' + state.loadedCells + ' celdas · ' + state.fps + ' FPS';",
  "        const modeLabel = state.worldMode === 'local' ? 'LOCAL LLEVANT · PAQUETE ×' + state.worldScale : 'REGIONAL ×1';\n        const visibleTotal = state.worldMode === 'local' ? localMetadata.counts.buildings : metadata.counts.buildings;\n        hudStats.textContent = modeLabel + ' · ' + state.activeBuildings.toLocaleString('es-ES') + ' edificios / ' + visibleTotal.toLocaleString('es-ES') + ' · ' + state.loadedCells + ' lotes · ' + state.fps + ' FPS';",
  'local package HUD'
);

html = html.replaceAll(
  "          localZoneId: state.localZoneId,\n          playerFacing:",
  "          localZoneId: state.localZoneId,\n          localPackageLoaded: state.localPackageLoaded,\n          renderDataset: state.renderDataset,\n          localPackageBuildId: state.localPackageBuildId,\n          localPackageBytes: state.localPackageBytes,\n          localTerrainColumns: state.localTerrainColumns,\n          localTerrainRows: state.localTerrainRows,\n          localBuildingCount: state.localBuildingCount,\n          localRoadVertexCount: state.localRoadVertexCount,\n          playerFacing:"
);

html = replaceOnce(
  html,
  `      probeCollision() {
        const records = streamer.active;
        return records.length >= 8 ? collidesBuilding(records[0], records[2]) : false;
      },`,
  `      probeCollision() {
        const records = state.worldMode === 'local' ? localPreview.buildings : streamer.active;
        return records.length >= 8 ? collidesBuilding(records[0], records[2]) : false;
      },`,
  'local package collision probe'
);

html = replaceOnce(
  html,
  "      getState() { const displayPosition = toDisplayXZ(state.camera.x, state.camera.z); return { position: { ...state.camera }, displayPosition: { x: displayPosition.x, y: state.camera.y, z: displayPosition.z }, cameraEye: { ...state.cameraEye }, cameraYaw: state.yaw, playerFacing: state.playerFacing, cameraMode: 'third-person', characterVisible: true, cameraBlocked: state.cameraBlocked, lateralControls: 'screen-relative', worldMode: state.worldMode, worldScale: state.worldScale, footprintScale: state.footprintScale, localCenter: { ...state.localCenter }, localRadius: state.localRadius, localZoneId: state.localZoneId, grounded: state.grounded, activeBuildings: state.activeBuildings, loadedCells: state.loadedCells, collisions: state.collisions, preset: state.activePreset }; },\n      version: '004',\n      metadata",
  "      getState() { const displayPosition = toDisplayXZ(state.camera.x, state.camera.z); return { position: { ...state.camera }, displayPosition: { x: displayPosition.x, y: state.camera.y, z: displayPosition.z }, cameraEye: { ...state.cameraEye }, cameraYaw: state.yaw, playerFacing: state.playerFacing, cameraMode: 'third-person', characterVisible: true, cameraBlocked: state.cameraBlocked, lateralControls: 'screen-relative', worldMode: state.worldMode, worldScale: state.worldScale, footprintScale: state.footprintScale, localCenter: { ...state.localCenter }, localRadius: state.localRadius, localZoneId: state.localZoneId, localPackageLoaded: state.localPackageLoaded, renderDataset: state.renderDataset, localPackageBuildId: state.localPackageBuildId, localPackageBytes: state.localPackageBytes, localTerrain: { columns: state.localTerrainColumns, rows: state.localTerrainRows }, localCounts: { buildings: state.localBuildingCount, roadVertices: state.localRoadVertexCount }, grounded: state.grounded, activeBuildings: state.activeBuildings, loadedCells: state.loadedCells, collisions: state.collisions, preset: state.activePreset }; },\n      version: '005',\n      metadata,\n      localMetadata",
  'runtime 005 package state API'
);

html = replaceOnce(
  html,
  "window.__WAFT_RUNTIME_005_STATS__ = { totalBuildings: metadata.counts.buildings, activeBuildings: state.activeBuildings, loadedCells: state.loadedCells, collisions: 0, grounded: true, cameraMode: 'third-person', characterVisible: true, lateralControls: 'screen-relative', worldMode: state.worldMode, worldScale: state.worldScale, footprintScale: state.footprintScale, localZoneId: state.localZoneId, playerFacing: state.playerFacing, cameraBlocked: state.cameraBlocked, cameraEye: { ...state.cameraEye }, webgl2: true, buildId: metadata.buildId, binarySha256: metadata.binary.sha256, position: { ...state.camera } };",
  "window.__WAFT_RUNTIME_005_STATS__ = { totalBuildings: metadata.counts.buildings, activeBuildings: state.activeBuildings, loadedCells: state.loadedCells, collisions: 0, grounded: true, cameraMode: 'third-person', characterVisible: true, lateralControls: 'screen-relative', worldMode: state.worldMode, worldScale: state.worldScale, footprintScale: state.footprintScale, localZoneId: state.localZoneId, localPackageLoaded: state.localPackageLoaded, renderDataset: state.renderDataset, localPackageBuildId: state.localPackageBuildId, localPackageBytes: state.localPackageBytes, localTerrainColumns: state.localTerrainColumns, localTerrainRows: state.localTerrainRows, localBuildingCount: state.localBuildingCount, localRoadVertexCount: state.localRoadVertexCount, playerFacing: state.playerFacing, cameraBlocked: state.cameraBlocked, cameraEye: { ...state.cameraEye }, webgl2: true, buildId: metadata.buildId, binarySha256: metadata.binary.sha256, position: { ...state.camera } };",
  'initial runtime 005 package stats'
);

assert(html.includes("version: '005'"), 'Runtime version 005 marker is missing');
assert(html.includes("const localBase = `${base}local/llevant/`;"), 'Local package base is missing');
assert(html.includes("magic !== 'WAFTLZ01'"), 'Local package parser is missing');
assert(html.includes("renderDataset = 'local-package'"), 'Local dataset transition is missing');
assert(html.includes('localTerrainMesh'), 'Local terrain mesh is missing');
assert(html.includes('localBuildingMesh'), 'Local building mesh is missing');
assert(html.includes('window.__WAFT_RUNTIME_005_READY__=true'), 'Runtime 005 ready marker is missing');
assert(!html.includes('RUNTIME REGIONAL 004'), 'Runtime 004 title leaked into runtime 005');

fs.writeFileSync(outputPath, html);
const report = {
  formatVersion: 1,
  buildRevision: BUILD_REVISION,
  runtimeVersion: '005',
  valid: true,
  source: path.relative(ROOT, sourcePath).replaceAll(path.sep, '/'),
  output: path.relative(ROOT, outputPath).replaceAll(path.sep, '/'),
  sourceSha256: sha256(fs.readFileSync(sourcePath)),
  outputSha256: sha256(Buffer.from(html)),
  outputBytes: Buffer.byteLength(html),
  localPackage: 'regions/baleares/local/llevant/llevant-local-v1.bin',
  changes: [
    'load-and-verify-independent-llevant-local-package',
    'switch-terrain-roads-buildings-landmarks-and-settlements-by-world-mode',
    'use-cropped-local-terrain-for-physics',
    'use-local-building-set-for-collision-and-safe-spawn',
    'preserve-regional-position-across-package-transition',
    'expose-active-dataset-and-local-package-metadata'
  ]
};
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
