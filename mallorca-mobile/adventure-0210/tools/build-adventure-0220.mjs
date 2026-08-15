import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, '..');
const parts = [0,1,2,3].map(i => fs.readFileSync(path.join(root, `gameplay-plugin.part0${i}.txt`), 'utf8'));
let source = parts.join('');

function replaceRequired(search, replacement, label = String(search).slice(0,80)) {
  if (!source.includes(search)) throw new Error(`Missing Adventure build anchor: ${label}`);
  source = source.replace(search, replacement);
}
function replaceRegexRequired(pattern, replacement, label) {
  if (!pattern.test(source)) throw new Error(`Missing Adventure build pattern: ${label}`);
  source = source.replace(pattern, replacement);
}

replaceRequired("window.__WAFT_ADVENTURE_BUILD__ || '0.21.0'", "window.__WAFT_ADVENTURE_BUILD__ || '0.22.0'", 'build id');
replaceRequired(
`    hideBaseCharacter: true,
    afterWorldDraw(now, eye, pv) {`,
`    hideBaseCharacter: true,
    rebaseRegionalEntities(project) { renderer.rebaseRegionalEntities(project); },
    getRendererState() { return { regionalEntitiesDrawn: renderer.regionalEntitiesDrawn || 0, sharedWorldContext: Boolean(renderer.sharedWorldContext) }; },
    afterWorldDraw(now, eye, pv) {`,
  'floating-origin entity API'
);
replaceRequired("top.innerHTML = '<button id=\"waftAuto\" type=\"button\">AUTO</button><button id=\"waftCheckpoints\" type=\"button\">PUNTOS</button><button id=\"waftSave\" type=\"button\">GUARDAR</button>';", "top.innerHTML = '<button id=\"waftAuto\" type=\"button\">AUTO</button><button id=\"waftCheckpoints\" type=\"button\">RUTA</button><button id=\"waftSave\" type=\"button\">GUARDAR</button>';", 'route button');
replaceRequired(
  "#waftJump{--charge:0;position:fixed;z-index:27;right:max(20px,env(safe-area-inset-right));bottom:max(24px,env(safe-area-inset-bottom));width:88px;height:88px;border-radius:50%;padding:0;background:radial-gradient(circle,#245d70 0 57%,transparent 59%),conic-gradient(#f2c766 calc(var(--charge)*1turn),#ffffff25 0);font-size:12px}#waftJump.charging{transform:scale(calc(.98 + var(--charge)*.07));filter:brightness(1.18)}",
  "#waftJump{--charge:0;position:fixed;z-index:27;right:max(20px,env(safe-area-inset-right));bottom:max(24px,env(safe-area-inset-bottom));width:88px;height:88px;border-radius:50%;padding:0;background:radial-gradient(circle,#245d70 0 57%,transparent 59%),conic-gradient(#f2c766 calc(var(--charge)*1turn),#ffffff25 0);font-size:12px}#waftJump.charging{transform:scale(calc(.98 + var(--charge)*.07));filter:brightness(1.18)}#waftMountBadge{display:none;position:fixed;z-index:27;right:max(14px,env(safe-area-inset-right));bottom:max(118px,calc(env(safe-area-inset-bottom) + 118px));padding:7px 10px;border-radius:999px;background:rgba(7,22,28,.94);border:1px solid #e7bd6366;color:#ffe7ad;font-size:10px;font-weight:900;letter-spacing:.04em}#waftMountBadge.visible{display:block}",
  'mount badge css'
);
replaceRequired(
  "    document.body.appendChild(jump);\n\n    const action = document.createElement('button');",
  "    document.body.appendChild(jump);\n    const mountBadge = document.createElement('div');\n    mountBadge.id = 'waftMountBadge';\n    document.body.appendChild(mountBadge);\n\n    const action = document.createElement('button');",
  'mount badge ui'
);
replaceRequired("panel.innerHTML = '<strong>PUNTOS DE EXPEDICIÓN</strong><small>Guarda tres posiciones del mapa regional.</small>'", "panel.innerHTML = '<strong>RUTA DE EXPEDICIÓN</strong><small>Marca hasta tres puntos; al abrir este panel verás la ruta sobre el terreno.</small>'", 'route panel title');

replaceRequired(
`      api.setAdventureModifiers({ jumpVelocity: BASE_SPEEDS.jumpVelocity + charge * 7.2 });
      api.jump();
      setTimeout(() => api.setAdventureModifiers({ jumpVelocity: BASE_SPEEDS.jumpVelocity }), 220);`,
`      const mounted = game.animals.find(item => item.id === game.mountedAnimalId);
      if (mounted?.type === 'vulture') {
        api.setAdventureModifiers({ flightFlap: 3.8 + charge * 6.4 });
        jump.textContent = 'ALETEAR';
        return;
      }
      api.setAdventureModifiers({ jumpVelocity: BASE_SPEEDS.jumpVelocity + charge * 7.2 });
      api.jump();
      setTimeout(() => api.setAdventureModifiers({ jumpVelocity: BASE_SPEEDS.jumpVelocity }), 220);`,
  'charged flap'
);

