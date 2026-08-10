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
  need(counts.pt>=100,`Portugal settlements missing: ${counts.pt}`);need(counts.fr>=450,`France settlements incomplete: ${counts.fr}`);need(counts.ca>=30,`Canarias settlements incomplete: ${counts.ca}`);
  need(counts.api.atlasSystem==='shared-iberia','Shared Iberia atlas is not active');need(counts.api.floatingCityLabels===false,'Floating city labels unexpectedly enabled');

  // Exact regression reported from Android: Cantabria at 43.4230, -3.5364 must remain pure Iberia even after France is prefetched.
  const cantabria=await page.evaluate(async()=>{
    const target={lat:43.4230,lon:-3.5364},p=WAFTWorldStreaming0245.worldFromGeo(target.lat,target.lon);
    WAFTRegionRuntime.setRegionalPosition(p.x,p.z);WAFTRegionRuntime.setInput(0,0);
    await WAFTWorldStreaming0245.prefetchFrance();await new Promise(r=>setTimeout(r,650));
    const before=WAFTWorldStreaming0245.getState().franceDrawFrames;await new Promise(r=>setTimeout(r,650));const after=WAFTWorldStreaming0245.getState().franceDrawFrames;
    const ib=await fetch('../regions/iberia/settlements.json',{cache:'no-store'}).then(r=>r.json());
    const expected=(ib.items||[]).map(c=>({name:c.name,d:Math.hypot(Number(c.local?.x)-p.x,Number(c.local?.z)-p.z)})).sort((a,b)=>a.d-b.d)[0]?.name;
    return{target,p,stream:WAFTWorldStreaming0245.getState(),continuity:WAFTWorldContinuity0247.getState(),runtime:WAFTRegionRuntime.getState(),before,after,expected,atlasTitle:document.querySelector('#waftIberiaAtlas header span')?.textContent,atlasText:document.querySelector('#waftIberiaAtlas .list')?.textContent||'',floating:document.querySelectorAll('.waftCity0247,#waftCityLabels0247').length,badgeHidden:document.getElementById('waftRegionBadge0247')?.hidden};
  });
  need(!cantabria.continuity.inFrance,'Cantabria incorrectly classified as France');
  need(cantabria.stream.activeRegion==='iberia',`Streaming core switched Cantabria to ${cantabria.stream.activeRegion}`);
  need(cantabria.stream.franceVisible===false,'French terrain renderer is visible in Cantabria');
  need(cantabria.after===cantabria.before,`French terrain drew in Cantabria: ${cantabria.before} -> ${cantabria.after}`);
  need(!cantabria.runtime.adventureRegionalTerrainReleased,'Iberia disappeared while still in Cantabria');
  need(cantabria.floating===0,`Floating city overlay survived: ${cantabria.floating}`);
  need(cantabria.badgeHidden===true,'France badge visible in Cantabria');
  need(/LUGARES/.test(cantabria.atlasTitle||''),'Established Iberia atlas is not active in Cantabria');
  need(cantabria.expected&&cantabria.atlasText.includes(cantabria.expected),`Atlas distance system does not show nearest Spanish place ${cantabria.expected}: ${cantabria.atlasText}`);
  if(shot){fs.mkdirSync(path.dirname(shot),{recursive:true});await page.screenshot({path:shot,type:'png',fullPage:false});}

  await page.evaluate(()=>{const p=WAFTWorldStreaming0245.worldFromGeo(43.05,2.05);WAFTRegionRuntime.setRegionalPosition(p.x,p.z);});await page.waitForTimeout(900);
  const border=await page.evaluate(()=>({c:WAFTWorldContinuity0247.getState(),s:WAFTWorldStreaming0245.getState(),r:WAFTRegionRuntime.getState()}));
  need(border.c.inFrance,'Pyrenees crossing not classified as France');need(!border.c.deepFrance,'Border crossing already considered deep France');need(!border.r.adventureRegionalTerrainReleased,'Iberia released immediately after crossing France');need(border.s.franceVisible,'France terrain not visible after actual Pyrenees crossing');

  await page.evaluate(()=>{const p=WAFTWorldStreaming0245.worldFromGeo(44.55,2.05);WAFTRegionRuntime.setRegionalPosition(p.x,p.z);});await page.waitForTimeout(900);
  const deep=await page.evaluate(()=>({c:WAFTWorldContinuity0247.getState(),s:WAFTWorldStreaming0245.getState(),r:WAFTRegionRuntime.getState()}));need(deep.c.deepFrance,'Deep France threshold not reached');need(deep.c.behindReleased||deep.r.adventureRegionalTerrainReleased,'Iberia was not released after substantial distance into France');
  await page.evaluate(()=>{const p=WAFTWorldStreaming0245.worldFromGeo(43.05,2.05);WAFTRegionRuntime.setRegionalPosition(p.x,p.z);});await page.waitForTimeout(900);
  const restored=await page.evaluate(()=>({c:WAFTWorldContinuity0247.getState(),r:WAFTRegionRuntime.getState()}));need(!restored.c.behindReleased&&!restored.r.adventureRegionalTerrainReleased,'Iberia did not restore on returning to the border');

  const portugal=await page.evaluate(async()=>{const ib=await fetch('../regions/iberia/settlements.json',{cache:'no-store'}).then(r=>r.json()),city=(ib.items||[]).filter(x=>x.countryCode==='PT').sort((a,b)=>(b.population||0)-(a.population||0))[0];if(!city)throw new Error('No Portuguese city');WAFTRegionRuntime.setRegionalPosition(city.local.x,city.local.z);await new Promise(r=>setTimeout(r,650));return{name:city.name,title:document.querySelector('#waftIberiaAtlas header span')?.textContent,text:document.querySelector('#waftIberiaAtlas .list')?.textContent||'',floating:document.querySelectorAll('.waftCity0247,#waftCityLabels0247').length};});
  need(portugal.text.includes(portugal.name),`Portuguese city missing from established atlas: ${portugal.name}`);need(portugal.floating===0,'Portugal fell back to floating labels');

  const france=await page.evaluate(async()=>{const fr=await fetch('../regions/france/settlements.json',{cache:'no-store'}).then(r=>r.json()),city=(fr.items||[]).find(x=>x.name==='Carcassonne')||(fr.items||[]).filter(x=>x.position?.lat>=42.7&&x.position?.lat<=44.0).sort((a,b)=>(b.population||0)-(a.population||0))[0];if(!city)throw new Error('No southern French settlement');const p=WAFTWorldStreaming0245.worldFromGeo(city.position.lat,city.position.lon);WAFTRegionRuntime.setRegionalPosition(p.x,p.z);await new Promise(r=>setTimeout(r,700));return{name:city.name,title:document.querySelector('#waftIberiaAtlas header span')?.textContent,text:document.querySelector('#waftIberiaAtlas .list')?.textContent||'',state:WAFTWorldContinuity0247.getState(),physical:WAFTIberiaWorld0246.franceCityCount(),floating:document.querySelectorAll('.waftCity0247,#waftCityLabels0247').length};});
  need(/FRANCE/.test(france.title||''),`France did not reuse shared atlas: ${france.title}`);need(france.text.includes(france.name),`French city missing from shared atlas: ${france.name} / ${france.text}`);need(france.physical>=450,`French physical city markers incomplete: ${france.physical}`);need(france.floating===0,'France still uses floating city labels');

  await page.evaluate(()=>WAFTWorldContinuity0247.prefetchCanarias());
  await page.waitForFunction(()=>WAFTWorldContinuity0247.getState().canariasReady,{timeout:60000});
  const canarias=await page.evaluate(async()=>{const ca=await fetch('../regions/canarias/settlements.json',{cache:'no-store'}).then(r=>r.json()),city=(ca.items||[]).sort((a,b)=>(b.population||0)-(a.population||0))[0],p=WAFTWorldContinuity0247.worldFromGeo(city.position.lat,city.position.lon);WAFTRegionRuntime.setRegionalPosition(p.x,p.z);await new Promise(r=>setTimeout(r,700));const state=WAFTWorldContinuity0247.getState(),runtime=WAFTRegionRuntime.getState(),surface=WAFTWorldStreaming0245.sampleSurface(p.x,p.z);return{name:city.name,state,runtimePosition:runtime.position,surface,badge:document.getElementById('waftRegionBadge0247')?.textContent,hidden:document.getElementById('waftRegionBadge0247')?.hidden,title:document.querySelector('#waftIberiaAtlas header span')?.textContent,text:document.querySelector('#waftIberiaAtlas .list')?.textContent||'',floating:document.querySelectorAll('.waftCity0247,#waftCityLabels0247').length};});
  const canChecks={stateGeofence:canarias.state.inCanarias,mesh:canarias.state.canariasTriangles>=140000,surface:canarias.surface?.streamedRegion==='canarias',badge:canarias.hidden===false&&/CANARIAS/.test(canarias.badge||''),atlas:/CANARIAS/.test(canarias.title||'')&&canarias.text.includes(canarias.name),noFloating:canarias.floating===0};
  need(Object.values(canChecks).every(Boolean),`Canarias integration failed ${JSON.stringify({checks:canChecks,canarias})}`);
  await page.waitForTimeout(250);need(errors.length===0,`Page errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({valid:true,counts,cantabria,border:{continuity:border.c,stream:border.s,released:border.r.adventureRegionalTerrainReleased},deep:{continuity:deep.c,stream:deep.s,released:deep.r.adventureRegionalTerrainReleased},portugal:portugal.name,france:{name:france.name,physical:france.physical},canarias:{name:canarias.name,state:canarias.state,badge:canarias.badge,surfaceRegion:canarias.surface?.streamedRegion},errors},null,2));
}finally{await context.close();await browser.close();}
