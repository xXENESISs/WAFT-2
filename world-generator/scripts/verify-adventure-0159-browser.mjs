import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

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

function chromePath() {
  for (const candidate of [process.env.CHROME_BIN, '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean)) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error('Chrome executable was not found');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitAdventure(page, regionId, timeout = 120000) {
  await page.waitForFunction(expected => {
    const app = window.WAFTAdventure0159;
    if (!app || window.__WAFT_ADVENTURE_0159_READY__ !== true) return false;
    const state = app.getState();
    return state.runtimeReady && state.currentRegionId === expected;
  }, regionId, { timeout });
  return page.evaluate(() => {
    const app = window.WAFTAdventure0159;
    const runtime = app.getRuntime();
    return {
      adventure: app.getState(),
      runtime: runtime.getState(),
      metadata: {
        regionId: runtime.metadata.regionId,
        buildId: runtime.metadata.buildId,
        binarySha256: runtime.metadata.binary.sha256
      },
      zones: runtime.availableZones.length,
      version: runtime.version
    };
  });
}

async function approachExit(page) {
  const probe = await page.evaluate(() => window.WAFTAdventure0159.prepareExitProbe());
  await page.evaluate(() => window.WAFTAdventure0159.getRuntime().setInput(0, -1));
  await page.waitForTimeout(Math.max(1400, probe.suggestedMilliseconds));
  await page.evaluate(() => window.WAFTAdventure0159.getRuntime().setInput(0, 0));
  await page.waitForFunction(() => window.WAFTAdventure0159.getState().travelEligible === true, null, { timeout: 15000 });
  return page.evaluate(currentProbe => ({
    probe: currentProbe,
    state: window.WAFTAdventure0159.getState(),
    buttonVisible: document.getElementById('travelButton').classList.contains('visible')
  }), probe);
}

async function performTravel(page, targetRegionId) {
  const before = await approachExit(page);
  assert(before.buttonVisible, 'Regional travel button did not become visible after physical movement');
  assert(before.state.movementSinceLoad >= 1.2, `Travel armed without enough physical movement: ${before.state.movementSinceLoad}`);
  await page.evaluate(() => window.WAFTAdventure0159.travel());
  return waitAdventure(page, targetRegionId);
}

async function verify() {
  const options = parseArguments(process.argv.slice(2));
  const pageErrors = [];
  const consoleErrors = [];
  const requestFailures = [];
  const browser = await chromium.launch({
    executablePath: chromePath(),
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--ignore-gpu-blocklist', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--disable-background-networking']
  });

  try {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('console', message => { if (message.type() === 'error' && !message.text().includes('404')) consoleErrors.push(message.text()); });
    page.on('requestfailed', request => requestFailures.push(`${request.url()}: ${request.failure()?.errorText ?? 'failed'}`));

    const response = await page.goto(options.url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    assert(response?.ok(), `Adventure page returned ${response?.status() ?? 'no response'}`);
    await page.evaluate(() => {
      localStorage.removeItem('waft.adventure.0159.world.v1');
      localStorage.removeItem('waft.baleares.travel.v1');
      localStorage.removeItem('waft.catalunya-litoral.travel.v1');
    });
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });

    const initial = await waitAdventure(page, 'baleares');
    assert(initial.metadata.regionId === 'baleares', 'Adventure did not start in Baleares');
    assert(initial.runtime.worldMode === 'regional', 'Baleares did not start in regional mode');
    assert(initial.runtime.localRegistryLoaded === true && initial.zones >= 2, 'Baleares local-zone architecture was not retained');
    assert(initial.runtime.cameraMode === 'third-person' && initial.runtime.characterVisible === true, 'Playable regional character is missing');
    assert(initial.runtime.swimming !== undefined && initial.runtime.runSpeed > 0 && initial.runtime.jumpVelocity > 0, 'Locomotion state is incomplete');

    const catalunya = await performTravel(page, 'catalunya-litoral');
    assert(catalunya.metadata.regionId === 'catalunya-litoral', 'Travel did not load Catalunya litoral');
    assert(catalunya.runtime.worldMode === 'regional', 'Catalunya did not load in regional mode');
    assert(catalunya.runtime.localRegistryLoaded === true && catalunya.zones === 0, 'Catalunya empty local registry was not handled safely');
    const catalunyaProbes = await page.evaluate(() => window.WAFTAdventure0159.getRuntime().getLocomotionProbes());
    assert(catalunyaProbes.mountain?.rise > 0, 'Catalunya mountain locomotion probe is invalid');
    assert(catalunyaProbes.water?.start, 'Catalunya water locomotion probe is invalid');
    const afterFirstTravel = await page.evaluate(() => window.WAFTAdventure0159.getState());
    assert(afterFirstTravel.discoveredRegions.length === 2, `Expected two discovered regions, got ${afterFirstTravel.discoveredRegions.length}`);
    assert(afterFirstTravel.discoveredConnections.length === 1, `Expected one discovered connection, got ${afterFirstTravel.discoveredConnections.length}`);
    assert(afterFirstTravel.transitionCount === 1, `Expected one transition, got ${afterFirstTravel.transitionCount}`);

    await page.evaluate(() => window.WAFTAdventure0159.save());
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
    const restored = await waitAdventure(page, 'catalunya-litoral');
    assert(restored.adventure.restored === true, 'World state was not restored after reload');
    assert(restored.adventure.discoveredRegions.length === 2, 'Discovered regions were not restored');
    assert(restored.adventure.discoveredConnections.length === 1, 'Discovered connection was not restored');

    const returned = await performTravel(page, 'baleares');
    assert(returned.metadata.regionId === 'baleares', 'Return trip did not load Baleares');
    const finalState = await page.evaluate(() => window.WAFTAdventure0159.getState());
    assert(finalState.transitionCount === 2, `Expected two transitions, got ${finalState.transitionCount}`);
    assert(finalState.discoveredRegions.length === 2, 'Final discovered region state is incomplete');
    assert(finalState.pageErrors.length === 0, `Adventure reported errors: ${finalState.pageErrors.join(' | ')}`);

    const canvas = await page.evaluate(() => {
      const runtimeDocument = document.getElementById('runtime').contentDocument;
      const canvas = runtimeDocument?.querySelector('canvas');
      return { width: canvas?.width ?? 0, height: canvas?.height ?? 0, webgl2: Boolean(canvas?.getContext('webgl2')) };
    });
    assert(canvas.width >= 800 && canvas.height >= 350, `Runtime canvas is too small: ${canvas.width}x${canvas.height}`);
    assert(canvas.webgl2, 'WebGL2 is unavailable in embedded runtime');
    assert(pageErrors.length === 0, `Page errors: ${pageErrors.join(' | ')}`);
    assert(consoleErrors.length === 0, `Console errors: ${consoleErrors.join(' | ')}`);
    assert(requestFailures.length === 0, `Request failures: ${requestFailures.join(' | ')}`);

    if (options.screenshot) {
      fs.mkdirSync(path.dirname(options.screenshot), { recursive: true });
      await page.screenshot({ path: options.screenshot, type: 'png' });
    }

    const report = {
      formatVersion: 1,
      valid: true,
      public: options.public,
      url: options.url,
      viewport: { width: 844, height: 390, touch: true },
      canvas,
      buildId: finalState.buildId,
      capabilities: finalState.capabilities,
      transitions: finalState.transitionCount,
      discoveredRegions: finalState.discoveredRegions,
      discoveredConnections: finalState.discoveredConnections,
      regionalBuilds: {
        baleares: initial.metadata,
        catalunyaLitoral: catalunya.metadata
      },
      restored: restored.adventure.restored,
      localZones: { baleares: initial.zones, catalunyaLitoral: catalunya.zones },
      locomotion: {
        catalunyaMountainRise: catalunyaProbes.mountain.rise,
        catalunyaWaterRoute: catalunyaProbes.water.route
      },
      pageErrors,
      consoleErrors,
      requestFailures
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