replaceRequired("      mountable: Boolean(options.mountable), aquatic: Boolean(options.aquatic), flying: Boolean(options.flying),", "      mountable: Boolean(options.mountable), aquatic: Boolean(options.aquatic), flying: Boolean(options.flying), flightMountReady: false, landed: false,", 'animal flight state');
replaceRequired("['cow-1','cow','Vaca menorquina',land(menorca, 5, 4),{mountable:true,speed:.18}]", "['cow-1','cow','Vaca vermella menorquina',land(menorca, 5, 4),{speed:.18}]", 'Baleares cow');
replaceRequired("['pig-1','pig','Porc negre mallorquí',land(llevant, -7, 8),{mountable:true,speed:.22}]", "['pig-1','pig','Porc negre mallorquí',land(llevant, -7, 8),{speed:.22}]", 'Baleares pig');
replaceRequired("['vulture-1','vulture','Buitre negro',land(alcudia, -14, -8),{flying:true,speed:.34}]", "['vulture-1','vulture','Buitre negro',land(alcudia, -14, -8),{flying:true,mountable:true,speed:.34}]", 'Baleares vulture mount');
replaceRequired("['cow-cat','cow','Vaca pirenaica',land(menorca, -5, 6),{mountable:true,speed:.18}]", "['cow-cat','cow','Vaca pirenaica',land(menorca, -5, 6),{speed:.18}]", 'Catalunya cow');
replaceRequired("['pig-cat','pig','Jabalí',land(llevant, 6, -6),{mountable:true,speed:.24}]", "['pig-cat','pig','Jabalí',land(llevant, 6, -6),{speed:.24}]", 'Catalunya pig');
replaceRequired("['vulture-cat','vulture','Buitre leonado',land(alcudia, -10, -8),{flying:true,speed:.34}]", "['vulture-cat','vulture','Buitre leonado',land(alcudia, -10, -8),{flying:true,mountable:true,speed:.34}]", 'Catalunya vulture mount');

replaceRequired(
`    game.animals = positions.map(([id,type,name,position,options]) => {`,
`    if (REGION_ID === 'baleares') {
      positions.push(
        ['sargantana-menorca','lizard','Sargantana',land(menorca,-5,-4),{speed:.10,radius:2.1}],
        ['sargantana-pitiusa','lizard','Sargantana de las Pitiusas',land(eivissa,-4,5),{speed:.11,radius:2.1}],
        ['sargantana-cabrera','lizard','Sargantana balear',land(palma,12,-11),{speed:.10,radius:2.0}],
        ['rabbit-1','rabbit','Conejo europeo',land(llevant,-10,-7),{speed:.38,radius:3.0}],
        ['rabbit-2','rabbit','Conejo europeo',land(menorca,8,-6),{speed:.40,radius:3.0}],
        ['weasel-1','weasel','Comadreja',land(menorca,-8,7),{speed:.34,radius:4.3}],
        ['weasel-2','weasel','Comadreja',land(llevant,-13,5),{speed:.35,radius:4.1}],
        ['wild-genet-1','gineta','Gineta',land(llevant,-15,-9),{speed:.23,radius:6.0}],
        ['wild-genet-2','gineta','Gineta',land(palma,10,7),{speed:.21,radius:5.7}],
        ['salamander-1','salamander','Salamandra',land(llevant,7,11),{speed:.07,radius:2.0}],
        ['salamander-2','salamander','Salamandra',land(llevant,-6,12),{speed:.06,radius:1.8}]
      );
    } else {
      positions.push(
        ['rabbit-cat','rabbit','Conejo europeo',land(llevant,-8,6),{speed:.37,radius:3.0}],
        ['weasel-cat','weasel','Comadreja',land(menorca,7,-5),{speed:.34,radius:4.0}],
        ['wild-genet-cat','gineta','Gineta',land(eivissa,-6,5),{speed:.22,radius:5.5}],
        ['salamander-cat','salamander','Salamandra',land(alcudia,5,8),{speed:.07,radius:2.0}]
      );
    }
    game.animals = positions.map(([id,type,name,position,options]) => {`,
  'missing World1 fauna'
);
replaceRequired(
`    vulture: ['Apenas bate las alas: aprovecha el aire ascendente para sostenerse.']`,
`    vulture: ['Apenas bate las alas: aprovecha el aire ascendente para sostenerse.'],
    rabbit: ['Se queda inmóvil un instante y después avanza a saltos cortos hacia la cobertura.'],
    weasel: ['Se mueve pegada al suelo, con cambios de dirección rápidos y continuos.'],
    salamander: ['Permanece cerca de las zonas húmedas y avanza lentamente entre piedras y sombra.']`,
  'missing observation text'
);

