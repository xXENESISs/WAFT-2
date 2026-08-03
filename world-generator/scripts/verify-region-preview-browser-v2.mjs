import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const VERIFIER_VERSION = 1;

function parseArguments(argv) {
  const result = { regionId: null, url: null, output: null, screenshot: null, public: false };
  const args = [...argv];
  while (args.length) {
    const flag = args.shift();
    if (flag === '--region') result.regionId = args.shift();
    else if (flag === '--url') result.url = args.shift();
    else if (flag === '--output') result.output = args.shift();
    else if (flag === '--screenshot') result.screenshot = args.shift();
    else if (flag === '--public') result.public = true;
    else throw new Error(`Unknown argument ${flag}`);
  }
  if (!result.regionId || !result.url || !result.output) throw new Error('--region, --url and --output are required');
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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function verify() {
  const options = parseArguments(process.argv.slice(2));
  const configPath = path.join(ROOT, 'world-generator/configs', `${options.regionId}.region.json`);
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const pageErrors = [];
  const consoleErrors = [];
  const requestFailures = [];
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
    page.on('requestfailed', request => requestFailures.push(`${request.url()}: ${request.failure()?.errorText ?? 'failed'}`));

    const response = await page.goto(options.url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    assert(response?.ok(), `Preview page returned ${response?.status() ?? 'no response'}`);
    await page.waitForFunction(() => window.__WAFT_PREVIEW_READY__ === true, null, { timeout: 120000 });
    await page.waitForTimeout(2200);

    const initial = await page.evaluate(() => ({
      stats: window.__WAFT_PREVIEW_STATS__,
      metadata: window.WAFTPreview?.metadata ?? null,
      error: window.__WAFT_PREVIEW_ERROR__ ?? null,
      canvas: {
        width: document.querySelector('canvas')?.width ?? 0,
        height: document.querySelector('canvas')?.height ?? 0
      },
      webgl2: Boolean(document.querySelector('canvas')?.getContext('webgl2')),
      loadingHidden: document.getElementById('loading')?.classList.contains('hide') ?? false,
      presets: [...document.querySelectorAll('#presets button')].map(button => ({
        id: button.dataset.id,
        name: button.textContent,
        active: button.classList.contains('active')
      })),
      hud: document.getElementById('hudStats')?.textContent ?? '',
      camera: { ...window.WAFTPreview.camera }
    }));

    assert(!initial.error, initial.error || 'Preview reported an unknown error');
    assert(initial.webgl2, 'WebGL2 context was not available');
    assert(initial.loadingHidden, 'Loading overlay did not close');
    assert(initial.canvas.width >= 800 && initial.canvas.height >= 350, `Canvas is too small: ${initial.canvas.width}x${initial.canvas.height}`);
    assert(initial.metadata?.regionId === options.regionId, `Expected region ${options.regionId}, got ${initial.metadata?.regionId}`);
    assert(initial.stats?.regionId === options.regionId, `Preview stats region mismatch: ${initial.stats?.regionId}`);
    assert(initial.metadata.regionName === config.name, `Region name mismatch: ${initial.metadata.regionName}/${config.name}`);
    assert(initial.metadata.binary?.sha256 === initial.stats.binarySha256, 'Binary SHA-256 differs between metadata and runtime stats');
    assert(initial.stats.buildings >= 1000, `Too few buildings: ${initial.stats.buildings}`);
    assert(initial.stats.selectedRoads >= 1000, `Too few roads: ${initial.stats.selectedRoads}`);
    assert(initial.stats.roadVertices >= 4000, `Too few road vertices: ${initial.stats.roadVertices}`);
    assert(initial.stats.landmarks >= config.gameplay.contentTargets.minimumLandmarks, `Too few landmarks: ${initial.stats.landmarks}`);
    assert(initial.stats.settlements >= 20, `Too few settlements: ${initial.stats.settlements}`);
    assert(initial.presets.length >= 4, `Too few presets: ${initial.presets.length}`);
    assert(initial.presets.some(preset => preset.id === 'overview'), 'Overview preset is missing');

    const targetPreset = initial.presets.find(preset => preset.id !== 'overview');
    assert(targetPreset, 'No non-overview preset exists');
    const interaction = await page.evaluate(targetId => {
      const before = { ...window.WAFTPreview.camera };
      window.WAFTPreview.jump(targetId);
      window.WAFTPreview.setLayer('roads', false);
      window.WAFTPreview.setLayer('roads', true);
      window.WAFTPreview.setLayer('buildings', false);
      window.WAFTPreview.setLayer('buildings', true);
      window.WAFTPreview.setLayer('hotels', false);
      window.WAFTPreview.setLayer('hotels', true);
      return {
        before,
        after: { ...window.WAFTPreview.camera },
        preset: window.WAFTPreview.metadata.presets.find(item => item.id === targetId)
      };
    }, targetPreset.id);
    await page.waitForTimeout(900);
    const cameraDistance = Math.hypot(
      interaction.after.x - interaction.before.x,
      interaction.after.y - interaction.before.y,
      interaction.after.z - interaction.before.z
    );
    assert(cameraDistance > 1, `Preset ${targetPreset.id} did not move the camera: ${cameraDistance}`);
    assert(Number.isFinite(interaction.after.x) && Number.isFinite(interaction.after.y) && Number.isFinite(interaction.after.z), 'Preset produced invalid camera coordinates');
    assert(interaction.after.y > 1, `Preset camera altitude is invalid: ${interaction.after.y}`);
    assert(interaction.preset?.id === targetPreset.id, 'Runtime metadata cannot resolve the selected preset');

    if (options.screenshot) {
      fs.mkdirSync(path.dirname(options.screenshot), { recursive: true });
      await page.screenshot({ path: options.screenshot, type: 'png' });
    }

    assert(pageErrors.length === 0, `Page errors: ${pageErrors.join(' | ')}`);
    assert(consoleErrors.length === 0, `Console errors: ${consoleErrors.join(' | ')}`);
    assert(requestFailures.length === 0, `Request failures: ${requestFailures.join(' | ')}`);

    const report = {
      formatVersion: 1,
      verifierVersion: VERIFIER_VERSION,
      regionId: options.regionId,
      valid: true,
      public: options.public,
      url: options.url,
      viewport: { width: 844, height: 390, touch: true },
      canvas: initial.canvas,
      buildId: initial.metadata.buildId,
      binarySha256: initial.metadata.binary.sha256,
      counts: initial.metadata.counts,
      presets: initial.presets.map(preset => preset.name),
      interaction: {
        targetPresetId: targetPreset.id,
        targetPresetName: targetPreset.name,
        cameraDistance,
        camera: interaction.after,
        layerToggle: true
      },
      webgl2: true,
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
