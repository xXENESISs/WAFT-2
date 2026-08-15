'use strict';
(() => {
  const REGION_ID = window.__WAFT_ADVENTURE_REGION__ || 'baleares';
  const BUILD_ID = window.__WAFT_ADVENTURE_BUILD__ || '0.22.0';
  const SAVE_KEY = 'waft.adventure.integration.0210.v1';
  const BASE_SPEEDS = { runSpeed: 7.2, swimSpeed: 5.2, jumpVelocity: 8.8 };
  const REGION_NAMES = { baleares: 'Baleares', 'catalunya-litoral': 'Catalunya litoral' };
  const PORTS = {
    baleares: { x: 102.9282, z: -133.3584, heading: 3.577925, name: "Port d'Alcúdia", target: 'catalunya-litoral' },
    'catalunya-litoral': { x: 5.3339, z: 62.2339, heading: 6.108652, name: 'Port de Barcelona', target: 'baleares' }
  };

  const game = {
    schemaVersion: 1,
    regionId: REGION_ID,
    missionStage: 0,
    missionComplete: false,
    discoveries: {},
    observed: {},
    mountedAnimalId: null,
    checkpoints: [null, null, null],
    autoRun: false,
    saveCount: 0,
    lastSavedAt: 0,
    dialogueOpen: false,
    currentInteractable: null,
    animals: [],
    npc: null,
    initialized: false,
    previousPlayer: null,
    playerSpeed: 0,
    lastFrameAt: performance.now(),
    jumpChargeStartedAt: 0,
    jumpPointer: null,
    pendingArrivalApplied: false,
    statusText: 'Preparando Adventure…'
  };

  const plugin = window.WAFTAdventurePlugin = {
    hideBaseCharacter: true,
    rebaseRegionalEntities(project) { renderer.rebaseRegionalEntities(project); },
    getRendererState() { return { regionalEntitiesDrawn: renderer.regionalEntitiesDrawn || 0, sharedWorldContext: Boolean(renderer.sharedWorldContext) }; },
    afterWorldDraw(now, eye, pv) {
      if (!game.initialized || !renderer.ready) return;
      updateFrame(now);
      renderer.render(now, eye, pv);
    }
  };

  function frameRuntimeState(api) {
    return window.__WAFT_PLANET_WORLD_0270_ACTIVE__ ? api?.getPlanetFrameState?.() || api?.getState?.() : api?.getState?.();
  }

  function injectUi() {
    const style = document.createElement('style');
    style.textContent = `
      #waftAdventureHud{position:fixed;z-index:25;left:max(10px,env(safe-area-inset-left));top:82px;width:min(310px,54vw);padding:10px 39px 10px 12px;border-radius:14px;background:rgba(5,18,24,.91);border:1px solid rgba(231,189,99,.43);box-shadow:0 9px 30px #0009;backdrop-filter:blur(10px);color:#f4f6f2}
      #waftAdventureHud b{display:block;color:#e7bd63;font-size:10px;letter-spacing:.11em}#waftObjective{display:block;margin-top:4px;font-size:12px;font-weight:800;line-height:1.25}#waftProgress{display:block;margin-top:4px;color:#a9c3bf;font-size:9px;font-weight:700}
      #waftCollapse{position:absolute;right:6px;top:6px;width:28px;height:28px;padding:0;border-radius:50%;border:1px solid #fff3;background:#173640;color:#fff;font-weight:900}#waftAdventureHud.collapsed{width:44px;height:44px;padding:0;border-radius:50%}#waftAdventureHud.collapsed .waftBody{display:none}#waftAdventureHud.collapsed #waftCollapse{right:7px;top:7px}
      #waftTopActions{position:fixed;z-index:26;right:max(10px,env(safe-area-inset-right));top:max(10px,env(safe-area-inset-top));display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;max-width:44vw}#waftTopActions button,#waftAdventureAction,#waftObserveAction,#waftJump,#waftTravelAction{border:1px solid #ffffff32;background:rgba(7,22,28,.91);color:#fff;border-radius:12px;padding:9px 11px;font-weight:900;box-shadow:0 6px 20px #0008;touch-action:none}#waftTopActions button.active{background:#8a6b32;color:#fff8df}
      #waftJump{--charge:0;position:fixed;z-index:27;right:max(20px,env(safe-area-inset-right));bottom:max(24px,env(safe-area-inset-bottom));width:88px;height:88px;border-radius:50%;padding:0;background:radial-gradient(circle,#245d70 0 57%,transparent 59%),conic-gradient(#f2c766 calc(var(--charge)*1turn),#ffffff25 0);font-size:12px}#waftJump.charging{transform:scale(calc(.98 + var(--charge)*.07));filter:brightness(1.18)}#waftMountBadge{display:none;position:fixed;z-index:27;right:max(14px,env(safe-area-inset-right));bottom:max(118px,calc(env(safe-area-inset-bottom) + 118px));padding:7px 10px;border-radius:999px;background:rgba(7,22,28,.94);border:1px solid #e7bd6366;color:#ffe7ad;font-size:10px;font-weight:900;letter-spacing:.04em}#waftMountBadge.visible{display:block}
      #waftAdventureAction{display:none;position:fixed;z-index:28;right:max(18px,env(safe-area-inset-right));bottom:max(125px,calc(env(safe-area-inset-bottom) + 125px));min-width:128px;background:#e7bd63;color:#181207;border-color:#fff8}#waftAdventureAction.visible{display:block}#waftObserveAction{display:none;position:fixed;z-index:28;right:max(18px,env(safe-area-inset-right));bottom:max(172px,calc(env(safe-area-inset-bottom) + 172px));min-width:128px}#waftObserveAction.visible{display:block}
      #waftTravelAction{display:none;position:fixed;z-index:29;left:50%;bottom:max(18px,env(safe-area-inset-bottom));transform:translateX(-50%);border:2px solid #a8efd2;background:linear-gradient(#347966,#205347);min-width:230px}#waftTravelAction.visible{display:block;animation:waftPulse 1.2s ease-in-out infinite}@keyframes waftPulse{50%{transform:translateX(-50%) translateY(-3px)}}
      #waftDialogue{display:none;position:fixed;z-index:45;left:50%;bottom:max(14px,env(safe-area-inset-bottom));transform:translateX(-50%);width:min(720px,calc(100vw - 24px));padding:16px;border-radius:18px;background:rgba(5,17,23,.97);border:1px solid #ffffff32;box-shadow:0 18px 56px #000d}#waftDialogue.visible{display:block}#waftSpeaker{color:#e7bd63;font-size:11px;font-weight:950;letter-spacing:.1em;text-transform:uppercase}#waftDialogueText{margin-top:8px;font-size:14px;line-height:1.45;font-weight:650;min-height:42px}#waftDialogueActions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}#waftDialogueActions button{border:1px solid #fff3;background:#234b58;color:#fff;border-radius:11px;padding:9px 13px;font-weight:850}
      #waftCheckpointPanel{display:none;position:fixed;z-index:31;right:max(10px,env(safe-area-inset-right));top:62px;width:min(300px,calc(100vw - 20px));padding:12px;border-radius:15px;background:rgba(5,17,23,.96);border:1px solid #ffffff32;box-shadow:0 14px 42px #000b}#waftCheckpointPanel.visible{display:block}.waftCheckpointRow{display:grid;grid-template-columns:28px 1fr 1fr 1fr;gap:5px;align-items:center;margin-top:7px}.waftCheckpointRow button{padding:7px 4px;border:1px solid #fff3;border-radius:8px;background:#173a45;color:#fff;font-size:10px;font-weight:850}.waftCheckpointRow b{color:#e7bd63;text-align:center}
      #waftToast{position:fixed;z-index:55;left:50%;top:max(16px,env(safe-area-inset-top));transform:translate(-50%,-12px);opacity:0;pointer-events:none;padding:9px 14px;border-radius:999px;background:rgba(5,17,23,.96);border:1px solid #ffffff32;color:#fff2cc;font-size:11px;font-weight:850;transition:.25s}#waftToast.show{opacity:1;transform:translate(-50%,0)}
      #waftMissionComplete{position:fixed;z-index:54;left:50%;top:22%;transform:translate(-50%,-18px) scale(.96);opacity:0;pointer-events:none;width:min(460px,calc(100vw - 30px));padding:18px;border-radius:18px;text-align:center;background:linear-gradient(145deg,#0b2528f5,#183d38f5);border:1px solid #e7bd6388;box-shadow:0 18px 60px #000c;transition:.35s}#waftMissionComplete.show{opacity:1;transform:translate(-50%,0) scale(1)}#waftMissionComplete small{display:block;color:#e7bd63;font-weight:950;letter-spacing:.15em}#waftMissionComplete strong{display:block;margin-top:7px;font-size:18px}
      #waftAdventureCanvas{position:fixed;z-index:6;inset:0;width:100%;height:100%;pointer-events:none;background:transparent}
      body.waft-dialogue-open #joystick,body.waft-dialogue-open #vertical,body.waft-dialogue-open #presets,body.waft-dialogue-open #waftJump,body.waft-dialogue-open #waftTopActions{opacity:.2;pointer-events:none}
      @media(max-width:700px){#waftAdventureHud{top:61px;width:min(255px,58vw);padding:8px 36px 8px 9px}#waftObjective{font-size:10px}#waftTopActions button{font-size:10px;padding:8px}#waftJump{width:78px;height:78px}#waftAdventureAction{bottom:108px;min-width:105px;font-size:10px}#waftObserveAction{bottom:150px;min-width:105px;font-size:10px}}
    `;
    document.head.appendChild(style);

    const canvas = document.createElement('canvas');
    canvas.id = 'waftAdventureCanvas';
    document.body.appendChild(canvas);

    const hud = document.createElement('section');
    hud.id = 'waftAdventureHud';
    hud.innerHTML = `<button id="waftCollapse" type="button">−</button><div class="waftBody"><b>EXPEDICIÓN · ${BUILD_ID}</b><span id="waftObjective"></span><small id="waftProgress"></small></div>`;
    document.body.appendChild(hud);

    const top = document.createElement('div');
    top.id = 'waftTopActions';
    top.innerHTML = '<button id="waftAuto" type="button">AUTO</button><button id="waftCheckpoints" type="button">RUTA</button><button id="waftSave" type="button">GUARDAR</button>';
    document.body.appendChild(top);

    const jump = document.createElement('button');
    jump.id = 'waftJump';
    jump.type = 'button';
    jump.textContent = 'SALTAR';
    document.body.appendChild(jump);
    const mountBadge = document.createElement('div');
    mountBadge.id = 'waftMountBadge';
    document.body.appendChild(mountBadge);

    const action = document.createElement('button');
    action.id = 'waftAdventureAction';
    action.type = 'button';
    document.body.appendChild(action);

    const observe = document.createElement('button');
    observe.id = 'waftObserveAction';
    observe.type = 'button';
    observe.textContent = 'OBSERVAR';
    document.body.appendChild(observe);

    const travel = document.createElement('button');
    travel.id = 'waftTravelAction';
    travel.type = 'button';
    document.body.appendChild(travel);

    const dialogue = document.createElement('section');
    dialogue.id = 'waftDialogue';
    dialogue.innerHTML = '<div id="waftSpeaker"></div><div id="waftDialogueText"></div><div id="waftDialogueActions"></div>';
    document.body.appendChild(dialogue);

    const panel = document.createElement('section');
    panel.id = 'waftCheckpointPanel';
    panel.innerHTML = '<strong>RUTA DE EXPEDICIÓN</strong><small>Marca hasta tres puntos; al abrir este panel verás la ruta sobre el terreno.</small>' + ['A','B','C'].map((letter,index)=>`<div class="waftCheckpointRow" data-index="${index}"><b>${letter}</b><button data-action="set">MARCAR</button><button data-action="return">VOLVER</button><button data-action="clear">BORRAR</button></div>`).join('');
    document.body.appendChild(panel);

    const toast = document.createElement('div');
    toast.id = 'waftToast';
    document.body.appendChild(toast);
    const complete = document.createElement('div');
    complete.id = 'waftMissionComplete';
    complete.innerHTML = '<small>EXPEDICIÓN COMPLETADA</small><strong>Tramuntana · Myotragus localizado</strong>';
    document.body.appendChild(complete);

    document.getElementById('waftCollapse').addEventListener('click', () => {
      hud.classList.toggle('collapsed');
      document.getElementById('waftCollapse').textContent = hud.classList.contains('collapsed') ? '+' : '−';
    });
    document.getElementById('waftAuto').addEventListener('click', () => setAutoRun(!game.autoRun));
    document.getElementById('waftCheckpoints').addEventListener('click', () => panel.classList.toggle('visible'));
    document.getElementById('waftSave').addEventListener('click', () => saveGame('manual', true));
    action.addEventListener('click', () => game.currentInteractable?.action?.());
    observe.addEventListener('click', () => game.currentInteractable?.secondaryAction?.());
    travel.addEventListener('click', travelToOtherRegion);
    panel.addEventListener('click', event => checkpointAction(event));

    jump.addEventListener('pointerdown', event => {
      event.preventDefault();
      game.jumpPointer = event.pointerId;
      jump.setPointerCapture(event.pointerId);
      game.jumpChargeStartedAt = performance.now();
      jump.classList.add('charging');
    });
    const releaseJump = event => {
      if (game.jumpPointer !== null && event.pointerId !== game.jumpPointer) return;
      game.jumpPointer = null;
      const held = Math.max(0, performance.now() - game.jumpChargeStartedAt);
      const charge = Math.min(1, held / 1250);
      jump.classList.remove('charging');
      jump.style.setProperty('--charge', 0);
      const api = runtime();
      if (!api || game.dialogueOpen) return;
      const mounted = game.animals.find(item => item.id === game.mountedAnimalId);
      if (mounted?.type === 'vulture') {
        api.setAdventureModifiers({ flightFlap: 3.8 + charge * 6.4 });
        jump.textContent = 'ALETEAR';
        return;
      }
      api.setAdventureModifiers({ jumpVelocity: BASE_SPEEDS.jumpVelocity + charge * 7.2 });
      api.jump();
      setTimeout(() => api.setAdventureModifiers({ jumpVelocity: BASE_SPEEDS.jumpVelocity }), 220);
    };
    jump.addEventListener('pointerup', releaseJump);
    jump.addEventListener('pointercancel', releaseJump);

    addEventListener('keydown', event => {
      if (event.code === 'KeyE' && !event.repeat) game.currentInteractable?.action?.();
      if (event.code === 'KeyF' && !event.repeat) game.currentInteractable?.secondaryAction?.();
      if (event.code === 'KeyC' && !event.repeat) panel.classList.toggle('visible');
    });
  }

  function runtime() { return window.WAFTRegionRuntime || null; }

  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const save = JSON.parse(raw);
      if (save.schemaVersion !== game.schemaVersion) return false;
      game.missionStage = Math.max(0, Math.min(6, Number(save.missionStage) || 0));
      game.missionComplete = Boolean(save.missionComplete);
      game.discoveries = save.discoveries && typeof save.discoveries === 'object' ? save.discoveries : {};
      game.observed = save.observed && typeof save.observed === 'object' ? save.observed : {};
      game.checkpoints = Array.isArray(save.checkpoints) ? save.checkpoints.slice(0,3).concat([null,null,null]).slice(0,3) : [null,null,null];
      game.saveCount = Math.max(0, Number(save.saveCount) || 0);
      game.lastSavedAt = Math.max(0, Number(save.lastSavedAt) || 0);
      return true;
    } catch (error) {
      console.warn('Adventure save restore failed', error);
      return false;
    }
  }

  function saveGame(reason = 'autosave', notify = false) {
    try {
      const api = runtime();
      const payload = {
        schemaVersion: game.schemaVersion,
        buildId: BUILD_ID,
        missionStage: game.missionStage,
        missionComplete: game.missionComplete,
        discoveries: game.discoveries,
        observed: game.observed,
        checkpoints: game.checkpoints,
        saveCount: game.saveCount + 1,
        lastSavedAt: Date.now(),
        reason
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
      game.saveCount = payload.saveCount;
      game.lastSavedAt = payload.lastSavedAt;
      api?.saveProgress?.();
      if (notify) showToast('Expedición guardada');
      updateObjective();
      return true;
    } catch (error) {
      console.warn('Adventure save failed', error);
      if (notify) showToast('No se pudo guardar');
      return false;
    }
  }

  function showToast(text) {
    const element = document.getElementById('waftToast');
    if (!element) return;
    element.textContent = text;
    element.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => element.classList.remove('show'), 2600);
  }

  function showDialogue(speaker, lines, onClose = null) {
    const dialogue = document.getElementById('waftDialogue');
    const speakerElement = document.getElementById('waftSpeaker');
    const text = document.getElementById('waftDialogueText');
    const actions = document.getElementById('waftDialogueActions');
    const queue = Array.isArray(lines) ? [...lines] : [String(lines)];
    game.dialogueOpen = true;
    document.body.classList.add('waft-dialogue-open');
    dialogue.classList.add('visible');
    speakerElement.textContent = speaker;
    let index = 0;
    const render = () => {
      text.textContent = queue[index];
      actions.innerHTML = '';
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = index < queue.length - 1 ? 'SIGUIENTE' : 'CERRAR';
      button.addEventListener('click', () => {
        if (index < queue.length - 1) { index++; render(); return; }
        dialogue.classList.remove('visible');
        document.body.classList.remove('waft-dialogue-open');
        game.dialogueOpen = false;
        onClose?.();
      });
      actions.appendChild(button);
    };
    render();
  }

  function missionObjective() {
    if (REGION_ID !== 'baleares') return 'Explora Catalunya y descubre su fauna antes de regresar al puerto.';
    return [
      'Habla con Aina en el campamento del Llevant.',
      'Observa la lagartija balear cerca del campamento.',
      'Encuentra la gineta entre los pinos.',
      'Sigue a la gineta hasta el roquedo y vuelve a observarla.',
      'Regresa con Aina e informa de la gineta.',
      'Localiza y observa al Myotragus en la sierra.',
      'Expedición de Tramuntana completada. Explora libremente.'
    ][game.missionStage] || 'Explora libremente.';
  }

  function updateObjective() {
    const objective = document.getElementById('waftObjective');
    const progress = document.getElementById('waftProgress');
    if (!objective || !progress) return;
    objective.textContent = missionObjective();
    const observedCount = Object.values(game.observed).filter(Boolean).length;
    progress.textContent = REGION_NAMES[REGION_ID] + ' · fauna ' + observedCount + '/' + game.animals.length + ' · guardados ' + game.saveCount;
  }

  function setStage(stage, toast = '') {
    if (stage <= game.missionStage) return;
    game.missionStage = Math.min(6, stage);
    if (toast) showToast(toast);
    updateObjective();
    saveGame('mission-stage');
  }

  function setAutoRun(value) {
    game.autoRun = Boolean(value);
    document.getElementById('waftAuto')?.classList.toggle('active', game.autoRun);
    if (!game.autoRun) runtime()?.setInput?.(0, 0);
    showToast(game.autoRun ? 'Carrera automática activada' : 'Carrera automática desactivada');
  }

  function updateCheckpointUi() {
    const used = game.checkpoints.filter(Boolean).length;
    const button = document.getElementById('waftCheckpoints');
    if (button) button.textContent = used ? 'RUTA ' + used + '/3' : 'RUTA';
  }

  function checkpointAction(event) {
    const button = event.target.closest('button[data-action]');
    const row = event.target.closest('.waftCheckpointRow');
    if (!button || !row) return;
    const index = Number(row.dataset.index);
    const api = runtime();
    const state = api?.getState?.();
    if (!api || !state) return;
    if (button.dataset.action === 'set') {
      game.checkpoints[index] = { regionId: REGION_ID, x: state.position.x, z: state.position.z, heading: state.playerFacing };
      showToast('Punto ' + 'ABC'[index] + ' guardado');
    } else if (button.dataset.action === 'return') {
      const point = game.checkpoints[index];
      if (!point) { showToast('Ese punto está vacío'); return; }
      if (point.regionId !== REGION_ID) { showToast('Ese punto pertenece a ' + REGION_NAMES[point.regionId]); return; }
      api.setRegionalPosition(point.x, point.z);
      api.setHeading(point.heading || 0);
      showToast('Regreso al punto ' + 'ABC'[index]);
    } else {
      game.checkpoints[index] = null;
      showToast('Punto ' + 'ABC'[index] + ' eliminado');
    }
    updateCheckpointUi();
    saveGame('checkpoint');
  }

  function travelToOtherRegion() {
    const port = PORTS[REGION_ID];
    if (!port) return;
    saveGame('regional-departure');
    try {
      localStorage.setItem('waft.adventure.0210.pending-arrival', JSON.stringify({
        target: port.target,
        from: REGION_ID,
        createdAt: Date.now()
      }));
    } catch {}
    const url = new URL(location.href);
    url.searchParams.set('region', port.target);
    url.searchParams.set('v', BUILD_ID + '-' + Date.now());
    location.href = url.href;
  }

  function applyPendingArrival() {
    if (game.pendingArrivalApplied) return;
    game.pendingArrivalApplied = true;
    try {
      const raw = localStorage.getItem('waft.adventure.0210.pending-arrival');
      if (!raw) return;
      const pending = JSON.parse(raw);
      if (pending.target !== REGION_ID || Date.now() - pending.createdAt > 120000) return;
      localStorage.removeItem('waft.adventure.0210.pending-arrival');
      const port = PORTS[REGION_ID];
      runtime().setRegionalPosition(port.x, port.z);
      runtime().setHeading(port.heading);
      showToast('Llegada a ' + port.name);
    } catch (error) { console.warn(error); }
  }

  function findPreset(api, terms, fallbackIndex = 0) {
    const presets = api.metadata?.presets || [];
    for (const term of terms) {
      const found = presets.find(item => String(item.id + ' ' + item.name).toLowerCase().includes(term));
      if (found) return found;
    }
    return presets[fallbackIndex] || { x: 0, z: 0, name: 'origen' };
  }

  function findSurface(api, x, z, kind = 'land') {
    const desiredLand = kind !== 'water';
    for (const radius of [0, 1.2, 2.4, 4, 6, 9, 13, 18, 25]) {
      const samples = radius === 0 ? 1 : 24;
      for (let index = 0; index < samples; index++) {
        const angle = index / samples * Math.PI * 2;
        const px = x + Math.cos(angle) * radius;
        const pz = z + Math.sin(angle) * radius;
        const surface = api.sampleSurface(px, pz);
        if (!surface?.inside) continue;
        if ((desiredLand && surface.land) || (!desiredLand && surface.water)) return { x: px, z: pz, y: surface.height, surface };
      }
    }
    const surface = api.sampleSurface(x, z);
    return { x, z, y: surface?.height || 0, surface };
  }

  function createAnimal(id, type, name, x, z, options = {}) {
    return {
      id, type, name, x, z, originX: x, originZ: z,
      y: 0, yaw: options.yaw || 0, phase: Math.random() * Math.PI * 2,
      speed: options.speed || 0, radius: options.radius || 3.5,
      mountable: Boolean(options.mountable), aquatic: Boolean(options.aquatic), flying: Boolean(options.flying), flightMountReady: false, landed: false,
      mission: options.mission || null, fleeing: false, fleeTime: 0, hidden: false
    };
  }

  function buildAdventurePopulation(api) {
    const palma = findPreset(api, ['palma'], 0);
    const llevant = findPreset(api, ['llevant', 'manacor'], 1);
    const alcudia = findPreset(api, ['alcúdia', 'alcudia'], 2);
    const menorca = findPreset(api, ['menorca', 'maó', 'mao'], 3);
    const eivissa = findPreset(api, ['eivissa', 'ibiza'], 4);
    const positions = [];
    const land = (base, dx, dz) => findSurface(api, base.x + dx, base.z + dz, 'land');
    const water = (base, dx, dz) => findSurface(api, base.x + dx, base.z + dz, 'water');

    if (REGION_ID === 'baleares') {
      const camp = land(llevant, 3.5, -2.5);
      game.npc = { id: 'aina', name: 'Aina', x: camp.x, z: camp.z, y: camp.y, yaw: .6 };
      positions.push(
        ['lizard-mission','lizard','Lagartija balear',land(llevant, 6, -1),{mission:'lizard'}],
        ['gineta-mission','gineta','Gineta',land(llevant, 12, 7),{mission:'gineta'}],
        ['myotragus-mission','myotragus','Myotragus balearicus',land(alcudia, -10, 11),{mission:'myotragus'}],
        ['goat-1','goat','Cabra mallorquina',land(alcudia, 5, -7),{mountable:true,speed:.32}],
        ['goat-2','goat','Cabra mallorquina',land(alcudia, 8, -4),{mountable:true,speed:.27}],
        ['cow-1','cow','Vaca vermella menorquina',land(menorca, 5, 4),{speed:.18}],
        ['pig-1','pig','Porc negre mallorquí',land(llevant, -7, 8),{speed:.22}],
        ['warbler-1','warbler','Curruca balear',land(eivissa, 5, 3),{flying:true,speed:.42}],
        ['vulture-1','vulture','Buitre negro',land(alcudia, -14, -8),{flying:true,mountable:true,speed:.34}],
        ['shark-1','shark','Tintorera',water(palma, 18, 12),{aquatic:true,mountable:true,speed:.34}]
      );
    } else {
      const camp = land(palma, 4, -3);
      game.npc = { id: 'explorer', name: 'Núria', x: camp.x, z: camp.z, y: camp.y, yaw: -.4 };
      positions.push(
        ['goat-cat','goat','Cabra montés',land(alcudia, 8, 5),{mountable:true,speed:.3}],
        ['cow-cat','cow','Vaca pirenaica',land(menorca, -5, 6),{speed:.18}],
        ['pig-cat','pig','Jabalí',land(llevant, 6, -6),{speed:.24}],
        ['warbler-cat','warbler','Curruca cabecinegra',land(eivissa, 4, 3),{flying:true,speed:.4}],
        ['vulture-cat','vulture','Buitre leonado',land(alcudia, -10, -8),{flying:true,mountable:true,speed:.34}],
        ['shark-cat','shark','Tintorera',water(palma, 16, 10),{aquatic:true,mountable:true,speed:.34}]
      );
    }
    if (REGION_ID === 'baleares') {
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
    game.animals = positions.map(([id,type,name,position,options]) => {
      const animal = createAnimal(id,type,name,position.x,position.z,options);
      animal.y = position.y;
      return animal;
    });
    updateObjective();
  }

  const observationLines = {
    lizard: ['Se calienta sobre la piedra y huye con una aceleración seca.'],
    gineta: ['Se mueve pegada al sotobosque y mantiene siempre una salida abierta.'],
    myotragus: ['Sus patas cortas y cuerpo compacto están adaptados a la pendiente rocosa.'],
    goat: ['Apoya las pezuñas con precisión incluso sobre la roca inclinada.'],
    cow: ['Avanza con paso pesado y estable entre caminos y muros.'],
    pig: ['Remueve la tierra, se detiene a olfatear y cambia de dirección.'],
    warbler: ['Vuela bajo con aleteos cortos y precisos antes de posarse.'],
    shark: ['La espalda azul se confunde con el mar cuando gana profundidad.'],
    vulture: ['Apenas bate las alas: aprovecha el aire ascendente para sostenerse.'],
    rabbit: ['Se queda inmóvil un instante y después avanza a saltos cortos hacia la cobertura.'],
    weasel: ['Se mueve pegada al suelo, con cambios de dirección rápidos y continuos.'],
    salamander: ['Permanece cerca de las zonas húmedas y avanza lentamente entre piedras y sombra.']
  };

  function talkNpc() {
    if (REGION_ID !== 'baleares') {
      showDialogue(game.npc.name, ['La ruta de Barcelona conecta el mundo continental con la expedición de Baleares.', 'Puedes observar la fauna, guardar puntos y regresar al puerto cuando quieras.']);
      return;
    }
    if (game.missionStage === 0) {
      showDialogue('Aina', ['Necesito comprobar cómo responde la fauna al paso de la expedición.', 'Empieza por la lagartija que se esconde junto al campamento.'], () => setStage(1, 'Nueva misión: fauna del Llevant'));
    } else if (game.missionStage === 4) {
      showDialogue('Aina', ['Bien. La gineta está sana y conserva su territorio.', 'La última señal viene de la sierra: busca al Myotragus cerca de Alcúdia.'], () => setStage(5, 'Rumbo a la sierra'));
    } else if (game.missionStage < 4) {
      showDialogue('Aina', ['Sigue la pista marcada en el objetivo. No hace falta capturar ningún animal.']);
    } else {
      showDialogue('Aina', ['La expedición de Tramuntana queda registrada. Ahora puedes explorar las islas libremente.']);
    }
  }

  function observeAnimal(animal) {
    game.observed[animal.id] = true;
    const line = observationLines[animal.type]?.[0] || 'El animal mantiene la distancia y sigue observando.';
    if (animal.mission === 'lizard' && game.missionStage === 1) {
      showDialogue(animal.name, [line, 'La observación queda registrada. Hay huellas de gineta hacia los pinos.'], () => setStage(2, 'Pista nueva: gineta'));
    } else if (animal.mission === 'gineta' && game.missionStage === 2) {
      animal.fleeing = true;
      animal.fleeTime = 0;
      showDialogue(animal.name, ['Te detecta y sale disparada hacia un roquedo. Síguela sin acercarte demasiado.'], () => setStage(3, 'La gineta ha echado a correr'));
    } else if (animal.mission === 'gineta' && game.missionStage === 3 && !animal.fleeing) {
      showDialogue(animal.name, [line, 'Respira con normalidad y no presenta heridas. Regresa con Aina.'], () => setStage(4, 'La gineta está sana'));
    } else if (animal.mission === 'myotragus' && game.missionStage === 5) {
      game.discoveries.myotragus = true;
      showDialogue(animal.name, [line, 'DESCUBRIMIENTO REGISTRADO: Myotragus balearicus.'], completeMission);
    } else {
      showDialogue(animal.name, [line, game.observed[animal.id] ? 'Observación registrada en el archivo de expedición.' : '']);
    }
    saveGame('animal-observed');
  }

  function completeMission() {
    if (game.missionStage < 5) return;
    game.missionStage = 6;
    game.missionComplete = true;
    updateObjective();
    saveGame('mission-complete');
    const banner = document.getElementById('waftMissionComplete');
    banner.classList.add('show');
    setTimeout(() => banner.classList.remove('show'), 4300);
  }

  function mountedAnimal() { return game.animals.find(item => item.id === game.mountedAnimalId) || null; }

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

  function updateAnimals(dt, now) {
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

  function planetEntityInRange(entity, playerPosition, radius) {
    if (!window.__WAFT_PLANET_WORLD_0270_ACTIVE__) return true;
    if (!entity || !playerPosition) return false;
    return Math.hypot((Number(entity.x)||0)-playerPosition.x,(Number(entity.z)||0)-playerPosition.z) <= radius;
  }

  function updateInteraction(playerState) {
    if (game.dialogueOpen) return setCurrentInteractable(null);
    if (game.mountedAnimalId) {
      setCurrentInteractable({ label: 'DESMONTAR', action: dismountAnimal });
      return;
    }
    const api = runtime();
    const playerDisplay = playerState.displayPosition;
    const candidates = [];
    const add = (x, z, radius, item) => {
      const display = api.regionalToDisplay(x, z);
      const distance = Math.hypot(display.x - playerDisplay.x, display.z - playerDisplay.z);
      if (distance <= radius) candidates.push({ ...item, distance });
    };
    if (game.npc) add(game.npc.x, game.npc.z, 4.8, { label: 'HABLAR', action: talkNpc });
    for (const animal of game.animals) {
      if (animal.hidden || (animal.mission === 'gineta' && animal.fleeing)) continue;
      const canMount = animal.mountable
        && (animal.type !== 'vulture' || animal.flightMountReady)
        && (animal.type !== 'shark' || playerState.swimming);
      const label = canMount ? 'MONTAR ' + animal.name.toUpperCase() : 'OBSERVAR ' + animal.name.toUpperCase();
      add(animal.x, animal.z, animal.type === 'shark' ? 7 : animal.type === 'vulture' ? 8.5 : 5, {
        label,
        action: canMount ? () => mountAnimal(animal) : () => observeAnimal(animal),
        secondaryLabel: canMount ? 'OBSERVAR' : null,
        secondaryAction: canMount ? () => observeAnimal(animal) : null
      });
    }
    candidates.sort((a,b) => a.distance - b.distance);
    setCurrentInteractable(candidates[0] || null);
  }

  function setCurrentInteractable(interactable) {
    game.currentInteractable = interactable;
    const action = document.getElementById('waftAdventureAction');
    const observe = document.getElementById('waftObserveAction');
    if (!action || !observe) return;
    action.classList.toggle('visible', Boolean(interactable));
    observe.classList.toggle('visible', Boolean(interactable?.secondaryAction));
    if (interactable) action.textContent = interactable.label;
    if (interactable?.secondaryAction) observe.textContent = interactable.secondaryLabel || 'OBSERVAR';
  }

  function updateTravelButton(playerState) {
    const port = PORTS[REGION_ID];
    const button = document.getElementById('waftTravelAction');
    if (!port || !button) return;
    const distance = Math.hypot(playerState.position.x - port.x, playerState.position.z - port.z);
    const visible = playerState.worldMode === 'regional' && distance < 18;
    button.classList.toggle('visible', visible);
    button.textContent = 'NAVEGAR A ' + REGION_NAMES[port.target].toUpperCase();
  }

  function updateFrame(now) {
    const api = runtime();
    const state = api?.getState?.();
    if (!state) return;
    const dt = Math.min(.05, Math.max(0, (now - game.lastFrameAt) / 1000));
    game.lastFrameAt = now;
    if (game.previousPlayer) game.playerSpeed = Math.hypot(state.displayPosition.x-game.previousPlayer.x, state.displayPosition.z-game.previousPlayer.z) / Math.max(.001, dt);
    game.previousPlayer = { x: state.displayPosition.x, z: state.displayPosition.z };
    if (game.autoRun && !game.dialogueOpen) api.setInput(0, -1);
    updateAnimals(dt, now);
    updateInteraction(state);
    updateTravelButton(state);
    const mounted = mountedAnimal();
    const jumpButton = document.getElementById('waftJump');
    if (game.jumpPointer !== null) {
      const charge = Math.min(1, Math.max(0, (performance.now() - game.jumpChargeStartedAt) / 1250));
      jumpButton?.style.setProperty('--charge', charge);
      if (jumpButton && mounted?.type === 'vulture') jumpButton.textContent = 'ALETEO';
    } else if (jumpButton) jumpButton.textContent = mounted?.type === 'vulture' ? 'ALETEAR' : 'SALTAR';
  }

  const renderer = {
    ready: false,
    regionalEntitiesDrawn: 0,
    sharedWorldContext: false,
    canvas: null,
    gl: null,
    program: null,
    sphere: null,
    cylinder: null,
    uniforms: null,
    init() {
      const overlayCanvas=document.getElementById('waftAdventureCanvas');
      this.sharedWorldContext=Boolean(window.__WAFT_PLANET_WORLD_0270_ACTIVE__);
      this.canvas=this.sharedWorldContext?[...document.querySelectorAll('canvas')].find(canvas=>canvas!==overlayCanvas):overlayCanvas;
      if(this.sharedWorldContext&&overlayCanvas)overlayCanvas.style.display='none';
      const gl=this.sharedWorldContext?this.canvas?.getContext('webgl2'):this.canvas?.getContext('webgl2',{alpha:true,antialias:true,premultipliedAlpha:false});
      if (!gl) { console.warn('No overlay WebGL2'); return; }
      this.gl = gl;
      const vertex = `#version 300 es
        layout(location=0) in vec3 aPosition;layout(location=1) in vec3 aNormal;
        uniform mat4 uPV;uniform mat4 uModel;out vec3 vNormal;out vec3 vWorld;
        void main(){vec4 world=uModel*vec4(aPosition,1.0);vWorld=world.xyz;vNormal=normalize(mat3(uModel)*aNormal);gl_Position=uPV*world;}`;
      const fragment = `#version 300 es
        precision highp float;in vec3 vNormal;in vec3 vWorld;uniform vec3 uColor;uniform vec3 uCamera;out vec4 outColor;
        void main(){vec3 n=normalize(vNormal);float sun=max(dot(n,normalize(vec3(.38,.90,.24))),0.0);float fill=.38+.25*max(n.y,0.0);float rim=pow(1.0-max(dot(n,normalize(uCamera-vWorld)),0.0),2.0)*.15;outColor=vec4(uColor*(fill+sun*.55)+rim,1.0);}`;
      this.program = createProgram(gl, vertex, fragment);
      this.sphere = createSphere(gl, 14, 9);
      this.cylinder = createCylinder(gl, 12);
      this.uniforms = {
        pv: gl.getUniformLocation(this.program,'uPV'), model: gl.getUniformLocation(this.program,'uModel'),
        color: gl.getUniformLocation(this.program,'uColor'), camera: gl.getUniformLocation(this.program,'uCamera')
      };
      gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      this.ready = true;
    },
    resize() {
      if(this.sharedWorldContext)return;
      const dpr = Math.min(1.65, devicePixelRatio || 1);
      const width = Math.max(1, Math.floor(innerWidth*dpr));
      const height = Math.max(1, Math.floor(innerHeight*dpr));
      if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width=width;this.canvas.height=height;this.gl.viewport(0,0,width,height); }
    },
    rebaseRegionalEntities(project) {
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
    render(now, eye, pv) {
      const gl = this.gl;
      const api = runtime();
      const player = frameRuntimeState(api);
      if (!player) return;
      M.reset();
      this.resize();
      if(!this.sharedWorldContext){gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);}
      gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.depthMask(true);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(this.program); gl.uniformMatrix4fv(this.uniforms.pv,false,pv); gl.uniform3f(this.uniforms.camera,eye[0],eye[1],eye[2]);
      drawCheckpointRoute(this);
      const visibleAnimals = game.animals.filter(animal => !animal.hidden && planetEntityInRange(animal, player.position, 180));
      const visibleNpc = game.npc && planetEntityInRange(game.npc, player.position, 180) ? game.npc : null;
      this.regionalEntitiesDrawn = visibleAnimals.length + (visibleNpc ? 1 : 0);
      for (const animal of visibleAnimals) drawAnimal(this, animal, now);
      if (visibleNpc) drawNpc(this, visibleNpc, now);
      const mounted = game.animals.find(item => item.id === game.mountedAnimalId);
      if (mounted) {
        const visual = { ...mounted, x: player.position.x, z: player.position.z, y: player.position.y - (player.swimming ? .46 : .82), yaw: player.playerFacing };
        drawAnimal(this, visual, now, true);
        drawPenguin(this, player, now, mounted.type === 'shark' ? .85 : 1.05);
      } else drawPenguin(this, player, now, 0);
      gl.bindVertexArray(null);
    }
  };

  function compile(gl,type,source){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));return shader}
  function createProgram(gl,vertex,fragment){const p=gl.createProgram();gl.attachShader(p,compile(gl,gl.VERTEX_SHADER,vertex));gl.attachShader(p,compile(gl,gl.FRAGMENT_SHADER,fragment));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p}
  function createSphere(gl,segments,rings){const values=[],indices=[];for(let r=0;r<=rings;r++){const v=r/rings,theta=v*Math.PI,st=Math.sin(theta),ct=Math.cos(theta);for(let s=0;s<=segments;s++){const u=s/segments,phi=u*Math.PI*2,nx=Math.cos(phi)*st,ny=ct,nz=Math.sin(phi)*st;values.push(nx,ny,nz,nx,ny,nz)}}for(let r=0;r<rings;r++)for(let s=0;s<segments;s++){const a=r*(segments+1)+s,b=a+segments+1;indices.push(a,b,a+1,b,b+1,a+1)}return uploadMesh(gl,new Float32Array(values),new Uint16Array(indices))}
  function createCylinder(gl,segments){const values=[],indices=[];for(let ring=0;ring<2;ring++){const y=ring-.5;for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2,x=Math.cos(a),z=Math.sin(a);values.push(x,y,z,x,0,z)}}for(let i=0;i<segments;i++){const a=i,b=i+1,c=segments+1+i,d=c+1;indices.push(a,c,b,b,c,d)}return uploadMesh(gl,new Float32Array(values),new Uint16Array(indices))}
  function uploadMesh(gl,vertices,indices){const vao=gl.createVertexArray();gl.bindVertexArray(vao);const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);gl.bindVertexArray(null);return{vao,count:indices.length}}

  const matrixPool=[];
  const M = {
    cursor:0,
    reset(){this.cursor=0},
    next(){let matrix=matrixPool[this.cursor];if(!matrix)matrixPool[this.cursor]=matrix=new Float32Array(16);this.cursor++;return matrix},
    identity(){const matrix=this.next();matrix.fill(0);matrix[0]=matrix[5]=matrix[10]=matrix[15]=1;return matrix},
    multiply(a,b){const out=this.next();for(let c=0;c<4;c++)for(let r=0;r<4;r++)out[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return out},
    t(x,y,z){const m=this.identity();m[12]=x;m[13]=y;m[14]=z;return m},
    s(x,y,z){const m=this.identity();m[0]=x;m[5]=y;m[10]=z;return m},
    ry(a){const c=Math.cos(a),s=Math.sin(a),m=this.identity();m[0]=c;m[2]=-s;m[8]=s;m[10]=c;return m},
    rx(a){const c=Math.cos(a),s=Math.sin(a),m=this.identity();m[5]=c;m[6]=s;m[9]=-s;m[10]=c;return m},
    rz(a){const c=Math.cos(a),s=Math.sin(a),m=this.identity();m[0]=c;m[1]=s;m[4]=-s;m[5]=c;return m},
    compose(...matrices){return matrices.reduce((a,b)=>this.multiply(a,b),this.identity())}
  };

  function drawMesh(renderer, mesh, model, color) {
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
  }
  function worldBase(x,y,z,yaw,scale=1){return M.compose(M.t(x,y,z),M.ry(yaw),M.s(scale,scale,scale))}
  function drawSphere(r,base,x,y,z,sx,sy,sz,color,rot=null){drawMesh(r,r.sphere,M.compose(base,M.t(x,y,z),rot||M.identity(),M.s(sx,sy,sz)),color)}
  function drawCylinderPart(r,base,x,y,z,sx,sy,sz,color,rot=null){drawMesh(r,r.cylinder,M.compose(base,M.t(x,y,z),rot||M.identity(),M.s(sx,sy,sz)),color)}

  function drawPenguin(r, state, now, mountedOffset=0) {
    const display=state.displayPosition;
    const baseY=state.position.y-(state.swimming?.46:.82)+mountedOffset;
    const speed=Math.min(1,game.playerSpeed/4.5),phase=now*.011,step=Math.sin(phase)*speed,swim=state.swimming;
    const base=worldBase(display.x,baseY,display.z,state.playerFacing,.70);
    drawSphere(r,base,0,.82,0,.43,.68,.34,[.035,.055,.065],swim?M.rx(-.38):null);
    drawSphere(r,base,0,.84,.24,.30,.50,.12,[.88,.89,.83],swim?M.rx(-.38):null);
    drawSphere(r,base,0,1.42,.02,.39,.40,.37,[.035,.05,.058]);
    drawSphere(r,base,0,1.38,.34,.22,.19,.20,[.77,.48,.12]);
    drawSphere(r,base,-.14,1.49,.34,.038,.045,.03,[.01,.014,.016]);
    drawSphere(r,base,.14,1.49,.34,.038,.045,.03,[.01,.014,.016]);
    const flap=swim?Math.sin(phase)*.65:step*.28;
    drawSphere(r,base,-.43,.88,.02,.13,.48,.09,[.028,.045,.052],M.rz(.20+flap));
    drawSphere(r,base,.43,.88,.02,.13,.48,.09,[.028,.045,.052],M.rz(-.20-flap));
    drawSphere(r,base,-.20,.13,.18+step*.14,.22,.08,.33,[.82,.50,.12]);
    drawSphere(r,base,.20,.13,.18-step*.14,.22,.08,.33,[.82,.50,.12]);
  }

  function drawNpc(r,npc,now){const api=runtime(),display=api.regionalToDisplay(npc.x,npc.z),surface=api.sampleSurface(npc.x,npc.z),base=worldBase(display.x,surface.height,display.z,npc.yaw,.72),wave=Math.sin(now*.002)*.08;drawSphere(r,base,0,.82,0,.30,.52,.24,[.25,.48,.44]);drawSphere(r,base,0,1.38,0,.30,.30,.28,[.67,.48,.34]);drawCylinderPart(r,base,-.33,.78,wave,.09,.72,.09,[.67,.48,.34],M.rz(.15));drawCylinderPart(r,base,.33,.78,-wave,.09,.72,.09,[.67,.48,.34],M.rz(-.15));drawCylinderPart(r,base,-.16,.25,0,.11,.52,.11,[.16,.24,.25]);drawCylinderPart(r,base,.16,.25,0,.11,.52,.11,[.16,.24,.25])}

  function drawAnimal(r,a,now,mounted=false){const api=runtime(),display=api.regionalToDisplay(a.x,a.z),surface=api.sampleSurface(a.x,a.z),baseY=a.flying?a.y:(surface?.height??a.y),bob=mounted?Math.abs(Math.sin(now*.012))*.04:Math.sin(now*.002+a.phase)*.018,base=worldBase(display.x,baseY+bob,display.z,a.yaw,1);switch(a.type){
    case'lizard':drawSphere(r,base,0,.12,0,.12,.10,.42,[.34,.50,.22]);drawSphere(r,base,0,.14,.39,.13,.11,.18,[.42,.58,.25]);drawSphere(r,base,0,.10,-.47,.07,.06,.48,[.31,.45,.19]);break;
    case'gineta':drawQuadruped(r,base,[.35,.30,.24],[.15,.12,.10],.62,.34,.95);drawSphere(r,base,0,.43,-.78,.10,.10,.75,[.28,.25,.22],M.rx(.18));break;
    case'myotragus':drawQuadruped(r,base,[.50,.39,.25],[.16,.12,.08],.72,.45,1.05);drawSphere(r,base,0,.82,.70,.28,.28,.34,[.57,.45,.29]);drawCylinderPart(r,base,-.17,1.08,.66,.04,.30,.04,[.72,.67,.55],M.rz(-.25));drawCylinderPart(r,base,.17,1.08,.66,.04,.30,.04,[.72,.67,.55],M.rz(.25));break;
    case'goat':drawQuadruped(r,base,[.57,.44,.28],[.16,.12,.08],.82,.48,1.12);drawSphere(r,base,0,.95,.78,.33,.31,.38,[.66,.52,.34]);drawCylinderPart(r,base,-.18,1.27,.70,.05,.38,.05,[.73,.67,.53],M.rz(-.22));drawCylinderPart(r,base,.18,1.27,.70,.05,.38,.05,[.73,.67,.53],M.rz(.22));break;
    case'cow':drawQuadruped(r,base,[.80,.72,.58],[.20,.14,.10],1.25,.72,1.58);drawSphere(r,base,0,1.35,1.15,.55,.45,.50,[.67,.42,.24]);break;
    case'pig':drawQuadruped(r,base,[.18,.14,.12],[.08,.06,.05],.92,.54,1.18);drawSphere(r,base,0,.72,.88,.42,.32,.45,[.16,.12,.11]);drawSphere(r,base,0,.64,1.28,.27,.18,.24,[.27,.19,.17]);break;
    case'rabbit':drawSphere(r,base,0,.32,0,.32,.28,.46,[.48,.39,.29]);drawSphere(r,base,0,.48,.42,.25,.24,.25,[.52,.43,.32]);drawCylinderPart(r,base,-.10,.78,.42,.045,.34,.045,[.50,.41,.30],M.rz(-.08));drawCylinderPart(r,base,.10,.78,.42,.045,.34,.045,[.50,.41,.30],M.rz(.08));break;
    case'weasel':drawSphere(r,base,0,.22,0,.22,.18,.72,[.39,.29,.19]);drawSphere(r,base,0,.27,.63,.20,.18,.25,[.43,.32,.21]);drawSphere(r,base,0,.18,-.72,.10,.09,.62,[.34,.25,.17],M.rx(.10));break;
    case'salamander':drawSphere(r,base,0,.075,0,.12,.07,.46,[.13,.15,.10]);drawSphere(r,base,0,.09,.42,.13,.09,.18,[.18,.20,.13]);drawSphere(r,base,0,.06,-.52,.06,.045,.48,[.11,.13,.085]);break;
    case'warbler':drawBird(r,base,now,[.39,.31,.22],.55);break;
    case'vulture':drawBird(r,base,now,[.085,.075,.062],1.5);break;
    case'shark':drawSphere(r,base,0,.05,0,.62,.42,1.85,[.20,.38,.50]);drawSphere(r,base,0,.08,1.55,.40,.26,.48,[.15,.31,.43]);drawSphere(r,base,-.58,.02,.12,.65,.06,.76,[.15,.31,.43],M.rz(.08));drawSphere(r,base,.58,.02,.12,.65,.06,.76,[.15,.31,.43],M.rz(-.08));drawSphere(r,base,0,.05,-1.70,.18,.15,.62,[.20,.38,.50]);break;
  }}
  function drawQuadruped(r,base,bodyColor,hoof,sx,sy,sz){drawSphere(r,base,0,.78,0,sx,sy,sz,bodyColor);for(const x of[-sx*.58,sx*.58])for(const z of[-sz*.55,sz*.55]){drawCylinderPart(r,base,x,.34,z,.08,.66,.08,bodyColor);drawSphere(r,base,x,.04,z+.05,.11,.08,.18,hoof)}}
  function drawBird(r,base,now,color,scale){const flap=Math.sin(now*.018)*.55;drawSphere(r,base,0,.16,0,.25*scale,.28*scale,.52*scale,color);drawSphere(r,base,0,.28,.45*scale,.19*scale,.18*scale,.23*scale,[.60,.51,.38]);drawSphere(r,base,-.40*scale,.20,0,.55*scale,.05*scale,.25*scale,color,M.rz(.25+flap));drawSphere(r,base,.40*scale,.20,0,.55*scale,.05*scale,.25*scale,color,M.rz(-.25-flap))}

  async function initialize() {
    injectUi();
    renderer.init();
    loadSave();
    const started = performance.now();
    while ((!window.__WAFT_RUNTIME_011_READY__ || !runtime()) && performance.now() - started < 120000) await new Promise(resolve => setTimeout(resolve, 100));
    const api = runtime();
    if (!api) throw new Error('El runtime regional no expuso WAFTRegionRuntime.');
    api.setAdventureModifiers({ ...BASE_SPEEDS, boost: false, flight: false });
    buildAdventurePopulation(api);
    updateMountUi();
    updateCheckpointUi();
    applyPendingArrival();
    game.initialized = true;
    updateObjective();
    saveGame('integration-start');
    setInterval(() => saveGame('autosave'), 10000);
    addEventListener('beforeunload', () => saveGame('beforeunload'));
    document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame('hidden'); });
    window.__WAFT_ADVENTURE_0210_READY__ = true;
    window.WAFTAdventure = {
      getState: () => ({ ...game, animals: game.animals.map(({id,type,name,x,z,mountable})=>({id,type,name,x,z,mountable})) }),
      save: () => saveGame('api', true),
      setStage,
      mount: id => { const animal=game.animals.find(item=>item.id===id); if(animal)mountAnimal(animal); },
      dismount: dismountAnimal,
      version: BUILD_ID
    };
    showToast('Mundo 2 + Adventure conectados');
  }

  initialize().catch(error => {
    console.error(error);
    window.__WAFT_ADVENTURE_0210_ERROR__ = String(error?.message || error);
    const status = document.getElementById('loadText');
    if (status) status.textContent = 'Falló el módulo Adventure: ' + (error?.message || error);
  });
})();
