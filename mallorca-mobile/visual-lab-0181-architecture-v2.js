'use strict';
(() => {
  const BUILD_ID='waft-visual-lab-0181-v12';
  const wait=()=>new Promise(resolve=>{const tick=()=>window.__WAFT_VISUAL_LAB_0181_MACAQUE_BLINKFIX__===true?resolve():setTimeout(tick,35);tick();});
  const C3=hex=>BABYLON.Color3.FromHexString(hex);

  function noiseTexture(scene,name,base,accents,seed,grid=false){
    let state=seed>>>0;const rng=()=>{state=(state*1664525+1013904223)>>>0;return state/4294967296;};
    const texture=new BABYLON.DynamicTexture(name,{width:512,height:512},scene,false);const ctx=texture.getContext();ctx.fillStyle=base;ctx.fillRect(0,0,512,512);
    for(let i=0;i<4200;i++){
      const x=rng()*512,y=rng()*512,r=.3+rng()*2.1;ctx.globalAlpha=.025+rng()*.10;ctx.fillStyle=accents[Math.floor(rng()*accents.length)];ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
    }
    if(grid){ctx.globalAlpha=.11;ctx.strokeStyle=accents[0];ctx.lineWidth=1;for(let y=0;y<512;y+=34){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(512,y);ctx.stroke();}for(let x=0;x<512;x+=52){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,512);ctx.stroke();}}
    ctx.globalAlpha=1;texture.update(false);texture.wrapU=texture.wrapV=BABYLON.Texture.WRAP_ADDRESSMODE;texture.anisotropicFilteringLevel=16;texture.updateSamplingMode(BABYLON.Texture.TRILINEAR_SAMPLINGMODE);return texture;
  }
  function pbr(scene,name,hex,texture=null,roughness=.86,emissive=null){
    const mat=new BABYLON.PBRMaterial(name,scene);mat.albedoColor=C3(hex);if(texture)mat.albedoTexture=texture;mat.metallic=0;mat.roughness=roughness;mat.environmentIntensity=.65;if(emissive)mat.emissiveColor=C3(emissive);mat.freeze();return mat;
  }
  function materials(scene){
    const stucco=noiseTexture(scene,'archV2StuccoTex','#d9c6a0',['#f1e4c8','#b79d73','#e4d2ae'],1201);
    const stuccoWarm=noiseTexture(scene,'archV2StuccoWarmTex','#bd7557',['#dd9b76','#8e503c','#cf8663'],1213);
    const stuccoGold=noiseTexture(scene,'archV2StuccoGoldTex','#c8a65f',['#ead18b','#9f8243','#d5b56f'],1223);
    const stone=noiseTexture(scene,'archV2StoneTex','#9d8d72',['#c0af91','#74654f','#afa087'],1237,true);
    const terracotta=noiseTexture(scene,'archV2TileTex','#9d4a32',['#c96e4e','#6e3025','#b55a3d'],1249,true);
    const pavement=noiseTexture(scene,'archV2PavingTex','#999083',['#c2b8a7','#6f675f','#aaa093'],1259,true);
    const asphalt=noiseTexture(scene,'archV2AsphaltTex','#343938',['#555b59','#202424','#727775'],1277);
    const cobble=noiseTexture(scene,'archV2CobbleTex','#887d6c',['#b7aa95','#5f574b','#9f927d'],1283,true);
    return{
      cream:pbr(scene,'archV2Cream','#dfcfad',stucco,.90),
      pale:pbr(scene,'archV2Pale','#eadfc7',stucco,.91),
      warm:pbr(scene,'archV2Warm','#c27a5b',stuccoWarm,.90),
      gold:pbr(scene,'archV2Gold','#ccb16f',stuccoGold,.90),
      stone:pbr(scene,'archV2Stone','#a49377',stone,.94),
      tile:pbr(scene,'archV2Tile','#a65038',terracotta,.91),
      paving:pbr(scene,'archV2Paving','#a59d90',pavement,.92),
      asphalt:pbr(scene,'archV2Asphalt','#3b403f',asphalt,.96),
      cobble:pbr(scene,'archV2Cobble','#918674',cobble,.95),
      glass:pbr(scene,'archV2Glass','#29434a',null,.22,'#061012'),
      glassWarm:pbr(scene,'archV2GlassWarm','#6f4f31',null,.30,'#1d1007'),
      wood:pbr(scene,'archV2Wood','#68422d',null,.90),
      woodDark:pbr(scene,'archV2WoodDark','#35251e',null,.94),
      iron:pbr(scene,'archV2Iron','#263435',null,.55),
      awningRed:pbr(scene,'archV2AwningRed','#843f35',null,.86),
      awningGreen:pbr(scene,'archV2AwningGreen','#365a4e',null,.86),
      planter:pbr(scene,'archV2Planter','#73503b',null,.92),
      leaf:pbr(scene,'archV2Leaf','#557348',null,.96),
      leafDark:pbr(scene,'archV2LeafDark','#31583e',null,.96),
      white:pbr(scene,'archV2White','#eee7d7',null,.90)
    };
  }
  function box(scene,parent,name,size,pos,mat){const mesh=BABYLON.MeshBuilder.CreateBox(name,{width:size[0],height:size[1],depth:size[2]},scene);mesh.position.copyFromFloats(...pos);mesh.material=mat;mesh.parent=parent;mesh.receiveShadows=true;mesh.isPickable=false;return mesh;}
  function cyl(scene,parent,name,diameter,height,pos,mat,tess=16){const mesh=BABYLON.MeshBuilder.CreateCylinder(name,{diameter,height,tessellation:tess},scene);mesh.position.copyFromFloats(...pos);mesh.material=mat;mesh.parent=parent;mesh.receiveShadows=true;mesh.isPickable=false;return mesh;}
  function sphere(scene,parent,name,pos,scale,mat,segments=20){const mesh=BABYLON.MeshBuilder.CreateSphere(name,{diameter:2,segments},scene);mesh.position.copyFromFloats(...pos);mesh.scaling.copyFromFloats(...scale);mesh.material=mat;mesh.parent=parent;mesh.receiveShadows=true;mesh.isPickable=false;return mesh;}
  function roof(scene,parent,name,w,d,h,pos,mat){
    const positions=[-w/2,0,-d/2,w/2,0,-d/2,w/2,0,d/2,-w/2,0,d/2,0,h,-d/2,0,h,d/2];
    const indices=[0,1,4,1,2,5,1,5,4,2,3,5,3,0,4,3,4,5,0,3,2,0,2,1];const normals=[];BABYLON.VertexData.ComputeNormals(positions,indices,normals);
    const mesh=new BABYLON.Mesh(name,scene);const data=new BABYLON.VertexData();data.positions=positions;data.indices=indices;data.normals=normals;data.uvs=[0,0,1,0,1,1,0,1,.5,0,.5,1];data.applyToMesh(mesh);mesh.position.copyFromFloats(...pos);mesh.material=mat;mesh.parent=parent;mesh.receiveShadows=true;mesh.isPickable=false;return mesh;
  }
  function windowUnit(scene,parent,x,y,z,mat,opts={}){
    const w=opts.w||.72,h=opts.h||1.02;box(scene,parent,'archV2WindowGlass',[w,h,.07],[x,y,z],opts.warm?mat.glassWarm:mat.glass);
    box(scene,parent,'archV2WindowTop',[w+.16,.08,.10],[x,y+h/2+.05,z-.015],mat.stone);box(scene,parent,'archV2WindowBottom',[w+.16,.08,.10],[x,y-h/2-.05,z-.015],mat.stone);
    box(scene,parent,'archV2WindowL',[.07,h,.10],[x-w/2-.05,y,z-.015],mat.stone);box(scene,parent,'archV2WindowR',[.07,h,.10],[x+w/2+.05,y,z-.015],mat.stone);
    if(opts.shutters){box(scene,parent,'archV2ShutterL',[.25,h,.08],[x-w/2-.19,y,z-.025],mat.wood);box(scene,parent,'archV2ShutterR',[.25,h,.08],[x+w/2+.19,y,z-.025],mat.wood);}
    if(opts.balcony){box(scene,parent,'archV2BalconySlab',[w+.78,.12,.72],[x,y-h/2-.16,z-.34],mat.stone);for(let i=-2;i<=2;i++)box(scene,parent,'archV2RailPost',[.035,.62,.035],[x+i*(w+.55)/4,y-.20,z-.64],mat.iron);box(scene,parent,'archV2RailTop',[w+.68,.045,.045],[x,y+.10,z-.64],mat.iron);}
  }
  function door(scene,parent,x,y,z,mat,w=.90,h=1.70){box(scene,parent,'archV2Door',[w,h,.11],[x,y,z],mat.woodDark);box(scene,parent,'archV2DoorFrame',[w+.18,.12,.14],[x,y+h/2+.04,z-.02],mat.stone);}
  function shopfront(scene,parent,x,y,z,mat,width,awningMat){box(scene,parent,'archV2ShopGlass',[width,1.18,.08],[x,y,z],mat.glassWarm);box(scene,parent,'archV2ShopFrame',[width+.14,.10,.12],[x,y+.64,z-.02],mat.iron);for(const px of[-width/2,width/2])box(scene,parent,'archV2ShopSide',[.08,1.28,.12],[x+px,y,z-.02],mat.iron);const awning=box(scene,parent,'archV2Awning',[width+.26,.16,.75],[x,y+.82,z-.40],awningMat);awning.rotation.x=-.16;}
  function balconyPlanter(scene,parent,x,y,z,mat){box(scene,parent,'archV2Planter',[.55,.18,.22],[x,y,z],mat.planter);for(let i=0;i<3;i++)sphere(scene,parent,'archV2Plant',[x-.16+i*.16,y+.18,z],[.12,.18,.10],i%2?mat.leaf:mat.leafDark,12);}
  function urbanBlock(scene,parent,x,z,options,mat){
    const root=new BABYLON.TransformNode('archV2UrbanBuilding',scene);root.parent=parent;root.position.copyFromFloats(x,.55,z);root.rotation.y=options.rotation||0;
    const w=options.w,d=options.d,floors=options.floors,floorH=1.45,h=floors*floorH;box(scene,root,'archV2Body',[w,h,d],[0,h/2,0],options.facade);box(scene,root,'archV2StoneBase',[w+.04,1.18,d+.04],[0,.59,0],mat.stone);
    box(scene,root,'archV2Cornice',[w+.26,.16,d+.20],[0,h-.07,0],mat.stone);box(scene,root,'archV2FloorBand',[w+.08,.08,d+.08],[0,1.34,0],mat.stone);
    if(options.gable)roof(scene,root,'archV2Roof',w+.42,d+.36,.78,[0,h,0],mat.tile);else{box(scene,root,'archV2FlatRoof',[w+.20,.22,d+.20],[0,h+.03,0],mat.tile);for(const zz of[-d/2,d/2])box(scene,root,'archV2Parapet',[w+.25,.34,.13],[0,h+.26,zz],mat.stone);}
    const cols=Math.max(2,Math.floor(w/1.25));for(let floor=1;floor<floors;floor++){for(let col=0;col<cols;col++){const px=-w/2+(col+.5)*w/cols;windowUnit(scene,root,px,floor*floorH+.12,-d/2-.05,mat,{balcony:(floor+col)%2===0,shutters:options.shutters,w:cols===2?.82:.68});if((floor+col)%3===0)balconyPlanter(scene,root,px,floor*floorH-.48,-d/2-.70,mat);}}
    const shopW=(w-1.45)/2;shopfront(scene,root,-w/2+shopW/2+.18,.64,-d/2-.07,mat,shopW,options.awning||mat.awningRed);door(scene,root,0,.76,-d/2-.08,mat,.82,1.55);shopfront(scene,root,w/2-shopW/2-.18,.64,-d/2-.07,mat,shopW,options.awning||mat.awningGreen);
    if(options.corner){for(let floor=1;floor<floors;floor++)windowUnit(scene,root,w/2+.05,floor*floorH+.12,0,mat,{balcony:floor%2===0,shutters:false});}
    return root;
  }
  function streetTree(scene,parent,x,z,mat,scale=1){const root=new BABYLON.TransformNode('archV2StreetTree',scene);root.parent=parent;root.position.copyFromFloats(x,.62,z);root.scaling.scaleInPlace(scale);cyl(scene,root,'archV2TreeTrunk',.24,2.7,[0,1.35,0],mat.wood,12);for(let i=0;i<7;i++){const a=i/7*Math.PI*2;sphere(scene,root,'archV2TreeCrown',[Math.cos(a)*.48,2.75+(i%2)*.28,Math.sin(a)*.40],[.72,.62,.62],i%3?mat.leaf:mat.leafDark,16);}return root;}
  function lamp(scene,parent,x,z,mat){cyl(scene,parent,'archV2LampPole',.10,3.0,[x,2.12,z],mat.iron,12);sphere(scene,parent,'archV2LampHead',[x,3.68,z],[.22,.18,.22],mat.white,16);}
  function bench(scene,parent,x,z,rot,mat){const root=new BABYLON.TransformNode('archV2Bench',scene);root.parent=parent;root.position.copyFromFloats(x,.62,z);root.rotation.y=rot;box(scene,root,'archV2BenchSeat',[1.55,.12,.46],[0,.48,0],mat.wood);box(scene,root,'archV2BenchBack',[1.55,.58,.10],[0,.80,.20],mat.wood);for(const px of[-.6,.6])box(scene,root,'archV2BenchLeg',[.10,.48,.10],[px,.24,0],mat.iron);}
  function hideOld(root,prefix){let hidden=0;for(const mesh of root.getChildMeshes(false)){if(mesh.name.startsWith(`${prefix}-base`)||mesh.name.startsWith(`${prefix}-border`)||mesh.name.startsWith('sign-'))continue;mesh.setEnabled(false);hidden++;}return hidden;}
  function buildUrban(scene,mat){
    const root=scene.getTransformNodeByName('section-urban');if(!root)throw new Error('No se encontró la sección urbana.');const hidden=hideOld(root,'urban');const stage=new BABYLON.TransformNode('archV2UrbanStage',scene);stage.parent=root;
    box(scene,stage,'archV2Road',[14,.10,3.25],[0,.63,2.65],mat.asphalt);box(scene,stage,'archV2SidewalkA',[14,.20,1.10],[0,.72,.40],mat.paving);box(scene,stage,'archV2SidewalkB',[14,.20,.70],[0,.72,4.30],mat.paving);
    urbanBlock(scene,stage,-4.8,-2.25,{w:3.9,d:3.4,floors:5,facade:mat.warm,corner:true,shutters:false,awning:mat.awningGreen},mat);
    urbanBlock(scene,stage,-.55,-2.30,{w:4.2,d:3.5,floors:5,facade:mat.pale,gable:false,shutters:true,awning:mat.awningRed},mat);
    urbanBlock(scene,stage,4.15,-2.25,{w:4.6,d:3.45,floors:4,facade:mat.gold,gable:true,shutters:true,awning:mat.awningGreen},mat);
    for(const x of[-5.8,-2.2,1.6,5.4])streetTree(scene,stage,x,.32,mat,.58);for(const x of[-6.2,0,6.2])lamp(scene,stage,x,.05,mat);bench(scene,stage,-3,.25,0,mat);bench(scene,stage,3.2,.25,0,mat);
    for(let x=-6;x<=6;x+=2.4)box(scene,stage,'archV2Crosswalk',[.42,.035,2.35],[x,.70,2.65],mat.white);
    return{hidden,buildings:3,stage};
  }
  function villageHouse(scene,parent,x,z,options,mat){
    const root=new BABYLON.TransformNode('archV2VillageHouse',scene);root.parent=parent;root.position.copyFromFloats(x,.55,z);root.rotation.y=options.rotation||0;const w=options.w||3,d=options.d||2.8,h=options.h||2.8;
    box(scene,root,'archV2VillageBody',[w,h,d],[0,h/2,0],options.facade);box(scene,root,'archV2VillageStoneBase',[w+.03,.65,d+.03],[0,.325,0],mat.stone);roof(scene,root,'archV2VillageRoof',w+.40,d+.36,.75,[0,h,0],mat.tile);door(scene,root,-w*.18,.76,-d/2-.07,mat,.76,1.50);windowUnit(scene,root,w*.22,1.42,-d/2-.05,mat,{shutters:true,balcony:options.balcony,w:.66});if(h>3.1)windowUnit(scene,root,-w*.22,2.48,-d/2-.05,mat,{shutters:true,w:.62});
    box(scene,root,'archV2VillageEave',[w+.38,.10,.16],[0,h-.02,-d/2-.08],mat.woodDark);return root;
  }
  function fountain(scene,parent,x,z,mat){const root=new BABYLON.TransformNode('archV2Fountain',scene);root.parent=parent;root.position.copyFromFloats(x,.64,z);cyl(scene,root,'archV2Basin',2.0,.30,[0,.15,0],mat.stone,24);cyl(scene,root,'archV2BasinWater',1.58,.05,[0,.33,0],mat.glass,24);cyl(scene,root,'archV2FountainColumn',.30,1.15,[0,.85,0],mat.stone,14);sphere(scene,root,'archV2FountainTop',[0,1.50,0],[.24,.24,.24],mat.stone,18);}
  function buildVillage(scene,mat){
    const root=scene.getTransformNodeByName('section-village');if(!root)throw new Error('No se encontró la sección de pueblo.');const hidden=hideOld(root,'village');const stage=new BABYLON.TransformNode('archV2VillageStage',scene);stage.parent=root;
    box(scene,stage,'archV2VillagePlaza',[5.1,.12,8.8],[0,.66,0],mat.cobble);box(scene,stage,'archV2VillageLane',[2.6,.13,11],[0,.68,0],mat.cobble);
    villageHouse(scene,stage,-4.75,-3.2,{w:3.4,h:3.2,facade:mat.pale,rotation:.04,balcony:true},mat);villageHouse(scene,stage,-4.65,.15,{w:3.15,h:2.7,facade:mat.warm,rotation:-.03},mat);villageHouse(scene,stage,-4.35,3.45,{w:3.5,h:3.65,facade:mat.gold,rotation:.03,balcony:true},mat);
    villageHouse(scene,stage,4.55,-3.15,{w:3.2,h:2.9,facade:mat.cream,rotation:-.02},mat);villageHouse(scene,stage,4.70,.18,{w:3.5,h:3.45,facade:mat.pale,rotation:.03,balcony:true},mat);villageHouse(scene,stage,4.35,3.5,{w:3.4,h:2.55,facade:mat.warm,rotation:-.04},mat);
    fountain(scene,stage,0,0,mat);streetTree(scene,stage,-2.1,-3.45,mat,.50);streetTree(scene,stage,2.15,3.40,mat,.48);bench(scene,stage,-2,1.30,Math.PI/2,mat);bench(scene,stage,2,-1.30,-Math.PI/2,mat);lamp(scene,stage,-2.3,-.1,mat);lamp(scene,stage,2.3,.1,mat);
    for(const [x,z] of[[-2.1,3.1],[2.1,-3.0],[-2.2,-2.0],[2.2,2.1]]){box(scene,stage,'archV2PlazaPlanter',[.75,.28,.45],[x,.86,z],mat.planter);sphere(scene,stage,'archV2PlazaPlant',[x,1.18,z],[.32,.35,.30],mat.leaf,14);}
    return{hidden,houses:6,stage};
  }
  function addShadows(scene,roots){const directional=scene.lights.find(light=>light instanceof BABYLON.DirectionalLight);const shadows=directional?.getShadowGenerator?.();if(!shadows)return 0;let count=0;for(const root of roots)for(const mesh of root.getChildMeshes(false)){shadows.addShadowCaster(mesh);count++;}return count;}
  function updateUi(id){const profile=document.getElementById('profile');if(profile)profile.textContent='NÍTIDO · ARCH V2';const code=document.getElementById('sectionCode');const description=document.getElementById('sectionDescription');if(id==='urban'){if(code)code.textContent='arch_iberian_urban_block_v2';if(description)description.textContent='Bloques urbanos mediterráneos con cinco plantas, comercios, balcones, persianas, cornisas, tejados y calle completa.';}else if(id==='village'){if(code)code.textContent='arch_mediterranean_village_v2';if(description)description.textContent='Pueblo mediterráneo con seis casas distintas, plaza de adoquín, fuente, vegetación, bancos y escala peatonal.';}}

  wait().then(()=>{
    const scene=BABYLON.Engine.LastCreatedScene;if(!scene)throw new Error('No se encontró la escena.');const mat=materials(scene);const urban=buildUrban(scene,mat);const village=buildVillage(scene,mat);const shadowCasters=addShadows(scene,[urban.stage,village.stage]);
    const originalFocus=window.WAFTVisualLab0181.focus;window.WAFTVisualLab0181.focus=(id,instant=false)=>{originalFocus(id,instant);if(id==='urban'||id==='village'){updateUi(id);if(instant){const camera=scene.activeCamera;if(id==='urban'){camera.setTarget(new BABYLON.Vector3(-8,3.15,-8));camera.alpha=-1.48;camera.beta=1.12;camera.radius=14.7;}else{camera.setTarget(new BABYLON.Vector3(8,2.7,-8));camera.alpha=-1.50;camera.beta=1.13;camera.radius=14.2;}}}};
    const oldState=window.WAFTVisualLab0181.getState;window.WAFTVisualLab0181={...window.WAFTVisualLab0181,buildId:BUILD_ID,getState:()=>({...oldState(),buildId:BUILD_ID,architectureV2:true,urbanV2Buildings:urban.buildings,villageV2Houses:village.houses,oldUrbanMeshesHidden:urban.hidden,oldVillageMeshesHidden:village.hidden,architectureV2ShadowCasters:shadowCasters})};window.__WAFT_VISUAL_LAB_0181_ARCHITECTURE_V2__=true;
  }).catch(error=>{console.error(error);window.__WAFT_VISUAL_LAB_0181_ARCHITECTURE_V2_ERROR__=String(error?.message||error);});
})();
