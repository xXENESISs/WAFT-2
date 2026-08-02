import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourcePath = path.join(ROOT, 'mallorca-mobile/region-runtime-baleares-001.html');
const outputPath = path.join(ROOT, 'mallorca-mobile/region-runtime-baleares-002.html');
const reportPath = path.join(ROOT, 'world-generator/baleares-runtime-002-build.json');

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
html = html.replaceAll('Runtime regional de Baleares 001', 'Runtime regional de Baleares 002');
html = html.replaceAll('RUNTIME REGIONAL 001', 'RUNTIME REGIONAL 002');
html = html.replaceAll('Preparando el primer runtime regional jugable…', 'Preparando el runtime regional en tercera persona…');
html = html.replaceAll('Joystick: caminar · Arrastrar: mirar · ⤒: saltar · ↺: reaparecer', 'Joystick: mover al explorador · Arrastrar: orbitar cámara · ⤒: saltar · ↺: reaparecer');
html = html.replaceAll('__WAFT_RUNTIME_ERROR__', '__WAFT_RUNTIME_002_ERROR__');
html = html.replaceAll('__WAFT_RUNTIME_STATS__', '__WAFT_RUNTIME_002_STATS__');
html = html.replaceAll('__WAFT_RUNTIME_READY__', '__WAFT_RUNTIME_002_READY__');
html = html.replaceAll('#crosshair{position:fixed;', '#crosshair{display:none;position:fixed;');

html = replaceOnce(
  html,
  '    yaw: .4,\n    pitch: -.18,',
  '    yaw: .4,\n    pitch: .28,',
  'initial third-person camera angles'
);
html = replaceOnce(
  html,
  '    collisions: 0\n  };',
  "    collisions: 0,\n    playerFacing: .4,\n    moveAmount: 0,\n    cameraDistance: 6.4,\n    cameraEye: { x: 0, y: 0, z: 0 },\n    cameraBlocked: false,\n    cameraMode: 'third-person'\n  };",
  'third-person state fields'
);
html = replaceOnce(
  html,
  '      state.pitch = Math.max(-1.18, Math.min(.62, state.pitch - dy * .0035));',
  '      state.pitch = Math.max(-.12, Math.min(.72, state.pitch - dy * .0035));',
  'third-person orbit pitch clamp'
);
html = html.replaceAll('      state.pitch = -.18;', '      state.pitch = .28;');

const sphereFunction = String.raw`
  function createSphereGeometry(gl, segments = 12, rings = 8) {
    const vertices = [];
    const indices = [];
    for (let ring = 0; ring <= rings; ring++) {
      const v = ring / rings;
      const theta = v * Math.PI;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);
      for (let segment = 0; segment <= segments; segment++) {
        const u = segment / segments;
        const phi = u * Math.PI * 2;
        const nx = Math.cos(phi) * sinTheta;
        const ny = cosTheta;
        const nz = Math.sin(phi) * sinTheta;
        vertices.push(nx, ny, nz, nx, ny, nz);
      }
    }
    for (let ring = 0; ring < rings; ring++) {
      for (let segment = 0; segment < segments; segment++) {
        const a = ring * (segments + 1) + segment;
        const b = a + segments + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vertexBuffer = buffer(gl, gl.ARRAY_BUFFER, new Float32Array(vertices));
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    const indexBuffer = buffer(gl, gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices));
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bindVertexArray(null);
    return { vao, count: indices.length };
  }
`;
html = replaceOnce(html, '  async function boot() {', `${sphereFunction}\n  async function boot() {`, 'sphere geometry insertion');
html = replaceOnce(
  html,
  '    const settlementMesh = createPointGeometry(gl, preview.settlements, 4);',
  '    const settlementMesh = createPointGeometry(gl, preview.settlements, 4);\n    const characterMesh = createSphereGeometry(gl);',
  'character mesh creation'
);

const characterProgram = String.raw`    const characterProgram = program(gl, `#version 300 es
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
      }`,
      `#version 300 es
      precision highp float; in vec3 vNormal; in vec3 vWorld;
      uniform vec3 uColor; uniform vec3 uCamera; out vec4 outColor;
      void main(){
        float light=.48+.52*max(dot(normalize(vNormal),normalize(vec3(.36,.9,.24))),0.0);
        float rim=pow(1.0-max(dot(normalize(vNormal),normalize(uCamera-vWorld)),0.0),2.0)*.12;
        float fog=smoothstep(300.0,780.0,distance(vWorld.xz,uCamera.xz));
        vec3 color=uColor*light+rim;
        outColor=vec4(mix(color,vec3(.25,.40,.46),fog),1.0);
      }`);`;
html = replaceOnce(
  html,
  '    const runtimeControls = setupControls(metadata, terrainMesh, preview, streamer);',
  `${characterProgram}\n\n    const runtimeControls = setupControls(metadata, terrainMesh, preview, streamer);`,
  'character shader insertion'
);

