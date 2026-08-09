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
  executablePath:findChrome(),headless:true,
  args:['--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--disable-background-networking']
});
const context=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:1,isMobile:true,hasTouch:true});
const page=await context.newPage();
const pageErrors=[];const consoleMessages=[];const requestFailures=[];const badResponses=[];
page.on('pageerror',error=>pageErrors.push(error.message));
page.on('console',message=>consoleMessages.push({type:message.type(),text:message.text()}));
page.on('requestfailed',request=>requestFailures.push({url:request.url(),failure:request.failure()?.errorText||'unknown'}));
page.on('response',response=>{if(response.status()>=400)badResponses.push({status:response.status(),url:response.url()});});

async function snapshot(){
  return page.evaluate(()=>{
    const panel=document.getElementById('waftIberiaPlaces');
    const rect=panel?.getBoundingClientRect?.();
    const bird=window.__WAFT_INTERNAL_GAME__?.animals?.find?.(item=>item.id==='iberia-bearded-vulture');
    return{
      href:location.href,title:document.title,region:window.__WAFT_ADVENTURE_REGION__??null,
      runtimeReady:window.__WAFT_RUNTIME_011_READY__===true,terrainReady:window.__WAFT_IBERIA_TERRAIN_0240_READY__===true,
      explorerReady:window.__WAFT_IBERIA_EXPLORER_0242_READY__===true,
      explorerError:window.__WAFT_IBERIA_EXPLORER_0242_ERROR__??null,
      runtimePresent:Boolean(window.WAFTRegionRuntime),runtimeVersion:window.WAFTRegionRuntime?.version??null,
      metadataRegion:window.WAFTRegionRuntime?.metadata?.regionId??null,metadataName:window.WAFTRegionRuntime?.metadata?.regionName??null,
      travelNodes:window.WAFTRegionRuntime?.travelGraph?.nodes?.length??null,travelRoutes:window.WAFTRegionRuntime?.travelGraph?.routes?.length??null,
      localZones:window.WAFTRegionRuntime?.availableZones?.length??null,state:window.WAFTRegionRuntime?.getState?.()??null,
      counts:window.WAFTRegionRuntime?.metadata?.counts??null,animals:window.__WAFT_INTERNAL_GAME__?.animals?.length??null,
      bird:bird?{id:bird.id,name:bird.name,mountable:bird.mountable,flightMountReady:bird.flightMountReady,x:bird.x,z:bird.z}:null,
      npc:window.__WAFT_INTERNAL_GAME__?Boolean(window.__WAFT_INTERNAL_GAME__.npc):null,
      settlementCount:window.WAFTIberiaExplorer?.getState?.().settlements??null,
      placeRows:document.querySelectorAll('#waftIberiaPlaces .waftPlace').length,
      placePanel:rect?{width:rect.width,height:rect.height}:null,
      downPresent:Boolean(document.getElementById('down')),
      superJumpReady:Boolean(window.WAFTRegionRuntime?.queueAdventureJump),
      errorDisplay:document.getElementById('error')?.style?.display??null,errorText:document.getElementById('error')?.textContent?.trim()||'',
      loadText:document.getElementById('loadText')?.textContent?.trim()||'',statusText:document.getElementById('status')?.textContent?.trim()||'',
      loadingClass:document.getElementById('loading')?.className??null,bootPresent:Boolean(document.getElementById('boot')),
      canvas:{width:document.querySelector('canvas')?.width||0,height:document.querySelector('canvas')?.height||0},
      webgl2:Boolean(document.querySelector('canvas')?.getContext('webgl2'))
    };
  });
}

