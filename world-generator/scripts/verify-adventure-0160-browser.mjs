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
    const app = window.WAFTAdventure0160;
    if (!app || window.__WAFT_ADVENTURE_0160_READY__ !== true) return false;
    const state = app.getState();
    return state.runtimeReady && state.currentRegionId === expected;
  }, regionId, { timeout });
  return page.evaluate(() => {
    const app = window.WAFTAdventure0160;
    const runtime = app.getRuntime();
    return {
      adventure: app.getState(),
      runtime: runtime.getState(),
      metadata: {
        regionId: runtime.metadata.regionId,
        buildId: runtime.metadata.buildId,
        binarySha256: runtime.metadata.binary.sha256
      },
      zones: runtime.availableZones.map(zone => ({ ...zone, center: { ...zone.center } })),
      version: runtime.version,
      playerMetrics: { ...runtime.playerMetrics }
    };
  });
}

async function verifyWideLocalEntry(page) {
  const zone = await page.evaluate(() => {
    const runtime = window.WAFTAdventure0160.getRuntime();
    return runtime.availableZones[0] ? JSON.parse(JSON.stringify(runtime.availableZones[0])) : null;
  });
  assert(zone, 'Baleares has no local zone for wide-entry verification');
  assert(zone.entryRadius >= 16 && zone.entryRadius <= 32, `Unexpected local entry radius ${zone.entryRadius}`);
  assert(zone.discoveryRadius > zone.entryRadius, 'Discovery radius is not wider than entry radius');

  const probeDistance = Math.min(zone.entryRadius - 1, 14);
  assert(probeDistance > 10, 'Wide-entry probe does not exceed the former 10-unit limit');
  const proximity = await page.evaluate(({ zone, probeDistance }) => {
    const runtime = window.WAFTAdventure0160.getRuntime();
    runtime.setRegionalPosition(zone.center.x + probeDistance, zone.center.z);
    return runtime.detectLocalZone();
  }, { zone, probeDistance });
  assert(proximity.zoneId === zone.id, `Wide-entry detector selected ${proximity.zoneId} instead of ${zone.id}`);
  assert(proximity.status === 'available', `Zone was not enterable at ${probeDistance} units: ${proximity.status}`);
  assert(proximity.entryRadius >= 16, `Runtime entry radius fell back to ${proximity.entryRadius}`);

  await page.evaluate(zoneId => window.WAFTAdventure0160.getRuntime().enterLocal(zoneId), zone.id);
  await page.waitForFunction(() => window.WAFTAdventure0160.getRuntime().getState().worldMode === 'local', null, { timeout: 120000 });
  const localState = await page.evaluate(() => window.WAFTAdventure0160.getRuntime().getState());
  assert(localState.localZoneId === zone.id, `Entered ${localState.localZoneId} instead of ${zone.id}`);
  assert(localState.localPackageLoaded === true, 'Local package was not loaded');
  await page.evaluate(() => window.WAFTAdventure0160.getRuntime().exitLocal());
  await page.waitForFunction(() => window.WAFTAdventure0160.getRuntime().getState().worldMode === 'regional');
  return { zoneId: zone.id, probeDistance, entryRadius: zone.entryRadius, discoveryRadius: zone.discoveryRadius, localBuildId: localState.localPackageBuildId };
}

async function approachExit(page) {
  const probe = await page.evaluate(() => window.WAFTAdventure0160.prepareExitProbe());
  await page.evaluate(() => window.WAFTAdventure0160.getRuntime().setInput(0, -1));
  await page.waitForTimeout(Math.max(900, probe.suggestedMilliseconds));
  await page.evaluate(() => window.WAFTAdventure0160.getRuntime().setInput(0, 0));
  await page.waitForFunction(() => window.WAFTAdventure0160.getState().travelEligible === true, null, { timeout: 15000 });
  return page.evaluate(currentProbe => ({
    probe: currentProbe,
    state: window.WAFTAdventure0160.getState(),
    buttonVisible: document.getElementById('travelButton').classList.contains('visible'),
    buttonRect: (() => {
      const rect = document.getElementById('travelButton').getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    })()
  }), probe);
}

