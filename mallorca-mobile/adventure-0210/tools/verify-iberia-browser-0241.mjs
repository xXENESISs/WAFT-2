import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const need=(value,message)=>{if(!value)throw new Error(message);};
const chrome=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser'].find(fs.existsSync);
if(!chrome)throw new Error('Chrome not found');
const url=process.argv[2],screenshot=process.argv[3]||null;
if(!url)throw new Error('Usage: verify-iberia-browser-0241.mjs <url> [screenshot]');

const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--disable-background-networking']});
const context=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:1,isMobile:true,hasTouch:true});
const page=await context.newPage();
const pageErrors=[],consoleErrors=[],requestFailures=[],badResponses=[];
page.on('pageerror',e=>pageErrors.push(e.message));
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
page.on('requestfailed',r=>requestFailures.push({url:r.url(),failure:r.failure()?.errorText||'unknown'}));
page.on('response',r=>{if(r.status()>=400)badResponses.push({status:r.status(),url:r.url()});});

async function snap(){return page.evaluate(()=>{
  const api=window.WAFTRegionRuntime,game=window.__WAFT_INTERNAL_GAME__,state=api?.getState?.();
  const bird=game?.animals?.find?.(a=>a.id==='iberia-bearded-vulture');
  const panel=document.getElementById('waftIberiaPlaces')?.getBoundingClientRect?.();
  const jump=document.getElementById('waftJump'),help=document.getElementById('help'),telemetry=document.getElementById('waftFlightTelemetry');
  return{
    region:window.__WAFT_ADVENTURE_REGION__??null,runtimeReady:window.__WAFT_RUNTIME_011_READY__===true,
    terrainReady:window.__WAFT_IBERIA_TERRAIN_0240_READY__===true,explorerReady:window.__WAFT_IBERIA_EXPLORER_0242_READY__===true,polishReady:window.__WAFT_IBERIA_POLISH_0243_READY__===true,
    explorerError:window.__WAFT_IBERIA_EXPLORER_0242_ERROR__??null,polishError:window.__WAFT_IBERIA_POLISH_0243_ERROR__??null,
    runtimeVersion:api?.version??null,metadataRegion:api?.metadata?.regionId??null,metadataName:api?.metadata?.regionName??null,
    travelNodes:api?.travelGraph?.nodes?.length??null,localZones:api?.availableZones?.length??null,state,counts:api?.metadata?.counts??null,
    animals:game?.animals?.length??null,npc:game?Boolean(game.npc):null,
    bird:bird?{name:bird.name,mountable:bird.mountable,flightMountReady:bird.flightMountReady,x:bird.x,y:bird.y,z:bird.z}:null,
    settlements:window.WAFTIberiaExplorer?.getState?.().settlements??null,rows:document.querySelectorAll('#waftIberiaPlaces .waftPlace').length,
    panel:panel?{width:panel.width,height:panel.height}:null,down:Boolean(document.getElementById('down')),
    coords:document.getElementById('waftIberiaCoords')?.textContent?.trim()||'',help:help?getComputedStyle(help).display:null,
    telemetry:Boolean(telemetry),telemetryDisplay:telemetry?getComputedStyle(telemetry).display:null,jumpSelect:jump?getComputedStyle(jump).userSelect:null,
    error:document.getElementById('error')?.textContent?.trim()||'',canvas:{width:document.querySelector('canvas')?.width||0,height:document.querySelector('canvas')?.height||0},
    webgl2:Boolean(document.querySelector('canvas')?.getContext('webgl2'))
  };
});}

