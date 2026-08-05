import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const BUILD_ID='waft-visual-lab-0181-v10';
function assert(value,message){if(!value)throw new Error(message);}
function chromePath(){for(const candidate of [process.env.CHROME_BIN,'/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser'].filter(Boolean)){if(fs.existsSync(candidate))return candidate;}throw new Error('Chrome no está disponible');}
function parseArgs(){const out={url:null,output:null,screenshot:null,public:false};const values=process.argv.slice(2);while(values.length){const flag=values.shift();if(flag==='--url')out.url=values.shift();else if(flag==='--output')out.output=values.shift();else if(flag==='--screenshot')out.screenshot=values.shift();else if(flag==='--public')out.public=true;else throw new Error(`Argumento desconocido: ${flag}`);}assert(out.url&&out.output,'--url y --output son obligatorios');return out;}

const options=parseArgs();
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
  await page.waitForFunction(()=>window.__WAFT_VISUAL_LAB_0181_MACAQUE_HEADSHELL__===true&&Boolean(window.WAFTVisualLab0181?.getState),null,{timeout:120000});
  await page.waitForTimeout(1600);
  const state=await page.evaluate(()=>window.WAFTVisualLab0181.getState());
  assert(state.buildId===BUILD_ID,`Build inesperada: ${state.buildId}`);
  assert(state.crispRender===true,'La pasada nítida no está activa');
  assert(state.macaqueV2===true,'El macaco v2 no está activo');
  assert(state.macaqueHeadShell===true,'La cabeza orgánica no está activa');
  assert(state.oldHeadHidden===true,'La cabeza defectuosa sigue visible');
  assert(state.headShellVertices>=1000,`Cabeza con poco detalle: ${state.headShellVertices} vértices`);
  assert(state.headShellMeshes>=5,`Solo hay ${state.headShellMeshes} volúmenes de cabeza`);
  assert(state.headFaceRepositioned===true,'La cara no fue reposicionada');
  assert(state.headSelfShadowDisabled===true,'El autosombreado facial sigue activo');
  assert(state.headShadowCastersRemoved>=20,`Solo se retiraron ${state.headShadowCastersRemoved} sombras faciales`);
  assert(state.webgl2===true,'WebGL2 no está activo');
  assert(state.crispHardwareScaling<=1.01,`Escalado borroso: ${state.crispHardwareScaling}`);

  const model=await page.evaluate(()=>{
    const scene=BABYLON.Engine.LastCreatedScene;
    const oldHead=scene.getMeshByName('macaqueV2Head');
    const shell=scene.getMeshByName('macaqueV6HeadShell');
    const crown=scene.getMeshByName('macaqueV6Crown');
    const forehead=scene.getMeshByName('macaqueV6Forehead');
    const faceMeshes=['macaqueV6HeadShell','macaqueV6Crown','macaqueV6Forehead','macaqueV6Temple-1','macaqueV6Temple1','macaqueV2FaceMask','macaqueV2Muzzle','macaqueV2Nose','macaqueV2CheekL','macaqueV2CheekR'].map(name=>scene.getMeshByName(name)).filter(Boolean);
    return{
      oldHeadHidden:Boolean(oldHead&&!oldHead.isEnabled()),
      shellEnabled:Boolean(shell?.isEnabled()),
      shellMaterial:shell?.material?.name||'',
      shellVertices:shell?.getTotalVertices()||0,
      crownEnabled:Boolean(crown?.isEnabled()),
      foreheadEnabled:Boolean(forehead?.isEnabled()),
      noFaceReceivers:faceMeshes.every(mesh=>mesh.receiveShadows===false),
      profile:document.getElementById('profile')?.textContent||'',
      code:document.getElementById('sectionCode')?.textContent||'',
      meshCount:scene.meshes.length
    };
  });
  assert(model.oldHeadHidden,'La malla rayada sigue habilitada');
  assert(model.shellEnabled&&model.crownEnabled&&model.foreheadEnabled,'La nueva cabeza está incompleta');
  assert(model.shellMaterial==='macaqueV5HeadFur',`Material inesperado: ${model.shellMaterial}`);
  assert(model.noFaceReceivers,'Quedan receptores de sombra en la cara');
  assert(model.shellVertices>=1000,`Cabeza demasiado simple: ${model.shellVertices}`);
  assert(/V2\.5/.test(model.profile),`Perfil inesperado: ${model.profile}`);
  assert(model.code==='player_barbary_macaque_v2',`Código inesperado: ${model.code}`);
  assert(model.meshCount<=680,`Demasiadas mallas: ${model.meshCount}`);

  const sectionIds=await page.evaluate(()=>window.WAFTVisualLab0181.getSections().map(section=>section.id));
  assert(sectionIds.length===8&&new Set(sectionIds).size===8,'Las ocho secciones no están disponibles');
  for(const id of sectionIds){await page.evaluate(sectionId=>window.WAFTVisualLab0181.focus(sectionId,true),id);await page.waitForTimeout(70);assert(await page.evaluate(()=>window.WAFTVisualLab0181.getState().activeSection)===id,`No se pudo enfocar ${id}`);}
  await page.evaluate(()=>window.WAFTVisualLab0181.focus('macaque',true));
  await page.waitForTimeout(550);
  if(options.screenshot)await page.screenshot({path:options.screenshot,type:'png'});
  assert(pageErrors.length===0,`Errores de página: ${pageErrors.join(' | ')}`);
  assert(consoleErrors.length===0,`Errores de consola: ${consoleErrors.join(' | ')}`);
  assert(requestFailures.length===0,`Fallos de red: ${requestFailures.join(' | ')}`);

  const report={formatVersion:1,valid:true,public:options.public,url:options.url,buildId:BUILD_ID,viewport:{width:844,height:390,mobile:true,touch:true},sectionIds,state,model,pageErrors,consoleErrors,requestFailures,verifiedAt:new Date().toISOString()};
  const output=path.resolve(ROOT,options.output);fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');process.stdout.write(JSON.stringify(report,null,2)+'\n');
}finally{await browser.close();}
