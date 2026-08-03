import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BUILD_ID = 'waft-adventure-0170-dense-places-v2';

function args(argv) {
  const result = { url: null, output: null, screenshot: null, public: false };
  const values = [...argv];
  while (values.length) {
    const flag = values.shift();
    if (flag === '--url') result.url = values.shift();
    else if (flag === '--output') result.output = values.shift();
    else if (flag === '--screenshot') result.screenshot = values.shift();
    else if (flag === '--public') result.public = true;
    else throw new Error(`Argumento desconocido: ${flag}`);
  }
  if (!result.url || !result.output) throw new Error('--url y --output son obligatorios');
  return result;
}
function assert(value, message) {
  if (!value) throw new Error(message);
}
function chromePath() {
  for (const candidate of [process.env.CHROME_BIN, '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean)) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error('Chrome no está disponible');
}
async function waitAdventure(page, regionId, timeout = 120000) {
  await page.waitForFunction(expected => {
    const app = window.WAFTAdventure0170;
    if (!app || window.__WAFT_ADVENTURE_0170_READY__ !== true) return false;
    const state = app.getState();
    return state.runtimeReady && state.currentRegionId === expected && app.getRuntime()?.getState;
  }, regionId, { timeout });
  return page.evaluate(() => {
    const app = window.WAFTAdventure0170;
    const runtime = app.getRuntime();
    return {
      adventure: app.getState(),
      runtime: runtime.getState(),
      version: runtime.version,
      zones: runtime.localRegistry.zones.map(zone => ({
        id: zone.id,
        presetId: zone.presetId,
        name: zone.name,
        buildingCount: zone.buildingCount,
        roadVertexCount: zone.roadVertexCount,
        cityType: zone.cityType
      }))
    };
  });
}
async function enterZone(page, matcher, minimumBuildings) {
  const zone = await page.evaluate(pattern => {
    const runtime = window.WAFTAdventure0170.getRuntime();
    const expression = new RegExp(pattern, 'i');
    const selected = runtime.localRegistry.zones.find(item => expression.test(item.name) || expression.test(item.presetId)) || runtime.localRegistry.zones[0];
    if (!selected) throw new Error('No hay zona local disponible');
    runtime.spawn(selected.presetId);
    return { ...selected };
  }, matcher);
  await page.waitForTimeout(450);
  const proximity = await page.evaluate(() => window.WAFTAdventure0170.getRuntime().detectLocalZone());
  assert(proximity.status === 'available', `${zone.name}: acceso no disponible (${JSON.stringify(proximity)})`);
  await page.evaluate(zoneId => window.WAFTAdventure0170.getRuntime().enterLocal(zoneId), zone.id);
  await page.waitForFunction(() => {
    const state = window.WAFTAdventure0170.getRuntime().getState();
    return state.worldMode === 'local' && state.localPackageLoaded && state.localPackageStatus === 'loaded';
  }, null, { timeout: 60000 });
  const state = await page.evaluate(() => window.WAFTAdventure0170.getRuntime().getState());
  assert(state.localBuildingCount >= minimumBuildings, `${zone.name}: solo ${state.localBuildingCount} edificios locales`);
  assert(state.localRoadVertexCount >= 20, `${zone.name}: red viaria demasiado pobre`);
  await page.evaluate(() => window.WAFTAdventure0170.getRuntime().exitLocal());
  await page.waitForFunction(() => window.WAFTAdventure0170.getRuntime().getState().worldMode === 'regional');
  return { zone, state };
}
async function directTravel(page, destination) {
  await page.waitForFunction(() => Boolean(window.WAFTDirectTravel0170?.travel));
  await page.evaluate(() => window.WAFTDirectTravel0170.travel());
  return waitAdventure(page, destination);
}

async function verify() {
  const options = args(process.argv.slice(2));
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
    page.on('requestfailed', request => requestFailures.push(`${request.url()}: ${request.failure()?.errorText || 'failed'}`));
    const response = await page.goto(options.url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    assert(response?.ok(), `La página devolvió ${response?.status()}`);
    await page.evaluate(() => {
      localStorage.removeItem('waft.adventure.0170.world.v1');
      localStorage.removeItem('waft.baleares.travel.v1');
      localStorage.removeItem('waft.catalunya-litoral.travel.v1');
    });
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });

    const baleares = await waitAdventure(page, 'baleares');
    assert(baleares.adventure.buildId === BUILD_ID, `Build inesperada: ${baleares.adventure.buildId}`);
    assert(baleares.version === '013', `Runtime Baleares inesperado: ${baleares.version}`);
    assert(baleares.zones.length >= 4, `Baleares solo tiene ${baleares.zones.length} zonas`);
    assert(baleares.zones.every(zone => zone.buildingCount >= 180), 'Baleares conserva zonas vacías');
    const palma = await enterZone(page, 'palma', 450);

    const button = await page.evaluate(() => {
      const element = document.getElementById('directTravelButton');
      const rect = element.getBoundingClientRect();
      return { text: element.textContent, width: rect.width, height: rect.height, visible: rect.width > 0 && rect.height > 0 };
    });
    assert(button.visible && button.height >= 44, `Botón de Barcelona poco accesible: ${JSON.stringify(button)}`);
    assert(/BARCELONA/i.test(button.text), `El viaje a Barcelona no es explícito: ${button.text}`);

    const catalunya = await directTravel(page, 'catalunya-litoral');
    assert(catalunya.version === '003', `Runtime Catalunya inesperado: ${catalunya.version}`);
    assert(catalunya.zones.length >= 3, `Catalunya solo tiene ${catalunya.zones.length} zonas`);
    assert(catalunya.zones.some(zone => /barcelona/i.test(zone.name)), 'Barcelona no aparece como zona local');
    assert(catalunya.zones.every(zone => zone.buildingCount >= 180), 'Catalunya conserva zonas vacías');
    const barcelona = await enterZone(page, 'barcelona', 450);

    await page.evaluate(() => window.WAFTAdventure0170.save());
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
    const restored = await waitAdventure(page, 'catalunya-litoral');
    assert(restored.adventure.restored === true, 'El mundo no se restauró en Catalunya');
    const returned = await directTravel(page, 'baleares');
    assert(returned.adventure.transitionCount >= 2, 'El viaje de ida y vuelta no se registró');

    const canvas = await page.evaluate(() => {
      const runtimeDocument = document.getElementById('runtime').contentDocument;
      const canvas = runtimeDocument?.querySelector('canvas');
      return { width: canvas?.width || 0, height: canvas?.height || 0, webgl2: Boolean(canvas?.getContext('webgl2')) };
    });
    assert(canvas.webgl2, 'WebGL2 no está disponible');
    assert(pageErrors.length === 0, `Errores de página: ${pageErrors.join(' | ')}`);
    assert(consoleErrors.length === 0, `Errores de consola: ${consoleErrors.join(' | ')}`);
    assert(requestFailures.length === 0, `Fallos de red: ${requestFailures.join(' | ')}`);
    if (options.screenshot) await page.screenshot({ path: options.screenshot, type: 'png' });

    const report = {
      formatVersion: 1,
      valid: true,
      public: options.public,
      url: options.url,
      buildId: BUILD_ID,
      viewport: { width: 844, height: 390, touch: true },
      canvas,
      directTravelButton: button,
      transitions: returned.adventure.transitionCount,
      restored: restored.adventure.restored,
      regions: {
        baleares: { runtimeVersion: baleares.version, zones: baleares.zones.length, totalBuildings: baleares.zones.reduce((sum, zone) => sum + zone.buildingCount, 0), palmaBuildings: palma.state.localBuildingCount },
        catalunyaLitoral: { runtimeVersion: catalunya.version, zones: catalunya.zones.length, totalBuildings: catalunya.zones.reduce((sum, zone) => sum + zone.buildingCount, 0), barcelonaBuildings: barcelona.state.localBuildingCount }
      },
      pageErrors,
      consoleErrors,
      requestFailures
    };
    const output = path.resolve(ROOT, options.output);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } finally {
    await browser.close();
  }
}

verify().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
