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
const consoleErrors=[];
page.on('pageerror',error=>pageErrors.push(error.message));
page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});

try{
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});
  requireValue(response?.ok(),`Iberia page returned ${response?.status()??'no response'}`);
  await page.waitForFunction(()=>window.__WAFT_RUNTIME_011_READY__===true&&window.__WAFT_IBERIA_TERRAIN_0240_READY__===true,null,{timeout:120000});
  await page.waitForTimeout(1500);

  const initial=await page.evaluate(()=>({
    region:window.__WAFT_ADVENTURE_REGION__,
    runtimeReady:window.__WAFT_RUNTIME_011_READY__===true,
    terrainReady:window.__WAFT_IBERIA_TERRAIN_0240_READY__===true,
    runtimeVersion:window.WAFTRegionRuntime?.version,
    metadataRegion:window.WAFTRegionRuntime?.metadata?.regionId,
    metadataName:window.WAFTRegionRuntime?.metadata?.regionName,
    travelNodes:window.WAFTRegionRuntime?.travelGraph?.nodes?.length,
    travelRoutes:window.WAFTRegionRuntime?.travelGraph?.routes?.length,
    localZones:window.WAFTRegionRuntime?.availableZones?.length,
    state:window.WAFTRegionRuntime?.getState(),
    counts:window.WAFTRegionRuntime?.metadata?.counts,
    animals:window.__WAFT_INTERNAL_GAME__?.animals?.length,
    npc:Boolean(window.__WAFT_INTERNAL_GAME__?.npc),
    errorText:document.getElementById('error')?.textContent?.trim()||'',
    canvas:{width:document.querySelector('canvas')?.width||0,height:document.querySelector('canvas')?.height||0},
    webgl2:Boolean(document.querySelector('canvas')?.getContext('webgl2'))
  }));

  requireValue(initial.region==='iberia',`Unexpected Adventure region ${initial.region}`);
  requireValue(initial.runtimeReady&&initial.terrainReady,'Iberia readiness flags are missing');
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
  requireValue(!consoleErrors.some(text=>/Falta el nodo regional|No se pudo abrir el runtime regional/i.test(text)),`Runtime console errors: ${consoleErrors.join(' | ')}`);

  if(screenshot){fs.mkdirSync(path.dirname(screenshot),{recursive:true});await page.screenshot({path:screenshot,type:'png'});}
  console.log(JSON.stringify({valid:true,url,region:initial.metadataName,travelNodes:initial.travelNodes,localZones:initial.localZones,animals:initial.animals,canvas:initial.canvas,movementDistance:Number(movement.distance.toFixed(3)),pageErrors,consoleErrors},null,2));
}finally{
  await context.close();
  await browser.close();
}
