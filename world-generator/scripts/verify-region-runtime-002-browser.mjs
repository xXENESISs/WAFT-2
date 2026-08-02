import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

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

async function verify() {
  const options = parseArguments(process.argv.slice(2));
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
    if (!response || !response.ok()) throw new Error(`Runtime 002 page returned ${response?.status() ?? 'no response'}`);
    await page.waitForFunction(() => window.__WAFT_RUNTIME_002_READY__ === true, null, { timeout: 120000 });
    await page.waitForTimeout(1800);

    const initial = await page.evaluate(() => ({
      stats: window.__WAFT_RUNTIME_002_STATS__,
      state: window.WAFTRegionRuntime.getState(),
      version: window.WAFTRegionRuntime.version,
      error: window.__WAFT_RUNTIME_002_ERROR__ ?? null,
      canvas: { width: document.querySelector('canvas')?.width ?? 0, height: document.querySelector('canvas')?.height ?? 0 },
      loadingHidden: document.getElementById('loading')?.classList.contains('hide') ?? false,
      presets: [...document.querySelectorAll('#presets button')].map(button => button.textContent),
      webgl2: Boolean(document.querySelector('canvas')?.getContext('webgl2')),
      collisionProbe: window.WAFTRegionRuntime.probeCollision(),
      title: document.getElementById('hudTitle')?.textContent ?? ''
    }));
    if (initial.error) throw new Error(initial.error);
    if (initial.version !== '002') throw new Error(`Unexpected runtime version ${initial.version}`);
    if (initial.title !== 'RUNTIME REGIONAL 002') throw new Error(`Unexpected HUD title ${initial.title}`);
    if (!initial.webgl2) throw new Error('WebGL2 context was not available');
    if (!initial.loadingHidden) throw new Error('Loading overlay did not close');
    if (initial.canvas.width < 800 || initial.canvas.height < 350) throw new Error(`Canvas is too small: ${initial.canvas.width}x${initial.canvas.height}`);
    if (initial.stats.totalBuildings < 5000) throw new Error(`Too few total buildings: ${initial.stats.totalBuildings}`);
    if (initial.stats.activeBuildings <= 0 || initial.stats.activeBuildings >= initial.stats.totalBuildings) throw new Error(`Invalid streamed building count: ${initial.stats.activeBuildings}`);
    if (initial.stats.loadedCells <= 0 || initial.stats.loadedCells > 25) throw new Error(`Invalid loaded cell count: ${initial.stats.loadedCells}`);
    if (initial.state.cameraMode !== 'third-person' || initial.stats.cameraMode !== 'third-person') throw new Error('Third-person camera mode was not exposed');
    if (!initial.state.characterVisible || !initial.stats.characterVisible) throw new Error('Visible character marker is missing');
    if (!initial.state.grounded) throw new Error('Player did not start grounded');
    if (!initial.collisionProbe) throw new Error('Building collision probe failed');
    for (const required of ['Palma', 'Llevant', 'Alcúdia', 'Menorca', 'Eivissa']) {
      if (!initial.presets.includes(required)) throw new Error(`Missing runtime spawn ${required}`);
    }
    const initialCameraDistance = Math.hypot(
      initial.state.cameraEye.x - initial.state.position.x,
      initial.state.cameraEye.y - initial.state.position.y,
      initial.state.cameraEye.z - initial.state.position.z
    );
    if (!(initialCameraDistance > 1 && initialCameraDistance < 9)) throw new Error(`Invalid third-person camera distance ${initialCameraDistance}`);

    await page.evaluate(() => window.WAFTRegionRuntime.spawn('Menorca'));
    await page.waitForTimeout(350);
    const beforeJump = await page.evaluate(() => window.WAFTRegionRuntime.getState());
    if (beforeJump.preset !== 'menorca') throw new Error(`Unexpected spawn preset ${beforeJump.preset}`);
    await page.evaluate(() => window.WAFTRegionRuntime.jump());
    await page.waitForTimeout(220);
    const duringJump = await page.evaluate(() => window.WAFTRegionRuntime.getState());
    const jumpRise = duringJump.position.y - beforeJump.position.y;
    if (jumpRise <= .15) throw new Error(`Jump did not raise the character enough: ${jumpRise}`);
    await page.waitForFunction(() => window.WAFTRegionRuntime.getState().grounded === true, null, { timeout: 5000 });
    const landed = await page.evaluate(() => window.WAFTRegionRuntime.getState());

    let movement = null;
    for (const [x, y] of [[1,0],[0,-1],[-1,0],[0,1]]) {
      const result = await page.evaluate(async ({ x, y }) => {
        const before = window.WAFTRegionRuntime.getState();
        window.WAFTRegionRuntime.setInput(x, y);
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
    if (!movement) throw new Error('Character could not move in any tested direction');
    if (!Number.isFinite(movement.after.playerFacing)) throw new Error('Character facing is invalid');
    const cameraDistanceAfterMovement = Math.hypot(
      movement.after.cameraEye.x - movement.after.position.x,
      movement.after.cameraEye.y - movement.after.position.y,
      movement.after.cameraEye.z - movement.after.position.z
    );
    if (!(cameraDistanceAfterMovement > 1 && cameraDistanceAfterMovement < 9)) throw new Error(`Camera did not follow the character: ${cameraDistanceAfterMovement}`);

    await page.evaluate(() => {
      window.WAFTRegionRuntime.setLayer('roads', false);
      window.WAFTRegionRuntime.setLayer('roads', true);
      window.WAFTRegionRuntime.respawn();
    });
    await page.waitForTimeout(300);
    const finalState = await page.evaluate(() => window.WAFTRegionRuntime.getState());
    if (!finalState.grounded) throw new Error('Respawn did not restore grounded state');
    if (finalState.cameraMode !== 'third-person' || !finalState.characterVisible) throw new Error('Third-person state was lost after respawn');

    if (options.screenshot) {
      fs.mkdirSync(path.dirname(options.screenshot), { recursive: true });
      await page.screenshot({ path: options.screenshot, type: 'png' });
    }
    if (pageErrors.length) throw new Error(`Page errors: ${pageErrors.join(' | ')}`);

    const report = {
      formatVersion: 1,
      runtimeVersion: '002',
      valid: true,
      public: options.public,
      url: options.url,
      buildId: initial.stats.buildId,
      viewport: { width: 844, height: 390, touch: true },
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
