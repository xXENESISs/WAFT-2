import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const BUILD_ID='waft-visual-lab-0181-v11';
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
  await page.waitForFunction(()=>window.__WAFT_VISUAL_LAB_0181_MACAQUE_BLINKFIX__===true&&Boolean(window.WAFTVisualLab0181?.getState),null,{timeout:120000});
  await page.waitForTimeout(1700);
  const state=await page.evaluate(()=>window.WAFTVisualLab0181.getState());
  assert(state.buildId===BUILD_ID,`Build inesperada: ${state.buildId}`);
  assert(state.crispRender===true,'La pasada nítida no está activa');
  assert(state.macaqueV2===true,'El macaco v2 no está activo');
  assert(state.macaqueHeadShell===true,'La cabeza orgánica no está activa');
  assert(state.macaqueBlinkFix===true,'La corrección de parpadeo no está activa');
  assert(state.correctedEyeParts===6,`Solo se corrigieron ${state.correctedEyeParts} piezas oculares`);
  assert(state.maxCorrectedEyeScaleY<=.1,`Escala ocular excesiva: ${state.maxCorrectedEyeScaleY}`);
  assert(state.oldHeadHidden===true,'La cabeza defectuosa sigue visible');
  assert(state.headSelfShadowDisabled===true,'El autosombreado facial sigue activo');
  assert(state.webgl2===true,'WebGL2 no está activo');
  assert(state.crispHardwareScaling<=1.01,`Escalado borroso: ${state.crispHardwareScaling}`);

  const model=await page.evaluate(()=>{
    const scene=BABYLON.Engine.LastCreatedScene;
    const names=['macaqueV2Eyeball-1','macaqueV2Eyeball1','macaqueV2Iris-1','macaqueV2Iris1','macaqueV2Catchlight-1','macaqueV2Catchlight1'];
    const eyeParts=names.map(name=>{
      const mesh=scene.getMeshByName(name);mesh?.computeWorldMatrix(true);const box=mesh?.getBoundingInfo().boundingBox;const size=box?box.maximumWorld.subtract(box.minimumWorld):BABYLON.Vector3.Zero();
      return{name,enabled:Boolean(mesh?.isEnabled()),scaleY:mesh?.scaling.y||0,sizeY:size.y};
    });
    const shell=scene.getMeshByName('macaqueV6HeadShell');
    return{
      eyeParts,
      allEyesCompact:eyeParts.every(part=>part.enabled&&part.scaleY<=.1&&part.sizeY<.3),
      shellEnabled:Boolean(shell?.isEnabled()),
      profile:document.getElementById('profile')?.textContent||'',
      code:document.getElementById('sectionCode')?.textContent||'',
      meshCount:scene.meshes.length
    };
  });
  assert(model.allEyesCompact,`Persisten piezas oculares estiradas: ${JSON.stringify(model.eyeParts)}`);
  assert(model.shellEnabled,'La cabeza orgánica no está visible');
  assert(/V2\.6/.test(model.profile),`Perfil inesperado: ${model.profile}`);
  assert(model.code==='player_barbary_macaque_v2',`Código inesperado: ${model.code}`);
  assert(model.meshCount<=680,`Demasiadas mallas: ${model.meshCount}`);

  const sectionIds=await page.evaluate(()=>window.WAFTVisualLab0181.getSections().map(section=>section.id));
  assert(sectionIds.length===8&&new Set(sectionIds).size===8,'Las ocho secciones no están disponibles');
  for(const id of sectionIds){await page.evaluate(sectionId=>window.WAFTVisualLab0181.focus(sectionId,true),id);await page.waitForTimeout(70);assert(await page.evaluate(()=>window.WAFTVisualLab0181.getState().activeSection)===id,`No se pudo enfocar ${id}`);}
  await page.evaluate(()=>window.WAFTVisualLab0181.focus('macaque',true));
  await page.waitForTimeout(650);
  if(options.screenshot)await page.screenshot({path:options.screenshot,type:'png'});
  assert(pageErrors.length===0,`Errores de página: ${pageErrors.join(' | ')}`);
  assert(consoleErrors.length===0,`Errores de consola: ${consoleErrors.join(' | ')}`);
  assert(requestFailures.length===0,`Fallos de red: ${requestFailures.join(' | ')}`);

  const report={formatVersion:1,valid:true,public:options.public,url:options.url,buildId:BUILD_ID,viewport:{width:844,height:390,mobile:true,touch:true},sectionIds,state,model,pageErrors,consoleErrors,requestFailures,verifiedAt:new Date().toISOString()};
  const output=path.resolve(ROOT,options.output);fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');process.stdout.write(JSON.stringify(report,null,2)+'\n');
}finally{await browser.close();}
