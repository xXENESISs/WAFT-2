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
const orientationState=()=>page.evaluate(()=>{const runtime=WAFTRegionRuntime.getState(),world=WAFTPlanetWorld0270,geo=world.geoFromWorld(runtime.position.x,runtime.position.z),ahead=world.geoFromWorld(runtime.position.x+Math.sin(runtime.playerFacing)*2,runtime.position.z+Math.cos(runtime.playerFacing)*2),p1=geo.lat*Math.PI/180,p2=ahead.lat*Math.PI/180,dl=(ahead.lon-geo.lon)*Math.PI/180,course=Math.atan2(Math.sin(dl)*Math.cos(p2),Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl));return{heading:runtime.playerFacing,cameraYaw:runtime.cameraYaw,course,relativeView:runtime.playerFacing-runtime.cameraYaw,originShifts:world.getState().floatingOriginShifts};});
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
  need(base.selectionProfile==='fixed-geographic-quadtree-v2',`unstable quadtree profile ${JSON.stringify(base)}`);
  need(base.cacheLimit===720&&base.staticTiles===705,`unexpected static planet budget ${JSON.stringify(base)}`);
  need(base.cacheTiles===base.staticTiles&&base.tileBuildsDuringGameplay===0&&base.tileEvictions===0,`planet was not fully resident before gameplay ${JSON.stringify(base)}`);
  need(base.coastlineScale==='50m'&&base.coastlinePolygons===1421,`vector coastline unavailable ${JSON.stringify({scale:base.coastlineScale,polygons:base.coastlinePolygons})}`);
  need(base.visibleTiles>0&&base.atlasTriangles>0,'planet has no visible geometry');
  need(base.residentDesiredTiles===base.desiredTiles&&base.renderTileKeys.length===base.desiredTiles,'initial planet coverage is incomplete');
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
  const beforeRecenterOrientation=await orientationState();
  const entityGeographyBefore=await page.evaluate(()=>Object.fromEntries((window.__WAFT_INTERNAL_GAME__?.animals||[]).map(animal=>[animal.id,WAFTPlanetWorld0270.geoFromWorld(animal.x,animal.z)])));
  const recentered=await page.evaluate(()=>WAFTPlanetWorld0270.recenterAtCurrentPosition());need(recentered,'forced floating-origin recenter did not run');
  await page.waitForFunction(lod=>{const world=WAFTPlanetWorld0270.getState();return world.lodUpdates>lod&&world.residentDesiredTiles===world.desiredTiles&&Boolean(world.anchorTile?.surfaceHash);},beforeRecenter.lodUpdates,{timeout:90000});
  const afterRecenter=await state();
  const afterRecenterOrientation=await orientationState();
  const entityGeographyAfter=await page.evaluate(()=>Object.fromEntries((window.__WAFT_INTERNAL_GAME__?.animals||[]).map(animal=>[animal.id,WAFTPlanetWorld0270.geoFromWorld(animal.x,animal.z)])));
  need(beforeRecenter.anchorTile?.key===afterRecenter.anchorTile?.key,`floating-origin shift changed anchor tile ${beforeRecenter.anchorTile?.key} -> ${afterRecenter.anchorTile?.key}`);
  need(beforeRecenter.anchorTile?.surfaceHash&&beforeRecenter.anchorTile.surfaceHash===afterRecenter.anchorTile?.surfaceHash,`floating-origin shift changed local terrain topology ${JSON.stringify(beforeRecenter.anchorTile)} -> ${JSON.stringify(afterRecenter.anchorTile)}`);
  need(Math.abs(beforeRecenter.anchorTile.lat-afterRecenter.anchorTile.lat)<1e-8&&Math.abs(beforeRecenter.anchorTile.lon-afterRecenter.anchorTile.lon)<1e-8,'floating-origin shift changed geographic position');
  const recenterCourseDelta=Math.atan2(Math.sin(afterRecenterOrientation.course-beforeRecenterOrientation.course),Math.cos(afterRecenterOrientation.course-beforeRecenterOrientation.course));
  const recenterCameraDelta=Math.atan2(Math.sin(afterRecenterOrientation.relativeView-beforeRecenterOrientation.relativeView),Math.cos(afterRecenterOrientation.relativeView-beforeRecenterOrientation.relativeView));
  need(Math.abs(recenterCourseDelta)<.003,`floating-origin shift changed geographic course by ${recenterCourseDelta}`);
  need(Math.abs(recenterCameraDelta)<.003,`floating-origin shift changed bird/camera alignment by ${recenterCameraDelta}`);
  for(const [id,before] of Object.entries(entityGeographyBefore)){
    const after=entityGeographyAfter[id];need(after,`floating-origin shift lost regional entity ${id}`);
    const drift=Math.hypot(after.lat-before.lat,after.lon-before.lon);
    need(drift<1e-5,`floating-origin shift moved regional entity ${id} geographically by ${drift}`);
  }

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
  const flightOrientationBefore=await orientationState();
  const flightGeometryBefore=await state();
  const flapButton=page.locator('#waftJump');
  for(let flap=0;flap<4;flap++){await flapButton.click({timeout:10000});await page.waitForTimeout(320);}
  const sustainedFlight=[];
  for(let sample=0;sample<60;sample++){
    if(sample>0&&sample%15===0)await flapButton.click({timeout:10000});
    await page.waitForTimeout(250);
    const world=await state();
    sustainedFlight.push({desired:world.desiredTiles,resident:world.residentDesiredTiles,rendered:world.renderTileKeys.length,builds:world.tileBuildsDuringGameplay,evictions:world.tileEvictions,queue:world.buildQueue,hash:world.staticGeometryHash,visible:world.visibleTiles});
    need(world.residentDesiredTiles===world.desiredTiles&&world.renderTileKeys.length===world.desiredTiles,`sustained flight exposed incomplete planet coverage at sample ${sample}: ${JSON.stringify(world)}`);
    need(world.tileBuildsDuringGameplay===0&&world.tileEvictions===0&&world.buildQueue===0,`sustained flight mutated planet geometry at sample ${sample}: ${JSON.stringify(world)}`);
    need(world.staticGeometryHash===flightGeometryBefore.staticGeometryHash,`sustained flight changed the physical planet at sample ${sample}`);
    if(sample===19)await page.screenshot({path:path.join(shots,'03a-sustained-flight-5s.png')});
    if(sample===39)await page.screenshot({path:path.join(shots,'03b-sustained-flight-10s.png')});
  }
  await page.screenshot({path:path.join(shots,'03c-sustained-flight-15s.png')});
  const fastFlight=await page.evaluate(()=>{const runtime=WAFTRegionRuntime.getState();return{runtime,world:WAFTPlanetWorld0270.getState(),mount:window.__WAFT_INTERNAL_GAME__?.mountedAnimalId,relativeView:runtime.playerFacing-runtime.cameraYaw};});
  need(fastFlight.mount==='iberia-bearded-vulture','real mounted-flight state was lost');
  need(Math.abs(fastFlight.runtime.adventureCurrentSpeed-276)<1,`vulture speed is not 3x ${fastFlight.runtime.adventureCurrentSpeed}`);
  const relativeCameraDelta=Math.atan2(Math.sin(fastFlight.relativeView-flightOrientationBefore.relativeView),Math.cos(fastFlight.relativeView-flightOrientationBefore.relativeView));
  need(Math.abs(relativeCameraDelta)<.01,`floating origin changed bird/camera alignment by ${relativeCameraDelta}`);
  need(fastFlight.world.floatingOriginShifts>flightOrientationBefore.originShifts,`real flight did not cross a floating origin ${flightOrientationBefore.originShifts} -> ${fastFlight.world.floatingOriginShifts}`);
  need(fastFlight.world.cacheTiles===fastFlight.world.staticTiles,`flight lost immutable planet tiles ${fastFlight.world.cacheTiles}/${fastFlight.world.staticTiles}`);
  const overlayAfterFlight=await page.evaluate(()=>WAFTAdventurePlugin.getRendererState?.());
  need(overlayAfterFlight?.regionalEntitiesDrawn===0,`distant regional entities leaked into planetary flight render ${JSON.stringify(overlayAfterFlight)}`);

  const altitudeProbe=await page.evaluate(async()=>{
    const runtime=WAFTRegionRuntime.getState(),x=runtime.position.x,z=runtime.position.z;
    const waitAnchor=async()=>{for(let attempt=0;attempt<180;attempt++){const value=WAFTPlanetWorld0270.getState();if(value.anchorTile?.surfaceHash)return value;await new Promise(resolve=>setTimeout(resolve,50));}throw new Error('local anchor tile did not become resident');};
    WAFTRegionRuntime.setInput(0,0);WAFTRegionRuntime.setAdventureModifiers({flight:false});WAFTRegionRuntime.setRegionalPosition(x,z,55);WAFTPlanetWorld0270.refreshSelection();
    await new Promise(resolve=>setTimeout(resolve,350));const low=await waitAnchor();
    WAFTRegionRuntime.setRegionalPosition(x,z,900);WAFTPlanetWorld0270.refreshSelection();
    await new Promise(resolve=>setTimeout(resolve,350));const high=await waitAnchor();
    return{low:low.anchorTile,high:high.anchorTile,desiredLow:low.desiredTiles,desiredHigh:high.desiredTiles};
  });
  need(altitudeProbe.low?.key===altitudeProbe.high?.key,`flapping altitude changed local tile identity ${JSON.stringify(altitudeProbe)}`);
  need(altitudeProbe.low?.surfaceHash&&altitudeProbe.low.surfaceHash===altitudeProbe.high?.surfaceHash,`flapping altitude changed terrain surface ${JSON.stringify(altitudeProbe)}`);

  await page.evaluate(()=>WAFTRegionRuntime.setAdventureModifiers({flight:true,mountType:'vulture',flightDive:false}));
  const cameraBefore=await page.evaluate(()=>WAFTRegionRuntime.getState());
  const bounds=await gameCanvas.boundingBox();need(bounds,'game canvas bounds unavailable');
  // Use a long gesture so headless runners that coalesce pointer events still
  // exercise a clearly visible yaw and pitch change at orbital altitude.
  await page.mouse.move(bounds.x+bounds.width*.68,bounds.y+bounds.height*.44);
  await page.mouse.down();await page.mouse.move(bounds.x+bounds.width*.18,bounds.y+bounds.height*.86,{steps:20});await page.mouse.up();
  await page.waitForTimeout(450);
  const cameraAfter=await page.evaluate(()=>WAFTRegionRuntime.getState());
  need(Math.abs(cameraAfter.cameraYaw-cameraBefore.cameraYaw)>.18,`high-altitude yaw did not respond ${cameraBefore.cameraYaw} -> ${cameraAfter.cameraYaw}`);
  need(Math.abs(cameraAfter.cameraPitch-cameraBefore.cameraPitch)>.18,`high-altitude pitch did not respond ${cameraBefore.cameraPitch} -> ${cameraAfter.cameraPitch}`);
  const eyeDistance=Math.hypot(cameraAfter.cameraEye.x-cameraAfter.displayPosition.x,cameraAfter.cameraEye.y-cameraAfter.position.y,cameraAfter.cameraEye.z-cameraAfter.displayPosition.z);
  need(eyeDistance>3&&eyeDistance<7.5,`high-altitude camera detached from bird ${eyeDistance}`);
  await page.screenshot({path:path.join(shots,'03-mounted-flight-high-camera.png')});
  const performanceResult=await frameTrace();
  need(performanceResult.samples>60,`insufficient frame samples ${JSON.stringify(performanceResult)}`);
  need(performanceResult.p95<=120&&performanceResult.max<300&&performanceResult.over100/performanceResult.samples<.12,`flight frame-time budget failed ${JSON.stringify(performanceResult)}`);
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
  // Move away from the upper pitch clamp before testing the opposite orbital
  // gesture; the preceding high-altitude drag can legitimately end at 1.46.
  await page.mouse.move(bounds.x+bounds.width*.52,bounds.y+bounds.height*.86);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width*.52,bounds.y+bounds.height*.38,{steps:12});await page.mouse.up();await page.waitForTimeout(250);
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

  console.log(JSON.stringify({valid:true,version:'0.27.2-experimental',stationary:{terrainFingerprint:base.terrainFingerprint,firstPixelHash:hash(first).slice(0,16),secondPixelHash:hash(second).slice(0,16)},base:{visibleTiles:base.visibleTiles,triangles:base.atlasTriangles,staticTiles:base.staticTiles,cacheTiles:base.cacheTiles,selectionProfile:base.selectionProfile,staticPlanHash:base.staticPlanHash,staticGeometryHash:base.staticGeometryHash,staticBuildMs:base.staticBuildMs},recenter:{stableTileIdentity:true,stableGeographicCourse:true,stableCameraAlignment:true,courseDelta:recenterCourseDelta,cameraDelta:recenterCameraDelta,origin:afterRecenter.originGeo},flight:{speed:fastFlight.runtime.adventureCurrentSpeed,originShifts:fastFlight.world.floatingOriginShifts-flightOrientationBefore.originShifts,relativeCameraDelta,coverageSamples:sustainedFlight.length,minVisible:Math.min(...sustainedFlight.map(sample=>sample.visible)),maxVisible:Math.max(...sustainedFlight.map(sample=>sample.visible)),gameplayTileBuilds:fastFlight.world.tileBuildsDuringGameplay,tileEvictions:fastFlight.world.tileEvictions,altitudeInvariant:altitudeProbe,camera:{yawBefore:cameraBefore.cameraYaw,yawAfter:cameraAfter.cameraYaw,pitchBefore:cameraBefore.cameraPitch,pitchAfter:cameraAfter.cameraPitch,eyeDistance},frames:performanceResult},america:america.geo,orbit:{visibleTiles:orbitState.visibleTiles,triangles:orbitState.atlasTriangles,pixels:orbitPixels,cameraPitch:orbitCameraAfter.cameraPitch},north:north.geo,dateline:dateline.geo,save:{lat:save.lat,lon:save.lon},pageErrors:errors,console:consoleLines},null,2));
}finally{await browser.close();}
