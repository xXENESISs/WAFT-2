import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const BUILD_REVISION = 1;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourcePath = path.join(ROOT, 'mallorca-mobile/region-runtime-baleares-003.html');
const outputPath = path.join(ROOT, 'mallorca-mobile/region-runtime-baleares-004.html');
const reportPath = path.join(ROOT, 'world-generator/baleares-runtime-004-build.json');

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
html = html.replaceAll('Runtime regional de Baleares 003', 'Runtime regional de Baleares 004');
html = html.replaceAll('RUNTIME REGIONAL 003', 'RUNTIME REGIONAL 004');
html = html.replaceAll('__WAFT_RUNTIME_003_', '__WAFT_RUNTIME_004_');

html = replaceOnce(
  html,
  '#boost{grid-column:1/3;height:36px;padding:0;font-size:11px}',
  '#boost{grid-column:1/3;height:36px;padding:0;font-size:11px}\n#scaleMode{grid-column:1/3;height:38px;padding:0;font-size:10px;letter-spacing:.025em}\n#scaleMode.active{background:#315f51;color:#f7fff9;border-color:#8bd1b5}',
  'scale mode CSS'
);
html = replaceOnce(
  html,
  '<div id="vertical"><button id="up" aria-label="Saltar">⤒</button><button id="down" aria-label="Reaparecer">↺</button><button id="boost">CORRER ×1</button></div><div id="crosshair">＋</div>',
  '<div id="vertical"><button id="up" aria-label="Saltar">⤒</button><button id="down" aria-label="Reaparecer">↺</button><button id="boost">CORRER ×1</button><button id="scaleMode">ENTRAR EN LLEVANT</button></div><div id="crosshair">＋</div>',
  'scale mode button'
);
html = replaceOnce(
  html,
  '<div id="help">Joystick: mover al explorador · Arrastrar: orbitar cámara · ⤒: saltar · ↺: reaparecer</div>',
  '<div id="help">Joystick: mover · Arrastrar: orbitar · ENTRAR EN LLEVANT: cambiar entre viaje regional y exploración local</div>',
  'runtime help text'
);

html = replaceOnce(
  html,
  "    cameraBlocked: false,\n    cameraMode: 'third-person'",
  "    cameraBlocked: false,\n    cameraMode: 'third-person',\n    worldMode: 'regional',\n    worldScale: 1,\n    footprintScale: 1,\n    localCenter: { x: 0, z: 0 },\n    localRadius: 18,\n    localZoneId: null",
  'dual-scale runtime state'
);

html = replaceOnce(
  html,
  "    const boost = document.getElementById('boost');\n    boost.addEventListener('click', () => {",
  "    const boost = document.getElementById('boost');\n    const scaleModeButton = document.getElementById('scaleMode');\n    boost.addEventListener('click', () => {",
  'scale mode control reference'
);

html = replaceOnce(
  html,
  `    const spawn = preset => {
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
      state.pitch = .28;
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
    if (!initial) throw new Error('No playable spawn presets were generated');
    spawn(initial);
    return { spawn, playable };`,
  `    const spawn = preset => {
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
      state.pitch = .28;
      streamer.update(state.camera.x, state.camera.z, true);
    };
    const exitLocal = () => {
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
    };
    scaleModeButton.addEventListener('click', () => state.worldMode === 'local' ? exitLocal() : enterLocal());
    for (const preset of playable) {
      const button = document.createElement('button');
      button.textContent = preset.name;
      button.dataset.id = preset.id;
      button.addEventListener('click', () => {
        if (state.worldMode === 'local') exitLocal();
        spawn(preset);
      });
      presets.appendChild(button);
    }
    const initial = playable.find(item => item.name.toLowerCase().includes('palma')) || playable[0];
    if (!initial) throw new Error('No playable spawn presets were generated');
    spawn(initial);
    return { spawn, playable, enterLocal, exitLocal };`,
  'dual-scale controls and Llevant transition'
);

