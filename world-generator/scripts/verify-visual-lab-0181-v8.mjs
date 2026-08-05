import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const BUILD_ID='waft-visual-lab-0181-v8';
function assert(value,message){if(!value)throw new Error(message);}
function chromePath(){for(const candidate of [process.env.CHROME_BIN,'/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser'].filter(Boolean)){if(fs.existsSync(candidate))return candidate;}throw new Error('Chrome no está disponible');}
function args(){const out={url:null,output:null,screenshot:null,public:false};const values=process.argv.slice(2);while(values.length){const flag=values.shift();if(flag==='--url')out.url=values.shift();else if(flag==='--output')out.output=values.shift();else if(flag==='--screenshot')out.screenshot=values.shift();else if(flag==='--public')out.public=true;else throw new Error(`Argumento desconocido: ${flag}`);}assert(out.url&&out.output,'--url y --output son obligatorios');return out;}

const options=args();
const browser=await chromium.launch({executablePath:chromePath(),headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist','--enable-webgl','--use-gl=angle','--use-angle=swiftshader']});
const pageErrors=[];const consoleErrors=[];const requestFailures=[];
try{
  const context=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const page=await context.newPage();
  page.on('pageerror',error=>pageErrors.push(error.message));
  page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('404'))consoleErrors.push(message.text());});
  page.on('requestfailed',request=>{if(!request.url().endsWith('/favicon.ico'))requestFailures.push(`${request.url()}: ${request.failure()?.errorText||'failed'}`);});
  const response=await page.goto(options.url,{waitUntil:'domcontentloaded',timeout:120000});
  assert(response?.ok(),`La página devolvió ${response?.status()}`);
  await page.waitForFunction(()=>window.__WAFT_VISUAL_LAB_0181_MACAQUE_SURFACEFIX__===true&&Boolean(window.WAFTVisualLab0181?.getState),null,{timeout:120000});
  await page.waitForTimeout(1500);
  const state=await page.evaluate(()=>window.WAFTVisualLab0181.getState());
  assert(state.buildId===BUILD_ID,`Build inesperada: ${state.buildId}`);
  assert(state.crispRender===true,'La pasada nítida no está activa');
  assert(state.macaqueV2===true,'El macaco v2 no está activo');
  assert(state.macaqueFaceFix2===true,'La anatomía facial estable no está activa');
  assert(state.macaqueSurfaceFix===true,'La corrección de superficie no está activa');
  assert(state.headFurMeshes>=7,`Solo se aplicó el pelaje de cabeza a ${state.headFurMeshes} mallas`);
  assert(state.faceFurMeshes>=4,`Solo se aplicó el pelaje facial a ${state.faceFurMeshes} mallas`);
  assert(state.macaqueSurfaceTextures===2,'Faltan texturas de superficie');
  assert(state.unstableFacePartsHidden>=7,'Quedan piezas faciales inestables');
  assert(state.macaqueV2Vertices>=6000,`Detalle insuficiente: ${state.macaqueV2Vertices} vértices`);
  assert(state.webgl2===true,'WebGL2 no está activo');
  assert(state.crispHardwareScaling<=1.01,`Escalado borroso: ${state.crispHardwareScaling}`);

  const model=await page.evaluate(()=>{
    const scene=BABYLON.Engine.LastCreatedScene;
    const head=scene.getMeshByName('macaqueV2Head');
    const headMaterial=head?.material?.name||'';
    const stretchedMaterial=scene.getMaterialByName('macaqueV2Fur');
    const hidden=['macaqueV3EarOuter-1','macaqueV3EarOuter1','macaqueV3EarInner-1','macaqueV3EarInner1','macaqueV2Brow-1','macaqueV2Brow1','macaqueV3NoseBridge'].every(name=>{const mesh=scene.getMeshByName(name);return mesh&&!mesh.isEnabled();});
    const visible=['macaqueV4EarOuter-1','macaqueV4EarOuter1','macaqueV4EarInner-1','macaqueV4EarInner1','macaqueV4Brow-1','macaqueV4Brow1'].every(name=>{const mesh=scene.getMeshByName(name);return mesh&&mesh.isEnabled();});
    return{headMaterial,stretchedMaterialName:stretchedMaterial?.name||'',hidden,visible,profile:document.getElementById('profile')?.textContent||'',meshCount:scene.meshes.length};
  });
  assert(model.headMaterial==='macaqueV5HeadFur',`Material de cabeza inesperado: ${model.headMaterial}`);
  assert(model.hidden,'Quedan piezas deformadas visibles');
  assert(model.visible,'Faltan piezas faciales estables');
  assert(/V2\.3/.test(model.profile),`Perfil inesperado: ${model.profile}`);
  assert(model.meshCount<=670,`Demasiadas mallas: ${model.meshCount}`);

  const sectionIds=await page.evaluate(()=>window.WAFTVisualLab0181.getSections().map(section=>section.id));
  assert(sectionIds.length===8&&new Set(sectionIds).size===8,'Las ocho secciones no están disponibles');
  for(const id of sectionIds){await page.evaluate(sectionId=>window.WAFTVisualLab0181.focus(sectionId,true),id);await page.waitForTimeout(70);const active=await page.evaluate(()=>window.WAFTVisualLab0181.getState().activeSection);assert(active===id,`No se pudo enfocar ${id}`);}
  await page.evaluate(()=>window.WAFTVisualLab0181.focus('macaque',true));
  await page.waitForTimeout(500);
  if(options.screenshot)await page.screenshot({path:options.screenshot,type:'png'});
  assert(pageErrors.length===0,`Errores de página: ${pageErrors.join(' | ')}`);
  assert(consoleErrors.length===0,`Errores de consola: ${consoleErrors.join(' | ')}`);
  assert(requestFailures.length===0,`Fallos de red: ${requestFailures.join(' | ')}`);

  const report={formatVersion:1,valid:true,public:options.public,url:options.url,buildId:BUILD_ID,viewport:{width:844,height:390,mobile:true,touch:true},sectionIds,state,model,pageErrors,consoleErrors,requestFailures,verifiedAt:new Date().toISOString()};
  const output=path.resolve(ROOT,options.output);fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');process.stdout.write(JSON.stringify(report,null,2)+'\n');
}finally{await browser.close();}
