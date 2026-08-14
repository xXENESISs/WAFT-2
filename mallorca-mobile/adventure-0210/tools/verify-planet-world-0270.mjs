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
const relocate=async(lat,lon,y=55)=>{
  await page.evaluate(({lat,lon,y})=>{const point=WAFTPlanetWorld0270.worldFromGeo(lat,lon);WAFTRegionRuntime.setInput(0,0);WAFTRegionRuntime.setRegionalPosition(point.x,point.z,y);},{lat,lon,y});
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

  await page.evaluate(()=>{const runtime=WAFTRegionRuntime.getState();WAFTRegionRuntime.setRegionalPosition(180,0,runtime.position.y);});
  await page.waitForFunction(()=>{const world=WAFTPlanetWorld0270.getState();return world.residentDesiredTiles===world.desiredTiles;},null,{timeout:90000});
  const beforeRecenter=await state();
  const recentered=await page.evaluate(()=>WAFTPlanetWorld0270.recenterAtCurrentPosition());need(recentered,'forced floating-origin recenter did not run');
  await page.waitForFunction(()=>{const world=WAFTPlanetWorld0270.getState();return world.residentDesiredTiles===world.desiredTiles;},null,{timeout:90000});
  const afterRecenter=await state();
  need(JSON.stringify(beforeRecenter.desiredTileKeys)===JSON.stringify(afterRecenter.desiredTileKeys),'floating-origin shift changed planet tile identity');
  need(beforeRecenter.terrainFingerprint===afterRecenter.terrainFingerprint,'floating-origin shift changed terrain topology');

  const america=await relocate(39,-98,75);
  need(Math.abs(america.geo.lat-39)<.2&&Math.abs(america.geo.lon+98)<.3,`America relocation failed ${JSON.stringify(america.geo)}`);
  need(america.surface?.streamedRegion==='planet-global','America did not use global source');
  await page.waitForFunction(()=>{const world=WAFTPlanetWorld0270.getState();return world.residentDesiredTiles===world.desiredTiles&&world.visibleTiles>0;},null,{timeout:90000});
  await page.screenshot({path:path.join(shots,'03-america.png')});

  const orbit=await relocate(39,-98,4200);
  await page.waitForFunction(()=>{const world=WAFTPlanetWorld0270.getState();return world.residentDesiredTiles===world.desiredTiles&&world.visibleTiles>0;},null,{timeout:90000});
  const orbitState=await state();need(orbitState.atlasTriangles>0,'orbital planet disappeared');
  const orbitPixels=await canvasStats();need(orbitPixels.nonSkyRatio>.01,`orbital planet is not visible ${JSON.stringify(orbitPixels)}`);
  await page.screenshot({path:path.join(shots,'04-orbit.png')});

  const north=await relocate(89.5,40,80);need(Math.abs(north.geo.lat-89.5)<.15,'North Pole relocation failed');need(north.surface?.inside,'North Pole has no surface');
  const dateline=await relocate(10,179.7,80);need(dateline.geo.lon>179.2,'dateline relocation failed');need(dateline.surface?.inside,'dateline has no surface');
  const save=await page.evaluate(()=>{WAFTPlanetWorld0270.saveGeographicPosition();return JSON.parse(localStorage.getItem('waft.adventure.0210.planet-location.v1'));});
  need(save?.schemaVersion===1&&Math.abs(save.lat-10)<.2&&save.lon>179.2,`geographic save failed ${JSON.stringify(save)}`);
  need(errors.length===0,`Page errors: ${errors.join(' | ')}; console=${consoleLines.join(' | ')}`);

  console.log(JSON.stringify({valid:true,version:'0.27.0-experimental',stationary:{terrainFingerprint:base.terrainFingerprint,firstPixelHash:hash(first).slice(0,16),secondPixelHash:hash(second).slice(0,16)},base:{visibleTiles:base.visibleTiles,triangles:base.atlasTriangles,cacheTiles:base.cacheTiles},recenter:{stableTileIdentity:true,origin:afterRecenter.originGeo},america:america.geo,orbit:{visibleTiles:orbitState.visibleTiles,triangles:orbitState.atlasTriangles,pixels:orbitPixels},north:north.geo,dateline:dateline.geo,save:{lat:save.lat,lon:save.lon},pageErrors:errors,console:consoleLines},null,2));
}finally{await browser.close();}
