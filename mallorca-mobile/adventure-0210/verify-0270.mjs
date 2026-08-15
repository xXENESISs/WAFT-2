import crypto from 'node:crypto';
import fs from 'node:fs';

const need=(condition,message)=>{if(!condition)throw new Error(message);};
const index=fs.readFileSync('mallorca-mobile/adventure-0210/index.html','utf8');
const runtime=fs.readFileSync('mallorca-mobile/adventure-0210/planet-world-0270.js','utf8');
const gameplay=fs.readFileSync('mallorca-mobile/adventure-0210/gameplay-plugin.js','utf8');
const iberiaExplorer=fs.readFileSync('mallorca-mobile/adventure-0210/iberia-explorer-0242.js','utf8');
const iberiaWorld=fs.readFileSync('mallorca-mobile/adventure-0210/iberia-world-0246.js','utf8');
const pluginLoader=fs.readFileSync('mallorca-mobile/adventure-0210/plugin-loader.js','utf8');
const core=fs.readFileSync('mallorca-mobile/adventure-0210/planet-0270/cube-sphere-core.mjs','utf8');
const prepare=fs.readFileSync('world-generator/scripts/prepare-world-0261.mjs','utf8');
const validateWorkflow=fs.readFileSync('.github/workflows/validate-waft-regions.yml','utf8');
const buildRegionsWorkflow=fs.readFileSync('.github/workflows/build-waft-regions.yml','utf8');
const landMask=fs.readFileSync('mallorca-mobile/adventure-0210/planet-0270/land-50m.bin');
const landMetadata=JSON.parse(fs.readFileSync('mallorca-mobile/adventure-0210/planet-0270/land-50m.meta.json','utf8'));