replaceRegexRequired(
/  function mountAnimal\(animal\) \{[\s\S]*?\n  function updateAnimals\(dt, now\) \{/,
`  function mountedAnimal() { return game.animals.find(item => item.id === game.mountedAnimalId) || null; }

  function updateMountUi() {
    const animal = mountedAnimal();
    const jump = document.getElementById('waftJump');
    const badge = document.getElementById('waftMountBadge');
    if (jump && game.jumpPointer === null) jump.textContent = animal?.type === 'vulture' ? 'ALETEAR' : 'SALTAR';
    if (badge) {
      badge.classList.toggle('visible', Boolean(animal));
      badge.textContent = animal ? 'MONTURA · ' + animal.name.toUpperCase() : '';
    }
  }

  function mountAnimal(animal) {
    if (!animal.mountable) return;
    const api = runtime();
    const state = api?.getState?.();
    if (!api || !state) return;
    if (animal.type === 'shark' && !state.swimming) { showToast('La tintorera solo puede montarse en el agua'); return; }
    if (animal.type === 'vulture' && !animal.flightMountReady) { showToast('Espera a que el buitre aterrice'); return; }
    api.setRegionalPosition(animal.x, animal.z);
    api.setHeading(animal.yaw || state.playerFacing || 0);
    game.mountedAnimalId = animal.id;
    animal.hidden = true;
    if (animal.type === 'vulture') {
      api.setAdventureModifiers({ runSpeed: 11.0, swimSpeed: BASE_SPEEDS.swimSpeed, boost: true, flight: true });
    } else if (animal.type === 'shark') {
      api.setAdventureModifiers({ runSpeed: BASE_SPEEDS.runSpeed, swimSpeed: 8.6, boost: true, flight: false });
    } else {
      api.setAdventureModifiers({ runSpeed: 10.4, swimSpeed: BASE_SPEEDS.swimSpeed, boost: true, flight: false });
    }
    updateMountUi();
    showToast(animal.type === 'vulture' ? 'Buitre montado · ALETEA para ganar altura' : 'Montando ' + animal.name);
  }

  function dismountAnimal() {
    const animal = mountedAnimal();
    const api = runtime();
    const state = api?.getState?.();
    if (animal && state) {
      animal.hidden = false;
      animal.x = state.position.x;
      animal.z = state.position.z;
      animal.y = state.position.y;
      animal.originX = animal.x;
      animal.originZ = animal.z;
      animal.flightMountReady = false;
      animal.phase = Math.random();
    }
    game.mountedAnimalId = null;
    api?.setAdventureModifiers?.({ ...BASE_SPEEDS, boost: false, flight: false });
    updateMountUi();
    showToast('Has desmontado');
  }

  function updateAnimals(dt, now) {`,
  'mount functions'
);

replaceRegexRequired(
/  function updateAnimals\(dt, now\) \{[\s\S]*?\n  function updateInteraction\(playerState\) \{/,
`  function updateAnimals(dt, now) {
    const api = runtime();
    const playerPosition = frameRuntimeState(api)?.position;
    for (const animal of game.animals) {
      if (animal.hidden) continue;
      // Regional fauna is deliberately local. Once the planet's floating origin has
      // moved on, neither animate nor sample terrain for entities hundreds of units
      // behind the player.
      if (!planetEntityInRange(animal, playerPosition, 220)) continue;
      if (animal.fleeing) {
        animal.fleeTime += dt;
        animal.yaw += Math.sin(now * .002) * .025;
        animal.x += Math.sin(animal.yaw) * dt * 2.2;
        animal.z += Math.cos(animal.yaw) * dt * 2.2;
        if (animal.fleeTime > 4.2) { animal.fleeing = false; animal.speed = 0; }
      } else if (animal.type === 'vulture' && animal.flying) {
        const cycle = (now * .000034 + animal.phase) % 1;
        const highAngle = cycle * Math.PI * 2;
        const highX = animal.originX + Math.cos(highAngle) * 10.5;
        const highZ = animal.originZ + Math.sin(highAngle) * 7.8;
        const highSurface = api.sampleSurface(highX, highZ);
        const highFloor = highSurface?.land ? highSurface.height : highSurface?.waterHeight || 0;
        const highY = highFloor + 8.5 + Math.sin(highAngle * .65) * 1.8;
        const lowAngle = highAngle * 1.35;
        const lowX = animal.originX + Math.cos(lowAngle) * 2.8;
        const lowZ = animal.originZ + Math.sin(lowAngle) * 2.3;
        const lowSurface = api.sampleSurface(lowX, lowZ);
        const lowFloor = lowSurface?.land ? lowSurface.height : lowSurface?.waterHeight || 0;
        const lowY = lowFloor + .18;
        let blend = 0;
        let landed = false;
        if (cycle >= .48 && cycle < .62) { const t=(cycle-.48)/.14; blend=t*t*(3-2*t); }
        else if (cycle >= .62 && cycle <= .84) { blend=1; landed=true; }
        else if (cycle > .84 && cycle < .97) { const t=(cycle-.84)/.13; blend=1-t*t*(3-2*t); }
        const previousX = animal.x;
        const previousZ = animal.z;
        animal.x = highX + (lowX-highX)*blend;
        animal.z = highZ + (lowZ-highZ)*blend;
        animal.y = highY + (lowY-highY)*blend;
        if (!landed) animal.yaw = Math.atan2(animal.x-previousX, animal.z-previousZ);
        animal.landed = landed;
        animal.flightMountReady = landed || (blend > .96 && Math.abs(animal.y-lowY) < 1.05);
        continue;
      } else if (animal.flying) {
        const radius = 3.5;
        const angular = .22;
        animal.x = animal.originX + Math.sin(now * .001 * angular + animal.phase) * radius;
        animal.z = animal.originZ + Math.cos(now * .001 * angular + animal.phase) * radius;
        animal.yaw = -now * .001 * angular - animal.phase;
      } else if (animal.speed > 0) {
        animal.yaw += Math.sin(now * .0007 + animal.phase) * dt * .28;
        const nx = animal.x + Math.sin(animal.yaw) * animal.speed * dt;
        const nz = animal.z + Math.cos(animal.yaw) * animal.speed * dt;
        const surface = api.sampleSurface(nx, nz);
        if ((animal.aquatic && surface?.water) || (!animal.aquatic && surface?.land)) {
          animal.x = nx; animal.z = nz;
        } else animal.yaw += Math.PI * .7;
        if (Math.hypot(animal.x - animal.originX, animal.z - animal.originZ) > Math.max(4, animal.radius || 9)) animal.yaw = Math.atan2(animal.originX-animal.x, animal.originZ-animal.z);
      }
      const surface = api.sampleSurface(animal.x, animal.z);
      const floor = surface?.land ? surface.height : surface?.waterHeight || animal.y || 0;
      animal.y = animal.flying ? floor + 2.1 : floor;
    }
  }

  function updateInteraction(playerState) {`,
  'animal movement'
);
replaceRequired(
`  function injectUi() {`,
`  function frameRuntimeState(api) {
    return window.__WAFT_PLANET_WORLD_0270_ACTIVE__ ? api?.getPlanetFrameState?.() || api?.getState?.() : api?.getState?.();
  }

  function injectUi() {`,
  'allocation-free runtime state helper'
);
replaceRequired(
`      const player = api?.getState?.();
      if (!player) return;`,
`      const player = frameRuntimeState(api);
      if (!player) return;`,
  'allocation-free planet render state'
);

replaceRequired(
`      const label = animal.mountable ? 'MONTAR ' + animal.name.toUpperCase() : 'OBSERVAR ' + animal.name.toUpperCase();
      add(animal.x, animal.z, animal.type === 'shark' ? 7 : 5, {
        label,
        action: animal.mountable ? () => mountAnimal(animal) : () => observeAnimal(animal),
        secondaryLabel: animal.mountable ? 'OBSERVAR' : null,
        secondaryAction: animal.mountable ? () => observeAnimal(animal) : null
      });`,
`      const canMount = animal.mountable
        && (animal.type !== 'vulture' || animal.flightMountReady)
        && (animal.type !== 'shark' || playerState.swimming);
      const label = canMount ? 'MONTAR ' + animal.name.toUpperCase() : 'OBSERVAR ' + animal.name.toUpperCase();
      add(animal.x, animal.z, animal.type === 'shark' ? 7 : animal.type === 'vulture' ? 8.5 : 5, {
        label,
        action: canMount ? () => mountAnimal(animal) : () => observeAnimal(animal),
        secondaryLabel: canMount ? 'OBSERVAR' : null,
        secondaryAction: canMount ? () => observeAnimal(animal) : null
      });`,
  'mount availability'
);

replaceRequired(
`    if (game.jumpPointer !== null) {
      const charge = Math.min(1, Math.max(0, (performance.now() - game.jumpChargeStartedAt) / 1250));
      document.getElementById('waftJump')?.style.setProperty('--charge', charge);
    }`,
`    const mounted = mountedAnimal();
    const jumpButton = document.getElementById('waftJump');
    if (game.jumpPointer !== null) {
      const charge = Math.min(1, Math.max(0, (performance.now() - game.jumpChargeStartedAt) / 1250));
      jumpButton?.style.setProperty('--charge', charge);
      if (jumpButton && mounted?.type === 'vulture') jumpButton.textContent = 'ALETEO';
    } else if (jumpButton) jumpButton.textContent = mounted?.type === 'vulture' ? 'ALETEAR' : 'SALTAR';`,
  'flight jump UI'
);

replaceRequired(
`      for (const animal of game.animals) if (!animal.hidden) drawAnimal(this, animal, now);
      if (game.npc) drawNpc(this, game.npc, now);`,
`      drawCheckpointRoute(this);
      const visibleAnimals = game.animals.filter(animal => !animal.hidden && planetEntityInRange(animal, player.position, 180));
      const visibleNpc = game.npc && planetEntityInRange(game.npc, player.position, 180) ? game.npc : null;
      this.regionalEntitiesDrawn = visibleAnimals.length + (visibleNpc ? 1 : 0);
      for (const animal of visibleAnimals) drawAnimal(this, animal, now);
      if (visibleNpc) drawNpc(this, visibleNpc, now);`,
  'checkpoint renderer hook'
);
replaceRequired(
`  const renderer = {
    ready: false,`,
`  const renderer = {
    ready: false,
    regionalEntitiesDrawn: 0,
    sharedWorldContext: false,`,
  'regional entity draw telemetry'
);
replaceRequired(
`      this.canvas = document.getElementById('waftAdventureCanvas');
      const gl = this.canvas.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: false });`,
`      const overlayCanvas=document.getElementById('waftAdventureCanvas');
      this.sharedWorldContext=Boolean(window.__WAFT_PLANET_WORLD_0270_ACTIVE__);
      this.canvas=this.sharedWorldContext?[...document.querySelectorAll('canvas')].find(canvas=>canvas!==overlayCanvas):overlayCanvas;
      if(this.sharedWorldContext&&overlayCanvas)overlayCanvas.style.display='none';
      const gl=this.sharedWorldContext?this.canvas?.getContext('webgl2'):this.canvas?.getContext('webgl2',{alpha:true,antialias:true,premultipliedAlpha:false});`,
  'single WebGL context for planet renderer'
);
replaceRequired(
`    resize() {
      const dpr = Math.min(1.65, devicePixelRatio || 1);`,
`    resize() {
      if(this.sharedWorldContext)return;
      const dpr = Math.min(1.65, devicePixelRatio || 1);`,
  'shared planet canvas resize guard'
);
replaceRequired(
`      this.resize();
      gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.useProgram(this.program);`,
`      this.resize();
      if(!this.sharedWorldContext){gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);}
      gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.depthMask(true);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(this.program);`,
  'shared planet canvas clear guard'
);
replaceRequired(
`  const M = {
    identity(){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])},`,
`  const matrixPool=[];
  const M = {
    cursor:0,
    reset(){this.cursor=0},
    next(){let matrix=matrixPool[this.cursor];if(!matrix)matrixPool[this.cursor]=matrix=new Float32Array(16);this.cursor++;return matrix},
    identity(){const matrix=this.next();matrix.fill(0);matrix[0]=matrix[5]=matrix[10]=matrix[15]=1;return matrix},`,
  'pooled renderer matrices'
);
replaceRequired(
`    multiply(a,b){const out=new Float32Array(16);`,
`    multiply(a,b){const out=this.next();`,
  'pooled matrix multiplication'
);
replaceRequired(
`      if (!player) return;
      this.resize();`,
`      if (!player) return;
      M.reset();
      this.resize();`,
  'matrix pool frame reset'
);
replaceRequired(
`  function updateInteraction(playerState) {`,
`  function planetEntityInRange(entity, playerPosition, radius) {
    if (!window.__WAFT_PLANET_WORLD_0270_ACTIVE__) return true;
    if (!entity || !playerPosition) return false;
    return Math.hypot((Number(entity.x)||0)-playerPosition.x,(Number(entity.z)||0)-playerPosition.z) <= radius;
  }

  function updateInteraction(playerState) {`,
  'planet entity distance gate'
);
replaceRequired(
`    render(now, eye, pv) {`,
`    rebaseRegionalEntities(project) {
      if (typeof project !== 'function') return;
      const entities = [...game.animals, game.npc, ...game.checkpoints].filter(Boolean);
      for (const entity of entities) {
        if (!Number.isFinite(Number(entity.x)) || !Number.isFinite(Number(entity.z))) continue;
        const angleKey = Number.isFinite(Number(entity.yaw)) ? 'yaw' : Number.isFinite(Number(entity.heading)) ? 'heading' : null;
        const next = project(Number(entity.x), Number(entity.z), angleKey ? Number(entity[angleKey]) : null);
        if (!next || !Number.isFinite(next.x) || !Number.isFinite(next.z)) continue;
        entity.x = next.x; entity.z = next.z;
        if (angleKey && Number.isFinite(next.heading)) entity[angleKey] = next.heading;
        if (Number.isFinite(Number(entity.originX)) && Number.isFinite(Number(entity.originZ))) {
          const nextOrigin = project(Number(entity.originX), Number(entity.originZ), null);
          if (nextOrigin && Number.isFinite(nextOrigin.x) && Number.isFinite(nextOrigin.z)) {
            entity.originX = nextOrigin.x; entity.originZ = nextOrigin.z;
          }
        }
      }
      game.previousPlayer = null;
    },
    render(now, eye, pv) {`,
  'floating-origin entity rebase hook'
);
replaceRequired(
`  function drawMesh(renderer, mesh, model, color) {
    const gl=renderer.gl;gl.uniformMatrix4fv(renderer.uniforms.model,false,model);gl.uniform3f(renderer.uniforms.color,color[0],color[1],color[2]);gl.bindVertexArray(mesh.vao);gl.drawElements(gl.TRIANGLES,mesh.count,gl.UNSIGNED_SHORT,0);
  }`,
`  function drawMesh(renderer, mesh, model, color) {
    const gl=renderer.gl;gl.uniformMatrix4fv(renderer.uniforms.model,false,model);gl.uniform3f(renderer.uniforms.color,color[0],color[1],color[2]);gl.bindVertexArray(mesh.vao);gl.drawElements(gl.TRIANGLES,mesh.count,gl.UNSIGNED_SHORT,0);
  }
  function drawCheckpointRoute(r) {
    const panel=document.getElementById('waftCheckpointPanel');
    if (!panel?.classList.contains('visible')) return;
    const api=runtime();
    const points=game.checkpoints.map(point => point?.regionId===REGION_ID ? point : null);
    for (let i=0;i<points.length;i++) {
      const point=points[i]; if(!point) continue;
      const display=api.regionalToDisplay(point.x,point.z),surface=api.sampleSurface(point.x,point.z),y=(surface?.land?surface.height:surface?.waterHeight||0)+.22;
      const color=[[.35,.85,.95],[.95,.72,.24],[.78,.46,.95]][i];
      drawSphere(r,M.t(display.x,y,display.z),0,.22,0,.22,.22,.22,color);
    }
    for (let i=0;i<points.length-1;i++) {
      const a=points[i],b=points[i+1]; if(!a||!b) continue;
      const da=api.regionalToDisplay(a.x,a.z),db=api.regionalToDisplay(b.x,b.z),distance=Math.hypot(db.x-da.x,db.z-da.z),steps=Math.max(2,Math.min(28,Math.ceil(distance/3)));
      for(let step=1;step<steps;step++){
        const t=step/steps,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,display=api.regionalToDisplay(x,z),surface=api.sampleSurface(x,z),y=(surface?.land?surface.height:surface?.waterHeight||0)+.12;
        drawSphere(r,M.t(display.x,y,display.z),0,.10,0,.10,.10,.10,[.88,.74,.36]);
      }
    }
  }`,
  'checkpoint route renderer'
);

replaceRequired(
`    case'pig':drawQuadruped(r,base,[.18,.14,.12],[.08,.06,.05],.92,.54,1.18);drawSphere(r,base,0,.72,.88,.42,.32,.45,[.16,.12,.11]);drawSphere(r,base,0,.64,1.28,.27,.18,.24,[.27,.19,.17]);break;
    case'warbler':`,
`    case'pig':drawQuadruped(r,base,[.18,.14,.12],[.08,.06,.05],.92,.54,1.18);drawSphere(r,base,0,.72,.88,.42,.32,.45,[.16,.12,.11]);drawSphere(r,base,0,.64,1.28,.27,.18,.24,[.27,.19,.17]);break;
    case'rabbit':drawSphere(r,base,0,.32,0,.32,.28,.46,[.48,.39,.29]);drawSphere(r,base,0,.48,.42,.25,.24,.25,[.52,.43,.32]);drawCylinderPart(r,base,-.10,.78,.42,.045,.34,.045,[.50,.41,.30],M.rz(-.08));drawCylinderPart(r,base,.10,.78,.42,.045,.34,.045,[.50,.41,.30],M.rz(.08));break;
    case'weasel':drawSphere(r,base,0,.22,0,.22,.18,.72,[.39,.29,.19]);drawSphere(r,base,0,.27,.63,.20,.18,.25,[.43,.32,.21]);drawSphere(r,base,0,.18,-.72,.10,.09,.62,[.34,.25,.17],M.rx(.10));break;
    case'salamander':drawSphere(r,base,0,.075,0,.12,.07,.46,[.13,.15,.10]);drawSphere(r,base,0,.09,.42,.13,.09,.18,[.18,.20,.13]);drawSphere(r,base,0,.06,-.52,.06,.045,.48,[.11,.13,.085]);break;
    case'warbler':`,
  'missing fauna rendering'
);

replaceRequired(
`    api.setAdventureModifiers(BASE_SPEEDS);
    buildAdventurePopulation(api);`,
`    api.setAdventureModifiers({ ...BASE_SPEEDS, boost: false, flight: false });
    buildAdventurePopulation(api);
    updateMountUi();
    updateCheckpointUi();`,
  'initialize ui state'
);

replaceRequired(
`  function checkpointAction(event) {`,
`  function updateCheckpointUi() {
    const used = game.checkpoints.filter(Boolean).length;
    const button = document.getElementById('waftCheckpoints');
    if (button) button.textContent = used ? 'RUTA ' + used + '/3' : 'RUTA';
  }

  function checkpointAction(event) {`,
  'checkpoint ui function'
);
replaceRequired(
`    saveGame('checkpoint');
  }

  function travelToOtherRegion()`,
`    updateCheckpointUi();
    saveGame('checkpoint');
  }

  function travelToOtherRegion()`,
  'checkpoint ui update'
);

// 0.27.4 keeps the complete cube-sphere immutable and spends one draw call on
// the mounted character. Keep these changes in the deterministic builder so a
// deployment can never regenerate the older multi-draw renderer.
replaceRequired(
  "getRendererState() { return { regionalEntitiesDrawn: renderer.regionalEntitiesDrawn || 0, sharedWorldContext: Boolean(renderer.sharedWorldContext) }; },",
  "getRendererState() { return { regionalEntitiesDrawn: renderer.regionalEntitiesDrawn || 0, sharedWorldContext: Boolean(renderer.sharedWorldContext), instanceDrawCalls: renderer.instanceDrawCalls || 0 }; },",
  '0.27.4 character draw telemetry'
);
replaceRequired(
`    cylinder: null,
    uniforms: null,`,
`    cylinder: null,
    uniforms: null,
    smoothPlanet: false,
    instanceDrawCalls: 0,`,
  '0.27.4 renderer state'
);
replaceRequired(
  "      this.gl = gl;\n      const vertex = `#version 300 es\n        layout(location=0) in vec3 aPosition;layout(location=1) in vec3 aNormal;\n        uniform mat4 uPV;uniform mat4 uModel;out vec3 vNormal;out vec3 vWorld;\n        void main(){vec4 world=uModel*vec4(aPosition,1.0);vWorld=world.xyz;vNormal=normalize(mat3(uModel)*aNormal);gl_Position=uPV*world;}`;",
  "      this.gl = gl;\n      this.smoothPlanet=Boolean(window.__WAFT_PLANET_WORLD_0274_ACTIVE__);\n      const vertex = this.smoothPlanet?`#version 300 es\n        layout(location=0) in vec3 aPosition;layout(location=1) in vec3 aColor;\n        uniform mat4 uPV;out vec3 vColor;\n        void main(){vColor=aColor;gl_Position=uPV*vec4(aPosition,1.0);}`:`#version 300 es\n        layout(location=0) in vec3 aPosition;layout(location=1) in vec3 aNormal;\n        uniform mat4 uPV;uniform mat4 uModel;out vec3 vNormal;out vec3 vWorld;\n        void main(){vec4 world=uModel*vec4(aPosition,1.0);vWorld=world.xyz;vNormal=normalize(mat3(uModel)*aNormal);gl_Position=uPV*world;}`;",
  '0.27.4 lightweight character vertex shader'
);
replaceRequired(
  "      const fragment = `#version 300 es\n        precision highp float;in vec3 vNormal;in vec3 vWorld;uniform vec3 uColor;uniform vec3 uCamera;out vec4 outColor;\n        void main(){vec3 n=normalize(vNormal);float sun=max(dot(n,normalize(vec3(.38,.90,.24))),0.0);float fill=.38+.25*max(n.y,0.0);float rim=pow(1.0-max(dot(n,normalize(uCamera-vWorld)),0.0),2.0)*.15;outColor=vec4(uColor*(fill+sun*.55)+rim,1.0);}`;",
  "      const fragment = this.smoothPlanet?`#version 300 es\n        precision mediump float;in vec3 vColor;out vec4 outColor;\n        void main(){outColor=vec4(vColor,1.0);}`:`#version 300 es\n        precision highp float;in vec3 vNormal;in vec3 vWorld;uniform vec3 uColor;uniform vec3 uCamera;out vec4 outColor;\n        void main(){vec3 n=normalize(vNormal);float sun=max(dot(n,normalize(vec3(.38,.90,.24))),0.0);float fill=.38+.25*max(n.y,0.0);float rim=pow(1.0-max(dot(n,normalize(uCamera-vWorld)),0.0),2.0)*.15;outColor=vec4(uColor*(fill+sun*.55)+rim,1.0);}`;",
  '0.27.4 lightweight character fragment shader'
);
replaceRequired(
`      this.sphere = createSphere(gl, 14, 9);
      this.cylinder = createCylinder(gl, 12);`,
`      this.sphere = createSphere(gl, this.smoothPlanet?6:14, this.smoothPlanet?4:9);
      this.cylinder = createCylinder(gl, this.smoothPlanet?5:12);
      if(this.smoothPlanet)setupDynamicCharacter(gl,this);`,
  '0.27.4 low-poly character meshes'
);
replaceRequired(
`      M.reset();
      this.resize();`,
`      M.reset();
      if(this.smoothPlanet){this.sphere.instanceCount=0;this.cylinder.instanceCount=0;this.instanceDrawCalls=0;}
      this.resize();`,
  '0.27.4 character batch reset'
);
replaceRequired(
  "      gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.depthMask(true);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);",
  "      gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.depthMask(true);if(this.smoothPlanet)gl.disable(gl.BLEND);else{gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);}",
  '0.27.4 opaque character batch'
);
replaceRequired(
`      if (mounted) {
        const visual = { ...mounted, x: player.position.x, z: player.position.z, y: player.position.y - (player.swimming ? .46 : .82), yaw: player.playerFacing };
        drawAnimal(this, visual, now, true);
        drawPenguin(this, player, now, mounted.type === 'shark' ? .85 : 1.05);
      } else drawPenguin(this, player, now, 0);
      gl.bindVertexArray(null);`,
`      if (mounted) {
        const compactVulture=this.smoothPlanet&&mounted.type==='vulture';
        const visual = { ...mounted, x: player.position.x, z: player.position.z, y: player.position.y - (player.swimming ? .46 : .82), yaw: player.playerFacing, renderScale:compactVulture?.75:1 };
        drawAnimal(this, visual, now, true);
        drawPenguin(this, player, now, mounted.type === 'shark' ? .85 : 1.05,compactVulture?.82:1);
      } else drawPenguin(this, player, now, 0);
      if(this.smoothPlanet)flushDynamicCharacter(this);
      gl.bindVertexArray(null);`,
  '0.27.4 compact mounted character batch'
);
replaceRequired(
`  function uploadMesh(gl,vertices,indices){const vao=gl.createVertexArray();gl.bindVertexArray(vao);const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);gl.bindVertexArray(null);return{vao,count:indices.length}}`,
`  function uploadMesh(gl,vertices,indices){const vao=gl.createVertexArray();gl.bindVertexArray(vao);const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);gl.bindVertexArray(null);return{vao,count:indices.length,vertices,indices}}
  function setupDynamicCharacter(gl,renderer){
    for(const mesh of[renderer.sphere,renderer.cylinder]){mesh.instanceCapacity=256;mesh.instanceCount=0;mesh.instanceData=new Float32Array(mesh.instanceCapacity*20);}
    renderer.dynamicData=new Float32Array(524288);renderer.dynamicVao=gl.createVertexArray();renderer.dynamicBuffer=gl.createBuffer();gl.bindVertexArray(renderer.dynamicVao);gl.bindBuffer(gl.ARRAY_BUFFER,renderer.dynamicBuffer);gl.bufferData(gl.ARRAY_BUFFER,renderer.dynamicData.byteLength,gl.STREAM_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);gl.bindVertexArray(null);
  }
  function growInstanceMesh(mesh){mesh.instanceCapacity*=2;const data=new Float32Array(mesh.instanceCapacity*20);data.set(mesh.instanceData);mesh.instanceData=data;}
  function queueInstance(renderer,mesh,model,color){
    if(mesh.instanceCount>=mesh.instanceCapacity)growInstanceMesh(mesh);
    const offset=mesh.instanceCount*20;mesh.instanceData.set(model,offset);mesh.instanceData[offset+16]=color[0];mesh.instanceData[offset+17]=color[1];mesh.instanceData[offset+18]=color[2];mesh.instanceData[offset+19]=1;mesh.instanceCount++;
  }
  function flushDynamicCharacter(renderer){
    const output=renderer.dynamicData;let cursor=0;
    for(const mesh of[renderer.sphere,renderer.cylinder])for(let instance=0;instance<mesh.instanceCount;instance++){
      const matrixOffset=instance*20,m=mesh.instanceData,red=m[matrixOffset+16],green=m[matrixOffset+17],blue=m[matrixOffset+18],vertices=mesh.vertices,indices=mesh.indices;
      for(let index=0;index<indices.length;index++){
        const source=indices[index]*6,x=vertices[source],y=vertices[source+1],z=vertices[source+2],light=.56+.44*Math.max(0,vertices[source+4]);
        if(cursor+6>output.length)throw new Error('0.27.4 dynamic character vertex budget exceeded');
        output[cursor++]=m[matrixOffset]*x+m[matrixOffset+4]*y+m[matrixOffset+8]*z+m[matrixOffset+12];
        output[cursor++]=m[matrixOffset+1]*x+m[matrixOffset+5]*y+m[matrixOffset+9]*z+m[matrixOffset+13];
        output[cursor++]=m[matrixOffset+2]*x+m[matrixOffset+6]*y+m[matrixOffset+10]*z+m[matrixOffset+14];
        output[cursor++]=red*light;output[cursor++]=green*light;output[cursor++]=blue*light;
      }
    }
    if(!cursor)return;const gl=renderer.gl;gl.bindVertexArray(renderer.dynamicVao);gl.bindBuffer(gl.ARRAY_BUFFER,renderer.dynamicBuffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,output.subarray(0,cursor));gl.drawArrays(gl.TRIANGLES,0,cursor/6);renderer.instanceDrawCalls=1;
  }`,
  '0.27.4 one-draw character batch'
);
replaceRequired(
`  function drawMesh(renderer, mesh, model, color) {
    const gl=renderer.gl;`,
`  function drawMesh(renderer, mesh, model, color) {
    if(renderer.smoothPlanet){queueInstance(renderer,mesh,model,color);return;}
    const gl=renderer.gl;`,
  '0.27.4 queued character parts'
);
replaceRequired(
  '  function drawPenguin(r, state, now, mountedOffset=0) {',
  '  function drawPenguin(r, state, now, mountedOffset=0,visualScale=1) {',
  '0.27.4 compact rider signature'
);
replaceRequired(
`    const base=worldBase(display.x,baseY,display.z,state.playerFacing,.70);
    drawSphere(r,base,0,.82,0,.43,.68,.34,[.035,.055,.065],swim?M.rx(-.38):null);`,
`    const base=worldBase(display.x,baseY,display.z,state.playerFacing,.70*visualScale);
    if(r.smoothPlanet&&mountedOffset>0){
      drawSphere(r,base,0,.82,0,.43,.68,.34,[.035,.055,.065]);
      drawSphere(r,base,0,.84,.24,.30,.50,.12,[.88,.89,.83]);
      drawSphere(r,base,0,1.42,.02,.39,.40,.37,[.035,.05,.058]);
      drawSphere(r,base,0,1.38,.34,.22,.19,.20,[.77,.48,.12]);
      drawSphere(r,base,-.43,.88,.02,.13,.48,.09,[.028,.045,.052],M.rz(.20+step*.28));
      drawSphere(r,base,.43,.88,.02,.13,.48,.09,[.028,.045,.052],M.rz(-.20-step*.28));
      return;
    }
    drawSphere(r,base,0,.82,0,.43,.68,.34,[.035,.055,.065],swim?M.rx(-.38):null);`,
  '0.27.4 compact rider geometry'
);
replaceRequired(
  'base=worldBase(display.x,baseY+bob,display.z,a.yaw,1);switch(a.type){',
  'base=worldBase(display.x,baseY+bob,display.z,a.yaw,Number(a.renderScale)||1);switch(a.type){',
  '0.27.4 mount visual scale'
);

const outputPath = process.env.WAFT_BUILD_OUTPUT
  ? path.resolve(process.env.WAFT_BUILD_OUTPUT)
  : path.join(root, 'gameplay-plugin.js');
fs.writeFileSync(outputPath, source);
console.log(`Built ${path.basename(outputPath)}: ${Buffer.byteLength(source)} bytes`);
