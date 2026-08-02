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
      regionalDelta: { x: after.position.x - before.position.x, z: after.position.z - before.position.z },
      displayDelta: { x: after.displayPosition.x - before.displayPosition.x, z: after.displayPosition.z - before.displayPosition.z }
    };
  }, { x, y, milliseconds });
}

async function verify() {
  const options = parseArguments(process.argv.slice(2));
  const pageErrors = [];
  const consoleErrors = [];
  const localRequests = [];
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
    page.on('request', request => {
      if (request.url().includes('/regions/baleares/local/llevant/')) localRequests.push(request.url());
    });
    await page.route('**/regions/baleares/local/llevant/**', async route => {
      await new Promise(resolve => setTimeout(resolve, 180));
      await route.continue();
    });

    const response = await page.goto(options.url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    assert(response?.ok(), `Runtime page returned ${response?.status() ?? 'no response'}`);
    await page.waitForFunction(() => window.__WAFT_RUNTIME_006_READY__ === true, null, { timeout: 120000 });
    await page.waitForTimeout(1800);

    const initial = await page.evaluate(() => ({
      state: window.WAFTRegionRuntime.getState(),
      version: window.WAFTRegionRuntime.version,
      metadata: window.WAFTRegionRuntime.metadata,
      localMetadata: window.WAFTRegionRuntime.localMetadata,
      error: window.__WAFT_RUNTIME_006_ERROR__ ?? null,
      stats: window.__WAFT_RUNTIME_006_STATS__,
      webgl2: Boolean(document.querySelector('canvas')?.getContext('webgl2')),
      canvas: { width: document.querySelector('canvas')?.width ?? 0, height: document.querySelector('canvas')?.height ?? 0 },
      button: { text: document.getElementById('scaleMode')?.textContent ?? '', disabled: Boolean(document.getElementById('scaleMode')?.disabled) },
      resources: performance.getEntriesByType('resource').map(entry => entry.name)
    }));

    assert(!initial.error, initial.error || 'Runtime reported an unknown error');
    assert(initial.version === '006', `Expected runtime 006, got ${initial.version}`);
    assert(initial.webgl2, 'WebGL2 is unavailable');
    assert(initial.canvas.width >= 800 && initial.canvas.height >= 350, `Canvas is too small: ${initial.canvas.width}x${initial.canvas.height}`);
    assert(initial.state.worldMode === 'regional', `Initial mode is ${initial.state.worldMode}`);
    assert(initial.state.renderDataset === 'regional-streamed', `Initial dataset is ${initial.state.renderDataset}`);
    assert(initial.state.localPackageLoaded === false, 'Local package was preloaded');
    assert(initial.state.localPackageStatus === 'unloaded', `Initial local status is ${initial.state.localPackageStatus}`);
    assert(initial.state.localPackageLoadCount === 0, 'Initial local load count is not zero');
    assert(initial.state.localPackageReleaseCount === 0, 'Initial local release count is not zero');
    assert(initial.state.localPackageRequestCount === 0, 'Initial local request count is not zero');
    assert(initial.state.localGpuResources === 0, 'Initial local GPU resources are not zero');
    assert(initial.state.localPackageBytes === 0, 'Initial local package bytes are not zero');
    assert(initial.localMetadata === null, 'Initial local metadata should be absent');
    assert(initial.button.text.includes('ENTRAR'), `Initial local button is wrong: ${initial.button.text}`);
    assert(!initial.button.disabled, 'Initial local button is disabled');
    assert(localRequests.length === 0, `Local package requested during boot: ${localRequests.join(' | ')}`);
    assert(!initial.resources.some(url => url.includes('/local/llevant/')), 'Local resources appeared in performance entries during boot');

    const firstEnterPromise = page.evaluate(() => window.WAFTRegionRuntime.enterLocal());
    await page.waitForFunction(() => window.WAFTRegionRuntime.getState().localPackageStatus === 'loading', null, { timeout: 5000 });
    const loading = await page.evaluate(() => ({
      state: window.WAFTRegionRuntime.getState(),
      button: { text: document.getElementById('scaleMode')?.textContent ?? '', disabled: Boolean(document.getElementById('scaleMode')?.disabled) }
    }));
    assert(loading.state.worldMode === 'regional', 'World switched before local data finished loading');
    assert(loading.state.localPackageLoaded === false, 'Local package reports loaded during download');
    assert(loading.button.disabled, 'Local button is not disabled during loading');
    assert(loading.button.text.includes('CARGANDO'), `Loading label is missing: ${loading.button.text}`);
    await firstEnterPromise;
    await page.waitForTimeout(700);

    const firstLocal = await page.evaluate(() => {
      const state = window.WAFTRegionRuntime.getState();
      const metadata = window.WAFTRegionRuntime.localMetadata;
      const center = state.localCenter;
      const oneEast = window.WAFTRegionRuntime.regionalToDisplay(center.x + 1, center.z);
      return {
        state,
        metadata,
        oneEast,
        roundTrip: window.WAFTRegionRuntime.displayToRegional(oneEast.x, oneEast.z),
        collisionProbe: window.WAFTRegionRuntime.probeCollision(),
        hud: document.getElementById('hudStats')?.textContent ?? ''
      };
    });
    assert(firstLocal.state.worldMode === 'local', `Local transition produced ${firstLocal.state.worldMode}`);
    assert(firstLocal.state.renderDataset === 'local-package', `Local dataset is ${firstLocal.state.renderDataset}`);
    assert(firstLocal.state.localPackageLoaded, 'Local package did not finish loading');
    assert(firstLocal.state.localPackageStatus === 'loaded', `Local status is ${firstLocal.state.localPackageStatus}`);
    assert(firstLocal.state.localPackageLoadCount === 1, `First load count is ${firstLocal.state.localPackageLoadCount}`);
    assert(firstLocal.state.localPackageRequestCount === 2, `First request count is ${firstLocal.state.localPackageRequestCount}`);
    assert(firstLocal.state.localPackageReleaseCount === 0, 'Package released before first exit');
    assert(firstLocal.state.localGpuResources > 0, 'Local GPU resources were not created');
    assert(firstLocal.metadata?.zoneId === 'llevant', 'Dynamic local metadata is unavailable');
    assert(firstLocal.state.localPackageBuildId === firstLocal.metadata.buildId, 'Local package build id mismatch');
    assert(firstLocal.state.localPackageBytes === firstLocal.metadata.binary.bytes, 'Local package byte size mismatch');
    assert(firstLocal.state.localTerrain.columns === firstLocal.metadata.terrain.columns, 'Local terrain columns mismatch');
    assert(firstLocal.state.localTerrain.rows === firstLocal.metadata.terrain.rows, 'Local terrain rows mismatch');
    assert(firstLocal.state.localCounts.buildings === firstLocal.metadata.counts.buildings, 'Local building count mismatch');
    assert(firstLocal.state.localCounts.roadVertices === firstLocal.metadata.counts.roadVertices, 'Local road count mismatch');
    assert(firstLocal.state.localCounts.buildings >= 100 && firstLocal.state.localCounts.buildings < initial.metadata.counts.buildings, 'Local building reduction is invalid');
    assert(firstLocal.state.localZoneId === 'llevant', `Expected Llevant, got ${firstLocal.state.localZoneId}`);
    near(firstLocal.state.worldScale, firstLocal.metadata.worldScale, 1e-9, 'Local world scale');
    near(firstLocal.state.footprintScale, firstLocal.metadata.footprintScale, 1e-9, 'Local footprint scale');
    near(firstLocal.state.localRadius, firstLocal.metadata.regionalRadius, 1e-9, 'Local radius');
    near(firstLocal.oneEast.x - firstLocal.state.localCenter.x, firstLocal.metadata.worldScale, 1e-6, 'Local expansion');
    near(firstLocal.roundTrip.x, firstLocal.state.localCenter.x + 1, 1e-6, 'Coordinate round trip x');
    near(firstLocal.roundTrip.z, firstLocal.state.localCenter.z, 1e-6, 'Coordinate round trip z');
    assert(firstLocal.state.activeBuildings === firstLocal.metadata.counts.buildings, 'Local renderer did not activate package buildings');
    assert(firstLocal.state.loadedCells === 1, `Local package should be one loaded lot, got ${firstLocal.state.loadedCells}`);
    assert(firstLocal.collisionProbe, 'Local package collision probe failed');
    assert(firstLocal.hud.includes('PAQUETE'), `HUD does not identify local package: ${firstLocal.hud}`);
    assert(localRequests.filter(url => url.includes('llevant-local-v1.json')).length === 1, 'First local metadata request count is wrong');
    assert(localRequests.filter(url => url.includes('llevant-local-v1.bin')).length === 1, 'First local binary request count is wrong');

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
    await page.waitForTimeout(450);
    const released = await page.evaluate(() => ({ state: window.WAFTRegionRuntime.getState(), localMetadata: window.WAFTRegionRuntime.localMetadata }));
    assert(released.state.worldMode === 'regional', `Exit produced ${released.state.worldMode}`);
    assert(released.state.renderDataset === 'regional-streamed', `Exit dataset is ${released.state.renderDataset}`);
    near(released.state.position.x, beforeExit.position.x, 1e-6, 'Regional x preservation');
    near(released.state.position.z, beforeExit.position.z, 1e-6, 'Regional z preservation');
    assert(released.state.localPackageLoaded === false, 'Local package remained loaded after exit');
    assert(released.state.localPackageStatus === 'unloaded', `Released local status is ${released.state.localPackageStatus}`);
    assert(released.state.localPackageReleaseCount === 1, `First release count is ${released.state.localPackageReleaseCount}`);
    assert(released.state.localGpuResources === 0, 'Local GPU resources remained after exit');
    assert(released.state.localPackageBytes === 0, 'Local byte accounting remained after exit');
    assert(released.state.localTerrain.columns === 0 && released.state.localTerrain.rows === 0, 'Local terrain references remained after exit');
    assert(released.state.localCounts.buildings === 0 && released.state.localCounts.roadVertices === 0, 'Local feature references remained after exit');
    assert(released.localMetadata === null, 'Local metadata reference remained after exit');
    assert(released.state.activeBuildings > 0 && released.state.activeBuildings < initial.metadata.counts.buildings, 'Regional streaming did not resume');

    const requestsBeforeSecondLoad = localRequests.length;
    await page.evaluate(() => window.WAFTRegionRuntime.enterLocal());
    await page.waitForTimeout(450);
    const secondLocal = await page.evaluate(() => ({ state: window.WAFTRegionRuntime.getState(), metadata: window.WAFTRegionRuntime.localMetadata }));
    assert(secondLocal.state.worldMode === 'local' && secondLocal.state.renderDataset === 'local-package', 'Local package could not be re-entered');
    assert(secondLocal.state.localPackageLoaded && secondLocal.state.localPackageStatus === 'loaded', 'Second local package load failed');
    assert(secondLocal.state.localPackageLoadCount === 2, `Second load count is ${secondLocal.state.localPackageLoadCount}`);
    assert(secondLocal.state.localPackageRequestCount === 4, `Second request count is ${secondLocal.state.localPackageRequestCount}`);
    assert(secondLocal.state.localPackageReleaseCount === 1, 'Release count changed during second load');
    assert(secondLocal.state.localGpuResources > 0, 'Second load did not recreate GPU resources');
    assert(secondLocal.metadata.buildId === firstLocal.metadata.buildId, 'Second load used a different local package build');
    assert(localRequests.length >= requestsBeforeSecondLoad + 2, 'Second entry did not request the local package again');

    if (options.screenshot) {
      fs.mkdirSync(path.dirname(options.screenshot), { recursive: true });
      await page.screenshot({ path: options.screenshot, type: 'png' });
    }

    await page.evaluate(() => window.WAFTRegionRuntime.exitLocal());
    await page.waitForTimeout(300);
    const finalState = await page.evaluate(() => window.WAFTRegionRuntime.getState());
    assert(finalState.worldMode === 'regional', 'Final mode is not regional');
    assert(finalState.localPackageLoaded === false && finalState.localPackageStatus === 'unloaded', 'Final local package was not released');
    assert(finalState.localPackageLoadCount === 2 && finalState.localPackageReleaseCount === 2, 'Final lifecycle counts are wrong');
    assert(finalState.localPackageRequestCount === 4, 'Final local request count is wrong');
    assert(finalState.localGpuResources === 0, 'Final local GPU resource count is not zero');
    assert(pageErrors.length === 0, `Page errors: ${pageErrors.join(' | ')}`);
    assert(consoleErrors.length === 0, `Console errors: ${consoleErrors.join(' | ')}`);

    const report = {
      formatVersion: 1,
      verifierVersion: VERIFIER_VERSION,
      runtimeVersion: '006',
      valid: true,
      public: options.public,
      url: options.url,
      regionalBuildId: initial.metadata.buildId,
      localBuildId: firstLocal.metadata.buildId,
      viewport: { width: 844, height: 390, touch: true },
      canvas: initial.canvas,
      localPackage: {
        bytes: firstLocal.metadata.binary.bytes,
        sha256: firstLocal.metadata.binary.sha256,
        terrain: firstLocal.metadata.terrain,
        counts: firstLocal.metadata.counts,
        worldScale: firstLocal.metadata.worldScale,
        footprintScale: firstLocal.metadata.footprintScale
      },
      tests: {
        noLocalBootRequests: true,
        loadingStateVisible: true,
        firstLoadRequests: 2,
        localDatasetActivated: firstLocal.state.renderDataset,
        localGpuResourcesCreated: firstLocal.state.localGpuResources,
        collisionProbe: firstLocal.collisionProbe,
        rightDisplayDistance: rightVector.distance,
        rightAlignment: rightVector.alignment,
        forwardDisplayDistance: forwardVector.distance,
        forwardAlignment: forwardVector.alignment,
        jumpRise,
        exitPreservedRegionalPosition: true,
        localReferencesReleased: true,
        localGpuResourcesReleased: true,
        regionalStreamingResumed: true,
        packageRequestedAgainOnReentry: true,
        finalLoads: finalState.localPackageLoadCount,
        finalReleases: finalState.localPackageReleaseCount,
        finalLocalRequests: finalState.localPackageRequestCount
      },
      finalState,
      localRequests,
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
