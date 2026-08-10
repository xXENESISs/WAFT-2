import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';

const need=(value,message)=>{if(!value)throw new Error(message);};
const chrome=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser'].find(fs.existsSync);
if(!chrome)throw new Error('Chrome not found');
const url=process.argv[2],screenshot=process.argv[3]||null;
if(!url)throw new Error('Usage: verify-iberia-france-browser-0245.mjs <url> [screenshot]');

const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--disable-background-networking']});
const context=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:1,isMobile:true,hasTouch:true});
const page=await context.newPage();
const pageErrors=[];
page.on('pageerror',error=>pageErrors.push(error.message));

try{
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});
  need(response?.ok(),`HTTP ${response?.status()}`);
  await page.waitForFunction(()=>window.__WAFT_RUNTIME_011_READY__&&window.__WAFT_IBERIA_TERRAIN_0240_READY__&&window.__WAFT_IBERIA_EXPLORER_0242_READY__&&window.__WAFT_IBERIA_POLISH_0243_READY__&&window.__WAFT_IBERIA_WORLD_0244_READY__&&window.__WAFT_IBERIA_WORLD_0245_READY__,{timeout:90000});
  await page.waitForTimeout(900);

  const initial=await page.evaluate(async()=>{
    const [settlements,objects]=await Promise.all([
      fetch('../regions/iberia/settlements.json',{cache:'no-store'}).then(r=>r.json()),
      fetch('../regions/iberia/objects.json',{cache:'no-store'}).then(r=>r.json())
    ]);
    const specials=(settlements.items||[]).filter(item=>item.specialMarker).map(item=>item.name);
    const specialObjects=(objects.items||[]).filter(item=>item.tags?.['waft:special_marker']||String(item.id||'').includes('waft-ayodar')||String(item.id||'').includes('waft-peniscola'));
    return{
      build:window.__WAFT_ADVENTURE_BUILD__,region:window.__WAFT_ADVENTURE_REGION__,world:window.WAFTIberiaWorld0244?.getState?.(),stream:window.WAFTWorldStreaming0245?.getState?.(),
      counts:window.WAFTRegionRuntime?.metadata?.counts,coords:document.getElementById('waftIberiaCoords')?.textContent||'',atlas:Boolean(document.getElementById('waftIberiaAtlas')),streamHud:Boolean(document.getElementById('waftWorldStream0245')),
      specials,specialObjects:specialObjects.map(item=>item.id),error:document.getElementById('error')?.textContent?.trim()||'',webgl2:Boolean(document.querySelector('canvas')?.getContext('webgl2'))
    };
  });
  need(initial.build==='0.24.5'&&initial.region==='iberia','Wrong build/region');
  need(initial.counts?.settlements>=365,`Too few Iberia settlements ${initial.counts?.settlements}`);
  need(initial.specials.includes('Ayódar')&&initial.specials.includes('Peñíscola')&&initial.specials.includes('Gibraltar'),`Special places missing ${initial.specials.join(', ')}`);
  need(initial.specialObjects.length===0,`Special places still emitted as generic building needles: ${initial.specialObjects.join(', ')}`);
  need(initial.atlas&&initial.streamHud,'0.24.5 world UI missing');
  need(/^ALT .* m · LAT -?\d+\.\d{4} · LON -?\d+\.\d{4}$/.test(initial.coords),'Coordinates invalid');
  need(initial.webgl2&&!initial.error,'Runtime invalid');

  const flight=await page.evaluate(async()=>{
    const api=WAFTRegionRuntime,stream=WAFTWorldStreaming0245,game=__WAFT_INTERNAL_GAME__,wait=ms=>new Promise(r=>setTimeout(r,ms));
    const bird=game.animals.find(animal=>animal.id==='iberia-bearded-vulture');
    api.setAdventureModifiers({flight:false,mountType:null});api.setRegionalPosition(bird.x,bird.z);await wait(350);document.getElementById('waftAdventureAction')?.click();await wait(350);

    // Keep the whole neutral/dive probe far offshore. The bearded vulture intentionally
    // coasts horizontally with no joystick, so a near-coast probe can eventually hit rising
    // terrain and make the floor clamp look like vertical flight drift.
    let ocean=null;
    const candidates=[[39.0,-9.8],[40.0,-9.8],[41.0,-9.7],[36.2,-7.0],[38.0,-1.2],[37.0,-8.8]];
    for(const [lat,lon] of candidates){
      const p=stream.worldFromGeo(lat,lon),surface=api.sampleSurface(p.x,p.z);
      if(surface?.inside&&!surface.land){ocean={lat,lon,...p};break;}
    }
    if(!ocean)throw new Error('No open-water flight probe available inside Iberia');
    api.setAdventureModifiers({flight:false,mountType:'vulture'});api.setRegionalPosition(ocean.x,ocean.z);api.setAdventureModifiers({flight:true,mountType:'vulture'});api.setInput(0,0);await wait(250);

    const start=api.getState();api.setAdventureModifiers({flightFlap:3.8});await wait(600);const one=api.getState();await wait(750);const levelA=api.getState();await wait(750);const levelB=api.getState();
    const levelASurface=api.sampleSurface(levelA.position.x,levelA.position.z),levelBSurface=api.sampleSurface(levelB.position.x,levelB.position.z);
    api.setHeading(0);api.setInput(0,-1);await wait(320);const cruise=api.getState();api.setInput(0,0);await wait(120);
    for(let i=0;i<4;i++){api.setAdventureModifiers({flightFlap:3.8});await wait(360);}const diveStart=api.getState();api.setInput(0,1);await wait(520);const dive=api.getState();api.setInput(0,0);
    const diveSurface=api.sampleSurface(dive.position.x,dive.position.z);
    return{probe:ocean,climb:one.position.y-start.position.y,drift:Math.abs(levelB.position.y-levelA.position.y),cruiseSpeed:cruise.adventureCurrentSpeed,drop:diveStart.position.y-dive.position.y,diveSpeed:dive.adventureCurrentSpeed,dive:dive.iberiaDive,neutralSurfaceLand:Boolean(levelASurface?.land||levelBSurface?.land),diveSurfaceLand:Boolean(diveSurface?.land),mounted:game.mountedAnimalId};
  });
  need(flight.climb>10.5,`Single flap still weak: ${flight.climb}`);
  need(!flight.neutralSurfaceLand,`Neutral probe reached land and is no longer isolated: ${JSON.stringify(flight)}`);
  need(flight.drift<.35,`Level flight drift ${flight.drift}`);
  need(flight.cruiseSpeed>=44,`Cruise still slow ${flight.cruiseSpeed}`);
  need(!flight.diveSurfaceLand,`Dive probe reached land and is no longer isolated: ${JSON.stringify(flight)}`);
  need(flight.dive&&flight.diveSpeed>=48&&flight.drop>5,`Dive regression ${JSON.stringify(flight)}`);
  need(flight.mounted==='iberia-bearded-vulture','Vulture mount lost during flight test');

  await page.evaluate(async()=>{
    const api=WAFTRegionRuntime,stream=WAFTWorldStreaming0245,wait=ms=>new Promise(r=>setTimeout(r,ms));
    const start=stream.worldFromGeo(42.60,0.55);
    api.setRegionalPosition(start.x,start.z);api.setHeading(Math.PI);api.setAdventureModifiers({flight:true,mountType:'vulture'});api.setInput(0,0);
    for(let i=0;i<3;i++){api.setAdventureModifiers({flightFlap:10});await wait(260);}
    await stream.prefetchFrance();
  });
  await page.waitForFunction(()=>{const s=WAFTWorldStreaming0245?.getState?.();return s?.prefetched&&s.renderMode==='france-lod'&&s.franceGpuTriangles>1000;},{timeout:60000});

  const seam=await page.evaluate(async()=>{
    const api=WAFTRegionRuntime,stream=WAFTWorldStreaming0245,game=__WAFT_INTERNAL_GAME__,wait=ms=>new Promise(r=>setTimeout(r,ms));
    const beforeStream=stream.getState(),pageInstanceId=beforeStream.pageInstanceId,mountBefore=game.mountedAnimalId,samples=[];
    api.setHeading(Math.PI);api.setInput(0,-1);
    // Keep real movement running long enough to pass the full-terrain threshold. No teleport
    // is used here: the test must physically fly from the Pyrenees overlap into France.
    for(let i=0;i<180;i++){
      await wait(100);const runtime=api.getState(),world=stream.getState();samples.push({x:runtime.position.x,z:runtime.position.z,lat:world.geo?.lat||null,mode:world.renderMode});
      if(world.renderMode==='france-full'&&world.iberiaGpuReleased&&world.geo?.lat>43.66)break;
    }
    api.setInput(0,0);await wait(450);
    const runtime=api.getState(),world=stream.getState(),surface=api.sampleSurface(runtime.position.x,runtime.position.z);
    let maxStep=0;for(let i=1;i<samples.length;i++)maxStep=Math.max(maxStep,Math.hypot(samples[i].x-samples[i-1].x,samples[i].z-samples[i-1].z));
    return{runtime,world,surface,maxStep,pageInstanceId,mountBefore,mountAfter:game.mountedAnimalId,samples:samples.length};
  });
  need(seam.world.activeRegion==='france',`Global region did not become France: ${JSON.stringify(seam.world)}`);
  need(seam.world.renderMode==='france-full'&&seam.world.franceGpuTriangles>450000,`Full France terrain not active: ${JSON.stringify(seam.world)}`);
  need(seam.world.franceDrawFrames>0&&seam.world.lastDrawTriangles>450000,'France terrain was not actually drawn');
  need(seam.world.iberiaGpuReleased&&seam.runtime.adventureRegionalTerrainReleased,'Iberia GPU terrain was not released behind player');
  need(seam.surface?.streamedRegion==='france'&&seam.surface.inside,'Player is not physically sampling France terrain');
  need(seam.mountBefore==='iberia-bearded-vulture'&&seam.mountAfter===seam.mountBefore,'Mount changed across seam');
  need(seam.pageInstanceId===seam.world.pageInstanceId,'Page instance changed across seam');
  need(seam.maxStep<9.5,`Visible position discontinuity across seam: ${seam.maxStep}`);
  need(Math.abs((seam.world.transition?.altitudeAfter??999)-(seam.world.transition?.altitudeBefore??0))<.15,`Altitude changed during GPU swap: ${JSON.stringify(seam.world.transition)}`);
  need(Math.abs((seam.world.transition?.speedAfter??999)-(seam.world.transition?.speedBefore??0))<.5,`Speed changed during GPU swap: ${JSON.stringify(seam.world.transition)}`);
  need(seam.world.transition?.mountBefore===seam.world.transition?.mountAfter&&seam.world.transition?.mountAfter==='iberia-bearded-vulture',`Mount not preserved in transition snapshot: ${JSON.stringify(seam.world.transition)}`);

  const returnOverlap=await page.evaluate(async()=>{
    const api=WAFTRegionRuntime,stream=WAFTWorldStreaming0245,wait=ms=>new Promise(r=>setTimeout(r,ms));
    api.setHeading(0);api.setInput(0,-1);
    for(let i=0;i<100;i++){await wait(100);if(!stream.getState().iberiaGpuReleased)break;}
    api.setInput(0,0);await wait(250);return{runtime:api.getState(),world:stream.getState()};
  });
  need(!returnOverlap.world.iberiaGpuReleased&&!returnOverlap.runtime.adventureRegionalTerrainReleased,'Iberia GPU terrain did not restore when returning to overlap');
  need(returnOverlap.world.renderMode==='france-lod','France LOD was not restored for overlap');

  if(screenshot){fs.mkdirSync(path.dirname(screenshot),{recursive:true});await page.screenshot({path:screenshot,type:'png'});}
  need(pageErrors.length===0,`Page errors: ${pageErrors.join(' | ')}`);
  console.log(JSON.stringify({valid:true,settlements:initial.counts.settlements,specials:initial.specials,flight,seam:{activeRegion:seam.world.activeRegion,renderMode:seam.world.renderMode,franceGpuTriangles:seam.world.franceGpuTriangles,franceDrawFrames:seam.world.franceDrawFrames,maxStep:seam.maxStep,transition:seam.world.transition,samples:seam.samples},returnOverlap:returnOverlap.world,pageErrors},null,2));
}finally{
  await context.close();await browser.close();
}