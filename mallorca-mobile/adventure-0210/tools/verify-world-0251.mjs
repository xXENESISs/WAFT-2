import fs from 'node:fs';
import {chromium} from 'playwright-core';
const need=(v,m)=>{if(!v)throw new Error(m)};
const chrome=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(fs.existsSync);if(!chrome)throw new Error('Chrome missing');
const url=process.argv[2];if(!url)throw new Error('URL missing');
const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist','--enable-webgl','--use-gl=angle','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1394,height:654}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
  const r=await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});need(r?.ok(),`HTTP ${r?.status()}`);
  await page.waitForFunction(()=>window.__WAFT_IBERIA_WORLD_0250_READY__&&window.WAFTWorld0250&&window.WAFTWorldStreaming0245&&window.WAFTRegionRuntime,{timeout:90000});await page.waitForTimeout(700);
  const scale=await page.evaluate(()=>{const p=WAFTWorldStreaming0245.worldFromGeo;return{u:WAFTWorld0250.getState().scale,m:p(40.4168,-3.7038),b:p(41.3874,2.1686),w:p(38.7,-9.5),e:p(50,40)}});
  const mb=Math.hypot(scale.m.x-scale.b.x,scale.m.z-scale.b.z),europe=Math.hypot(scale.w.x-scale.e.x,scale.w.z-scale.e.z);
  need(Math.abs(scale.u-.30)<.001,`scale ${scale.u}`);need(mb>145&&mb<165,`Madrid-Barcelona ${mb}`);need(europe<1500,`Europe reference ${europe}`);
  const france=await page.evaluate(async()=>{await WAFTWorldStreaming0245.prefetchFrance();const p=WAFTWorldStreaming0245.worldFromGeo(43.152,1.033);WAFTRegionRuntime.setRegionalPosition(p.x,p.z);await new Promise(r=>setTimeout(r,650));return{s:WAFTWorldStreaming0245.getState(),c:document.getElementById('waftIberiaCoords')?.textContent||'',l:[...document.querySelectorAll('.waftPlace0250.visible')].length}});
  need(france.s.franceVisible===false,'France overlap visible');need(france.c.includes('LAT 43.1520')&&france.c.includes('LON 1.0330'),'France coords wrong');need(france.l===0,'Remote labels visible');
  await page.evaluate(()=>WAFTWorld0250.prefetchAfrica());await page.waitForFunction(()=>WAFTWorld0250.getState().africaReady,{timeout:120000});
  const africa=await page.evaluate(async()=>{const data=await fetch('../../regions/northwest-africa/settlements.json').then(r=>r.json()),city=(data.items||[]).find(x=>/Tang/i.test(x.name))||(data.items||[])[0],p=WAFTWorldStreaming0245.worldFromGeo(city.position.lat,city.position.lon);WAFTRegionRuntime.setRegionalPosition(p.x,p.z);await new Promise(r=>setTimeout(r,650));return{surface:WAFTWorldStreaming0245.sampleSurface(p.x,p.z),state:WAFTWorld0250.getState(),hud:document.getElementById('hudTitle')?.textContent||''}});
  need(africa.surface?.streamedRegion==='northwest-africa'&&africa.surface.land,'Africa land missing');need(africa.state.africaTriangles>400000,'Africa mesh regressed');need(/ÁFRICA/.test(africa.hud),'Africa HUD missing');
  const ocean=await page.evaluate(async()=>{const p=WAFTWorldStreaming0245.worldFromGeo(30.2,-14);WAFTRegionRuntime.setRegionalPosition(p.x,p.z);await new Promise(r=>setTimeout(r,450));return{surface:WAFTWorldStreaming0245.sampleSurface(p.x,p.z),labels:[...document.querySelectorAll('.waftPlace0250.visible')].length}});need(ocean.surface?.streamedRegion==='atlantic-ocean'&&!ocean.surface.land,'Atlantic lost');need(ocean.labels===0,'Ocean labels visible');
  await page.evaluate(()=>WAFTWorldContinuity0247.prefetchCanarias());await page.waitForFunction(()=>WAFTWorldContinuity0247.getState().canariasReady,{timeout:60000});const can=await page.evaluate(async()=>{const p=WAFTWorldStreaming0245.worldFromGeo(28.1,-15.42);WAFTRegionRuntime.setRegionalPosition(p.x,p.z);await new Promise(r=>setTimeout(r,500));return{surface:WAFTWorldStreaming0245.sampleSurface(p.x,p.z),tri:WAFTWorldContinuity0247.getState().canariasTriangles}});need(can.surface?.streamedRegion==='canarias'&&can.tri>140000,'Canarias lost');
  need(errors.length===0,errors.join(' | '));console.log(JSON.stringify({valid:true,unitsPerKm:scale.u,madridBarcelonaWorldUnits:mb,europeReferenceSpan:europe,france,africa,ocean,canarias:can,errors},null,2));
}finally{await browser.close()}
