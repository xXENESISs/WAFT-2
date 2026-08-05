'use strict';
(() => {
  const BUILD_ID = 'waft-visual-lab-0181-v3';
  const wait = () => new Promise(resolve => {
    const tick = () => window.__WAFT_VISUAL_LAB_0181_REFINED__ === true ? resolve() : setTimeout(tick, 40);
    tick();
  });
  const c3 = hex => BABYLON.Color3.FromHexString(hex);

  function brightenMaterial(material, ambient=0.34, emissive=0.07) {
    if (!material?.diffuseColor) return;
    material.unfreeze?.();
    material.ambientColor = material.diffuseColor.scale(ambient);
    material.emissiveColor = material.diffuseColor.scale(emissive);
    material.freeze?.();
  }
  function installLighting(scene, camera) {
    scene.ambientColor = new BABYLON.Color3(.38,.35,.31);
    const fill = new BABYLON.PointLight('reviewCameraFill', BABYLON.Vector3.Zero(), scene);
    fill.parent = camera;
    fill.position.copyFromFloats(0,1.6,0);
    fill.diffuse = c3('#ffe9c5');
    fill.specular = c3('#fff5df');
    fill.intensity = .72;
    fill.range = 34;
    const rim = new BABYLON.DirectionalLight('reviewRim', new BABYLON.Vector3(.45,-.35,.75), scene);
    rim.diffuse = c3('#bfe6dd');
    rim.intensity = .36;
    scene.lights.filter(light => light instanceof BABYLON.HemisphericLight).forEach(light => {
      light.intensity = Math.max(light.intensity,1.02);
      light.groundColor = c3('#766957');
    });
    scene.lights.filter(light => light instanceof BABYLON.DirectionalLight && light.name === 'sun').forEach(light => {
      light.intensity = 1.12;
      light.diffuse = c3('#ffe0a8');
    });
  }
  function polishMaterials(scene) {
    const important = ['furRefined','furDarkRefined','furLightRefined','skinRefined','muzzleRefined','eyeWhiteRefined','irisRefined','eyeShineRefined','noseRefined'];
    important.forEach(name => brightenMaterial(scene.getMaterialByName(name),.48,.12));
    scene.materials.forEach(material => {
      if (important.includes(material.name)) return;
      brightenMaterial(material,.22,.025);
    });
    const palette = {
      sand:'#b8a379', dryGrass:'#77744d', dirt:'#967052', greenGrass:'#58764f', rock:'#77736b',
      pavement:'#a9a293', asphalt:'#464b4b', stone:'#b2a184', plaster:'#d8caad', plasterPale:'#eadfc5',
      plasterGold:'#d2b77b', plasterWarm:'#c47f64', terracotta:'#a85a3f', water:'#4b91a0'
    };
    for (const [name,hex] of Object.entries(palette)) {
      const material=scene.getMaterialByName(name);if(!material)continue;material.unfreeze?.();material.diffuseColor=c3(hex);material.ambientColor=material.diffuseColor.scale(.25);material.freeze?.();
    }
  }
  function removeObstructions(scene) {
    let hiddenSigns=0;
    scene.meshes.forEach(mesh => {
      if (mesh.name.startsWith('sign-')) { mesh.setEnabled(false); hiddenSigns++; }
    });
    return hiddenSigns;
  }
  function polishPost(scene) {
    const config=scene.imageProcessingConfiguration;
    config.toneMappingEnabled=true;
    config.toneMappingType=BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
    config.exposure=1.22;
    config.contrast=1.03;
    config.vignetteEnabled=false;
    config.colorCurvesEnabled=false;
    scene.clearColor=new BABYLON.Color4(.61,.79,.85,1);
    scene.fogColor=c3('#acc9c6');
    const pipeline=scene.postProcesses?.length ? null : null;
    void pipeline;
  }
  function installFocus(scene,camera) {
    const originalFocus=window.WAFTVisualLab0181.focus;
    const focusSettings={
      macaque:{target:[-23,3.55,-8],alpha:-Math.PI/2,beta:1.17,radius:10.7},
      urban:{target:[-8,3.05,-8],alpha:-1.48,beta:1.14,radius:15.2},
      village:{target:[8,2.75,-8],alpha:-1.48,beta:1.15,radius:14.6},
      port:{target:[23,2.65,-8],alpha:-1.62,beta:1.13,radius:14.8},
      finca:{target:[-15,2.55,12],alpha:-1.25,beta:1.12,radius:14.5},
      mountain:{target:[2,3.55,12],alpha:-1.35,beta:1.03,radius:16.2},
      vegetation:{target:[19,2.55,12],alpha:-1.53,beta:1.13,radius:13.6},
      materials:{target:[2,1.2,27],alpha:-1.56,beta:1.13,radius:17.5}
    };
    window.WAFTVisualLab0181.focus=(id,instant=false)=>{
      originalFocus(id,instant);
      const setting=focusSettings[id];
      if (!setting || !instant) return;
      camera.setTarget(new BABYLON.Vector3(...setting.target));
      camera.alpha=setting.alpha;camera.beta=setting.beta;camera.radius=setting.radius;
    };
    window.WAFTVisualLab0181.focus('macaque',true);
    return focusSettings;
  }
  function polishUi() {
    const style=document.createElement('style');
    style.textContent=`
      #topbar{background:linear-gradient(180deg,rgba(10,27,31,.88),rgba(10,27,31,.72))}
      @media(max-height:520px) and (orientation:landscape){
        #topbar{height:43px;padding:5px 9px}
        #info{top:51px!important;left:7px!important;width:224px!important;max-height:122px!important;padding:8px 9px!important;background:rgba(10,27,31,.84)!important}
        #info p{line-height:1.3!important;margin:4px 0 6px!important}
        #sectionNav{left:238px!important;right:6px!important;bottom:5px!important;background:rgba(9,25,29,.84)!important}
        .sectionButton{min-width:112px!important}
      }`;
    document.head.append(style);
  }

  wait().then(() => {
    const scene=BABYLON.Engine.LastCreatedScene;
    if(!scene) throw new Error('No se encontró la escena para la pasada de pulido.');
    const camera=scene.activeCamera;
    const hiddenSigns=removeObstructions(scene);
    installLighting(scene,camera);
    polishMaterials(scene);
    polishPost(scene);
    polishUi();
    const focusSettings=installFocus(scene,camera);
    const oldState=window.WAFTVisualLab0181.getState;
    window.WAFTVisualLab0181={...window.WAFTVisualLab0181,buildId:BUILD_ID,getState:()=>({...oldState(),buildId:BUILD_ID,polishedReview:true,hiddenSigns,focusPresetCount:Object.keys(focusSettings).length})};
    window.__WAFT_VISUAL_LAB_0181_POLISHED__=true;
  }).catch(error=>{
    console.error(error);
    window.__WAFT_VISUAL_LAB_0181_POLISH_ERROR__=String(error?.message||error);
  });
})();
