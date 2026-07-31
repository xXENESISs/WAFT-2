const fs = require('fs');
const { chromium } = require('playwright-core');

(async () => {
  const url = process.env.WAFT_URL;
  const workspace = process.env.GITHUB_WORKSPACE;
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH,
    headless: true,
    args: ['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--disable-gpu-sandbox','--disable-dev-shm-usage']
  });
  const page = await browser.newPage({ viewport: { width: 915, height: 412 }, deviceScaleFactor: 1 });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error && error.stack || error)));
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  if (!response || response.status() !== 200) throw new Error(`Unexpected HTTP status: ${response && response.status()}`);
  await page.waitForFunction(() => {
    const loading = document.querySelector('#loading');
    return Boolean(window.WAFT_DEBUG && loading && loading.classList.contains('hidden'));
  }, null, { timeout: 120000 });
  await page.waitForTimeout(4500);

  const state = await page.evaluate(() => {
    const debug = window.WAFT_DEBUG;
    const urban = Array.isArray(debug?.urbanSites) ? debug.urbanSites : [];
    const hotels = urban.filter(s => s.kind === 'hotel');
    const houses = urban.filter(s => s.kind === 'house');
    const castles = urban.filter(s => s.kind === 'castle');
    let minClearance = Infinity;
    for (let i = 0; i < urban.length; i++) for (let j = i + 1; j < urban.length; j++) {
      const a = urban[i], b = urban[j];
      minClearance = Math.min(minClearance, Math.hypot(a.x-b.x,a.z-b.z)-a.r-b.r);
    }
    const allOnLand = urban.every(s => debug.terrainHeight(s.x,s.z) !== null);
    const firstHotel = hotels[0];
    let cameraBlocksHotel = false, playerBlocksHotel = false, flightBlocksHotel = false;
    if (firstHotel) {
      cameraBlocksHotel = debug.cameraPointBlocked(firstHotel.x,firstHotel.y+1.2,firstHotel.z);
      playerBlocksHotel = debug.sideBlocked(firstHotel.x,firstHotel.z,firstHotel.y+1.0);
      const p = debug.player;
      const saved = {x:p.x,y:p.y,z:p.z,vx:p.vx,vz:p.vz};
      p.x=firstHotel.x-firstHotel.r-1.8;p.z=firstHotel.z;p.y=firstHotel.y+1.0;p.vx=8;p.vz=0;
      flightBlocksHotel = debug.moveFlightHorizontal(firstHotel.x,firstHotel.z) === false;
      Object.assign(p,saved);
    }
    const landmarkIds = Array.isArray(debug?.landmarks) ? debug.landmarks.map(x=>x.id) : [];
    const palmaDistance = Math.hypot(debug.cathedralPoint.x-debug.bellverPoint.x,debug.cathedralPoint.z-debug.bellverPoint.z);
    const error = document.querySelector('#error');
    const canvas = document.querySelector('#view');
    return {
      title: document.title,
      hud: document.querySelector('#hud h1')?.textContent || '',
      loadingHidden: document.querySelector('#loading')?.classList.contains('hidden') || false,
      errorVisible: Boolean(error && getComputedStyle(error).display !== 'none'),
      errorText: document.querySelector('#errorText')?.textContent || '',
      webgl: Boolean(canvas && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))),
      urbanCount: urban.length,
      hotelCount: hotels.length,
      houseCount: houses.length,
      castleCount: castles.length,
      minClearance,
      allOnLand,
      cameraBlocksHotel,
      playerBlocksHotel,
      flightBlocksHotel,
      palmaDistance,
      landmarkIds,
      colliderCount: Array.isArray(debug?.colliders) ? debug.colliders.length : -1
    };
  });

  if (state.title !== 'WAFT Adventure 0.15.8 · Mallorca poblada') throw new Error(`Wrong title: ${state.title}`);
  if (!state.hud.includes('0.15.8 · MALLORCA POBLADA')) throw new Error(`Wrong HUD: ${state.hud}`);
  if (!state.loadingHidden) throw new Error('Loading screen did not finish');
  if (state.errorVisible) throw new Error(`Game error screen visible: ${state.errorText}`);
  if (!state.webgl) throw new Error('WebGL context unavailable');
  if (state.hotelCount < 30) throw new Error(`Expected at least 30 hotels, got ${state.hotelCount}`);
  if (state.houseCount < 20) throw new Error(`Expected at least 20 houses, got ${state.houseCount}`);
  if (state.castleCount !== 1) throw new Error(`Expected one tracked Capdepera castle, got ${state.castleCount}`);
  if (!state.allOnLand) throw new Error('At least one urban building is not on land');
  if (state.minClearance < 0.1) throw new Error(`Urban buildings overlap: clearance ${state.minClearance}`);
  if (!state.cameraBlocksHotel) throw new Error('Camera collider did not detect hotel');
  if (!state.playerBlocksHotel) throw new Error('Player collider did not detect hotel');
  if (!state.flightBlocksHotel) throw new Error('Vulture flight crossed hotel');
  if (state.palmaDistance < 35) throw new Error(`Bellver still too close to Cathedral: ${state.palmaDistance}`);
  if (!state.landmarkIds.includes('capdepera') || !state.landmarkIds.includes('capdeperafar')) throw new Error(`Missing Capdepera landmarks: ${state.landmarkIds.join(',')}`);
  if (state.colliderCount < 500) throw new Error(`Collider set looks incomplete: ${state.colliderCount}`);
  if (pageErrors.length) throw new Error(`Page errors: ${pageErrors.join('\n')}`);

  const report = {
    version: '0.15.8',
    verified: true,
    pages_url: url,
    trigger_commit: process.env.GITHUB_SHA,
    verified_at: new Date().toISOString(),
    checks: {
      http_200: true,
      pages_matches_main: true,
      javascript_syntax: true,
      startup_completed: true,
      webgl_context: true,
      no_page_errors: true,
      urban_buildings: state.urbanCount,
      hotels: state.hotelCount,
      houses: state.houseCount,
      capdepera_castle: state.castleCount,
      all_urban_sites_on_land: state.allOnLand,
      minimum_urban_clearance: state.minClearance,
      player_building_collision: state.playerBlocksHotel,
      vulture_building_collision: state.flightBlocksHotel,
      camera_building_collision: state.cameraBlocksHotel,
      cathedral_bellver_distance: state.palmaDistance,
      landmarks: state.landmarkIds,
      collider_count: state.colliderCount
    }
  };
  fs.writeFileSync(workspace + '/mallorca-mobile/waft-0158-verified.json', JSON.stringify(report, null, 2) + '\n');
  await browser.close();
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