html = replaceOnce(
  html,
  "      uniform mat4 uPV; uniform float uVerticalScale; out vec3 vColor; out vec3 vNormal; out vec3 vWorld;\n      void main(){vWorld=vec3(aPosition.x,aPosition.y*uVerticalScale,aPosition.z);vColor=aColor;vNormal=aNormal;gl_Position=uPV*vec4(vWorld,1.0);}",
  "      uniform mat4 uPV; uniform float uVerticalScale; uniform vec2 uWorldCenter; uniform float uWorldScale; out vec3 vColor; out vec3 vNormal; out vec3 vWorld;\n      void main(){vec2 xz=uWorldCenter+(aPosition.xz-uWorldCenter)*uWorldScale;vWorld=vec3(xz.x,aPosition.y*uVerticalScale,xz.y);vColor=aColor;vNormal=aNormal;gl_Position=uPV*vec4(vWorld,1.0);}",
  'dual-scale terrain shader'
);
html = replaceOnce(
  html,
  "      uniform mat4 uPV; uniform float uTerrainScale; uniform float uBuildingScale; uniform float uHorizontalExaggeration; out vec3 vNormal; flat out int vKind; out vec3 vWorld;\n      void main(){float c=cos(aAngle),s=sin(aAngle);vec2 local=aPosition.xz*aSize.xz*uHorizontalExaggeration;vec2 rotated=vec2(local.x*c-local.y*s,local.x*s+local.y*c);vWorld=vec3(aCenter.x+rotated.x,aCenter.y*uTerrainScale+aPosition.y*aSize.y*uBuildingScale+.06,aCenter.z+rotated.y);vNormal=normalize(vec3(aNormal.x*c-aNormal.z*s,aNormal.y,aNormal.x*s+aNormal.z*c));vKind=int(aKind+.5);gl_Position=uPV*vec4(vWorld,1.0);}",
  "      uniform mat4 uPV; uniform float uTerrainScale; uniform float uBuildingScale; uniform float uHorizontalExaggeration; uniform vec2 uWorldCenter; uniform float uWorldScale; uniform float uFootprintScale; out vec3 vNormal; flat out int vKind; out vec3 vWorld;\n      void main(){float c=cos(aAngle),s=sin(aAngle);vec2 local=aPosition.xz*aSize.xz*uHorizontalExaggeration*uFootprintScale;vec2 rotated=vec2(local.x*c-local.y*s,local.x*s+local.y*c);vec2 centerXZ=uWorldCenter+(aCenter.xz-uWorldCenter)*uWorldScale;vWorld=vec3(centerXZ.x+rotated.x,aCenter.y*uTerrainScale+aPosition.y*aSize.y*uBuildingScale+.06,centerXZ.y+rotated.y);vNormal=normalize(vec3(aNormal.x*c-aNormal.z*s,aNormal.y,aNormal.x*s+aNormal.z*c));vKind=int(aKind+.5);gl_Position=uPV*vec4(vWorld,1.0);}",
  'dual-scale building shader'
);
html = replaceOnce(
  html,
  "      layout(location=0) in vec3 aPosition; layout(location=1) in float aClass; uniform mat4 uPV; uniform float uTerrainScale; uniform float uLift; flat out int vClass;\n      void main(){vClass=int(aClass+.5);gl_Position=uPV*vec4(aPosition.x,aPosition.y*uTerrainScale+uLift,aPosition.z,1.0);}",
  "      layout(location=0) in vec3 aPosition; layout(location=1) in float aClass; uniform mat4 uPV; uniform float uTerrainScale; uniform float uLift; uniform vec2 uWorldCenter; uniform float uWorldScale; flat out int vClass;\n      void main(){vClass=int(aClass+.5);vec2 xz=uWorldCenter+(aPosition.xz-uWorldCenter)*uWorldScale;gl_Position=uPV*vec4(xz.x,aPosition.y*uTerrainScale+uLift,xz.y,1.0);}",
  'dual-scale road shader'
);
html = replaceOnce(
  html,
  "      layout(location=0) in vec3 aPosition; layout(location=1) in float aScore; layout(location=2) in float aRepresentation; uniform mat4 uPV; uniform float uTerrainScale; uniform float uLift; out float vRep;\n      void main(){vRep=aRepresentation;gl_Position=uPV*vec4(aPosition.x,aPosition.y*uTerrainScale+uLift+aRepresentation*.5,aPosition.z,1.0);gl_PointSize=10.0+aRepresentation*5.0;}",
  "      layout(location=0) in vec3 aPosition; layout(location=1) in float aScore; layout(location=2) in float aRepresentation; uniform mat4 uPV; uniform float uTerrainScale; uniform float uLift; uniform vec2 uWorldCenter; uniform float uWorldScale; out float vRep;\n      void main(){vRep=aRepresentation;vec2 xz=uWorldCenter+(aPosition.xz-uWorldCenter)*uWorldScale;gl_Position=uPV*vec4(xz.x,aPosition.y*uTerrainScale+uLift+aRepresentation*.5,xz.y,1.0);gl_PointSize=10.0+aRepresentation*5.0;}",
  'dual-scale landmark shader'
);
html = replaceOnce(
  html,
  "      layout(location=0) in vec3 aPosition; layout(location=1) in float aPriority; uniform mat4 uPV; uniform float uTerrainScale; out float vPriority;\n      void main(){vPriority=aPriority;gl_Position=uPV*vec4(aPosition.x,aPosition.y*uTerrainScale+1.0,aPosition.z,1.0);gl_PointSize=clamp(5.0+aPriority*.035,5.0,10.0);}",
  "      layout(location=0) in vec3 aPosition; layout(location=1) in float aPriority; uniform mat4 uPV; uniform float uTerrainScale; uniform vec2 uWorldCenter; uniform float uWorldScale; out float vPriority;\n      void main(){vPriority=aPriority;vec2 xz=uWorldCenter+(aPosition.xz-uWorldCenter)*uWorldScale;gl_Position=uPV*vec4(xz.x,aPosition.y*uTerrainScale+1.0,xz.y,1.0);gl_PointSize=clamp(5.0+aPriority*.035,5.0,10.0);}",
  'dual-scale settlement shader'
);

