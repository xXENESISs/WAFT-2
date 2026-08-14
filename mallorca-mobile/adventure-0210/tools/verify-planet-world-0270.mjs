import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const need=(condition,message)=>{if(!condition)throw new Error(message);};
const chrome=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(fs.existsSync);
if(!chrome)throw new Error('Chrome missing');
const url=process.argv[2];
if(!url)throw new Error('URL missing');
const shots=path.resolve('artifacts/world-0270');fs.mkdirSync(shots,{recursive:true});
const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist','--enable-webgl','--use-gl=angle','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1394,height:654}}),errors=[],consoleLines=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(['error','warning'].includes(message.type()))consoleLines.push(`${message.type()}: ${message.text()}`);});

const state=()=>page.evaluate(()=>window.WAFTPlanetWorld0270?.getState?.()||null);
const canvasStats=()=>page.evaluate(async()=>{
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const source=document.querySelector('canvas'),target=document.createElement('canvas');target.width=source.width;target.height=source.height;
  const context=target.getContext('2d',{willReadFrequently:true});context.drawImage(source,0,0);const pixels=context.getImageData(0,0,target.width,target.height).data;
  let sampled=0,nonSky=0;
  for(let index=0;index<pixels.length;index+=16){sampled++;const red=pixels[index],green=pixels[index+1],blue=pixels[index+2];if(Math.abs(red-99)+Math.abs(green-142)+Math.abs(blue-167)>28)nonSky++;}
  return{sampled,nonSky,nonSkyRatio:nonSky/Math.max(1,sampled)};
});
const startFrameTrace=()=>page.evaluate(()=>{
  window.__WAFT_0271_FRAME_TRACE__=[];
  let previous=performance.now();
  const tick=now=>{window.__WAFT_0271_FRAME_TRACE__.push(now-previous);previous=now;if(window.__WAFT_0271_FRAME_TRACE__.length<900)requestAnimationFrame(tick);};
  requestAnimationFrame(tick);
});
const frameTrace=()=>page.evaluate(()=>{
  const values=(window.__WAFT_0271_FRAME_TRACE__||[]).filter(value=>Number.isFinite(value)&&value>=0).sort((a,b)=>a-b);
  const percentile=p=>values[Math.min(values.length-1,Math.floor(values.length*p))]||0;
  return{samples:values.length,p50:percentile(.50),p95:percentile(.95),p99:percentile(.99),max:values.at(-1)||0,over100:values.filter(value=>value>100).length};
});
const relocate=async(lat,lon,y=55)=>{
  await page.evaluate(({lat,lon,y})=>{const point=WAFTPlanetWorld0270.worldFromGeo(lat,lon);WAFTRegionRuntime.setInput(0,0);WAFTRegionRuntime.setRegionalPosition(point.x,point.z,y);WAFTPlanetWorld0270.refreshSelection();},{lat,lon,y});
  await page.waitForTimeout(1200);
  return page.evaluate(()=>{const runtime=WAFTRegionRuntime.getState(),world=WAFTPlanetWorld0270.getState();return{geo:WAFTPlanetWorld0270.geoFromWorld(runtime.position.x,runtime.position.z),runtime,world,surface:WAFTPlanetWorld0270.sampleSurface(runtime.position.x,runtime.position.z)};});
};

