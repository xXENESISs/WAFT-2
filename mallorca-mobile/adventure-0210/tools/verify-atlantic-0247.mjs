import fs from 'node:fs';
import {chromium} from 'playwright-core';
const chrome=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser'].find(fs.existsSync);
if(!chrome)throw new Error('Chrome not found');
const url=process.argv[2];if(!url)throw new Error('URL missing');
const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist','--enable-webgl','--use-gl=angle','--use-angle=swiftshader']});
const context=await browser.newContext({viewport:{width:1280,height:720},hasTouch:true});
const page=await context.newPage();
try{
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});
  if(!response?.ok())throw new Error(`HTTP ${response?.status()}`);
  await page.waitForFunction(()=>window.__WAFT_IBERIA_WORLD_0247_READY__&&window.WAFTWorldContinuity0247&&window.WAFTWorldStreaming0245&&window.WAFTRegionRuntime,{timeout:90000});
  const result=await page.evaluate(async()=>{
    const p=WAFTWorldContinuity0247.worldFromGeo(33.5,-9.2);
    WAFTRegionRuntime.setRegionalPosition(p.x,p.z);WAFTRegionRuntime.setInput(0,0);
    await new Promise(r=>setTimeout(r,900));
    return{target:p,state:WAFTWorldContinuity0247.getState(),runtime:WAFTRegionRuntime.getState(),surface:WAFTWorldStreaming0245.sampleSurface(p.x,p.z)};
  });
  if(result.surface?.streamedRegion!=='atlantic-corridor')throw new Error(`Atlantic surface missing: ${JSON.stringify(result.surface)}`);
  if(!result.state.atlanticReady||result.state.atlanticTriangles<10||result.state.atlanticDrawFrames<1)throw new Error(`Atlantic visible mesh missing: ${JSON.stringify(result.state)}`);
  if(Math.abs(result.runtime.position.x-result.target.x)>2||Math.abs(result.runtime.position.z-result.target.z)>2)throw new Error(`Atlantic position clamped: ${JSON.stringify(result.runtime.position)} target ${JSON.stringify(result.target)}`);
  console.log(JSON.stringify({valid:true,atlantic:result},null,2));
}finally{await context.close();await browser.close();}