html = replaceOnce(
  html,
  `    const sampleTerrainInfo = (x, z) => {`,
  `    const toDisplayXZ = (x, z) => ({
      x: state.localCenter.x + (x - state.localCenter.x) * state.worldScale,
      z: state.localCenter.z + (z - state.localCenter.z) * state.worldScale
    });
    const toRegionalXZ = (x, z) => ({
      x: state.localCenter.x + (x - state.localCenter.x) / state.worldScale,
      z: state.localCenter.z + (z - state.localCenter.z) / state.worldScale
    });
    const sampleTerrainInfo = (x, z) => {`,
  'coordinate conversion helpers'
);

html = html.replaceAll(
  "        const halfX = records[offset + 3] * exaggeration * .5 + radius;\n        const halfZ = records[offset + 5] * exaggeration * .5 + radius;",
  "        const halfX = (records[offset + 3] * exaggeration * state.footprintScale * .5 + radius) / state.worldScale;\n        const halfZ = (records[offset + 5] * exaggeration * state.footprintScale * .5 + radius) / state.worldScale;"
);
html = replaceOnce(
  html,
  "        if (Math.abs(localX) < records[offset + 3] * exaggeration * .5 + radius && Math.abs(localZ) < records[offset + 5] * exaggeration * .5 + radius) return true;",
  "        const halfX = (records[offset + 3] * exaggeration * state.footprintScale * .5 + radius) / state.worldScale;\n        const halfZ = (records[offset + 5] * exaggeration * state.footprintScale * .5 + radius) / state.worldScale;\n        if (Math.abs(localX) < halfX && Math.abs(localZ) < halfZ) return true;",
  'dual-scale safe spawn collision'
);

html = replaceOnce(
  html,
  "        const terrain = sampleTerrainInfo(point[0], point[2]);\n        if (!terrain.land || terrain.height + .28 > point[1] || collidesBuilding(point[0], point[2])) {",
  "        const regional = toRegionalXZ(point[0], point[2]);\n        const terrain = sampleTerrainInfo(regional.x, regional.z);\n        if (!terrain.land || terrain.height + .28 > point[1] || collidesBuilding(regional.x, regional.z)) {",
  'dual-scale camera obstruction queries'
);

html = replaceOnce(
  html,
  "      const baseY = state.camera.y - 1.35 + bounce;\n      const facing = state.playerFacing;",
  "      const baseY = state.camera.y - 1.35 + bounce;\n      const playerDisplay = toDisplayXZ(state.camera.x, state.camera.z);\n      const facing = state.playerFacing;",
  'dual-scale character display center'
);
html = replaceOnce(
  html,
  "        const worldX = state.camera.x + localX * c + localZ * s;\n        const worldZ = state.camera.z - localX * s + localZ * c;",
  "        const worldX = playerDisplay.x + localX * c + localZ * s;\n        const worldZ = playerDisplay.z - localX * s + localZ * c;",
  'dual-scale character placement'
);

