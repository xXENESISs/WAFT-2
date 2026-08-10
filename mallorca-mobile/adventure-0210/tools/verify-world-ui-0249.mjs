import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';

const need=(v,m)=>{if(!v)throw new Error(m);};
const chrome=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser'].find(fs.existsSync);
if(!chrome)throw new Error('Chrome not found');
const url=process.argv[2],shotDir=process.argv[3]||null;if(!url)throw new Error('URL missing');
if(shotDir)fs.mkdirSync(shotDir,{recursive:true});
const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist','--enable-webgl','--use-gl=angle','--use-angle=swiftshader']});
const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1,hasTouch:true});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});need(response?.ok(),`HTTP ${response?.status()}`);
  await page.waitForFunction(()=>window.__WAFT_IBERIA_WORLD_0249_READY__&&window.WAFTWorldUi0249&&window.WAFTWorldStreaming0245&&window.WAFTRegionRuntime,{timeout:90000});
  await page.waitForTimeout(900);

  const uiBase=await page.evaluate(()=>({
    presets:getComputedStyle(document.getElementById('presets')).display,
    oldFrance:document.getElementById('waftFranceBadge0246')?getComputedStyle(document.getElementById('waftFranceBadge0246')).display:'missing',
    oldRegion:document.getElementById('waftRegionBadge0247')?getComputedStyle(document.getElementById('waftRegionBadge0247')).display:'missing',
    nearestOld:getComputedStyle(document.getElementById('nearest')).display,
    labelsRoot:Boolean(document.getElementById('waftWorldLabels0249'))
  }));
  need(uiBase.presets==='none',`Legacy VISITAR presets still visible: ${uiBase.presets}`);
  need(uiBase.oldFrance==='none'&&uiBase.oldRegion==='none',`Duplicate region badges visible: ${JSON.stringify(uiBase)}`);
  need(uiBase.nearestOld==='none'&&uiBase.labelsRoot,'Unified UI did not replace legacy nearest/labels');

  const visit=async(region,nameHint)=>page.evaluate(async({region,nameHint})=>{
    const data=await fetch(`../regions/${region}/settlements.json`,{cache:'no-store'}).then(r=>r.json()),items=data.items||[];
    let city=items.find(x=>x.name===nameHint);if(!city)city=items.slice().sort((a,b)=>(b.population||b.tags?.population||0)-(a.population||a.tags?.population||0))[0];
    if(!city)throw new Error(`No city in ${region}`);
    const p=region==='iberia'?{x:Number(city.local?.x),z:Number(city.local?.z)}:WAFTWorldStreaming0245.worldFromGeo(Number(city.position?.lat),Number(city.position?.lon));
    WAFTRegionRuntime.setRegionalPosition(p.x,p.z);WAFTRegionRuntime.setInput(0,0);WAFTWorldUi0249.refresh();await new Promise(r=>setTimeout(r,950));
    const state=WAFTRegionRuntime.getState(),supplied=WAFT_WORLD_ATLAS_PROVIDER({api:WAFTRegionRuntime,state,defaultItems:[]}),source=supplied?.items||[];
    const expected=source.map(item=>{const w=item._world||item.local;return w&&Number.isFinite(Number(w.x))&&Number.isFinite(Number(w.z))?{name:item.name,d:Math.hypot(Number(w.x)-state.position.x,Number(w.z)-state.position.z),countryCode:item.countryCode||''}:null;}).filter(Boolean).sort((a,b)=>a.d-b.d)[0]||null;
    const samples=[];for(let i=0;i<8;i++){samples.push(document.getElementById('hudTitle')?.textContent||'');await new Promise(r=>setTimeout(r,120));}
    const labels=[...document.querySelectorAll('.waftPlace0249.visible')].map(el=>({name:el.querySelector('b')?.textContent||'',meta:el.querySelector('small')?.textContent||''}));
    return{city:{name:city.name,population:Number(city.population||city.tags?.population)||0},expected,p,actualPosition:state.position,samples,uniqueHud:[...new Set(samples)],nearest:document.getElementById('waftNearest0249')?.textContent||'',labels,ui:WAFTWorldUi0249.getState(),atlas:document.querySelector('#waftIberiaAtlas .list')?.textContent||''};
  },{region,nameHint});

  const france=await visit('france','Carcassonne');
  need(france.uniqueHud.length===1&&france.uniqueHud[0]==='FRANCE · MONDE CONTINU',`French HUD still flickers: ${france.samples.join(' | ')}`);
  need(france.expected&&france.nearest.includes(france.expected.name),`French nearest panel does not match world source: ${JSON.stringify(france.expected)} / ${france.nearest}`);
  need(/hab/.test(france.nearest)&&france.nearest.includes('☠'),`French nearest lacks population/skull: ${france.nearest}`);
  const franceLabel=france.labels.find(x=>x.name===france.expected?.name)||france.labels[0];need(franceLabel,`No French world labels visible near ${france.city.name}`);
  need(/hab/.test(franceLabel.meta)&&franceLabel.meta.includes('☠'),`French label lacks population/skull: ${JSON.stringify(franceLabel)}`);
  need(france.ui.presetsHidden&&france.ui.oldFranceHidden&&france.ui.oldRegionHidden,'Legacy French UI regained visual authority');
  if(shotDir)await page.screenshot({path:path.join(shotDir,'france.png'),type:'png'});

  const portugal=await visit('iberia','Lisbon');
  need(portugal.expected&&portugal.expected.countryCode==='PT',`Portugal probe resolved outside Portugal: ${JSON.stringify(portugal.expected)}`);
  need(portugal.nearest.includes(portugal.expected.name),`Portuguese nearest panel does not match world source: ${JSON.stringify(portugal.expected)} / ${portugal.nearest}`);
  need(/hab/.test(portugal.nearest)&&portugal.nearest.includes('☠'),`Portuguese nearest lacks population/skull: ${portugal.nearest}`);
  const ptLabel=portugal.labels.find(x=>x.name===portugal.expected?.name)||portugal.labels[0];need(ptLabel,`No Portuguese world labels visible near ${portugal.city.name}`);
  need(/hab/.test(ptLabel.meta)&&ptLabel.meta.includes('☠'),`Portuguese label lacks population/skull: ${JSON.stringify(ptLabel)}`);
  need(portugal.uniqueHud.length===1&&/PENÍNSULA IBÉRICA/.test(portugal.uniqueHud[0]),`Portugal HUD unstable: ${portugal.samples.join(' | ')}`);
  if(shotDir)await page.screenshot({path:path.join(shotDir,'portugal.png'),type:'png'});

  const spain=await visit('iberia','Sant Just Desvern');
  need(spain.expected&&spain.expected.countryCode==='ES',`Spain probe resolved outside Spain: ${JSON.stringify(spain.expected)}`);
  need(spain.nearest.includes(spain.expected.name),`Spanish nearest regression: ${JSON.stringify(spain.expected)} / ${spain.nearest}`);
  const esLabel=spain.labels.find(x=>x.name===spain.expected?.name)||spain.labels[0];need(esLabel,'Spanish world labels disappeared');
  need(/hab/.test(esLabel.meta)&&esLabel.meta.includes('☠'),`Spanish label does not share 0.24.9 format: ${JSON.stringify(esLabel)}`);
  if(shotDir)await page.screenshot({path:path.join(shotDir,'spain.png'),type:'png'});

  need(errors.length===0,`Page errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({valid:true,uiBase,france,portugal,spain,errors},null,2));
}finally{await context.close();await browser.close();}
