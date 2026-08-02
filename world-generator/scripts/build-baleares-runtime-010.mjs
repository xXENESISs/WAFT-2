import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const BUILD_REVISION = 1;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourcePath = path.join(ROOT, 'mallorca-mobile/region-runtime-baleares-009.html');
const outputPath = path.join(ROOT, 'mallorca-mobile/region-runtime-baleares-010.html');
const reportPath = path.join(ROOT, 'world-generator/baleares-runtime-010-build.json');

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
html = html.replaceAll('Runtime regional de Baleares 009', 'Runtime regional de Baleares 010');
html = html.replaceAll('RUNTIME REGIONAL 009', 'RUNTIME REGIONAL 010');
html = html.replaceAll('__WAFT_RUNTIME_009_', '__WAFT_RUNTIME_010_');
html = html.replace("      version: '009',", "      version: '010',");
html = html.replace('Preparando escala animal y gráficos mejorados…', 'Preparando locomoción terrestre, montaña y natación…');
html = html.replace('Joystick: mover · Arrastrar: orbitar · ZONA LOCAL:', 'Joystick: correr/nadar · Arrastrar: orbitar · ⤒: salto alto · ZONA LOCAL:');

html = replaceOnce(
  html,
  `    graphicsProfile: 'enhanced-mobile-v1'`,
  `    graphicsProfile: 'enhanced-mobile-v2',
    movementMode: 'ground',
    swimming: false,
    playerSwimEyeHeight: .46,
    runSpeed: 7.2,
    swimSpeed: 5.2,
    jumpVelocity: 8.8,
    gravity: 13.5,
    terrainPitch: 0,
    terrainRoll: 0,
    slopeAngle: 0,
    slopeSpeedFactor: 1,
    groundHeight: 0,
    waterSurfaceHeight: 0,
    swimStroke: 0`,
  'terrain locomotion state'
);

html = replaceOnce(
  html,
  `        vec3 base=mix(warm,cool,altitude*.28);
        vec3 lit=base*(hemisphere+sun*.54)*slopeShade;`,
  `        vec3 base=mix(warm,cool,altitude*.28);
        float waterMask=smoothstep(.035,.15,vColor.b-vColor.r)*smoothstep(.015,.11,vColor.b-vColor.g);
        float wave=.92+.08*sin(vWorld.x*.34+vWorld.z*.29)+.035*sin(vWorld.x*.91-vWorld.z*.63);
        vec3 waterColor=mix(vec3(.025,.18,.31),vec3(.075,.36,.49),clamp(sun*.75+.15,0.0,1.0))*wave;
        base=mix(base,waterColor,waterMask);
        vec3 lit=base*(hemisphere+sun*.54)*slopeShade;`,
  'water surface shading'
);

html = replaceOnce(
  html,
  `      uniform mat4 uPV; uniform vec3 uCenter; uniform vec3 uScale; uniform float uYaw;`,
  `      uniform mat4 uPV; uniform vec3 uCenter; uniform vec3 uScale; uniform float uYaw; uniform float uPitch; uniform float uRoll;`,
  'character terrain-alignment uniforms'
);

html = replaceOnce(
  html,
  `        float c=cos(uYaw),s=sin(uYaw);
        vec3 local=aPosition*uScale;
        vec3 rotated=vec3(local.x*c+local.z*s,local.y,-local.x*s+local.z*c);
        vWorld=uCenter+rotated;
        vec3 adjusted=normalize(vec3(aNormal.x/max(uScale.x,.001),aNormal.y/max(uScale.y,.001),aNormal.z/max(uScale.z,.001)));
        vNormal=normalize(vec3(adjusted.x*c+adjusted.z*s,adjusted.y,-adjusted.x*s+adjusted.z*c));`,
  `        float c=cos(uYaw),s=sin(uYaw),cp=cos(uPitch),sp=sin(uPitch),cr=cos(uRoll),sr=sin(uRoll);
        vec3 local=aPosition*uScale;
        vec3 rolled=vec3(local.x*cr-local.y*sr,local.x*sr+local.y*cr,local.z);
        vec3 pitched=vec3(rolled.x,rolled.y*cp-rolled.z*sp,rolled.y*sp+rolled.z*cp);
        vec3 rotated=vec3(pitched.x*c+pitched.z*s,pitched.y,-pitched.x*s+pitched.z*c);
        vWorld=uCenter+rotated;
        vec3 adjusted=normalize(vec3(aNormal.x/max(uScale.x,.001),aNormal.y/max(uScale.y,.001),aNormal.z/max(uScale.z,.001)));
        vec3 adjustedRoll=vec3(adjusted.x*cr-adjusted.y*sr,adjusted.x*sr+adjusted.y*cr,adjusted.z);
        vec3 adjustedPitch=vec3(adjustedRoll.x,adjustedRoll.y*cp-adjustedRoll.z*sp,adjustedRoll.y*sp+adjustedRoll.z*cp);
        vNormal=normalize(vec3(adjustedPitch.x*c+adjustedPitch.z*s,adjustedPitch.y,-adjustedPitch.x*s+adjustedPitch.z*c));`,
  'character pitch and roll shader transform'
);

