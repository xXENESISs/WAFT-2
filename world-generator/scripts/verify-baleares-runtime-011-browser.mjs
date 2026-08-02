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

function distance2D(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

async function waitReady(page) {
  await page.waitForFunction(() => window.__WAFT_RUNTIME_011_READY__ === true, null, { timeout: 120000 });
  await page.waitForTimeout(1200);
}

async function snapshot(page) {
  return page.evaluate(() => ({
    version: window.WAFTRegionRuntime.version,
    state: window.WAFTRegionRuntime.getState(),
    travel: window.WAFTRegionRuntime.getTravelState(),
    graph: window.WAFTRegionRuntime.travelGraph,
    metrics: window.WAFTRegionRuntime.playerMetrics,
    error: window.__WAFT_RUNTIME_011_ERROR__ ?? null,
    stats: window.__WAFT_RUNTIME_011_STATS__,
    hud: document.getElementById('hudStats')?.textContent ?? '',
    travelHud: document.getElementById('travelStats')?.textContent ?? '',
    canvas: {
      width: document.querySelector('canvas')?.width ?? 0,
      height: document.querySelector('canvas')?.height ?? 0
    },
    webgl2: Boolean(document.querySelector('canvas')?.getContext('webgl2')),
    localStoragePayload: localStorage.getItem('waft.baleares.travel.v1')
  }));
}

async function setRegionalPosition(page, x, z, yaw = null) {
  await page.evaluate(({ x, z, yaw }) => {
    window.WAFTRegionRuntime.setRegionalPosition(x, z);
    if (yaw !== null) window.WAFTRegionRuntime.setHeading(yaw);
  }, { x, z, yaw });
  await page.waitForTimeout(350);
  return snapshot(page);
}

async function move(page, x, y, milliseconds) {
  return page.evaluate(async ({ x, y, milliseconds }) => {
    const before = window.WAFTRegionRuntime.getState();
    window.WAFTRegionRuntime.setInput(x, y);
    await new Promise(resolve => setTimeout(resolve, milliseconds));
    window.WAFTRegionRuntime.setInput(0, 0);
    await new Promise(resolve => setTimeout(resolve, 180));
    const after = window.WAFTRegionRuntime.getState();
    return {
      before,
      after,
      displayDistance: Math.hypot(
        after.displayPosition.x - before.displayPosition.x,
        after.displayPosition.z - before.displayPosition.z
      )
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
    args: ['--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--disable-background-networking']
  });

  try {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error' && !message.text().includes('404')) consoleErrors.push(message.text());
    });
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('__waft_runtime_011_test_initialized')) {
        localStorage.removeItem('waft.baleares.travel.v1');
        sessionStorage.setItem('__waft_runtime_011_test_initialized', '1');
      }
    });

    const response = await page.goto(options.url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    assert(response?.ok(), `Runtime page returned ${response?.status() ?? 'no response'}`);
    await waitReady(page);

    const initial = await snapshot(page);
    assert(!initial.error, initial.error || 'Runtime reported an unknown error');
    assert(initial.version === '011', `Expected runtime 011, got ${initial.version}`);
    assert(initial.webgl2, 'WebGL2 is unavailable');
    assert(initial.canvas.width >= 800 && initial.canvas.height >= 350, `Canvas is too small: ${initial.canvas.width}x${initial.canvas.height}`);
    assert(initial.metrics.terrainAdaptation && initial.metrics.swimming, 'Runtime 010 locomotion contracts were lost');
    assert(initial.metrics.jumpVelocity >= 8.5 && initial.metrics.swimSpeed >= 5, 'Jump or swim metrics regressed');
    assert(initial.graph?.regionId === 'baleares' && initial.graph.schemaVersion === 1, 'Travel graph metadata is invalid');
    assert(initial.graph.nodes.length === 5, `Expected 5 travel nodes, got ${initial.graph.nodes.length}`);
    assert(initial.graph.routes.length === 5, `Expected 5 travel routes, got ${initial.graph.routes.length}`);
    assert(initial.travel.loaded === true && initial.travel.restored === false, 'Fresh travel state did not initialize correctly');
    assert(initial.travel.discoveredNodes.includes('palma'), 'Palma was not registered as the starting travel node');
    assert(initial.travel.discoveredNodes.length === 1, `Unexpected fresh discovered nodes: ${initial.travel.discoveredNodes}`);
    assert(initial.travel.discoveredRoutes.length === 0, 'A connection was discovered without reaching both endpoints');
    assert(initial.travel.trailPoints >= 1, 'Fresh progress has no breadcrumb origin');
    assert(initial.localStoragePayload, 'Fresh progress was not saved to localStorage');
    assert(initial.travelHud.includes('Zonas 1/5'), `Travel HUD is wrong: ${initial.travelHud}`);

    const alcudiaProbe = await page.evaluate(() => window.WAFTRegionRuntime.getTravelProbe('alcúdia'));
    assert(alcudiaProbe?.node?.id === 'alcúdia', `Invalid Alcúdia travel probe: ${JSON.stringify(alcudiaProbe)}`);
    const beforeApproach = await setRegionalPosition(page, alcudiaProbe.start.x, alcudiaProbe.start.z, alcudiaProbe.yaw);
    assert(!beforeApproach.travel.discoveredNodes.includes('alcúdia'), 'Teleporting to the approach point discovered Alcúdia');
    assert(beforeApproach.travel.discoveryArmed === false, 'Teleport did not suppress travel discovery');

    const approachMovement = await move(page, 0, -1, alcudiaProbe.suggestedMilliseconds);
    const afterApproach = await snapshot(page);
    assert(approachMovement.displayDistance > 5, `Physical approach was too short: ${approachMovement.displayDistance}`);
    assert(afterApproach.travel.discoveryArmed === true, 'Physical movement did not re-arm travel discovery');
    assert(afterApproach.travel.discoveredNodes.includes('alcúdia'), `Alcúdia was not physically discovered: ${JSON.stringify(afterApproach.travel)}`);
    assert(afterApproach.travel.discoveredRoutes.includes('palma-alcudia'), 'Palma–Alcúdia connection was not discovered');
    assert(afterApproach.travel.distance > 5, `Travel distance was not accumulated: ${afterApproach.travel.distance}`);
    assert(afterApproach.travel.landDistance > 4, `Land distance was not accumulated: ${afterApproach.travel.landDistance}`);
    assert(afterApproach.travel.trailPoints >= 4, `Breadcrumb trail is too short: ${afterApproach.travel.trailPoints}`);
    assert(afterApproach.travelHud.includes('Zonas 2/5') && afterApproach.travelHud.includes('conexiones 1/5'), `Travel HUD did not update: ${afterApproach.travelHud}`);

    const saved = await page.evaluate(() => window.WAFTRegionRuntime.saveProgress());
    assert(saved && saved.dirty === false && saved.saveCount >= 2, `Manual save failed: ${JSON.stringify(saved)}`);
    const savedPosition = { ...saved.position };
    const savedNodes = [...saved.discoveredNodes];
    const savedRoutes = [...saved.discoveredRoutes];
    const savedTrailPoints = saved.trailPoints;

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
    await waitReady(page);
    const restored = await snapshot(page);
    assert(restored.travel.restored === true, 'Saved travel was not restored after reload');
    assert(distance2D(restored.travel.position, savedPosition) < .35, `Restored position changed: ${JSON.stringify({ savedPosition, restored: restored.travel.position })}`);
    assert(savedNodes.every(id => restored.travel.discoveredNodes.includes(id)), `Restored nodes are incomplete: ${restored.travel.discoveredNodes}`);
    assert(savedRoutes.every(id => restored.travel.discoveredRoutes.includes(id)), `Restored routes are incomplete: ${restored.travel.discoveredRoutes}`);
    assert(restored.travel.trailPoints >= savedTrailPoints, `Restored trail shrank: ${restored.travel.trailPoints}/${savedTrailPoints}`);
    assert(restored.travel.distance >= saved.distance - .01, `Restored distance regressed: ${restored.travel.distance}/${saved.distance}`);

    const menorca = restored.graph.nodes.find(node => node.id === 'menorca');
    assert(menorca, 'Menorca travel node is missing');
    const teleportedMenorca = await setRegionalPosition(page, menorca.x, menorca.z);
    assert(!teleportedMenorca.travel.discoveredNodes.includes('menorca'), 'Direct API teleport discovered Menorca');
    assert(teleportedMenorca.travel.discoveryArmed === false, 'Menorca teleport did not suppress discovery');

    const reset = await page.evaluate(() => window.WAFTRegionRuntime.resetProgress());
    assert(reset.discoveredNodes.length === 1 && reset.discoveredNodes[0] === 'palma', `Reset nodes are wrong: ${reset.discoveredNodes}`);
    assert(reset.discoveredRoutes.length === 0, `Reset routes are wrong: ${reset.discoveredRoutes}`);
    assert(reset.distance === 0 && reset.landDistance === 0 && reset.waterDistance === 0, `Reset distances are wrong: ${JSON.stringify(reset)}`);
    assert(reset.trailPoints === 1, `Reset trail should contain one origin, got ${reset.trailPoints}`);

    const locomotionProbes = await page.evaluate(() => window.WAFTRegionRuntime.getLocomotionProbes());
    const mountainBefore = await setRegionalPosition(page, locomotionProbes.mountain.start.x, locomotionProbes.mountain.start.z, locomotionProbes.mountain.yaw);
    const mountainMovement = await move(page, 0, -1, locomotionProbes.mountain.suggestedMilliseconds);
    const mountainAfter = await snapshot(page);
    const mountainGain = mountainAfter.state.groundHeight - mountainBefore.state.groundHeight;
    assert(mountainMovement.displayDistance > .35, `Mountain movement regressed: ${mountainMovement.displayDistance}`);
    assert(mountainGain > .05, `Mountain climbing regressed: ${mountainGain}`);
    assert(Math.abs(mountainAfter.state.terrainPitch) > .015 || mountainAfter.state.slopeAngle > .04, 'Slope adaptation regressed');

    const waterBefore = await setRegionalPosition(page, locomotionProbes.water.start.x, locomotionProbes.water.start.z, locomotionProbes.water.yaw);
    assert(waterBefore.state.swimming === true, 'Open water no longer activates swimming');
    const waterMovement = await move(page, 0, -1, locomotionProbes.water.suggestedMilliseconds);
    const waterAfter = await snapshot(page);
    assert(waterMovement.displayDistance > 1.2, `Swimming movement regressed: ${waterMovement.displayDistance}`);
    assert(waterAfter.state.swimming === true && Math.abs(waterAfter.state.terrainPitch) > .18, 'Swimming posture regressed');

    await page.evaluate(() => window.WAFTRegionRuntime.spawn('palma'));
    await page.waitForTimeout(450);
    await page.evaluate(() => window.WAFTRegionRuntime.enterLocal('palma'));
    await page.waitForFunction(() => {
      const state = window.WAFTRegionRuntime.getState();
      return state.worldMode === 'local' && state.localZoneId === 'palma' && state.localPackageStatus === 'loaded';
    }, null, { timeout: 120000 });
    await page.waitForTimeout(700);
    const beforeJump = await page.evaluate(() => window.WAFTRegionRuntime.getState());
    await page.evaluate(() => window.WAFTRegionRuntime.jump());
    await page.waitForTimeout(230);
    const duringJump = await page.evaluate(() => window.WAFTRegionRuntime.getState());
    const jumpRise = duringJump.position.y - beforeJump.position.y;
    assert(jumpRise > 1.2, `High jump regressed: ${jumpRise}`);
    await page.evaluate(() => window.WAFTRegionRuntime.exitLocal());
    await page.waitForTimeout(400);

    if (options.screenshot) {
      fs.mkdirSync(path.dirname(options.screenshot), { recursive: true });
      await page.screenshot({ path: options.screenshot, fullPage: true });
    }

    assert(pageErrors.length === 0, `Page errors: ${pageErrors.join(' | ')}`);
    assert(consoleErrors.length === 0, `Console errors: ${consoleErrors.join(' | ')}`);

    const final = await snapshot(page);
    const report = {
      formatVersion: 1,
      verifierVersion: VERIFIER_VERSION,
      runtimeVersion: '011',
      valid: true,
      public: options.public,
      url: options.url,
      viewport: { width: 844, height: 390, touch: true },
      canvas: initial.canvas,
      travel: {
        graph: { nodes: initial.graph.nodes.length, routes: initial.graph.routes.length },
        initial: initial.travel,
        physicallyDiscoveredNode: 'alcúdia',
        physicallyDiscoveredRoute: 'palma-alcudia',
        approachDistance: approachMovement.displayDistance,
        afterApproach: afterApproach.travel,
        restored: restored.travel,
        teleportSuppression: { node: 'menorca', discovered: false },
        reset
      },
      locomotion: {
        mountainDistance: mountainMovement.displayDistance,
        mountainGain,
        waterDistance: waterMovement.displayDistance,
        highJumpRise: jumpRise
      },
      localZoneLifecycle: {
        palmaLoaded: true,
        finalMode: final.state.worldMode,
        packageLoads: final.state.localPackageLoadCount,
        packageReleases: final.state.localPackageReleaseCount,
        gpuResources: final.state.localGpuResources
      },
      tests: {
        freshProgressInitialized: true,
        physicalNodeDiscovery: true,
        connectionDiscovery: true,
        breadcrumbTrail: true,
        manualSave: true,
        reloadRestore: true,
        positionRestore: true,
        teleportDoesNotDiscover: true,
        resetProgress: true,
        mountainClimbingPreserved: true,
        swimmingPreserved: true,
        highJumpPreserved: true,
        localZonePackagesPreserved: true
      },
      finalState: final.state,
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
  console.error(error?.stack || error);
  process.exitCode = 1;
});