async function performTravel(page, targetRegionId) {
  const before = await approachExit(page);
  assert(before.buttonVisible, 'Regional travel button did not become visible');
  assert(before.state.movementSinceLoad >= 0.35, `Travel armed without enough physical movement: ${before.state.movementSinceLoad}`);
  assert(before.state.exitDistance <= 32, `Travel did not use the enlarged radius: ${before.state.exitDistance}`);
  assert(before.state.travelActivationRadius === 32, `Reported travel radius is ${before.state.travelActivationRadius}`);
  assert(before.buttonRect.width >= 140 && before.buttonRect.height >= 40, `Travel CTA is too small: ${before.buttonRect.width}x${before.buttonRect.height}`);
  await page.evaluate(() => window.WAFTAdventure0160.travel());
  return { before, after: await waitAdventure(page, targetRegionId) };
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
    assert(initial.adventure.buildId === 'waft-adventure-0160-visual-access-v1', `Unexpected build ${initial.adventure.buildId}`);
    assert(initial.adventure.localAccessProfile === 'wide-area-v1', 'Wide-area access profile is missing');
    assert(initial.runtime.worldMode === 'regional', 'Baleares did not start in regional mode');
    assert(initial.runtime.localRegistryLoaded === true && initial.zones.length >= 2, 'Baleares local zones are missing');
    assert(initial.runtime.graphicsProfile === 'enhanced-mobile-v3', `Unexpected graphics profile ${initial.runtime.graphicsProfile}`);
    assert(initial.version === '012', `Unexpected Baleares runtime version ${initial.version}`);
    assert(initial.playerMetrics.graphicsProfile === 'enhanced-mobile-v3', 'Player metrics do not expose the enhanced profile');

    const localEntry = await verifyWideLocalEntry(page);

    const outward = await performTravel(page, 'catalunya-litoral');
    const catalunya = outward.after;
    assert(catalunya.metadata.regionId === 'catalunya-litoral', 'Travel did not load Catalunya litoral');
    assert(catalunya.runtime.worldMode === 'regional', 'Catalunya did not load in regional mode');
    assert(catalunya.runtime.graphicsProfile === 'enhanced-mobile-v3', 'Catalunya did not load enhanced visuals');
    assert(catalunya.version === '002', `Unexpected Catalunya runtime version ${catalunya.version}`);
    assert(catalunya.runtime.localRegistryLoaded === true && catalunya.zones.length === 0, 'Catalunya empty local registry is not safe');
    const catalunyaProbes = await page.evaluate(() => window.WAFTAdventure0160.getRuntime().getLocomotionProbes());
    assert(catalunyaProbes.mountain?.rise > 0, 'Catalunya mountain locomotion probe is invalid');
    assert(catalunyaProbes.water?.start, 'Catalunya water locomotion probe is invalid');

    const afterFirstTravel = await page.evaluate(() => window.WAFTAdventure0160.getState());
    assert(afterFirstTravel.discoveredRegions.length === 2, 'Two regions were not discovered');
    assert(afterFirstTravel.discoveredConnections.length === 1, 'Maritime connection was not discovered');
    assert(afterFirstTravel.transitionCount === 1, 'First transition was not recorded');

    await page.evaluate(() => window.WAFTAdventure0160.save());
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
    const restored = await waitAdventure(page, 'catalunya-litoral');
    assert(restored.adventure.restored === true, 'World state was not restored after reload');

    const homeward = await performTravel(page, 'baleares');
    const returned = homeward.after;
    assert(returned.metadata.regionId === 'baleares', 'Return trip did not load Baleares');
    const finalState = await page.evaluate(() => window.WAFTAdventure0160.getState());
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
      access: {
        profile: finalState.localAccessProfile,
        travelActivationRadius: finalState.travelActivationRadius,
        outwardDistance: outward.before.state.exitDistance,
        homewardDistance: homeward.before.state.exitDistance,
        localEntry
      },
      visuals: {
        graphicsProfile: initial.runtime.graphicsProfile,
        balearesRuntimeVersion: initial.version,
        catalunyaRuntimeVersion: catalunya.version,
        characterVisible: initial.runtime.characterVisible
      },
      transitions: finalState.transitionCount,
      discoveredRegions: finalState.discoveredRegions,
      discoveredConnections: finalState.discoveredConnections,
      restored: restored.adventure.restored,
      regionalBuilds: { baleares: initial.metadata, catalunyaLitoral: catalunya.metadata },
      locomotion: { catalunyaMountainRise: catalunyaProbes.mountain.rise, catalunyaWaterRoute: catalunyaProbes.water.route },
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