html = replaceBetween(
  html,
  `    const sampleTerrainInfo = (x, z) => {`,
  `    const collidesBuildingWithRadius = (x, z, radius) => {`,
  `    const sampleTerrainInfo = (x, z) => {
      const sourceTerrain = state.worldMode === 'local' ? localAssets.terrainMesh : terrainMesh;
      const bounds = sourceTerrain.bounds;
      const fx = (x - bounds.minX) / (bounds.maxX - bounds.minX) * (sourceTerrain.columns - 1);
      const fz = (z - bounds.minZ) / (bounds.maxZ - bounds.minZ) * (sourceTerrain.rows - 1);
      const waterHeight = -8 * sourceTerrain.verticalScale;
      if (fx < 0 || fz < 0 || fx > sourceTerrain.columns - 1 || fz > sourceTerrain.rows - 1) {
        return { inside: false, land: false, water: false, height: waterHeight, waterHeight, normal: { x: 0, y: 1, z: 0 }, slopeAngle: 0 };
      }
      const columns = sourceTerrain.columns;
      const rows = sourceTerrain.rows;
      const rawAt = (column, row) => sourceTerrain.elevations[Math.max(0, Math.min(rows - 1, row)) * columns + Math.max(0, Math.min(columns - 1, column))];
      const nearestColumn = Math.max(0, Math.min(columns - 1, Math.round(fx)));
      const nearestRow = Math.max(0, Math.min(rows - 1, Math.round(fz)));
      const nearestRaw = rawAt(nearestColumn, nearestRow);
      if (nearestRaw === sourceTerrain.nodata) {
        return { inside: true, land: false, water: true, height: waterHeight, waterHeight, normal: { x: 0, y: 1, z: 0 }, slopeAngle: 0 };
      }
      const column0 = Math.floor(fx), row0 = Math.floor(fz);
      const column1 = Math.min(columns - 1, column0 + 1), row1 = Math.min(rows - 1, row0 + 1);
      const tx = fx - column0, tz = fz - row0;
      const validRaw = (column, row) => {
        const value = rawAt(column, row);
        return value === sourceTerrain.nodata ? nearestRaw : value;
      };
      const h00 = validRaw(column0, row0);
      const h10 = validRaw(column1, row0);
      const h01 = validRaw(column0, row1);
      const h11 = validRaw(column1, row1);
      const rawHeight = (h00 * (1 - tx) + h10 * tx) * (1 - tz) + (h01 * (1 - tx) + h11 * tx) * tz;
      const dx = (bounds.maxX - bounds.minX) / Math.max(1, columns - 1);
      const dz = (bounds.maxZ - bounds.minZ) / Math.max(1, rows - 1);
      const left = validRaw(nearestColumn - 1, nearestRow) * sourceTerrain.verticalScale;
      const right = validRaw(nearestColumn + 1, nearestRow) * sourceTerrain.verticalScale;
      const back = validRaw(nearestColumn, nearestRow - 1) * sourceTerrain.verticalScale;
      const front = validRaw(nearestColumn, nearestRow + 1) * sourceTerrain.verticalScale;
      let nx = -(right - left) / Math.max(.001, 2 * dx * state.worldScale);
      let ny = 1;
      let nz = -(front - back) / Math.max(.001, 2 * dz * state.worldScale);
      const length = Math.hypot(nx, ny, nz) || 1;
      nx /= length; ny /= length; nz /= length;
      return {
        inside: true,
        land: true,
        water: false,
        height: rawHeight * sourceTerrain.verticalScale,
        waterHeight,
        normal: { x: nx, y: ny, z: nz },
        slopeAngle: Math.acos(Math.max(-1, Math.min(1, ny)))
      };
    };
    const collidesBuildingWithRadius = (x, z, radius) => {`,
  'bilinear terrain and water sampling'
);

