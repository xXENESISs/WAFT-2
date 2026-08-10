import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';

const need=(v,m)=>{if(!v)throw new Error(m);};
const chrome=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser'].find(fs.existsSync);
if(!chrome)throw new Error('Chrome not found');
const url=process.argv[2],shot=process.argv[3]||null;if(!url)throw new Error('URL missing');
const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist','--enable-webgl','--use-gl=angle','--use-angle=swiftshader']});
const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1,hasTouch:true});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});need(response?.ok(),`HTTP ${response?.status()}`);
  await page.waitForFunction(()=>window.__WAFT_IBERIA_WORLD_0247_READY__&&window.WAFTWorldContinuity0247&&window.WAFTWorldStreaming0245&&window.WAFTRegionRuntime,{timeout:90000});
  await page.waitForTimeout(800);
  const counts=await page.evaluate(async()=>{
    const [ib,fr,ca]=await Promise.all(['iberia','france','canarias'].map(r=>fetch(`../regions/${r}/settlements.json`,{cache:'no-store'}).then(x=>x.json())));
    return{pt:(ib.items||[]).filter(x=>x.countryCode==='PT').length,es:(ib.items||[]).filter(x=>x.countryCode==='ES').length,fr:(fr.items||[]).length,ca:(ca.items||[]).length,api:WAFTWorldContinuity0247.getState()};
  });
  need(counts.pt>=20,`Portugal settlements missing: ${counts.pt}`);need(counts.fr>=450,`France settlements incomplete: ${counts.fr}`);need(counts.ca>=30,`Canarias settlements incomplete: ${counts.ca}`);

  // Cantabria/Galicia latitudes must never be mistaken for France and Iberia must stay resident.
  await page.evaluate(async()=>{const p=WAFTWorldStreaming0245.worldFromGeo(43.42,-4.15);WAFTRegionRuntime.setRegionalPosition(p.x,p.z);WAFTRegionRuntime.setInput(0,0);await WAFTWorldStreaming0245.prefetchFrance();});
  await page.waitForTimeout(900);
  const northSpain=await page.evaluate(()=>({continuity:WAFTWorldContinuity0247.getState(),runtime:WAFTRegionRuntime.getState(),badgeHidden:document.getElementById('waftRegionBadge0247')?.hidden,status:document.getElementById('waftWorldStream0245')?.textContent}));
  need(!northSpain.continuity.inFrance,'Cantabria incorrectly classified as France');
  need(!northSpain.runtime.adventureRegionalTerrainReleased,'Iberia disappeared while still in northern Spain');
  need(northSpain.badgeHidden===true,`France badge visible in Cantabria: ${northSpain.status}`);

  // Just across the Pyrenees, keep Iberia behind us. Only release it after substantial distance.
  await page.evaluate(()=>{const p=WAFTWorldStreaming0245.worldFromGeo(43.05,2.05);WAFTRegionRuntime.setRegionalPosition(p.x,p.z);});await page.waitForTimeout(900);
  const border=await page.evaluate(()=>({c:WAFTWorldContinuity0247.getState(),r:WAFTRegionRuntime.getState()}));
  need(border.c.inFrance,'Pyrenees crossing not classified as France');need(!border.c.deepFrance,'Border crossing already considered deep France');need(!border.r.adventureRegionalTerrainReleased,'Iberia released immediately after crossing France');
  await page.evaluate(()=>{const p=WAFTWorldStreaming0245.worldFromGeo(44.55,2.05);WAFTRegionRuntime.setRegionalPosition(p.x,p.z);});await page.waitForTimeout(900);
  const deep=await page.evaluate(()=>({c:WAFTWorldContinuity0247.getState(),r:WAFTRegionRuntime.getState()}));need(deep.c.deepFrance,'Deep France threshold not reached');need(deep.c.behindReleased||deep.r.adventureRegionalTerrainReleased,'Iberia was not released after substantial distance into France');
  await page.evaluate(()=>{const p=WAFTWorldStreaming0245.worldFromGeo(43.05,2.05);WAFTRegionRuntime.setRegionalPosition(p.x,p.z);});await page.waitForTimeout(900);
  const restored=await page.evaluate(()=>({c:WAFTWorldContinuity0247.getState(),r:WAFTRegionRuntime.getState()}));need(!restored.c.behindReleased&&!restored.r.adventureRegionalTerrainReleased,'Iberia did not restore on returning to the border');

  // Portugal: pick a real generated PT city and prove a point/name marker is produced around it.
  const portugal=await page.evaluate(async()=>{const ib=await fetch('../regions/iberia/settlements.json',{cache:'no-store'}).then(r=>r.json()),city=(ib.items||[]).filter(x=>x.countryCode==='PT').sort((a,b)=>(b.population||0)-(a.population||0))[0];if(!city)throw new Error('No Portuguese city');WAFTRegionRuntime.setRegionalPosition(city.local.x,city.local.z);await new Promise(r=>setTimeout(r,500));return{name:city.name,labels:[...document.querySelectorAll('.waftCity0247 .name')].map(x=>x.textContent)};});
  need(portugal.labels.some(x=>x.includes(portugal.name)),`Portuguese city label missing for ${portugal.name}`);

  // France: validate a real near-Pyrenees settlement in the area the player actually reaches first.
  const france=await page.evaluate(async()=>{const fr=await fetch('../regions/france/settlements.json',{cache:'no-store'}).then(r=>r.json()),pool=(fr.items||[]).filter(x=>x.position?.lat>=42.7&&x.position?.lat<=44.0&&x.position?.lon>=-1&&x.position?.lon<=4),city=pool.sort((a,b)=>Math.hypot(a.position.lat-43.25,a.position.lon-2.0)-Math.hypot(b.position.lat-43.25,b.position.lon-2.0))[0];if(!city)throw new Error('No southern French settlement');const p=WAFTWorldStreaming0245.worldFromGeo(city.position.lat,city.position.lon);WAFTRegionRuntime.setRegionalPosition(p.x,p.z+18);WAFTRegionRuntime.setInput(0,0);await new Promise(r=>setTimeout(r,700));return{name:city.name,labels:[...document.querySelectorAll('.waftCity0247 .name')].map(x=>x.textContent),state:WAFTWorldContinuity0247.getState()};});
  need(france.labels.some(x=>x.includes(france.name)),`French city label missing near Pyrenees for ${france.name}: ${JSON.stringify(france.state)}`);

  // Canarias: prefetch actual package, place player on a real island city and require physical terrain + labels.
  await page.evaluate(()=>WAFTWorldContinuity0247.prefetchCanarias());
  await page.waitForFunction(()=>WAFTWorldContinuity0247.getState().canariasReady,{timeout:60000});
  const canarias=await page.evaluate(async()=>{const ca=await fetch('../regions/canarias/settlements.json',{cache:'no-store'}).then(r=>r.json()),city=(ca.items||[]).sort((a,b)=>(b.population||0)-(a.population||0))[0],p=WAFTWorldContinuity0247.worldFromGeo(city.position.lat,city.position.lon);WAFTRegionRuntime.setRegionalPosition(p.x,p.z);await new Promise(r=>setTimeout(r,700));const state=WAFTWorldContinuity0247.getState(),surface=WAFTWorldStreaming0245.sampleSurface(p.x,p.z);return{name:city.name,state,surface,badge:document.getElementById('waftRegionBadge0247')?.textContent,hidden:document.getElementById('waftRegionBadge0247')?.hidden,labels:[...document.querySelectorAll('.waftCity0247 .name')].map(x=>x.textContent)};});
  need(canarias.state.inCanarias,'Canarias geofence failed');need(canarias.state.canariasTriangles>=140000,`Canarias mesh too small ${canarias.state.canariasTriangles}`);need(canarias.surface?.streamedRegion==='canarias',`Canarias physical surface missing: ${JSON.stringify(canarias.surface)}`);need(canarias.hidden===false&&/CANARIAS/.test(canarias.badge||''),'Canarias badge missing');need(canarias.labels.some(x=>x.includes(canarias.name)),`Canarias city label missing for ${canarias.name}`);
  await page.waitForTimeout(250);need(errors.length===0,`Page errors: ${errors.join(' | ')}`);
  if(shot){fs.mkdirSync(path.dirname(shot),{recursive:true});await page.screenshot({path:shot,type:'png',fullPage:false});}
  console.log(JSON.stringify({valid:true,counts,northSpain,border:{continuity:border.c,released:border.r.adventureRegionalTerrainReleased},deep:{continuity:deep.c,released:deep.r.adventureRegionalTerrainReleased},portugal:portugal.name,france:france.name,canarias:{name:canarias.name,state:canarias.state,badge:canarias.badge,surfaceRegion:canarias.surface?.streamedRegion},errors},null,2));
}finally{await context.close();await browser.close();}
