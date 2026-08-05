'use strict';
(() => {
  const BUILD_ID = 'waft-visual-lab-0181-v5';
  const wait = () => new Promise(resolve => {
    const tick = () => window.__WAFT_VISUAL_LAB_0181_SHARP__ === true ? resolve() : setTimeout(tick, 35);
    tick();
  });
  const V3 = (x,y,z) => new BABYLON.Vector3(x,y,z);
  const C3 = hex => BABYLON.Color3.FromHexString(hex);

  function seeded(seed) {
    let state = seed >>> 0;
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  function furTextures(scene, prefix, base, light, dark, seed) {
    const rng = seeded(seed);
    const color = new BABYLON.DynamicTexture(`${prefix}Color`, {width:512,height:512}, scene, false);
    const bump = new BABYLON.DynamicTexture(`${prefix}Bump`, {width:512,height:512}, scene, false);
    const cctx = color.getContext();
    const bctx = bump.getContext();
    cctx.fillStyle = base;
    cctx.fillRect(0,0,512,512);
    bctx.fillStyle = '#777';
    bctx.fillRect(0,0,512,512);
    for (let i=0;i<4600;i++) {
      const x = rng()*512;
      const y = rng()*512;
      const len = 4+rng()*22;
      const lean = (rng()-.5)*5;
      cctx.globalAlpha = .055+rng()*.18;
      cctx.strokeStyle = rng()>.48 ? light : dark;
      cctx.lineWidth = .45+rng()*1.45;
      cctx.beginPath();
      cctx.moveTo(x,y);
      cctx.quadraticCurveTo(x+lean*.35,y+len*.52,x+lean,y+len);
      cctx.stroke();
      bctx.globalAlpha = .08+rng()*.18;
      bctx.strokeStyle = rng()>.5 ? '#c8c8c8' : '#454545';
      bctx.lineWidth = .6+rng()*1.2;
      bctx.beginPath();
      bctx.moveTo(x,y);
      bctx.lineTo(x+lean,y+len);
      bctx.stroke();
    }
    cctx.globalAlpha = 1;
    bctx.globalAlpha = 1;
    color.update(false);
    bump.update(false);
    for (const texture of [color,bump]) {
      texture.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
      texture.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
      texture.anisotropicFilteringLevel = 16;
      texture.updateSamplingMode(BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
    }
    return {color,bump};
  }

  function furMaterial(scene, name, palette, seed) {
    const textures = furTextures(scene, name, palette.base, palette.light, palette.dark, seed);
    const material = new BABYLON.PBRMaterial(name, scene);
    material.albedoColor = C3(palette.base);
    material.albedoTexture = textures.color;
    material.bumpTexture = textures.bump;
    material.bumpTexture.level = .38;
    material.metallic = 0;
    material.roughness = .92;
    material.environmentIntensity = .55;
    material.freeze();
    return material;
  }

  function pbr(scene, name, hex, roughness=.86, emissive=null) {
    const material = new BABYLON.PBRMaterial(name, scene);
    material.albedoColor = C3(hex);
    material.metallic = 0;
    material.roughness = roughness;
    material.environmentIntensity = .55;
    if (emissive) material.emissiveColor = C3(emissive);
    material.freeze();
    return material;
  }

  function ringSurface(scene, name, rings, segments, material, parent) {
    const positions=[];
    const indices=[];
    const uvs=[];
    const normals=[];
    for (let r=0;r<rings.length;r++) {
      const ring=rings[r];
      for (let i=0;i<segments;i++) {
        const angle=i/segments*Math.PI*2;
        const squash=ring.squash ? 1+Math.cos(angle*2)*ring.squash : 1;
        positions.push(
          ring.x+Math.cos(angle)*ring.rx*squash,
          ring.y+(ring.wave||0)*Math.sin(angle),
          ring.z+Math.sin(angle)*ring.rz
        );
        uvs.push(i/segments,r/(rings.length-1));
      }
    }
    for (let r=0;r<rings.length-1;r++) {
      for (let i=0;i<segments;i++) {
        const next=(i+1)%segments;
        const a=r*segments+i;
        const b=r*segments+next;
        const c=(r+1)*segments+i;
        const d=(r+1)*segments+next;
        indices.push(a,c,b,b,c,d);
      }
    }
    const bottomIndex=positions.length/3;
    positions.push(rings[0].x,rings[0].y,rings[0].z);
    uvs.push(.5,0);
    const topIndex=positions.length/3;
    const top=rings[rings.length-1];
    positions.push(top.x,top.y,top.z);
    uvs.push(.5,1);
    for (let i=0;i<segments;i++) {
      const next=(i+1)%segments;
      indices.push(bottomIndex,next,i);
      const base=(rings.length-1)*segments;
      indices.push(topIndex,base+i,base+next);
    }
    BABYLON.VertexData.ComputeNormals(positions,indices,normals);
    const mesh=new BABYLON.Mesh(name,scene);
    const data=new BABYLON.VertexData();
    data.positions=positions;
    data.indices=indices;
    data.normals=normals;
    data.uvs=uvs;
    data.applyToMesh(mesh,true);
    mesh.material=material;
    mesh.parent=parent;
    mesh.receiveShadows=true;
    mesh.isPickable=false;
    return mesh;
  }

  function ellipsoid(scene, name, position, scale, material, parent, segments=28) {
    const mesh=BABYLON.MeshBuilder.CreateSphere(name,{segments,diameter:2},scene);
    mesh.position.copyFromFloats(...position);
    mesh.scaling.copyFromFloats(...scale);
    mesh.material=material;
    mesh.parent=parent;
    mesh.receiveShadows=true;
    mesh.isPickable=false;
    return mesh;
  }

  function taperedTube(scene, name, points, radii, material, parent, tessellation=16) {
    const path=points.map(point=>V3(...point));
    const mesh=BABYLON.MeshBuilder.CreateTube(name,{
      path,
      tessellation,
      cap:BABYLON.Mesh.CAP_ALL,
      radiusFunction:index=>radii[Math.min(index,radii.length-1)]
    },scene);
    mesh.material=material;
    mesh.parent=parent;
    mesh.receiveShadows=true;
    mesh.isPickable=false;
    return mesh;
  }

  function torusEar(scene, name, x, y, z, side, skin, inner, parent) {
    const outer=BABYLON.MeshBuilder.CreateTorus(name,{diameter:.43,thickness:.10,tessellation:24},scene);
    outer.position.copyFromFloats(x,y,z);
    outer.rotation.x=Math.PI/2;
    outer.rotation.y=side*.18;
    outer.scaling.copyFromFloats(1,.88,.58);
    outer.material=skin;
    outer.parent=parent;
    outer.isPickable=false;
    const center=ellipsoid(scene,`${name}Inner`,[x-side*.006,y,z-.015],[.135,.18,.055],inner,parent,20);
    center.rotation.z=side*.08;
    return [outer,center];
  }

  function hand(scene, parent, side, x, y, z, skin, darkSkin) {
    const palm=ellipsoid(scene,`macaqueV2Palm${side}`,[x,y,z],[.31,.18,.38],skin,parent,24);
    palm.rotation.z=side*.12;
    palm.rotation.x=-.1;
    for (let i=0;i<4;i++) {
      const offset=(i-1.5)*.105;
      taperedTube(scene,`macaqueV2Finger${side}-${i}`,
        [[x+offset,y-.02,z-.24],[x+offset+side*.018,y-.07,z-.42],[x+offset+side*.04,y-.08,z-.58]],
        [.045,.038,.025],darkSkin,parent,10);
    }
    taperedTube(scene,`macaqueV2Thumb${side}`,
      [[x+side*.25,y-.02,z-.02],[x+side*.38,y-.10,z-.18],[x+side*.32,y-.15,z-.31]],
      [.055,.045,.028],darkSkin,parent,10);
  }

  function foot(scene, parent, side, x, y, z, skin, darkSkin) {
    const sole=ellipsoid(scene,`macaqueV2Foot${side}`,[x,y,z],[.48,.17,.68],skin,parent,24);
    sole.rotation.y=side*.08;
    for (let i=0;i<4;i++) {
      const offset=(i-1.5)*.115;
      taperedTube(scene,`macaqueV2Toe${side}-${i}`,
        [[x+offset,y-.01,z-.46],[x+offset+side*.018,y-.02,z-.67],[x+offset+side*.035,y-.015,z-.84]],
        [.05,.04,.026],darkSkin,parent,10);
    }
  }

  function buildMacaque(scene) {
    const refined=scene.getTransformNodeByName('barbaryMacaqueRefined');
    if (!refined) throw new Error('No se encontró el macaco anterior para sustituirlo.');
    refined.setEnabled(false);
    const host=scene.getTransformNodeByName('barbaryMacaque');
    if (!host) throw new Error('No se encontró el soporte del macaco.');

    const fur=furMaterial(scene,'macaqueV2Fur',{base:'#75604a',light:'#a58a68',dark:'#433329'},8051);
    const furDark=furMaterial(scene,'macaqueV2FurDark',{base:'#4b3a30',light:'#725845',dark:'#261e19'},8059);
    const furCream=furMaterial(scene,'macaqueV2FurCream',{base:'#a58d70',light:'#cfb899',dark:'#725d49'},8069);
    const skin=pbr(scene,'macaqueV2Skin','#b17967',.9);
    const skinDark=pbr(scene,'macaqueV2SkinDark','#7d5149',.92);
    const nose=pbr(scene,'macaqueV2Nose','#342523',.78);
    const eye=pbr(scene,'macaqueV2Eye','#1a1310',.28);
    const iris=pbr(scene,'macaqueV2Iris','#4b2c18',.34);
    const catchlight=pbr(scene,'macaqueV2Catchlight','#fff9eb',.15,'#fff2d6');

    const root=new BABYLON.TransformNode('barbaryMacaqueV2',scene);
    root.parent=host;
    root.position.copyFromFloats(0,.02,.1);
    root.rotation.x=.025;

    const torso=ringSurface(scene,'macaqueV2Torso',[
      {x:0,y:1.38,z:.20,rx:.57,rz:.54},
      {x:0,y:1.58,z:.16,rx:.83,rz:.69},
      {x:0,y:1.86,z:.10,rx:1.00,rz:.79,squash:.04},
      {x:0,y:2.18,z:.02,rx:1.08,rz:.82,squash:.045},
      {x:0,y:2.53,z:-.08,rx:1.04,rz:.76,squash:.04},
      {x:0,y:2.87,z:-.18,rx:.95,rz:.68,squash:.035},
      {x:0,y:3.18,z:-.28,rx:.82,rz:.59},
      {x:0,y:3.43,z:-.36,rx:.67,rz:.50},
      {x:0,y:3.62,z:-.43,rx:.47,rz:.39}
    ],28,fur,root);

    const belly=ellipsoid(scene,'macaqueV2Belly',[0,2.35,-.73],[.70,1.05,.17],furCream,root,30);
    belly.rotation.x=-.045;
    const pelvis=ellipsoid(scene,'macaqueV2Pelvis',[0,1.62,.26],[.90,.70,.74],furDark,root,28);
    pelvis.rotation.x=.06;

    const neck=taperedTube(scene,'macaqueV2Neck',[
      [0,3.34,-.28],[0,3.63,-.44],[0,3.83,-.52]
    ],[.53,.46,.39],fur,root,20);

    const head=ringSurface(scene,'macaqueV2Head',[
      {x:0,y:3.72,z:-.48,rx:.34,rz:.34},
      {x:0,y:3.86,z:-.48,rx:.56,rz:.52},
      {x:0,y:4.08,z:-.45,rx:.72,rz:.66},
      {x:0,y:4.33,z:-.40,rx:.79,rz:.72,squash:.025},
      {x:0,y:4.55,z:-.36,rx:.72,rz:.64},
      {x:0,y:4.72,z:-.34,rx:.56,rz:.48},
      {x:0,y:4.82,z:-.33,rx:.28,rz:.25}
    ],30,fur,root);

    ellipsoid(scene,'macaqueV2FaceMask',[0,4.20,-.93],[.55,.52,.22],skin,root,30);
    ellipsoid(scene,'macaqueV2Muzzle',[0,3.96,-1.19],[.43,.26,.25],skinDark,root,28);
    ellipsoid(scene,'macaqueV2CheekL',[-.48,4.16,-.72],[.34,.39,.28],furCream,root,24);
    ellipsoid(scene,'macaqueV2CheekR',[.48,4.16,-.72],[.34,.39,.28],furCream,root,24);
    torusEar(scene,'macaqueV2EarL',-.73,4.30,-.42,-1,skin,skinDark,root);
    torusEar(scene,'macaqueV2EarR',.73,4.30,-.42,1,skin,skinDark,root);

    for (const side of [-1,1]) {
      ellipsoid(scene,`macaqueV2EyeSocket${side}`,[side*.215,4.34,-1.10],[.18,.14,.08],skinDark,root,24);
      ellipsoid(scene,`macaqueV2Eyeball${side}`,[side*.215,4.34,-1.155],[.115,.105,.065],eye,root,24);
      ellipsoid(scene,`macaqueV2Iris${side}`,[side*.215,4.34,-1.214],[.061,.061,.025],iris,root,20);
      ellipsoid(scene,`macaqueV2Catchlight${side}`,[side*.19,4.375,-1.238],[.018,.018,.012],catchlight,root,16);
      taperedTube(scene,`macaqueV2Brow${side}`,
        [[side*.08,4.53,-1.075],[side*.22,4.56,-1.10],[side*.39,4.51,-1.05]],
        [.055,.07,.045],furDark,root,10);
    }
    ellipsoid(scene,'macaqueV2Nose',[0,4.05,-1.43],[.205,.13,.09],nose,root,24);
    ellipsoid(scene,'macaqueV2NostrilL',[-.075,4.06,-1.505],[.032,.023,.014],eye,root,16);
    ellipsoid(scene,'macaqueV2NostrilR',[.075,4.06,-1.505],[.032,.023,.014],eye,root,16);
    taperedTube(scene,'macaqueV2Mouth',[
      [-.19,3.87,-1.405],[0,3.83,-1.43],[.19,3.87,-1.405]
    ],[.018,.022,.018],nose,root,8);

    for (const side of [-1,1]) {
      ellipsoid(scene,`macaqueV2Shoulder${side}`,[side*.79,3.10,-.25],[.42,.50,.43],fur,root,24);
      taperedTube(scene,`macaqueV2UpperArm${side}`,
        [[side*.74,3.18,-.28],[side*.98,2.75,-.58],[side*1.08,2.23,-.82]],
        [.31,.285,.24],fur,root,18);
      taperedTube(scene,`macaqueV2Forearm${side}`,
        [[side*1.08,2.23,-.82],[side*1.06,1.63,-1.03],[side*.95,.94,-1.16]],
        [.255,.215,.17],furDark,root,18);
      hand(scene,root,side,side*.95,.76,-1.22,skin,skinDark);

      ellipsoid(scene,`macaqueV2Hip${side}`,[side*.58,1.66,.26],[.50,.56,.50],furDark,root,24);
      taperedTube(scene,`macaqueV2Thigh${side}`,
        [[side*.55,1.70,.22],[side*.85,1.29,.40],[side*.99,.92,.26]],
        [.40,.35,.29],furDark,root,18);
      taperedTube(scene,`macaqueV2Shin${side}`,
        [[side*.99,.92,.26],[side*1.07,.62,-.13],[side*.92,.37,-.62]],
        [.28,.245,.19],fur,root,18);
      foot(scene,root,side,side*.92,.24,-.82,skin,skinDark);
    }

    ellipsoid(scene,'macaqueV2TailNub',[0,1.66,.92],[.20,.19,.26],furDark,root,22);

    const tufts=[];
    for (let i=0;i<10;i++) {
      const angle=(i/10)*Math.PI*2;
      const tuft=ringSurface(scene,`macaqueV2Tuft${i}`,[
        {x:Math.cos(angle)*.87,y:2.78+Math.sin(angle*2)*.12,z:-.12+Math.sin(angle)*.61,rx:.12,rz:.10},
        {x:Math.cos(angle)*1.02,y:2.86+Math.sin(angle*2)*.12,z:-.12+Math.sin(angle)*.73,rx:.04,rz:.035}
      ],8,i%3===0?furCream:fur,root);
      tufts.push(tuft);
    }

    const directional=scene.lights.find(light=>light instanceof BABYLON.DirectionalLight);
    const shadows=directional?.getShadowGenerator?.();
    if (shadows) root.getChildMeshes(false).forEach(mesh=>shadows.addShadowCaster(mesh));

    const blinkMeshes=[scene.getMeshByName('macaqueV2Eyeball-1'),scene.getMeshByName('macaqueV2Eyeball1'),scene.getMeshByName('macaqueV2Iris-1'),scene.getMeshByName('macaqueV2Iris1'),scene.getMeshByName('macaqueV2Catchlight-1'),scene.getMeshByName('macaqueV2Catchlight1')].filter(Boolean);
    const baseHeadRotation=head.rotation.clone();
    scene.onBeforeRenderObservable.add(()=>{
      const t=performance.now()*.001;
      const breath=1+Math.sin(t*1.6)*.008;
      torso.scaling.y=breath;
      belly.scaling.y=1+(breath-1)*1.25;
      head.rotation.y=baseHeadRotation.y+Math.sin(t*.42)*.025;
      const blinkPhase=(t%5.4);
      const blink=blinkPhase>5.18 ? Math.max(.08,Math.abs(blinkPhase-5.29)*9) : 1;
      blinkMeshes.forEach(mesh=>mesh.scaling.y=blink);
    });

    const vertices=root.getChildMeshes(false).reduce((sum,mesh)=>sum+mesh.getTotalVertices(),0);
    return {root,meshCount:root.getChildMeshes(false).length,vertices,organicSurfaces:4};
  }

  function updateUi() {
    const code=document.getElementById('sectionCode');
    const description=document.getElementById('sectionDescription');
    if (code) code.textContent='player_barbary_macaque_v2';
    if (description) description.textContent='Macaco de Berbería joven, orgánico y agazapado, con anatomía continua, mirada natural y pelaje procedural nítido.';
    const profile=document.getElementById('profile');
    if (profile) profile.textContent='NÍTIDO · V2';
  }

  wait().then(()=>{
    const scene=BABYLON.Engine.LastCreatedScene;
    if (!scene) throw new Error('No se encontró la escena para montar el macaco v2.');
    const result=buildMacaque(scene);
    updateUi();
    const originalFocus=window.WAFTVisualLab0181.focus;
    window.WAFTVisualLab0181.focus=(id,instant=false)=>{
      originalFocus(id,instant);
      if (id==='macaque') {
        updateUi();
        if (instant) {
          const camera=scene.activeCamera;
          camera.setTarget(V3(-23,3.05,-8));
          camera.alpha=-Math.PI/2;
          camera.beta=1.18;
          camera.radius=10.9;
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
        macaqueV2:true,
        macaqueV2MeshCount:result.meshCount,
        macaqueV2Vertices:result.vertices,
        macaqueV2OrganicSurfaces:result.organicSurfaces
      })
    };
    window.__WAFT_VISUAL_LAB_0181_MACAQUE_V2__=true;
  }).catch(error=>{
    console.error(error);
    window.__WAFT_VISUAL_LAB_0181_MACAQUE_V2_ERROR__=String(error?.message||error);
  });
})();
