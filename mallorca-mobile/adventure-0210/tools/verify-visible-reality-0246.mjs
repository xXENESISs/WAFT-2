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
const noOverlap=(a,b)=>!a||!b||a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y;
try{
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});need(response?.ok(),`HTTP ${response?.status()}`);
  await page.waitForFunction(()=>window.__WAFT_IBERIA_WORLD_0246_READY__&&window.__WAFT_IBERIA_WORLD_0245_READY__&&window.WAFTRegionRuntime,{timeout:90000});
  await page.waitForTimeout(700);
  const initial=await page.evaluate(async()=>{
    const s=await fetch('../regions/iberia/settlements.json',{cache:'no-store'}).then(r=>r.json());
    const p=await fetch('../regions/iberia/preview/iberia-preview-v1.json',{cache:'no-store'}).then(r=>r.json());
    const o=await fetch('../regions/iberia/objects.json',{cache:'no-store'}).then(r=>r.json());
    const sant=(s.items||[]).find(x=>x.name==='Sant Just Desvern');
    return{build:window.__WAFT_ADVENTURE_BUILD__,sant,santObject:(o.items||[]).find(x=>x.name==='Sant Just Desvern')||null,counts:p.counts,physical:window.WAFTIberiaWorld0246?.landmarks?.()||[],landmarkData:window.WAFTIberiaWorld0246?.landmarkData?.()||[],franceCityCount:window.WAFTIberiaWorld0246?.franceCityCount?.()||0,floatingDisplay:getComputedStyle(document.getElementById('waftSpecialMarkers')).display,diveButton:Boolean(document.getElementById('waftDive0246'))};
  });
  need(initial.build==='0.24.6',`Wrong build ${initial.build}`);
  need(initial.sant&&initial.sant.population>=20000,`Sant Just Desvern missing: ${JSON.stringify(initial.sant)}`);
  need(initial.santObject,`Sant Just Desvern has no physical marker object`);
  need(initial.counts?.settlements>=368&&initial.counts?.buildings>=365,`Expected Sant Just in preview, got ${JSON.stringify(initial.counts)}`);
  for(const name of ['Ayódar','Peñíscola','Gibraltar'])need(initial.physical.includes(name),`Physical ${name} missing`);
  need(initial.franceCityCount>=450,`France city mesh incomplete: ${initial.franceCityCount}`);
  need(initial.floatingDisplay==='none','Old floating special emojis are still visible');
  need(initial.diveButton,'PICADO button missing');

  if(shot){
    const base=shot.replace(/\.png$/i,'');
    for(const lm of initial.landmarkData){
      await page.evaluate(({x,z})=>{WAFTRegionRuntime.setAdventureModifiers({flight:false,mountType:null});WAFTRegionRuntime.setRegionalPosition(x,z+6);WAFTRegionRuntime.setHeading(Math.PI);WAFTRegionRuntime.setInput(0,0);},{x:lm.x,z:lm.z});
      await page.waitForTimeout(450);
      const safe=lm.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-');
      await page.screenshot({path:`${base}-${safe}.png`,type:'png',fullPage:false});
    }
  }

  const setup=await page.evaluate(async()=>{
    const api=WAFTRegionRuntime,game=__WAFT_INTERNAL_GAME__,stream=WAFTWorldStreaming0245,wait=ms=>new Promise(r=>setTimeout(r,ms));
    const bird=game.animals.find(a=>a.id==='iberia-bearded-vulture');if(!bird)throw new Error('Bearded vulture missing');
    api.setAdventureModifiers({flight:false,mountType:null});api.setRegionalPosition(bird.x,bird.z);await wait(250);document.getElementById('waftAdventureAction')?.click();await wait(350);
    const ocean=stream.worldFromGeo(36.2,-7.0);api.setAdventureModifiers({flight:false,mountType:'vulture'});api.setRegionalPosition(ocean.x,ocean.z);api.setAdventureModifiers({flight:true,mountType:'vulture'});api.setInput(0,0);await wait(250);
    for(let i=0;i<8;i++){api.setAdventureModifiers({flightFlap:10});await wait(150);}await wait(500);
    const state=api.getState(),surface=api.sampleSurface(state.position.x,state.position.z),floor=(surface?.land?surface.height:surface?.waterHeight)+1.45;
    return{mounted:game.mountedAnimalId,buttonHidden:document.getElementById('waftDive0246').hidden,state,surface,clearance:state.position.y-floor};
  });
  need(setup.mounted==='iberia-bearded-vulture','Bearded vulture not mounted');need(!setup.buttonHidden,'PICADO button hidden while flying');
  need(setup.clearance>24,`Dive probe did not reach safe altitude: ${setup.clearance}`);
  const button=page.locator('#waftDive0246'),dismount=page.locator('#waftAdventureAction');const box=await button.boundingBox(),dismountBox=await dismount.boundingBox();need(box,'PICADO button has no hitbox');need(noOverlap(box,dismountBox),`PICADO overlaps DESMONTAR: ${JSON.stringify({box,dismountBox})}`);
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);const before=await page.evaluate(()=>WAFTRegionRuntime.getState());await page.mouse.down();await page.waitForTimeout(720);const during=await page.evaluate(()=>WAFTRegionRuntime.getState());await page.mouse.up();await page.waitForTimeout(120);
  const drop=before.position.y-during.position.y;
  need(during.iberiaDive,`PICADO button did not enter dive: ${JSON.stringify(during)}`);
  need(drop>20,`PICADO button descent too weak: ${drop} from clearance ${setup.clearance}`);
  need(during.adventureCurrentSpeed>=50,`PICADO forward speed too low ${during.adventureCurrentSpeed}`);

  await page.evaluate(async()=>{const api=WAFTRegionRuntime,stream=WAFTWorldStreaming0245,wait=ms=>new Promise(r=>setTimeout(r,ms));const p=stream.worldFromGeo(42.55,.55);api.setRegionalPosition(p.x,p.z);api.setHeading(Math.PI);api.setInput(0,0);for(let i=0;i<3;i++){api.setAdventureModifiers({flightFlap:10});await wait(220);}await stream.prefetchFrance();});
  await page.waitForFunction(()=>{const s=WAFTWorldStreaming0245.getState();return s.prefetched&&s.renderMode==='france-lod'&&s.franceGpuTriangles>20000;},{timeout:60000});
  const overlap=await page.evaluate(()=>WAFTWorldStreaming0245.getState());need(overlap.franceGpuTriangles>20000,`France overlap too sparse ${overlap.franceGpuTriangles}`);
  const seam=await page.evaluate(async()=>{const api=WAFTRegionRuntime,stream=WAFTWorldStreaming0245,game=__WAFT_INTERNAL_GAME__,wait=ms=>new Promise(r=>setTimeout(r,ms));api.setHeading(Math.PI);api.setInput(0,-1);let samples=0;for(let i=0;i<140;i++){await wait(100);samples++;const s=stream.getState();if(s.renderMode==='france-full'&&s.iberiaGpuReleased&&s.geo?.lat>43.22)break;}api.setInput(0,0);await wait(400);const r=api.getState(),w=stream.getState(),surface=api.sampleSurface(r.position.x,r.position.z);return{r,w,surface,mount:game.mountedAnimalId,samples,badgeHidden:document.getElementById('waftFranceBadge0246')?.hidden,badgeText:document.getElementById('waftFranceBadge0246')?.textContent,hudTitle:document.getElementById('hudTitle')?.textContent};});
  need(seam.w.activeRegion==='france'&&seam.w.renderMode==='france-full',`France did not become full terrain: ${JSON.stringify(seam.w)}`);
  need(seam.w.franceGpuTriangles>450000&&seam.w.franceDrawFrames>0,'France full mesh not rendered');
  need(seam.surface?.streamedRegion==='france'&&seam.surface.inside,'Player not physically on streamed France');
  need(seam.mount==='iberia-bearded-vulture','Mount lost at France seam');
  need(seam.badgeHidden===false&&/FRANCE/.test(seam.badgeText||''),`France badge not visible: ${JSON.stringify(seam)}`);
  need(/FRANCE/.test(seam.hudTitle||''),`HUD still identifies Iberia in France: ${seam.hudTitle}`);
  need(errors.length===0,`Page errors: ${errors.join(' | ')}`);
  if(shot){fs.mkdirSync(path.dirname(shot),{recursive:true});await page.screenshot({path:shot,type:'png',fullPage:false});}
  console.log(JSON.stringify({valid:true,initial,dive:{drop,clearance:setup.clearance,speed:during.adventureCurrentSpeed,active:during.iberiaDive,startY:before.position.y,endY:during.position.y},overlap:{triangles:overlap.franceGpuTriangles,mode:overlap.renderMode},france:{mode:seam.w.renderMode,triangles:seam.w.franceGpuTriangles,lat:seam.w.geo?.lat,samples:seam.samples,cityMarkers:initial.franceCityCount,badge:seam.badgeText,hudTitle:seam.hudTitle},errors},null,2));
}finally{await context.close();await browser.close();}
