import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const VERIFIER_VERSION = 4;
const PUBLIC_MIRROR_URL = 'https://xxenesiss.github.io/WAFT-2/mallorca-mobile/region-runtime-baleares-002.html?v=4cd5c90e3ce81afa5492ab4fd784dfeac9fe2e30';

function parseArguments(argv) {
  const options = { url: null, output: null, screenshot: null, public: false };
  const args = [...argv];
  while (args.length) {
    const flag = args.shift();
    if (flag === '--url') options.url = args.shift();
    else if (flag === '--output') options.output = args.shift();
    else if (flag === '--screenshot') options.screenshot = args.shift();
    else if (flag === '--public') options.public = true;
    else throw new Error(`Unknown argument ${flag}`);
  }
  if (!options.url || !options.output) throw new Error('--url and --output are required');
  return options;
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

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

function cameraDistance(state) {
  return Math.hypot(
    state.cameraEye.x - state.position.x,
    state.cameraEye.y - state.position.y,
    state.cameraEye.z - state.position.z
  );
}

async function verifyPage(context, url, screenshot = null) {
  const pageErrors = [];
  const consoleErrors = [];
  const page = await context.newPage();
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    requireValue(response?.ok(), `Runtime 002 page returned ${response?.status() ?? 'no response'} at ${url}`);
    await page.waitForFunction(() => window.__WAFT_RUNTIME_002_READY__ === true, null, { timeout: 120000 });
    await page.waitForTimeout(1800);

    const initial = await page.evaluate(() => ({
      stats: window.__WAFT_RUNTIME_002_STATS__,
      state: window.WAFTRegionRuntime.getState(),
      version: window.WAFTRegionRuntime.version,
      error: window.__WAFT_RUNTIME_002_ERROR__ ?? null,
      title: document.getElementById('hudTitle')?.textContent ?? '',
      loadingHidden: document.getElementById('loading')?.classList.contains('hide') ?? false,
      presets: [...document.querySelectorAll('#presets button')].map(button => button.textContent),
      canvas: {
        width: document.querySelector('canvas')?.width ?? 0,
        height: document.querySelector('canvas')?.height ?? 0
      },
      webgl2: Boolean(document.querySelector('canvas')?.getContext('webgl2')),
      collisionProbe: window.WAFTRegionRuntime.probeCollision()
    }));

    requireValue(!initial.error, initial.error || 'Runtime reported an unknown error');
    requireValue(initial.version === '002', `Unexpected runtime version ${initial.version}`);
    requireValue(initial.title === 'RUNTIME REGIONAL 002', `Unexpected HUD title ${initial.title}`);
    requireValue(initial.loadingHidden, 'Loading overlay did not close');
    requireValue(initial.webgl2, 'WebGL2 context was not available');
    requireValue(initial.canvas.width >= 800 && initial.canvas.height >= 350, `Canvas is too small: ${initial.canvas.width}x${initial.canvas.height}`);
    requireValue(initial.stats.totalBuildings >= 5000, `Too few total buildings: ${initial.stats.totalBuildings}`);
    requireValue(initial.stats.activeBuildings > 0 && initial.stats.activeBuildings < initial.stats.totalBuildings, `Invalid streamed building count: ${initial.stats.activeBuildings}`);
    requireValue(initial.stats.loadedCells > 0 && initial.stats.loadedCells <= 25, `Invalid loaded cell count: ${initial.stats.loadedCells}`);
    requireValue(initial.state.cameraMode === 'third-person' && initial.stats.cameraMode === 'third-person', 'Third-person camera mode was not exposed');
    requireValue(initial.state.characterVisible && initial.stats.characterVisible, 'Visible character marker is missing');
    requireValue(initial.state.grounded, 'Player did not start grounded');
    requireValue(initial.collisionProbe, 'Building collision probe failed');
    for (const name of ['Palma', 'Llevant', 'Alcúdia', 'Menorca', 'Eivissa']) requireValue(initial.presets.includes(name), `Missing runtime spawn ${name}`);

    const initialCameraDistance = cameraDistance(initial.state);
    requireValue(initialCameraDistance >= 1.25 && initialCameraDistance < 9, `Invalid third-person camera distance ${initialCameraDistance}`);

    await page.evaluate(() => window.WAFTRegionRuntime.spawn('Menorca'));
    await page.waitForTimeout(350);
    const beforeJump = await page.evaluate(() => window.WAFTRegionRuntime.getState());
    requireValue(beforeJump.preset === 'menorca', `Unexpected spawn preset ${beforeJump.preset}`);

    await page.evaluate(() => window.WAFTRegionRuntime.jump());
    await page.waitForTimeout(220);
    const duringJump = await page.evaluate(() => window.WAFTRegionRuntime.getState());
    const jumpRise = duringJump.position.y - beforeJump.position.y;
    requireValue(jumpRise > .15, `Jump did not raise the character enough: ${jumpRise}`);
    await page.waitForFunction(() => window.WAFTRegionRuntime.getState().grounded === true, null, { timeout: 5000 });
    const landed = await page.evaluate(() => window.WAFTRegionRuntime.getState());

    let movement = null;
    for (const [x, y] of [[1, 0], [0, -1], [-1, 0], [0, 1]]) {
      const result = await page.evaluate(async input => {
        const before = window.WAFTRegionRuntime.getState();
        window.WAFTRegionRuntime.setInput(input.x, input.y);
        await new Promise(resolve => setTimeout(resolve, 650));
        window.WAFTRegionRuntime.setInput(0, 0);
        await new Promise(resolve => setTimeout(resolve, 80));
        const after = window.WAFTRegionRuntime.getState();
        return {
          before,
          after,
          distance: Math.hypot(after.position.x - before.position.x, after.position.z - before.position.z),
          facingChange: Math.abs(Math.atan2(Math.sin(after.playerFacing - before.playerFacing), Math.cos(after.playerFacing - before.playerFacing)))
        };
      }, { x, y });
      if (result.distance > .25) { movement = result; break; }
    }
    requireValue(movement, 'Character could not move in any tested direction');
    requireValue(Number.isFinite(movement.after.playerFacing), 'Character facing is invalid');
    const cameraDistanceAfterMovement = cameraDistance(movement.after);
    requireValue(cameraDistanceAfterMovement >= 1.25 && cameraDistanceAfterMovement < 9, `Camera did not follow the character: ${cameraDistanceAfterMovement}`);

    await page.evaluate(() => window.WAFTRegionRuntime.respawn());
    await page.waitForTimeout(300);
    const finalState = await page.evaluate(() => window.WAFTRegionRuntime.getState());
    requireValue(finalState.grounded, 'Respawn did not restore grounded state');
    requireValue(finalState.cameraMode === 'third-person' && finalState.characterVisible, 'Third-person state was lost after respawn');
    requireValue(pageErrors.length === 0, `Page errors: ${pageErrors.join(' | ')}`);

    if (screenshot) {
      fs.mkdirSync(path.dirname(screenshot), { recursive: true });
      await page.screenshot({ path: screenshot, type: 'png' });
    }

    return {
      valid: true,
      url,
      buildId: initial.stats.buildId,
      canvas: initial.canvas,
      presets: initial.presets,
      tests: {
        totalBuildings: initial.stats.totalBuildings,
        streamedBuildings: initial.stats.activeBuildings,
        loadedCells: initial.stats.loadedCells,
        collisionProbe: initial.collisionProbe,
        initialCameraDistance,
        jumpRise,
        landed: landed.grounded,
        movementDistance: movement.distance,
        facingChange: movement.facingChange,
        cameraDistanceAfterMovement,
        respawnGrounded: finalState.grounded,
        cameraMode: finalState.cameraMode,
        characterVisible: finalState.characterVisible
      },
      finalState,
      pageErrors,
      consoleErrors
    };
  } finally {
    await page.close();
  }
}

