import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const BUILD_REVISION = 1;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourcePath = path.join(ROOT, 'mallorca-mobile/region-runtime-baleares-008.html');
const outputPath = path.join(ROOT, 'mallorca-mobile/region-runtime-baleares-009.html');
const reportPath = path.join(ROOT, 'world-generator/baleares-runtime-009-build.json');

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

function replaceRegexOnce(source, regex, replacement, label) {
  const match = source.match(regex);
  assert(match, `Could not find ${label}`);
  return source.slice(0, match.index) + replacement + source.slice(match.index + match[0].length);
}

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

let html = fs.readFileSync(sourcePath, 'utf8');
html = html.replaceAll('Runtime regional de Baleares 008', 'Runtime regional de Baleares 009');
html = html.replaceAll('RUNTIME REGIONAL 008', 'RUNTIME REGIONAL 009');
html = html.replaceAll('__WAFT_RUNTIME_008_', '__WAFT_RUNTIME_009_');
html = html.replace("      version: '008',", "      version: '009',");
html = html.replace('Preparando el runtime regional en tercera persona…', 'Preparando escala animal y gráficos mejorados…');

html = replaceOnce(
  html,
  `    localProximityUpdates: 0`,
  `    localProximityUpdates: 0,
    playerVisualScale: .58,
    playerCollisionRadius: .16,
    playerEyeHeight: .82,
    playerPreviousCollisionRadius: .34,
    graphicsProfile: 'enhanced-mobile-v1'`,
  'player dimensions and graphics state'
);

html = replaceOnce(
  html,
  `    const palette = [
      [.055,.22,.31],[.78,.69,.46],[.46,.48,.44],[.35,.47,.22],[.10,.31,.15],
      [.53,.56,.24],[.43,.43,.40],[.22,.45,.34],[.48,.45,.41],[.43,.59,.27]
    ];`,
  `    const palette = [
      [.028,.165,.285],[.78,.665,.405],[.39,.405,.39],[.265,.445,.175],[.052,.275,.115],
      [.46,.49,.19],[.405,.415,.405],[.145,.37,.275],[.45,.405,.355],[.35,.535,.205]
    ];`,
  'enhanced terrain palette'
);

const terrainProgram = `    const terrainProgram = program(gl, \`#version 300 es
      layout(location=0) in vec3 aPosition; layout(location=1) in vec3 aNormal; layout(location=2) in vec3 aColor;
      uniform mat4 uPV; uniform float uVerticalScale; uniform vec2 uWorldCenter; uniform float uWorldScale; out vec3 vColor; out vec3 vNormal; out vec3 vWorld;
      void main(){vec2 xz=uWorldCenter+(aPosition.xz-uWorldCenter)*uWorldScale;vWorld=vec3(xz.x,aPosition.y*uVerticalScale,xz.y);vColor=aColor;vNormal=aNormal;gl_Position=uPV*vec4(vWorld,1.0);}\`,
      \`#version 300 es
      precision highp float; in vec3 vColor; in vec3 vNormal; in vec3 vWorld; uniform vec3 uCamera; out vec4 outColor;
      void main(){
        vec3 normal=normalize(vNormal);
        vec3 sunDirection=normalize(vec3(.38,.88,.26));
        float sun=max(dot(normal,sunDirection),0.0);
        float hemisphere=.40+.28*max(normal.y,0.0);
        float slopeShade=1.0-(1.0-max(normal.y,0.0))*.20;
        float altitude=clamp(vWorld.y/95.0,0.0,1.0);
        vec3 warm=vColor*vec3(1.08,1.02,.90);
        vec3 cool=vColor*vec3(.82,.93,1.08);
        vec3 base=mix(warm,cool,altitude*.28);
        vec3 lit=base*(hemisphere+sun*.54)*slopeShade;
        float distanceToCamera=distance(vWorld.xz,uCamera.xz);
        float fog=smoothstep(390.0,1020.0,distanceToCamera);
        vec3 sky=vec3(.39,.555,.655);
        outColor=vec4(mix(lit,sky,fog),1.0);
      }\`);
    const buildingProgram = program(gl,`;
