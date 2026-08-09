import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

function findChrome(){
  const candidates=[process.env.CHROME_BIN,'/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser'].filter(Boolean);
  for(const candidate of candidates)if(fs.existsSync(candidate))return candidate;
  throw new Error(`Chrome was not found in: ${candidates.join(', ')}`);
}
function requireValue(condition,message){if(!condition)throw new Error(message);}

const url=process.argv[2];
const screenshot=process.argv[3]||null;
if(!url)throw new Error('Usage: node verify-iberia-browser-0241.mjs <url> [screenshot]');

const browser=await chromium.launch({
  executablePath:findChrome(),
  headless:true,
  args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']
});
const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
const page=await context.newPage();
const pageErrors=[];
const consoleMessages=[];
const requestFailures=[];
const badResponses=[];
page.on('pageerror',error=>pageErrors.push(error.message));
page.on('console',message=>consoleMessages.push({type:message.type(),text:message.text()}));
page.on('requestfailed',request=>requestFailures.push({url:request.url(),failure:request.failure()?.errorText||'unknown'}));
page.on('response',response=>{if(response.status()>=400)badResponses.push({status:response.status(),url:response.url()});});

async function snapshot(){
  return page.evaluate(()=>({
    href:location.href,
    title:document.title,
    region:window.__WAFT_ADVENTURE_REGION__??null,
    runtimeReady:window.__WAFT_RUNTIME_011_READY__===true,
    terrainReady:window.__WAFT_IBERIA_TERRAIN_0240_READY__===true,
    runtimePresent:Boolean(window.WAFTRegionRuntime),
    runtimeVersion:window.WAFTRegionRuntime?.version??null,
    metadataRegion:window.WAFTRegionRuntime?.metadata?.regionId??null,
    metadataName:window.WAFTRegionRuntime?.metadata?.regionName??null,
    travelNodes:window.WAFTRegionRuntime?.travelGraph?.nodes?.length??null,
    travelRoutes:window.WAFTRegionRuntime?.travelGraph?.routes?.length??null,
    localZones:window.WAFTRegionRuntime?.availableZones?.length??null,
    state:window.WAFTRegionRuntime?.getState?.()??null,
    counts:window.WAFTRegionRuntime?.metadata?.counts??null,
    animals:window.__WAFT_INTERNAL_GAME__?.animals?.length??null,
    npc:window.__WAFT_INTERNAL_GAME__?Boolean(window.__WAFT_INTERNAL_GAME__.npc):null,
    errorDisplay:document.getElementById('error')?.style?.display??null,
    errorText:document.getElementById('error')?.textContent?.trim()||'',
    loadText:document.getElementById('loadText')?.textContent?.trim()||'',
    statusText:document.getElementById('status')?.textContent?.trim()||'',
    loadingClass:document.getElementById('loading')?.className??null,
    bootPresent:Boolean(document.getElementById('boot')),
    canvas:{width:document.querySelector('canvas')?.width||0,height:document.querySelector('canvas')?.height||0},
    webgl2:Boolean(document.querySelector('canvas')?.getContext('webgl2'))
  }));
}

try{
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});
  requireValue(response?.ok(),`Iberia page returned ${response?.status()??'no response'}`);

  let initial=null;
  const deadline=Date.now()+30000;
  while(Date.now()<deadline){
    initial=await snapshot();
    if(initial.runtimeReady&&initial.terrainReady)break;
    if(initial.errorText||pageErrors.length)break;
    await page.waitForTimeout(500);
  }
  initial=await snapshot();
  if(screenshot){fs.mkdirSync(path.dirname(screenshot),{recursive:true});await page.screenshot({path:screenshot,type:'png'});}

  if(!(initial.runtimeReady&&initial.terrainReady)){
    const diagnostic={
      valid:false,
      phase:'boot',
      url,
      initial,
      pageErrors,
      consoleMessages,
      requestFailures,
      badResponses
    };
    console.error('IBERIA_BROWSER_DIAGNOSTIC '+JSON.stringify(diagnostic,null,2));
    throw new Error(`Iberia did not finish booting: runtimeReady=${initial.runtimeReady} terrainReady=${initial.terrainReady} error=${initial.errorText||'none'} load=${initial.loadText||initial.statusText||'none'}`);
  }

  await page.waitForTimeout(1000);
  initial=await snapshot();
  requireValue(initial.region==='iberia',`Unexpected Adventure region ${initial.region}`);
  requireValue(initial.runtimeVersion==='003',`Unexpected runtime version ${initial.runtimeVersion}`);
  requireValue(initial.metadataRegion==='iberia',`Runtime still points at ${initial.metadataRegion}`);
  requireValue(initial.metadataName==='Península Ibérica',`Unexpected region name ${initial.metadataName}`);
  requireValue(initial.travelNodes===0,`Catalunya travel nodes leaked into Iberia: ${initial.travelNodes}`);
  requireValue(initial.localZones===0,`Local Catalunya zones leaked into Iberia: ${initial.localZones}`);
  requireValue(initial.counts?.buildings===0&&initial.counts?.settlements===0&&initial.counts?.landmarks===0,'Terrain-only package contains populated content');
  requireValue(initial.animals===0&&!initial.npc,'Terrain-only Adventure spawned fauna or NPCs');
  requireValue(!initial.errorText,`Runtime error box: ${initial.errorText}`);
  requireValue(initial.webgl2,'WebGL2 is not available');
  requireValue(initial.canvas.width>=1000&&initial.canvas.height>=600,`Unexpected canvas ${initial.canvas.width}x${initial.canvas.height}`);
  requireValue(initial.state?.worldMode==='regional','Iberia did not start in regional mode');
  requireValue(Number.isFinite(initial.state?.position?.x)&&Number.isFinite(initial.state?.position?.z),'Invalid initial position');

  const movement=await page.evaluate(async()=>{
    window.WAFTRegionRuntime.setRegionalPosition(0,0);
    await new Promise(resolve=>setTimeout(resolve,180));
    const before=window.WAFTRegionRuntime.getState();
    window.WAFTRegionRuntime.setInput(0,-1);
    await new Promise(resolve=>setTimeout(resolve,650));
    window.WAFTRegionRuntime.setInput(0,0);
    await new Promise(resolve=>setTimeout(resolve,120));
    const after=window.WAFTRegionRuntime.getState();
    return{before,after,distance:Math.hypot(after.position.x-before.position.x,after.position.z-before.position.z)};
  });
  requireValue(movement.distance>.15,`Player did not move on Iberia terrain: ${movement.distance}`);
  requireValue(pageErrors.length===0,`Page errors: ${pageErrors.join(' | ')}`);
  requireValue(!consoleMessages.some(item=>item.type==='error'&&/Falta el nodo regional|No se pudo abrir el runtime regional/i.test(item.text)),`Runtime console errors: ${consoleMessages.filter(item=>item.type==='error').map(item=>item.text).join(' | ')}`);

  console.log(JSON.stringify({valid:true,url,region:initial.metadataName,travelNodes:initial.travelNodes,localZones:initial.localZones,animals:initial.animals,canvas:initial.canvas,movementDistance:Number(movement.distance.toFixed(3)),pageErrors,consoleErrors:consoleMessages.filter(item=>item.type==='error'),requestFailures,badResponses},null,2));
}finally{
  await context.close();
  await browser.close();
}
