import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

function findChrome() {
  for (const candidate of [process.env.CHROME_BIN, '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean)) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error('Chrome not found');
}

const url = process.argv[2];
const output = process.argv[3];
if (!url || !output) throw new Error('Usage: debug-baleares-runtime-010-browser.mjs <url> <output>');

const pageErrors = [];
const consoleMessages = [];
const requestFailures = [];
const browser = await chromium.launch({
  executablePath: findChrome(),
  headless: true,
  args: ['--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--disable-background-networking']
});

try {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', error => pageErrors.push(error.stack || error.message));
  page.on('console', message => consoleMessages.push({ type: message.type(), text: message.text() }));
  page.on('requestfailed', request => requestFailures.push({ url: request.url(), failure: request.failure()?.errorText || null }));
  const startedAt = Date.now();
  let responseStatus = null;
  let navigationError = null;
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    responseStatus = response?.status() ?? null;
  } catch (error) {
    navigationError = error.stack || error.message;
  }
  const samples = [];
  for (let index = 0; index < 20; index++) {
    await page.waitForTimeout(1000);
    samples.push(await page.evaluate(() => ({
      second: Math.round(performance.now() / 1000),
      ready: window.__WAFT_RUNTIME_010_READY__ === true,
      error: window.__WAFT_RUNTIME_010_ERROR__ ?? null,
      hasApi: Boolean(window.WAFTRegionRuntime),
      loadingText: document.getElementById('loadText')?.textContent ?? null,
      loadingHidden: document.getElementById('loading')?.classList.contains('hide') ?? false,
      errorVisible: getComputedStyle(document.getElementById('error')).display,
      errorText: document.getElementById('error')?.textContent ?? '',
      memory: performance.memory ? {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit
      } : null
    })));
    if (samples.at(-1).ready || samples.at(-1).error) break;
  }
  const final = await page.evaluate(() => ({
    title: document.title,
    ready: window.__WAFT_RUNTIME_010_READY__ === true,
    error: window.__WAFT_RUNTIME_010_ERROR__ ?? null,
    apiVersion: window.WAFTRegionRuntime?.version ?? null,
    apiState: window.WAFTRegionRuntime?.getState?.() ?? null,
    webgl2: Boolean(document.querySelector('canvas')?.getContext('webgl2')),
    resourceCount: performance.getEntriesByType('resource').length,
    resources: performance.getEntriesByType('resource').map(entry => entry.name)
  }));
  const report = {
    valid: final.ready === true,
    url,
    elapsedMs: Date.now() - startedAt,
    responseStatus,
    navigationError,
    samples,
    final,
    pageErrors,
    consoleMessages,
    requestFailures
  };
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally {
  await browser.close();
}