html = replaceBetween(
  html,
  `    const movePlayer = (dx, dz) => {`,
  `    let lastTime = performance.now(), frames = 0, fpsTime = lastTime, nearestClock = 0;`,
  `    const movePlayer = (dx, dz) => {
      const distance = Math.hypot(dx, dz);
      if (distance < 1e-6) return { moved: 0, waterSteps: 0, landSteps: 0 };
      const steps = Math.max(1, Math.ceil(distance / .12));
      const stepX = dx / steps;
      const stepZ = dz / steps;
      let moved = 0, waterSteps = 0, landSteps = 0;
      for (let step = 0; step < steps; step++) {
        const nextX = state.camera.x + stepX;
        const xTerrain = sampleTerrainInfo(nextX, state.camera.z);
        if (xTerrain.inside && (!xTerrain.land || !collidesBuilding(nextX, state.camera.z))) {
          state.camera.x = nextX;
          moved += Math.abs(stepX);
          if (xTerrain.land) landSteps++; else waterSteps++;
        } else state.collisions++;
        const nextZ = state.camera.z + stepZ;
        const zTerrain = sampleTerrainInfo(state.camera.x, nextZ);
        if (zTerrain.inside && (!zTerrain.land || !collidesBuilding(state.camera.x, nextZ))) {
          state.camera.z = nextZ;
          moved += Math.abs(stepZ);
          if (zTerrain.land) landSteps++; else waterSteps++;
        } else state.collisions++;
      }
      return { moved, waterSteps, landSteps };
    };
    const collidesFullRegionalBuilding = (x, z, radius = state.playerCollisionRadius) => {
      const records = preview.buildings;
      const exaggeration = metadata.display.buildingHorizontalExaggeration;
      for (let offset = 0; offset < records.length; offset += 8) {
        const dx = x - records[offset];
        const dz = z - records[offset + 2];
        const angle = records[offset + 6];
        const c = Math.cos(angle), s = Math.sin(angle);
        const localX = dx * c + dz * s;
        const localZ = -dx * s + dz * c;
        const halfX = records[offset + 3] * exaggeration * .5 + radius;
        const halfZ = records[offset + 5] * exaggeration * .5 + radius;
        if (Math.abs(localX) < halfX && Math.abs(localZ) < halfZ) return true;
      }
      return false;
    };
    let locomotionProbes = null;
    const buildLocomotionProbes = () => {
      if (locomotionProbes) return locomotionProbes;
      const source = terrainMesh;
      const bounds = source.bounds;
      const columns = source.columns, rows = source.rows;
      const dx = (bounds.maxX - bounds.minX) / (columns - 1);
      const dz = (bounds.maxZ - bounds.minZ) / (rows - 1);
      const rawAt = (column, row) => source.elevations[row * columns + column];
      let mountain = null;
      const directions = [[1,0],[-1,0],[0,1],[0,-1]];
      for (let row = 2; row < rows - 2; row++) {
        for (let column = 2; column < columns - 2; column++) {
          const baseRaw = rawAt(column, row);
          if (baseRaw === source.nodata) continue;
          for (const [dc, dr] of directions) {
            const targetRaw = rawAt(column + dc, row + dr);
            if (targetRaw === source.nodata || targetRaw <= baseRaw) continue;
            const rise = (targetRaw - baseRaw) * source.verticalScale;
            const horizontal = Math.hypot(dc * dx, dr * dz);
            const angle = Math.atan2(rise, horizontal);
            if (rise < .18 || angle < .08 || angle > .92) continue;
            const startX = bounds.minX + column * dx;
            const startZ = bounds.minZ + row * dz;
            const targetX = bounds.minX + (column + dc) * dx;
            const targetZ = bounds.minZ + (row + dr) * dz;
            if (collidesFullRegionalBuilding(startX, startZ) || collidesFullRegionalBuilding(targetX, targetZ)) continue;
            const score = angle * 4 + rise * .15 + Math.max(0, baseRaw) * .0003;
            if (!mountain || score > mountain.score) {
              const directionLength = Math.hypot(targetX - startX, targetZ - startZ) || 1;
              const directionX = (targetX - startX) / directionLength;
              const directionZ = (targetZ - startZ) / directionLength;
              mountain = {
                start: { x: startX, z: startZ },
                target: { x: targetX, z: targetZ },
                direction: { x: directionX, z: directionZ },
                yaw: Math.atan2(directionX, directionZ),
                rise,
                angle,
                score,
                suggestedMilliseconds: 260
              };
            }
          }
        }
      }
      const palma = metadata.presets.find(item => item.id === 'palma');
      const menorca = metadata.presets.find(item => item.id === 'menorca');
      let water = null;
      if (palma && menorca) {
        const routeX = menorca.x - palma.x;
        const routeZ = menorca.z - palma.z;
        const routeLength = Math.hypot(routeX, routeZ) || 1;
        const directionX = routeX / routeLength;
        const directionZ = routeZ / routeLength;
        for (let t = .22; t <= .78 && !water; t += .008) {
          const x = palma.x + routeX * t;
          const z = palma.z + routeZ * t;
          let clear = true;
          for (let sample = -2; sample <= 8; sample++) {
            const terrain = sampleTerrainInfo(x + directionX * sample * .9, z + directionZ * sample * .9);
            if (!terrain.inside || terrain.land) { clear = false; break; }
          }
          if (clear) {
            water = {
              start: { x, z },
              direction: { x: directionX, z: directionZ },
              yaw: Math.atan2(directionX, directionZ),
              route: 'Mallorca-Menorca',
              suggestedMilliseconds: 700
            };
          }
        }
      }
      assert(mountain, 'No mountain locomotion probe could be generated');
      assert(water, 'No open-water locomotion probe could be generated');
      locomotionProbes = { mountain, water };
      return locomotionProbes;
    };
    let lastTime = performance.now(), frames = 0, fpsTime = lastTime, nearestClock = 0;`,
  'mountain and swimming movement system'
);

