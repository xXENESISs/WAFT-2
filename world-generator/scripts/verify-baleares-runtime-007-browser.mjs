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
  return { distance, alignment: (dx * expectedX + dz * expectedZ) / distance / expectedLength };
}

async function move(page, x, y, milliseconds = 500) {
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
      displayDelta: {
        x: after.displayPosition.x - before.displayPosition.x,
        z: after.displayPosition.z - before.displayPosition.z
      }
    };
  }, { x, y, milliseconds });
}

async function enterZone(page, zoneId) {
  await page.evaluate(zone => window.WAFTRegionRuntime.enterLocal(zone), zoneId);
  await page.waitForFunction(zone => {
    const state = window.WAFTRegionRuntime.getState();
    return state.worldMode === 'local' && state.localZoneId === zone && state.localPackageStatus === 'loaded';
  }, zoneId, { timeout: 120000 });
  await page.waitForTimeout(1100);
  return page.evaluate(() => ({
    state: window.WAFTRegionRuntime.getState(),
    metadata: window.WAFTRegionRuntime.localMetadata,
    collisionProbe: window.WAFTRegionRuntime.probeCollision(),
    hud: document.getElementById('hudStats')?.textContent ?? '',
    button: {
      text: document.getElementById('scaleMode')?.textContent ?? '',
      disabled: document.getElementById('scaleMode')?.disabled ?? true
    },
    resources: performance.getEntriesByType('resource').map(entry => entry.name)
  }));
}

