import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const VERSION='0.26.0';
const SCALE=.33;
const VERTICAL=.0028;
const BOUNDS={west:-180,east:180,south:-90,north:90};
const GRID={columns:690,rows:345};
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const write=(p,s)=>{const full=path.join(root,p);fs.mkdirSync(path.dirname(full),{recursive:true});fs.writeFileSync(full,s);};
const patch=(p,fn)=>{const before=read(p),after=fn(before);if(after!==before)write(p,after);};

const europe=JSON.parse(read('world-generator/configs/europe-atlas.region.json'));
const atlas=structuredClone(europe);
atlas.id='global-atlas';
atlas.name='Mundo · Atlas global continuo';
atlas.version=VERSION;
atlas.status='prototype';
atlas.continent='World';
atlas.countryCodes=[];
atlas.aliases=['Global Atlas','Mundo','WAFT continuous world'];
atlas.geography.bounds=BOUNDS;
atlas.geography.origin={lon:-3.125,lat:39.775};
atlas.geography.projection='local-equirectangular';
atlas.geography.scale.horizontalUnitsPerKm=SCALE;
atlas.geography.scale.verticalExaggeration=.72;
atlas.geography.scale.emptySpaceCompression={mode:'none',factor:1,preserveCoastline:true,anchorIds:[]};
atlas.geography.subregions=[
  {id:'europe',name:'Europa',type:'other',center:{lon:15,lat:52},priority:100},
  {id:'africa',name:'África',type:'other',center:{lon:20,lat:5},priority:100},
  {id:'asia',name:'Asia',type:'other',center:{lon:90,lat:40},priority:100},
  {id:'north-america',name:'América del Norte',type:'other',center:{lon:-105,lat:45},priority:100},
  {id:'south-america',name:'América del Sur',type:'other',center:{lon:-60,lat:-15},priority:100},
  {id:'oceania',name:'Oceanía',type:'other',center:{lon:140,lat:-25},priority:100},
  {id:'antarctica',name:'Antártida',type:'tundra',center:{lon:0,lat:-82},priority:96},
  {id:'arctic',name:'Ártico',type:'tundra',center:{lon:0,lat:82},priority:96},
  {id:'pacific-seam',name:'Pacífico internacional',type:'coast',center:{lon:180,lat:0},priority:100}
];
atlas.sources.terrain={...atlas.sources.terrain,dataset:'Mapzen Terrain Tiles · Terrarium · global macro atlas',attribution:'Mapzen terrain tiles and contributing elevation datasets'};
atlas.sources.landcover={...atlas.sources.landcover,dataset:'Natural Earth 1:50m global land mask with Mapzen elevations',attribution:'Natural Earth + Mapzen terrain tiles'};
atlas.generation.terrain.grid=GRID;
atlas.generation.terrain.lods=[0,1,2,3,4];
atlas.generation.terrain.smoothingPasses=1;
atlas.generation.terrain.coastalFlattening=true;
atlas.generation.terrain.maxWalkableSlopeDegrees=52;
atlas.generation.terrain.seaLevelMeters=0;
atlas.generation.landcover={ruleset:'global-atlas-terrain-only-v1',fallbackBiome:'pasture',season:'dynamic',snowlineMeters:null};
atlas.generation.transport={includeRoadClasses:[],includeRailways:false,includeTrails:false,simplificationMeters:250};
atlas.generation.settlements={maxCount:0,minimumPopulation:0,coastalTourismBoost:0,profiles:['terrain-only'],manualInclude:[],manualExcludeIds:[]};
atlas.generation.buildings={useRealFootprints:false,proceduralFallback:false,minimumSpacingUnits:0,maximumPerSector:0,roofWalkable:false,collisionMode:'none',architectureProfiles:['terrain-only'],hotelDetection:false};
atlas.generation.landmarks={maximumCount:0,minimumScore:100,uniqueModelScore:100,archetypeScore:100,protectedRadiusUnits:0,allowedTypes:['natural_landmark'],manualInclude:[],manualExcludeIds:[]};
atlas.generation.vegetation={profiles:['terrain-only'],densityMultiplier:0,minimumBuildingClearanceUnits:0,instancing:true};
atlas.generation.fauna={ruleset:'global-atlas-terrain-only-v1',maximumSpecies:0,maximumActiveAnimals:0,recordsSinceYear:1990,minimumCoordinatePrecisionMeters:10000,manualInclude:[],manualExcludeScientificNames:[]};
atlas.travel={entryPoints:[{id:'global-origin',name:'Mallorca · mundo continuo',position:{lon:3.0,lat:39.62},type:'air',arrivalHeadingDegrees:0}],connections:[]};
atlas.gameplay={spawnPoints:[{id:'mallorca-global-test',position:{lon:3.0,lat:39.62},role:'default'}],reservedZones:[],contentTargets:{minimumLandmarks:0,minimumFaunaZones:0,maximumEmptyTravelSeconds:99999}};
atlas.performance={targetProfile:'mobile-mid',sectorSizeUnits:96,preloadRadiusSectors:1,budgets:{downloadMb:30,runtimeMemoryMb:320,visibleTriangles:500000,visibleObjects:120,activeColliders:20,textureMemoryMb:36}};
atlas.outputs={directory:'regions/global-atlas',manifest:'manifest.json',terrain:'terrain.bin',landcover:'landcover.bin',sectors:'sectors.json',settlements:'settlements.json',objects:'objects.json',landmarks:'landmarks.json',fauna:'fauna.json',routes:'routes.json'};
atlas.overrides={file:'world-generator/overrides/global-atlas.overrides.json',preserveOnRegenerate:true,failOnUnknownTarget:true};
write('world-generator/configs/global-atlas.region.json',JSON.stringify(atlas,null,2)+'\n');
if(!fs.existsSync(path.join(root,'world-generator/overrides/global-atlas.overrides.json')))write('world-generator/overrides/global-atlas.overrides.json',JSON.stringify({$schema:'../schema/region-overrides.schema.json',schemaVersion:1,regionId:'global-atlas',operations:[]},null,2)+'\n');

