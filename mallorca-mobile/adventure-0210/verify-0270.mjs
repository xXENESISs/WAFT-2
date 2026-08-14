import fs from 'node:fs';

const need=(condition,message)=>{if(!condition)throw new Error(message);};
const index=fs.readFileSync('mallorca-mobile/adventure-0210/index.html','utf8');
const runtime=fs.readFileSync('mallorca-mobile/adventure-0210/planet-world-0270.js','utf8');
const core=fs.readFileSync('mallorca-mobile/adventure-0210/planet-0270/cube-sphere-core.mjs','utf8');
const prepare=fs.readFileSync('world-generator/scripts/prepare-world-0261.mjs','utf8');
const validateWorkflow=fs.readFileSync('.github/workflows/validate-waft-regions.yml','utf8');
const buildRegionsWorkflow=fs.readFileSync('.github/workflows/build-waft-regions.yml','utf8');

need(index.includes("params.get('renderer')==='0270'"),'0.27.0 experimental flag is missing');
need(index.includes("experimentalPlanet?'adventure-0210/planet-world-0270.js':'adventure-0210/spherical-world-0261.js'"),'0.26.1 is not preserved as the default renderer');
need(index.includes("window.__WAFT_ADVENTURE_BUILD__='0.27.0-experimental'"),'experimental build identity is missing');
need(index.includes('planetOrbitBlend')&&index.includes('-2102.432904*planetOrbitBlend'),'orbital camera transition is missing');
need(runtime.includes("renderMode:'cube-sphere-quadtree'"),'cube-sphere runtime identity is missing');
need(runtime.includes('TILE_RESOLUTION=17')&&runtime.includes('MAX_LEVEL=8')&&runtime.includes('TARGET_ERROR_PIXELS=28'),'tile geometry or LOD budget contract is missing');
need(runtime.includes('cache:new Map()')&&runtime.includes('nearestReadyAncestor'),'persistent tile cache or parent fallback is missing');
need(runtime.includes('state.prefetchLead')&&runtime.includes('predicted=destination'),'directional tile prefetch is missing');
need(runtime.includes("SAVE_KEY='waft.adventure.0210.planet-location.v1'")&&runtime.includes('saveGeographicPosition'),'geographic save contract is missing');
need(runtime.includes('uOrigin')&&runtime.includes('tangentFrame(state.originGeo.lat,state.originGeo.lon)'),'ECEF-to-local tangent transform is missing');
need(runtime.includes('recenterAtCurrentPosition:()=>maybeRecenter(true)'),'floating-origin identity test hook is missing');
need(runtime.includes('surfaceHash')&&runtime.includes('terrainFingerprint')&&runtime.includes('anchorTileSnapshot'),'terrain topology fingerprint is missing');
need(!runtime.includes('age<2600'),'time-based terrain rebuild leaked into 0.27.0');
need(!runtime.includes('lastBuildHeading'),'heading-based terrain rebuild leaked into 0.27.0');
need(core.includes("FACE_NAMES = Object.freeze(['px', 'nx', 'py', 'ny', 'pz', 'nz'])"),'six cube faces are missing');
need(core.includes('selectVisibleTiles')&&core.includes('projectedError'),'screen-space LOD selection is missing');
need(prepare.includes("const experimentalPlanet=params.get('renderer')==='0270';")&&prepare.includes("const worldRuntime=experimentalPlanet?"),'0.26.1 prepare would erase the experimental renderer');
need(/push:\n\s+branches:\n\s+- main\n\s+paths:/.test(validateWorkflow),'region validation can still write main from a feature branch');
need(/push:\n\s+branches:\n\s+- main\n\s+paths:/.test(buildRegionsWorkflow),'region build can still write main from a feature branch');

console.log(JSON.stringify({
  valid:true,
  version:'0.27.0-experimental',
  defaultRenderer:'0.26.1',
  experimentalRenderer:'cube-sphere-quadtree',
  planetFixedTiles:true,
  geographicSave:true,
  timedRebuild:false,
  headingRebuild:false
},null,2));
