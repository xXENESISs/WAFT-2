import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourcePath = path.join(ROOT, 'world-generator/scripts/verify-baleares-runtime-008-browser.mjs');
const temporaryPath = path.join(ROOT, 'world-generator/scripts/.verify-baleares-runtime-009-generated.mjs');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function replaceOnce(source, search, replacement, label) {
  const first = source.indexOf(search);
  assert(first >= 0, `Could not find ${label}`);
  assert(source.indexOf(search, first + search.length) < 0, `${label} is not unique`);
  return source.slice(0, first) + replacement + source.slice(first + search.length);
}

let verifier = fs.readFileSync(sourcePath, 'utf8').replaceAll('008', '009');
verifier = verifier.replace('const VERIFIER_VERSION = 1;', 'const VERIFIER_VERSION = 2;');

verifier = replaceOnce(
  verifier,
  `      availableZones: window.WAFTRegionRuntime.availableZones,
      error: window.__WAFT_RUNTIME_009_ERROR__ ?? null,`,
  `      availableZones: window.WAFTRegionRuntime.availableZones,
      playerMetrics: window.WAFTRegionRuntime.playerMetrics,
      error: window.__WAFT_RUNTIME_009_ERROR__ ?? null,`,
  'player metrics snapshot'
);

verifier = replaceOnce(
  verifier,
  `    assert(initial.version === '009', \`Expected runtime 009, got \${initial.version}\`);
    assert(initial.webgl2, 'WebGL2 is unavailable');`,
  `    assert(initial.version === '009', \`Expected runtime 009, got \${initial.version}\`);
    assert(initial.playerMetrics?.graphicsProfile === 'enhanced-mobile-v1', \`Unexpected graphics profile: \${initial.playerMetrics?.graphicsProfile}\`);
    assert(initial.playerMetrics.visualScale <= .60 && initial.playerMetrics.visualScale >= .50, \`Unexpected visual scale: \${initial.playerMetrics.visualScale}\`);
    assert(initial.playerMetrics.collisionRadius <= .18 && initial.playerMetrics.collisionRadius < initial.playerMetrics.previousCollisionRadius, \`Player collision radius was not reduced: \${JSON.stringify(initial.playerMetrics)}\`);
    assert(initial.playerMetrics.eyeHeight <= .9, \`Player eye height was not reduced: \${initial.playerMetrics.eyeHeight}\`);
    assert(initial.webgl2, 'WebGL2 is unavailable');`,
  'smaller player and graphics assertions'
);

verifier = replaceOnce(
  verifier,
  `    assert(palmaLocal.collisionProbe, 'Palma collision probe failed');
    assert(palmaLocal.hud.includes('LOCAL PALMA'), \`Palma HUD is wrong: \${palmaLocal.hud}\`);

    const palmaYaw`,
  `    assert(palmaLocal.collisionProbe, 'Palma collision probe failed');
    assert(palmaLocal.hud.includes('LOCAL PALMA'), \`Palma HUD is wrong: \${palmaLocal.hud}\`);
    const narrowPassage = await page.evaluate(() => window.WAFTRegionRuntime.probeNarrowPassage());
    assert(narrowPassage, 'Palma contains no verified reduced-collider passage');
    assert(narrowPassage.newClear === true && narrowPassage.oldBlocked === true && narrowPassage.tangentClear === true, \`Reduced-collider passage is invalid: \${JSON.stringify(narrowPassage)}\`);
    assert(narrowPassage.newRadius === initial.playerMetrics.collisionRadius, 'Passage probe does not use the new collision radius');
    assert(narrowPassage.oldRadius === initial.playerMetrics.previousCollisionRadius, 'Passage probe does not compare against the old collision radius');
    assert(narrowPassage.clearanceDisplay > narrowPassage.newRadius && narrowPassage.clearanceDisplay < narrowPassage.oldRadius, \`Passage clearance is outside the expected interval: \${JSON.stringify(narrowPassage)}\`);

    const palmaYaw`,
  'Palma reduced-collider passage verification'
);

verifier = replaceOnce(
  verifier,
  `      canvas: initial.canvas,
      proximity: {`,
  `      canvas: initial.canvas,
      playerMetrics: initial.playerMetrics,
      proximity: {`,
  'player metrics report'
);

verifier = replaceOnce(
  verifier,
  `        palma: {
          buildId: palmaLocal.metadata.buildId,`,
  `        palma: {
          narrowPassage,
          buildId: palmaLocal.metadata.buildId,`,
  'narrow passage report'
);

verifier = replaceOnce(
  verifier,
  `      tests: {
        registryRequestedAtBoot: true,`,
  `      tests: {
        smallerPlayerVisualScale: true,
        reducedPlayerCollider: true,
        narrowPalmaPassage: true,
        enhancedMobileGraphics: true,
        registryRequestedAtBoot: true,`,
  'runtime 009 test report'
);

assert(verifier.includes("runtimeVersion: '009'"), 'Generated verifier does not report runtime 009');
assert(verifier.includes('narrowPalmaPassage: true'), 'Generated verifier lacks the narrow-passage test');
assert(verifier.includes("graphicsProfile === 'enhanced-mobile-v1'"), 'Generated verifier lacks the graphics-profile assertion');

fs.writeFileSync(temporaryPath, verifier);
const result = spawnSync(process.execPath, [temporaryPath, ...process.argv.slice(2)], {
  cwd: ROOT,
  stdio: 'inherit'
});
fs.rmSync(temporaryPath, { force: true });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