html = replaceOnce(
  html,
  `      camera: gl.getUniformLocation(characterProgram, 'uCamera')`,
  `      camera: gl.getUniformLocation(characterProgram, 'uCamera'),
      pitch: gl.getUniformLocation(characterProgram, 'uPitch'),
      roll: gl.getUniformLocation(characterProgram, 'uRoll')`,
  'character alignment uniform locations'
);

html = replaceOnce(
  html,
  `        if (!terrain.land || terrain.height + .28 > point[1] || collidesBuilding(regional.x, regional.z)) {`,
  `        if ((terrain.land && terrain.height + .28 > point[1]) || collidesBuilding(regional.x, regional.z)) {`,
  'camera travel over water'
);

html = replaceBetween(
  html,
  `    const drawCharacter = (now, cameraPosition) => {`,
  `    const draw = now => {`,
  `    const updateTerrainAlignment = dt => {
      if (state.swimming) {
        const blend = Math.min(1, dt * 5.5);
        state.terrainPitch += (-.48 - state.terrainPitch) * blend;
        state.terrainRoll += (0 - state.terrainRoll) * blend;
        state.slopeAngle = 0;
        return;
      }
      const sampleDistance = .55 / Math.max(1, state.worldScale);
      const forwardX = Math.sin(state.playerFacing), forwardZ = Math.cos(state.playerFacing);
      const rightX = Math.cos(state.playerFacing), rightZ = -Math.sin(state.playerFacing);
      const forward = sampleTerrainInfo(state.camera.x + forwardX * sampleDistance, state.camera.z + forwardZ * sampleDistance);
      const backward = sampleTerrainInfo(state.camera.x - forwardX * sampleDistance, state.camera.z - forwardZ * sampleDistance);
      const right = sampleTerrainInfo(state.camera.x + rightX * sampleDistance, state.camera.z + rightZ * sampleDistance);
      const left = sampleTerrainInfo(state.camera.x - rightX * sampleDistance, state.camera.z - rightZ * sampleDistance);
      const horizontal = sampleDistance * 2 * state.worldScale;
      const targetPitch = forward.land && backward.land ? -Math.atan2(forward.height - backward.height, horizontal) : 0;
      const targetRoll = right.land && left.land ? Math.atan2(right.height - left.height, horizontal) : 0;
      const blend = Math.min(1, dt * 8);
      state.terrainPitch += (Math.max(-.62, Math.min(.62, targetPitch)) - state.terrainPitch) * blend;
      state.terrainRoll += (Math.max(-.48, Math.min(.48, targetRoll)) - state.terrainRoll) * blend;
    };
    const drawCharacter = (now, cameraPosition) => {
      const phase = now * (state.swimming ? .0085 : .012);
      const gait = Math.sin(phase) * state.moveAmount;
      const bounce = state.swimming ? Math.sin(phase * .7) * .018 : Math.abs(Math.sin(phase)) * .024 * state.moveAmount;
      const baseOffset = state.swimming ? state.playerSwimEyeHeight : state.playerEyeHeight;
      const baseY = state.camera.y - baseOffset + bounce;
      const playerDisplay = toDisplayXZ(state.camera.x, state.camera.z);
      const facing = state.playerFacing;
      const bodyScale = state.playerVisualScale;
      const pitch = state.terrainPitch;
      const roll = state.terrainRoll;
      const c = Math.cos(facing), s = Math.sin(facing), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
      const rotateLocal = (localX, localY, localZ) => {
        const rolledX = localX * cr - localY * sr;
        const rolledY = localX * sr + localY * cr;
        const pitchedY = rolledY * cp - localZ * sp;
        const pitchedZ = rolledY * sp + localZ * cp;
        return {
          x: rolledX * c + pitchedZ * s,
          y: pitchedY,
          z: -rolledX * s + pitchedZ * c
        };
      };
      const drawPart = (localX, localY, localZ, scaleX, scaleY, scaleZ, red, green, blue) => {
        const rotated = rotateLocal(localX * bodyScale, localY * bodyScale, localZ * bodyScale);
        gl.uniform3f(characterUniforms.center, playerDisplay.x + rotated.x, baseY + rotated.y, playerDisplay.z + rotated.z);
        gl.uniform3f(characterUniforms.scale, scaleX * bodyScale, scaleY * bodyScale, scaleZ * bodyScale);
        gl.uniform1f(characterUniforms.yaw, facing);
        gl.uniform1f(characterUniforms.pitch, pitch);
        gl.uniform1f(characterUniforms.roll, roll);
        gl.uniform3f(characterUniforms.color, red, green, blue);
        gl.drawElements(gl.TRIANGLES, characterMesh.count, gl.UNSIGNED_SHORT, 0);
      };
      const swim = state.swimming ? 1 : 0;
      const armStroke = swim ? Math.sin(phase) * .46 : gait * .18;
      const legStroke = swim ? Math.sin(phase + Math.PI) * .28 : gait * .16;
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
      drawPart(-.42, .84, armStroke, .13, .45, .13, .29, .22, .16);
      drawPart(.42, .84, -armStroke, .13, .45, .13, .29, .22, .16);
      drawPart(-.43, .41, armStroke * 1.08, .16, .15, .15, .20, .16, .12);
      drawPart(.43, .41, -armStroke * 1.08, .16, .15, .15, .20, .16, .12);
      drawPart(-.20, .33, -legStroke, .15, .36, .16, .31, .23, .17);
      drawPart(.20, .33, legStroke, .15, .36, .16, .31, .23, .17);
      drawPart(-.20, .08, .13 - legStroke, .18, .10, .27, .22, .17, .13);
      drawPart(.20, .08, .13 + legStroke, .18, .10, .27, .22, .17, .13);
      drawPart(0, .72, -.30, .15, .15, .23, .31, .23, .17);
      drawPart(0, .79, -.57, .14, .14, .22, .31, .23, .17);
      drawPart(0, .91, -.82, .13, .13, .20, .31, .23, .17);
      drawPart(0, 1.08, -1.00, .11, .11, .18, .31, .23, .17);
    };

    const draw = now => {`,
  'slope-aligned running and swimming character'
);

