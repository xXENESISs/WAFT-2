import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

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
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    const response = await page.goto(options.url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    if (!response || !response.ok()) throw new Error(`Preview page returned ${response?.status() ?? 'no response'}`);
    await page.waitForFunction(() => window.__WAFT_PREVIEW_READY__ === true, null, { timeout: 120000 });
    await page.waitForTimeout(2500);
    const initial = await page.evaluate(() => ({
      stats: window.__WAFT_PREVIEW_STATS__,
      error: window.__WAFT_PREVIEW_ERROR__ ?? null,
      canvas: { width: document.querySelector('canvas')?.width ?? 0, height: document.querySelector('canvas')?.height ?? 0 },
      loadingHidden: document.getElementById('loading')?.classList.contains('hide') ?? false,
      presets: [...document.querySelectorAll('#presets button')].map(button => button.textContent),
      webgl2: Boolean(document.querySelector('canvas')?.getContext('webgl2')),
      hud: document.getElementById('hudStats')?.textContent ?? ''
    }));
    if (initial.error) throw new Error(initial.error);
    if (!initial.webgl2) throw new Error('WebGL2 context was not available');
    if (!initial.loadingHidden) throw new Error('Loading overlay did not close');
    if (initial.canvas.width < 800 || initial.canvas.height < 350) throw new Error(`Canvas is too small: ${initial.canvas.width}x${initial.canvas.height}`);
    if (initial.stats.buildings < 5000) throw new Error(`Too few buildings: ${initial.stats.buildings}`);
    if (initial.stats.hotels < 2000) throw new Error(`Too few hotels: ${initial.stats.hotels}`);
    if (initial.stats.selectedRoads < 3000) throw new Error(`Too few roads: ${initial.stats.selectedRoads}`);
    if (initial.stats.landmarks !== 90) throw new Error(`Expected 90 landmarks, got ${initial.stats.landmarks}`);
    for (const required of ['Tot', 'Palma', 'Llevant', 'Menorca', 'Eivissa']) {
      if (!initial.presets.includes(required)) throw new Error(`Missing preset ${required}`);
    }
    const interaction = await page.evaluate(() => {
      window.WAFTPreview.jump('palma');
      window.WAFTPreview.setLayer('roads', false);
      window.WAFTPreview.setLayer('roads', true);
      window.WAFTPreview.setLayer('hotels', false);
      window.WAFTPreview.setLayer('hotels', true);
      return { camera: { ...window.WAFTPreview.camera }, buildId: window.WAFTPreview.metadata.buildId };
    });
    await page.waitForTimeout(800);
    if (!Number.isFinite(interaction.camera.x) || !Number.isFinite(interaction.camera.y) || !Number.isFinite(interaction.camera.z)) throw new Error('Preset produced invalid camera coordinates');
    if (interaction.camera.y <= 1) throw new Error('Preset camera height is invalid');
    if (options.screenshot) {
      fs.mkdirSync(path.dirname(options.screenshot), { recursive: true });
      await page.screenshot({ path: options.screenshot, type: 'png' });
    }
    if (pageErrors.length) throw new Error(`Page errors: ${pageErrors.join(' | ')}`);
    const report = {
      formatVersion: 1,
      valid: true,
      public: options.public,
      url: options.url,
      buildId: interaction.buildId,
      stats: initial.stats,
      viewport: { width: 844, height: 390, touch: true },
      canvas: initial.canvas,
      presets: initial.presets,
      interaction,
      pageErrors,
      consoleErrors
    };
    fs.mkdirSync(path.dirname(options.output), { recursive: true });
    fs.writeFileSync(options.output, `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await browser.close();
  }
}

verify().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
