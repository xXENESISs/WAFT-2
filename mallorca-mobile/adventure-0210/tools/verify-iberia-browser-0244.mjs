import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';
const need=(v,m)=>{if(!v)throw new Error(m);};
const chrome=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser'].find(fs.existsSync);if(!chrome)throw new Error('Chrome not found');
const url=process.argv[2],screenshot=process.argv[3]||null;if(!url)throw new Error('Usage: verify-iberia-browser-0244.mjs <url> [screenshot]');
const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--disable-background-networking']});
const context=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:1,isMobile:true,hasTouch:true});const page=await context.newPage();const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
try{
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});need(response?.ok(),`HTTP ${response?.status()}`);
  await page.waitForFunction(()=>window.__WAFT_RUNTIME_011_READY__&&window.__WAFT_IBERIA_TERRAIN_0240_READY__&&window.__WAFT_IBERIA_EXPLORER_0242_READY__&&window.__WAFT_IBERIA_POLISH_0243_READY__&&window.__WAFT_IBERIA_WORLD_0244_READY__,{timeout:60000});await page.waitForTimeout(800);
  const initial=await page.evaluate(()=>({
    build:window.__WAFT_ADVENTURE_BUILD__,region:window.__WAFT_ADVENTURE_REGION__,world:window.WAFTIberiaWorld0244?.getState?.(),counts:window.WAFTRegionRuntime?.metadata?.counts,
    coords:document.getElementById('waftIberiaCoords')?.textContent||'',atlas:Boolean(document.getElementById('waftIberiaAtlas')),oldPlaces:getComputedStyle(document.getElementById('waftIberiaPlaces')).display,
    worldMarks:document.querySelectorAll('.waftWorldMark').length,error:document.getElementById('error')?.textContent?.trim()||'',webgl2:Boolean(document.querySelector('canvas')?.getContext('webgl2'))
  }));
  need(initial.build==='0.24.4'&&initial.region==='iberia','Wrong build/region');need(initial.counts?.settlements>=365,`Too few Iberia settlements ${initial.counts?.settlements}`);need(initial.world?.specials?.includes('Ayódar')&&initial.world.specials.includes('Peñíscola')&&initial.world.specials.includes('Gibraltar'),'Special places missing');need(initial.atlas&&initial.oldPlaces==='none'&&initial.worldMarks>=3,'Atlas/special markers not installed');need(/^ALT .* m · LAT -?\d+\.\d{4} · LON -?\d+\.\d{4}$/.test(initial.coords),'Coordinates invalid');need(initial.webgl2&&!initial.error,'Runtime invalid');
  const flight=await page.evaluate(async()=>{const api=WAFTRegionRuntime,game=__WAFT_INTERNAL_GAME__,wait=ms=>new Promise(r=>setTimeout(r,ms));const bird=game.animals.find(a=>a.id==='iberia-bearded-vulture');api.setAdventureModifiers({flight:false,mountType:null});api.setRegionalPosition(bird.x,bird.z);await wait(350);document.getElementById('waftAdventureAction')?.click();await wait(350);const start=api.getState();api.setAdventureModifiers({flightFlap:3.8});await wait(600);const one=api.getState();await wait(800);const levelA=api.getState();await wait(800);const levelB=api.getState();for(let i=0;i<4;i++){api.setAdventureModifiers({flightFlap:3.8});await wait(400);}const diveStart=api.getState();api.setInput(0,1);await wait(520);const dive=api.getState();api.setInput(0,0);return{climb:one.position.y-start.position.y,drift:Math.abs(levelB.position.y-levelA.position.y),drop:diveStart.position.y-dive.position.y,speed:dive.adventureCurrentSpeed,dive:dive.iberiaDive};});
  need(flight.climb>5.2,`Single flap still weak: ${flight.climb}`);need(flight.drift<.35,`Level flight drift ${flight.drift}`);need(flight.dive&&flight.speed>=48&&flight.drop>5,`Dive regression ${JSON.stringify(flight)}`);
  if(screenshot){fs.mkdirSync(path.dirname(screenshot),{recursive:true});await page.screenshot({path:screenshot,type:'png'});}need(pageErrors.length===0,`Page errors: ${pageErrors.join(' | ')}`);
  console.log(JSON.stringify({valid:true,settlements:initial.counts.settlements,specials:initial.world.specials,flight,pageErrors},null,2));
}finally{await context.close();await browser.close();}
