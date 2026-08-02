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

function dotDirection(displacement, expected) {
  const distance = Math.hypot(displacement.x, displacement.z);
  const expectedLength = Math.hypot(expected.x, expected.z) || 1;
  if (distance < 1e-6) return { distance, alignment: -1 };
  return {
    distance,
    alignment: (displacement.x * expected.x + displacement.z * expected.z) / (distance * expectedLength)
  };
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
    page.on('console', message => {
      if (message.type() === 'error' && !message.text().includes('favicon')) consoleErrors.push(message.text());
    });

    const response = await page.goto(options.url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    if (!response || !response.ok()) throw new Error(`Runtime 003 page returned ${response?.status() ?? 'no response'}`);
    await page.waitForFunction(() => window.__WAFT_RUNTIME_003_READY__ === true, null, { timeout: 120000 });
    await page.waitForTimeout(1500);

    const initial = await page.evaluate(() => ({
      stats: window.__WAFT_RUNTIME_003_STATS__,
      state: window.WAFTRegionRuntime.getState(),
      version: window.WAFTRegionRuntime.version,
      title: document.getElementById('hudTitle')?.textContent ?? '',
      loadingHidden: document.getElementById('loading')?.classList.contains('hide') ?? false,
      webgl2: Boolean(document.querySelector('canvas')?.getContext('webgl2')),
      canvas: { width: document.querySelector('canvas')?.width ?? 0, height: document.querySelector('canvas')?.height ?? 0 },
      presets: [...document.querySelectorAll('#presets button')].map(button => button.textContent),
      error: window.__WAFT_RUNTIME_003_ERROR__ ?? null
    }));

    if (initial.error) throw new Error(initial.error);
    if (initial.version !== '003') throw new Error(`Unexpected runtime version ${initial.version}`);
    if (initial.title !== 'RUNTIME REGIONAL 003') throw new Error(`Unexpected HUD title ${initial.title}`);
    if (!initial.loadingHidden || !initial.webgl2) throw new Error('Runtime 003 did not finish WebGL2 startup');
    if (initial.canvas.width < 800 || initial.canvas.height < 350) throw new Error(`Canvas is too small: ${initial.canvas.width}x${initial.canvas.height}`);
    if (initial.stats.totalBuildings < 5000 || initial.stats.activeBuildings <= 0) throw new Error('Regional streaming data is missing');
    if (initial.state.lateralControls !== 'screen-relative' || initial.stats.lateralControls !== 'screen-relative') throw new Error('Screen-relative control marker is missing');
    if (!Number.isFinite(initial.state.cameraYaw)) throw new Error('Camera yaw is not exposed');

    const testInput = async (x, y, duration = 650) => page.evaluate(async ({ x, y, duration }) => {
      const before = window.WAFTRegionRuntime.getState();
      window.WAFTRegionRuntime.setInput(x, y);
      await new Promise(resolve => setTimeout(resolve, duration));
      window.WAFTRegionRuntime.setInput(0, 0);
      await new Promise(resolve => setTimeout(resolve, 100));
      const after = window.WAFTRegionRuntime.getState();
      return {
        before,
        after,
        displacement: {
          x: after.position.x - before.position.x,
          z: after.position.z - before.position.z
        }
      };
    }, { x, y, duration });

    let directional = null;
    for (const preset of ['menorca', 'eivissa', 'alcudia', 'llevant', 'palma']) {
      await page.evaluate(id => window.WAFTRegionRuntime.spawn(id), preset);
      await page.waitForTimeout(300);
      const right = await testInput(1, 0);
      const yaw = right.before.cameraYaw;
      const rightResult = dotDirection(right.displacement, { x: -Math.cos(yaw), z: Math.sin(yaw) });
      await page.evaluate(id => window.WAFTRegionRuntime.spawn(id), preset);
      await page.waitForTimeout(250);
      const left = await testInput(-1, 0);
      const leftResult = dotDirection(left.displacement, { x: Math.cos(yaw), z: -Math.sin(yaw) });
      await page.evaluate(id => window.WAFTRegionRuntime.spawn(id), preset);
      await page.waitForTimeout(250);
      const forward = await testInput(0, -1);
      const forwardResult = dotDirection(forward.displacement, { x: Math.sin(yaw), z: Math.cos(yaw) });
      if (rightResult.distance > .35 && leftResult.distance > .35 && forwardResult.distance > .35) {
        directional = { preset, yaw, right, left, forward, rightResult, leftResult, forwardResult };
        break;
      }
    }

    if (!directional) throw new Error('No spawn allowed a complete directional movement test');
    if (directional.rightResult.alignment < .72) throw new Error(`Right input is not screen-right: alignment ${directional.rightResult.alignment}`);
    if (directional.leftResult.alignment < .72) throw new Error(`Left input is not screen-left: alignment ${directional.leftResult.alignment}`);
    if (directional.forwardResult.alignment < .72) throw new Error(`Forward input changed direction: alignment ${directional.forwardResult.alignment}`);

    await page.evaluate(() => window.WAFTRegionRuntime.jump());
    const beforeJump = await page.evaluate(() => window.WAFTRegionRuntime.getState());
    await page.waitForTimeout(220);
    const duringJump = await page.evaluate(() => window.WAFTRegionRuntime.getState());
    const jumpRise = duringJump.position.y - beforeJump.position.y;
    if (jumpRise <= .12) throw new Error(`Jump did not raise the character enough: ${jumpRise}`);
    await page.waitForFunction(() => window.WAFTRegionRuntime.getState().grounded === true, null, { timeout: 5000 });

    await page.evaluate(() => window.WAFTRegionRuntime.respawn());
    await page.waitForTimeout(300);
    const finalState = await page.evaluate(() => window.WAFTRegionRuntime.getState());
    if (!finalState.grounded || finalState.lateralControls !== 'screen-relative') throw new Error('Respawn lost the corrected movement state');

    if (options.screenshot) {
      fs.mkdirSync(path.dirname(options.screenshot), { recursive: true });
      await page.screenshot({ path: options.screenshot, type: 'png' });
    }
    if (pageErrors.length) throw new Error(`Page errors: ${pageErrors.join(' | ')}`);

    const report = {
      formatVersion: 1,
      verifierVersion: VERIFIER_VERSION,
      runtimeVersion: '003',
      valid: true,
      public: options.public,
      url: options.url,
      buildId: initial.stats.buildId,
      viewport: { width: 844, height: 390, touch: true },
      canvas: initial.canvas,
      presets: initial.presets,
      tests: {
        directionalPreset: directional.preset,
        cameraYaw: directional.yaw,
        rightDistance: directional.rightResult.distance,
        rightAlignment: directional.rightResult.alignment,
        leftDistance: directional.leftResult.distance,
        leftAlignment: directional.leftResult.alignment,
        forwardDistance: directional.forwardResult.distance,
        forwardAlignment: directional.forwardResult.alignment,
        jumpRise,
        groundedAfterRespawn: finalState.grounded,
        totalBuildings: initial.stats.totalBuildings,
        activeBuildings: initial.stats.activeBuildings,
        loadedCells: initial.stats.loadedCells,
        characterVisible: finalState.characterVisible,
        cameraMode: finalState.cameraMode,
        lateralControls: finalState.lateralControls
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
