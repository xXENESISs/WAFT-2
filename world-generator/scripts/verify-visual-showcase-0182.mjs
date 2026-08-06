import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const BUILD_ID='waft-showcase-0182-v1';
function assert(value,message){if(!value)throw new Error(message);}
function chromePath(){for(const candidate of [process.env.CHROME_BIN,'/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser'].filter(Boolean)){if(fs.existsSync(candidate))return candidate;}throw new Error('Chrome no está disponible');}
function args(){const out={url:null,output:null,screenshot:null,public:false};const values=process.argv.slice(2);while(values.length){const flag=values.shift();if(flag==='--url')out.url=values.shift();else if(flag==='--output')out.output=values.shift();else if(flag==='--screenshot')out.screenshot=values.shift();else if(flag==='--public')out.public=true;else throw new Error(`Argumento desconocido: ${flag}`);}assert(out.url&&out.output,'--url y --output son obligatorios');return out;}

const options=args();
const browser=await chromium.launch({executablePath:chromePath(),headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-background-networking']});
const errors=[];const failed=[];
try{
  const context=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('404'))errors.push(message.text());});
  page.on('requestfailed',request=>{if(!request.url().endsWith('/favicon.ico'))failed.push(`${request.url()}: ${request.failure()?.errorText||'failed'}`);});
  const response=await page.goto(options.url,{waitUntil:'domcontentloaded',timeout:120000});
  assert(response?.ok(),`La página devolvió ${response?.status()}`);
  await page.waitForFunction(()=>window.__WAFT_VISUAL_SHOWCASE_0182_READY__===true&&Boolean(window.WAFTVisualShowcase0182?.getState),null,{timeout:120000});
  await page.waitForTimeout(650);
  const initial=await page.evaluate(()=>window.WAFTVisualShowcase0182.getState());
  assert(initial.buildId===BUILD_ID,`Build inesperada: ${initial.buildId}`);
  assert(initial.sectionCount===8,`Secciones inesperadas: ${initial.sectionCount}`);
  assert(initial.imageWidth>=900&&initial.imageHeight>=630,`Imagen insuficiente: ${initial.imageWidth}x${initial.imageHeight}`);
  const initialGeometry=await page.evaluate(()=>{const image=document.getElementById('board').getBoundingClientRect();const viewer=document.getElementById('viewer').getBoundingClientRect();return{image,viewer,overlap:image.right>viewer.left&&image.left<viewer.right&&image.bottom>viewer.top&&image.top<viewer.bottom};});
  assert(initialGeometry.overlap,'La imagen inicial no cruza el visor');
  const ids=await page.evaluate(()=>window.WAFTVisualShowcase0182.getSections().map(item=>item.id));
  for(const id of ids){await page.evaluate(value=>window.WAFTVisualShowcase0182.focus(value),id);await page.waitForTimeout(100);assert(await page.evaluate(()=>window.WAFTVisualShowcase0182.getState().activeSection)===id,`No se enfocó ${id}`);}
  await page.evaluate(()=>window.WAFTVisualShowcase0182.focus('urban'));
  await page.locator('[data-vote="approved"]').click();
  const voted=await page.evaluate(()=>window.WAFTVisualShowcase0182.getState().feedback.urban);
  assert(voted==='approved','La aprobación no se guardó');
  await page.evaluate(()=>window.WAFTVisualShowcase0182.overview());
  await page.waitForTimeout(700);
  assert(await page.evaluate(()=>window.WAFTVisualShowcase0182.getState().overview)===true,'La vista general no se restauró');
  const finalGeometry=await page.evaluate(()=>{const image=document.getElementById('board').getBoundingClientRect();const viewer=document.getElementById('viewer').getBoundingClientRect();return{image,viewer,overlap:image.right>viewer.left&&image.left<viewer.right&&image.bottom>viewer.top&&image.top<viewer.bottom};});
  assert(finalGeometry.overlap,'La imagen final no cruza el visor');
  assert(errors.length===0,`Errores: ${errors.join(' | ')}`);
  assert(failed.length===0,`Fallos de red: ${failed.join(' | ')}`);
  if(options.screenshot)await page.screenshot({path:options.screenshot,type:'png'});
  const report={formatVersion:1,valid:true,public:options.public,url:options.url,buildId:BUILD_ID,viewport:{width:844,height:390,mobile:true,touch:true},sectionIds:ids,state:await page.evaluate(()=>window.WAFTVisualShowcase0182.getState()),initialGeometry,finalGeometry,errors,failed,verifiedAt:new Date().toISOString()};
  const output=path.resolve(ROOT,options.output);fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
}finally{await browser.close();}
