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

async function snapshot(page) {
  return page.evaluate(() => ({
    state: window.WAFTRegionRuntime.getState(),
    button: {
      text: document.getElementById('scaleMode')?.textContent ?? '',
      disabled: document.getElementById('scaleMode')?.disabled ?? true
    },
    hud: document.getElementById('hudStats')?.textContent ?? '',
    resources: performance.getEntriesByType('resource').map(entry => entry.name)
  }));
}

async function setRegionalPosition(page, x, z) {
  await page.evaluate(({ x, z }) => window.WAFTRegionRuntime.setRegionalPosition(x, z), { x, z });
  await page.waitForTimeout(350);
  return snapshot(page);
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

async function enterDetectedZone(page, expectedZone) {
  await page.evaluate(() => window.WAFTRegionRuntime.enterLocal());
  await page.waitForFunction(zone => {
    const state = window.WAFTRegionRuntime.getState();
    return state.worldMode === 'local' && state.localZoneId === zone && state.localPackageStatus === 'loaded';
  }, expectedZone, { timeout: 120000 });
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
    await page.waitForFunction(() => window.__WAFT_RUNTIME_008_READY__ === true, null, { timeout: 120000 });
    await page.waitForTimeout(1800);

    const initial = await page.evaluate(() => ({
      state: window.WAFTRegionRuntime.getState(),
      version: window.WAFTRegionRuntime.version,
      metadata: window.WAFTRegionRuntime.metadata,
      registry: window.WAFTRegionRuntime.localRegistry,
      availableZones: window.WAFTRegionRuntime.availableZones,
      error: window.__WAFT_RUNTIME_008_ERROR__ ?? null,
      stats: window.__WAFT_RUNTIME_008_STATS__,
      webgl2: Boolean(document.querySelector('canvas')?.getContext('webgl2')),
      canvas: { width: document.querySelector('canvas')?.width ?? 0, height: document.querySelector('canvas')?.height ?? 0 },
      resources: performance.getEntriesByType('resource').map(entry => entry.name),
      button: {
        text: document.getElementById('scaleMode')?.textContent ?? '',
        disabled: document.getElementById('scaleMode')?.disabled ?? true
      }
    }));

    assert(!initial.error, initial.error || 'Runtime reported an unknown error');
    assert(initial.version === '008', `Expected runtime 008, got ${initial.version}`);
    assert(initial.webgl2, 'WebGL2 is unavailable');
    assert(initial.canvas.width >= 800 && initial.canvas.height >= 350, `Canvas is too small: ${initial.canvas.width}x${initial.canvas.height}`);
    assert(initial.state.worldMode === 'regional', `Initial mode is ${initial.state.worldMode}`);
    assert(initial.state.localRegistryLoaded && initial.state.localZoneCount === 2, 'The local-zone registry did not load');
    assert(initial.availableZones.length === 2, `Expected two zones, got ${initial.availableZones.length}`);
    assert(initial.availableZones.every(zone => zone.entryRadius >= 6 && zone.entryRadius <= 10), 'Entry radii are outside their contract');
    assert(initial.availableZones.every(zone => zone.discoveryRadius > zone.entryRadius), 'Discovery radii do not exceed entry radii');
    assert(initial.state.preset === 'palma', `Expected initial Palma preset, got ${initial.state.preset}`);
    assert(initial.state.localProximityZoneId === 'palma' && initial.state.localProximityStatus === 'available', 'Initial position did not discover Palma');
    assert(initial.button.text === 'ENTRAR EN PALMA' && !initial.button.disabled, `Initial button is ${initial.button.text}`);
    assert(initial.state.localPackageLoaded === false && initial.state.localPackageRequestCount === 0, 'A local package loaded during boot');
    assert(initial.resources.some(url => url.includes('/local/zones-v1.json')), 'Local registry was not requested');
    assert(!initial.resources.some(url => /\/local\/(palma|llevant)\/.+-local-v1\.(json|bin)/.test(url)), 'A zone package was requested during boot');

    const palma = initial.availableZones.find(zone => zone.id === 'palma');
    const llevant = initial.availableZones.find(zone => zone.id === 'llevant');
    const palmaEntry = initial.registry.zones.find(zone => zone.id === 'palma');
    const llevantEntry = initial.registry.zones.find(zone => zone.id === 'llevant');
    assert(palma && llevant && palmaEntry && llevantEntry, 'Zone contracts are incomplete');

    await page.evaluate(() => window.WAFTRegionRuntime.spawn('alcúdia'));
    await page.waitForTimeout(450);
    const outside = await snapshot(page);
    assert(outside.state.preset === 'alcúdia', `Expected Alcúdia preset, got ${outside.state.preset}`);
    assert(outside.state.localProximityStatus === 'outside' && outside.state.localProximityZoneId === null, 'A remote position still exposes a local zone');
    assert(outside.button.text === 'SIN ZONA CERCANA' && outside.button.disabled, `Outside button is ${outside.button.text}`);

    const palmaNearbyDistance = (palma.entryRadius + palma.discoveryRadius) / 2;
    const nearbyPalma = await setRegionalPosition(page, palma.center.x + palmaNearbyDistance, palma.center.z);
    assert(nearbyPalma.state.preset === 'alcúdia', 'Geographic detection changed the selected preset');
    assert(nearbyPalma.state.localProximityZoneId === 'palma' && nearbyPalma.state.localProximityStatus === 'nearby', 'Palma discovery radius was not detected');
    near(nearbyPalma.state.localProximityDistance, palmaNearbyDistance, .05, 'Palma discovery distance');
    assert(nearbyPalma.button.disabled && nearbyPalma.button.text.startsWith('ACÉRCATE A PALMA'), `Nearby Palma button is ${nearbyPalma.button.text}`);

    const palmaEntryDistance = palma.entryRadius * .5;
    const availablePalma = await setRegionalPosition(page, palma.center.x + palmaEntryDistance, palma.center.z);
    assert(availablePalma.state.preset === 'alcúdia', 'Entering Palma range changed the preset before transition');
    assert(availablePalma.state.localProximityZoneId === 'palma' && availablePalma.state.localProximityStatus === 'available', 'Palma entry radius did not activate');
    assert(availablePalma.button.text === 'ENTRAR EN PALMA' && !availablePalma.button.disabled, `Available Palma button is ${availablePalma.button.text}`);

    const remoteAttempt = await page.evaluate(async () => {
      try {
        await window.WAFTRegionRuntime.enterLocal('llevant');
        return null;
      } catch (error) {
        return String(error?.message || error);
      }
    });
    assert(remoteAttempt?.includes('acercarte físicamente'), `Remote-zone entry was not rejected: ${remoteAttempt}`);

    const palmaLocal = await enterDetectedZone(page, 'palma');
    assert(palmaLocal.state.preset === 'palma', 'Detected Palma entry did not select the matching regional preset');
    assert(palmaLocal.metadata.buildId === palmaEntry.buildId, 'Palma package build mismatch');
    assert(palmaLocal.state.localPackageLoadCount === 1 && palmaLocal.state.localPackageRequestCount === 2, 'Palma package lifecycle is wrong');
    assert(palmaLocal.state.activeBuildings === palmaEntry.counts.buildings, 'Palma renderer count mismatch');
    assert(palmaLocal.collisionProbe, 'Palma collision probe failed');
    assert(palmaLocal.hud.includes('LOCAL PALMA'), `Palma HUD is wrong: ${palmaLocal.hud}`);

    const palmaYaw = palmaLocal.state.cameraYaw;
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
    const afterPalma = await snapshot(page);
    assert(afterPalma.state.worldMode === 'regional' && !afterPalma.state.localPackageLoaded, 'Palma exit did not restore regional mode');
    near(afterPalma.state.position.x, palmaBeforeExit.position.x, 1e-6, 'Palma exit x preservation');
    near(afterPalma.state.position.z, palmaBeforeExit.position.z, 1e-6, 'Palma exit z preservation');
    assert(afterPalma.state.localGpuResources === 0 && afterPalma.state.localPackageReleaseCount === 1, 'Palma resources were not released');
    assert(afterPalma.state.localProximityZoneId === 'palma' && afterPalma.state.localProximityStatus === 'available', 'Palma was not rediscovered after exit');

    const llevantNearbyDistance = (llevant.entryRadius + llevant.discoveryRadius) / 2;
    const nearbyLlevant = await setRegionalPosition(page, llevant.center.x + llevantNearbyDistance, llevant.center.z);
    assert(nearbyLlevant.state.localProximityZoneId === 'llevant' && nearbyLlevant.state.localProximityStatus === 'nearby', 'Llevant discovery radius was not detected');
    assert(nearbyLlevant.button.disabled && nearbyLlevant.button.text.startsWith('ACÉRCATE A LLEVANT'), `Nearby Llevant button is ${nearbyLlevant.button.text}`);

    const availableLlevant = await setRegionalPosition(page, llevant.center.x + llevant.entryRadius * .5, llevant.center.z);
    assert(availableLlevant.state.localProximityZoneId === 'llevant' && availableLlevant.state.localProximityStatus === 'available', 'Llevant entry radius did not activate');
    assert(availableLlevant.button.text === 'ENTRAR EN LLEVANT' && !availableLlevant.button.disabled, `Available Llevant button is ${availableLlevant.button.text}`);

    const llevantLocal = await enterDetectedZone(page, 'llevant');
    assert(llevantLocal.state.preset === 'llevant', 'Detected Llevant entry did not select its preset');
    assert(llevantLocal.metadata.buildId === llevantEntry.buildId, 'Llevant package build mismatch');
    assert(llevantLocal.metadata.buildId !== palmaLocal.metadata.buildId, 'Palma and Llevant use the same package');
    assert(llevantLocal.state.localPackageLoadCount === 2 && llevantLocal.state.localPackageRequestCount === 4, 'Combined package lifecycle is wrong');
    assert(llevantLocal.state.localPackageReleaseCount === 1, 'Palma release count was lost');
    assert(llevantLocal.state.activeBuildings === llevantEntry.counts.buildings, 'Llevant renderer count mismatch');
    assert(llevantLocal.collisionProbe, 'Llevant collision probe failed');

    const llevantYaw = llevantLocal.state.cameraYaw;
    const llevantForward = await move(page, 0, -1, 520);
    const llevantForwardVector = alignment(llevantForward.displayDelta.x, llevantForward.displayDelta.z, Math.sin(llevantYaw), Math.cos(llevantYaw));
    assert(llevantForwardVector.distance > .3 && llevantForwardVector.alignment > .72, `Llevant forward movement failed: ${JSON.stringify(llevantForwardVector)}`);

    await page.evaluate(() => window.WAFTRegionRuntime.exitLocal());
    await page.waitForTimeout(450);
    const finalState = await page.evaluate(() => window.WAFTRegionRuntime.getState());
    assert(finalState.worldMode === 'regional', 'Final state is not regional');
    assert(finalState.localPackageLoaded === false && finalState.localGpuResources === 0, 'Final zone resources were not released');
    assert(finalState.localPackageLoadCount === 2 && finalState.localPackageReleaseCount === 2, 'Final load/release counts are wrong');
    assert(finalState.localPackageRequestCount === 4, `Final request count is ${finalState.localPackageRequestCount}`);
    assert(finalState.localProximityZoneId === 'llevant' && finalState.localProximityStatus === 'available', 'Llevant was not rediscovered after exit');
    assert(finalState.localProximityUpdates >= 5, `Too few proximity updates: ${finalState.localProximityUpdates}`);
    assert(pageErrors.length === 0, `Page errors: ${pageErrors.join(' | ')}`);
    assert(consoleErrors.length === 0, `Console errors: ${consoleErrors.join(' | ')}`);

    if (options.screenshot) {
      fs.mkdirSync(path.dirname(options.screenshot), { recursive: true });
      await page.screenshot({ path: options.screenshot, type: 'png' });
    }

    const report = {
      formatVersion: 1,
      verifierVersion: VERIFIER_VERSION,
      runtimeVersion: '008',
      valid: true,
      public: options.public,
      url: options.url,
      regionalBuildId: initial.metadata.buildId,
      registryBuildId: initial.registry.buildId,
      viewport: { width: 844, height: 390, touch: true },
      canvas: initial.canvas,
      proximity: {
        palma: {
          entryRadius: palma.entryRadius,
          discoveryRadius: palma.discoveryRadius,
          nearbyDistance: nearbyPalma.state.localProximityDistance,
          entryDistance: availablePalma.state.localProximityDistance
        },
        llevant: {
          entryRadius: llevant.entryRadius,
          discoveryRadius: llevant.discoveryRadius,
          nearbyDistance: nearbyLlevant.state.localProximityDistance,
          entryDistance: availableLlevant.state.localProximityDistance
        }
      },
      zones: {
        palma: {
          buildId: palmaLocal.metadata.buildId,
          binaryBytes: palmaLocal.metadata.binary.bytes,
          counts: palmaLocal.metadata.counts,
          lateralDistance: palmaRightVector.distance,
          lateralAlignment: palmaRightVector.alignment,
          jumpRise
        },
        llevant: {
          buildId: llevantLocal.metadata.buildId,
          binaryBytes: llevantLocal.metadata.binary.bytes,
          counts: llevantLocal.metadata.counts,
          forwardDistance: llevantForwardVector.distance,
          forwardAlignment: llevantForwardVector.alignment
        }
      },
      tests: {
        registryRequestedAtBoot: true,
        noZonePackagesRequestedAtBoot: true,
        remotePositionDisablesEntry: true,
        discoveryRadiusShowsDistance: true,
        entryRadiusEnablesEntry: true,
        detectionIgnoresStalePreset: true,
        remoteZoneRequestRejected: true,
        palmaLoadedFromDetectedPosition: true,
        llevantLoadedFromDetectedPosition: true,
        finalLoads: finalState.localPackageLoadCount,
        finalReleases: finalState.localPackageReleaseCount,
        finalPackageRequests: finalState.localPackageRequestCount,
        finalGpuResources: finalState.localGpuResources,
        proximityUpdates: finalState.localProximityUpdates
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
