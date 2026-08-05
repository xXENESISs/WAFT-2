import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const BUILD_ID='waft-visual-lab-0181-v12';
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
  await page.waitForFunction(()=>window.__WAFT_VISUAL_LAB_0181_ARCHITECTURE_V2__===true&&Boolean(window.WAFTVisualLab0181?.getState),null,{timeout:120000});
  await page.waitForTimeout(1900);
  const state=await page.evaluate(()=>window.WAFTVisualLab0181.getState());
  assert(state.buildId===BUILD_ID,`Build inesperada: ${state.buildId}`);
  assert(state.crispRender===true,'La pasada nítida no está activa');
  assert(state.macaqueBlinkFix===true,'La corrección ocular no está activa');
  assert(state.correctedEyeParts===6,`Solo se corrigieron ${state.correctedEyeParts} piezas oculares`);
  assert(state.architectureV2===true,'La arquitectura v2 no está activa');
  assert(state.urbanV2Buildings===3,`Hay ${state.urbanV2Buildings} edificios urbanos`);
  assert(state.villageV2Houses===6,`Hay ${state.villageV2Houses} casas de pueblo`);
  assert(state.oldUrbanMeshesHidden>=5,`Solo se ocultaron ${state.oldUrbanMeshesHidden} piezas urbanas antiguas`);
  assert(state.oldVillageMeshesHidden>=5,`Solo se ocultaron ${state.oldVillageMeshesHidden} piezas antiguas del pueblo`);
  assert(state.architectureV2ShadowCasters>=100,`Solo hay ${state.architectureV2ShadowCasters} sombras arquitectónicas`);
  assert(state.webgl2===true,'WebGL2 no está activo');
  assert(state.crispHardwareScaling<=1.01,`Escalado borroso: ${state.crispHardwareScaling}`);

  const model=await page.evaluate(()=>{
    const scene=BABYLON.Engine.LastCreatedScene;
    const eyeNames=['macaqueV2Eyeball-1','macaqueV2Eyeball1','macaqueV2Iris-1','macaqueV2Iris1','macaqueV2Catchlight-1','macaqueV2Catchlight1'];
    const eyeParts=eyeNames.map(name=>{const mesh=scene.getMeshByName(name);mesh?.computeWorldMatrix(true);const box=mesh?.getBoundingInfo().boundingBox;const size=box?box.maximumWorld.subtract(box.minimumWorld):BABYLON.Vector3.Zero();return{name,scaleY:mesh?.scaling.y||0,sizeY:size.y};});
    const urbanStage=scene.getTransformNodeByName('archV2UrbanStage');
    const villageStage=scene.getTransformNodeByName('archV2VillageStage');
    return{
      allEyesCompact:eyeParts.every(part=>part.scaleY<=.1&&part.sizeY<.3),
      eyeParts,
      urbanEnabled:Boolean(urbanStage?.isEnabled()),
      urbanMeshes:urbanStage?.getChildMeshes(false).filter(mesh=>mesh.isEnabled()).length||0,
      villageEnabled:Boolean(villageStage?.isEnabled()),
      villageMeshes:villageStage?.getChildMeshes(false).filter(mesh=>mesh.isEnabled()).length||0,
      urbanBuildingNodes:scene.transformNodes.filter(node=>node.name==='archV2UrbanBuilding').length,
      villageHouseNodes:scene.transformNodes.filter(node=>node.name==='archV2VillageHouse').length,
      architectureMaterials:scene.materials.filter(material=>material.name.startsWith('archV2')).length,
      meshCount:scene.meshes.length
    };
  });
  assert(model.allEyesCompact,`Persisten ojos estirados: ${JSON.stringify(model.eyeParts)}`);
  assert(model.urbanEnabled&&model.urbanMeshes>=120,`Kit urbano incompleto: ${model.urbanMeshes} mallas`);
  assert(model.villageEnabled&&model.villageMeshes>=100,`Kit de pueblo incompleto: ${model.villageMeshes} mallas`);
  assert(model.urbanBuildingNodes===3,`Nodos urbanos inesperados: ${model.urbanBuildingNodes}`);
  assert(model.villageHouseNodes===6,`Nodos de casas inesperados: ${model.villageHouseNodes}`);
  assert(model.architectureMaterials>=18,`Solo hay ${model.architectureMaterials} materiales de arquitectura`);
  assert(model.meshCount<=1050,`Demasiadas mallas: ${model.meshCount}`);

  const sectionIds=await page.evaluate(()=>window.WAFTVisualLab0181.getSections().map(section=>section.id));
  assert(sectionIds.length===8&&new Set(sectionIds).size===8,'Las ocho secciones no están disponibles');
  for(const id of sectionIds){await page.evaluate(sectionId=>window.WAFTVisualLab0181.focus(sectionId,true),id);await page.waitForTimeout(70);assert(await page.evaluate(()=>window.WAFTVisualLab0181.getState().activeSection)===id,`No se pudo enfocar ${id}`);}
  if(options.screenshot){
    const ext=path.extname(options.screenshot),base=options.screenshot.slice(0,-ext.length);
    await page.evaluate(()=>window.WAFTVisualLab0181.focus('macaque',true));await page.waitForTimeout(550);await page.screenshot({path:options.screenshot,type:'png'});
    await page.evaluate(()=>window.WAFTVisualLab0181.focus('urban',true));await page.waitForTimeout(550);await page.screenshot({path:`${base}-urban${ext}`,type:'png'});
    await page.evaluate(()=>window.WAFTVisualLab0181.focus('village',true));await page.waitForTimeout(550);await page.screenshot({path:`${base}-village${ext}`,type:'png'});
  }
  assert(pageErrors.length===0,`Errores de página: ${pageErrors.join(' | ')}`);
  assert(consoleErrors.length===0,`Errores de consola: ${consoleErrors.join(' | ')}`);
  assert(requestFailures.length===0,`Fallos de red: ${requestFailures.join(' | ')}`);

  const report={formatVersion:1,valid:true,public:options.public,url:options.url,buildId:BUILD_ID,viewport:{width:844,height:390,mobile:true,touch:true},sectionIds,state,model,pageErrors,consoleErrors,requestFailures,verifiedAt:new Date().toISOString()};
  const output=path.resolve(ROOT,options.output);fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');process.stdout.write(JSON.stringify(report,null,2)+'\n');
}finally{await browser.close();}