html = replaceOnce(
  html,
  "      movePlayer(moveX, moveZ);\n      streamer.update(state.camera.x, state.camera.z);",
  "      movePlayer(moveX / state.worldScale, moveZ / state.worldScale);\n      if (state.worldMode === 'local') {\n        const localDx = state.camera.x - state.localCenter.x;\n        const localDz = state.camera.z - state.localCenter.z;\n        const localDistance = Math.hypot(localDx, localDz);\n        if (localDistance > state.localRadius) {\n          state.camera.x = state.localCenter.x + localDx / localDistance * state.localRadius;\n          state.camera.z = state.localCenter.z + localDz / localDistance * state.localRadius;\n          state.collisions++;\n        }\n      }\n      streamer.update(state.camera.x, state.camera.z);",
  'local-space movement and zone boundary'
);
html = replaceOnce(
  html,
  "      const target = [state.camera.x, state.camera.y - .18, state.camera.z];",
  "      const displayPosition = toDisplayXZ(state.camera.x, state.camera.z);\n      const target = [displayPosition.x, state.camera.y - .18, displayPosition.z];",
  'dual-scale camera target'
);
html = replaceOnce(
  html,
  "      perspective(projection, Math.PI / 3, canvas.width / canvas.height, .12, 1450);",
  "      perspective(projection, Math.PI / 3, canvas.width / canvas.height, .12, state.worldMode === 'local' ? 2400 : 1450);",
  'dual-scale camera far plane'
);

html = replaceOnce(
  html,
  "        if (!best||distance<best.distance) best={distance,name:metadata.landmarks[index]?.name||'Monumento',kind:'monumento'};",
  "        if (!best||distance<best.distance) best={distance:distance*state.worldScale,name:metadata.landmarks[index]?.name||'Monumento',kind:'monumento'};",
  'local landmark distance'
);
html = replaceOnce(
  html,
  "        if (!best||distance<best.distance) best={distance,name:metadata.settlements[index]?.name||'Población',kind:'población'};",
  "        const displayDistance=distance*state.worldScale;\n        if (!best||displayDistance<best.distance) best={distance:displayDistance,name:metadata.settlements[index]?.name||'Población',kind:'población'};",
  'local settlement distance'
);
html = replaceOnce(
  html,
  "      nearestText.textContent = best ? `Cerca: ${best.name} · ${best.distance.toFixed(1)} u` : '';",
  "      nearestText.textContent = best ? `Cerca: ${best.name} · ${best.distance.toFixed(1)} u ${state.worldMode === 'local' ? 'locales' : 'regionales'}` : '';",
  'scale-aware nearest label'
);

