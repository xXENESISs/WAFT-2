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
  await page.waitForTimeout(800);
  const counts=await page.evaluate(async()=>{
    const [ib,fr,ca]=await Promise.all(['iberia','france','canarias'].map(r=>fetch(`../regions/${r}/settlements.json`,{cache:'no-store'}).then(x=>x.json())));
    return{pt:(ib.items||[]).filter(x=>x.countryCode==='PT').length,es:(ib.items||[]).filter(x=>x.countryCode==='ES').length,fr:(fr.items||[]).length,ca:(ca.items||[]).length,api:WAFTWorldContinuity0247.getState(),ui:WAFTWorldUi0249.getState()};
  });
  need(counts.pt>=100,`Portugal settlements missing: ${counts.pt}`);need(counts.fr>=450,`France settlements incomplete: ${counts.fr}`);need(counts.ca>=30,`Canarias settlements incomplete: ${counts.ca}`);
  need(counts.api.atlasSystem==='shared-iberia','Shared Iberia atlas is not active');need(counts.api.floatingCityLabels===false,'Obsolete floating city labels unexpectedly enabled');
  need(counts.ui.presetsHidden&&counts.ui.oldFranceHidden&&counts.ui.oldRegionHidden,'0.24.9 did not suppress legacy UI');

  const cantabria=await page.evaluate(async()=>{
    const target={lat:43.4230,lon:-3.5364},p=WAFTWorldStreaming0245.worldFromGeo(target.lat,target.lon);
    WAFTRegionRuntime.setRegionalPosition(p.x,p.z);WAFTRegionRuntime.setInput(0,0);WAFTWorldUi0249.refresh();
    await WAFTWorldStreaming0245.prefetchFrance();await new Promise(r=>setTimeout(r,650));
    const before=WAFTWorldStreaming0245.getState().franceDrawFrames;await new Promise(r=>setTimeout(r,650));const after=WAFTWorldStreaming0245.getState().franceDrawFrames;
    const ib=await fetch('../regions/iberia/settlements.json',{cache:'no-store'}).then(r=>r.json());
    const expected=(ib.items||[]).map(c=>({name:c.name,d:Math.hypot(Number(c.local?.x)-p.x,Number(c.local?.z)-p.z)})).sort((a,b)=>a.d-b.d)[0]?.name;
    return{target,p,stream:WAFTWorldStreaming0245.getState(),continuity:WAFTWorldContinuity0247.getState(),runtime:WAFTRegionRuntime.getState(),before,after,expected,atlasTitle:document.querySelector('#waftIberiaAtlas header span')?.textContent,atlasText:document.querySelector('#waftIberiaAtlas .list')?.textContent||'',floating:document.querySelectorAll('.waftCity0247,#waftCityLabels0247').length,legacyBadgeDisplay:getComputedStyle(document.getElementById('waftRegionBadge0247')).display,hud:document.getElementById('hudTitle')?.textContent,nearest:document.getElementById('waftNearest0249')?.textContent||''};
  });
  need(!cantabria.continuity.inFrance,'Cantabria incorrectly classified as France');
  need(cantabria.stream.activeRegion==='iberia',`Streaming core switched Cantabria to ${cantabria.stream.activeRegion}`);
  need(cantabria.stream.franceVisible===false,'French terrain renderer is visible in Cantabria');
  need(cantabria.after===cantabria.before,`French terrain drew in Cantabria: ${cantabria.before} -> ${cantabria.after}`);
  need(!cantabria.runtime.adventureRegionalTerrainReleased,'Iberia disappeared while still in Cantabria');
  need(cantabria.floating===0,`Obsolete floating city overlay survived: ${cantabria.floating}`);
  need(cantabria.legacyBadgeDisplay==='none','Legacy region badge visible in Cantabria');
  need(/PENÍNSULA IBÉRICA/.test(cantabria.hud||''),`Unified Cantabria HUD wrong: ${cantabria.hud}`);
  need(/LUGARES/.test(cantabria.atlasTitle||''),'Established Iberia atlas is not active in Cantabria');
  need(cantabria.expected&&cantabria.atlasText.includes(cantabria.expected),`Atlas distance system does not show nearest Spanish place ${cantabria.expected}: ${cantabria.atlasText}`);
  need(cantabria.expected&&cantabria.nearest.includes(cantabria.expected),`Unified nearest does not show ${cantabria.expected}: ${cantabria.nearest}`);
  if(shot){fs.mkdirSync(path.dirname(shot),{recursive:true});await page.screenshot({path:shot,type:'png',fullPage:false});}

  await page.evaluate(()=>{const p=WAFTWorldStreaming0245.worldFromGeo(43.05,2.05);WAFTRegionRuntime.setRegionalPosition(p.x,p.z);WAFTWorldUi0249.refresh();});await page.waitForTimeout(900);
  const border=await page.evaluate(()=>({c:WAFTWorldContinuity0247.getState(),s:WAFTWorldStreaming0245.getState(),r:WAFTRegionRuntime.getState(),hud:document.getElementById('hudTitle')?.textContent}));
  need(border.c.inFrance,'Pyrenees crossing not classified as France');need(!border.c.deepFrance,'Border crossing already considered deep France');need(!border.r.adventureRegionalTerrainReleased,'Iberia released immediately after crossing France');need(border.s.franceVisible,'France terrain not visible after actual Pyrenees crossing');need(border.hud==='FRANCE · MONDE CONTINU',`French HUD wrong at border: ${border.hud}`);

  await page.evaluate(()=>{const p=WAFTWorldStreaming0245.worldFromGeo(44.55,2.05);WAFTRegionRuntime.setRegionalPosition(p.x,p.z);WAFTWorldUi0249.refresh();});await page.waitForTimeout(900);
  const deep=await page.evaluate(()=>({c:WAFTWorldContinuity0247.getState(),s:WAFTWorldStreaming0245.getState(),r:WAFTRegionRuntime.getState()}));need(deep.c.deepFrance,'Deep France threshold not reached');need(deep.c.behindReleased||deep.r.adventureRegionalTerrainReleased,'Iberia was not released after substantial distance into France');
  await page.evaluate(()=>{const p=WAFTWorldStreaming0245.worldFromGeo(43.05,2.05);WAFTRegionRuntime.setRegionalPosition(p.x,p.z);WAFTWorldUi0249.refresh();});await page.waitForTimeout(900);
  const restored=await page.evaluate(()=>({c:WAFTWorldContinuity0247.getState(),r:WAFTRegionRuntime.getState()}));need(!restored.c.behindReleased&&!restored.r.adventureRegionalTerrainReleased,'Iberia did not restore on returning to the border');

  const portugal=await page.evaluate(async()=>{
    const ib=await fetch('../regions/iberia/settlements.json',{cache:'no-store'}).then(r=>r.json()),pt=(ib.items||[]).filter(x=>x.countryCode==='PT'),city=pt.sort((a,b)=>(b.population||0)-(a.population||0))[0];
    if(!city)throw new Error('No Portuguese city');const p={x:Number(city.local.x),z:Number(city.local.z)};WAFTRegionRuntime.setRegionalPosition(p.x,p.z);WAFTWorldUi0249.refresh();await new Promise(r=>setTimeout(r,650));
    const expected=pt.map(c=>({name:c.name,d:Math.hypot(Number(c.local?.x)-p.x,Number(c.local?.z)-p.z)})).sort((a,b)=>a.d-b.d)[0]?.name;
    return{name:city.name,expected,title:document.querySelector('#waftIberiaAtlas header span')?.textContent,text:document.querySelector('#waftIberiaAtlas .list')?.textContent||'',nearest:document.getElementById('waftNearest0249')?.textContent||'',floating:document.querySelectorAll('.waftCity0247,#waftCityLabels0247').length};
  });
  need(portugal.expected&&portugal.text.includes(portugal.expected),`Nearest Portuguese city missing from established atlas: ${portugal.expected}`);need(portugal.expected&&portugal.nearest.includes(portugal.expected),`Nearest Portuguese city missing from unified nearest: ${portugal.expected} / ${portugal.nearest}`);need(portugal.floating===0,'Portugal fell back to obsolete floating labels');

  const france=await page.evaluate(async()=>{
    const fr=await fetch('../regions/france/settlements.json',{cache:'no-store'}).then(r=>r.json()),items=fr.items||[];
    const points=items.map(c=>({name:c.name,...WAFTWorldStreaming0245.worldFromGeo(Number(c.position?.lat),Number(c.position?.lon))})).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.z));
    const xs=points.map(p=>p.x),zs=points.map(p=>p.z),spread={x:Math.max(...xs)-Math.min(...xs),z:Math.max(...zs)-Math.min(...zs),unique:new Set(points.map(p=>`${p.x.toFixed(3)},${p.z.toFixed(3)}`)).size};
    const anchors=['Brest','Bordeaux','Paris','Strasbourg','Nice','Toulouse'].map(name=>points.find(p=>p.name===name)).filter(Boolean);
    const anchorSeparation=anchors.length>1?Math.max(...anchors.flatMap((a,i)=>anchors.slice(i+1).map(b=>Math.hypot(a.x-b.x,a.z-b.z)))):0;
    const city=items.find(x=>x.name==='Carcassonne')||items.filter(x=>x.position?.lat>=42.7&&x.position?.lat<=44.0).sort((a,b)=>(b.population||0)-(a.population||0))[0];if(!city)throw new Error('No southern French settlement');
    const p=WAFTWorldStreaming0245.worldFromGeo(city.position.lat,city.position.lon);WAFTRegionRuntime.setRegionalPosition(p.x,p.z);WAFTWorldUi0249.refresh();await new Promise(r=>setTimeout(r,700));
    return{name:city.name,title:document.querySelector('#waftIberiaAtlas header span')?.textContent,text:document.querySelector('#waftIberiaAtlas .list')?.textContent||'',nearest:document.getElementById('waftNearest0249')?.textContent||'',hud:document.getElementById('hudTitle')?.textContent,state:WAFTWorldContinuity0247.getState(),physical:WAFTIberiaWorld0246.franceCityCount(),floating:document.querySelectorAll('.waftCity0247,#waftCityLabels0247').length,spread,anchorSeparation,anchors};
  });
  need(france.spread.x>1400,`French east-west city coordinates collapsed: ${france.spread.x.toFixed(1)} world units`);
  need(france.spread.z>1000,`French north-south city coordinates collapsed: ${france.spread.z.toFixed(1)} world units`);
  need(france.spread.unique>=450,`French cities share collapsed coordinates: ${france.spread.unique}/${counts.fr} unique`);
  need(france.anchorSeparation>900,`Named French anchors are unrealistically compressed: ${france.anchorSeparation.toFixed(1)} world units`);
  need(/FRANCE/.test(france.title||''),`France did not reuse shared atlas: ${france.title}`);need(france.text.includes(france.name),`French city missing from shared atlas: ${france.name} / ${france.text}`);need(france.nearest.includes(france.name),`French city missing from unified nearest: ${france.nearest}`);need(france.hud==='FRANCE · MONDE CONTINU',`French HUD unstable: ${france.hud}`);need(france.physical>=450,`French physical city markers incomplete: ${france.physical}`);need(france.floating===0,'France still uses obsolete floating city labels');

  await page.evaluate(()=>WAFTWorldContinuity0247.prefetchCanarias());
  await page.waitForFunction(()=>WAFTWorldContinuity0247.getState().canariasReady,{timeout:60000});
  const canarias=await page.evaluate(async()=>{const ca=await fetch('../regions/canarias/settlements.json',{cache:'no-store'}).then(r=>r.json()),city=(ca.items||[]).sort((a,b)=>(b.population||0)-(a.population||0))[0],p=WAFTWorldContinuity0247.worldFromGeo(city.position.lat,city.position.lon);WAFTRegionRuntime.setRegionalPosition(p.x,p.z);WAFTWorldUi0249.refresh();await new Promise(r=>setTimeout(r,700));const state=WAFTWorldContinuity0247.getState(),runtime=WAFTRegionRuntime.getState(),surface=WAFTWorldStreaming0245.sampleSurface(p.x,p.z);return{name:city.name,state,runtimePosition:runtime.position,surface,oldBadgeDisplay:getComputedStyle(document.getElementById('waftRegionBadge0247')).display,hud:document.getElementById('hudTitle')?.textContent,title:document.querySelector('#waftIberiaAtlas header span')?.textContent,text:document.querySelector('#waftIberiaAtlas .list')?.textContent||'',nearest:document.getElementById('waftNearest0249')?.textContent||'',floating:document.querySelectorAll('.waftCity0247,#waftCityLabels0247').length};});
  const canChecks={stateGeofence:canarias.state.inCanarias,mesh:canarias.state.canariasTriangles>=140000,surface:canarias.surface?.streamedRegion==='canarias',unifiedHud:canarias.oldBadgeDisplay==='none'&&/CANARIAS/.test(canarias.hud||''),atlas:/CANARIAS/.test(canarias.title||'')&&canarias.text.includes(canarias.name),nearest:canarias.nearest.includes(canarias.name),noFloating:canarias.floating===0};
  need(Object.values(canChecks).every(Boolean),`Canarias integration failed ${JSON.stringify({checks:canChecks,canarias})}`);
  await page.waitForTimeout(250);need(errors.length===0,`Page errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({valid:true,counts,cantabria,border:{continuity:border.c,stream:border.s,released:border.r.adventureRegionalTerrainReleased,hud:border.hud},deep:{continuity:deep.c,stream:deep.s,released:deep.r.adventureRegionalTerrainReleased},portugal:{target:portugal.name,nearest:portugal.expected},france:{name:france.name,physical:france.physical,spread:france.spread,anchorSeparation:france.anchorSeparation,anchors:france.anchors,hud:france.hud},canarias:{name:canarias.name,state:canarias.state,hud:canarias.hud,surfaceRegion:canarias.surface?.streamedRegion},errors},null,2));
}finally{await context.close();await browser.close();}