async function verify() {
  const options = parseArguments(process.argv.slice(2));
  const pageErrors = [];
  const consoleErrors = [];
  const browser = await chromium.launch({
    executablePath: findChrome(),
    headless: true,
    args: ['--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--disable-background-networking']
  });

  try {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error' && !message.text().includes('404')) consoleErrors.push(message.text());
    });

    const response = await page.goto(options.url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    assert(response?.ok(), `Runtime page returned ${response?.status() ?? 'no response'}`);
    await page.waitForFunction(() => window.__WAFT_RUNTIME_007_READY__ === true, null, { timeout: 120000 });
    await page.waitForTimeout(1800);

    const initial = await page.evaluate(() => ({
      state: window.WAFTRegionRuntime.getState(),
      version: window.WAFTRegionRuntime.version,
      metadata: window.WAFTRegionRuntime.metadata,
      registry: window.WAFTRegionRuntime.localRegistry,
      availableZones: window.WAFTRegionRuntime.availableZones,
      error: window.__WAFT_RUNTIME_007_ERROR__ ?? null,
      stats: window.__WAFT_RUNTIME_007_STATS__,
      webgl2: Boolean(document.querySelector('canvas')?.getContext('webgl2')),
      canvas: { width: document.querySelector('canvas')?.width ?? 0, height: document.querySelector('canvas')?.height ?? 0 },
      resources: performance.getEntriesByType('resource').map(entry => entry.name),
      button: {
        text: document.getElementById('scaleMode')?.textContent ?? '',
        disabled: document.getElementById('scaleMode')?.disabled ?? true
      }
    }));

    assert(!initial.error, initial.error || 'Runtime reported an unknown error');
    assert(initial.version === '007', `Expected runtime 007, got ${initial.version}`);
    assert(initial.webgl2, 'WebGL2 is unavailable');
    assert(initial.canvas.width >= 800 && initial.canvas.height >= 350, `Canvas is too small: ${initial.canvas.width}x${initial.canvas.height}`);
    assert(initial.state.worldMode === 'regional', `Initial mode is ${initial.state.worldMode}`);
    assert(initial.state.renderDataset === 'regional-streamed', `Initial dataset is ${initial.state.renderDataset}`);
    assert(initial.state.localRegistryLoaded, 'Local-zone registry did not load');
    assert(initial.state.localRegistryBuildId === initial.registry.buildId, 'Registry build id mismatch');
    assert(initial.state.localZoneCount === 2 && initial.registry.zoneCount === 2, `Expected two zones, got ${initial.state.localZoneCount}`);
    assert(initial.availableZones.length === 2, `Public API exposes ${initial.availableZones.length} zones`);
    assert(initial.availableZones.some(zone => zone.id === 'palma' && zone.presetId === 'palma'), 'Palma is missing from the public registry');
    assert(initial.availableZones.some(zone => zone.id === 'llevant' && zone.presetId === 'llevant'), 'Llevant is missing from the public registry');
    assert(initial.state.preset === 'palma', `Expected initial Palma preset, got ${initial.state.preset}`);
    assert(initial.button.text === 'ENTRAR EN PALMA' && !initial.button.disabled, `Initial local button is ${initial.button.text}`);
    assert(initial.state.localPackageLoaded === false && initial.state.localPackageStatus === 'unloaded', 'A local package loaded during boot');
    assert(initial.state.localPackageRequestCount === 0, `Local request count at boot is ${initial.state.localPackageRequestCount}`);
    assert(initial.resources.some(url => url.includes('/local/zones-v1.json')), 'Local registry was not requested');
    assert(!initial.resources.some(url => /\/local\/(palma|llevant)\/.+-local-v1\.(json|bin)/.test(url)), 'A zone package was requested during boot');

    const palmaEntry = initial.registry.zones.find(zone => zone.id === 'palma');
    const llevantEntry = initial.registry.zones.find(zone => zone.id === 'llevant');
    assert(palmaEntry && llevantEntry, 'Registry entries are incomplete');

    const palma = await enterZone(page, 'palma');
    assert(palma.state.localZoneId === 'palma' && palma.state.preset === 'palma', 'Palma did not activate from its registry entry');
    assert(palma.state.localLastLoadedZoneId === 'palma', 'Palma last-loaded state is wrong');
    assert(palma.state.localRequestedZoneId === 'palma', 'Palma requested-zone state is wrong');
    assert(palma.state.localPackageLoadCount === 1, `Palma load count is ${palma.state.localPackageLoadCount}`);
    assert(palma.state.localPackageRequestCount === 2, `Palma request count is ${palma.state.localPackageRequestCount}`);
    assert(palma.state.localGpuResources > 0, 'Palma created no GPU resources');
    assert(palma.metadata.buildId === palmaEntry.buildId, 'Palma build id mismatch');
    assert(palma.metadata.counts.buildings === palmaEntry.counts.buildings, 'Palma building count mismatch');
    assert(palma.state.activeBuildings === palmaEntry.counts.buildings, 'Palma renderer count mismatch');
    assert(palma.collisionProbe, 'Palma collision probe failed');
    assert(palma.hud.includes('LOCAL PALMA'), `Palma HUD is wrong: ${palma.hud}`);
    assert(palma.button.text === 'SALIR A REGIONAL' && !palma.button.disabled, 'Palma exit button is wrong');
    const palmaPackageRequests = palma.resources.filter(url => /\/local\/palma\/.+-local-v1\.(json|bin)/.test(url));
    assert(palmaPackageRequests.length === 2, `Palma made ${palmaPackageRequests.length} package requests`);

    const palmaYaw = palma.state.cameraYaw;
    const palmaRight = await move(page, 1, 0, 520);
    const palmaRightVector = alignment(palmaRight.displayDelta.x, palmaRight.displayDelta.z, -Math.cos(palmaYaw), Math.sin(palmaYaw));
    assert(palmaRightVector.distance > .3 && palmaRightVector.alignment > .78, `Palma lateral movement failed: ${JSON.stringify(palmaRightVector)}`);
    await page.evaluate(() => window.WAFTRegionRuntime.respawn());
    await page.waitForTimeout(250);
    const beforeJump = await page.evaluate(() => window.WAFTRegionRuntime.getState());
    await page.evaluate(() => window.WAFTRegionRuntime.jump());
    await page.waitForTimeout(230);
    const duringJump = await page.evaluate(() => window.WAFTRegionRuntime.getState());
    const jumpRise = duringJump.position.y - beforeJump.position.y;
    assert(jumpRise > .15, `Palma jump rise is too small: ${jumpRise}`);
    await page.waitForFunction(() => window.WAFTRegionRuntime.getState().grounded === true, null, { timeout: 5000 });

    const palmaBeforeExit = await page.evaluate(() => window.WAFTRegionRuntime.getState());
    await page.evaluate(() => window.WAFTRegionRuntime.exitLocal());
    await page.waitForTimeout(500);
    const afterPalma = await page.evaluate(() => ({
      state: window.WAFTRegionRuntime.getState(),
      button: { text: document.getElementById('scaleMode')?.textContent ?? '', disabled: document.getElementById('scaleMode')?.disabled ?? true }
    }));
    assert(afterPalma.state.worldMode === 'regional' && afterPalma.state.renderDataset === 'regional-streamed', 'Palma exit did not restore regional mode');
    near(afterPalma.state.position.x, palmaBeforeExit.position.x, 1e-6, 'Palma exit x preservation');
    near(afterPalma.state.position.z, palmaBeforeExit.position.z, 1e-6, 'Palma exit z preservation');
    assert(!afterPalma.state.localPackageLoaded && afterPalma.state.localGpuResources === 0, 'Palma resources were not released');
    assert(afterPalma.state.localPackageReleaseCount === 1, `Palma release count is ${afterPalma.state.localPackageReleaseCount}`);
    assert(afterPalma.button.text === 'ENTRAR EN PALMA', `Palma regional button is ${afterPalma.button.text}`);

    await page.evaluate(() => window.WAFTRegionRuntime.spawn('llevant'));
    await page.waitForTimeout(350);
    const beforeLlevant = await page.evaluate(() => ({
      state: window.WAFTRegionRuntime.getState(),
      button: { text: document.getElementById('scaleMode')?.textContent ?? '', disabled: document.getElementById('scaleMode')?.disabled ?? true }
    }));
    assert(beforeLlevant.state.preset === 'llevant', 'Llevant preset was not selected');
    assert(beforeLlevant.button.text === 'ENTRAR EN LLEVANT' && !beforeLlevant.button.disabled, `Llevant button is ${beforeLlevant.button.text}`);

    const llevant = await enterZone(page, 'llevant');
    assert(llevant.state.localZoneId === 'llevant' && llevant.state.preset === 'llevant', 'Llevant did not activate from its registry entry');
    assert(llevant.state.localLastLoadedZoneId === 'llevant', 'Llevant last-loaded state is wrong');
    assert(llevant.state.localPackageLoadCount === 2, `Combined load count is ${llevant.state.localPackageLoadCount}`);
    assert(llevant.state.localPackageRequestCount === 4, `Combined request count is ${llevant.state.localPackageRequestCount}`);
    assert(llevant.state.localPackageReleaseCount === 1, `Release count before Llevant is ${llevant.state.localPackageReleaseCount}`);
    assert(llevant.state.localGpuResources > 0, 'Llevant created no GPU resources');
    assert(llevant.metadata.buildId === llevantEntry.buildId, 'Llevant build id mismatch');
    assert(llevant.metadata.buildId !== palma.metadata.buildId, 'Palma and Llevant use the same package build');
    assert(llevant.state.activeBuildings === llevantEntry.counts.buildings, 'Llevant renderer count mismatch');
    assert(llevant.collisionProbe, 'Llevant collision probe failed');
    assert(llevant.hud.includes('LOCAL LLEVANT'), `Llevant HUD is wrong: ${llevant.hud}`);
    const allZoneRequests = llevant.resources.filter(url => /\/local\/(palma|llevant)\/.+-local-v1\.(json|bin)/.test(url));
    assert(allZoneRequests.length === 4, `Two zones produced ${allZoneRequests.length} package requests`);

    const llevantYaw = llevant.state.cameraYaw;
    const llevantForward = await move(page, 0, -1, 520);
    const llevantForwardVector = alignment(llevantForward.displayDelta.x, llevantForward.displayDelta.z, Math.sin(llevantYaw), Math.cos(llevantYaw));
    assert(llevantForwardVector.distance > .3 && llevantForwardVector.alignment > .72, `Llevant forward movement failed: ${JSON.stringify(llevantForwardVector)}`);

    await page.evaluate(() => window.WAFTRegionRuntime.exitLocal());
    await page.waitForTimeout(450);
    const finalState = await page.evaluate(() => window.WAFTRegionRuntime.getState());
    assert(finalState.worldMode === 'regional', 'Final state is not regional');
    assert(finalState.localPackageLoaded === false && finalState.localGpuResources === 0, 'Final zone resources were not released');
    assert(finalState.localPackageLoadCount === 2, `Final load count is ${finalState.localPackageLoadCount}`);
    assert(finalState.localPackageReleaseCount === 2, `Final release count is ${finalState.localPackageReleaseCount}`);
    assert(finalState.localPackageRequestCount === 4, `Final request count is ${finalState.localPackageRequestCount}`);
    assert(finalState.localLastLoadedZoneId === 'llevant', 'Final last-loaded zone is wrong');
    assert(pageErrors.length === 0, `Page errors: ${pageErrors.join(' | ')}`);
    assert(consoleErrors.length === 0, `Console errors: ${consoleErrors.join(' | ')}`);

    if (options.screenshot) {
      fs.mkdirSync(path.dirname(options.screenshot), { recursive: true });
      await page.screenshot({ path: options.screenshot, type: 'png' });
    }

    const report = {
      formatVersion: 1,
      verifierVersion: VERIFIER_VERSION,
      runtimeVersion: '007',
      valid: true,
      public: options.public,
      url: options.url,
      regionalBuildId: initial.metadata.buildId,
      registryBuildId: initial.registry.buildId,
      viewport: { width: 844, height: 390, touch: true },
      canvas: initial.canvas,
      zones: {
        palma: {
          buildId: palma.metadata.buildId,
          binaryBytes: palma.metadata.binary.bytes,
          counts: palma.metadata.counts,
          lateralDistance: palmaRightVector.distance,
          lateralAlignment: palmaRightVector.alignment,
          jumpRise
        },
        llevant: {
          buildId: llevant.metadata.buildId,
          binaryBytes: llevant.metadata.binary.bytes,
          counts: llevant.metadata.counts,
          forwardDistance: llevantForwardVector.distance,
          forwardAlignment: llevantForwardVector.alignment
        }
      },
      tests: {
        registryRequestedAtBoot: true,
        noZonePackagesRequestedAtBoot: true,
        palmaLoadedFromRegistry: true,
        palmaReleasedCompletely: true,
        llevantLoadedFromRegistry: true,
        zonesUseDifferentPackages: true,
        finalLoads: finalState.localPackageLoadCount,
        finalReleases: finalState.localPackageReleaseCount,
        finalPackageRequests: finalState.localPackageRequestCount,
        finalGpuResources: finalState.localGpuResources
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
