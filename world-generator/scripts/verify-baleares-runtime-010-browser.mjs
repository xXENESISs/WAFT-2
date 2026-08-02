import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourcePath = path.join(ROOT, 'world-generator/scripts/verify-baleares-runtime-008-browser.mjs');
const temporaryPath = path.join(ROOT, 'world-generator/scripts/.verify-baleares-runtime-010-generated.mjs');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function replaceOnce(source, search, replacement, label) {
  const first = source.indexOf(search);
  assert(first >= 0, `Could not find ${label}`);
  assert(source.indexOf(search, first + search.length) < 0, `${label} is not unique`);
  return source.slice(0, first) + replacement + source.slice(first + search.length);
}

let verifier = fs.readFileSync(sourcePath, 'utf8').replaceAll('008', '010');
verifier = verifier.replace('const VERIFIER_VERSION = 1;', 'const VERIFIER_VERSION = 3;');

verifier = replaceOnce(
  verifier,
  `      availableZones: window.WAFTRegionRuntime.availableZones,
      error: window.__WAFT_RUNTIME_010_ERROR__ ?? null,`,
  `      availableZones: window.WAFTRegionRuntime.availableZones,
      playerMetrics: window.WAFTRegionRuntime.playerMetrics,
      locomotionProbes: window.WAFTRegionRuntime.getLocomotionProbes(),
      error: window.__WAFT_RUNTIME_010_ERROR__ ?? null,`,
  'runtime 010 metrics snapshot'
);

verifier = replaceOnce(
  verifier,
  `    assert(initial.version === '010', \`Expected runtime 010, got \${initial.version}\`);
    assert(initial.webgl2, 'WebGL2 is unavailable');`,
  `    assert(initial.version === '010', \`Expected runtime 010, got \${initial.version}\`);
    assert(initial.playerMetrics?.graphicsProfile === 'enhanced-mobile-v2', \`Unexpected graphics profile: \${initial.playerMetrics?.graphicsProfile}\`);
    assert(initial.playerMetrics.visualScale <= .60 && initial.playerMetrics.visualScale >= .50, \`Unexpected visual scale: \${initial.playerMetrics.visualScale}\`);
    assert(initial.playerMetrics.collisionRadius <= .18 && initial.playerMetrics.collisionRadius < initial.playerMetrics.previousCollisionRadius, \`Player collision radius was not reduced: \${JSON.stringify(initial.playerMetrics)}\`);
    assert(initial.playerMetrics.eyeHeight <= .9, \`Player eye height was not reduced: \${initial.playerMetrics.eyeHeight}\`);
    assert(initial.playerMetrics.terrainAdaptation === true && initial.playerMetrics.swimming === true, 'Terrain adaptation or swimming is disabled');
    assert(initial.playerMetrics.jumpVelocity >= 8.5, \`Jump velocity is too low: \${initial.playerMetrics.jumpVelocity}\`);
    assert(initial.playerMetrics.swimSpeed >= 5, \`Swim speed is too low: \${initial.playerMetrics.swimSpeed}\`);
    assert(initial.locomotionProbes?.mountain?.rise > .15, \`Mountain probe is invalid: \${JSON.stringify(initial.locomotionProbes?.mountain)}\`);
    assert(initial.locomotionProbes?.water?.route === 'Mallorca-Menorca', \`Water route is invalid: \${JSON.stringify(initial.locomotionProbes?.water)}\`);
    assert(initial.webgl2, 'WebGL2 is unavailable');`,
  'runtime 010 locomotion contracts'
);