const thirdPersonHelpers = String.raw`
    const characterUniforms = {
      pv: gl.getUniformLocation(characterProgram, 'uPV'),
      center: gl.getUniformLocation(characterProgram, 'uCenter'),
      scale: gl.getUniformLocation(characterProgram, 'uScale'),
      yaw: gl.getUniformLocation(characterProgram, 'uYaw'),
      color: gl.getUniformLocation(characterProgram, 'uColor'),
      camera: gl.getUniformLocation(characterProgram, 'uCamera')
    };
    const resolveThirdPersonCamera = (target, desired) => {
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
    };
    const drawCharacter = (now, cameraPosition) => {
      const gait = Math.sin(now * .012) * state.moveAmount;
      const bounce = Math.abs(Math.sin(now * .012)) * .045 * state.moveAmount;
      const baseY = state.camera.y - 1.35 + bounce;
      const facing = state.playerFacing;
      const c = Math.cos(facing), s = Math.sin(facing);
      const drawPart = (localX, localY, localZ, scaleX, scaleY, scaleZ, red, green, blue) => {
        const worldX = state.camera.x + localX * c + localZ * s;
        const worldZ = state.camera.z - localX * s + localZ * c;
        gl.uniform3f(characterUniforms.center, worldX, baseY + localY, worldZ);
        gl.uniform3f(characterUniforms.scale, scaleX, scaleY, scaleZ);
        gl.uniform1f(characterUniforms.yaw, facing);
        gl.uniform3f(characterUniforms.color, red, green, blue);
        gl.drawElements(gl.TRIANGLES, characterMesh.count, gl.UNSIGNED_SHORT, 0);
      };
      gl.useProgram(characterProgram);
      gl.uniformMatrix4fv(characterUniforms.pv, false, pv);
      gl.uniform3f(characterUniforms.camera, ...cameraPosition);
      gl.bindVertexArray(characterMesh.vao);
      drawPart(0, .78, 0, .34, .54, .28, .30, .23, .17);
      drawPart(0, 1.12, .02, .40, .38, .32, .36, .28, .20);
      drawPart(0, 1.46, .05, .34, .34, .32, .32, .24, .18);
      drawPart(0, 1.38, .29, .24, .16, .18, .62, .43, .32);
      drawPart(-.31, 1.48, .02, .12, .16, .09, .42, .31, .23);
      drawPart(.31, 1.48, .02, .12, .16, .09, .42, .31, .23);
      drawPart(-.42, .84, gait * .18, .13, .45, .13, .29, .22, .16);
      drawPart(.42, .84, -gait * .18, .13, .45, .13, .29, .22, .16);
      drawPart(-.43, .41, gait * .2, .16, .15, .15, .20, .16, .12);
      drawPart(.43, .41, -gait * .2, .16, .15, .15, .20, .16, .12);
      drawPart(-.20, .33, -gait * .16, .15, .36, .16, .31, .23, .17);
      drawPart(.20, .33, gait * .16, .15, .36, .16, .31, .23, .17);
      drawPart(-.20, .08, .13 - gait * .16, .18, .10, .27, .22, .17, .13);
      drawPart(.20, .08, .13 + gait * .16, .18, .10, .27, .22, .17, .13);
      drawPart(0, .72, -.30, .15, .15, .23, .31, .23, .17);
      drawPart(0, .79, -.57, .14, .14, .22, .31, .23, .17);
      drawPart(0, .91, -.82, .13, .13, .20, .31, .23, .17);
      drawPart(0, 1.08, -1.00, .11, .11, .18, .31, .23, .17);
    };
`;
html = replaceOnce(html, '    const draw = now => {', `${thirdPersonHelpers}\n    const draw = now => {`, 'third-person helper insertion');

const oldMovement = String.raw`      const speed = 7.2 * (state.boost || keys.has('ShiftLeft') || keys.has('ShiftRight') ? 2.4 : 1);
      const sin = Math.sin(state.yaw);
      const cos = Math.cos(state.yaw);
      movePlayer(
        (sin * normalizedForward + cos * normalizedStrafe) * speed * dt,
        (cos * normalizedForward - sin * normalizedStrafe) * speed * dt
      );
      streamer.update(state.camera.x, state.camera.z);`;
const newMovement = String.raw`      const speed = 7.2 * (state.boost || keys.has('ShiftLeft') || keys.has('ShiftRight') ? 2.4 : 1);
      const sin = Math.sin(state.yaw);
      const cos = Math.cos(state.yaw);
      const moveX = (sin * normalizedForward + cos * normalizedStrafe) * speed * dt;
      const moveZ = (cos * normalizedForward - sin * normalizedStrafe) * speed * dt;
      state.moveAmount = Math.min(1, Math.hypot(normalizedStrafe, normalizedForward));
      if (Math.hypot(moveX, moveZ) > .0001) {
        const desiredFacing = Math.atan2(moveX, moveZ);
        const turn = Math.atan2(Math.sin(desiredFacing - state.playerFacing), Math.cos(desiredFacing - state.playerFacing));
        state.playerFacing += turn * Math.min(1, dt * 10);
      }
      movePlayer(moveX, moveZ);
      streamer.update(state.camera.x, state.camera.z);`;
html = replaceOnce(html, oldMovement, newMovement, 'movement and character orientation');

