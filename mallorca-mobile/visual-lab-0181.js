'use strict';
(() => {
  const BUILD_ID = 'waft-visual-lab-0181-v1';
  const VERSION = '0.18.1';
  const FEEDBACK_KEY = 'waft.visual-lab.0181.feedback.v1';
  const canvas = document.getElementById('renderCanvas');
  const loading = document.getElementById('loading');
  const loadingText = document.getElementById('loadingText');
  const loadingProgress = document.getElementById('loadingProgress');
  const errorBox = document.getElementById('error');
  const fpsNode = document.getElementById('fps');
  const meshNode = document.getElementById('meshes');
  const titleNode = document.getElementById('sectionTitle');
  const codeNode = document.getElementById('sectionCode');
  const descriptionNode = document.getElementById('sectionDescription');
  const rulesNode = document.getElementById('sectionRules');
  const navNode = document.getElementById('sectionNav');
  const toastNode = document.getElementById('toast');
  const voteButtons = [...document.querySelectorAll('[data-vote]')];

  const sections = [
    { id:'macaque', number:'01', title:'Macaco protagonista', code:'player_barbary_macaque_v1', description:'Candidato orgánico para sustituir definitivamente la construcción de bolas y cilindros visibles.', rules:['Macaco de Berbería joven y reconocible','Cara expresiva, manos y pies legibles','Cola prácticamente inexistente','Silueta limpia incluso a distancia'], target:[-23,3.3,-8], alpha:-1.18, beta:1.18, radius:11 },
    { id:'urban', number:'02', title:'Bloque urbano ibérico', code:'arch_iberian_urban_block_v1', description:'Kit modular para Barcelona, Palma y ciudades mediterráneas densas.', rules:['Planta baja diferenciada','Balcones, portales, cornisas y cubiertas','Variación sin perder identidad cultural','Calles y aceras fáciles de leer'], target:[-8,3.2,-8], alpha:-1.42, beta:1.15, radius:16 },
    { id:'village', number:'03', title:'Pueblo mediterráneo', code:'arch_mediterranean_village_v1', description:'Casas bajas, calle estrecha y una plaza central con escala humana.', rules:['Una a tres plantas','Fachadas estrechas y tejado de teja','Pequeñas plazas y rincones','Densidad compacta sin parecer una ciudad'], target:[8,2.8,-8], alpha:-1.45, beta:1.17, radius:15 },
    { id:'port', number:'04', title:'Puerto mediterráneo', code:'arch_mediterranean_port_v1', description:'Borde marítimo funcional, paseo, almacenes y una salida al agua inequívoca.', rules:['Muelle reconocible','Agua integrada con la costa','Edificios portuarios y vivienda costera','Espacio abierto y navegación visual clara'], target:[23,2.8,-8], alpha:-1.72, beta:1.16, radius:15 },
    { id:'finca', number:'05', title:'Finca rural balear', code:'arch_balearic_rural_v1', description:'Arquitectura rural de piedra, revoco, teja y paisaje agrícola seco.', rules:['Volúmenes conectados y creíbles','Muros de piedra seca','Olivos, almendros y cultivo','Patio y caminos rurales'], target:[-15,2.8,12], alpha:-1.12, beta:1.12, radius:15 },
    { id:'mountain', number:'06', title:'Montaña catalana', code:'arch_catalan_mountain_v1', description:'Asentamiento integrado en pendiente con roca, bosque húmedo y agua de montaña.', rules:['Casas escalonadas en la ladera','Piedra oscura y cubierta inclinada','Bosque con capas y siluetas propias','Roca visible en pendientes fuertes'], target:[2,4.2,12], alpha:-1.25, beta:1.04, radius:17 },
    { id:'vegetation', number:'07', title:'Vegetación base', code:'veg_global_pilot_families_v1', description:'Arquetipos vegetales reconocibles y colocados según clima, pendiente y uso del suelo.', rules:['Pino mediterráneo, olivo y ciprés','Bosque de montaña diferenciado','Arbustos y matorral sin bolas verdes','Instanciable y compatible con LOD'], target:[19,2.6,12], alpha:-1.5, beta:1.15, radius:14 },
    { id:'materials', number:'08', title:'Materiales del terreno', code:'terrain_materials_mediterranean_v1', description:'Superficies que explican el lugar antes de leer cualquier texto del HUD.', rules:['Adoquín, pavimento y asfalto','Tierra, hierba seca y hierba verde','Roca, arena y suelo agrícola','Mezcla posterior por pendiente y humedad'], target:[2,1.2,27], alpha:-1.55, beta:1.15, radius:18 }
  ];
  const sectionMap = new Map(sections.map(section => [section.id, section]));
  let feedback = {};
  try { feedback = JSON.parse(localStorage.getItem(FEEDBACK_KEY) || '{}') || {}; } catch { feedback = {}; }
  let activeSection = sections[0];
  let engine = null;
  let scene = null;
  let camera = null;
  let shadowGenerator = null;
  let createdAt = performance.now();
  const animated = [];
  const materials = {};
  const sectionRoots = new Map();

  function fail(error) {
    console.error(error);
    errorBox.style.display = 'block';
    errorBox.textContent = 'WAFT Visual Lab no pudo iniciarse.\n\n' + (error?.stack || error?.message || String(error));
    loading.classList.add('hide');
    window.__WAFT_VISUAL_LAB_0181_ERROR__ = String(error?.message || error);
  }
  addEventListener('error', event => fail(event.error || event.message));
  addEventListener('unhandledrejection', event => fail(event.reason));
  function progress(value, text) {
    loadingProgress.style.width = `${Math.max(4, Math.min(100, value))}%`;
    if (text) loadingText.textContent = text;
  }
  function toast(text) {
    toastNode.textContent = text;
    toastNode.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => toastNode.classList.remove('show'), 1800);
  }
  function c3(hex) { return BABYLON.Color3.FromHexString(hex); }
  function v3(x,y,z) { return new BABYLON.Vector3(x,y,z); }
  function random(seed) {
    let t = seed >>> 0;
    return () => { t += 0x6D2B79F5; let r = Math.imul(t ^ t >>> 15, 1 | t); r ^= r + Math.imul(r ^ r >>> 7, 61 | r); return ((r ^ r >>> 14) >>> 0) / 4294967296; };
  }
  function makeTexture(name, size, painter) {
    const texture = new BABYLON.DynamicTexture(name, {width:size,height:size}, scene, false);
    const ctx = texture.getContext();
    painter(ctx, size);
    texture.update(false);
    texture.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    texture.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    texture.anisotropicFilteringLevel = 4;
    return texture;
  }
  function makeMaterial(name, color, options={}) {
    const mat = new BABYLON.StandardMaterial(name, scene);
    mat.diffuseColor = c3(color);
    mat.specularColor = options.specular ? c3(options.specular) : new BABYLON.Color3(.08,.08,.08);
    mat.roughness = options.roughness ?? .82;
    if (options.texture) mat.diffuseTexture = options.texture;
    if (options.emissive) mat.emissiveColor = c3(options.emissive);
    if (options.alpha !== undefined) mat.alpha = options.alpha;
    if (options.backFaceCulling === false) mat.backFaceCulling = false;
    if (options.freeze !== false) mat.freeze();
    materials[name] = mat;
    return mat;
  }
  function noiseTexture(name, base, flecks, seed=1, lines=false) {
    const rng = random(seed);
    return makeTexture(name, 256, (ctx,size) => {
      ctx.fillStyle = base; ctx.fillRect(0,0,size,size);
      for(let i=0;i<900;i++){
        const x=rng()*size,y=rng()*size,r=.4+rng()*2.5;
        ctx.globalAlpha=.08+rng()*.18; ctx.fillStyle=flecks[Math.floor(rng()*flecks.length)];
        ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
      }
      if(lines){
        ctx.globalAlpha=.18;ctx.strokeStyle=flecks[0];ctx.lineWidth=1;
        for(let y=0;y<size;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(size,y);ctx.stroke()}
        for(let x=0;x<size;x+=48){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,size);ctx.stroke()}
      }
      ctx.globalAlpha=1;
    });
  }
  function buildMaterials() {
    const stoneTex = makeTexture('stoneTex',256,(ctx,s)=>{
      ctx.fillStyle='#aa9778';ctx.fillRect(0,0,s,s);const rng=random(41);
      for(let y=-12;y<s+20;y+=28){let x=(Math.floor(y/28)%2)*-18;while(x<s){const w=28+rng()*35;ctx.fillStyle=['#b9a687','#9d896b','#c4b394'][Math.floor(rng()*3)];ctx.fillRect(x+1,y+1,w-2,24);ctx.strokeStyle='rgba(60,48,37,.35)';ctx.strokeRect(x+.5,y+.5,w-1,25);x+=w;}}
    });
    const plasterTex=noiseTexture('plasterTex','#d7c59d',['#efe2c4','#b89e73','#fff4d9'],12);
    const terracottaTex=noiseTexture('terracottaTex','#a65335',['#c97650','#7b3829','#e99a68'],18,true);
    const pavementTex=noiseTexture('pavementTex','#9c9280',['#c8bda8','#70685d','#a89f8f'],22,true);
    const asphaltTex=noiseTexture('asphaltTex','#393d3d',['#606565','#202323','#7d827f'],26);
    const dirtTex=noiseTexture('dirtTex','#9b7043',['#c19863','#694729','#dec18b'],31);
    const grassDryTex=noiseTexture('grassDryTex','#77723c',['#b5a952','#484d27','#d3c878'],37);
    const grassGreenTex=noiseTexture('grassGreenTex','#47643b',['#76905c','#29472e','#96a96b'],43);
    const rockTex=noiseTexture('rockTex','#6e6a61',['#989388','#484842','#b3aa9d'],49);
    const sandTex=noiseTexture('sandTex','#c7a96e',['#ead49b','#9c7a42','#d9bd82'],53);
    const soilTex=makeTexture('soilTex',256,(ctx,s)=>{ctx.fillStyle='#66452e';ctx.fillRect(0,0,s,s);for(let x=6;x<s;x+=22){ctx.strokeStyle=x%44?'#8a6140':'#4d3322';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,s);ctx.stroke();}});
    makeMaterial('stone','#b29e7f',{texture:stoneTex});
    makeMaterial('plaster','#dfcfaa',{texture:plasterTex});
    makeMaterial('plasterWarm','#c9825e',{texture:plasterTex});
    makeMaterial('plasterGold','#d5b86f',{texture:plasterTex});
    makeMaterial('plasterPale','#eee2c4',{texture:plasterTex});
    makeMaterial('terracotta','#a85637',{texture:terracottaTex});
    makeMaterial('pavement','#a39a89',{texture:pavementTex});
    makeMaterial('asphalt','#3d4241',{texture:asphaltTex});
    makeMaterial('dirt','#9d7246',{texture:dirtTex});
    makeMaterial('dryGrass','#77713c',{texture:grassDryTex});
    makeMaterial('greenGrass','#4d6c42',{texture:grassGreenTex});
    makeMaterial('rock','#716e67',{texture:rockTex});
    makeMaterial('sand','#c9aa6d',{texture:sandTex});
    makeMaterial('soil','#69472e',{texture:soilTex});
    makeMaterial('wood','#6e4229'); makeMaterial('woodDark','#3e281d');
    makeMaterial('metal','#4a5757',{specular:'#7d9994'}); makeMaterial('iron','#253233',{specular:'#66817b'});
    makeMaterial('glass','#233c42',{specular:'#8bc9d3',alpha:.94});
    makeMaterial('water','#397f91',{specular:'#d6ffff',alpha:.88,freeze:false});
    makeMaterial('fur','#74604a'); makeMaterial('furLight','#a08b6d'); makeMaterial('skin','#a56f57');
    makeMaterial('skinDark','#70493d'); makeMaterial('eye','#151414',{specular:'#ffffff'}); makeMaterial('eyeLight','#f5ead7',{emissive:'#4a4238'});
    makeMaterial('leafOlive','#647044'); makeMaterial('leafPine','#31563c'); makeMaterial('leafMountain','#274938'); makeMaterial('leafLight','#7e8c50');
    makeMaterial('flower','#d2a53b',{emissive:'#332405'}); makeMaterial('flowerPurple','#7d5a83');
    makeMaterial('white','#eee7d4'); makeMaterial('red','#8d3f32'); makeMaterial('blue','#3e6b78'); makeMaterial('gold','#c8a24f');
  }
  function shadow(mesh, receive=false) {
    if (!mesh) return mesh;
    mesh.receiveShadows = receive;
    if (shadowGenerator && mesh.getTotalVertices() > 0) shadowGenerator.addShadowCaster(mesh);
    return mesh;
  }
  function box(name, size, position, material, parent=null) {
    const mesh=BABYLON.MeshBuilder.CreateBox(name,{width:size[0],height:size[1],depth:size[2]},scene);mesh.position.copyFromFloats(...position);mesh.material=material;if(parent)mesh.parent=parent;return shadow(mesh);
  }
  function cyl(name, diameter, height, position, material, tess=12, parent=null) {
    const mesh=BABYLON.MeshBuilder.CreateCylinder(name,{diameter,height,tessellation:tess},scene);mesh.position.copyFromFloats(...position);mesh.material=material;if(parent)mesh.parent=parent;return shadow(mesh);
  }
  function ico(name, scale, position, material, subdivisions=2, parent=null) {
    const mesh=BABYLON.MeshBuilder.CreateIcoSphere(name,{radius:1,subdivisions,flat:false},scene);mesh.scaling.copyFromFloats(...scale);mesh.position.copyFromFloats(...position);mesh.material=material;if(parent)mesh.parent=parent;return shadow(mesh);
  }
  function capsuleBetween(name, a, b, radius, material, parent=null) {
    const start=v3(...a),end=v3(...b),delta=end.subtract(start),height=delta.length();
    let mesh;
    if(BABYLON.MeshBuilder.CreateCapsule) mesh=BABYLON.MeshBuilder.CreateCapsule(name,{height,radius,tessellation:12,subdivisions:2},scene);
    else mesh=BABYLON.MeshBuilder.CreateCylinder(name,{height,diameter:radius*2,tessellation:12},scene);
    mesh.position=start.add(end).scale(.5);mesh.rotationQuaternion=BABYLON.Quaternion.FromUnitVectorsToRef(BABYLON.Axis.Y,delta.normalize(),new BABYLON.Quaternion());mesh.material=material;if(parent)mesh.parent=parent;return shadow(mesh);
  }
  function gableRoof(name, width, depth, height, position, material, parent=null) {
    const p=[-width/2,0,-depth/2,width/2,0,-depth/2,width/2,0,depth/2,-width/2,0,depth/2,0,height,-depth/2,0,height,depth/2];
    const indices=[0,1,4,1,2,5,1,5,4,2,3,5,3,0,4,3,4,5,0,3,2,0,2,1];
    const normals=[];BABYLON.VertexData.ComputeNormals(p,indices,normals);const uv=new Array(12).fill(0).flatMap((_,i)=>[i%2,(i>>1)%2]).slice(0,12);
    const mesh=new BABYLON.Mesh(name,scene);const data=new BABYLON.VertexData();data.positions=p;data.indices=indices;data.normals=normals;data.uvs=uv;data.applyToMesh(mesh);mesh.position.copyFromFloats(...position);mesh.material=material;if(parent)mesh.parent=parent;return shadow(mesh);
  }
  function sign(text, position, width=6, parent=null) {
    const plane=BABYLON.MeshBuilder.CreatePlane(`sign-${text}`,{width,height:width*.22},scene);plane.position.copyFromFloats(...position);plane.billboardMode=BABYLON.Mesh.BILLBOARDMODE_Y;
    const tex=new BABYLON.DynamicTexture(`signTex-${text}`,{width:1024,height:224},scene,false);const ctx=tex.getContext();ctx.fillStyle='rgba(245,232,200,.96)';ctx.fillRect(0,0,1024,224);ctx.strokeStyle='#8b7043';ctx.lineWidth=12;ctx.strokeRect(6,6,1012,212);ctx.fillStyle='#162a2e';ctx.font='bold 66px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text.toUpperCase(),512,112);tex.update();
    const mat=new BABYLON.StandardMaterial(`signMat-${text}`,scene);mat.diffuseTexture=tex;mat.emissiveColor=new BABYLON.Color3(.18,.17,.13);mat.backFaceCulling=false;mat.freeze();plane.material=mat;if(parent)plane.parent=parent;plane.isPickable=false;return plane;
  }
  function sectionPlatform(section, position, size, material=materials.pavement) {
    const root=new BABYLON.TransformNode(`section-${section.id}`,scene);root.position.copyFromFloats(...position);root.metadata={sectionId:section.id};sectionRoots.set(section.id,root);
    const base=box(`${section.id}-base`,[size[0],.55,size[1]],[0,.05,0],material,root);base.receiveShadows=true;base.metadata={sectionId:section.id};
    const borderMat=materials.stone;
    box(`${section.id}-border-n`,[size[0]+.5,.42,.35],[0,.43,-size[1]/2],borderMat,root);
    box(`${section.id}-border-s`,[size[0]+.5,.42,.35],[0,.43,size[1]/2],borderMat,root);
    box(`${section.id}-border-w`,[.35,.42,size[1]],[ -size[0]/2,.43,0],borderMat,root);
    box(`${section.id}-border-e`,[.35,.42,size[1]],[ size[0]/2,.43,0],borderMat,root);
    sign(`${section.number} · ${section.title}`,[0,7.2,-size[1]/2+.3],Math.min(8,size[0]-.7),root);
    return root;
  }
  function addWindow(parent,x,y,z,front=true,balcony=false,wide=false) {
    const w=wide?1.05:.7,h=1.05;
    const window=box('window',[w,h,.08],[x,y,z],materials.glass,parent);window.isPickable=false;
    const frame=materials.woodDark;
    box('frameTop',[w+.15,.08,.11],[x,y+h/2+.05,z-.02],frame,parent);box('frameBottom',[w+.15,.08,.11],[x,y-h/2-.05,z-.02],frame,parent);box('frameLeft',[.08,h,.11],[x-w/2-.05,y,z-.02],frame,parent);box('frameRight',[.08,h,.11],[x+w/2+.05,y,z-.02],frame,parent);
    if(balcony){box('balconySlab',[w+.75,.12,.65],[x,y-h/2-.14,z-.3],materials.stone,parent);for(let i=-2;i<=2;i++)box('rail',[.04,.62,.04],[x+i*(w+.55)/4,y-.22,z-.58],materials.iron,parent);box('railTop',[w+.65,.05,.05],[x,y+.08,z-.58],materials.iron,parent);}
  }
  function addDoor(parent,x,y,z,width=.9,height=1.8,material=materials.woodDark) {
    box('door',[width,height,.13],[x,y,z],material,parent);box('doorLintel',[width+.2,.12,.18],[x,y+height/2+.03,z-.02],materials.stone,parent);
  }
  function urbanBuilding(parent, x,z, opts={}) {
    const width=opts.width||4, depth=opts.depth||3.4, floors=opts.floors||4, floorH=1.65, height=floors*floorH;
    const root=new BABYLON.TransformNode('urbanBuilding',scene);root.parent=parent;root.position.copyFromFloats(x,.55,z);root.rotation.y=opts.rotation||0;
    const facade=opts.material||materials.plasterPale;box('body',[width,height,depth],[0,height/2,0],facade,root);box('groundBand',[width+.06,1.35,depth+.08],[0,.68,0],opts.groundMaterial||materials.stone,root);box('cornice',[width+.25,.18,depth+.2],[0,height-.08,0],materials.stone,root);
    const roofY=height+.02;if(opts.flatRoof){box('roof',[width+.18,.22,depth+.18],[0,roofY,0],materials.terracotta,root);box('parapet',[width+.3,.35,.16],[0,roofY+.24,-depth/2-.05],materials.stone,root);box('parapet',[width+.3,.35,.16],[0,roofY+.24,depth/2+.05],materials.stone,root);}else gableRoof('roof',width+.35,depth+.35,.8,[0,roofY,0],materials.terracotta,root);
    const columns=Math.max(2,Math.floor(width/1.2));for(let floor=1;floor<floors;floor++){for(let col=0;col<columns;col++){const px=-width/2+(col+.5)*width/columns;addWindow(root,px,floor*floorH+.2,-depth/2-.045,true,floor>1&&((col+floor)%2===0),columns<=2);}}
    addDoor(root,-width*.22,.72,-depth/2-.09,.95,1.55,materials.woodDark);addWindow(root,width*.23,.72,-depth/2-.09,true,false,true);
    if(opts.corner){for(let floor=1;floor<floors;floor++)addWindow(root,width/2+.045,floor*floorH+.2,0,false,floor===2,false);}
    return root;
  }
  function villageHouse(parent,x,z,opts={}) {
    const w=opts.width||3.1,d=opts.depth||2.8,h=opts.height||2.7;const root=new BABYLON.TransformNode('villageHouse',scene);root.parent=parent;root.position.copyFromFloats(x,.55,z);root.rotation.y=opts.rotation||0;
    box('houseBody',[w,h,d],[0,h/2,0],opts.material||materials.plaster,root);gableRoof('houseRoof',w+.35,d+.3,.78,[0,h,0],materials.terracotta,root);addDoor(root,-w*.18,.8,-d/2-.07,.75,1.5);addWindow(root,w*.24,1.45,-d/2-.06,true,opts.balcony||false,false);if(h>3)addWindow(root,-w*.22,2.55,-d/2-.06,true,false,false);return root;
  }
  function wall(parent,start,end,height=.85) { const a=v3(...start),b=v3(...end),mid=a.add(b).scale(.5),len=b.subtract(a).length();const mesh=box('stoneWall',[len,height,.38],[mid.x,mid.y+height/2,mid.z],materials.stone,parent);mesh.rotation.y=Math.atan2(b.z-a.z,b.x-a.x);return mesh; }
  function tree(parent,type,x,z,scale=1) {
    const root=new BABYLON.TransformNode(`tree-${type}`,scene);root.parent=parent;root.position.copyFromFloats(x,.55,z);root.scaling.scaleInPlace(scale);const rng=random(Math.floor((x+33)*123+(z+41)*77));
    if(type==='pine'){
      cyl('trunk',.34,3.2,[0,1.6,0],materials.wood,9,root);for(let i=0;i<3;i++){const cone=BABYLON.MeshBuilder.CreateCylinder('pineCrown',{diameterTop:0,diameterBottom:2.5-i*.35,height:2.3,tessellation:10},scene);cone.position.copyFromFloats(0,2.8+i*.85,0);cone.material=materials.leafPine;cone.parent=root;shadow(cone);}
    } else if(type==='cypress'){
      cyl('trunk',.22,3.6,[0,1.8,0],materials.wood,8,root);const crown=BABYLON.MeshBuilder.CreateCylinder('cypressCrown',{diameterTop:.28,diameterBottom:1.05,height:4.5,tessellation:10},scene);crown.position.copyFromFloats(0,3.3,0);crown.material=materials.leafPine;crown.parent=root;shadow(crown);
    } else if(type==='olive'){
      capsuleBetween('trunk',[-.12,0,0],[.14,2.2,.04],.22,materials.wood,root);capsuleBetween('branch',[-.02,1.25,0],[-.9,2.45,.15],.11,materials.wood,root);capsuleBetween('branch',[.05,1.4,0],[.9,2.55,-.12],.11,materials.wood,root);for(let i=0;i<7;i++){const a=i/7*Math.PI*2;ico('oliveCrown',[1.15,.72,.82],[Math.cos(a)*.72,2.55+(i%2)*.35,Math.sin(a)*.55],materials.leafOlive,1,root);}
    } else {
      cyl('trunk',.28,3.3,[0,1.65,0],materials.wood,9,root);for(let i=0;i<6;i++){const a=i/6*Math.PI*2;ico('crown',[1.12,.95,.98],[Math.cos(a)*.72,3.3+(i%2)*.38,Math.sin(a)*.62],type==='mountain'?materials.leafMountain:materials.leafLight,1,root);}
    }
    root.rotation.y=rng()*Math.PI;return root;
  }
  function shrub(parent,x,z,material=materials.leafOlive,scale=1) { const root=new BABYLON.TransformNode('shrub',scene);root.parent=parent;root.position.copyFromFloats(x,.55,z);for(let i=0;i<4;i++){const a=i*Math.PI*.5;ico('shrubLeaf',[.58,.38,.48],[Math.cos(a)*.35,.28+(i%2)*.17,Math.sin(a)*.28],material,1,root);}root.scaling.scaleInPlace(scale);return root; }
  function bench(parent,x,z,rotation=0){const root=new BABYLON.TransformNode('bench',scene);root.parent=parent;root.position.copyFromFloats(x,.55,z);root.rotation.y=rotation;box('seat',[1.8,.14,.55],[0,.55,0],materials.wood,root);box('back',[1.8,.72,.12],[0,.92,.24],materials.wood,root);for(const px of [-.7,.7])box('leg',[.12,.55,.12],[px,.28,0],materials.iron,root);return root;}
  function lamp(parent,x,z,scale=1){const root=new BABYLON.TransformNode('lamp',scene);root.parent=parent;root.position.copyFromFloats(x,.55,z);root.scaling.scaleInPlace(scale);cyl('pole',.12,3.2,[0,1.6,0],materials.iron,10,root);const head=ico('lampHead',[.33,.25,.33],[0,3.23,0],materials.gold,2,root);head.material=materials.gold;return root;}
  function rock(parent,x,y,z,scale=1,material=materials.rock){const mesh=ico('rock',[1.1,.72,.9],[x,y,z],material,1,parent);mesh.scaling.scaleInPlace(scale);mesh.rotation.copyFromFloats(.2,x*.31,z*.27);return mesh;}
  function createMacaqueSection() {
    const section=sectionMap.get('macaque'),root=sectionPlatform(section,[-23,0,-8],[11,11],materials.dryGrass);
    const pedestal=cyl('macaquePedestal',4.7,1.1,[0,1.05,0],materials.rock,14,root);pedestal.receiveShadows=true;
    const monkey=new BABYLON.TransformNode('barbaryMacaque',scene);monkey.parent=root;monkey.position.copyFromFloats(0,1.1,0);monkey.rotation.y=.12;
    ico('torso',[1.16,1.6,.88],[0,2.85,0],materials.fur,3,monkey);ico('chest',[.88,1.05,.72],[0,3.2,-.55],materials.furLight,2,monkey);
    ico('head',[.88,.84,.76],[0,4.95,-.05],materials.fur,3,monkey);ico('face',[.63,.55,.43],[0,4.88,-.62],materials.skin,3,monkey);ico('muzzle',[.48,.27,.34],[0,4.65,-.91],materials.skinDark,2,monkey);
    ico('cheekL',[.42,.46,.34],[-.56,4.86,-.28],materials.furLight,2,monkey);ico('cheekR',[.42,.46,.34],[.56,4.86,-.28],materials.furLight,2,monkey);
    ico('earL',[.22,.28,.12],[-.79,4.94,-.08],materials.skin,2,monkey);ico('earR',[.22,.28,.12],[.79,4.94,-.08],materials.skin,2,monkey);
    for(const side of [-1,1]){ico(`eyeWhite${side}`,[.18,.14,.09],[side*.25,5.04,-.98],materials.eyeLight,2,monkey);ico(`eye${side}`,[.095,.105,.06],[side*.23,5.03,-1.055],materials.eye,2,monkey);ico(`brow${side}`,[.29,.10,.09],[side*.26,5.24,-.91],materials.fur,2,monkey);ico(`nostril${side}`,[.045,.035,.03],[side*.12,4.69,-1.22],materials.eye,1,monkey);}
    const mouth=capsuleBetween('mouth',[-.19,4.52,-1.21],[.19,4.52,-1.21],.025,materials.eye,monkey);
    capsuleBetween('upperArmL',[-.72,3.92,-.08],[-1.22,2.7,-.42],.28,materials.fur,monkey);capsuleBetween('foreArmL',[-1.22,2.7,-.42],[-1.02,1.55,-.72],.24,materials.fur,monkey);
    capsuleBetween('upperArmR',[.72,3.92,-.08],[1.22,2.7,-.42],.28,materials.fur,monkey);capsuleBetween('foreArmR',[1.22,2.7,-.42],[1.02,1.55,-.72],.24,materials.fur,monkey);
    ico('handL',[.34,.22,.42],[-1.02,1.4,-.8],materials.skin,2,monkey);ico('handR',[.34,.22,.42],[1.02,1.4,-.8],materials.skin,2,monkey);
    capsuleBetween('thighL',[-.55,2.2,.2],[-1.05,1.15,.4],.38,materials.fur,monkey);capsuleBetween('shinL',[-1.05,1.15,.4],[-1.5,.45,-.65],.27,materials.fur,monkey);
    capsuleBetween('thighR',[.55,2.2,.2],[1.05,1.15,.4],.38,materials.fur,monkey);capsuleBetween('shinR',[1.05,1.15,.4],[1.5,.45,-.65],.27,materials.fur,monkey);
    ico('footL',[.52,.2,.68],[-1.5,.3,-.86],materials.skin,2,monkey);ico('footR',[.52,.2,.68],[1.5,.3,-.86],materials.skin,2,monkey);ico('tailNub',[.25,.24,.32],[0,2.15,.82],materials.fur,2,monkey);
    for(let i=0;i<9;i++){const a=i/9*Math.PI*2;ico('furTuft',[.22,.35,.18],[Math.cos(a)*.92,3.35+Math.sin(a*2)*.18,Math.sin(a)*.67],materials.fur,1,monkey);}
    shrub(root,-3.5,-2.8,materials.leafOlive,.9);shrub(root,3.3,-3.1,materials.leafLight,.8);shrub(root,-3.8,2.5,materials.leafPine,.8);rock(root,3.5,.9,2.5,.65);
    animated.push({type:'macaque',root:monkey,baseY:monkey.position.y});
  }
  function createUrbanSection(){
    const section=sectionMap.get('urban'),root=sectionPlatform(section,[-8,0,-8],[14,11],materials.pavement);
    box('road',[14,.08,3.2],[0,.62,2.65],materials.asphalt,root);box('sidewalk',[14,.18,1.25],[0,.69,.35],materials.pavement,root);box('sidewalk',[14,.18,.75],[0,.69,4.3],materials.pavement,root);
    urbanBuilding(root,-4.8,-2.25,{width:3.8,depth:3.3,floors:4,material:materials.plasterWarm,corner:true});urbanBuilding(root,-.7,-2.3,{width:4.1,depth:3.4,floors:5,material:materials.plasterPale,flatRoof:true});urbanBuilding(root,3.9,-2.25,{width:4.4,depth:3.5,floors:4,material:materials.plasterGold});
    for(const x of [-5.5,-2.1,1.7,5.2])tree(root,'broadleaf',x,.45,.55);bench(root,-2.8,.25,0);bench(root,3.2,.25,0);lamp(root,-6,.2,.8);lamp(root,6,.2,.8);
    for(let x=-6;x<=6;x+=3)box('crossing',[.5,.03,2.3],[x,.68,2.65],materials.white,root);
  }
  function fountain(parent,x,z){const root=new BABYLON.TransformNode('fountain',scene);root.parent=parent;root.position.copyFromFloats(x,.58,z);cyl('basin',2.3,.32,[0,.16,0],materials.stone,18,root);cyl('water',1.85,.08,[0,.34,0],materials.water,24,root);cyl('column',.38,1.3,[0,.98,0],materials.stone,14,root);ico('top',[.3,.3,.3],[0,1.72,0],materials.stone,2,root);return root;}
  function createVillageSection(){
    const section=sectionMap.get('village'),root=sectionPlatform(section,[8,0,-8],[14,11],materials.pavement);
    box('villageLane',[3.2,.08,11],[0,.62,0],materials.stone,root);villageHouse(root,-4.8,-3.2,{width:3.4,height:3.2,material:materials.plasterPale,rotation:.03});villageHouse(root,-4.6,.2,{width:3.1,height:2.6,material:materials.plasterWarm,rotation:-.04});villageHouse(root,-4.2,3.45,{width:3.5,height:3.7,material:materials.plasterGold,balcony:true});villageHouse(root,4.5,-3.15,{width:3.1,height:2.9,material:materials.plasterPale,rotation:-.02});villageHouse(root,4.7,.25,{width:3.5,height:3.4,material:materials.plaster,balcony:true});villageHouse(root,4.35,3.5,{width:3.4,height:2.5,material:materials.plasterWarm});
    fountain(root,0,0);tree(root,'cypress',-2.1,-3.4,.6);tree(root,'cypress',2.2,3.6,.6);bench(root,-2,1.45,Math.PI/2);bench(root,2,-1.45,-Math.PI/2);for(const [x,z] of [[-2.2,-.3],[2.2,.5],[-1.8,3],[1.8,-3]])shrub(root,x,z,materials.leafOlive,.55);
  }
  function boat(parent,x,z,rotation=0,scale=1){const root=new BABYLON.TransformNode('boat',scene);root.parent=parent;root.position.copyFromFloats(x,.72,z);root.rotation.y=rotation;root.scaling.scaleInPlace(scale);const hull=BABYLON.MeshBuilder.CreateCylinder('hull',{diameterTop:.45,diameterBottom:1.25,height:2.8,tessellation:12},scene);hull.rotation.z=Math.PI/2;hull.scaling.z=.45;hull.material=materials.white;hull.parent=root;shadow(hull);box('deck',[1.55,.12,.65],[0,.2,0],materials.wood,root);cyl('mast',.08,2.4,[0,.95,0],materials.woodDark,8,root);return root;}
  function createPortSection(){
    const section=sectionMap.get('port'),root=sectionPlatform(section,[23,0,-8],[15,11],materials.pavement);
    const water=BABYLON.MeshBuilder.CreateGround('harborWater',{width:15,height:4.8,subdivisions:1},scene);water.position.copyFromFloats(0,.62,3.05);water.material=materials.water;water.parent=root;water.receiveShadows=true;
    box('quay',[15,.35,1.4],[0,.78,.05],materials.stone,root);box('warehouse',[7,3.2,3.2],[-2.1,2.15,-3],materials.stone,root);gableRoof('warehouseRoof',7.35,3.5,.9,[-2.1,3.75,-3],materials.terracotta,root);for(const x of [-4.5,-2.1,.3])addDoor(root,x,1.45,-4.62,1.25,2,materials.woodDark);
    const lighthouse=new BABYLON.TransformNode('lighthouse',scene);lighthouse.parent=root;lighthouse.position.copyFromFloats(5.1,.55,-2.7);const tower=BABYLON.MeshBuilder.CreateCylinder('tower',{diameterTop:1,diameterBottom:1.65,height:5.4,tessellation:18},scene);tower.position.y=2.7;tower.material=materials.plasterPale;tower.parent=lighthouse;shadow(tower);cyl('lantern',1.35,.8,[0,5.75,0],materials.glass,14,lighthouse);const cap=BABYLON.MeshBuilder.CreateCylinder('cap',{diameterTop:0,diameterBottom:1.5,height:.7,tessellation:14},scene);cap.position.y=6.45;cap.material=materials.red;cap.parent=lighthouse;shadow(cap);
    boat(root,-4.6,3.1,.2,.85);boat(root,0,3.4,-.2,.75);boat(root,4,3,.35,.9);for(const x of [-6,-3,0,3,6]){cyl('bollard',.25,.45,[x,1.15,.55],materials.iron,10,root);}lamp(root,-6,-.35,.75);lamp(root,3,-.35,.75);bench(root,0,-.25,0);
    animated.push({type:'water',mesh:water});
  }
  function createFincaSection(){
    const section=sectionMap.get('finca'),root=sectionPlatform(section,[-15,0,12],[15,11],materials.dirt);
    const house=new BABYLON.TransformNode('finca',scene);house.parent=root;house.position.copyFromFloats(-1,.55,-1.2);box('fincaBody',[6,3.4,4],[0,1.7,0],materials.stone,house);gableRoof('fincaRoof',6.4,4.35,1,[0,3.4,0],materials.terracotta,house);addDoor(house,0,1,-2.08,1.15,1.9);addWindow(house,-1.8,1.7,-2.05,true,false,false);addWindow(house,1.8,1.7,-2.05,true,false,false);box('porch',[3.2,.18,1.7],[0,1.3,-2.65],materials.wood,house);for(const x of [-1.35,1.35])cyl('porchPost',.16,2.2,[x,1.1,-2.65],materials.wood,9,house);
    wall(root,[-6.8,.55,-4.3],[-6.8,.55,4.3]);wall(root,[-6.8,.55,4.3],[-1.5,.55,4.3]);wall(root,[2.4,.55,4.3],[6.8,.55,4.3]);wall(root,[6.8,.55,4.3],[6.8,.55,-4.3]);
    tree(root,'olive',-5,-2.8,1.05);tree(root,'olive',4.8,-2.4,.95);tree(root,'olive',4.7,2.7,.9);tree(root,'cypress',-5.6,2.8,.65);for(let x=-5;x<=5;x+=1.4){for(const z of [3.5,4])shrub(root,x,z,materials.leafLight,.32);}rock(root,5,.85,0,.55);rock(root,-4,.75,.5,.42);
  }
  function terrainPatch(parent,name,width,depth,subdiv,heightFn,material,position=[0,.55,0]){
    const positions=[],indices=[],uvs=[],normals=[];for(let z=0;z<=subdiv;z++){for(let x=0;x<=subdiv;x++){const px=(x/subdiv-.5)*width,pz=(z/subdiv-.5)*depth,py=heightFn(px,pz);positions.push(px,py,pz);uvs.push(x/subdiv*4,z/subdiv*4);}}
    for(let z=0;z<subdiv;z++)for(let x=0;x<subdiv;x++){const i=z*(subdiv+1)+x;indices.push(i,i+subdiv+1,i+1,i+1,i+subdiv+1,i+subdiv+2);}BABYLON.VertexData.ComputeNormals(positions,indices,normals);const mesh=new BABYLON.Mesh(name,scene);const data=new BABYLON.VertexData();data.positions=positions;data.indices=indices;data.normals=normals;data.uvs=uvs;data.applyToMesh(mesh);mesh.position.copyFromFloats(...position);mesh.material=material;mesh.parent=parent;mesh.receiveShadows=true;return mesh;
  }
  function createMountainSection(){
    const section=sectionMap.get('mountain'),root=sectionPlatform(section,[2,0,12],[16,12],materials.rock);
    const terrain=terrainPatch(root,'mountainTerrain',15.4,11.4,28,(x,z)=>Math.max(0,1.7+Math.sin(x*.42)*.45+Math.cos(z*.48)*.35+(z+5.5)*.13-Math.exp(-(x*x+z*z)/15)*1.2),materials.greenGrass,[0,.35,0]);
    const stream=BABYLON.MeshBuilder.CreateGround('stream',{width:2,height:10,subdivisions:1},scene);stream.position.copyFromFloats(0,.92,.6);stream.rotation.y=.08;stream.material=materials.water;stream.parent=root;
    villageHouse(root,-4.5,-1.2,{width:3,height:3.1,material:materials.stone,rotation:.08});villageHouse(root,4.1,1.5,{width:3.3,height:3.6,material:materials.stone,rotation:-.08});villageHouse(root,-3.4,3.5,{width:2.8,height:2.6,material:materials.plaster,rotation:.12});
    for(const [x,z,s] of [[-6,-4,.75],[-4.5,-4,.65],[-6,3,.72],[5.8,-3,.8],[6,3.8,.7],[3.7,-4,.62],[-1.8,-4.4,.58],[1.9,4.3,.65]])tree(root,'mountain',x,z,s);
    for(const [x,z,s] of [[-6,0,.7],[-2,2,.6],[2,-2,.55],[5,0,.8],[1,4,.55],[-4,4,.7]])rock(root,x,1.2,z,s);
    const bridge=new BABYLON.TransformNode('bridge',scene);bridge.parent=root;bridge.position.copyFromFloats(0,1.25,0);box('bridgeDeck',[4.1,.35,1.25],[0,.15,0],materials.stone,bridge);for(const z of [-.62,.62]){for(const x of [-1.8,-.9,0,.9,1.8])cyl('bridgePost',.13,.8,[x,.62,z],materials.stone,8,bridge);box('bridgeRail',[4.2,.16,.16],[0,.95,z],materials.stone,bridge);}
    animated.push({type:'water',mesh:stream});
  }
  function createVegetationSection(){
    const section=sectionMap.get('vegetation'),root=sectionPlatform(section,[19,0,12],[14,11],materials.dirt);
    const specimens=[['PINO','pine',-5.3,-1.2,.8],['CIPRÉS','cypress',-2.5,-1.2,.75],['OLIVO','olive',.4,-1.2,.85],['MONTAÑA','mountain',3.5,-1.2,.8],['URBANO','broadleaf',5.7,-1.2,.72]];
    for(const [label,type,x,z,s] of specimens){tree(root,type,x,z,s);sign(label,[x,1.1,3.8],2.2,root);}
    for(let i=0;i<14;i++){const x=-5.7+(i%7)*1.9,z=2.3+Math.floor(i/7)*1.05;shrub(root,x,z,i%3===0?materials.leafLight:i%3===1?materials.leafOlive:materials.leafPine,.45+(i%4)*.08);if(i%5===0)ico('flower',[.16,.16,.16],[x,.9,z-.35],i%2?materials.flower:materials.flowerPurple,1,root);}
  }
  function labelPlate(parent,text,x,z,width=2){sign(text,[x,1.45,z],width,parent);}
  function createMaterialsSection(){
    const section=sectionMap.get('materials'),root=sectionPlatform(section,[2,0,27],[20,9],materials.stone);
    const swatches=[['ADOQUÍN',materials.stone],['PAVIMENTO',materials.pavement],['ASFALTO',materials.asphalt],['TIERRA',materials.dirt],['HIERBA SECA',materials.dryGrass],['HIERBA VERDE',materials.greenGrass],['ROCA',materials.rock],['ARENA',materials.sand],['CULTIVO',materials.soil]];
    const start=-8.5,step=2.12;swatches.forEach(([name,mat],index)=>{const x=start+index*step;const slab=box(`swatch-${name}`,[1.85,.24,5.5],[x,.78,0],mat,root);slab.receiveShadows=true;labelPlate(root,name,x,3.55,1.9);if(name==='HIERBA VERDE'||name==='HIERBA SECA')for(let i=0;i<9;i++){const blade=box('blade',[.04,.25,.04],[x-.65+(i%3)*.55,1.02,-1.5+Math.floor(i/3)*1.4],name==='HIERBA VERDE'?materials.leafLight:materials.gold,root);blade.rotation.z=(i%3-.8)*.18;}if(name==='ROCA')for(let i=0;i<4;i++)rock(root,x-.5+i*.33,1.15,-.4+i*.6,.18);});
  }
  function createWorldFrame(){
    const ground=BABYLON.MeshBuilder.CreateGround('showroomGround',{width:68,height:52,subdivisions:2},scene);ground.position.y=-.25;ground.material=materials.sand;ground.receiveShadows=true;
    const water=BABYLON.MeshBuilder.CreateGround('worldWater',{width:90,height:30,subdivisions:1},scene);water.position.copyFromFloats(0,-.15,-37);water.material=materials.water;water.receiveShadows=true;animated.push({type:'water',mesh:water});
    const promenade=box('centralPromenade',[66,.22,4],[0,.02,1.5],materials.pavement);promenade.receiveShadows=true;
    for(let x=-31;x<=31;x+=6){lamp(null,x,-.2,.75);}
    const backdrop=new BABYLON.TransformNode('backdrop',scene);for(let i=0;i<15;i++){const x=-42+i*6,z=-50+(i%3)*2,s=5+(i%4)*1.3;const mountain=ico('distantMountain',[s,s*.72,s*.7],[x,2.2,z],i%2?materials.rock:materials.greenGrass,1,backdrop);mountain.isPickable=false;}
  }
  function buildNavigation(){
    for(const section of sections){const button=document.createElement('button');button.type='button';button.className='sectionButton';button.dataset.section=section.id;button.innerHTML=`<span>${section.number}</span>${section.title}`;button.addEventListener('click',()=>focusSection(section.id));navNode.append(button);}
    voteButtons.forEach(button=>button.addEventListener('click',()=>{feedback[activeSection.id]=button.dataset.vote;localStorage.setItem(FEEDBACK_KEY,JSON.stringify(feedback));updateVote();toast(button.dataset.vote==='like'?'Guardado: este diseño te gusta':'Guardado: quieres revisar este diseño');}));
  }
  function updateVote(){voteButtons.forEach(button=>button.classList.toggle('active',feedback[activeSection.id]===button.dataset.vote));}
  function focusSection(id,instant=false){
    const section=sectionMap.get(id);if(!section||!camera)return;activeSection=section;titleNode.textContent=section.title;codeNode.textContent=section.code;descriptionNode.textContent=section.description;rulesNode.replaceChildren(...section.rules.map(rule=>{const li=document.createElement('li');li.textContent=rule;return li;}));document.querySelectorAll('.sectionButton').forEach(button=>button.classList.toggle('active',button.dataset.section===id));updateVote();
    const target=v3(...section.target);if(instant){camera.setTarget(target);camera.alpha=section.alpha;camera.beta=section.beta;camera.radius=section.radius;}else{const startTarget=camera.target.clone(),startAlpha=camera.alpha,startBeta=camera.beta,startRadius=camera.radius,start=performance.now();const duration=620;const ease=t=>1-Math.pow(1-t,3);const animate=()=>{const t=Math.min(1,(performance.now()-start)/duration),e=ease(t);camera.target=BABYLON.Vector3.Lerp(startTarget,target,e);camera.alpha=startAlpha+(section.alpha-startAlpha)*e;camera.beta=startBeta+(section.beta-startBeta)*e;camera.radius=startRadius+(section.radius-startRadius)*e;if(t<1)requestAnimationFrame(animate);};animate();}
  }
  function installPicking(){scene.onPointerObservable.add(info=>{if(info.type!==BABYLON.PointerEventTypes.POINTERPICK)return;let mesh=info.pickInfo?.pickedMesh;while(mesh){const id=mesh.metadata?.sectionId||mesh.parent?.metadata?.sectionId;if(id){focusSection(id);break;}mesh=mesh.parent;}});}
  function setupScene(){
    if(!window.BABYLON)throw new Error('Babylon.js no se descargó. Comprueba la conexión y recarga.');
    const isMobile=matchMedia('(pointer:coarse)').matches||innerWidth<900;engine=new BABYLON.Engine(canvas,true,{preserveDrawingBuffer:true,stencil:true,antialias:true,doNotHandleContextLost:false});engine.setHardwareScalingLevel(isMobile?Math.max(1,devicePixelRatio*.82):Math.max(1,devicePixelRatio*.65));
    scene=new BABYLON.Scene(engine);scene.clearColor=new BABYLON.Color4(.56,.76,.83,1);scene.fogMode=BABYLON.Scene.FOGMODE_LINEAR;scene.fogColor=c3('#9fc4c4');scene.fogStart=38;scene.fogEnd=90;scene.imageProcessingConfiguration.contrast=1.08;scene.imageProcessingConfiguration.exposure=1.02;
    camera=new BABYLON.ArcRotateCamera('camera',-1.18,1.18,11,v3(...sections[0].target),scene);camera.attachControl(canvas,true);camera.lowerRadiusLimit=6;camera.upperRadiusLimit=70;camera.lowerBetaLimit=.5;camera.upperBetaLimit=1.46;camera.wheelPrecision=26;camera.pinchPrecision=75;camera.panningSensibility=0;camera.inertia=.78;camera.angularSensibilityX=1800;camera.angularSensibilityY=1800;
    const hemi=new BABYLON.HemisphericLight('hemi',v3(.15,1,.1),scene);hemi.intensity=.78;hemi.diffuse=c3('#e8f2e6');hemi.groundColor=c3('#78684f');
    const sun=new BABYLON.DirectionalLight('sun',v3(-.48,-1,.35),scene);sun.position.copyFromFloats(28,48,-28);sun.intensity=1.35;sun.diffuse=c3('#ffe4b1');
    shadowGenerator=new BABYLON.ShadowGenerator(isMobile?1024:2048,sun);shadowGenerator.useBlurExponentialShadowMap=true;shadowGenerator.blurKernel=isMobile?12:20;shadowGenerator.bias=.0008;shadowGenerator.normalBias=.025;
    buildMaterials();progress(18,'Construyendo el paisaje del laboratorio…');createWorldFrame();progress(28,'Modelando el macaco protagonista…');createMacaqueSection();progress(40,'Montando arquitectura urbana…');createUrbanSection();createVillageSection();progress(55,'Construyendo costa, puerto y finca…');createPortSection();createFincaSection();progress(70,'Levantando montaña y vegetación…');createMountainSection();createVegetationSection();progress(83,'Preparando materiales comparables…');createMaterialsSection();
    buildNavigation();installPicking();focusSection('macaque',true);
    scene.registerBeforeRender(()=>{const time=performance.now()*.001;for(const item of animated){if(item.type==='macaque'){item.root.position.y=item.baseY+Math.sin(time*1.8)*.025;item.root.rotation.y=.12+Math.sin(time*.45)*.045;}else if(item.type==='water'){item.mesh.position.y+=(Math.sin(time*1.4)*.00025);}}});
    engine.runRenderLoop(()=>{scene.render();fpsNode.textContent=String(Math.round(engine.getFps()));meshNode.textContent=String(scene.meshes.length);});
    addEventListener('resize',()=>engine.resize());
    progress(100,'Laboratorio listo');setTimeout(()=>loading.classList.add('hide'),250);
    window.WAFTVisualLab0181={version:VERSION,buildId:BUILD_ID,focus:focusSection,getSections:()=>sections.map(s=>({...s})),getFeedback:()=>({...feedback}),getState:()=>({version:VERSION,buildId:BUILD_ID,ready:true,activeSection:activeSection.id,sectionCount:sections.length,meshCount:scene.meshes.length,materialCount:Object.keys(materials).length,fps:Math.round(engine.getFps()),webgl2:engine.webGLVersion===2,hardwareScaling:engine.getHardwareScalingLevel(),feedback:{...feedback},createdAt})};
    window.__WAFT_VISUAL_LAB_0181_READY__=true;
  }
  try { progress(6,'Cargando motor WebGL…'); setupScene(); } catch(error) { fail(error); }
})();