let importer=read('world-generator/scripts/import-mapzen-terrarium-atlas.py');
importer=importer.replace('Build the WAFT 0.25.2 continuous Europe atlas DEM.','Build the WAFT 0.26.0 continuous global macro DEM.');
importer=importer.replace('WAFT-Europe-Atlas/0.25.2','WAFT-Global-Atlas/0.26.0');
importer=importer.replace('ZOOM=5','ZOOM=4');
importer=importer.replace("default=\"europe-atlas\"","default=\"global-atlas\"");
write('world-generator/scripts/import-mapzen-terrarium-global.py',importer);

let runtime=read('mallorca-mobile/adventure-0210/europe-atlas-0252.js');
runtime=runtime.replaceAll('0.25.3',VERSION)
  .replaceAll('__WAFT_EUROPE_ATLAS_0252_READY__','__WAFT_GLOBAL_ATLAS_0260_READY__')
  .replaceAll('__WAFT_EUROPE_ATLAS_0252_ACTIVE__','__WAFT_GLOBAL_ATLAS_0260_ACTIVE__')
  .replaceAll('WAFTEuropeAtlas0252','WAFTGlobalAtlas0260')
  .replaceAll('europe-atlas','global-atlas')
  .replaceAll('Europe atlas','Global atlas')
  .replaceAll('EUROPA · MUNDO CONTINUO 0.26.0','MUNDO · CONTINUO 0.26.0');