html = replaceOnce(
  html,
  "      if (state.terrain) { gl.useProgram(terrainProgram); gl.uniformMatrix4fv(gl.getUniformLocation(terrainProgram,'uPV'),false,pv); gl.uniform1f(gl.getUniformLocation(terrainProgram,'uVerticalScale'),terrainMesh.verticalScale); gl.uniform3f(gl.getUniformLocation(terrainProgram,'uCamera'),...eye); gl.bindVertexArray(terrainMesh.vao); gl.drawElements(gl.TRIANGLES,terrainMesh.count,gl.UNSIGNED_INT,0); }",
  "      if (state.terrain) { gl.useProgram(terrainProgram); gl.uniformMatrix4fv(gl.getUniformLocation(terrainProgram,'uPV'),false,pv); gl.uniform1f(gl.getUniformLocation(terrainProgram,'uVerticalScale'),terrainMesh.verticalScale); gl.uniform2f(gl.getUniformLocation(terrainProgram,'uWorldCenter'),state.localCenter.x,state.localCenter.z); gl.uniform1f(gl.getUniformLocation(terrainProgram,'uWorldScale'),state.worldScale); gl.uniform3f(gl.getUniformLocation(terrainProgram,'uCamera'),...eye); gl.bindVertexArray(terrainMesh.vao); gl.drawElements(gl.TRIANGLES,terrainMesh.count,gl.UNSIGNED_INT,0); }",
  'terrain scale uniforms'
);
html = replaceOnce(
  html,
  "      if (state.roads) { gl.useProgram(roadProgram); gl.uniformMatrix4fv(gl.getUniformLocation(roadProgram,'uPV'),false,pv); gl.uniform1f(gl.getUniformLocation(roadProgram,'uTerrainScale'),terrainMesh.verticalScale); gl.uniform1f(gl.getUniformLocation(roadProgram,'uLift'),metadata.display.roadLift); gl.bindVertexArray(roadMesh.vao); gl.drawArrays(gl.LINES,0,roadMesh.count); }",
  "      if (state.roads) { gl.useProgram(roadProgram); gl.uniformMatrix4fv(gl.getUniformLocation(roadProgram,'uPV'),false,pv); gl.uniform1f(gl.getUniformLocation(roadProgram,'uTerrainScale'),terrainMesh.verticalScale); gl.uniform1f(gl.getUniformLocation(roadProgram,'uLift'),metadata.display.roadLift); gl.uniform2f(gl.getUniformLocation(roadProgram,'uWorldCenter'),state.localCenter.x,state.localCenter.z); gl.uniform1f(gl.getUniformLocation(roadProgram,'uWorldScale'),state.worldScale); gl.bindVertexArray(roadMesh.vao); gl.drawArrays(gl.LINES,0,roadMesh.count); }",
  'road scale uniforms'
);
html = replaceOnce(
  html,
  "      if (state.buildings) { gl.useProgram(buildingProgram); gl.uniformMatrix4fv(gl.getUniformLocation(buildingProgram,'uPV'),false,pv); gl.uniform1f(gl.getUniformLocation(buildingProgram,'uTerrainScale'),terrainMesh.verticalScale); gl.uniform1f(gl.getUniformLocation(buildingProgram,'uBuildingScale'),metadata.display.buildingVerticalScale); gl.uniform1f(gl.getUniformLocation(buildingProgram,'uHorizontalExaggeration'),metadata.display.buildingHorizontalExaggeration); gl.uniform3f(gl.getUniformLocation(buildingProgram,'uCamera'),...eye); gl.uniform1i(gl.getUniformLocation(buildingProgram,'uShowHotels'),state.hotels?1:0); gl.bindVertexArray(buildingMesh.vao); gl.drawElementsInstanced(gl.TRIANGLES,buildingMesh.indexCount,gl.UNSIGNED_SHORT,0,buildingMesh.instanceCount); }",
  "      if (state.buildings) { gl.useProgram(buildingProgram); gl.uniformMatrix4fv(gl.getUniformLocation(buildingProgram,'uPV'),false,pv); gl.uniform1f(gl.getUniformLocation(buildingProgram,'uTerrainScale'),terrainMesh.verticalScale); gl.uniform1f(gl.getUniformLocation(buildingProgram,'uBuildingScale'),metadata.display.buildingVerticalScale); gl.uniform1f(gl.getUniformLocation(buildingProgram,'uHorizontalExaggeration'),metadata.display.buildingHorizontalExaggeration); gl.uniform2f(gl.getUniformLocation(buildingProgram,'uWorldCenter'),state.localCenter.x,state.localCenter.z); gl.uniform1f(gl.getUniformLocation(buildingProgram,'uWorldScale'),state.worldScale); gl.uniform1f(gl.getUniformLocation(buildingProgram,'uFootprintScale'),state.footprintScale); gl.uniform3f(gl.getUniformLocation(buildingProgram,'uCamera'),...eye); gl.uniform1i(gl.getUniformLocation(buildingProgram,'uShowHotels'),state.hotels?1:0); gl.bindVertexArray(buildingMesh.vao); gl.drawElementsInstanced(gl.TRIANGLES,buildingMesh.indexCount,gl.UNSIGNED_SHORT,0,buildingMesh.instanceCount); }",
  'building scale uniforms'
);
html = replaceOnce(
  html,
  "      if (state.landmarks) { gl.useProgram(landmarkProgram); gl.uniformMatrix4fv(gl.getUniformLocation(landmarkProgram,'uPV'),false,pv); gl.uniform1f(gl.getUniformLocation(landmarkProgram,'uTerrainScale'),terrainMesh.verticalScale); gl.uniform1f(gl.getUniformLocation(landmarkProgram,'uLift'),metadata.display.landmarkLift); gl.bindVertexArray(landmarkMesh.vao); gl.drawArrays(gl.POINTS,0,landmarkMesh.count); }",
  "      if (state.landmarks) { gl.useProgram(landmarkProgram); gl.uniformMatrix4fv(gl.getUniformLocation(landmarkProgram,'uPV'),false,pv); gl.uniform1f(gl.getUniformLocation(landmarkProgram,'uTerrainScale'),terrainMesh.verticalScale); gl.uniform1f(gl.getUniformLocation(landmarkProgram,'uLift'),metadata.display.landmarkLift); gl.uniform2f(gl.getUniformLocation(landmarkProgram,'uWorldCenter'),state.localCenter.x,state.localCenter.z); gl.uniform1f(gl.getUniformLocation(landmarkProgram,'uWorldScale'),state.worldScale); gl.bindVertexArray(landmarkMesh.vao); gl.drawArrays(gl.POINTS,0,landmarkMesh.count); }",
  'landmark scale uniforms'
);
html = replaceOnce(
  html,
  "      if (state.settlements) { gl.useProgram(settlementProgram); gl.uniformMatrix4fv(gl.getUniformLocation(settlementProgram,'uPV'),false,pv); gl.uniform1f(gl.getUniformLocation(settlementProgram,'uTerrainScale'),terrainMesh.verticalScale); gl.bindVertexArray(settlementMesh.vao); gl.drawArrays(gl.POINTS,0,settlementMesh.count); }",
  "      if (state.settlements) { gl.useProgram(settlementProgram); gl.uniformMatrix4fv(gl.getUniformLocation(settlementProgram,'uPV'),false,pv); gl.uniform1f(gl.getUniformLocation(settlementProgram,'uTerrainScale'),terrainMesh.verticalScale); gl.uniform2f(gl.getUniformLocation(settlementProgram,'uWorldCenter'),state.localCenter.x,state.localCenter.z); gl.uniform1f(gl.getUniformLocation(settlementProgram,'uWorldScale'),state.worldScale); gl.bindVertexArray(settlementMesh.vao); gl.drawArrays(gl.POINTS,0,settlementMesh.count); }",
  'settlement scale uniforms'
);

