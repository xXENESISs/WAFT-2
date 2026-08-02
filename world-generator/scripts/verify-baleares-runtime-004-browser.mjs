import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const VERIFIER_VERSION = 1;

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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function near(actual, expected, tolerance, label) {
  assert(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, got ${actual}`);
}

function alignment(dx, dz, expectedX, expectedZ) {
  const distance = Math.hypot(dx, dz);
  const expectedLength = Math.hypot(expectedX, expectedZ) || 1;
  if (distance < 1e-8) return { distance, alignment: -1 };
  return {
    distance,
    alignment: (dx * expectedX + dz * expectedZ) / distance / expectedLength
  };
}

async function move(page, x, y, milliseconds = 450) {
  return page.evaluate(async ({ x, y, milliseconds }) => {
    const before = window.WAFTRegionRuntime.getState();
    window.WAFTRegionRuntime.setInput(x, y);
    await new Promise(resolve => setTimeout(resolve, milliseconds));
    window.WAFTRegionRuntime.setInput(0, 0);
    await new Promise(resolve => setTimeout(resolve, 120));
    const after = window.WAFTRegionRuntime.getState();
    return {
      before,
      after,
      regionalDelta: {
        x: after.position.x - before.position.x,
        z: after.position.z - before.position.z
      },
      displayDelta: {
        x: after.displayPosition.x - before.displayPosition.x,
        z: after.displayPosition.z - before.displayPosition.z
      }
    };
  }, { x, y, milliseconds });
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
    const context = await browser.newContext({
      viewport: { width: 844, height: 390 },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true
    });
    const page = await context.newPage();
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error' && !message.text().includes('404')) consoleErrors.push(message.text());
    });

    const response = await page.goto(options.url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    assert(response?.ok(), `Runtime page returned ${response?.status() ?? 'no response'}`);
    await page.waitForFunction(() => window.__WAFT_RUNTIME_004_READY__ === true, null, { timeout: 120000 });
    await page.waitForTimeout(1800);

    const initial = await page.evaluate(() => ({
      state: window.WAFTRegionRuntime.getState(),
      version: window.WAFTRegionRuntime.version,
      error: window.__WAFT_RUNTIME_004_ERROR__ ?? null,
      stats: window.__WAFT_RUNTIME_004_STATS__,
      webgl2: Boolean(document.querySelector('canvas')?.getContext('webgl2')),
      canvas: {
        width: document.querySelector('canvas')?.width ?? 0,
        height: document.querySelector('canvas')?.height ?? 0
      },
      buttons: [...document.querySelectorAll('button')].map(button => ({ id: button.id, text: button.textContent }))
    }));
    assert(!initial.error, initial.error || 'Runtime reported an unknown error');
    assert(initial.version === '004', `Expected runtime 004, got ${initial.version}`);
    assert(initial.webgl2, 'WebGL2 is unavailable');
    assert(initial.canvas.width >= 800 && initial.canvas.height >= 350, `Canvas is too small: ${initial.canvas.width}x${initial.canvas.height}`);
    assert(initial.state.worldMode === 'regional', `Initial mode is ${initial.state.worldMode}`);
    near(initial.state.worldScale, 1, 1e-9, 'Initial world scale');
    near(initial.state.footprintScale, 1, 1e-9, 'Initial footprint scale');
    assert(initial.state.characterVisible, 'Character is not visible');
    assert(initial.state.lateralControls === 'screen-relative', 'Lateral controls regressed');
    assert(initial.stats.totalBuildings >= 5000, `Too few buildings: ${initial.stats.totalBuildings}`);
    assert(initial.stats.activeBuildings > 0 && initial.stats.activeBuildings < initial.stats.totalBuildings, 'Building streaming is invalid');
    assert(initial.buttons.some(button => button.id === 'scaleMode' && button.text.includes('ENTRAR')), 'Local-zone button is missing');

    await page.evaluate(() => window.WAFTRegionRuntime.enterLocal());
    await page.waitForTimeout(700);
    const local = await page.evaluate(() => {
      const state = window.WAFTRegionRuntime.getState();
      const center = state.localCenter;
      return {
        state,
        oneEast: window.WAFTRegionRuntime.regionalToDisplay(center.x + 1, center.z),
        oneSouth: window.WAFTRegionRuntime.regionalToDisplay(center.x, center.z + 1),
        roundTrip: null,
        button: document.getElementById('scaleMode')?.textContent ?? ''
      };
    });
    local.roundTrip = await page.evaluate(({ oneEast }) => window.WAFTRegionRuntime.displayToRegional(oneEast.x, oneEast.z), { oneEast: local.oneEast });
    assert(local.state.worldMode === 'local', `Local transition produced ${local.state.worldMode}`);
    assert(local.state.localZoneId === 'llevant', `Expected Llevant, got ${local.state.localZoneId}`);
    assert(local.state.preset === 'llevant', `Expected Llevant preset, got ${local.state.preset}`);
    near(local.state.worldScale, 12, 1e-9, 'Local world scale');
    near(local.state.footprintScale, 4, 1e-9, 'Local footprint scale');
    near(local.oneEast.x - local.state.localCenter.x, 12, 1e-6, 'East local expansion');
    near(local.oneEast.z - local.state.localCenter.z, 0, 1e-6, 'East local z drift');
    near(local.oneSouth.z - local.state.localCenter.z, 12, 1e-6, 'South local expansion');
    near(local.roundTrip.x, local.state.localCenter.x + 1, 1e-6, 'Coordinate round trip x');
    near(local.roundTrip.z, local.state.localCenter.z, 1e-6, 'Coordinate round trip z');
    assert(local.button.includes('SALIR'), `Local button did not switch: ${local.button}`);

    await page.evaluate(() => window.WAFTRegionRuntime.respawn());
    await page.waitForTimeout(300);
    const yaw = (await page.evaluate(() => window.WAFTRegionRuntime.getState())).cameraYaw;
    const right = await move(page, 1, 0, 520);
    const rightVector = alignment(right.displayDelta.x, right.displayDelta.z, -Math.cos(yaw), Math.sin(yaw));
    assert(rightVector.distance > .3, `Local right movement is too small: ${rightVector.distance}`);
    assert(rightVector.alignment > .78, `Local right movement is misaligned: ${rightVector.alignment}`);

    await page.evaluate(() => window.WAFTRegionRuntime.respawn());
    await page.waitForTimeout(300);
    const forward = await move(page, 0, -1, 520);
    const forwardVector = alignment(forward.displayDelta.x, forward.displayDelta.z, Math.sin(yaw), Math.cos(yaw));
    assert(forwardVector.distance > .3, `Local forward movement is too small: ${forwardVector.distance}`);
    assert(forwardVector.alignment > .72, `Local forward movement is misaligned: ${forwardVector.alignment}`);

    await page.evaluate(() => window.WAFTRegionRuntime.respawn());
    await page.waitForTimeout(250);
    const beforeJump = await page.evaluate(() => window.WAFTRegionRuntime.getState());
    await page.evaluate(() => window.WAFTRegionRuntime.jump());
    await page.waitForTimeout(230);
    const duringJump = await page.evaluate(() => window.WAFTRegionRuntime.getState());
    const jumpRise = duringJump.position.y - beforeJump.position.y;
    assert(jumpRise > .15, `Jump rise is too small: ${jumpRise}`);
    await page.waitForFunction(() => window.WAFTRegionRuntime.getState().grounded === true, null, { timeout: 5000 });

    const beforeExit = await page.evaluate(() => window.WAFTRegionRuntime.getState());
    await page.evaluate(() => window.WAFTRegionRuntime.exitLocal());
    await page.waitForTimeout(400);
    const regionalAgain = await page.evaluate(() => window.WAFTRegionRuntime.getState());
    assert(regionalAgain.worldMode === 'regional', `Exit produced ${regionalAgain.worldMode}`);
    near(regionalAgain.worldScale, 1, 1e-9, 'World scale after exit');
    near(regionalAgain.footprintScale, 1, 1e-9, 'Footprint scale after exit');
    near(regionalAgain.position.x, beforeExit.position.x, 1e-6, 'Regional x preservation');
    near(regionalAgain.position.z, beforeExit.position.z, 1e-6, 'Regional z preservation');
    near(regionalAgain.displayPosition.x, regionalAgain.position.x, 1e-6, 'Regional display x');
    near(regionalAgain.displayPosition.z, regionalAgain.position.z, 1e-6, 'Regional display z');

    await page.evaluate(() => window.WAFTRegionRuntime.enterLocal());
    await page.waitForTimeout(350);
    const finalState = await page.evaluate(() => window.WAFTRegionRuntime.getState());
    assert(finalState.worldMode === 'local' && finalState.worldScale === 12, 'Local mode could not be re-entered');
    assert(finalState.grounded, 'Final local state is not grounded');
    assert(finalState.activeBuildings > 0 && finalState.loadedCells > 0, 'Local mode lost streamed buildings');
    assert(pageErrors.length === 0, `Page errors: ${pageErrors.join(' | ')}`);
    assert(consoleErrors.length === 0, `Console errors: ${consoleErrors.join(' | ')}`);

    if (options.screenshot) {
      fs.mkdirSync(path.dirname(options.screenshot), { recursive: true });
      await page.screenshot({ path: options.screenshot, type: 'png' });
    }

    const report = {
      formatVersion: 1,
      verifierVersion: VERIFIER_VERSION,
      runtimeVersion: '004',
      valid: true,
      public: options.public,
      url: options.url,
      buildId: initial.stats.buildId,
      viewport: { width: 844, height: 390, touch: true },
      canvas: initial.canvas,
      tests: {
        initialMode: initial.state.worldMode,
        localZoneId: local.state.localZoneId,
        worldScale: local.state.worldScale,
        footprintScale: local.state.footprintScale,
        localRadius: local.state.localRadius,
        eastExpansion: local.oneEast.x - local.state.localCenter.x,
        southExpansion: local.oneSouth.z - local.state.localCenter.z,
        coordinateRoundTrip: local.roundTrip,
        rightDisplayDistance: rightVector.distance,
        rightAlignment: rightVector.alignment,
        forwardDisplayDistance: forwardVector.distance,
        forwardAlignment: forwardVector.alignment,
        jumpRise,
        exitPreservedRegionalPosition: true,
        reenteredLocal: true,
        activeBuildings: finalState.activeBuildings,
        loadedCells: finalState.loadedCells,
        characterVisible: finalState.characterVisible,
        cameraMode: finalState.cameraMode
      },
      finalState,
      pageErrors,
      consoleErrors
    };
    const outputPath = path.resolve(ROOT, options.output);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await browser.close();
  }
}

verify().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