runtime=runtime.replace(/  if\(window\.__WAFT_GLOBAL_ATLAS_0260_READY__[^\n]*\)return;/,"  if(window.__WAFT_GLOBAL_ATLAS_0260_READY__||window.__WAFT_ADVENTURE_REGION__!=='iberia')return;");
const projectionOld=`  const B={west:-26,east:60,south:26,north:72.5};\n  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));\n  const worldFromGeo=(lat,lon)=>({x:(Number(lon)-P.lon0)*P.kmLon*U,z:-(Number(lat)-P.lat0)*P.kmLat*U});\n  const geoFromWorld=(x,z)=>({lat:P.lat0-Number(z)/(P.kmLat*U),lon:P.lon0+Number(x)/(P.kmLon*U)});\n  const inBounds=g=>Boolean(g&&g.lon>=B.west&&g.lon<=B.east&&g.lat>=B.south&&g.lat<=B.north);`;
const projectionNew=`  const B={west:-180,east:180,south:-90,north:90};\n  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));\n  const wrapLon=lon=>{const n=Number(lon);if(!Number.isFinite(n))return 0;return ((n+180)%360+360)%360-180;};\n  const worldFromGeo=(lat,lon)=>({x:(Number(lon)-P.lon0)*P.kmLon*U,z:-(Number(lat)-P.lat0)*P.kmLat*U});\n  const geoFromWorldRaw=(x,z)=>({lat:P.lat0-Number(z)/(P.kmLat*U),lon:P.lon0+Number(x)/(P.kmLon*U)});\n  const geoFromWorld=(x,z)=>{const g=geoFromWorldRaw(x,z);return{lat:g.lat,lon:wrapLon(g.lon)};};\n  const WORLD_WEST_X=worldFromGeo(0,B.west).x,WORLD_EAST_X=worldFromGeo(0,B.east).x,WORLD_WIDTH=WORLD_EAST_X-WORLD_WEST_X;\n  const inBounds=g=>Boolean(g&&g.lat>=B.south&&g.lat<=B.north&&Number.isFinite(g.lon));`;
if(!runtime.includes(projectionOld))throw new Error('Global projection anchor missing');
runtime=runtime.replace(projectionOld,projectionNew);
runtime=runtime.replace("surfaceSource:'global-atlas'","surfaceSource:'global-atlas',wraps:0,worldWidth:WORLD_WIDTH");
const drawOld="const player=api.getState?.(),pos=player?.position;if(pos){state.lastGeo=geoFromWorld(pos.x,pos.z);rebuildCities(pos.x,pos.z);}";
const drawNew="const player=api.getState?.(),pos=player?.position;if(pos){let px=pos.x;if(px>WORLD_EAST_X)px-=WORLD_WIDTH;else if(px<WORLD_WEST_X)px+=WORLD_WIDTH;if(px!==pos.x&&api.setRegionalPosition){api.setRegionalPosition(px,pos.z,pos.y);state.wraps++;}state.lastGeo=geoFromWorld(px,pos.z);rebuildCities(px,pos.z);}";
if(!runtime.includes(drawOld))throw new Error('Global dateline draw anchor missing');
runtime=runtime.replace(drawOld,drawNew);
runtime=runtime.replace("if(title)title.textContent='MUNDO · CONTINUO 0.26.0';if(stats&&geo)stats.textContent=`ATLAS ÚNICO · ${state.visibleCities} edificios cercanos / ${state.objects.length.toLocaleString('es-ES')} · ${Math.round(state.triangles/1000)}k tri`;","if(title)title.textContent='MUNDO · CONTINUO 0.26.0';if(stats&&geo)stats.textContent=`ATLAS GLOBAL · ${state.visibleCities} edificios europeos cercanos · ${Math.round(state.triangles/1000)}k tri · wrap Pacífico ${state.wraps}`;");
const loadOld="state.phase='loading';const base='../../regions/global-atlas/';const [manifest,tb,cb,settlements,objects]=await Promise.all([loadJson(base+'manifest.json'),loadBuffer(base+'terrain.bin'),loadBuffer(base+'landcover.bin'),loadJson(base+'settlements.json'),loadJson(base+'objects.json')]);";
const loadNew="state.phase='loading';const base='../../regions/global-atlas/',detailBase='../../regions/europe-atlas/';const [manifest,tb,cb,settlements,objects]=await Promise.all([loadJson(base+'manifest.json'),loadBuffer(base+'terrain.bin'),loadBuffer(base+'landcover.bin'),loadJson(detailBase+'settlements.json'),loadJson(detailBase+'objects.json')]);";
if(!runtime.includes(loadOld))throw new Error('Global load anchor missing');
runtime=runtime.replace(loadOld,loadNew);
runtime=runtime.replace("window.__WAFT_GLOBAL_ATLAS_0260_READY__=true;updateHud();setInterval(updateHud,300);","window.__WAFT_GLOBAL_ATLAS_0260_READY__=true;window.WAFTEuropeAtlas0252=window.WAFTGlobalAtlas0260;window.__WAFT_EUROPE_ATLAS_0252_READY__=true;updateHud();setInterval(updateHud,300);");
write('mallorca-mobile/adventure-0210/global-atlas-0260.js',runtime);

patch('mallorca-mobile/adventure-0210/europe-atlas-0252.js',s=>{
  s=s.replaceAll('0.25.3',VERSION);
  const old="if(window.__WAFT_EUROPE_ATLAS_0252_READY__||window.__WAFT_ADVENTURE_REGION__!=='iberia')return;";
  const neu="if(window.__WAFT_EUROPE_ATLAS_0252_READY__||window.__WAFT_GLOBAL_ATLAS_0260_ACTIVE__||window.__WAFT_ADVENTURE_REGION__!=='iberia')return;";
  if(s.includes(old))s=s.replace(old,neu);else if(!s.includes(neu))throw new Error('Europe global guard anchor missing');
  return s;
});

