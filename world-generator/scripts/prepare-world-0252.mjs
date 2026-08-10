import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const VERSION='0.25.2';
const SCALE=.30;
const VERTICAL=.0024;
const BOUNDS={west:-26,east:60,south:26,north:72.5};
const GRID={columns:590,rows:406};
const COUNTRIES=[
  'AL','AD','AM','AT','AZ','BY','BE','BA','BG','HR','CY','CZ','DK','EE','FI','FR','GE','DE',
  'GR','HU','IS','IE','IT','XK','LV','LI','LT','LU','MT','MD','MC','ME','NL','MK','NO','PL',
  'PT','RO','RU','SM','RS','SK','SI','ES','SE','CH','TR','UA','GB','VA','GI','FO',
  'MA','DZ','TN','LY','EG','EH'
];
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const write=(p,s)=>{const full=path.join(root,p);fs.mkdirSync(path.dirname(full),{recursive:true});fs.writeFileSync(full,s);};
const patch=(p,fn)=>{const before=read(p),after=fn(before);if(after!==before)write(p,after);};

const base=JSON.parse(read('world-generator/configs/iberia.region.json'));
const atlas=structuredClone(base);
atlas.id='europe-atlas';
atlas.name='Europa · Atlas continuo';
atlas.version=VERSION;
atlas.status='prototype';
atlas.continent='Europe';
atlas.countryCodes=COUNTRIES;
atlas.aliases=['Europe Atlas','Europa','WAFT Europe continuous atlas'];
atlas.geography.bounds=BOUNDS;
atlas.geography.origin={lon:-3.125,lat:39.775};
atlas.geography.projection='local-equirectangular';
atlas.geography.scale.horizontalUnitsPerKm=SCALE;
atlas.geography.scale.verticalExaggeration=.65;
atlas.geography.scale.emptySpaceCompression={mode:'none',factor:1,preserveCoastline:true,anchorIds:[]};
atlas.geography.subregions=[
  {id:'pyrenees',name:'Pirineos',type:'mountain',center:{lon:.55,lat:42.66},priority:100},
  {id:'alps',name:'Alpes',type:'mountain',center:{lon:10.0,lat:46.5},priority:100},
  {id:'carpathians',name:'Cárpatos',type:'mountain',center:{lon:24.0,lat:47.2},priority:96},
  {id:'scandinavia',name:'Escandinavia',type:'mountain',center:{lon:15.0,lat:65.0},priority:94},
  {id:'atlas',name:'Atlas',type:'mountain',center:{lon:-5.0,lat:32.0},priority:92},
  {id:'canary-islands',name:'Canarias',type:'island',center:{lon:-15.5,lat:28.3},priority:92}
];
atlas.sources.terrain={provider:'Mapzen terrain tiles / AWS Open Data',dataset:'Mapzen Terrain Tiles · Terrarium',license:'Source-dependent; see Mapzen terrain tile attribution',attribution:'Mapzen terrain tiles and contributing elevation datasets',resolutionMeters:null,cachePolicy:'build-cache'};
atlas.sources.landcover={provider:'WAFT + Natural Earth',dataset:'Natural Earth 1:50m land mask with Mapzen elevations',license:'Natural Earth public domain; terrain attribution as above',attribution:'Natural Earth + Mapzen terrain tiles',resolutionMeters:null,cachePolicy:'build-cache'};
atlas.generation.terrain.grid=GRID;
atlas.generation.terrain.lods=[0,1,2,3];
atlas.generation.terrain.smoothingPasses=2;
atlas.generation.terrain.coastalFlattening=true;
atlas.generation.terrain.maxWalkableSlopeDegrees=52;
atlas.generation.terrain.seaLevelMeters=0;
atlas.generation.landcover={ruleset:'europe-atlas-terrain-only-v1',fallbackBiome:'pasture',season:'dynamic',snowlineMeters:null};
atlas.generation.transport={includeRoadClasses:[],includeRailways:false,includeTrails:false,simplificationMeters:150};
atlas.generation.settlements={maxCount:0,minimumPopulation:0,coastalTourismBoost:0,profiles:['terrain-only'],manualInclude:[],manualExcludeIds:[]};
atlas.generation.buildings={useRealFootprints:false,proceduralFallback:false,minimumSpacingUnits:0,maximumPerSector:0,roofWalkable:false,collisionMode:'none',architectureProfiles:['terrain-only'],hotelDetection:false};
atlas.generation.landmarks={maximumCount:0,minimumScore:100,uniqueModelScore:100,archetypeScore:100,protectedRadiusUnits:0,allowedTypes:['natural_landmark'],manualInclude:[],manualExcludeIds:[]};
atlas.generation.vegetation={profiles:['terrain-only'],densityMultiplier:0,minimumBuildingClearanceUnits:0,instancing:true};
atlas.generation.fauna={ruleset:'europe-atlas-terrain-only-v1',maximumSpecies:0,maximumActiveAnimals:0,recordsSinceYear:1990,minimumCoordinatePrecisionMeters:10000,manualInclude:[],manualExcludeScientificNames:[]};
atlas.travel={entryPoints:[],connections:[]};
atlas.gameplay={spawnPoints:[{id:'madrid-atlas-test',position:{lon:-3.7038,lat:40.4168},role:'default'}],reservedZones:[],contentTargets:{minimumLandmarks:0,minimumFaunaZones:0,maximumEmptyTravelSeconds:9999}};
atlas.performance={targetProfile:'mobile-mid',sectorSizeUnits:64,preloadRadiusSectors:1,budgets:{downloadMb:25,runtimeMemoryMb:320,visibleTriangles:480000,visibleObjects:120,activeColliders:20,textureMemoryMb:36}};
atlas.outputs={directory:'regions/europe-atlas',manifest:'manifest.json',terrain:'terrain.bin',landcover:'landcover.bin',sectors:'sectors.json',settlements:'settlements.json',objects:'objects.json',landmarks:'landmarks.json',fauna:'fauna.json',routes:'routes.json'};
atlas.overrides={file:'world-generator/overrides/europe-atlas.overrides.json',preserveOnRegenerate:true,failOnUnknownTarget:true};
write('world-generator/configs/europe-atlas.region.json',JSON.stringify(atlas,null,2)+'\n');
if(!fs.existsSync(path.join(root,'world-generator/overrides/europe-atlas.overrides.json')))write('world-generator/overrides/europe-atlas.overrides.json',JSON.stringify({formatVersion:1,regionId:'europe-atlas',operations:[]},null,2)+'\n');

