import crypto from 'node:crypto';
import fs from 'node:fs';

const need=(condition,message)=>{if(!condition)throw new Error(message);};
const index=fs.readFileSync('mallorca-mobile/adventure-0210/index.html','utf8');
const runtime=fs.readFileSync('mallorca-mobile/adventure-0210/planet-world-0270.js','utf8');
const gameplay=fs.readFileSync('mallorca-mobile/adventure-0210/gameplay-plugin.js','utf8');
const core=fs.readFileSync('mallorca-mobile/adventure-0210/planet-0270/cube-sphere-core.mjs','utf8');
const prepare=fs.readFileSync('world-generator/scripts/prepare-world-0261.mjs','utf8');
const validateWorkflow=fs.readFileSync('.github/workflows/validate-waft-regions.yml','utf8');
const buildRegionsWorkflow=fs.readFileSync('.github/workflows/build-waft-regions.yml','utf8');
const landMask=fs.readFileSync('mallorca-mobile/adventure-0210/planet-0270/land-50m.bin');
const landMetadata=JSON.parse(fs.readFileSync('mallorca-mobile/adventure-0210/planet-0270/land-50m.meta.json','utf8'));

need(index.includes("params.get('renderer')==='0270'"),'0.27.2 experimental flag is missing');
need(index.includes("experimentalPlanet?'adventure-0210/planet-world-0270.js':'adventure-0210/spherical-world-0261.js'"),'0.26.1 is not preserved as the default renderer');
need(index.includes("window.__WAFT_ADVENTURE_BUILD__='0.27.2-experimental'"),'experimental build identity is missing');
need(index.includes("perspective(projection,Math.PI/3,canvas.width/canvas.height,.06,state.worldMode==='local'?2400:12000);"),'stable high-altitude camera projection is missing');
need(!index.includes('source=source.replace("const center=[target[0],target[1]+.18+lookUpLift,target[2]];"'),'automatic planet-centre camera override is still active');
need(index.includes('boosted?348:312')&&index.includes('inputLength>.93?276:inputLength>.70?228:180'),'experimental vulture speed is not exactly 3x');
need(index.includes('cameraYaw: state.yaw, cameraPitch: state.pitch, playerFacing:'),'camera pitch telemetry is missing');
need(index.includes("if(!window.__WAFT_PLANET_WORLD_0270_ACTIVE__)hudStats.textContent"),'regional HUD can still overwrite the planet telemetry');
need(index.includes("if(!window.__WAFT_PLANET_WORLD_0270_ACTIVE__)streamer.update"),'regional building streaming still runs during planetary flight');
need(runtime.includes("renderMode:'cube-sphere-quadtree'"),'cube-sphere runtime identity is missing');
need(runtime.includes('TILE_RESOLUTION=17')&&runtime.includes('MIN_LEVEL=3')&&runtime.includes('MAX_LEVEL=6')&&runtime.includes('STATIC_REFINEMENT_ZONES=Object.freeze'),'fixed planet geometry contract is missing');
need(runtime.includes('STATIC_TILE_LIMIT=720')&&runtime.includes('STATIC_BOOT_BATCH=8'),'static planet memory or boot budget is missing');
need(runtime.includes('cache:new Map()')&&runtime.includes('buildStaticPlanet')&&runtime.includes('selectFixedQuadtreeTiles'),'immutable geographic quadtree is missing');
need(runtime.includes("selectionProfile:'fixed-geographic-quadtree-v2'")&&runtime.includes('tileBuildsDuringGameplay'),'fixed gameplay geometry telemetry is missing');
need(!runtime.includes('processBuildQueue')&&!runtime.includes('nearestReadyAncestor')&&!runtime.includes('evictCache'),'flight-time tile churn is still active');
need(runtime.includes("SAVE_KEY='waft.adventure.0210.planet-location.v1'")&&runtime.includes('saveGeographicPosition'),'geographic save contract is missing');
need(runtime.includes('uOrigin')&&runtime.includes('tangentFrame(state.originGeo.lat,state.originGeo.lon)'),'ECEF-to-local tangent transform is missing');
need(runtime.includes('recenterAtCurrentPosition:()=>maybeRecenter(true)'),'floating-origin identity test hook is missing');
need(runtime.includes('rebaseRegionalEntities')&&runtime.includes('localFromGeoAt'),'regional entities are not preserved across floating-origin shifts');
need(gameplay.includes('planetEntityInRange')&&gameplay.includes('regionalEntitiesDrawn'),'distant regional entity culling is missing');
need(runtime.includes('surfaceHash')&&runtime.includes('terrainFingerprint')&&runtime.includes('anchorTileSnapshot'),'terrain topology fingerprint is missing');
need(runtime.includes('parseLandMask')&&runtime.includes('vectorLand')&&runtime.includes("coastlineScale:'50m'"),'vector coastline runtime is missing');
need(landMask.subarray(0,8).toString()==='WAFTLND1'&&landMask.readUInt32LE(12)===1421&&landMask.readUInt32LE(20)===60669,'50m land-mask header is invalid');
need(landMetadata.schema==='waft-land-polygons-v1'&&landMetadata.source?.blob==='c412c52b5286ba727dcb7047ecd6080bcbeb8298','50m land-mask provenance is missing');
need(crypto.createHash('sha256').update(landMask).digest('hex')===landMetadata.sha256,'50m land-mask checksum does not match metadata');
need(!runtime.includes('age<2600'),'time-based terrain rebuild leaked into 0.27.2');
need(!runtime.includes('lastBuildHeading'),'heading-based terrain rebuild leaked into 0.27.2');
need(core.includes("FACE_NAMES = Object.freeze(['px', 'nx', 'py', 'ny', 'pz', 'nz'])"),'six cube faces are missing');
need(core.includes('selectFixedQuadtreeTiles')&&core.includes('targetLevel'),'fixed geographic quadtree selection is missing');
need(prepare.includes("const experimentalPlanet=params.get('renderer')==='0270';")&&prepare.includes("const worldRuntime=experimentalPlanet?"),'0.26.1 prepare would erase the experimental renderer');
need(/push:\n\s+branches:\n\s+- main\n\s+paths:/.test(validateWorkflow),'region validation can still write main from a feature branch');
need(/push:\n\s+branches:\n\s+- main\n\s+paths:/.test(buildRegionsWorkflow),'region build can still write main from a feature branch');

console.log(JSON.stringify({
  valid:true,
  version:'0.27.2-experimental',
  defaultRenderer:'0.26.1',
  experimentalRenderer:'cube-sphere-quadtree',
  planetFixedTiles:true,
  geographicSave:true,
  timedRebuild:false,
  headingRebuild:false,
  stableGeographicLod:true,
  gameplayTileBuilds:0,
  gameplayTileEvictions:0,
  vultureSpeedMultiplier:3,
  staticTileLimit:720
},null,2));
