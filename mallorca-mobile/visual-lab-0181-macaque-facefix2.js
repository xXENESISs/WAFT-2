'use strict';
(() => {
  const BUILD_ID='waft-visual-lab-0181-v7';
  const wait=()=>new Promise(resolve=>{const tick=()=>window.__WAFT_VISUAL_LAB_0181_MACAQUE_FACEFIX__===true?resolve():setTimeout(tick,35);tick();});
  const C3=hex=>BABYLON.Color3.FromHexString(hex);

  function ellipsoid(scene,name,position,scale,material,parent,segments=26){
    const mesh=BABYLON.MeshBuilder.CreateSphere(name,{segments,diameter:2},scene);
    mesh.position.copyFromFloats(...position);
    mesh.scaling.copyFromFloats(...scale);
    mesh.material=material;
    mesh.parent=parent;
    mesh.receiveShadows=true;
    mesh.isPickable=false;
    return mesh;
  }
  function hide(scene,names){let count=0;for(const name of names){const mesh=scene.getMeshByName(name);if(mesh){mesh.setEnabled(false);count++;}}return count;}
  function set(mesh,position,scale,material=null){if(!mesh)return false;mesh.position.copyFromFloats(...position);mesh.scaling.copyFromFloats(...scale);if(material)mesh.material=material;return true;}
  function tint(material,hex){if(!material)return;material.unfreeze?.();if('albedoColor'in material)material.albedoColor=C3(hex);else if('diffuseColor'in material)material.diffuseColor=C3(hex);material.freeze?.();}

  function apply(scene){
    const root=scene.getTransformNodeByName('barbaryMacaqueV2');
    if(!root)throw new Error('No se encontró el macaco v2.');
    const fur=scene.getMaterialByName('macaqueV2Fur');
    const furDark=scene.getMaterialByName('macaqueV2FurDark');
    const furCream=scene.getMaterialByName('macaqueV2FurCream');
    const skin=scene.getMaterialByName('macaqueV2Skin');
    const skinDark=scene.getMaterialByName('macaqueV2SkinDark');
    const nose=scene.getMaterialByName('macaqueV2Nose');
    tint(fur,'#806c55');
    tint(furDark,'#5a493b');
    tint(furCream,'#b39d80');

    const hidden=hide(scene,[
      'macaqueV3EarOuter-1','macaqueV3EarOuter1','macaqueV3EarInner-1','macaqueV3EarInner1',
      'macaqueV2Brow-1','macaqueV2Brow1','macaqueV3NoseBridge'
    ]);

    const face=scene.getMeshByName('macaqueV2FaceMask');
    const muzzle=scene.getMeshByName('macaqueV2Muzzle');
    const noseMesh=scene.getMeshByName('macaqueV2Nose');
    const nostrilL=scene.getMeshByName('macaqueV2NostrilL');
    const nostrilR=scene.getMeshByName('macaqueV2NostrilR');
    set(face,[0,4.24,-.80],[.58,.47,.15],skin);
    set(muzzle,[0,4.01,-1.02],[.41,.21,.135],skin);
    set(noseMesh,[0,4.09,-1.155],[.16,.072,.042],nose);
    set(nostrilL,[-.060,4.09,-1.193],[.023,.014,.010]);
    set(nostrilR,[.060,4.09,-1.193],[.023,.014,.010]);

    for(const side of[-1,1]){
      const socket=scene.getMeshByName(`macaqueV2EyeSocket${side}`);
      const eyeball=scene.getMeshByName(`macaqueV2Eyeball${side}`);
      const iris=scene.getMeshByName(`macaqueV2Iris${side}`);
      const shine=scene.getMeshByName(`macaqueV2Catchlight${side}`);
      set(socket,[side*.225,4.37,-.975],[.145,.115,.045]);
      set(eyeball,[side*.225,4.37,-1.020],[.098,.086,.043]);
      set(iris,[side*.225,4.37,-1.058],[.052,.052,.018]);
      set(shine,[side*.205,4.398,-1.074],[.018,.018,.009]);

      const outer=ellipsoid(scene,`macaqueV4EarOuter${side}`,[side*.80,4.31,-.35],[.14,.18,.065],fur,root,24);
      outer.rotation.z=side*.07;
      const inner=ellipsoid(scene,`macaqueV4EarInner${side}`,[side*.81,4.31,-.405],[.072,.105,.025],skin,root,20);
      inner.rotation.z=side*.07;
      const brow=ellipsoid(scene,`macaqueV4Brow${side}`,[side*.225,4.50,-1.005],[.18,.045,.035],furDark,root,20);
      brow.rotation.z=-side*.10;
      ellipsoid(scene,`macaqueV4Eyelid${side}`,[side*.225,4.405,-1.052],[.108,.025,.018],skinDark,root,18);
    }

    const lip=scene.getMeshByName('macaqueV3LipLower');
    if(lip)set(lip,[0,3.92,-1.13],[.17,.032,.025],nose);
    const chin=scene.getMeshByName('macaqueV3Chin');
    if(chin)set(chin,[0,3.88,-1.01],[.25,.11,.08],skin);

    const crisp=scene.postProcesses.find(post=>post.name==='waftCrispSharpen');
    if(crisp){crisp.edgeAmount=.07;crisp.colorAmount=.86;}
    const pipelines=scene.postProcessRenderPipelineManager?._renderPipelines||{};
    for(const pipeline of Object.values(pipelines)){if(pipeline?.sharpen){pipeline.sharpen.edgeAmount=.08;pipeline.sharpen.colorAmount=.78;}}

    return{hidden,ears:4,brows:2,eyes:2};
  }

  function updateUi(){
    const description=document.getElementById('sectionDescription');
    if(description)description.textContent='Macaco de Berbería joven con anatomía orgánica, orejas laterales pequeñas, ojos oscuros naturales, hocico corto y pelaje nítido sin contornos exagerados.';
    const profile=document.getElementById('profile');if(profile)profile.textContent='NÍTIDO · V2.2';
  }

  wait().then(()=>{
    const scene=BABYLON.Engine.LastCreatedScene;if(!scene)throw new Error('No se encontró la escena.');
    const result=apply(scene);updateUi();
    const originalFocus=window.WAFTVisualLab0181.focus;
    window.WAFTVisualLab0181.focus=(id,instant=false)=>{originalFocus(id,instant);if(id==='macaque'){updateUi();if(instant){const camera=scene.activeCamera;camera.setTarget(new BABYLON.Vector3(-23,3.0,-8));camera.alpha=-Math.PI/2;camera.beta=1.15;camera.radius=10.5;}}};
    window.WAFTVisualLab0181.focus('macaque',true);
    const oldState=window.WAFTVisualLab0181.getState;
    window.WAFTVisualLab0181={...window.WAFTVisualLab0181,buildId:BUILD_ID,getState:()=>({...oldState(),buildId:BUILD_ID,macaqueFaceFix2:true,unstableFacePartsHidden:result.hidden,compactEarParts:result.ears,stableBrowParts:result.brows,naturalEyePairsV2:result.eyes})};
    window.__WAFT_VISUAL_LAB_0181_MACAQUE_FACEFIX2__=true;
  }).catch(error=>{console.error(error);window.__WAFT_VISUAL_LAB_0181_MACAQUE_FACEFIX2_ERROR__=String(error?.message||error);});
})();