need(index.includes("const smoothPlanet=requestedRenderer==='0274';")&&index.includes("const experimentalPlanet=requestedRenderer==='0270'||smoothPlanet;"),'0.27.3/0.27.4 renderer flags are missing');
need(index.includes("experimentalPlanet?'adventure-0210/planet-world-0270.js':'adventure-0210/spherical-world-0261.js'"),'0.26.1 is not preserved as the default renderer');
need(index.includes("smoothPlanet?\"window.__WAFT_ADVENTURE_BUILD__='0.27.4-experimental'\":\"window.__WAFT_ADVENTURE_BUILD__='0.27.3-experimental'\""),'versioned experimental build identities are missing');
need(index.includes("perspective(projection,Math.PI/3,canvas.width/canvas.height,.06,state.worldMode==='local'?2400:12000);"),'stable high-altitude camera projection is missing');
need(index.includes("if(window.__WAFT_PLANET_WORLD_0270_ACTIVE__&&state.adventureFlight){state.cameraBlocked=false;return desired;}"),'planet flight still performs the regional camera collision ray march');
need(index.includes('const waftPlanetFrameState=')&&index.includes('getPlanetFrameState()'),'allocation-free planet frame state is missing');
need(!index.includes('source=source.replace("const center=[target[0],target[1]+.18+lookUpLift,target[2]];"'),'automatic planet-centre camera override is still active');
need(index.includes('boosted?348:312')&&index.includes('inputLength>.93?276:inputLength>.70?228:180'),'experimental vulture speed is not exactly 3x');
need(index.includes('cameraYaw: state.yaw, cameraPitch: state.pitch, playerFacing:'),'camera pitch telemetry is missing');
need(index.includes("if(!window.__WAFT_PLANET_WORLD_0270_ACTIVE__)hudStats.textContent"),'regional HUD can still overwrite the planet telemetry');
need(index.includes("if(!window.__WAFT_PLANET_WORLD_0270_ACTIVE__)streamer.update"),'regional building streaming still runs during planetary flight');
need(index.includes("if(!window.__WAFT_PLANET_WORLD_0270_ACTIVE__)recordTravelMovement"),'regional travel trail still mutates during planetary flight');
need(index.includes("if (!window.__WAFT_PLANET_WORLD_0270_ACTIVE__ && state.worldMode === 'regional' && travelRouteVertexCount > 0)")&&index.includes("if (!window.__WAFT_PLANET_WORLD_0270_ACTIVE__ && state.worldMode === 'regional' && travelTrailVertexCount > 1)"),'regional gold route geometry still draws during planetary flight');
need(index.includes("if(window.__WAFT_PLANET_WORLD_0270_ACTIVE__&&state.adventureFlight){state.camera.x+=dx;state.camera.z+=dz;return{moved:Math.hypot(dx,dz),waterSteps:0,landSteps:0};}"),'planetary flight still ray-marches regional movement collisions');
need(['roads','buildings','landmarks','settlements'].every(layer=>index.includes(`state.${layer}&&!window.__WAFT_EUROPE_ATLAS_0252_ACTIVE__&&!window.__WAFT_GLOBAL_ATLAS_0260_ACTIVE__`)),'regional GPU layers still render behind the planet');
need(index.includes("!window.__WAFT_PLANET_WORLD_0270_ACTIVE__ && nearestClock > .45")&&index.includes("!window.__WAFT_PLANET_WORLD_0270_ACTIVE__ && state.worldMode === 'regional') runtimeControls.refreshLocalProximity"),'regional proximity and panel work still creates periodic planet spikes');
need(index.includes("waftGpuExt=gl.getExtension('WEBGL_debug_renderer_info')")&&index.includes("/SwiftShader/i.test(String(waftGpuName))?.25:.45")&&index.includes('__WAFT_RENDER_SCALE_0274__=dpr'),'0.27.4 bounded hardware/software render scale is missing');
need(index.includes("'iberia-polish-0243','iberia-world-0244','europe-atlas-0252','iberia-world-0245','iberia-world-0247','iberia-world-0249','iberia-world-0250'")&&index.includes('application/x-waft-disabled'),'0.27.4 still boots legacy terrain and label timers');
need(index.includes("canvas.getContext('webgl2',{antialias:false,alpha:false,powerPreference:'high-performance'})"),'0.27.4 still spends the frame budget on multisample antialiasing');
need(index.includes('window.WAFTPlanetWorld0270?.beforeCameraFrame?.(now);'),'0.27.4 still rebases after calculating the camera');
need(index.includes('rebasePlanetFrame(x,z,y,playerFacing,cameraYaw)'),'0.27.4 cannot preserve independent bird and camera headings during a rebase');
need(index.includes('setCameraOrbit(yaw,pitch=null)'),'0.27.4 camera performance harness cannot rotate without pointer-driver overhead');
need(runtime.includes("renderMode:'cube-sphere-quadtree'"),'cube-sphere runtime identity is missing');
need(runtime.includes('TILE_RESOLUTION=17')&&runtime.includes('MIN_LEVEL=3')&&runtime.includes('MAX_LEVEL=6')&&runtime.includes('STATIC_REFINEMENT_ZONES=Object.freeze'),'fixed planet geometry contract is missing');
need(runtime.includes('STATIC_TILE_LIMIT=720')&&runtime.includes('STATIC_BOOT_BATCH=8'),'static planet memory or boot budget is missing');
need(runtime.includes('cache:new Map()')&&runtime.includes('buildStaticPlanet')&&runtime.includes('selectFixedQuadtreeTiles'),'immutable geographic quadtree is missing');
need(runtime.includes("smoothPlanet?'fixed-full-planet-v4':'fixed-geographic-quadtree-v3'")&&runtime.includes('tileBuildsDuringGameplay'),'fixed gameplay geometry telemetry is missing');
need(!runtime.includes('processBuildQueue')&&!runtime.includes('nearestReadyAncestor')&&!runtime.includes('evictCache'),'flight-time tile churn is still active');
need(runtime.includes('LAND_EDGE_BIN_DEGREES=.25')&&runtime.includes('edgeBins.get(bin)'),'coastline point tests are still linear in polygon size');
need(runtime.includes('batchCache:new Map()')&&runtime.includes('uploadBatchMesh')&&runtime.includes('renderBatchKeys'),'static planet tiles are not geographically batched');
need(runtime.includes("const batchKey=smoothPlanet?'planet/full'")&&runtime.includes('const visible=smoothPlanet?state.staticTiles:selectionFor'),'0.27.4 can still swap physical terrain while moving');
need(runtime.includes('tile.level>=6?9:tile.level===5?7:tile.level===4?5:3'),'0.27.4 tiered static geometry budget is missing');
need(runtime.includes('precision mediump float;in vec3 vC;out vec4 o;')&&runtime.includes('void main(){o=vec4(vC,1.0);}`'),'0.27.4 still performs per-fragment planet lighting and fog');
need(runtime.includes('RECENTER_DISTANCE=smoothPlanet?8:240')&&runtime.includes('function beforeCameraFrame(now)'),'0.27.4 bounded pre-camera tangent rebase is missing');
need(runtime.includes('nextHeading=reprojectAngle(heading),nextCameraYaw=reprojectAngle(cameraYaw)')&&runtime.includes('api.rebasePlanetFrame(0,0,position.y,nextHeading,nextCameraYaw)'),'0.27.4 rebase still resets the camera behind the bird');
need(runtime.includes('cameraFrameMismatches')&&runtime.includes('if(!smoothPlanet){updateSpeed(now);maybeRecenter();updateSelection(now);}'),'camera/rebase ordering telemetry is missing');
need(runtime.includes('gl.enable(gl.CULL_FACE);gl.cullFace(gl.FRONT)'),'planet must restore its inverse cube-sphere winding after the shared character renderer');
need(!runtime.includes('floatingOriginShifts++;saveGeographicPosition()')&&runtime.includes('setInterval(saveGeographicPosition,30000)'),'synchronous saves still run during floating-origin flight');
need(runtime.includes("SAVE_KEY='waft.adventure.0210.planet-location.v1'")&&runtime.includes('saveGeographicPosition'),'geographic save contract is missing');
need(runtime.includes('uOrigin')&&runtime.includes('tangentFrame(state.originGeo.lat,state.originGeo.lon)'),'ECEF-to-local tangent transform is missing');
need(runtime.includes('recenterAtCurrentPosition:()=>maybeRecenter(true)'),'floating-origin identity test hook is missing');
need(runtime.includes('rebaseRegionalEntities')&&runtime.includes('localFromGeoAt'),'regional entities are not preserved across floating-origin shifts');
need(gameplay.includes('planetEntityInRange')&&gameplay.includes('regionalEntitiesDrawn'),'distant regional entity culling is missing');
need(gameplay.includes('sharedWorldContext')&&gameplay.includes("overlayCanvas.style.display='none'"),'planet still creates a second full-screen WebGL renderer');
need(gameplay.includes('const matrixPool=[]')&&gameplay.includes('M.reset()'),'mounted character matrices still allocate every frame');
need(gameplay.includes('this.smoothPlanet=Boolean(window.__WAFT_PLANET_WORLD_0274_ACTIVE__)')&&gameplay.includes('precision mediump float;in vec3 vColor')&&gameplay.includes('if(this.smoothPlanet)gl.disable(gl.BLEND)'),'0.27.4 mounted character still uses the expensive overlay shader and blending');
need(gameplay.includes('setupDynamicCharacter')&&gameplay.includes('queueInstance')&&gameplay.includes('flushDynamicCharacter')&&gameplay.includes('gl.drawArrays(gl.TRIANGLES,0,cursor/6)'),'0.27.4 mounted character parts are still separate GPU draws');
need(gameplay.includes("compactVulture=this.smoothPlanet&&mounted.type==='vulture'")&&gameplay.includes('renderScale:compactVulture?.75:1'),'0.27.4 mounted vulture still obscures an excessive fraction of the terrain');
need(iberiaExplorer.includes('if(window.__WAFT_PLANET_WORLD_0274_ACTIVE__)')&&iberiaExplorer.includes('side*1.82'),'0.27.4 does not use the bounded-part bearded-vulture silhouette');
need(iberiaExplorer.includes("version:'0.27.4-light'")&&iberiaWorld.includes("version:'0.27.4-light'"),'0.27.4 still starts the legacy Iberia polling layers');
need(gameplay.includes('function frameRuntimeState(api)')&&runtime.includes('const runtimeState=()=>api.getPlanetFrameState'),'planet hot paths still request full regional state snapshots');
need(gameplay.includes('    const state = api?.getState?.();')&&pluginLoader.includes('    `    const state=frameRuntimeState(api);'),'plugin loader cannot apply the allocation-free frame state without breaking Adventure startup');
need(gameplay.indexOf('function planetEntityInRange')>gameplay.indexOf('function updateAnimals')&&gameplay.indexOf('function planetEntityInRange')<gameplay.indexOf('function updateInteraction'),'the plugin loader would erase the planet entity culling helper');
need(runtime.includes('surfaceHash')&&runtime.includes('terrainFingerprint')&&runtime.includes('anchorTileSnapshot'),'terrain topology fingerprint is missing');
need(runtime.includes('parseLandMask')&&runtime.includes('vectorLand')&&runtime.includes("coastlineScale:'50m'"),'vector coastline runtime is missing');
need(landMask.subarray(0,8).toString()==='WAFTLND1'&&landMask.readUInt32LE(12)===1421&&landMask.readUInt32LE(20)===60669,'50m land-mask header is invalid');
need(landMetadata.schema==='waft-land-polygons-v1'&&landMetadata.source?.blob==='c412c52b5286ba727dcb7047ecd6080bcbeb8298','50m land-mask provenance is missing');
need(crypto.createHash('sha256').update(landMask).digest('hex')===landMetadata.sha256,'50m land-mask checksum does not match metadata');
need(!runtime.includes('age<2600'),'time-based terrain rebuild leaked into 0.27.3');
need(!runtime.includes('lastBuildHeading'),'heading-based terrain rebuild leaked into 0.27.3');
need(core.includes("FACE_NAMES = Object.freeze(['px', 'nx', 'py', 'ny', 'pz', 'nz'])"),'six cube faces are missing');
need(core.includes('selectFixedQuadtreeTiles')&&core.includes('targetLevel'),'fixed geographic quadtree selection is missing');
need(prepare.includes("const smoothPlanet=requestedRenderer==='0274';")&&prepare.includes("const worldRuntime=experimentalPlanet?")&&prepare.includes('smoothPreparedInject'),'0.26.1 prepare would erase the versioned experimental renderer');
need(/push:\n\s+branches:\n\s+- main\n\s+paths:/.test(validateWorkflow),'region validation can still write main from a feature branch');
need(/push:\n\s+branches:\n\s+- main\n\s+paths:/.test(buildRegionsWorkflow),'region build can still write main from a feature branch');

console.log(JSON.stringify({
  valid:true,
  version:'0.27.4-experimental',
  previousExperimentalRenderer:'0.27.3-preserved',
  defaultRenderer:'0.26.1',
  experimentalRenderer:'cube-sphere-quadtree',
  planetFixedTiles:true,
  geographicSave:true,
  timedRebuild:false,
  headingRebuild:false,
  stableGeographicLod:true,
  coastlineEdgeBins:true,
  geographicGpuBatches:true,
  sharedWebglContext:true,
  pooledCharacterMatrices:true,
  reusableFrameState:true,
  baseRegionalLayersSuppressed:true,
  gameplayTileBuilds:0,
  gameplayTileEvictions:0,
  vultureSpeedMultiplier:3,
  staticTileLimit:720
},null,2));