html = replaceOnce(
  html,
  `      const speed = 7.2 * (state.boost || keys.has('ShiftLeft') || keys.has('ShiftRight') ? 2.4 : 1);
      const sin = Math.sin(state.yaw);
      const cos = Math.cos(state.yaw);
      const moveX = (sin * normalizedForward + cos * normalizedStrafe) * speed * dt;
      const moveZ = (cos * normalizedForward - sin * normalizedStrafe) * speed * dt;`,
  `      const sin = Math.sin(state.yaw);
      const cos = Math.cos(state.yaw);
      const inputX = sin * normalizedForward + cos * normalizedStrafe;
      const inputZ = cos * normalizedForward - sin * normalizedStrafe;
      const terrainBeforeMove = sampleTerrainInfo(state.camera.x, state.camera.z);
      const swimmingBeforeMove = terrainBeforeMove.inside && !terrainBeforeMove.land;
      const lookAheadDistance = .75 / Math.max(1, state.worldScale);
      const aheadTerrain = inputLength > .001
        ? sampleTerrainInfo(state.camera.x + inputX * lookAheadDistance, state.camera.z + inputZ * lookAheadDistance)
        : terrainBeforeMove;
      const ascentAngle = terrainBeforeMove.land && aheadTerrain.land
        ? Math.atan2(aheadTerrain.height - terrainBeforeMove.height, lookAheadDistance * state.worldScale)
        : 0;
      state.slopeSpeedFactor = swimmingBeforeMove
        ? 1
        : Math.max(.48, Math.min(1.12, 1 - Math.max(0, ascentAngle) * .58 + Math.max(0, -ascentAngle) * .12));
      const boosted = state.boost || keys.has('ShiftLeft') || keys.has('ShiftRight');
      const speed = swimmingBeforeMove
        ? state.swimSpeed * (boosted ? 1.75 : 1)
        : state.runSpeed * (boosted ? 2.4 : 1) * state.slopeSpeedFactor;
      const moveX = inputX * speed * dt;
      const moveZ = inputZ * speed * dt;`,
  'slope-aware running and swimming speed'
);

