import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');

function patch(relative,changes,marker){
  const file=path.join(ROOT,relative);
  let source=fs.readFileSync(file,'utf8');
  if(marker&&source.includes(marker)){console.log(`${relative}: already prepared`);return;}
  for(const [search,replacement,label] of changes){
    const count=source.split(search).length-1;
    if(count!==1)throw new Error(`${relative}: expected one ${label}, found ${count}`);
    source=source.replace(search,replacement);
  }
  fs.writeFileSync(file,source);
  console.log(`${relative}: patched`);
}

function patchLast(relative,search,replacement,label,marker){
  const file=path.join(ROOT,relative);
  let source=fs.readFileSync(file,'utf8');
  if(marker&&source.includes(marker)){console.log(`${relative}: already prepared`);return;}
  const index=source.lastIndexOf(search);
  if(index<0)throw new Error(`${relative}: missing ${label}`);
  source=source.slice(0,index)+replacement+source.slice(index+search.length);
  fs.writeFileSync(file,source);
  console.log(`${relative}: patched last ${label}`);
}

patch('world-generator/scripts/build-region-preview.mjs',[
  ["  assert(manifest.generationStage === 'wikidata-ranked-landmarks', `Preview requires Wikidata stage, got ${manifest.generationStage}`);",
   "  assert(['wikidata-ranked-landmarks','dem-worldcover-bootstrap'].includes(manifest.generationStage), `Preview requires terrain bootstrap or Wikidata stage, got ${manifest.generationStage}`);",
   'terrain-only preview stage'],
  ["      verticalScale: .03",
   "      verticalScale: Number((.03 * ((manifest.projection.unitsPerKm ?? 3.2) / 3.2)).toFixed(6))",
   'scale-aware terrain height']
],"dem-worldcover-bootstrap'].includes(manifest.generationStage)");

patchLast(
  'world-generator/scripts/build-region-preview-v2.mjs',
  "    { id: 'overview', name: 'Tot', x: 0, z: 0, terrainMeters: 0, altitude: 310, distance: 0 },",
  "    { id: 'overview', name: 'Tot', x: 0, z: 0, terrainMeters: 0, altitude: regionId === 'iberia' ? 980 : 310, distance: 0 },",
  'Iberia overview altitude',
  "regionId === 'iberia' ? 980 : 310"
);

patch('mallorca-mobile/adventure-0210/index.html',[
  ["    const regionId = params.get('region') === 'catalunya-litoral' ? 'catalunya-litoral' : 'baleares';",
   "    const requestedRegion=params.get('region');\n    const regionId=requestedRegion==='iberia'?'iberia':requestedRegion==='catalunya-litoral'?'catalunya-litoral':'baleares';",
   'Iberia region selection'],
  ["    const builds = { baleares:'../region-runtime-baleares-013.html', 'catalunya-litoral':'../region-runtime-catalunya-litoral-003.html' };",
   "    const builds={baleares:'../region-runtime-baleares-013.html','catalunya-litoral':'../region-runtime-catalunya-litoral-003.html',iberia:'../region-runtime-catalunya-litoral-003.html'};",
   'Iberia runtime reuse'],
  ["      let source = await response.text();",
   `      let source = await response.text();
      if(regionId==='iberia'){
        // Reuse the proven mainland runtime engine with the new data-driven Iberia package.
        source=source.replaceAll('catalunya-litoral','iberia').replaceAll('CATALUNYA LITORAL','PENÍNSULA IBÉRICA').replaceAll('Catalunya litoral','Península Ibérica');
        source=source.replace("fetchJson(\`\${localBase}zones-v1.json\`)","Promise.resolve({registryType:'waft-local-zone-registry',regionId:'iberia',zones:[]})");
        source=source.replace("if (!Array.isArray(localRegistry.zones) || localRegistry.zones.length < 1) throw new Error('El registro local no contiene destinos.');","if (!Array.isArray(localRegistry.zones)) throw new Error('El registro local no es válido.');");
      }`,
   'Iberia runtime data adaptation'],
  ["window.__WAFT_ADVENTURE_BUILD__='0.23.3';","window.__WAFT_ADVENTURE_BUILD__='0.24.0';",
   'Adventure build marker']
],"requestedRegion==='iberia'");