try{
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});
  requireValue(response?.ok(),`Iberia page returned ${response?.status()??'no response'}`);
  let initial=null;const deadline=Date.now()+45000;
  while(Date.now()<deadline){
    initial=await snapshot();
    if(initial.runtimeReady&&initial.terrainReady&&initial.explorerReady)break;
    if(initial.errorText||initial.explorerError||pageErrors.length)break;
    await page.waitForTimeout(500);
  }
  initial=await snapshot();
  if(!(initial.runtimeReady&&initial.terrainReady&&initial.explorerReady)){
    if(screenshot){fs.mkdirSync(path.dirname(screenshot),{recursive:true});await page.screenshot({path:screenshot,type:'png'});}
    const diagnostic={valid:false,phase:'boot',url,initial,pageErrors,consoleMessages,requestFailures,badResponses};
    console.error('IBERIA_BROWSER_DIAGNOSTIC '+JSON.stringify(diagnostic,null,2));
    throw new Error(`Iberia did not finish booting: runtime=${initial.runtimeReady} terrain=${initial.terrainReady} explorer=${initial.explorerReady} error=${initial.errorText||initial.explorerError||'none'}`);
  }
  await page.waitForTimeout(1200);initial=await snapshot();
  requireValue(initial.region==='iberia',`Unexpected Adventure region ${initial.region}`);
  requireValue(initial.runtimeVersion==='003',`Unexpected runtime version ${initial.runtimeVersion}`);
  requireValue(initial.metadataRegion==='iberia',`Runtime still points at ${initial.metadataRegion}`);
  requireValue(initial.metadataName==='Península Ibérica',`Unexpected region name ${initial.metadataName}`);
  requireValue(initial.travelNodes===0,`Catalunya travel nodes leaked into Iberia: ${initial.travelNodes}`);
  requireValue(initial.localZones===0,`Local Catalunya zones leaked into Iberia: ${initial.localZones}`);
  requireValue(initial.counts?.settlements>=100,`Too few 20k+ settlement markers: ${initial.counts?.settlements}`);
  requireValue(initial.counts?.buildings===initial.counts?.settlements,`City tower count mismatch: ${initial.counts?.buildings}/${initial.counts?.settlements}`);
  requireValue(initial.animals===1&&!initial.npc,`Expected only the bearded vulture, got animals=${initial.animals} npc=${initial.npc}`);
  requireValue(initial.bird?.name==='Quebrantahuesos'&&initial.bird.mountable&&initial.bird.flightMountReady,'Bearded vulture is not mount-ready');
  requireValue(initial.settlementCount===initial.counts.settlements,`Explorer settlement data mismatch ${initial.settlementCount}/${initial.counts.settlements}`);
  requireValue(initial.placeRows>=1&&initial.placePanel?.width<=200&&initial.placePanel?.height<=180,'Compact place panel is missing or too large');
  requireValue(!initial.downPresent,'Legacy DOWN/respawn control remains active in Iberia');
  requireValue(initial.superJumpReady,'Super jump API is unavailable');
  requireValue(!initial.errorText,`Runtime error box: ${initial.errorText}`);
  requireValue(initial.webgl2,'WebGL2 is not available');
  requireValue(initial.canvas.width>=800&&initial.canvas.height>=350,`Unexpected canvas ${initial.canvas.width}x${initial.canvas.height}`);
  requireValue(initial.state?.worldMode==='regional','Iberia did not start in regional mode');

  const movement=await page.evaluate(async()=>{
    const api=window.WAFTRegionRuntime;api.setRegionalPosition(0,0);await new Promise(r=>setTimeout(r,180));
    const before=api.getState();api.setInput(0,-1);await new Promise(r=>setTimeout(r,650));api.setInput(0,0);await new Promise(r=>setTimeout(r,120));
    const after=api.getState();return{before,after,distance:Math.hypot(after.position.x-before.position.x,after.position.z-before.position.z)};
  });
  requireValue(movement.distance>.15,`Player did not move on Iberia terrain: ${movement.distance}`);

  const respawnGuard=await page.evaluate(async()=>{
    const api=window.WAFTRegionRuntime;api.setRegionalPosition(42,37);await new Promise(r=>setTimeout(r,180));const before=api.getState();api.respawn?.();await new Promise(r=>setTimeout(r,700));const after=api.getState();
    return{distance:Math.hypot(after.position.x-before.position.x,after.position.z-before.position.z),before,after};
  });
  requireValue(respawnGuard.distance<1,`Iberia respawn guard moved the player ${respawnGuard.distance} units`);

  const jumps=await page.evaluate(async()=>{
    const api=window.WAFTRegionRuntime;
    const run=async impulse=>{
      api.setAdventureModifiers({flight:false,mountType:null});api.setRegionalPosition(0,0);api.setInput(0,0);
      await new Promise(r=>setTimeout(r,420));const y0=api.getState().position.y;api.queueAdventureJump(impulse,{horizontalBoost:1});let peak=0;
      for(let i=0;i<28;i++){await new Promise(r=>setTimeout(r,50));peak=Math.max(peak,api.getState().position.y-y0);}
      return peak;
    };
    return{normal:await run(8.8),mega:await run(23.55)};
  });
  requireValue(jumps.mega>jumps.normal*1.65&&jumps.mega>4,`Super jump peak is not strong enough: normal=${jumps.normal} mega=${jumps.mega}`);

  const flight=await page.evaluate(async()=>{
    const api=window.WAFTRegionRuntime,game=window.__WAFT_INTERNAL_GAME__;
    const bird=game.animals.find(item=>item.id==='iberia-bearded-vulture');
    api.setAdventureModifiers({flight:false,mountType:null});api.setInput(0,0);api.setRegionalPosition(bird.x,bird.z);
    await new Promise(r=>setTimeout(r,450));
    const action=document.getElementById('waftAdventureAction');
    const prompt={visible:action?.classList.contains('visible')||false,text:action?.textContent||'',birdReady:bird.flightMountReady};
    action?.click();
    await new Promise(r=>setTimeout(r,420));
    const mounted=api.getState(),mountedId=game.mountedAnimalId;
    api.setAdventureModifiers({flightFlap:10});await new Promise(r=>setTimeout(r,650));
    api.setAdventureModifiers({flightFlap:10});await new Promise(r=>setTimeout(r,520));
    const high=api.getState();
    api.setInput(0,1);await new Promise(r=>setTimeout(r,620));const dive=api.getState();api.setInput(0,0);
    return{prompt,mounted,mountedId,high,dive,drop:high.position.y-dive.position.y};
  });
  requireValue(flight.prompt.visible&&/MONTAR QUEBRANTAHUESOS/i.test(flight.prompt.text),`Bearded vulture mount prompt failed: ${JSON.stringify(flight.prompt)}`);
  requireValue(flight.mountedId==='iberia-bearded-vulture',`Bearded vulture interaction mounted ${flight.mountedId}`);
  requireValue(flight.mounted.adventureMountType==='vulture'&&flight.mounted.movementMode==='flight',`Bearded vulture did not mount into flight mode: mount=${flight.mounted.adventureMountType} mode=${flight.mounted.movementMode}`);
  requireValue(flight.high.position.y>flight.mounted.position.y+4,`Bearded vulture did not climb strongly: ${flight.high.position.y-flight.mounted.position.y}`);
  requireValue(flight.dive.iberiaDive===true,`Joystick-down dive flag was not set`);
  requireValue(flight.dive.adventureCurrentSpeed>=48,`Dive is too slow: ${flight.dive.adventureCurrentSpeed}`);
  requireValue(flight.drop>1.2,`Dive did not descend quickly enough: ${flight.drop}`);

  if(screenshot){fs.mkdirSync(path.dirname(screenshot),{recursive:true});await page.screenshot({path:screenshot,type:'png'});}
  requireValue(pageErrors.length===0,`Page errors: ${pageErrors.join(' | ')}`);
  requireValue(!consoleMessages.some(item=>item.type==='error'&&/Falta el nodo regional|No se pudo abrir el runtime regional|Iberia Explorer 0\.24\.2 failed/i.test(item.text)),`Runtime console errors: ${consoleMessages.filter(item=>item.type==='error').map(item=>item.text).join(' | ')}`);

  console.log(JSON.stringify({valid:true,url,region:initial.metadataName,settlements:initial.counts.settlements,cityTowers:initial.counts.buildings,animals:initial.animals,canvas:initial.canvas,movementDistance:Number(movement.distance.toFixed(3)),respawnGuardDistance:Number(respawnGuard.distance.toFixed(3)),jumpRise:{normal:Number(jumps.normal.toFixed(3)),mega:Number(jumps.mega.toFixed(3))},flight:{climb:Number((flight.high.position.y-flight.mounted.position.y).toFixed(3)),diveDrop:Number(flight.drop.toFixed(3)),diveSpeed:Number(flight.dive.adventureCurrentSpeed.toFixed(1))},pageErrors,consoleErrors:consoleMessages.filter(item=>item.type==='error'),requestFailures,badResponses},null,2));
}finally{
  await context.close();await browser.close();
}
