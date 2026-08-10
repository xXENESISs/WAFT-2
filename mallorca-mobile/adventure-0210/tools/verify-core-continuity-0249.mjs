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
  await page.waitForFunction(()=>window.__WAFT_IBERIA_WORLD_0249_READY__&&window.WAFTWorldUi0249&&window.WAFTWorldContinuity0247&&window.WAFTWorldStreaming0245&&window.WAFTRegionRuntime,{timeout:90000});
  await page.waitForTimeout(850);
  const counts=await page.evaluate(async()=>{
    const [ib,fr,ca]=await Promise.all(['iberia','france','canarias'].map(r=>fetch(`../regions/${r}/settlements.json`,{cache:'no-store'}).then(x=>x.json())));
    const france=(fr.items||[]).map(c=>({name:c.name,...WAFTWorldStreaming0245.worldFromGeo(Number(c.position?.lat),Number(c.position?.lon))})).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.z));
    const xs=france.map(p=>p.x),zs=france.map(p=>p.z);
    return{pt:(ib.items||[]).filter(x=>x.countryCode==='PT').length,fr:france.length,ca:(ca.items||[]).length,franceSpread:{x:Math.max(...xs)-Math.min(...xs),z:Math.max(...zs)-Math.min(...zs),unique:new Set(france.map(p=>`${p.x.toFixed(3)},${p.z.toFixed(3)}`)).size}};
  });
  need(counts.pt>=100,`Portugal settlements missing: ${counts.pt}`);need(counts.fr>=450,`France settlements incomplete: ${counts.fr}`);need(counts.ca>=30,`Canarias settlements incomplete: ${counts.ca}`);
  need(counts.franceSpread.x>1400&&counts.franceSpread.z>1000&&counts.franceSpread.unique>=450,`France city coordinates collapsed: ${JSON.stringify(counts.franceSpread)}`);

  const cantabria=await page.evaluate(async()=>{
    const p=WAFTWorldStreaming0245.worldFromGeo(43.4230,-3.5364);WAFTRegionRuntime.setRegionalPosition(p.x,p.z);WAFTRegionRuntime.setInput(0,0);WAFTWorldUi0249.refresh();
    await WAFTWorldStreaming0245.prefetchFrance();await new Promise(r=>setTimeout(r,650));const before=WAFTWorldStreaming0245.getState().franceDrawFrames;await new Promise(r=>setTimeout(r,650));const after=WAFTWorldStreaming0245.getState().franceDrawFrames;
    return{p,before,after,stream:WAFTWorldStreaming0245.getState(),continuity:WAFTWorldContinuity0247.getState(),runtime:WAFTRegionRuntime.getState(),hud:document.getElementById('hudTitle')?.textContent,oldFrance:getComputedStyle(document.getElementById('waftFranceBadge0246')).display,oldRegion:getComputedStyle(document.getElementById('waftRegionBadge0247')).display};
  });
  need(!cantabria.continuity.inFrance,'Cantabria incorrectly classified as France');need(cantabria.stream.activeRegion==='iberia',`Cantabria active region is ${cantabria.stream.activeRegion}`);need(cantabria.stream.franceVisible===false,'France renderer visible in Cantabria');need(cantabria.before===cantabria.after,`France rendered in Cantabria: ${cantabria.before}->${cantabria.after}`);need(!cantabria.runtime.adventureRegionalTerrainReleased,'Iberia released in Cantabria');need(/PENÍNSULA IBÉRICA/.test(cantabria.hud||''),`Cantabria HUD wrong: ${cantabria.hud}`);need(cantabria.oldFrance==='none'&&cantabria.oldRegion==='none','Legacy region badges visible in Cantabria');
  if(shot){fs.mkdirSync(path.dirname(shot),{recursive:true});await page.screenshot({path:shot,type:'png'});}

  const move=async(lat,lon)=>{await page.evaluate(({lat,lon})=>{const p=WAFTWorldStreaming0245.worldFromGeo(lat,lon);WAFTRegionRuntime.setRegionalPosition(p.x,p.z);WAFTRegionRuntime.setInput(0,0);WAFTWorldUi0249.refresh();},{lat,lon});await page.waitForTimeout(900);return page.evaluate(()=>({continuity:WAFTWorldContinuity0247.getState(),stream:WAFTWorldStreaming0245.getState(),runtime:WAFTRegionRuntime.getState(),hud:document.getElementById('hudTitle')?.textContent}));};
  const border=await move(43.05,2.05);need(border.continuity.inFrance,'Pyrenees crossing not classified as France');need(!border.continuity.deepFrance,'Border already deep France');need(border.stream.franceVisible,'France terrain not visible after real crossing');need(!border.runtime.adventureRegionalTerrainReleased,'Iberia released immediately after crossing');need(border.hud==='FRANCE · MONDE CONTINU',`French HUD wrong: ${border.hud}`);
  const deep=await move(44.55,2.05);need(deep.continuity.deepFrance,'Deep France threshold not reached');need(deep.continuity.behindReleased||deep.runtime.adventureRegionalTerrainReleased,'Iberia not released deep in France');
  const restored=await move(43.05,2.05);need(!restored.continuity.behindReleased&&!restored.runtime.adventureRegionalTerrainReleased,'Iberia not restored on return to border');

  await page.evaluate(()=>WAFTWorldContinuity0247.prefetchCanarias());await page.waitForFunction(()=>WAFTWorldContinuity0247.getState().canariasReady,{timeout:60000});
  const canarias=await page.evaluate(async()=>{const ca=await fetch('../regions/canarias/settlements.json',{cache:'no-store'}).then(r=>r.json()),city=(ca.items||[]).sort((a,b)=>(b.population||0)-(a.population||0))[0],p=WAFTWorldContinuity0247.worldFromGeo(city.position.lat,city.position.lon);WAFTRegionRuntime.setRegionalPosition(p.x,p.z);WAFTWorldUi0249.refresh();await new Promise(r=>setTimeout(r,750));return{name:city.name,state:WAFTWorldContinuity0247.getState(),surface:WAFTWorldStreaming0245.sampleSurface(p.x,p.z),hud:document.getElementById('hudTitle')?.textContent,oldRegion:getComputedStyle(document.getElementById('waftRegionBadge0247')).display};});
  need(canarias.state.inCanarias,'Canarias geofence failed');need(canarias.state.canariasTriangles>=140000,`Canarias mesh incomplete: ${canarias.state.canariasTriangles}`);need(canarias.surface?.streamedRegion==='canarias',`Canarias surface wrong: ${canarias.surface?.streamedRegion}`);need(/CANARIAS/.test(canarias.hud||''),`Canarias HUD wrong: ${canarias.hud}`);need(canarias.oldRegion==='none','Legacy Canarias badge visible');
  need(errors.length===0,`Page errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({valid:true,counts,cantabria:{before:cantabria.before,after:cantabria.after,hud:cantabria.hud},border:{hud:border.hud,released:border.runtime.adventureRegionalTerrainReleased},deep:{released:deep.runtime.adventureRegionalTerrainReleased},restored:{released:restored.runtime.adventureRegionalTerrainReleased},canarias,errors},null,2));
}finally{await context.close();await browser.close();}