patch('mallorca-mobile/adventure-0210/index.html',s=>{
  s=s.replaceAll("window.__WAFT_ADVENTURE_BUILD__='0.25.3'","window.__WAFT_ADVENTURE_BUILD__='0.26.0'");
  if(!s.includes('global-atlas-0260.js')){
    const marker='<script>window.__WAFT_EUROPE_ATLAS_0252_ACTIVE__=true;<\\/script>';
    if(!s.includes(marker))throw new Error('Global bootstrap marker missing');
    const global=`<script>window.__WAFT_GLOBAL_ATLAS_0260_ACTIVE__=true;<\\/script>\\\n<script src=\"adventure-0210/global-atlas-0260.js?v=\${encodeURIComponent(version)}\"><\\/script>\\\n`;
    s=s.replace(marker,global+marker);
  }
  s=s.replaceAll('window.__WAFT_EUROPE_ATLAS_0252_ACTIVE__?[]:streamer.active','(window.__WAFT_EUROPE_ATLAS_0252_ACTIVE__||window.__WAFT_GLOBAL_ATLAS_0260_ACTIVE__)?[]:streamer.active');
  s=s.replaceAll('state.roads&&!window.__WAFT_EUROPE_ATLAS_0252_ACTIVE__','state.roads&&!window.__WAFT_EUROPE_ATLAS_0252_ACTIVE__&&!window.__WAFT_GLOBAL_ATLAS_0260_ACTIVE__');
  s=s.replaceAll('state.buildings&&!window.__WAFT_EUROPE_ATLAS_0252_ACTIVE__','state.buildings&&!window.__WAFT_EUROPE_ATLAS_0252_ACTIVE__&&!window.__WAFT_GLOBAL_ATLAS_0260_ACTIVE__');
  s=s.replaceAll('state.landmarks&&!window.__WAFT_EUROPE_ATLAS_0252_ACTIVE__','state.landmarks&&!window.__WAFT_EUROPE_ATLAS_0252_ACTIVE__&&!window.__WAFT_GLOBAL_ATLAS_0260_ACTIVE__');
  s=s.replaceAll('state.settlements&&!window.__WAFT_EUROPE_ATLAS_0252_ACTIVE__','state.settlements&&!window.__WAFT_EUROPE_ATLAS_0252_ACTIVE__&&!window.__WAFT_GLOBAL_ATLAS_0260_ACTIVE__');
  const dup='&&!window.__WAFT_GLOBAL_ATLAS_0260_ACTIVE__&&!window.__WAFT_GLOBAL_ATLAS_0260_ACTIVE__';
  const one='&&!window.__WAFT_GLOBAL_ATLAS_0260_ACTIVE__';
  while(s.includes(dup))s=s.replaceAll(dup,one);
  const writeMarker='      document.open();document.write(source);document.close();';
  if(!s.includes('WAFT_GLOBAL_POSITION_API_0260')){
    if(!s.includes(writeMarker))throw new Error('Global position API document.write anchor missing');
    const inject=`      // WAFT_GLOBAL_POSITION_API_0260: bounded world coordinates + Pacific wrap.\n      if(regionId==='iberia'){\n        const positionAnchor=\"      setInput(x, y) { state.joyX = Math.max(-1, Math.min(1, Number(x) || 0)); state.joyY = Math.max(-1, Math.min(1, Number(y) || 0)); },\";\n        const positionReplacement=\"      setRegionalPosition(x,z,y=null) { state.camera.x=Number(x)||0; state.camera.z=Number(z)||0; if(Number.isFinite(Number(y)))state.camera.y=Number(y); return { ...state.camera }; },\\n\"+positionAnchor;\n        if(!source.includes('setRegionalPosition(x,z,y=null)'))source=source.replace(positionAnchor,positionReplacement);\n      }\n`;
    s=s.replace(writeMarker,inject+writeMarker);
  }
  return s;
});

for(const p of ['iberia-world-0244.js','iberia-world-0245.js','iberia-world-0246.js','iberia-world-0247.js','iberia-world-0249.js','iberia-world-0250.js'])patch('mallorca-mobile/adventure-0210/'+p,s=>s.replaceAll('0.25.3',VERSION));

console.log(JSON.stringify({valid:true,version:VERSION,unitsPerKm:SCALE,verticalScale:VERTICAL,bounds:BOUNDS,grid:GRID,triangles:(GRID.columns-1)*(GRID.rows-1)*2,pacificWrap:true,europeDetailPreserved:true},null,2));
