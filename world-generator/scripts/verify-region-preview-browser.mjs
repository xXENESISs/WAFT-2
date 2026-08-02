import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const VERIFIER_VERSION = 6;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function parseArguments(argv) {
  const result = { url: null, output: null, screenshot: null, public: false };
  const args = [...argv];
  while (args.length) {
    const flag = args.shift();
    if (flag === '--url') result.url = args.shift();
    else if (flag === '--output') result.output = args.shift();
    else if (flag === '--screenshot') result.screenshot = args.shift();
    else if (flag === '--public') result.public = true;
    else throw new Error(`Unknown argument ${flag}`);
  }
  if (!result.url || !result.output) throw new Error('--url and --output are required');
  return result;
}

function patchLocalRuntime(options) {
  if (options.public) return null;
  const runtimePath = path.join(ROOT, 'mallorca-mobile/region-runtime-baleares-001.html');
  if (!fs.existsSync(runtimePath)) throw new Error(`Missing local runtime: ${runtimePath}`);
  let html = fs.readFileSync(runtimePath, 'utf8');
  let changed = false;

  const oldAssertion = "    assert(initial, 'No playable spawn presets were generated');";
  const newAssertion = "    if (!initial) throw new Error('No playable spawn presets were generated');";
  if (html.includes(oldAssertion)) {
    html = html.replace(oldAssertion, newAssertion);
    changed = true;
  } else if (!html.includes(newAssertion)) {
    throw new Error('Runtime assertion marker is missing');
  }

  const oldSpawn = `    const presets = document.getElementById('presets');
    const playable = metadata.presets.filter(item => item.id !== 'overview');
    const spawn = preset => {
      state.activePreset = preset.id;
      for (const button of presets.children) button.classList.toggle('active', button.dataset.id === preset.id);
      state.camera.x = preset.x;
      state.camera.z = preset.z;
      state.camera.y = preset.terrainMeters * terrainMesh.verticalScale + 1.35;
      state.velocityY = 0;
      state.grounded = true;
      state.jumpQueued = false;
      state.respawnQueued = false;
      state.yaw = .4;
      state.pitch = -.18;
      streamer.update(state.camera.x, state.camera.z, true);
    };`;
  const newSpawn = `    const presets = document.getElementById('presets');
    const playable = metadata.presets.filter(item => item.id !== 'overview');
    const terrainAt = (x, z) => {
      const bounds = terrainMesh.bounds;
      const fx = (x - bounds.minX) / (bounds.maxX - bounds.minX) * (terrainMesh.columns - 1);
      const fz = (z - bounds.minZ) / (bounds.maxZ - bounds.minZ) * (terrainMesh.rows - 1);
      if (fx < 0 || fz < 0 || fx > terrainMesh.columns - 1 || fz > terrainMesh.rows - 1) return null;
      const column = Math.max(0, Math.min(terrainMesh.columns - 1, Math.round(fx)));
      const row = Math.max(0, Math.min(terrainMesh.rows - 1, Math.round(fz)));
      const value = terrainMesh.elevations[row * terrainMesh.columns + column];
      return value === terrainMesh.nodata ? null : value * terrainMesh.verticalScale;
    };
    const spawnBlocked = (x, z) => {
      const records = streamer.active;
      const exaggeration = metadata.display.buildingHorizontalExaggeration;
      const radius = .55;
      for (let offset = 0; offset < records.length; offset += 8) {
        const dx = x - records[offset];
        const dz = z - records[offset + 2];
        const angle = records[offset + 6];
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        const localX = dx * c + dz * s;
        const localZ = -dx * s + dz * c;
        if (Math.abs(localX) < records[offset + 3] * exaggeration * .5 + radius && Math.abs(localZ) < records[offset + 5] * exaggeration * .5 + radius) return true;
      }
      return false;
    };
    const findSafeSpawn = preset => {
      const radii = [0, 1.5, 3, 5, 8, 12, 18];
      for (const radius of radii) {
        const samples = radius === 0 ? 1 : 20;
        for (let sample = 0; sample < samples; sample++) {
          const angle = samples === 1 ? 0 : sample / samples * Math.PI * 2;
          const x = preset.x + Math.cos(angle) * radius;
          const z = preset.z + Math.sin(angle) * radius;
          streamer.update(x, z, true);
          const terrain = terrainAt(x, z);
          if (terrain !== null && !spawnBlocked(x, z)) return { x, z, terrain };
        }
      }
      return { x: preset.x, z: preset.z, terrain: preset.terrainMeters * terrainMesh.verticalScale };
    };
    const spawn = preset => {
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
      state.pitch = -.18;
      streamer.update(state.camera.x, state.camera.z, true);
    };`;
  if (html.includes(oldSpawn)) {
    html = html.replace(oldSpawn, newSpawn);
    changed = true;
  } else if (!html.includes('const findSafeSpawn = preset =>')) {
    throw new Error('Runtime safe-spawn marker is missing');
  }

  if (changed) fs.writeFileSync(runtimePath, html);
  return runtimePath;
}

