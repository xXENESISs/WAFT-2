'use strict';
(() => {
  const BUILD_ID='waft-showcase-0182-v3';
  const STORAGE_KEY='waft.visual-showcase.0182.feedback';
  const board=document.getElementById('board');
  const viewer=document.getElementById('viewer');
  const nav=document.getElementById('sectionNav');
  const overviewButton=document.getElementById('overviewButton');
  const numberNode=document.getElementById('itemNumber');
  const titleNode=document.getElementById('itemTitle');
  const descriptionNode=document.getElementById('itemDescription');
  const voteButtons=[...document.querySelectorAll('[data-vote]')];

  const sections=[
    {id:'macaque',number:'01',title:'Macaco protagonista',description:'Anatomía natural, pelaje legible y expresión seria sin aspecto de juguete.',crop:{x:.015,y:.105,w:.155,h:.37}},
    {id:'urban',number:'02',title:'Bloque urbano ibérico',description:'Fachadas proporcionadas, balcones reales, plantas bajas y una calle mediterránea adulta.',crop:{x:.145,y:.105,w:.31,h:.36}},
    {id:'village',number:'03',title:'Pueblo mediterráneo',description:'Casas compactas, piedra, teja, plaza y composición orgánica sin estética infantil.',crop:{x:.42,y:.105,w:.30,h:.36}},
    {id:'port',number:'04',title:'Puerto mediterráneo',description:'Muelle, almacenes, faro y paseo marítimo con lectura inmediata y materiales creíbles.',crop:{x:.70,y:.105,w:.29,h:.36}},
    {id:'finca',number:'05',title:'Finca rural balear',description:'Piedra seca, olivos y volúmenes rurales integrados en un paisaje cálido y sobrio.',crop:{x:.17,y:.47,w:.35,h:.27}},
    {id:'mountain',number:'06',title:'Montaña catalana',description:'Arquitectura de piedra integrada en roca, bosque y agua de montaña.',crop:{x:.50,y:.47,w:.45,h:.27}},
    {id:'vegetation',number:'07',title:'Vegetación base',description:'Especies reconocibles, variedad de siluetas y colocación natural según el entorno.',crop:{x:.01,y:.73,w:.48,h:.255}},
    {id:'materials',number:'08',title:'Materiales del terreno',description:'Piedra, pavimento, tierra, hierba, roca, arena y cultivo con acabado físico creíble.',crop:{x:.48,y:.73,w:.51,h:.255}}
  ];
  const sectionMap=new Map(sections.map(section=>[section.id,section]));
  let active=sections[0];
  let overview=true;
  let feedback={};
  try{feedback=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')||{};}catch{feedback={};}

  function dimensions(){
    return {w:viewer.clientWidth,h:viewer.clientHeight,nw:board.naturalWidth||500,nh:board.naturalHeight||354};
  }

  function applyTransform(){
    const {w,h,nw,nh}=dimensions();
    if(!w||!h||!nw||!nh)return;
    let scale,x,y;
    if(overview){
      scale=Math.min(w/nw,h/nh);
      x=(w-nw*scale)/2;
      y=(h-nh*scale)/2;
    }else{
      const crop=active.crop;
      scale=Math.min(w/(crop.w*nw),h/(crop.h*nh))*.94;
      x=w/2-(crop.x+crop.w/2)*nw*scale;
      y=h/2-(crop.y+crop.h/2)*nh*scale;
    }
    board.style.transform=`translate3d(${x}px,${y}px,0) scale(${scale})`;
  }

  function updateVote(){
    voteButtons.forEach(button=>button.classList.toggle('active',feedback[active.id]===button.dataset.vote));
  }

  function updateCopy(){
    numberNode.textContent=active.number;
    titleNode.textContent=active.title;
    descriptionNode.textContent=active.description;
    document.querySelectorAll('.section-button').forEach(button=>button.classList.toggle('active',button.dataset.section===active.id&&!overview));
    overviewButton.textContent=overview?'ENFOCAR':'VER TODO';
    updateVote();
  }

  function focus(id){
    const section=sectionMap.get(id);
    if(!section)return;
    active=section;
    overview=false;
    updateCopy();
    applyTransform();
  }

  function showOverview(){
    overview=true;
    updateCopy();
    applyTransform();
  }

  for(const section of sections){
    const button=document.createElement('button');
    button.type='button';
    button.className='section-button';
    button.dataset.section=section.id;
    button.innerHTML=`<span>${section.number}</span>${section.title}`;
    button.addEventListener('click',()=>focus(section.id));
    nav.append(button);
  }

  overviewButton.addEventListener('click',()=>overview?focus(active.id):showOverview());
  voteButtons.forEach(button=>button.addEventListener('click',()=>{
    feedback[active.id]=button.dataset.vote;
    localStorage.setItem(STORAGE_KEY,JSON.stringify(feedback));
    updateVote();
  }));

  let startX=0,startY=0,moved=false;
  viewer.addEventListener('pointerdown',event=>{startX=event.clientX;startY=event.clientY;moved=false;viewer.setPointerCapture?.(event.pointerId);});
  viewer.addEventListener('pointermove',event=>{if(Math.abs(event.clientX-startX)+Math.abs(event.clientY-startY)>12)moved=true;});
  viewer.addEventListener('pointerup',event=>{
    if(moved||overview)return;
    const direction=event.clientX<viewer.getBoundingClientRect().left+viewer.clientWidth/2?-1:1;
    const index=sections.findIndex(section=>section.id===active.id);
    focus(sections[(index+direction+sections.length)%sections.length].id);
  });

  board.addEventListener('load',()=>{applyTransform();window.__WAFT_VISUAL_SHOWCASE_0182_READY__=true;});
  addEventListener('resize',applyTransform);
  updateCopy();
  if(board.complete)board.dispatchEvent(new Event('load'));

  window.WAFTVisualShowcase0182={
    buildId:BUILD_ID,
    focus,
    overview:showOverview,
    getSections:()=>sections.map(section=>({...section,crop:{...section.crop}})),
    getState:()=>({buildId:BUILD_ID,ready:Boolean(window.__WAFT_VISUAL_SHOWCASE_0182_READY__),overview,activeSection:active.id,sectionCount:sections.length,imageWidth:board.naturalWidth,imageHeight:board.naturalHeight,feedback:{...feedback}})
  };
})();