try{
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});need(response?.ok(),`HTTP ${response?.status()}`);
  await page.waitForFunction(()=>window.__WAFT_PLANET_WORLD_0270_READY__&&window.WAFTPlanetWorld0270?.getState?.().ready,null,{timeout:90000});
  await page.evaluate(()=>{window.__WAFT_PLANET_DEBUG_ISOLATE__=true;WAFTAdventurePlugin.hideBaseCharacter=true;});
  await page.waitForFunction(()=>{const world=WAFTPlanetWorld0270?.getState?.();return world?.desiredTiles>0&&world.residentDesiredTiles===world.desiredTiles&&world.renderTileKeys.length===world.desiredTiles;},null,{timeout:90000});
  await page.waitForTimeout(500);

  const base=await state();
  need(base?.renderMode==='cube-sphere-quadtree',`wrong renderer ${JSON.stringify(base)}`);
  need(base.selectionProfile==='stable-geographic-rings-v1',`unstable LOD profile ${JSON.stringify(base)}`);
  need(base.cacheLimit===384,`unexpected cache budget ${JSON.stringify(base)}`);
  need(base.coastlineScale==='50m'&&base.coastlinePolygons===1421,`vector coastline unavailable ${JSON.stringify({scale:base.coastlineScale,polygons:base.coastlinePolygons})}`);
  need(base.visibleTiles>0&&base.atlasTriangles>0,'planet has no visible geometry');
  need(base.desiredTileKeys.length===new Set(base.desiredTileKeys).size,'duplicate planet tile IDs');
  const gameCanvas=page.locator('canvas').first();
  const first=await gameCanvas.screenshot({path:path.join(shots,'01-stationary-a.png')});
  await page.waitForTimeout(3000);
  const second=await gameCanvas.screenshot({path:path.join(shots,'02-stationary-b.png')});
  const hash=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
  const stationary=await state();
  need(base.terrainFingerprint===stationary.terrainFingerprint,`stationary terrain topology changed ${base.terrainFingerprint} -> ${stationary.terrainFingerprint}`);

  const keysBeforeRotation=(await state()).desiredTileKeys;
  await page.evaluate(()=>WAFTRegionRuntime.setHeading((WAFTRegionRuntime.getState().playerFacing||0)+Math.PI*.75));
  await page.waitForTimeout(1200);
  const keysAfterRotation=(await state()).desiredTileKeys;
  need(JSON.stringify(keysBeforeRotation)===JSON.stringify(keysAfterRotation),'camera heading changed planet tile identity');
  need(base.terrainFingerprint===(await state()).terrainFingerprint,'camera heading changed terrain topology');

  const lodBeforeMove=(await state()).lodUpdates;
  await page.evaluate(()=>{const runtime=WAFTRegionRuntime.getState();WAFTRegionRuntime.setRegionalPosition(180,0,runtime.position.y);WAFTPlanetWorld0270.refreshSelection();});
  await page.waitForFunction(lod=>{const world=WAFTPlanetWorld0270.getState();return world.lodUpdates>lod&&world.residentDesiredTiles===world.desiredTiles&&Boolean(world.anchorTile?.surfaceHash);},lodBeforeMove,{timeout:90000});
  const beforeRecenter=await state();
  const recentered=await page.evaluate(()=>WAFTPlanetWorld0270.recenterAtCurrentPosition());need(recentered,'forced floating-origin recenter did not run');
  await page.waitForFunction(lod=>{const world=WAFTPlanetWorld0270.getState();return world.lodUpdates>lod&&world.residentDesiredTiles===world.desiredTiles&&Boolean(world.anchorTile?.surfaceHash);},beforeRecenter.lodUpdates,{timeout:90000});
  const afterRecenter=await state();
  need(beforeRecenter.anchorTile?.key===afterRecenter.anchorTile?.key,`floating-origin shift changed anchor tile ${beforeRecenter.anchorTile?.key} -> ${afterRecenter.anchorTile?.key}`);
  need(beforeRecenter.anchorTile?.surfaceHash&&beforeRecenter.anchorTile.surfaceHash===afterRecenter.anchorTile?.surfaceHash,`floating-origin shift changed local terrain topology ${JSON.stringify(beforeRecenter.anchorTile)} -> ${JSON.stringify(afterRecenter.anchorTile)}`);
  need(Math.abs(beforeRecenter.anchorTile.lat-afterRecenter.anchorTile.lat)<1e-8&&Math.abs(beforeRecenter.anchorTile.lon-afterRecenter.anchorTile.lon)<1e-8,'floating-origin shift changed geographic position');

  const bermuda=await page.evaluate(()=>{const world=WAFTPlanetWorld0270,island=world.worldFromGeo(32.3,-64.75),ocean=world.worldFromGeo(32.3,-65);return{island:world.sampleSurface(island.x,island.z),ocean:world.sampleSurface(ocean.x,ocean.z)};});
  need(bermuda.island.land&&!bermuda.ocean.land,`50m island coastline failed ${JSON.stringify(bermuda)}`);

  // Real mounted-flight sequence: use the actual bird, movement controls, flap button and canvas drag.
  await page.waitForFunction(()=>window.__WAFT_INTERNAL_GAME__?.animals?.some?.(animal=>animal.id==='iberia-bearded-vulture'),null,{timeout:30000});
  await page.evaluate(()=>{
    const game=window.__WAFT_INTERNAL_GAME__,bird=game?.animals?.find?.(animal=>animal.id==='iberia-bearded-vulture');
    if(!game||!bird)throw new Error('Bearded vulture unavailable');
    game.mountedAnimalId=bird.id;bird.hidden=true;
    WAFTAdventurePlugin.hideBaseCharacter=true;window.__WAFT_PLANET_DEBUG_ISOLATE__=false;
    WAFTRegionRuntime.setAdventureModifiers({flight:true,mountType:'vulture',flightDive:false});
    WAFTRegionRuntime.setInput(0,-1);
  });
  await page.waitForTimeout(300);
  await startFrameTrace();
  const flightOrientationBefore=await page.evaluate(()=>{const runtime=WAFTRegionRuntime.getState();return{heading:runtime.playerFacing,cameraYaw:runtime.cameraYaw};});
  const flapButton=page.locator('#waftJump');
  for(let flap=0;flap<4;flap++){await flapButton.click({timeout:10000});await page.waitForTimeout(320);}
  await page.waitForTimeout(450);
  const fastFlight=await page.evaluate(()=>({runtime:WAFTRegionRuntime.getState(),world:WAFTPlanetWorld0270.getState(),mount:window.__WAFT_INTERNAL_GAME__?.mountedAnimalId}));
  need(fastFlight.mount==='iberia-bearded-vulture','real mounted-flight state was lost');
  need(Math.abs(fastFlight.runtime.adventureCurrentSpeed-276)<1,`vulture speed is not 3x ${fastFlight.runtime.adventureCurrentSpeed}`);
  const headingDelta=Math.atan2(Math.sin(fastFlight.runtime.playerFacing-flightOrientationBefore.heading),Math.cos(fastFlight.runtime.playerFacing-flightOrientationBefore.heading));
  need(Math.abs(headingDelta)<.03,`floating origin changed flight direction by ${headingDelta}`);
  const passiveCameraYawDelta=Math.atan2(Math.sin(fastFlight.runtime.cameraYaw-flightOrientationBefore.cameraYaw),Math.cos(fastFlight.runtime.cameraYaw-flightOrientationBefore.cameraYaw));
  need(Math.abs(passiveCameraYawDelta)<.01,`flight changed camera direction by ${passiveCameraYawDelta}`);
  need(fastFlight.world.cacheTiles<=fastFlight.world.cacheLimit,`flight cache overflow ${fastFlight.world.cacheTiles}/${fastFlight.world.cacheLimit}`);

  const altitudeProbe=await page.evaluate(async()=>{
    const runtime=WAFTRegionRuntime.getState(),x=runtime.position.x,z=runtime.position.z;
    const waitAnchor=async()=>{for(let attempt=0;attempt<180;attempt++){const value=WAFTPlanetWorld0270.getState();if(value.anchorTile?.surfaceHash)return value;await new Promise(resolve=>setTimeout(resolve,50));}throw new Error('local anchor tile did not become resident');};
    WAFTRegionRuntime.setInput(0,0);WAFTRegionRuntime.setRegionalPosition(x,z,55);WAFTPlanetWorld0270.refreshSelection();
    await new Promise(resolve=>setTimeout(resolve,350));const low=await waitAnchor();
    WAFTRegionRuntime.setRegionalPosition(x,z,900);WAFTPlanetWorld0270.refreshSelection();
    await new Promise(resolve=>setTimeout(resolve,350));const high=await waitAnchor();
    return{low:low.anchorTile,high:high.anchorTile,desiredLow:low.desiredTiles,desiredHigh:high.desiredTiles};
  });
  need(altitudeProbe.low?.key===altitudeProbe.high?.key,`flapping altitude changed local tile identity ${JSON.stringify(altitudeProbe)}`);
  need(altitudeProbe.low?.surfaceHash&&altitudeProbe.low.surfaceHash===altitudeProbe.high?.surfaceHash,`flapping altitude changed terrain surface ${JSON.stringify(altitudeProbe)}`);

  const cameraBefore=await page.evaluate(()=>WAFTRegionRuntime.getState());
  const bounds=await gameCanvas.boundingBox();need(bounds,'game canvas bounds unavailable');
  await page.mouse.move(bounds.x+bounds.width*.54,bounds.y+bounds.height*.52);
  await page.mouse.down();await page.mouse.move(bounds.x+bounds.width*.30,bounds.y+bounds.height*.82,{steps:12});await page.mouse.up();
  await page.waitForTimeout(450);
  const cameraAfter=await page.evaluate(()=>WAFTRegionRuntime.getState());
  need(Math.abs(cameraAfter.cameraYaw-cameraBefore.cameraYaw)>.25,`high-altitude yaw did not respond ${cameraBefore.cameraYaw} -> ${cameraAfter.cameraYaw}`);
  need(Math.abs(cameraAfter.cameraPitch-cameraBefore.cameraPitch)>.25,`high-altitude pitch did not respond ${cameraBefore.cameraPitch} -> ${cameraAfter.cameraPitch}`);
  const eyeDistance=Math.hypot(cameraAfter.cameraEye.x-cameraAfter.displayPosition.x,cameraAfter.cameraEye.y-cameraAfter.position.y,cameraAfter.cameraEye.z-cameraAfter.displayPosition.z);
  need(eyeDistance>3&&eyeDistance<7.5,`high-altitude camera detached from bird ${eyeDistance}`);
  await page.screenshot({path:path.join(shots,'03-mounted-flight-high-camera.png')});
  const performanceResult=await frameTrace();
  need(performanceResult.samples>60,`insufficient frame samples ${JSON.stringify(performanceResult)}`);
  need(performanceResult.p95<140&&performanceResult.max<900,`flight frame-time budget failed ${JSON.stringify(performanceResult)}`);
  await page.evaluate(()=>{
    const game=window.__WAFT_INTERNAL_GAME__,bird=game?.animals?.find?.(animal=>animal.id==='iberia-bearded-vulture');
    if(bird)bird.hidden=false;if(game)game.mountedAnimalId=null;
    WAFTRegionRuntime.setInput(0,0);WAFTRegionRuntime.setAdventureModifiers({flight:false,mountType:null,flightDive:false});window.__WAFT_PLANET_DEBUG_ISOLATE__=true;
  });

  const america=await relocate(39,-98,75);
  need(Math.abs(america.geo.lat-39)<.2&&Math.abs(america.geo.lon+98)<.3,`America relocation failed ${JSON.stringify(america.geo)}`);
  need(america.surface?.streamedRegion==='planet-global','America did not use global source');
  await page.waitForFunction(()=>{const world=WAFTPlanetWorld0270.getState();return world.residentDesiredTiles===world.desiredTiles&&world.visibleTiles>0;},null,{timeout:90000});
  await page.screenshot({path:path.join(shots,'04-america.png')});

  const orbit=await relocate(32.3,-64.75,4200);
  await page.waitForFunction(()=>{const world=WAFTPlanetWorld0270.getState();return world.residentDesiredTiles===world.desiredTiles&&world.visibleTiles>0;},null,{timeout:90000});
  const orbitState=await state();need(orbitState.atlasTriangles>0,'orbital planet disappeared');
  const orbitPixels=await canvasStats();need(orbitPixels.nonSkyRatio>.01,`orbital planet is not visible ${JSON.stringify(orbitPixels)}`);
  const orbitCameraBefore=await page.evaluate(()=>WAFTRegionRuntime.getState());
  await page.mouse.move(bounds.x+bounds.width*.52,bounds.y+bounds.height*.48);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width*.52,bounds.y+bounds.height*.90,{steps:10});await page.mouse.up();await page.waitForTimeout(350);
  const orbitCameraAfter=await page.evaluate(()=>WAFTRegionRuntime.getState());
  need(orbitCameraAfter.cameraPitch>orbitCameraBefore.cameraPitch,`orbital camera pitch did not respond ${orbitCameraBefore.cameraPitch} -> ${orbitCameraAfter.cameraPitch}`);
  await page.screenshot({path:path.join(shots,'05-orbit.png')});

  const north=await relocate(89.5,40,80);need(Math.abs(north.geo.lat-89.5)<.15,'North Pole relocation failed');need(north.surface?.inside,'North Pole has no surface');
  const dateline=await relocate(10,179.7,80);need(dateline.geo.lon>179.2,'dateline relocation failed');need(dateline.surface?.inside,'dateline has no surface');
  const save=await page.evaluate(()=>{WAFTPlanetWorld0270.saveGeographicPosition();return JSON.parse(localStorage.getItem('waft.adventure.0210.planet-location.v1'));});
  need(save?.schemaVersion===1&&Math.abs(save.lat-10)<.2&&save.lon>179.2,`geographic save failed ${JSON.stringify(save)}`);
  need(errors.length===0,`Page errors: ${errors.join(' | ')}; console=${consoleLines.join(' | ')}`);

  console.log(JSON.stringify({valid:true,version:'0.27.1-experimental',stationary:{terrainFingerprint:base.terrainFingerprint,firstPixelHash:hash(first).slice(0,16),secondPixelHash:hash(second).slice(0,16)},base:{visibleTiles:base.visibleTiles,triangles:base.atlasTriangles,cacheTiles:base.cacheTiles,cacheLimit:base.cacheLimit,selectionProfile:base.selectionProfile},recenter:{stableTileIdentity:true,stableHeading:true,stableCameraDirection:true,origin:afterRecenter.originGeo},flight:{speed:fastFlight.runtime.adventureCurrentSpeed,headingDelta,passiveCameraYawDelta,altitudeInvariant:altitudeProbe,camera:{yawBefore:cameraBefore.cameraYaw,yawAfter:cameraAfter.cameraYaw,pitchBefore:cameraBefore.cameraPitch,pitchAfter:cameraAfter.cameraPitch,eyeDistance},frames:performanceResult},america:america.geo,orbit:{visibleTiles:orbitState.visibleTiles,triangles:orbitState.atlasTriangles,pixels:orbitPixels,cameraPitch:orbitCameraAfter.cameraPitch},north:north.geo,dateline:dateline.geo,save:{lat:save.lat,lon:save.lon},pageErrors:errors,console:consoleLines},null,2));
}finally{await browser.close();}
