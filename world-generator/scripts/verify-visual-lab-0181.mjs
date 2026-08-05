import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BUILD_ID = 'waft-visual-lab-0181-v3';
const VERSION = '0.18.1';

function parseArgs(argv) {
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
function assert(value, message) { if (!value) throw new Error(message); }
function chromePath() {
  for (const candidate of [process.env.CHROME_BIN, '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean)) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error('Chrome no está disponible');
}

async function verify() {
  const options = parseArgs(process.argv.slice(2));
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
    page.on('console', message => {
      if (message.type() === 'error' && !message.text().includes('404')) consoleErrors.push(message.text());
    });
    page.on('requestfailed', request => {
      if (!request.url().endsWith('/favicon.ico')) requestFailures.push(`${request.url()}: ${request.failure()?.errorText || 'failed'}`);
    });
    const response = await page.goto(options.url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    assert(response?.ok(), `La página devolvió ${response?.status()}`);
    await page.waitForFunction(() => window.__WAFT_VISUAL_LAB_0181_READY__ === true && window.__WAFT_VISUAL_LAB_0181_REFINED__ === true && window.__WAFT_VISUAL_LAB_0181_POLISHED__ === true && Boolean(window.WAFTVisualLab0181?.getState), null, { timeout: 120000 });
    await page.waitForTimeout(1500);
    const initial = await page.evaluate(() => window.WAFTVisualLab0181.getState());
    assert(initial.version === VERSION, `Versión inesperada: ${initial.version}`);
    assert(initial.buildId === BUILD_ID, `Build inesperada: ${initial.buildId}`);
    assert(initial.sectionCount === 8, `Solo hay ${initial.sectionCount} secciones`);
    assert(initial.refinedCharacter === true, 'El macaco refinado no está activo');
    assert(initial.polishedReview === true, 'La pasada de pulido no está activa');
    assert(initial.hiddenSigns >= 8, `Solo se ocultaron ${initial.hiddenSigns} carteles obstructivos`);
    assert(initial.focusPresetCount === 8, `Solo hay ${initial.focusPresetCount} encuadres de revisión`);
    assert(initial.mergedGroups >= 7, `Solo se fusionaron ${initial.mergedGroups} grupos estáticos`);
    assert(initial.meshCount >= 80, `Escena demasiado vacía: ${initial.meshCount} mallas`);
    assert(initial.meshCount <= 520, `Escena todavía demasiado fragmentada: ${initial.meshCount} mallas`);
    assert(initial.materialCount >= 30, `Catálogo material insuficiente: ${initial.materialCount}`);
    assert(initial.webgl2 === true, 'WebGL2 no está activo');

    const sectionIds = await page.evaluate(() => window.WAFTVisualLab0181.getSections().map(section => section.id));
    assert(new Set(sectionIds).size === 8, 'Hay identificadores de sección duplicados');
    const focusResults = [];
    for (const id of sectionIds) {
      await page.evaluate(sectionId => window.WAFTVisualLab0181.focus(sectionId, true), id);
      await page.waitForTimeout(100);
      const active = await page.evaluate(() => window.WAFTVisualLab0181.getState().activeSection);
      focusResults.push({ id, active });
      assert(active === id, `No se pudo enfocar ${id}; quedó ${active}`);
    }

    await page.evaluate(() => window.WAFTVisualLab0181.focus('macaque', true));
    await page.waitForTimeout(500);
    const activeButtons = await page.locator('.sectionButton.active').count();
    assert(activeButtons === 1, `Hay ${activeButtons} botones activos`);
    const labels = await page.locator('.sectionButton').allTextContents();
    assert(labels.some(label => /MACACO/i.test(label)) && labels.some(label => /MATERIALES/i.test(label)), 'La navegación no etiqueta los extremos del catálogo');
    if (options.screenshot) await page.screenshot({ path: options.screenshot, type: 'png' });

    await page.locator('[data-vote="like"]').click();
    const feedback = await page.evaluate(() => window.WAFTVisualLab0181.getFeedback());
    assert(feedback.macaque === 'like', 'La valoración del diseño no se guardó');
    await page.waitForTimeout(1900);

    const finalState = await page.evaluate(() => window.WAFTVisualLab0181.getState());
    assert(pageErrors.length === 0, `Errores de página: ${pageErrors.join(' | ')}`);
    assert(consoleErrors.length === 0, `Errores de consola: ${consoleErrors.join(' | ')}`);
    assert(requestFailures.length === 0, `Fallos de red: ${requestFailures.join(' | ')}`);

    const report = {
      formatVersion: 1,
      valid: true,
      public: options.public,
      url: options.url,
      version: VERSION,
      buildId: BUILD_ID,
      viewport: { width: 844, height: 390, mobile: true, touch: true },
      sectionIds,
      focusResults,
      labels,
      state: finalState,
      pageErrors,
      consoleErrors,
      requestFailures,
      verifiedAt: new Date().toISOString()
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
