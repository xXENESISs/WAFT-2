'use strict';
(() => {
  const BUILD_ID='waft-visual-lab-0181-v9';
  const wait=()=>new Promise(resolve=>{const tick=()=>window.__WAFT_VISUAL_LAB_0181_MACAQUE_SURFACEFIX__===true?resolve():setTimeout(tick,35);tick();});

  function ellipsoid(scene,name,position,scale,material,parent,segments=36){
    const mesh=BABYLON.MeshBuilder.CreateSphere(name,{segments,diameter:2},scene);
    mesh.position.copyFromFloats(...position);
    mesh.scaling.copyFromFloats(...scale);
    mesh.material=material;
    mesh.parent=parent;
    mesh.receiveShadows=true;
    mesh.isPickable=false;
    return mesh;
  }
  function set(mesh,position,scale,material=null){
    if(!mesh)return false;
    mesh.position.copyFromFloats(...position);
    mesh.scaling.copyFromFloats(...scale);
    if(material)mesh.material=material;
    return true;
  }

  function replaceHead(scene){
    const root=scene.getTransformNodeByName('barbaryMacaqueV2');
    if(!root)throw new Error('No se encontró el macaco v2.');
    const oldHead=scene.getMeshByName('macaqueV2Head');
    if(!oldHead)throw new Error('No se encontró la malla de cabeza defectuosa.');
    oldHead.setEnabled(false);

    const headFur=scene.getMaterialByName('macaqueV5HeadFur')||scene.getMaterialByName('macaqueV2Fur');
    const faceFur=scene.getMaterialByName('macaqueV5FaceFur')||scene.getMaterialByName('macaqueV2FurCream');
    const furDark=scene.getMaterialByName('macaqueV2FurDark');
    const skin=scene.getMaterialByName('macaqueV2Skin');
    const skinDark=scene.getMaterialByName('macaqueV2SkinDark');
    const nose=scene.getMaterialByName('macaqueV2Nose');

    const shell=ellipsoid(scene,'macaqueV6HeadShell',[0,4.30,-.40],[.77,.75,.67],headFur,root,40);
    shell.rotation.x=-.035;
    const crown=ellipsoid(scene,'macaqueV6Crown',[0,4.66,-.48],[.56,.30,.43],headFur,root,32);
    crown.rotation.x=-.08;
    const forehead=ellipsoid(scene,'macaqueV6Forehead',[0,4.48,-.83],[.48,.25,.17],headFur,root,32);
    forehead.rotation.x=-.09;
    for(const side of[-1,1]){
      const temple=ellipsoid(scene,`macaqueV6Temple${side}`,[side*.49,4.38,-.67],[.29,.40,.25],headFur,root,30);
      temple.rotation.z=side*.08;
      const cheek=scene.getMeshByName(side<0?'macaqueV2CheekL':'macaqueV2CheekR');
      set(cheek,[side*.43,4.18,-.76],[.29,.35,.22],faceFur);
      const earOuter=scene.getMeshByName(`macaqueV4EarOuter${side}`);
      const earInner=scene.getMeshByName(`macaqueV4EarInner${side}`);
      set(earOuter,[side*.73,4.29,-.39],[.13,.17,.06],headFur);
      set(earInner,[side*.742,4.29,-.443],[.070,.100,.024],skin);
      const brow=scene.getMeshByName(`macaqueV4Brow${side}`);
      set(brow,[side*.22,4.48,-1.00],[.17,.040,.030],furDark);
      if(brow)brow.rotation.z=-side*.08;
      const eyelid=scene.getMeshByName(`macaqueV4Eyelid${side}`);
      set(eyelid,[side*.22,4.405,-1.055],[.105,.020,.014],skinDark);
    }

    const face=scene.getMeshByName('macaqueV2FaceMask');
    const muzzle=scene.getMeshByName('macaqueV2Muzzle');
    const noseMesh=scene.getMeshByName('macaqueV2Nose');
    const nostrilL=scene.getMeshByName('macaqueV2NostrilL');
    const nostrilR=scene.getMeshByName('macaqueV2NostrilR');
    const chin=scene.getMeshByName('macaqueV3Chin');
    const lowerLip=scene.getMeshByName('macaqueV3LipLower');
    set(face,[0,4.22,-.88],[.54,.46,.15],skin);
    set(muzzle,[0,3.99,-1.055],[.38,.19,.115],skin);
    set(noseMesh,[0,4.075,-1.165],[.14,.068,.038],nose);
    set(nostrilL,[-.052,4.078,-1.198],[.020,.012,.008]);
    set(nostrilR,[.052,4.078,-1.198],[.020,.012,.008]);
    set(chin,[0,3.86,-1.025],[.22,.095,.065],skin);
    set(lowerLip,[0,3.915,-1.145],[.15,.027,.020],nose);
    const bridge=ellipsoid(scene,'macaqueV6NoseBridge',[0,4.19,-1.015],[.095,.15,.045],skinDark,root,26);
    bridge.rotation.x=-.06;

    const directional=scene.lights.find(light=>light instanceof BABYLON.DirectionalLight);
    const shadows=directional?.getShadowGenerator?.();
    if(shadows)[shell,crown,forehead,bridge,...root.getChildMeshes(false).filter(mesh=>mesh.name.startsWith('macaqueV6Temple'))].forEach(mesh=>shadows.addShadowCaster(mesh));

    return{
      oldHeadHidden:!oldHead.isEnabled(),
      shellVertices:shell.getTotalVertices(),
      shellMeshes:5,
      faceRepositioned:Boolean(face&&muzzle&&noseMesh)
    };
  }

  function updateUi(){
    const profile=document.getElementById('profile');if(profile)profile.textContent='NÍTIDO · V2.4';
    const description=document.getElementById('sectionDescription');if(description)description.textContent='Macaco de Berbería joven con cabeza orgánica continua, cara corta, orejas pequeñas, mirada natural y pelaje fino sin artefactos.';
  }

  wait().then(()=>{
    const scene=BABYLON.Engine.LastCreatedScene;if(!scene)throw new Error('No se encontró la escena.');
    const result=replaceHead(scene);updateUi();
    const originalFocus=window.WAFTVisualLab0181.focus;
    window.WAFTVisualLab0181.focus=(id,instant=false)=>{originalFocus(id,instant);if(id==='macaque'){updateUi();if(instant){const camera=scene.activeCamera;camera.setTarget(new BABYLON.Vector3(-23,3.08,-8));camera.alpha=-Math.PI/2;camera.beta=1.14;camera.radius=10.3;}}};
    window.WAFTVisualLab0181.focus('macaque',true);
    const oldState=window.WAFTVisualLab0181.getState;
    window.WAFTVisualLab0181={...window.WAFTVisualLab0181,buildId:BUILD_ID,getState:()=>({...oldState(),buildId:BUILD_ID,macaqueHeadShell:true,oldHeadHidden:result.oldHeadHidden,headShellVertices:result.shellVertices,headShellMeshes:result.shellMeshes,headFaceRepositioned:result.faceRepositioned})};
    window.__WAFT_VISUAL_LAB_0181_MACAQUE_HEADSHELL__=true;
  }).catch(error=>{console.error(error);window.__WAFT_VISUAL_LAB_0181_MACAQUE_HEADSHELL_ERROR__=String(error?.message||error);});
})();
