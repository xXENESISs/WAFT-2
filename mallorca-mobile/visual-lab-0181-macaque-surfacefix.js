'use strict';
(() => {
  const BUILD_ID='waft-visual-lab-0181-v8';
  const wait=()=>new Promise(resolve=>{const tick=()=>window.__WAFT_VISUAL_LAB_0181_MACAQUE_FACEFIX2__===true?resolve():setTimeout(tick,35);tick();});
  const C3=hex=>BABYLON.Color3.FromHexString(hex);

  function subtleTexture(scene,name,base,light,dark,seed){
    let state=seed>>>0;const rng=()=>{state=(state*1664525+1013904223)>>>0;return state/4294967296;};
    const texture=new BABYLON.DynamicTexture(name,{width:512,height:512},scene,false);const ctx=texture.getContext();ctx.fillStyle=base;ctx.fillRect(0,0,512,512);
    for(let i=0;i<6000;i++){
      const x=rng()*512,y=rng()*512,r=.25+rng()*1.4;
      ctx.globalAlpha=.025+rng()*.075;ctx.fillStyle=rng()>.5?light:dark;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;texture.update(false);texture.wrapU=texture.wrapV=BABYLON.Texture.WRAP_ADDRESSMODE;texture.anisotropicFilteringLevel=16;texture.updateSamplingMode(BABYLON.Texture.TRILINEAR_SAMPLINGMODE);return texture;
  }
  function pbr(scene,name,base,texture){const mat=new BABYLON.PBRMaterial(name,scene);mat.albedoColor=C3(base);mat.albedoTexture=texture;mat.metallic=0;mat.roughness=.96;mat.environmentIntensity=.62;mat.freeze();return mat;}
  function apply(scene){
    const headTexture=subtleTexture(scene,'macaqueV5HeadFurTexture','#7d6a55','#a89272','#584638',8701);
    const headFur=pbr(scene,'macaqueV5HeadFur','#7d6a55',headTexture);
    const creamTexture=subtleTexture(scene,'macaqueV5FaceFurTexture','#b09a7e','#cfbba0','#826c55',8713);
    const faceFur=pbr(scene,'macaqueV5FaceFur','#b09a7e',creamTexture);
    const headNames=['macaqueV2Head','macaqueV3TempleFur-1','macaqueV3TempleFur1','macaqueV4EarOuter-1','macaqueV4EarOuter1','macaqueV4Brow-1','macaqueV4Brow1'];
    const creamNames=['macaqueV2CheekL','macaqueV2CheekR','macaqueV3LowerCheek-1','macaqueV3LowerCheek1'];
    let headApplied=0,creamApplied=0;
    for(const name of headNames){const mesh=scene.getMeshByName(name);if(mesh){mesh.material=headFur;headApplied++;}}
    for(const name of creamNames){const mesh=scene.getMeshByName(name);if(mesh){mesh.material=faceFur;creamApplied++;}}
    const face=scene.getMeshByName('macaqueV2FaceMask');if(face){face.material=scene.getMaterialByName('macaqueV2Skin');}
    const muzzle=scene.getMeshByName('macaqueV2Muzzle');if(muzzle){muzzle.material=scene.getMaterialByName('macaqueV2Skin');}
    const head=scene.getMeshByName('macaqueV2Head');if(head){head.rotation.x=-.025;}
    const camera=scene.activeCamera;camera.setTarget(new BABYLON.Vector3(-23,3.05,-8));camera.radius=10.4;
    return{headApplied,creamApplied,textureCount:2};
  }
  function updateUi(){const profile=document.getElementById('profile');if(profile)profile.textContent='NÍTIDO · V2.3';const description=document.getElementById('sectionDescription');if(description)description.textContent='Macaco de Berbería joven con pelaje fino separado por zonas, cara limpia, ojos oscuros naturales, hocico corto y anatomía orgánica.';}

  wait().then(()=>{
    const scene=BABYLON.Engine.LastCreatedScene;if(!scene)throw new Error('No se encontró la escena.');
    const result=apply(scene);updateUi();
    const originalFocus=window.WAFTVisualLab0181.focus;
    window.WAFTVisualLab0181.focus=(id,instant=false)=>{originalFocus(id,instant);if(id==='macaque'){updateUi();if(instant){const camera=scene.activeCamera;camera.setTarget(new BABYLON.Vector3(-23,3.05,-8));camera.alpha=-Math.PI/2;camera.beta=1.15;camera.radius=10.4;}}};
    window.WAFTVisualLab0181.focus('macaque',true);
    const oldState=window.WAFTVisualLab0181.getState;
    window.WAFTVisualLab0181={...window.WAFTVisualLab0181,buildId:BUILD_ID,getState:()=>({...oldState(),buildId:BUILD_ID,macaqueSurfaceFix:true,headFurMeshes:result.headApplied,faceFurMeshes:result.creamApplied,macaqueSurfaceTextures:result.textureCount})};
    window.__WAFT_VISUAL_LAB_0181_MACAQUE_SURFACEFIX__=true;
  }).catch(error=>{console.error(error);window.__WAFT_VISUAL_LAB_0181_MACAQUE_SURFACEFIX_ERROR__=String(error?.message||error);});
})();