patch('world-generator/scripts/build-region-v2.mjs',s=>{const old="mode: 'copernicus-dem-glo30',";if(!s.includes(old)&&!s.includes("mode: demMetadata.mode ?? 'copernicus-dem-glo30',"))throw new Error('build-region-v2 elevation mode anchor missing');return s.replace(old,"mode: demMetadata.mode ?? 'copernicus-dem-glo30',");});
patch('world-generator/scripts/build-settlement-markers-0244.py',s=>{const old="if args.region_id == 'iberia':";if(!s.includes(old)&&!s.includes("if args.region_id in ('iberia', 'europe-atlas'):"))throw new Error('settlement special anchor missing');return s.replace(old,"if args.region_id in ('iberia', 'europe-atlas'):");});
patch('mallorca-mobile/adventure-0210/iberia-world-0244.js',s=>s.replace("const VERSION='0.24.4';","const VERSION='0.25.2';").replace("unitsPerKm:1.45,verticalScale:0.013594","unitsPerKm:.30,verticalScale:.0024"));
for(const [p,needle] of [
  ['mallorca-mobile/adventure-0210/iberia-world-0245.js','if(window.__WAFT_IBERIA_WORLD_0245_READY__)return;'],
  ['mallorca-mobile/adventure-0210/iberia-world-0247.js',"if(window.__WAFT_IBERIA_WORLD_0247_READY__||window.__WAFT_ADVENTURE_REGION__!=='iberia')return;"],
  ['mallorca-mobile/adventure-0210/iberia-world-0249.js',"if(window.__WAFT_IBERIA_WORLD_0249_READY__||window.__WAFT_ADVENTURE_REGION__!=='iberia')return;"],
  ['mallorca-mobile/adventure-0210/iberia-world-0250.js',"if(window.__WAFT_IBERIA_WORLD_0250_READY__||window.__WAFT_ADVENTURE_REGION__!=='iberia')return;"]
])patch(p,s=>{if(s.includes('window.__WAFT_EUROPE_ATLAS_0252_ACTIVE__'))return s.replaceAll('0.25.1','0.25.2');if(!s.includes(needle))throw new Error(`Atlas guard anchor missing in ${p}`);return s.replace(needle,needle.replace(')return;',"||window.__WAFT_EUROPE_ATLAS_0252_ACTIVE__)return;")).replaceAll('0.25.1','0.25.2');});
patch('mallorca-mobile/adventure-0210/iberia-world-0246.js',s=>{s=s.replaceAll('0.24.6','0.25.2');const old="for(let i=0;i<500&&(!window.WAFTRegionRuntime||!window.WAFTWorldStreaming0245);i++)await wait(40);",neu="for(let i=0;i<750&&(!window.WAFTRegionRuntime||!window.WAFTWorldStreaming0245||(window.__WAFT_EUROPE_ATLAS_0252_ACTIVE__&&!window.WAFTEuropeAtlas0252?.getState?.().ready));i++)await wait(40);";if(s.includes(old))s=s.replace(old,neu);return s.replace("for(const city of franceObjects.items||[])","for(const city of (window.__WAFT_EUROPE_ATLAS_0252_ACTIVE__?[]:(franceObjects.items||[])))");});
patch('mallorca-mobile/adventure-0210/index.html',s=>{
  s=s.replaceAll("window.__WAFT_ADVENTURE_BUILD__='0.25.1'","window.__WAFT_ADVENTURE_BUILD__='0.25.2'");
  const token='<script src="adventure-0210/iberia-world-0245.js';
  if(!s.includes('europe-atlas-0252.js')){if(!s.includes(token))throw new Error('Adventure bootstrap 0245 token missing');s=s.replace(token,'<script>window.__WAFT_EUROPE_ATLAS_0252_ACTIVE__=true;<\\/script>\\n<script src="adventure-0210/europe-atlas-0252.js?v=${encodeURIComponent(version)}"><\\/script>\\n'+token);}
  const marker='      document.open();document.write(source);document.close();';
  if(!s.includes('WAFT_ATLAS_CORE_SUPPRESSION_0252')){if(!s.includes(marker))throw new Error('Adventure document.write anchor missing');const core=`      if(regionId==='iberia'){
        // WAFT_ATLAS_CORE_SUPPRESSION_0252: the old Iberia renderer remains the boot engine only.
        source=source.replace("const currentAdventureBuildings=()=>state.worldMode==='local'?localAssets.preview?.buildings:streamer.active;","const currentAdventureBuildings=()=>state.worldMode==='local'?localAssets.preview?.buildings:(window.__WAFT_EUROPE_ATLAS_0252_ACTIVE__?[]:streamer.active);");
        source=source.replace('if (state.roads) { gl.useProgram(roadProgram);','if (state.roads&&!window.__WAFT_EUROPE_ATLAS_0252_ACTIVE__) { gl.useProgram(roadProgram);');
        source=source.replace('if (state.buildings) { gl.useProgram(buildingProgram);','if (state.buildings&&!window.__WAFT_EUROPE_ATLAS_0252_ACTIVE__) { gl.useProgram(buildingProgram);');
        source=source.replace('if (state.landmarks) { gl.useProgram(landmarkProgram);','if (state.landmarks&&!window.__WAFT_EUROPE_ATLAS_0252_ACTIVE__) { gl.useProgram(landmarkProgram);');
        source=source.replace('if (state.settlements) { gl.useProgram(settlementProgram);','if (state.settlements&&!window.__WAFT_EUROPE_ATLAS_0252_ACTIVE__) { gl.useProgram(settlementProgram);');
      }
`;s=s.replace(marker,core+marker);}
  return s;
});
patch('.github/workflows/build-world-0250.yml',s=>s.replace('      - feat/world-0251-global-compression\n      - main','      - feat/world-0251-global-compression'));
console.log(JSON.stringify({valid:true,version:VERSION,unitsPerKm:SCALE,verticalScale:VERTICAL,bounds:BOUNDS,grid:GRID,triangles:(GRID.columns-1)*(GRID.rows-1)*2,countries:COUNTRIES.length},null,2));