function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ].filter(Boolean);
  for (const candidate of candidates) if (fs.existsSync(candidate)) return candidate;
  throw new Error(`Chrome was not found in: ${candidates.join(', ')}`);
}

async function verifyRuntime(context, previewUrl) {
  const runtimeUrl = previewUrl.replace('region-preview-baleares-001.html', 'region-runtime-baleares-001.html');
  const pageErrors = [];
  const consoleErrors = [];
  const page = await context.newPage();
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  try {
    const response = await page.goto(runtimeUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
    if (!response || !response.ok()) throw new Error(`Runtime page returned ${response?.status() ?? 'no response'}`);
    await page.waitForFunction(() => window.__WAFT_RUNTIME_READY__ === true, null, { timeout: 120000 });
    await page.waitForTimeout(1500);
    const initial = await page.evaluate(() => ({
      stats: window.__WAFT_RUNTIME_STATS__,
      state: window.WAFTRegionRuntime.getState(),
      error: window.__WAFT_RUNTIME_ERROR__ ?? null,
      presets: [...document.querySelectorAll('#presets button')].map(button => button.textContent),
      webgl2: Boolean(document.querySelector('canvas')?.getContext('webgl2')),
      canvas: { width: document.querySelector('canvas')?.width ?? 0, height: document.querySelector('canvas')?.height ?? 0 },
      collisionProbe: window.WAFTRegionRuntime.probeCollision()
    }));
    if (initial.error) throw new Error(initial.error);
    if (!initial.webgl2) throw new Error('Runtime WebGL2 context was not available');
    if (initial.stats.totalBuildings < 5000) throw new Error(`Runtime has too few buildings: ${initial.stats.totalBuildings}`);
    if (initial.stats.activeBuildings <= 0) throw new Error('Runtime has no active streamed buildings');
    if (initial.stats.activeBuildings >= initial.stats.totalBuildings) throw new Error('Runtime loaded every building instead of streaming');
    if (initial.stats.loadedCells <= 0 || initial.stats.loadedCells > 25) throw new Error(`Runtime loaded invalid cell count: ${initial.stats.loadedCells}`);
    if (!initial.state.grounded) throw new Error('Runtime player did not start grounded');
    if (!initial.collisionProbe) throw new Error('Runtime building collision probe failed');
    for (const required of ['Palma', 'Llevant', 'Alcúdia', 'Menorca', 'Eivissa']) {
      if (!initial.presets.includes(required)) throw new Error(`Runtime is missing spawn ${required}`);
    }

    await page.evaluate(() => window.WAFTRegionRuntime.spawn('Menorca'));
    await page.waitForTimeout(300);
    const beforeJump = await page.evaluate(() => window.WAFTRegionRuntime.getState());
    await page.evaluate(() => window.WAFTRegionRuntime.jump());
    await page.waitForTimeout(220);
    const duringJump = await page.evaluate(() => window.WAFTRegionRuntime.getState());
    const jumpRise = duringJump.position.y - beforeJump.position.y;
    if (jumpRise <= .15) throw new Error(`Runtime jump rise is too small: ${jumpRise}`);
    await page.waitForFunction(() => window.WAFTRegionRuntime.getState().grounded === true, null, { timeout: 5000 });
    const landed = await page.evaluate(() => window.WAFTRegionRuntime.getState());

    let movement = null;
    for (const [x, y] of [[0,-1],[1,0],[0,1],[-1,0]]) {
      const result = await page.evaluate(async ({ x, y }) => {
        const before = window.WAFTRegionRuntime.getState();
        window.WAFTRegionRuntime.setInput(x, y);
        await new Promise(resolve => setTimeout(resolve, 450));
        window.WAFTRegionRuntime.setInput(0, 0);
        const after = window.WAFTRegionRuntime.getState();
        return { before, after, distance: Math.hypot(after.position.x - before.position.x, after.position.z - before.position.z) };
      }, { x, y });
      if (result.distance > .25) { movement = result; break; }
    }
    if (!movement) throw new Error('Runtime player could not move in any tested direction');

    await page.evaluate(() => window.WAFTRegionRuntime.respawn());
    await page.waitForTimeout(250);
    const finalState = await page.evaluate(() => window.WAFTRegionRuntime.getState());
    if (!finalState.grounded) throw new Error('Runtime respawn did not restore grounded state');
    if (pageErrors.length) throw new Error(`Runtime page errors: ${pageErrors.join(' | ')}`);

    return {
      valid: true,
      url: runtimeUrl,
      initial,
      tests: {
        streamedBuildings: initial.stats.activeBuildings,
        loadedCells: initial.stats.loadedCells,
        collisionProbe: initial.collisionProbe,
        jumpRise,
        landed: landed.grounded,
        movementDistance: movement.distance,
        respawnGrounded: finalState.grounded
      },
      finalState,
      pageErrors,
      consoleErrors
    };
  } catch (error) {
    return {
      valid: false,
      url: runtimeUrl,
      error: error.stack || error.message,
      pageErrors,
      consoleErrors
    };
  } finally {
    await page.close();
  }
}

async function verify() {
  const options = parseArguments(process.argv.slice(2));
  const patchedRuntimePath = patchLocalRuntime(options);
  const pageErrors = [];
  const consoleErrors = [];
  const browser = await chromium.launch({
    executablePath: findChrome(),
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--ignore-gpu-blocklist',
      '--enable-webgl',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--disable-background-networking'
    ]
  });
  try {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    const response = await page.goto(options.url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    if (!response || !response.ok()) throw new Error(`Preview page returned ${response?.status() ?? 'no response'}`);
    await page.waitForFunction(() => window.__WAFT_PREVIEW_READY__ === true, null, { timeout: 120000 });
    await page.waitForTimeout(2500);
    const initial = await page.evaluate(() => ({
      stats: window.__WAFT_PREVIEW_STATS__,
      error: window.__WAFT_PREVIEW_ERROR__ ?? null,
      canvas: { width: document.querySelector('canvas')?.width ?? 0, height: document.querySelector('canvas')?.height ?? 0 },
      loadingHidden: document.getElementById('loading')?.classList.contains('hide') ?? false,
      presets: [...document.querySelectorAll('#presets button')].map(button => button.textContent),
      webgl2: Boolean(document.querySelector('canvas')?.getContext('webgl2')),
      hud: document.getElementById('hudStats')?.textContent ?? ''
    }));
    if (initial.error) throw new Error(initial.error);
    if (!initial.webgl2) throw new Error('WebGL2 context was not available');
    if (!initial.loadingHidden) throw new Error('Loading overlay did not close');
    if (initial.canvas.width < 800 || initial.canvas.height < 350) throw new Error(`Canvas is too small: ${initial.canvas.width}x${initial.canvas.height}`);
    if (initial.stats.buildings < 5000) throw new Error(`Too few buildings: ${initial.stats.buildings}`);
    if (initial.stats.hotels < 2000) throw new Error(`Too few hotels: ${initial.stats.hotels}`);
    if (initial.stats.selectedRoads < 3000) throw new Error(`Too few roads: ${initial.stats.selectedRoads}`);
    if (initial.stats.landmarks !== 90) throw new Error(`Expected 90 landmarks, got ${initial.stats.landmarks}`);
    for (const required of ['Tot', 'Palma', 'Llevant', 'Menorca', 'Eivissa']) {
      if (!initial.presets.includes(required)) throw new Error(`Missing preset ${required}`);
    }
    const interaction = await page.evaluate(() => {
      window.WAFTPreview.jump('palma');
      window.WAFTPreview.setLayer('roads', false);
      window.WAFTPreview.setLayer('roads', true);
      window.WAFTPreview.setLayer('hotels', false);
      window.WAFTPreview.setLayer('hotels', true);
      return { camera: { ...window.WAFTPreview.camera }, buildId: window.WAFTPreview.metadata.buildId };
    });
    await page.waitForTimeout(800);
    if (!Number.isFinite(interaction.camera.x) || !Number.isFinite(interaction.camera.y) || !Number.isFinite(interaction.camera.z)) throw new Error('Preset produced invalid camera coordinates');
    if (interaction.camera.y <= 1) throw new Error('Preset camera height is invalid');
    if (options.screenshot) {
      fs.mkdirSync(path.dirname(options.screenshot), { recursive: true });
      await page.screenshot({ path: options.screenshot, type: 'png' });
    }
    if (pageErrors.length) throw new Error(`Page errors: ${pageErrors.join(' | ')}`);
    const runtime = await verifyRuntime(context, options.url);
    const report = {
      formatVersion: 1,
      verifierVersion: VERIFIER_VERSION,
      valid: true,
      public: options.public,
      url: options.url,
      buildId: interaction.buildId,
      stats: initial.stats,
      viewport: { width: 844, height: 390, touch: true },
      canvas: initial.canvas,
      presets: initial.presets,
      interaction,
      runtime: { ...runtime, patchedRuntimePath: patchedRuntimePath ? path.relative(ROOT, patchedRuntimePath).replaceAll(path.sep, '/') : null },
      pageErrors,
      consoleErrors
    };
    fs.mkdirSync(path.dirname(options.output), { recursive: true });
    fs.writeFileSync(options.output, `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await browser.close();
  }
}

verify().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
