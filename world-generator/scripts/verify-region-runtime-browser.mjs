import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const VERIFIER_VERSION = 1;

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
    if (!response || !response.ok()) throw new Error(`Runtime page returned ${response?.status() ?? 'no response'}`);
    await page.waitForFunction(() => window.__WAFT_RUNTIME_READY__ === true, null, { timeout: 120000 });
    await page.waitForTimeout(1800);

    const initial = await page.evaluate(() => ({
      stats: window.__WAFT_RUNTIME_STATS__,
      state: window.WAFTRegionRuntime.getState(),
      error: window.__WAFT_RUNTIME_ERROR__ ?? null,
      canvas: { width: document.querySelector('canvas')?.width ?? 0, height: document.querySelector('canvas')?.height ?? 0 },
      loadingHidden: document.getElementById('loading')?.classList.contains('hide') ?? false,
      presets: [...document.querySelectorAll('#presets button')].map(button => button.textContent),
      webgl2: Boolean(document.querySelector('canvas')?.getContext('webgl2')),
      hud: document.getElementById('hudStats')?.textContent ?? '',
      collisionProbe: window.WAFTRegionRuntime.probeCollision()
    }));
    if (initial.error) throw new Error(initial.error);
    if (!initial.webgl2) throw new Error('WebGL2 context was not available');
    if (!initial.loadingHidden) throw new Error('Loading overlay did not close');
    if (initial.canvas.width < 800 || initial.canvas.height < 350) throw new Error(`Canvas is too small: ${initial.canvas.width}x${initial.canvas.height}`);
    if (initial.stats.totalBuildings < 5000) throw new Error(`Too few total buildings: ${initial.stats.totalBuildings}`);
    if (initial.stats.activeBuildings <= 0) throw new Error('No streamed buildings are active');
    if (initial.stats.activeBuildings >= initial.stats.totalBuildings) throw new Error('All buildings are active; streaming is not working');
    if (initial.stats.loadedCells <= 0 || initial.stats.loadedCells > 25) throw new Error(`Invalid loaded cell count: ${initial.stats.loadedCells}`);
    if (!initial.state.grounded) throw new Error('Player did not start grounded');
    if (!initial.collisionProbe) throw new Error('Building collision probe failed');
    for (const required of ['Palma', 'Llevant', 'Alcúdia', 'Menorca', 'Eivissa']) {
      if (!initial.presets.includes(required)) throw new Error(`Missing runtime spawn ${required}`);
    }

    const spawnState = await page.evaluate(() => {
      window.WAFTRegionRuntime.spawn('Menorca');
      return window.WAFTRegionRuntime.getState();
    });
    await page.waitForTimeout(350);
    if (spawnState.preset !== 'menorca') throw new Error(`Unexpected spawn preset ${spawnState.preset}`);

    const beforeJump = await page.evaluate(() => window.WAFTRegionRuntime.getState());
    await page.evaluate(() => window.WAFTRegionRuntime.jump());
    await page.waitForTimeout(220);
    const duringJump = await page.evaluate(() => window.WAFTRegionRuntime.getState());
    if (duringJump.position.y <= beforeJump.position.y + .15) throw new Error('Jump did not increase player height');
    await page.waitForTimeout(900);
    const landed = await page.evaluate(() => window.WAFTRegionRuntime.getState());
    if (!landed.grounded) throw new Error('Player did not land after jump');

    let movement = null;
    for (const input of [[0,-1],[1,0],[0,1],[-1,0]]) {
      const result = await page.evaluate(async ([x,y]) => {
        const before = window.WAFTRegionRuntime.getState();
        window.WAFTRegionRuntime.setInput(x,y);
        await new Promise(resolve => setTimeout(resolve, 450));
        window.WAFTRegionRuntime.setInput(0,0);
        const after = window.WAFTRegionRuntime.getState();
        return { before, after, distance: Math.hypot(after.position.x-before.position.x, after.position.z-before.position.z) };
      }, input);
      if (result.distance > .25) { movement = result; break; }
    }
    if (!movement) throw new Error('Player could not move in any tested direction');

    await page.evaluate(() => {
      window.WAFTRegionRuntime.setLayer('roads', false);
      window.WAFTRegionRuntime.setLayer('roads', true);
      window.WAFTRegionRuntime.setLayer('hotels', false);
      window.WAFTRegionRuntime.setLayer('hotels', true);
      window.WAFTRegionRuntime.respawn();
    });
    await page.waitForTimeout(250);
    const finalState = await page.evaluate(() => window.WAFTRegionRuntime.getState());
    if (!finalState.grounded) throw new Error('Respawn did not restore grounded state');

    if (options.screenshot) {
      fs.mkdirSync(path.dirname(options.screenshot), { recursive: true });
      await page.screenshot({ path: options.screenshot, type: 'png' });
    }
    if (pageErrors.length) throw new Error(`Page errors: ${pageErrors.join(' | ')}`);

    const report = {
      formatVersion: 1,
      verifierVersion: VERIFIER_VERSION,
      valid: true,
      public: options.public,
      url: options.url,
      buildId: initial.stats.buildId,
      stats: initial.stats,
      viewport: { width: 844, height: 390, touch: true },
      canvas: initial.canvas,
      presets: initial.presets,
      tests: {
        streamedBuildings: initial.stats.activeBuildings,
        loadedCells: initial.stats.loadedCells,
        collisionProbe: initial.collisionProbe,
        jumpRise: duringJump.position.y - beforeJump.position.y,
        landed: landed.grounded,
        movementDistance: movement.distance,
        respawnGrounded: finalState.grounded
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
