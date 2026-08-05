'use strict';
(() => {
  const BUILD_ID = 'waft-visual-lab-0181-v6';
  const wait = () => new Promise(resolve => {
    const tick = () => window.__WAFT_VISUAL_LAB_0181_MACAQUE_V2__ === true ? resolve() : setTimeout(tick, 35);
    tick();
  });
  const C3 = hex => BABYLON.Color3.FromHexString(hex);

  function material(scene,name,hex,roughness=.9) {
    const mat=new BABYLON.PBRMaterial(name,scene);
    mat.albedoColor=C3(hex);
    mat.metallic=0;
    mat.roughness=roughness;
    mat.environmentIntensity=.6;
    mat.freeze();
    return mat;
  }

  function ellipsoid(scene,name,position,scale,mat,parent,segments=28) {
    const mesh=BABYLON.MeshBuilder.CreateSphere(name,{segments,diameter:2},scene);
    mesh.position.copyFromFloats(...position);
    mesh.scaling.copyFromFloats(...scale);
    mesh.material=mat;
    mesh.parent=parent;
    mesh.receiveShadows=true;
    mesh.isPickable=false;
    return mesh;
  }

  function setTransform(mesh,position,scale) {
    if (!mesh) return false;
    mesh.position.copyFromFloats(...position);
    mesh.scaling.copyFromFloats(...scale);
    return true;
  }

  function softenSharpen(scene) {
    const crisp=scene.postProcesses.find(post=>post.name==='waftCrispSharpen');
    if (crisp) {
      crisp.edgeAmount=.11;
      crisp.colorAmount=.9;
    }
    const pipelines=scene.postProcessRenderPipelineManager?._renderPipelines||{};
    for (const pipeline of Object.values(pipelines)) {
      if (!pipeline?.sharpen) continue;
      pipeline.sharpen.edgeAmount=.13;
      pipeline.sharpen.colorAmount=.84;
    }
  }

  function fixFace(scene) {
    const root=scene.getTransformNodeByName('barbaryMacaqueV2');
    if (!root) throw new Error('No se encontró el macaco v2 para corregir la cara.');

    const oldEarNames=['macaqueV2EarL','macaqueV2EarR','macaqueV2EarLInner','macaqueV2EarRInner'];
    let hiddenOldEars=0;
    for (const name of oldEarNames) {
      const mesh=scene.getMeshByName(name);
      if (mesh) { mesh.setEnabled(false); hiddenOldEars++; }
    }

    const skin=scene.getMaterialByName('macaqueV2Skin')||material(scene,'macaqueV3Skin','#ad7766');
    const skinDark=scene.getMaterialByName('macaqueV2SkinDark')||material(scene,'macaqueV3SkinDark','#765047');
    const fur=scene.getMaterialByName('macaqueV2Fur');
    const furCream=scene.getMaterialByName('macaqueV2FurCream');
    const nose=scene.getMaterialByName('macaqueV2Nose');
    const eye=scene.getMaterialByName('macaqueV2Eye');
    const catchlight=scene.getMaterialByName('macaqueV2Catchlight');

    const face=scene.getMeshByName('macaqueV2FaceMask');
    const muzzle=scene.getMeshByName('macaqueV2Muzzle');
    const noseMesh=scene.getMeshByName('macaqueV2Nose');
    const nostrilL=scene.getMeshByName('macaqueV2NostrilL');
    const nostrilR=scene.getMeshByName('macaqueV2NostrilR');
    setTransform(face,[0,4.22,-.86],[.60,.50,.18]);
    setTransform(muzzle,[0,4.00,-1.09],[.45,.235,.17]);
    setTransform(noseMesh,[0,4.08,-1.265],[.17,.10,.065]);
    setTransform(nostrilL,[-.065,4.085,-1.322],[.026,.019,.012]);
    setTransform(nostrilR,[.065,4.085,-1.322],[.026,.019,.012]);

    for (const side of [-1,1]) {
      const socket=scene.getMeshByName(`macaqueV2EyeSocket${side}`);
      const eyeball=scene.getMeshByName(`macaqueV2Eyeball${side}`);
      const iris=scene.getMeshByName(`macaqueV2Iris${side}`);
      const shine=scene.getMeshByName(`macaqueV2Catchlight${side}`);
      setTransform(socket,[side*.225,4.36,-1.025],[.16,.13,.055]);
      setTransform(eyeball,[side*.225,4.36,-1.078],[.105,.095,.052]);
      setTransform(iris,[side*.225,4.36,-1.124],[.055,.055,.020]);
      setTransform(shine,[side*.205,4.392,-1.145],[.020,.020,.010]);
    }

    const cheekL=scene.getMeshByName('macaqueV2CheekL');
    const cheekR=scene.getMeshByName('macaqueV2CheekR');
    setTransform(cheekL,[-.48,4.20,-.66],[.31,.36,.25]);
    setTransform(cheekR,[.48,4.20,-.66],[.31,.36,.25]);

    const earOuter=[];
    const earInner=[];
    for (const side of [-1,1]) {
      const outer=ellipsoid(scene,`macaqueV3EarOuter${side}`,[side*.72,4.30,-.43],[.19,.255,.095],skin,root,26);
      outer.rotation.z=side*.08;
      const inner=ellipsoid(scene,`macaqueV3EarInner${side}`,[side*.715,4.30,-.505],[.10,.155,.035],skinDark,root,22);
      inner.rotation.z=side*.08;
      earOuter.push(outer);
      earInner.push(inner);
      ellipsoid(scene,`macaqueV3TempleFur${side}`,[side*.58,4.46,-.48],[.23,.29,.20],fur,root,24);
      ellipsoid(scene,`macaqueV3LowerCheek${side}`,[side*.36,3.99,-.91],[.20,.20,.12],furCream,root,22);
    }

    ellipsoid(scene,'macaqueV3Chin',[0,3.84,-1.10],[.28,.13,.10],skin,root,24);
    ellipsoid(scene,'macaqueV3NoseBridge',[0,4.18,-1.05],[.115,.17,.055],skinDark,root,22);
    ellipsoid(scene,'macaqueV3LipLower',[0,3.91,-1.235],[.20,.045,.035],nose,root,22);

    const directional=scene.lights.find(light=>light instanceof BABYLON.DirectionalLight);
    const shadows=directional?.getShadowGenerator?.();
    if (shadows) [...earOuter,...earInner].forEach(mesh=>shadows.addShadowCaster(mesh));

    softenSharpen(scene);

    return {
      hiddenOldEars,
      newEarMeshes:earOuter.length+earInner.length,
      faceAdjusted:Boolean(face&&muzzle&&noseMesh),
      eyePairs:2
    };
  }

  function updateUi() {
    const description=document.getElementById('sectionDescription');
    if (description) description.textContent='Macaco de Berbería joven con cuerpo orgánico, orejas compactas, hocico corto, ojos naturales, manos y pies definidos y pelaje procedural nítido.';
    const profile=document.getElementById('profile');
    if (profile) profile.textContent='NÍTIDO · V2.1';
  }

  wait().then(()=>{
    const scene=BABYLON.Engine.LastCreatedScene;
    if (!scene) throw new Error('No se encontró la escena para corregir el macaco.');
    const result=fixFace(scene);
    updateUi();
    const originalFocus=window.WAFTVisualLab0181.focus;
    window.WAFTVisualLab0181.focus=(id,instant=false)=>{
      originalFocus(id,instant);
      if (id==='macaque') {
        updateUi();
        if (instant) {
          const camera=scene.activeCamera;
          camera.setTarget(new BABYLON.Vector3(-23,3.0,-8));
          camera.alpha=-Math.PI/2;
          camera.beta=1.16;
          camera.radius=10.6;
        }
      }
    };
    window.WAFTVisualLab0181.focus('macaque',true);
    const oldState=window.WAFTVisualLab0181.getState;
    window.WAFTVisualLab0181={
      ...window.WAFTVisualLab0181,
      buildId:BUILD_ID,
      getState:()=>({
        ...oldState(),
        buildId:BUILD_ID,
        macaqueFaceFix:true,
        macaqueFaceAdjusted:result.faceAdjusted,
        hiddenOldEars:result.hiddenOldEars,
        newEarMeshes:result.newEarMeshes,
        naturalEyePairs:result.eyePairs
      })
    };
    window.__WAFT_VISUAL_LAB_0181_MACAQUE_FACEFIX__=true;
  }).catch(error=>{
    console.error(error);
    window.__WAFT_VISUAL_LAB_0181_MACAQUE_FACEFIX_ERROR__=String(error?.message||error);
  });
})();