html = replaceOnce(
  html,
  "        hudStats.textContent = state.activeBuildings.toLocaleString('es-ES') + ' edificios activos / ' + metadata.counts.buildings.toLocaleString('es-ES') + ' · ' + state.loadedCells + ' celdas · ' + metadata.counts.selectedRoads.toLocaleString('es-ES') + ' vías · ' + state.fps + ' FPS';",
  "        const modeLabel = state.worldMode === 'local' ? 'LOCAL LLEVANT ×' + state.worldScale : 'REGIONAL ×1';\n        hudStats.textContent = modeLabel + ' · ' + state.activeBuildings.toLocaleString('es-ES') + ' edificios activos / ' + metadata.counts.buildings.toLocaleString('es-ES') + ' · ' + state.loadedCells + ' celdas · ' + state.fps + ' FPS';",
  'dual-scale HUD'
);
html = html.replaceAll(
  "          lateralControls: 'screen-relative',\n          playerFacing:",
  "          lateralControls: 'screen-relative',\n          worldMode: state.worldMode,\n          worldScale: state.worldScale,\n          footprintScale: state.footprintScale,\n          localZoneId: state.localZoneId,\n          playerFacing:"
);

html = replaceOnce(
  html,
  `      spawn(id) {
        const preset = runtimeControls.playable.find(item => item.id === id || item.name.toLowerCase() === String(id).toLowerCase());
        if (!preset) throw new Error('Punto de aparición desconocido: ' + id);
        runtimeControls.spawn(preset);
      },`,
  `      spawn(id) {
        const preset = runtimeControls.playable.find(item => item.id === id || item.name.toLowerCase() === String(id).toLowerCase());
        if (!preset) throw new Error('Punto de aparición desconocido: ' + id);
        if (state.worldMode === 'local') runtimeControls.exitLocal();
        runtimeControls.spawn(preset);
      },
      enterLocal() { runtimeControls.enterLocal(); },
      exitLocal() { runtimeControls.exitLocal(); },
      toggleScale() { state.worldMode === 'local' ? runtimeControls.exitLocal() : runtimeControls.enterLocal(); },
      regionalToDisplay(x, z) { return toDisplayXZ(Number(x), Number(z)); },
      displayToRegional(x, z) { return toRegionalXZ(Number(x), Number(z)); },`,
  'dual-scale runtime API'
);
html = replaceOnce(
  html,
  "      getState() { return { position: { ...state.camera }, cameraEye: { ...state.cameraEye }, cameraYaw: state.yaw, playerFacing: state.playerFacing, cameraMode: 'third-person', characterVisible: true, cameraBlocked: state.cameraBlocked, lateralControls: 'screen-relative', grounded: state.grounded, activeBuildings: state.activeBuildings, loadedCells: state.loadedCells, collisions: state.collisions, preset: state.activePreset }; },\n      version: '003',",
  "      getState() { const displayPosition = toDisplayXZ(state.camera.x, state.camera.z); return { position: { ...state.camera }, displayPosition: { x: displayPosition.x, y: state.camera.y, z: displayPosition.z }, cameraEye: { ...state.cameraEye }, cameraYaw: state.yaw, playerFacing: state.playerFacing, cameraMode: 'third-person', characterVisible: true, cameraBlocked: state.cameraBlocked, lateralControls: 'screen-relative', worldMode: state.worldMode, worldScale: state.worldScale, footprintScale: state.footprintScale, localCenter: { ...state.localCenter }, localRadius: state.localRadius, localZoneId: state.localZoneId, grounded: state.grounded, activeBuildings: state.activeBuildings, loadedCells: state.loadedCells, collisions: state.collisions, preset: state.activePreset }; },\n      version: '004',",
  'runtime 004 state API'
);
html = replaceOnce(
  html,
  "window.__WAFT_RUNTIME_004_STATS__ = { totalBuildings: metadata.counts.buildings, activeBuildings: state.activeBuildings, loadedCells: state.loadedCells, collisions: 0, grounded: true, cameraMode: 'third-person', characterVisible: true, lateralControls: 'screen-relative', playerFacing: state.playerFacing, cameraBlocked: state.cameraBlocked, cameraEye: { ...state.cameraEye }, webgl2: true, buildId: metadata.buildId, binarySha256: metadata.binary.sha256, position: { ...state.camera } };",
  "window.__WAFT_RUNTIME_004_STATS__ = { totalBuildings: metadata.counts.buildings, activeBuildings: state.activeBuildings, loadedCells: state.loadedCells, collisions: 0, grounded: true, cameraMode: 'third-person', characterVisible: true, lateralControls: 'screen-relative', worldMode: state.worldMode, worldScale: state.worldScale, footprintScale: state.footprintScale, localZoneId: state.localZoneId, playerFacing: state.playerFacing, cameraBlocked: state.cameraBlocked, cameraEye: { ...state.cameraEye }, webgl2: true, buildId: metadata.buildId, binarySha256: metadata.binary.sha256, position: { ...state.camera } };",
  'initial runtime 004 stats'
);