html = replaceRegexOnce(
  html,
  /    const terrainProgram = program\(gl,[\s\S]*?    const buildingProgram = program\(gl,/,
  terrainProgram,
  'enhanced terrain shader'
);

const buildingProgram = `    const buildingProgram = program(gl, \`#version 300 es
      layout(location=0) in vec3 aPosition; layout(location=1) in vec3 aNormal; layout(location=2) in vec3 aCenter; layout(location=3) in vec3 aSize; layout(location=4) in float aAngle; layout(location=5) in float aKind;
      uniform mat4 uPV; uniform float uTerrainScale; uniform float uBuildingScale; uniform float uHorizontalExaggeration; uniform vec2 uWorldCenter; uniform float uWorldScale; uniform float uFootprintScale; out vec3 vNormal; flat out int vKind; out vec3 vWorld;
      void main(){float c=cos(aAngle),s=sin(aAngle);vec2 local=aPosition.xz*aSize.xz*uHorizontalExaggeration*uFootprintScale;vec2 rotated=vec2(local.x*c-local.y*s,local.x*s+local.y*c);vec2 centerXZ=uWorldCenter+(aCenter.xz-uWorldCenter)*uWorldScale;vWorld=vec3(centerXZ.x+rotated.x,aCenter.y*uTerrainScale+aPosition.y*aSize.y*uBuildingScale+.06,centerXZ.y+rotated.y);vNormal=normalize(vec3(aNormal.x*c-aNormal.z*s,aNormal.y,aNormal.x*s+aNormal.z*c));vKind=int(aKind+.5);gl_Position=uPV*vec4(vWorld,1.0);}\`,
      \`#version 300 es
      precision highp float; in vec3 vNormal; in vec3 vWorld; flat in int vKind; uniform vec3 uCamera; uniform bool uShowHotels; out vec4 outColor;
      vec3 colorFor(int kind){if(kind==1)return vec3(.91,.86,.72);if(kind==2)return vec3(.74,.56,.34);if(kind==3)return vec3(.50,.35,.24);if(kind==4)return vec3(.45,.59,.64);if(kind==5)return vec3(.72,.43,.28);return vec3(.66,.59,.49);}
      void main(){
        if(vKind==1&&!uShowHotels)discard;
        vec3 normal=normalize(vNormal);
        vec3 viewDirection=normalize(uCamera-vWorld);
        float sun=max(dot(normal,normalize(vec3(.42,.86,.28))),0.0);
        float roof=smoothstep(.72,.96,normal.y);
        float materialVariation=.96+.045*sin(vWorld.x*.31+vWorld.z*.27+float(vKind)*1.7);
        float floorBand=.94+.06*step(.58,fract(vWorld.y*.34));
        vec3 base=colorFor(vKind)*materialVariation*mix(floorBand,1.08,roof);
        vec3 lit=base*(.46+sun*.53+roof*.12);
        float rim=pow(1.0-max(dot(normal,viewDirection),0.0),2.0)*.045;
        float fog=smoothstep(285.0,800.0,distance(vWorld.xz,uCamera.xz));
        outColor=vec4(mix(lit+rim,vec3(.39,.555,.655),fog),1.0);
      }\`);
    const roadProgram = program(gl,`;
html = replaceRegexOnce(
  html,
  /    const buildingProgram = program\(gl,[\s\S]*?    const roadProgram = program\(gl,/,
  buildingProgram,
  'enhanced building shader'
);

const characterProgram = `    const characterProgram = program(gl, \`#version 300 es
      layout(location=0) in vec3 aPosition; layout(location=1) in vec3 aNormal;
      uniform mat4 uPV; uniform vec3 uCenter; uniform vec3 uScale; uniform float uYaw;
      out vec3 vNormal; out vec3 vWorld;
      void main(){
        float c=cos(uYaw),s=sin(uYaw);
        vec3 local=aPosition*uScale;
        vec3 rotated=vec3(local.x*c+local.z*s,local.y,-local.x*s+local.z*c);
        vWorld=uCenter+rotated;
        vec3 adjusted=normalize(vec3(aNormal.x/max(uScale.x,.001),aNormal.y/max(uScale.y,.001),aNormal.z/max(uScale.z,.001)));
        vNormal=normalize(vec3(adjusted.x*c+adjusted.z*s,adjusted.y,-adjusted.x*s+adjusted.z*c));
        gl_Position=uPV*vec4(vWorld,1.0);
      }\`,
      \`#version 300 es
      precision highp float; in vec3 vNormal; in vec3 vWorld;
      uniform vec3 uColor; uniform vec3 uCamera; out vec4 outColor;
      void main(){
        vec3 normal=normalize(vNormal);
        vec3 viewDirection=normalize(uCamera-vWorld);
        float sun=max(dot(normal,normalize(vec3(.38,.90,.24))),0.0);
        float fill=.38+.23*max(normal.y,0.0);
        float rim=pow(1.0-max(dot(normal,viewDirection),0.0),2.2)*.18;
        float furVariation=.94+.07*sin(vWorld.y*12.0+vWorld.x*8.0+vWorld.z*7.0);
        float fog=smoothstep(300.0,780.0,distance(vWorld.xz,uCamera.xz));
        vec3 color=uColor*furVariation*(fill+sun*.52)+vec3(.16,.13,.10)*rim;
        outColor=vec4(mix(color,vec3(.39,.555,.655),fog),1.0);
      }\`);

    const runtimeControls`;
html = replaceRegexOnce(
  html,
  /    const characterProgram = program\(gl,[\s\S]*?\n\n    const runtimeControls/,
  characterProgram,
  'enhanced character shader'
);

html = replaceOnce(html, '    cameraDistance: 6.4,', '    cameraDistance: 5.2,', 'initial camera distance');
html = html.replaceAll('      state.cameraDistance = 6.4;', '      state.cameraDistance = 5.2;');
html = html.replaceAll('      state.cameraDistance = 7.2;', '      state.cameraDistance = 5.8;');
html = html.replaceAll('      state.camera.y = safe.terrain + 1.35;', '      state.camera.y = safe.terrain + state.playerEyeHeight;');
html = html.replaceAll('      state.camera.y = safeEntry.terrain + 1.35;', '      state.camera.y = safeEntry.terrain + state.playerEyeHeight;');
html = html.replaceAll('        if (terrainInfo.land) state.camera.y = terrainInfo.height + 1.35;', '        if (terrainInfo.land) state.camera.y = terrainInfo.height + state.playerEyeHeight;');
html = replaceOnce(html, '      const ground = terrainNow.height + 1.35;', '      const ground = terrainNow.height + state.playerEyeHeight;', 'smaller player ground height');
html = replaceOnce(html, '      const baseY = state.camera.y - 1.35 + bounce;', '      const baseY = state.camera.y - state.playerEyeHeight + bounce;', 'smaller character base height');
html = replaceOnce(html, '      const bounce = Math.abs(Math.sin(now * .012)) * .045 * state.moveAmount;', '      const bounce = Math.abs(Math.sin(now * .012)) * .024 * state.moveAmount;', 'smaller gait bounce');
html = replaceOnce(html, '      const minimumDistance = Math.min(1.55, desiredDistance * .32);', '      const minimumDistance = Math.min(1.05, desiredDistance * .30);', 'smaller camera obstruction minimum');
html = replaceOnce(html, '      const target = [displayPosition.x, state.camera.y - .18, displayPosition.z];', '      const target = [displayPosition.x, state.camera.y - .07, displayPosition.z];', 'smaller camera target');
html = replaceOnce(html, '        target[1] + 1.15 + Math.sin(state.pitch) * state.cameraDistance,', '        target[1] + .76 + Math.sin(state.pitch) * state.cameraDistance,', 'smaller camera eye lift');
html = replaceOnce(html, '      const center = [target[0], target[1] + .32, target[2]];', '      const center = [target[0], target[1] + .18, target[2]];', 'smaller look target');
html = replaceOnce(html, '      state.pitch = .28;', '      state.pitch = .24;', 'smaller-character spawn pitch');
html = replaceOnce(html, '    pitch: .28,', '    pitch: .24,', 'smaller-character initial pitch');
html = replaceOnce(html, '        state.velocityY = 5.25;', '        state.velocityY = 4.55;', 'smaller-character jump velocity');

html = replaceOnce(
  html,
  `      const radius = .55;`,
  `      const radius = state.playerCollisionRadius + .06;`,
  'safe-spawn radius'
);

html = replaceBetween(
  html,
  `    const collidesBuilding = (x, z) => {`,
  `    const movePlayer = (dx, dz) => {`,
  `    const collidesBuildingWithRadius = (x, z, radius) => {
      const records = state.worldMode === 'local' ? localAssets.preview.buildings : streamer.active;
      const exaggeration = metadata.display.buildingHorizontalExaggeration;
      for (let offset = 0; offset < records.length; offset += 8) {
        const dx = x - records[offset];
        const dz = z - records[offset + 2];
        const angle = records[offset + 6];
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        const localX = dx * c + dz * s;
        const localZ = -dx * s + dz * c;
        const halfX = (records[offset + 3] * exaggeration * state.footprintScale * .5 + radius) / state.worldScale;
        const halfZ = (records[offset + 5] * exaggeration * state.footprintScale * .5 + radius) / state.worldScale;
        if (Math.abs(localX) < halfX && Math.abs(localZ) < halfZ) return true;
      }
      return false;
    };
    const collidesBuilding = (x, z) => collidesBuildingWithRadius(x, z, state.playerCollisionRadius);
    const findReducedColliderPassage = () => {
      if (state.worldMode !== 'local' || !localAssets.preview) return null;
      const records = localAssets.preview.buildings;
      const exaggeration = metadata.display.buildingHorizontalExaggeration;
      const oldRadius = state.playerPreviousCollisionRadius;
      const newRadius = state.playerCollisionRadius;
      const margin = (oldRadius + newRadius) * .5 / state.worldScale;
      const tangentStep = .34 / state.worldScale;
      for (let offset = 0; offset < records.length; offset += 8) {
        const centerX = records[offset];
        const centerZ = records[offset + 2];
        const angle = records[offset + 6];
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        const halfX = records[offset + 3] * exaggeration * state.footprintScale * .5 / state.worldScale;
        const halfZ = records[offset + 5] * exaggeration * state.footprintScale * .5 / state.worldScale;
        const tests = [
          { localX: halfX + margin, localZ: 0, tangentX: -s * tangentStep, tangentZ: c * tangentStep },
          { localX: -halfX - margin, localZ: 0, tangentX: -s * tangentStep, tangentZ: c * tangentStep },
          { localX: 0, localZ: halfZ + margin, tangentX: c * tangentStep, tangentZ: s * tangentStep },
          { localX: 0, localZ: -halfZ - margin, tangentX: c * tangentStep, tangentZ: s * tangentStep }
        ];
        for (const test of tests) {
          const x = centerX + test.localX * c - test.localZ * s;
          const z = centerZ + test.localX * s + test.localZ * c;
          const terrain = sampleTerrainInfo(x, z);
          const newClear = terrain.land && !collidesBuildingWithRadius(x, z, newRadius);
          const oldBlocked = collidesBuildingWithRadius(x, z, oldRadius);
          const tangentClear = newClear
            && !collidesBuildingWithRadius(x + test.tangentX, z + test.tangentZ, newRadius)
            && !collidesBuildingWithRadius(x - test.tangentX, z - test.tangentZ, newRadius);
          if (newClear && oldBlocked && tangentClear) {
            return {
              x, z,
              clearanceDisplay: margin * state.worldScale,
              newRadius,
              oldRadius,
              newClear,
              oldBlocked,
              tangentClear
            };
          }
        }
      }
      return null;
    };
    const movePlayer = (dx, dz) => {`,
  'reduced player collider and passage probe'
);

html = replaceOnce(
  html,
  `      const playerDisplay = toDisplayXZ(state.camera.x, state.camera.z);
      const facing = state.playerFacing;
      const c = Math.cos(facing), s = Math.sin(facing);
      const drawPart = (localX, localY, localZ, scaleX, scaleY, scaleZ, red, green, blue) => {
        const worldX = playerDisplay.x + localX * c + localZ * s;
        const worldZ = playerDisplay.z - localX * s + localZ * c;
        gl.uniform3f(characterUniforms.center, worldX, baseY + localY, worldZ);
        gl.uniform3f(characterUniforms.scale, scaleX, scaleY, scaleZ);`,
  `      const playerDisplay = toDisplayXZ(state.camera.x, state.camera.z);
      const facing = state.playerFacing;
      const bodyScale = state.playerVisualScale;
      const c = Math.cos(facing), s = Math.sin(facing);
      const drawPart = (localX, localY, localZ, scaleX, scaleY, scaleZ, red, green, blue) => {
        const worldX = playerDisplay.x + (localX * c + localZ * s) * bodyScale;
        const worldZ = playerDisplay.z + (-localX * s + localZ * c) * bodyScale;
        gl.uniform3f(characterUniforms.center, worldX, baseY + localY * bodyScale, worldZ);
        gl.uniform3f(characterUniforms.scale, scaleX * bodyScale, scaleY * bodyScale, scaleZ * bodyScale);`,
  'uniformly smaller monkey model'
);

html = replaceOnce(html, '      gl.clearColor(.25,.40,.46,1);', '      gl.clearColor(.39,.555,.655,1);', 'enhanced atmospheric clear color');

html = replaceOnce(
  html,
  `      probeCollision() {
        const records = state.worldMode === 'local' ? localAssets.preview.buildings : streamer.active;
        return records.length >= 8 ? collidesBuilding(records[0], records[2]) : false;
      },`,
  `      probeCollision() {
        const records = state.worldMode === 'local' ? localAssets.preview.buildings : streamer.active;
        return records.length >= 8 ? collidesBuilding(records[0], records[2]) : false;
      },
      probeNarrowPassage() { return findReducedColliderPassage(); },`,
  'public narrow-passage probe'
);

html = html.replaceAll(
  `localProximityUpdates: state.localProximityUpdates, renderDataset`,
  `localProximityUpdates: state.localProximityUpdates, playerVisualScale: state.playerVisualScale, playerCollisionRadius: state.playerCollisionRadius, playerEyeHeight: state.playerEyeHeight, graphicsProfile: state.graphicsProfile, renderDataset`
);
html = replaceOnce(
  html,
  `          localProximityUpdates: state.localProximityUpdates,
          playerFacing: state.playerFacing,`,
  `          localProximityUpdates: state.localProximityUpdates,
          playerVisualScale: state.playerVisualScale,
          playerCollisionRadius: state.playerCollisionRadius,
          playerEyeHeight: state.playerEyeHeight,
          graphicsProfile: state.graphicsProfile,
          playerFacing: state.playerFacing,`,
  'periodic player metrics'
);
html = replaceOnce(
  html,
  `      version: '009',
      metadata,`,
  `      version: '009',
      playerMetrics: { visualScale: state.playerVisualScale, collisionRadius: state.playerCollisionRadius, eyeHeight: state.playerEyeHeight, previousCollisionRadius: state.playerPreviousCollisionRadius, graphicsProfile: state.graphicsProfile },
      metadata,`,
  'public player metrics'
);

assert(html.includes("version: '009'"), 'Runtime 009 API version is missing');
assert(html.includes("graphicsProfile: 'enhanced-mobile-v1'"), 'Runtime 009 graphics profile is missing');
assert(html.includes('playerVisualScale: .58'), 'Runtime 009 visual scale is missing');
assert(html.includes('playerCollisionRadius: .16'), 'Runtime 009 collision radius is missing');
assert(html.includes('probeNarrowPassage()'), 'Runtime 009 narrow passage probe is missing');
assert(html.includes('furVariation'), 'Runtime 009 enhanced character shader is missing');
assert(html.includes('floorBand'), 'Runtime 009 enhanced building shader is missing');
assert(!html.includes("version: '008'"), 'Runtime 009 still exposes version 008');

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, html);
const outputBuffer = fs.readFileSync(outputPath);
const report = {
  formatVersion: 1,
  buildRevision: BUILD_REVISION,
  runtimeVersion: '009',
  source: path.relative(ROOT, sourcePath).replaceAll(path.sep, '/'),
  output: path.relative(ROOT, outputPath).replaceAll(path.sep, '/'),
  sourceSha256: sha256(fs.readFileSync(sourcePath)),
  outputSha256: sha256(outputBuffer),
  outputBytes: outputBuffer.length,
  player: {
    visualScale: .58,
    collisionRadius: .16,
    previousCollisionRadius: .34,
    eyeHeight: .82
  },
  graphics: {
    profile: 'enhanced-mobile-v1',
    enhancedTerrainLighting: true,
    enhancedMediterraneanPalette: true,
    enhancedBuildingMaterials: true,
    enhancedCharacterShading: true
  },
  behavior: {
    geographicZoneDetectionPreserved: true,
    localPackageLifecyclePreserved: true,
    narrowPassageProbeIncluded: true,
    protectedPreviousRuntime: true
  }
};
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
