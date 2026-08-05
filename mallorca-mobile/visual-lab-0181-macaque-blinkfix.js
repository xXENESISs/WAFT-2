'use strict';
(() => {
  const BUILD_ID='waft-visual-lab-0181-v11';
  const wait=()=>new Promise(resolve=>{const tick=()=>window.__WAFT_VISUAL_LAB_0181_MACAQUE_HEADSHELL__===true?resolve():setTimeout(tick,35);tick();});

  function apply(scene){
    const eyeParts=[];
    for(const side of[-1,1]){
      const eyeball=scene.getMeshByName(`macaqueV2Eyeball${side}`);
      const iris=scene.getMeshByName(`macaqueV2Iris${side}`);
      const catchlight=scene.getMeshByName(`macaqueV2Catchlight${side}`);
      if(eyeball)eyeParts.push({mesh:eyeball,baseY:.086});
      if(iris)eyeParts.push({mesh:iris,baseY:.052});
      if(catchlight)eyeParts.push({mesh:catchlight,baseY:.018});
    }
    if(eyeParts.length!==6)throw new Error(`Se esperaban 6 piezas oculares y hay ${eyeParts.length}.`);

    const correct=()=>{
      const t=performance.now()*.001;
      const phase=t%5.4;
      const blink=phase>5.18?Math.max(.10,Math.abs(phase-5.29)*9):1;
      for(const part of eyeParts)part.mesh.scaling.y=part.baseY*blink;
    };
    correct();
    scene.onBeforeRenderObservable.add(correct);

    return{
      eyeParts:eyeParts.length,
      maxEyeScaleY:Math.max(...eyeParts.map(part=>part.mesh.scaling.y)),
      correctedNames:eyeParts.map(part=>part.mesh.name)
    };
  }

  function updateUi(){
    const profile=document.getElementById('profile');if(profile)profile.textContent='NÍTIDO · V2.6';
    const description=document.getElementById('sectionDescription');if(description)description.textContent='Macaco de Berbería joven con cabeza orgánica limpia, ojos proporcionados y parpadeo corregido, cara corta y pelaje fino.';
  }

  wait().then(()=>{
    const scene=BABYLON.Engine.LastCreatedScene;if(!scene)throw new Error('No se encontró la escena.');
    const result=apply(scene);updateUi();
    const originalFocus=window.WAFTVisualLab0181.focus;
    window.WAFTVisualLab0181.focus=(id,instant=false)=>{originalFocus(id,instant);if(id==='macaque'){updateUi();if(instant){const camera=scene.activeCamera;camera.setTarget(new BABYLON.Vector3(-23,3.08,-8));camera.alpha=-Math.PI/2;camera.beta=1.14;camera.radius=10.3;}}};
    window.WAFTVisualLab0181.focus('macaque',true);
    const oldState=window.WAFTVisualLab0181.getState;
    window.WAFTVisualLab0181={...window.WAFTVisualLab0181,buildId:BUILD_ID,getState:()=>({...oldState(),buildId:BUILD_ID,macaqueBlinkFix:true,correctedEyeParts:result.eyeParts,maxCorrectedEyeScaleY:result.maxEyeScaleY,correctedEyeNames:result.correctedNames})};
    window.__WAFT_VISUAL_LAB_0181_MACAQUE_BLINKFIX__=true;
  }).catch(error=>{console.error(error);window.__WAFT_VISUAL_LAB_0181_MACAQUE_BLINKFIX_ERROR__=String(error?.message||error);});
})();