try{
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});need(response?.ok(),`HTTP ${response?.status()}`);
  let initial;const deadline=Date.now()+45000;
  while(Date.now()<deadline){initial=await snap();if(initial.runtimeReady&&initial.terrainReady&&initial.explorerReady&&initial.polishReady)break;if(initial.error||initial.explorerError||initial.polishError||pageErrors.length)break;await page.waitForTimeout(400);}
  await page.waitForTimeout(1000);initial=await snap();
  need(initial.runtimeReady&&initial.terrainReady&&initial.explorerReady&&initial.polishReady,`Boot failed ${JSON.stringify(initial)}`);
  need(initial.region==='iberia'&&initial.metadataRegion==='iberia'&&initial.metadataName==='Península Ibérica','Wrong region');
  need(initial.runtimeVersion==='003','Wrong runtime version');need(initial.travelNodes===0&&initial.localZones===0,'Catalunya graph leaked into Iberia');
  need(initial.counts?.settlements===362&&initial.counts?.buildings===362,`Unexpected city counts ${JSON.stringify(initial.counts)}`);
  need(initial.animals===1&&!initial.npc,'Iberia must contain only the test bearded vulture');
  need(initial.bird?.name==='Quebrantahuesos'&&initial.bird.mountable&&initial.bird.flightMountReady,'Bird not mount-ready');
  need(initial.settlements===362&&initial.rows>0&&initial.panel?.width<=200&&initial.panel?.height<=180,'Compact settlement UI invalid');
  need(!initial.down,'Legacy respawn control survived');
  need(/^ALT .* m · LAT -?\d+\.\d{4} · LON -?\d+\.\d{4}$/.test(initial.coords),`Coordinates missing: ${initial.coords}`);
  need(initial.help==='none','Legacy help bar visible');need(!initial.telemetry||initial.telemetryDisplay==='none','Black telemetry pill visible');
  need(initial.jumpSelect==='none','Jump text remains selectable');need(initial.webgl2&&initial.canvas.width>=800&&initial.canvas.height>=350,'Mobile WebGL2 canvas invalid');

  const movement=await page.evaluate(async()=>{const api=WAFTRegionRuntime,wait=ms=>new Promise(r=>setTimeout(r,ms));api.setRegionalPosition(0,0);await wait(180);const a=api.getState();api.setInput(0,-1);await wait(650);api.setInput(0,0);await wait(120);const b=api.getState();return Math.hypot(b.position.x-a.position.x,b.position.z-a.position.z);});
  need(movement>.15,`No physical movement: ${movement}`);
  const respawn=await page.evaluate(async()=>{const api=WAFTRegionRuntime,wait=ms=>new Promise(r=>setTimeout(r,ms));api.setRegionalPosition(42,37);await wait(180);const a=api.getState();api.respawn?.();await wait(650);const b=api.getState();return Math.hypot(b.position.x-a.position.x,b.position.z-a.position.z);});
  need(respawn<1,`Ghost respawn moved player ${respawn}`);

  const jumps=await page.evaluate(async()=>{const api=WAFTRegionRuntime,wait=ms=>new Promise(r=>setTimeout(r,ms));const run=async v=>{api.setAdventureModifiers({flight:false,mountType:null});api.setRegionalPosition(0,0);api.setInput(0,0);await wait(400);const y=api.getState().position.y;api.queueAdventureJump(v,{horizontalBoost:1});let peak=0;for(let i=0;i<28;i++){await wait(50);peak=Math.max(peak,api.getState().position.y-y);}return peak;};return{normal:await run(8.8),mega:await run(23.55)};});
  need(jumps.mega>jumps.normal*1.65&&jumps.mega>4,`Super jump weak: ${JSON.stringify(jumps)}`);

  const flight=await page.evaluate(async()=>{
    const api=WAFTRegionRuntime,game=__WAFT_INTERNAL_GAME__,wait=ms=>new Promise(r=>setTimeout(r,ms));
    const bird=game.animals.find(a=>a.id==='iberia-bearded-vulture');
    const clearance=()=>{const s=api.getState(),t=api.sampleSurface(s.position.x,s.position.z),floor=(t.land?t.height:t.waterHeight)+1.45;return s.position.y-floor;};
    api.setAdventureModifiers({flight:false,mountType:null});api.setInput(0,0);api.setRegionalPosition(bird.x,bird.z);await wait(420);
    const action=document.getElementById('waftAdventureAction'),mountPrompt={visible:action?.classList.contains('visible')||false,text:action?.textContent||''};action?.click();await wait(420);
    const mounted=api.getState(),mountedId=game.mountedAnimalId;
    api.setAdventureModifiers({flightFlap:10});await wait(520);api.setAdventureModifiers({flightFlap:10});await wait(700);
    const high=api.getState();await wait(700);const levelStart=api.getState();await wait(850);const levelEnd=api.getState(),levelDrift=Math.abs(levelEnd.position.y-levelStart.position.y);
    let preDiveClearance=clearance();
    for(let i=0;i<8&&preDiveClearance<14;i++){api.setAdventureModifiers({flightFlap:10});await wait(500);preDiveClearance=clearance();}
    await wait(80);const diveStart=api.getState();preDiveClearance=clearance();api.setInput(0,1);await wait(520);const dive=api.getState();api.setInput(0,0);const drop=diveStart.position.y-dive.position.y;
    await wait(120);const dismount=document.getElementById('waftAdventureAction'),dismountText=dismount?.textContent||'';dismount?.click();await wait(650);
    const after=api.getState(),birdAfter=game.animals.find(a=>a.id==='iberia-bearded-vulture'),remount=document.getElementById('waftAdventureAction');
    const remountPrompt={visible:remount?.classList.contains('visible')||false,text:remount?.textContent||'',ready:birdAfter.flightMountReady,distance:Math.hypot(birdAfter.x-after.position.x,birdAfter.z-after.position.z)};
    api.setInput(0,-1);await wait(900);api.setInput(0,0);await wait(300);const moved=api.getState(),birdFollow=game.animals.find(a=>a.id==='iberia-bearded-vulture'),followDistance=Math.hypot(birdFollow.x-moved.position.x,birdFollow.z-moved.position.z);
    document.getElementById('waftAdventureAction')?.click();await wait(450);
    return{mountPrompt,mountedId,mounted,high,levelDrift,preDiveClearance,diveStart,dive,drop,dismountText,remountPrompt,followDistance,remountedId:game.mountedAnimalId,remounted:api.getState()};
  });
  need(flight.mountPrompt.visible&&/MONTAR QUEBRANTAHUESOS/i.test(flight.mountPrompt.text),'Initial mount prompt failed');
  need(flight.mountedId==='iberia-bearded-vulture'&&flight.mounted.movementMode==='flight','Initial mount failed');
  need(flight.high.position.y>flight.mounted.position.y+4,`Climb weak: ${flight.high.position.y-flight.mounted.position.y}`);
  need(flight.levelDrift<.35,`Neutral flight drifts vertically: ${flight.levelDrift}`);
  need(flight.preDiveClearance>=10,`Could not establish safe dive clearance: ${flight.preDiveClearance}`);
  need(flight.dive.iberiaDive===true&&flight.dive.adventureCurrentSpeed>=48,`Dive state/speed failed: ${JSON.stringify(flight.dive)}`);
  need(flight.drop>5,`Free-air dive is not pronounced enough: ${flight.drop}`);
  need(/DESMONTAR/i.test(flight.dismountText),'Dismount action missing');
  need(flight.remountPrompt.ready&&flight.remountPrompt.distance<8.5&&flight.remountPrompt.visible&&/MONTAR QUEBRANTAHUESOS/i.test(flight.remountPrompt.text),`Remount failed: ${JSON.stringify(flight.remountPrompt)}`);
  need(flight.followDistance<9,`Bird follow distance too large: ${flight.followDistance}`);
  need(flight.remountedId==='iberia-bearded-vulture'&&flight.remounted.movementMode==='flight','Second mount failed');

  if(screenshot){fs.mkdirSync(path.dirname(screenshot),{recursive:true});await page.screenshot({path:screenshot,type:'png'});}
  need(pageErrors.length===0,`Page errors: ${pageErrors.join(' | ')}`);
  need(!consoleErrors.some(x=>/Iberia Explorer 0\.24\.2 failed|Iberia Polish 0\.24\.3 failed|Falta el nodo regional|No se pudo abrir el runtime regional/i.test(x)),`Runtime console errors: ${consoleErrors.join(' | ')}`);
  console.log(JSON.stringify({valid:true,region:initial.metadataName,settlements:initial.counts.settlements,coords:initial.coords,movementDistance:+movement.toFixed(3),respawnGuardDistance:+respawn.toFixed(3),jumpRise:{normal:+jumps.normal.toFixed(3),mega:+jumps.mega.toFixed(3)},flight:{climb:+(flight.high.position.y-flight.mounted.position.y).toFixed(3),levelDrift:+flight.levelDrift.toFixed(3),preDiveClearance:+flight.preDiveClearance.toFixed(3),diveDrop:+flight.drop.toFixed(3),diveSpeed:+flight.dive.adventureCurrentSpeed.toFixed(1),remountDistance:+flight.remountPrompt.distance.toFixed(3),followDistance:+flight.followDistance.toFixed(3)},pageErrors,consoleErrors,requestFailures,badResponses},null,2));
}finally{await context.close();await browser.close();}