html = replaceBetween(
  html,
  `      const terrainNow = sampleTerrainInfo(state.camera.x, state.camera.z);`,
  `      const activeTerrain = state.worldMode === 'local' ? localAssets.terrainMesh : terrainMesh;`,
  `      if (state.respawnQueued) {
        const preset = runtimeControls.playable.find(item => item.id === state.activePreset) || runtimeControls.playable[0];
        runtimeControls.spawn(preset);
      }
      const terrainNow = sampleTerrainInfo(state.camera.x, state.camera.z);
      const wasSwimming = state.swimming;
      state.swimming = terrainNow.inside && !terrainNow.land;
      state.movementMode = state.swimming ? 'swimming' : state.grounded ? 'ground' : 'air';
      state.groundHeight = terrainNow.height;
      state.waterSurfaceHeight = terrainNow.waterHeight;
      state.slopeAngle = terrainNow.land ? terrainNow.slopeAngle : 0;
      const ground = terrainNow.height + state.playerEyeHeight;
      const swimSurface = terrainNow.waterHeight + state.playerSwimEyeHeight;
      if (state.swimming) {
        if (state.jumpQueued) state.swimStroke = 1;
        state.velocityY = 0;
        state.grounded = false;
        state.camera.y += (swimSurface - state.camera.y) * Math.min(1, dt * 7);
      } else {
        if (wasSwimming) {
          state.velocityY = 0;
          state.grounded = true;
          state.camera.y = ground;
        }
        if (state.jumpQueued && state.grounded) {
          state.velocityY = state.jumpVelocity;
          state.grounded = false;
        }
        if (!state.grounded) {
          state.velocityY -= state.gravity * dt;
          state.camera.y += state.velocityY * dt;
          if (state.camera.y <= ground) {
            state.camera.y = ground;
            state.velocityY = 0;
            state.grounded = true;
          }
        } else {
          state.camera.y += (ground - state.camera.y) * Math.min(1, dt * 18);
        }
      }
      state.jumpQueued = false;
      state.swimStroke *= Math.max(0, 1 - dt * 2.8);
      updateTerrainAlignment(dt);

      const activeTerrain = state.worldMode === 'local' ? localAssets.terrainMesh : terrainMesh;`,
  'land jump and swimming vertical physics'
);