assert(html.includes("version: '004'"), 'Runtime version 004 marker is missing');
assert(html.includes("worldScale = 12"), 'Local world scale is missing');
assert(html.includes("footprintScale = 4"), 'Local footprint scale is missing');
assert(html.includes("localZoneId = 'llevant'"), 'Llevant local zone marker is missing');
assert(html.includes('window.__WAFT_RUNTIME_004_READY__=true'), 'Runtime 004 ready marker is missing');
assert(html.includes("regionalToDisplay(x, z)"), 'Dual-scale API is missing');
assert(!html.includes('RUNTIME REGIONAL 003'), 'Runtime 003 title leaked into runtime 004');

fs.writeFileSync(outputPath, html);
const report = {
  formatVersion: 1,
  buildRevision: BUILD_REVISION,
  runtimeVersion: '004',
  valid: true,
  source: path.relative(ROOT, sourcePath).replaceAll(path.sep, '/'),
  output: path.relative(ROOT, outputPath).replaceAll(path.sep, '/'),
  sourceSha256: sha256(fs.readFileSync(sourcePath)),
  outputSha256: sha256(Buffer.from(html)),
  outputBytes: Buffer.byteLength(html),
  localZone: {
    id: 'llevant',
    worldScale: 12,
    footprintScale: 4,
    regionalRadius: 18,
    verticalScaleMultiplier: 1
  },
  changes: [
    'regional-local-dual-coordinate-runtime',
    'llevant-local-zone-transition',
    'horizontal-terrain-and-road-expansion',
    'independent-building-footprint-expansion',
    'scale-aware-movement-collision-camera-and-hud',
    'preserve-regional-runtime-and-third-person-controls'
  ]
};
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