verifier = replaceOnce(
  verifier,
  `    await page.evaluate(() => window.WAFTRegionRuntime.spawn('alcúdia'));
    await page.waitForTimeout(450);`,
  `    const mountainProbe = initial.locomotionProbes.mountain;
    await page.evaluate(probe => {
      window.WAFTRegionRuntime.setRegionalPosition(probe.start.x, probe.start.z);
      window.WAFTRegionRuntime.setHeading(probe.yaw);
    }, mountainProbe);
    await page.waitForTimeout(350);
    const mountainBefore = await page.evaluate(() => window.WAFTRegionRuntime.getState());
    const mountainMove = await move(page, 0, -1, mountainProbe.suggestedMilliseconds);
    const mountainAfter = mountainMove.after;
    const mountainDistance = Math.hypot(
      mountainAfter.displayPosition.x - mountainBefore.displayPosition.x,
      mountainAfter.displayPosition.z - mountainBefore.displayPosition.z
    );
    const mountainGain = mountainAfter.groundHeight - mountainBefore.groundHeight;
    assert(mountainDistance > .35, \`Mountain movement is too short: \${mountainDistance}\`);
    assert(mountainGain > .05, \`The player did not climb the terrain: \${mountainGain}\`);
    assert(mountainAfter.swimming === false && mountainAfter.movementMode !== 'swimming', 'Mountain probe entered swimming mode');
    assert(Math.abs(mountainAfter.terrainPitch) > .015 || mountainAfter.slopeAngle > .04, \`Character did not adapt to the slope: \${JSON.stringify(mountainAfter)}\`);

    const waterProbe = initial.locomotionProbes.water;
    await page.evaluate(probe => {
      window.WAFTRegionRuntime.setRegionalPosition(probe.start.x, probe.start.z);
      window.WAFTRegionRuntime.setHeading(probe.yaw);
    }, waterProbe);
    await page.waitForTimeout(450);
    const waterBefore = await page.evaluate(() => window.WAFTRegionRuntime.getState());
    assert(waterBefore.swimming === true && waterBefore.movementMode === 'swimming', \`Open water did not activate swimming: \${JSON.stringify(waterBefore)}\`);
    const waterMove = await move(page, 0, -1, waterProbe.suggestedMilliseconds);
    const waterAfter = waterMove.after;
    const waterDistance = Math.hypot(
      waterAfter.displayPosition.x - waterBefore.displayPosition.x,
      waterAfter.displayPosition.z - waterBefore.displayPosition.z
    );
    assert(waterDistance > 1.4, \`Swimming movement is too short: \${waterDistance}\`);
    assert(waterAfter.swimming === true && waterAfter.movementMode === 'swimming', 'The player left swimming mode in open water');
    assert(Math.abs(waterAfter.terrainPitch) > .18, \`Swimming posture did not tilt the character: \${waterAfter.terrainPitch}\`);

    await page.evaluate(() => window.WAFTRegionRuntime.spawn('alcúdia'));
    await page.waitForTimeout(450);`,
  'mountain and open-water movement verification'
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
  `    assert(jumpRise > .15, \`Palma jump rise is too small: \${jumpRise}\`);`,
  `    assert(jumpRise > 1.25, \`Palma high-jump rise is too small: \${jumpRise}\`);`,
  'high jump assertion'
);

verifier = replaceOnce(
  verifier,
  `      canvas: initial.canvas,
      proximity: {`,
  `      canvas: initial.canvas,
      playerMetrics: initial.playerMetrics,
      locomotion: {
        probes: initial.locomotionProbes,
        mountainDistance,
        mountainGain,
        mountainPitch: mountainAfter.terrainPitch,
        mountainSlopeAngle: mountainAfter.slopeAngle,
        waterDistance,
        waterPitch: waterAfter.terrainPitch,
        highJumpRise: jumpRise
      },
      proximity: {`,
  'locomotion verification report'
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
        bilinearTerrainFollowing: true,
        mountainClimbing: true,
        slopeAlignedCharacter: true,
        openWaterSwimming: true,
        mallorcaToMenorcaWaterRoute: true,
        highJump: true,
        registryRequestedAtBoot: true,`,
  'runtime 010 test flags'
);

assert(verifier.includes("runtimeVersion: '010'"), 'Generated verifier does not report runtime 010');
assert(verifier.includes('mountainClimbing: true'), 'Generated verifier lacks mountain verification');
assert(verifier.includes('openWaterSwimming: true'), 'Generated verifier lacks swimming verification');
assert(verifier.includes('Palma high-jump rise'), 'Generated verifier lacks the high-jump assertion');

fs.writeFileSync(temporaryPath, verifier);
const result = spawnSync(process.execPath, [temporaryPath, ...process.argv.slice(2)], {
  cwd: ROOT,
  stdio: 'pipe',
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024
});
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
console.error(`[runtime-010-verifier] status=${result.status} signal=${result.signal || 'none'} error=${result.error?.message || 'none'}`);
if (result.status === 0 && !result.signal && !result.error) fs.rmSync(temporaryPath, { force: true });
else console.error(`[runtime-010-verifier] generated verifier retained at ${temporaryPath}`);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