html = replaceOnce(
  html,
  `      const target = [displayPosition.x, state.camera.y - .07, displayPosition.z];`,
  `      const target = [displayPosition.x, state.camera.y - (state.swimming ? .18 : .07), displayPosition.z];`,
  'swimming camera target'
);
html = replaceOnce(
  html,
  `        target[1] + .76 + Math.sin(state.pitch) * state.cameraDistance,`,
  `        target[1] + (state.swimming ? .48 : .76) + Math.sin(state.pitch) * state.cameraDistance,`,
  'swimming camera height'
);

html = replaceOnce(
  html,
  `        const modeLabel = state.worldMode === 'local' ? 'LOCAL ' + localLabel + ' · PAQUETE ×' + state.worldScale : 'REGIONAL ×1' + proximityHint;`,
  `        const locomotionLabel = state.swimming ? ' · NADANDO' : state.slopeAngle > .12 ? ' · PENDIENTE ' + Math.round(state.slopeAngle * 180 / Math.PI) + '°' : '';
        const modeLabel = (state.worldMode === 'local' ? 'LOCAL ' + localLabel + ' · PAQUETE ×' + state.worldScale : 'REGIONAL ×1' + proximityHint) + locomotionLabel;`,
  'locomotion HUD label'
);

html = replaceOnce(
  html,
  `          graphicsProfile: state.graphicsProfile,
          playerFacing: state.playerFacing,`,
  `          graphicsProfile: state.graphicsProfile,
          movementMode: state.movementMode,
          swimming: state.swimming,
          terrainPitch: state.terrainPitch,
          terrainRoll: state.terrainRoll,
          slopeAngle: state.slopeAngle,
          slopeSpeedFactor: state.slopeSpeedFactor,
          groundHeight: state.groundHeight,
          waterSurfaceHeight: state.waterSurfaceHeight,
          jumpVelocity: state.jumpVelocity,
          swimSpeed: state.swimSpeed,
          runSpeed: state.runSpeed,
          playerFacing: state.playerFacing,`,
  'periodic locomotion stats'
);

html = replaceOnce(
  html,
  `        if (terrainInfo.land) state.camera.y = terrainInfo.height + state.playerEyeHeight;
        state.velocityY = 0;
        state.grounded = true;`,
  `        state.swimming = terrainInfo.inside && !terrainInfo.land;
        state.movementMode = state.swimming ? 'swimming' : 'ground';
        state.camera.y = state.swimming
          ? terrainInfo.waterHeight + state.playerSwimEyeHeight
          : terrainInfo.height + state.playerEyeHeight;
        state.velocityY = 0;
        state.grounded = !state.swimming;`,
  'positioning on land or water'
);

html = replaceOnce(
  html,
  `      detectLocalZone() { return runtimeControls.refreshLocalProximity(true); },`,
  `      detectLocalZone() { return runtimeControls.refreshLocalProximity(true); },
      setHeading(yaw) {
        const value = Number(yaw);
        if (!Number.isFinite(value)) throw new Error('El rumbo debe ser numérico.');
        state.yaw = value;
        state.playerFacing = value;
        return value;
      },
      getLocomotionProbes() { return buildLocomotionProbes(); },
      sampleSurface(x, z) { return sampleTerrainInfo(Number(x), Number(z)); },`,
  'locomotion testing and navigation API'
);

