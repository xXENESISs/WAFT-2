'use strict';
(() => {
  const BUILD='0.23.9';
  const REGION_ID=window.__WAFT_ADVENTURE_REGION__||'baleares';
  const PROJECTIONS={
    baleares:{origin:{lat:39.6,lon:2.9},kmPerDegreeLat:111.132,kmPerDegreeLon:85.77353418580084,unitsPerKm:5,compression:.76,anchors:[
      {id:'mallorca',lat:39.65,lon:2.9},{id:'menorca',lat:39.97,lon:4.08},{id:'ibiza',lat:38.98,lon:1.43},{id:'formentera',lat:38.70,lon:1.47},{id:'cabrera',lat:39.15,lon:2.95}
    ]},
    'catalunya-litoral':{origin:{lat:41.525,lon:2.15},kmPerDegreeLat:111.132,kmPerDegreeLon:83.34155778169932,unitsPerKm:3.2,compression:1,anchors:[]}
  };
  const ZONES={
    baleares:{
      'mar-balear':{name:'Mar Balear',habitat:'mar abierto',species:['Prionace glauca','Caretta caretta','Tursiops truncatus']},
      'mallorca-tramuntana':{name:'Serra de Tramuntana',habitat:'montaña mediterránea',species:['Alytes muletensis','Aegypius monachus','Capra hircus']},
      'mallorca-pla':{name:'Pla de Mallorca',habitat:'mosaico agrícola mediterráneo',species:['Oryctolagus cuniculus','Genetta genetta','Sus scrofa domesticus']},
      'mallorca-llevant':{name:'Llevant de Mallorca',habitat:'garriga y pinar mediterráneo',species:['Sylvia balearica','Genetta genetta','Oryctolagus cuniculus']},
      'mallorca-palma':{name:'Badia de Palma',habitat:'litoral urbano mediterráneo',species:['Falco peregrinus','Larus michahellis','Apus apus']},
      menorca:{name:'Menorca',habitat:'mosaico rural insular',species:['Bos taurus · raça menorquina','Podarcis lilfordi','Oryctolagus cuniculus']},
      pitiuses:{name:'Pitiüses',habitat:'garriga insular',species:['Podarcis pityusensis','Sylvia balearica','Puffinus mauretanicus']},
      cabrera:{name:'Arxipèlag de Cabrera',habitat:'islas, garriga y costa protegida',species:['Podarcis lilfordi','Larus audouinii','Puffinus mauretanicus','Falco eleonorae']},
      'balearic-islets':{name:'Illots de les Balears',habitat:'islas mediterráneas',species:['Podarcis lilfordi','Puffinus mauretanicus']}
    },
    'catalunya-litoral':{
      'mediterrani-cat':{name:'Mediterrani català',habitat:'mar y costa mediterránea',species:['Prionace glauca','Caretta caretta','Tursiops truncatus']},
      collserola:{name:'Collserola',habitat:'pinar y bosque mediterráneo periurbano',species:['Sus scrofa','Sciurus vulgaris','Genetta genetta']},
      'barcelona-urbana':{name:'Barcelona urbana',habitat:'ecosistema urbano mediterráneo',species:['Falco peregrinus','Tachymarptis melba','Ardea cinerea','Corvus monedula']},
      'delta-llobregat':{name:'Delta del Llobregat',habitat:'humedal litoral',species:['Ardea cinerea','Anas platyrhynchos','Falco tinnunculus']},
      garraf:{name:'Massís del Garraf',habitat:'roquedo y matorral mediterráneo',species:['Oryctolagus cuniculus','Vulpes vulpes','Aquila fasciata']},
      montserrat:{name:'Montserrat',habitat:'macizo rocoso mediterráneo',species:['Aquila fasciata','Vulpes vulpes','Genetta genetta']},
      montseny:{name:'Montseny',habitat:'bosque mediterráneo y húmedo de montaña',species:['Salamandra salamandra','Capreolus capreolus','Vulpes vulpes']},
      maresme:{name:'Maresme',habitat:'litoral, pinar y matorral',species:['Sylvia melanocephala','Oryctolagus cuniculus','Vulpes vulpes']},
      girones:{name:'Gironès i Selva',habitat:'bosque y mosaico rural',species:['Sus scrofa','Capreolus capreolus','Meles meles']},
      'costa-daurada':{name:'Costa Daurada',habitat:'litoral mediterráneo y cultivo',species:['Oryctolagus cuniculus','Vulpes vulpes','Sylvia melanocephala']},
      'catalunya-central':{name:'Catalunya Central',habitat:'bosque, cultivo y montaña media',species:['Sus scrofa','Capreolus capreolus','Vulpes vulpes','Meles meles']},
      'nordest-mediterrani':{name:'Nord-est mediterrani',habitat:'mosaico mediterráneo',species:['Sus scrofa','Vulpes vulpes','Genetta genetta']}
    }
  };
  const DISTRIBUTION={
    baleares:{
      'goat-1':{lat:39.792,lon:2.815,zone:'mallorca-tramuntana',habitat:'mountain',status:'local'},
      'goat-2':{lat:39.825,lon:2.760,zone:'mallorca-tramuntana',habitat:'mountain',status:'local'},
      'cow-1':{lat:39.966,lon:4.080,zone:'menorca',habitat:'pasture',status:'domestic-local'},
      'pig-1':{lat:39.640,lon:3.020,zone:'mallorca-pla',habitat:'agricultural',status:'domestic-local'},
      'warbler-1':{lat:39.670,lon:3.180,zone:'mallorca-llevant',habitat:'mediterranean-scrub',status:'endemic'},
      'vulture-1':{lat:39.805,lon:2.820,zone:'mallorca-tramuntana',habitat:'mountain',status:'native'},
      'shark-1':{lat:39.500,lon:2.620,zone:'mar-balear',habitat:'open-sea',status:'native'},
      'sargantana-menorca':{lat:39.805,lon:4.285,zone:'menorca',habitat:'coastal-rock',status:'endemic-islets'},
      'sargantana-pitiusa':{lat:38.905,lon:1.430,zone:'pitiuses',habitat:'coastal-scrub',status:'endemic'},
      'sargantana-cabrera':{lat:39.145,lon:2.940,zone:'cabrera',habitat:'coastal-rock',status:'endemic'},
      'rabbit-1':{lat:39.665,lon:3.070,zone:'mallorca-pla',habitat:'agricultural',status:'introduced-established'},
      'rabbit-2':{lat:39.955,lon:4.105,zone:'menorca',habitat:'agricultural',status:'introduced-established'},
      'weasel-1':{lat:39.975,lon:4.060,zone:'menorca',habitat:'agricultural',status:'established'},
      'wild-genet-1':{lat:39.690,lon:3.120,zone:'mallorca-llevant',habitat:'mediterranean-forest',status:'introduced-established'}
    },
    'catalunya-litoral':{
      'pig-cat':{lat:41.425,lon:2.105,zone:'collserola',habitat:'mediterranean-forest',status:'native'},
      'wild-genet-cat':{lat:41.438,lon:2.085,zone:'collserola',habitat:'mediterranean-forest',status:'native'},
      'rabbit-cat':{lat:41.285,lon:1.900,zone:'garraf',habitat:'mediterranean-scrub',status:'native'},
      'salamander-cat':{lat:41.775,lon:2.405,zone:'montseny',habitat:'humid-forest',status:'native'},
      'warbler-cat':{lat:41.550,lon:2.500,zone:'maresme',habitat:'mediterranean-scrub',status:'native'},
      'vulture-cat':{lat:41.600,lon:1.850,zone:'montserrat',habitat:'mountain-rock',status:'native-regional'},
      'cow-cat':{lat:41.940,lon:2.750,zone:'girones',habitat:'pasture',status:'domestic'},
      'shark-cat':{lat:41.335,lon:2.235,zone:'mediterrani-cat',habitat:'open-sea',status:'native'}
    }
  };
  const state={zoneId:null,zoneName:null,habitat:null,species:[],lastTickAt:0,lastToastAt:0,placementsApplied:false};
  const rad=v=>v*Math.PI/180;
  function geoDistance(a,b){const R=6371.0088,p1=rad(a.lat),p2=rad(b.lat),dp=rad(b.lat-a.lat),dl=rad(b.lon-a.lon);const h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));}
  function projectRaw(regionId,lat,lon){const p=PROJECTIONS[regionId];return{x:(lon-p.origin.lon)*p.kmPerDegreeLon*p.unitsPerKm,z:(p.origin.lat-lat)*p.kmPerDegreeLat*p.unitsPerKm};}
  function closestRealAnchor(lat,lon){const p=PROJECTIONS.baleares;let best=null;for(const anchor of p.anchors){const d=Math.hypot((lon-anchor.lon)*p.kmPerDegreeLon,(lat-anchor.lat)*p.kmPerDegreeLat);if(!best||d<best.d)best={anchor,d};}return best;}
  function geoToRegional(regionId,lat,lon){const p=PROJECTIONS[regionId],raw=projectRaw(regionId,lat,lon);if(regionId!=='baleares')return raw;const nearest=closestRealAnchor(lat,lon);if(!nearest)return raw;const aRaw=projectRaw('baleares',nearest.anchor.lat,nearest.anchor.lon);return{x:raw.x-(1-p.compression)*aRaw.x,z:raw.z-(1-p.compression)*aRaw.z};}
  function closestCompressedAnchor(x,z){const p=PROJECTIONS.baleares;let best=null;for(const anchor of p.anchors){const raw=projectRaw('baleares',anchor.lat,anchor.lon),c={x:raw.x*p.compression,z:raw.z*p.compression,rawX:raw.x,rawZ:raw.z},d=Math.hypot(x-c.x,z-c.z);if(!best||d<best.d)best={anchor,c,d};}return best;}
  function regionalToGeo(regionId,x,z){const p=PROJECTIONS[regionId];let rawX=x,rawZ=z;if(regionId==='baleares'){const nearest=closestCompressedAnchor(x,z);if(nearest){rawX=x+(1-p.compression)*nearest.c.rawX;rawZ=z+(1-p.compression)*nearest.c.rawZ;}}return{lat:p.origin.lat-rawZ/p.unitsPerKm/p.kmPerDegreeLat,lon:p.origin.lon+rawX/p.unitsPerKm/p.kmPerDegreeLon};}
  function near(geo,lat,lon,km){return geoDistance(geo,{lat,lon})<=km;}
  function zoneFor(geo,surface){
    if(REGION_ID==='baleares'){
      if(surface?.water)return'mar-balear';
      if(geo.lat>=39.07&&geo.lat<=39.22&&geo.lon>=2.84&&geo.lon<=3.06)return'cabrera';
      if(geo.lat>=39.72&&geo.lat<=40.15&&geo.lon>=3.70&&geo.lon<=4.40)return'menorca';
      if(geo.lat>=38.58&&geo.lat<=39.18&&geo.lon>=1.10&&geo.lon<=1.72)return'pitiuses';
      if(geo.lat>=39.52&&geo.lat<=40.05&&geo.lon>=2.35&&geo.lon<=2.98)return'mallorca-tramuntana';
      if(geo.lat>=39.42&&geo.lat<=39.82&&geo.lon>=2.85&&geo.lon<=3.18)return'mallorca-pla';
      if(geo.lat>=39.42&&geo.lat<=39.82&&geo.lon>3.18&&geo.lon<=3.62)return'mallorca-llevant';
      if(geo.lat>=39.45&&geo.lat<39.65&&geo.lon>=2.45&&geo.lon<2.90)return'mallorca-palma';
      return'balearic-islets';
    }
    if(surface?.water)return'mediterrani-cat';
    if(near(geo,41.425,2.100,8))return'collserola';
    if(near(geo,41.290,2.080,10))return'delta-llobregat';
    if(near(geo,41.3851,2.1734,13))return'barcelona-urbana';
    if(near(geo,41.285,1.900,16))return'garraf';
    if(near(geo,41.593,1.837,16))return'montserrat';
    if(near(geo,41.770,2.400,21))return'montseny';
    if(near(geo,41.550,2.500,18))return'maresme';
    if(near(geo,41.980,2.820,22))return'girones';
    if(near(geo,41.120,1.300,32))return'costa-daurada';
    if(geo.lon<2.20&&geo.lat>41.45)return'catalunya-central';
    return'nordest-mediterrani';
  }
  function surfaceNear(api,lat,lon,kind){const p=geoToRegional(REGION_ID,lat,lon),wantWater=kind==='open-sea'||kind==='water';for(const radius of [0,1.5,3,5,8,12,18,26]){const count=radius?24:1;for(let i=0;i<count;i++){const angle=i/count*Math.PI*2,x=p.x+Math.cos(angle)*radius,z=p.z+Math.sin(angle)*radius,s=api.sampleSurface(x,z);if(!s?.inside)continue;if((wantWater&&s.water)||(!wantWater&&s.land))return{x,z,s};}}return null;}
  function applyPlacements(api){if(state.placementsApplied)return;const game=window.__WAFT_INTERNAL_GAME__,table=DISTRIBUTION[REGION_ID]||{};if(!game?.animals)return;for(const animal of game.animals){const spec=table[animal.id];if(!spec)continue;animal.ecology={zoneId:spec.zone,habitat:spec.habitat,status:spec.status};if(game.mountedAnimalId===animal.id)continue;const found=surfaceNear(api,spec.lat,spec.lon,spec.habitat);if(!found)continue;animal.x=animal.originX=found.x;animal.z=animal.originZ=found.z;const floor=found.s.land?found.s.height:(found.s.waterHeight??0);animal.y=animal.flying?floor+2.1:floor;animal.phase=Math.random()*Math.PI*2;}state.placementsApplied=true;}
  function installUi(){if(document.getElementById('waftEcology0239Style'))return;const style=document.createElement('style');style.id='waftEcology0239Style';style.textContent=`#waftEcoHud{margin-top:2px;color:#9fd9c8;font-size:8px;font-weight:850;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}@media(orientation:landscape) and (max-height:650px){#waftEcoHud{font-size:6.8px}}`;document.head.appendChild(style);const host=document.getElementById('waftGeoHud')||document.getElementById('hud');if(host&&!document.getElementById('waftEcoHud')){const el=document.createElement('div');el.id='waftEcoHud';el.textContent='ECO · identificando hábitat…';host.appendChild(el);}}
  function toast(text){const el=document.getElementById('waftToast')||document.getElementById('waftPlayToast');if(!el)return;el.textContent=text;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),2200);}
  function update(api,player){const geo=regionalToGeo(REGION_ID,player.position.x,player.position.z),surface=api.sampleSurface(player.position.x,player.position.z),zoneId=zoneFor(geo,surface),zone=ZONES[REGION_ID]?.[zoneId];if(!zone)return;const changed=state.zoneId!==zoneId;state.zoneId=zoneId;state.zoneName=zone.name;state.habitat=zone.habitat;state.species=[...zone.species];const el=document.getElementById('waftEcoHud');if(el)el.textContent=`ECO · ${zone.name.toUpperCase()} · ${zone.habitat.toUpperCase()}`;if(changed&&performance.now()-state.lastToastAt>3500){state.lastToastAt=performance.now();toast(`ECOSISTEMA · ${zone.name.toUpperCase()}`);}}
  async function init(){for(let i=0;i<500;i++){if(window.WAFTRegionRuntime?.getState&&window.__WAFT_INTERNAL_GAME__&&window.__WAFT_ADVENTURE_0210_READY__)break;await new Promise(resolve=>setTimeout(resolve,20));}const api=window.WAFTRegionRuntime;if(!api?.getState)return;installUi();applyPlacements(api);const tick=()=>{const player=api.getState?.();if(player){const now=performance.now();if(now-state.lastTickAt>=200){state.lastTickAt=now;update(api,player);}}requestAnimationFrame(tick);};requestAnimationFrame(tick);window.WAFTEcology0239={version:BUILD,getState:()=>({...state,species:[...state.species]}),zoneForGeo:(lat,lon)=>zoneFor({lat:Number(lat),lon:Number(lon)},{water:false,land:true}),zones:ZONES[REGION_ID],distribution:DISTRIBUTION[REGION_ID]||{}};window.__WAFT_ECOLOGY_0239_READY__=true;}
  init().catch(error=>console.error('WAFT 0.23.9 ecology failed',error));
})();