const oldCamera = String.raw`      const cp = Math.cos(state.pitch);
      const fx = Math.sin(state.yaw) * cp;
      const fy = Math.sin(state.pitch);
      const fz = Math.cos(state.yaw) * cp;
      const eye = [state.camera.x, state.camera.y, state.camera.z];
      const center = [eye[0] + fx, eye[1] + fy, eye[2] + fz];
      perspective(projection, Math.PI / 3, canvas.width / canvas.height, .12, 1450);
      lookAt(view, eye, center, [0,1,0]);
      multiply(pv, projection, view);`;
const newCamera = String.raw`      const target = [state.camera.x, state.camera.y - .18, state.camera.z];
      const horizontalDistance = state.cameraDistance * Math.cos(state.pitch);
      const desiredEye = [
        target[0] - Math.sin(state.yaw) * horizontalDistance,
        target[1] + 1.15 + Math.sin(state.pitch) * state.cameraDistance,
        target[2] - Math.cos(state.yaw) * horizontalDistance
      ];
      const eye = resolveThirdPersonCamera(target, desiredEye);
      state.cameraEye.x = eye[0]; state.cameraEye.y = eye[1]; state.cameraEye.z = eye[2];
      const center = [target[0], target[1] + .32, target[2]];
      perspective(projection, Math.PI / 3, canvas.width / canvas.height, .12, 1450);
      lookAt(view, eye, center, [0,1,0]);
      multiply(pv, projection, view);`;
html = replaceOnce(html, oldCamera, newCamera, 'third-person camera calculation');
html = replaceOnce(
  html,
  '      gl.bindVertexArray(null);',
  '      drawCharacter(now, eye);\n      gl.bindVertexArray(null);',
  'character rendering call'
);

html = html.replaceAll(
  '          grounded: state.grounded,\n          webgl2: true,',
  "          grounded: state.grounded,\n          cameraMode: 'third-person',\n          characterVisible: true,\n          playerFacing: state.playerFacing,\n          cameraBlocked: state.cameraBlocked,\n          cameraEye: { ...state.cameraEye },\n          webgl2: true,"
);
html = replaceOnce(
  html,
  '      getState() { return { position: { ...state.camera }, grounded: state.grounded, activeBuildings: state.activeBuildings, loadedCells: state.loadedCells, collisions: state.collisions, preset: state.activePreset }; },\n      metadata',
  "      getState() { return { position: { ...state.camera }, cameraEye: { ...state.cameraEye }, playerFacing: state.playerFacing, cameraMode: 'third-person', characterVisible: true, cameraBlocked: state.cameraBlocked, grounded: state.grounded, activeBuildings: state.activeBuildings, loadedCells: state.loadedCells, collisions: state.collisions, preset: state.activePreset }; },\n      version: '002',\n      metadata",
  'runtime 002 state API'
);
html = replaceOnce(
  html,
  'window.__WAFT_RUNTIME_002_STATS__ = { totalBuildings: metadata.counts.buildings, activeBuildings: state.activeBuildings, loadedCells: state.loadedCells, collisions: 0, grounded: true, webgl2: true, buildId: metadata.buildId, binarySha256: metadata.binary.sha256, position: { ...state.camera } };',
  "window.__WAFT_RUNTIME_002_STATS__ = { totalBuildings: metadata.counts.buildings, activeBuildings: state.activeBuildings, loadedCells: state.loadedCells, collisions: 0, grounded: true, cameraMode: 'third-person', characterVisible: true, playerFacing: state.playerFacing, cameraBlocked: state.cameraBlocked, cameraEye: { ...state.cameraEye }, webgl2: true, buildId: metadata.buildId, binarySha256: metadata.binary.sha256, position: { ...state.camera } };",
  'initial runtime 002 stats'
);

assert(html.includes('createSphereGeometry'), 'Character geometry is missing');
assert(html.includes('resolveThirdPersonCamera'), 'Third-person camera resolver is missing');
assert(html.includes("cameraMode: 'third-person'"), 'Third-person state marker is missing');
assert(html.includes('window.__WAFT_RUNTIME_002_READY__=true'), 'Runtime 002 ready marker is missing');
assert(!html.includes('RUNTIME REGIONAL 001'), 'Runtime 001 title leaked into runtime 002');

fs.writeFileSync(outputPath, html);
const report = {
  formatVersion: 1,
  runtimeVersion: '002',
  valid: true,
  source: path.relative(ROOT, sourcePath).replaceAll(path.sep, '/'),
  output: path.relative(ROOT, outputPath).replaceAll(path.sep, '/'),
  sourceSha256: sha256(fs.readFileSync(sourcePath)),
  outputSha256: sha256(Buffer.from(html)),
  outputBytes: Buffer.byteLength(html),
  features: [
    'third-person-orbit-camera',
    'camera-terrain-and-building-occlusion',
    'visible-procedural-macaque-placeholder',
    'movement-facing-and-walk-animation',
    'gravity-jump-and-safe-respawn',
    'building-cell-streaming',
    'mobile-touch-controls'
  ]
};
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