html = replaceOnce(
  html,
  `      getState() { const displayPosition = toDisplayXZ(state.camera.x, state.camera.z); return {`,
  `      getState() { const displayPosition = toDisplayXZ(state.camera.x, state.camera.z); return { movementMode: state.movementMode, swimming: state.swimming, terrainPitch: state.terrainPitch, terrainRoll: state.terrainRoll, slopeAngle: state.slopeAngle, slopeSpeedFactor: state.slopeSpeedFactor, groundHeight: state.groundHeight, waterSurfaceHeight: state.waterSurfaceHeight, jumpVelocity: state.jumpVelocity, swimSpeed: state.swimSpeed, runSpeed: state.runSpeed,`,
  'public locomotion state'
);

html = replaceOnce(
  html,
  `      playerMetrics: { visualScale: state.playerVisualScale, collisionRadius: state.playerCollisionRadius, eyeHeight: state.playerEyeHeight, previousCollisionRadius: state.playerPreviousCollisionRadius, graphicsProfile: state.graphicsProfile },`,
  `      playerMetrics: { visualScale: state.playerVisualScale, collisionRadius: state.playerCollisionRadius, eyeHeight: state.playerEyeHeight, swimEyeHeight: state.playerSwimEyeHeight, previousCollisionRadius: state.playerPreviousCollisionRadius, graphicsProfile: state.graphicsProfile, runSpeed: state.runSpeed, swimSpeed: state.swimSpeed, jumpVelocity: state.jumpVelocity, gravity: state.gravity, terrainAdaptation: true, swimming: true },`,
  'public locomotion metrics'
);

html = replaceOnce(
  html,
  `    window.__WAFT_RUNTIME_010_STATS__ = { totalBuildings:`,
  `    buildLocomotionProbes();
    window.__WAFT_RUNTIME_010_STATS__ = { movementMode: state.movementMode, swimming: state.swimming, terrainPitch: state.terrainPitch, terrainRoll: state.terrainRoll, slopeAngle: state.slopeAngle, slopeSpeedFactor: state.slopeSpeedFactor, groundHeight: state.groundHeight, waterSurfaceHeight: state.waterSurfaceHeight, jumpVelocity: state.jumpVelocity, swimSpeed: state.swimSpeed, runSpeed: state.runSpeed, totalBuildings:`,
  'initial locomotion stats and probe validation'
);

assert(html.includes("version: '010'"), 'Runtime 010 API version is missing');
assert(html.includes("movementMode: 'ground'"), 'Runtime 010 has no movement mode');
assert(html.includes('getLocomotionProbes()'), 'Runtime 010 exposes no terrain probes');
assert(html.includes("route: 'Mallorca-Menorca'"), 'Runtime 010 has no inter-island water probe');
assert(html.includes('state.jumpVelocity = 8.8') || html.includes('jumpVelocity: 8.8'), 'Runtime 010 jump was not increased');
assert(html.includes("graphicsProfile: 'enhanced-mobile-v2'"), 'Runtime 010 graphics profile is missing');
assert(!html.includes('state.velocityY = 4.55;'), 'Runtime 010 retained the low jump velocity');

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, html);
const outputBuffer = fs.readFileSync(outputPath);
const report = {
  formatVersion: 1,
  buildRevision: BUILD_REVISION,
  runtimeVersion: '010',
  source: path.relative(ROOT, sourcePath).replaceAll(path.sep, '/'),
  output: path.relative(ROOT, outputPath).replaceAll(path.sep, '/'),
  sourceSha256: sha256(fs.readFileSync(sourcePath)),
  outputSha256: sha256(outputBuffer),
  outputBytes: outputBuffer.length,
  locomotion: {
    bilinearTerrainFollowing: true,
    slopeAlignedCharacter: true,
    mountainClimbing: true,
    swimmingAcrossRegionalWater: true,
    waterRouteProbe: 'Mallorca-Menorca',
    runSpeed: 7.2,
    swimSpeed: 5.2,
    swimBoostMultiplier: 1.75,
    jumpVelocity: 8.8,
    gravity: 13.5
  },
  graphics: {
    profile: 'enhanced-mobile-v2',
    animatedWaterShading: true,
    terrainAndBuildingEnhancementsPreserved: true
  },
  behavior: {
    geographicZoneDetectionPreserved: true,
    localPackageLifecyclePreserved: true,
    smallerPlayerAndColliderPreserved: true,
    protectedPreviousRuntime: true
  }
};
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