async function verify() {
  const options = parseArguments(process.argv.slice(2));
  let browser;
  try {
    browser = await chromium.launch({
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
    const context = await browser.newContext({
      viewport: { width: 844, height: 390 },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true
    });
    const primary = await verifyPage(context, options.url, options.screenshot);
    const publicMirror = options.public ? null : await verifyPage(context, PUBLIC_MIRROR_URL);
    const report = {
      formatVersion: 1,
      verifierVersion: VERIFIER_VERSION,
      runtimeVersion: '002',
      valid: true,
      public: options.public,
      url: options.url,
      buildId: primary.buildId,
      viewport: { width: 844, height: 390, touch: true },
      canvas: primary.canvas,
      presets: primary.presets,
      tests: primary.tests,
      finalState: primary.finalState,
      pageErrors: primary.pageErrors,
      consoleErrors: primary.consoleErrors,
      publicMirror
    };
    fs.mkdirSync(path.dirname(options.output), { recursive: true });
    fs.writeFileSync(options.output, `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch (error) {
    const failure = {
      formatVersion: 1,
      verifierVersion: VERIFIER_VERSION,
      runtimeVersion: '002',
      valid: false,
      public: options.public,
      url: options.url,
      publicMirrorUrl: options.public ? null : PUBLIC_MIRROR_URL,
      error: error.stack || error.message
    };
    fs.mkdirSync(path.dirname(options.output), { recursive: true });
    fs.writeFileSync(options.output, `${JSON.stringify(failure, null, 2)}\n`);
    throw error;
  } finally {
    await browser?.close();
  }
}

verify().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