patch('mallorca-mobile/adventure-0210/index.html',[
  ["        source=source.replace(\"if (!Array.isArray(localRegistry.zones) || localRegistry.zones.length < 1) throw new Error('El registro local no contiene destinos.');\",\"if (!Array.isArray(localRegistry.zones)) throw new Error('El registro local no es válido.');\");",
   "        source=source.replace(\"if (!Array.isArray(localRegistry.zones) || localRegistry.zones.length < 1) throw new Error('El registro local no contiene destinos.');\",\"if (!Array.isArray(localRegistry.zones)) throw new Error('El registro local no es válido.');\");\n        source=source.replace(\"    const travelNodeIds = ['barcelona','tarragona','girona','subregion-montserrat','subregion-montseny','subregion-maresme'];\",\"    const travelNodeIds = [];\"); // WAFT_IBERIA_RUNTIME_0241",
   'disable Catalunya travel nodes in Iberia terrain runtime']
],"WAFT_IBERIA_RUNTIME_0241");

patch('mallorca-mobile/adventure-0210/plugin-loader.js',[
  ["  (0,eval)(source+'\\n//# sourceURL=waft-adventure-0233-gameplay.js');",
   `  const terrainOnly=window.__WAFT_ADVENTURE_REGION__==='iberia';
  if(terrainOnly){
    replaceOne("  const REGION_NAMES = { baleares: 'Baleares', 'catalunya-litoral': 'Catalunya litoral' };","  const REGION_NAMES = { baleares: 'Baleares', 'catalunya-litoral': 'Catalunya litoral', iberia: 'Península Ibérica' };",'nombre Iberia');
    replaceOne("  const SAVE_KEY = 'waft.adventure.integration.0210.v1';","  const SAVE_KEY = REGION_ID === 'iberia' ? 'waft.adventure.integration.0240.iberia' : 'waft.adventure.integration.0210.v1';",'guardado Iberia');
    replaceOne("  function missionObjective() {\\n    if (REGION_ID !== 'baleares') return 'Explora Catalunya y descubre su fauna antes de regresar al puerto.';","  function missionObjective() {\\n    if (REGION_ID === 'iberia') return 'Prueba de escala peninsular · solo terreno y relieve.';\\n    if (REGION_ID !== 'baleares') return 'Explora Catalunya y descubre su fauna antes de regresar al puerto.';",'objetivo terreno Iberia');
    replaceOne("    progress.textContent = REGION_NAMES[REGION_ID] + ' · fauna ' + observedCount + '/' + game.animals.length + ' · guardados ' + game.saveCount;","    progress.textContent = REGION_ID === 'iberia' ? 'Península Ibérica · TERRENO 0.24.0 · guardados ' + game.saveCount : REGION_NAMES[REGION_ID] + ' · fauna ' + observedCount + '/' + game.animals.length + ' · guardados ' + game.saveCount;",'HUD terreno Iberia');
    replaceOne("  function buildAdventurePopulation(api) {","  function buildAdventurePopulation(api) {\\n    if (REGION_ID === 'iberia') { game.npc=null; game.animals=[]; updateObjective(); return; }",'población vacía Iberia');
  }
  (0,eval)(source+'\\n//# sourceURL=waft-adventure-0233-gameplay.js');
  if(terrainOnly){window.__WAFT_IBERIA_TERRAIN_0240_READY__=true;const destinations=document.getElementById('waftDestinations');if(destinations){destinations.classList.remove('waft-hide-narrow');if(innerWidth<900)destinations.textContent='MAPA';}return;}`,
   'terrain-only Adventure branch']
],"__WAFT_IBERIA_TERRAIN_0240_READY__");

console.log('WAFT 0.24.1 Iberia runtime preparation complete.');