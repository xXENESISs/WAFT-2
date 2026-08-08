import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const here=path.dirname(new URL(import.meta.url).pathname);
const adventure=path.resolve(here,'..');
const source=fs.readFileSync(path.join(adventure,'ecology-0239.js'),'utf8');

for(const pattern of [
  /const BUILD='0\.23\.9'/,
  /mallorca-tramuntana/,
  /cabrera:\{name:'Arxipèlag de Cabrera'/,
  /Alytes muletensis/,
  /Podarcis lilfordi/,
  /Podarcis pityusensis/,
  /Bos taurus · raça menorquina/,
  /collserola:\{name:'Collserola'/,
  /Sus scrofa','Sciurus vulgaris','Genetta genetta/,
  /barcelona-urbana/,
  /Falco peregrinus/,
  /montserrat/,
  /montseny/,
  /costa-daurada/,
  /sargantana-cabrera/,
  /lat:39\.145,lon:2\.940/,
  /pig-cat.*zone:'collserola'/,
  /salamander-cat.*zone:'montseny'/,
  /vulture-cat.*zone:'montserrat'/,
  /ecology=\{zoneId:spec\.zone,habitat:spec\.habitat,status:spec\.status\}/,
  /__WAFT_ECOLOGY_0239_READY__=true/
]) assert.match(source,pattern,`ecology layer missing ${pattern}`);

const topologyPath=path.resolve(adventure,'../../world-generator/configs/spain-region-topology.v1.json');
const topology=JSON.parse(fs.readFileSync(topologyPath,'utf8'));
assert.equal(topology.rules.ecologyIndependentFromTechnicalRegion,true);
assert.equal(topology.rules.transitionCorridorsPreferNaturalGeography,true);
const catalunya=topology.regions.find(region=>region.id==='catalunya-litoral');
assert.ok(catalunya,'Catalunya topology missing');
assert.equal(catalunya.transitionCorridors.north,'pirineus-orientals');
assert.equal(catalunya.transitionCorridors.south,'levante');
assert.equal(catalunya.transitionCorridors.west,'ebro-interior');
for(const id of ['baleares','pirineus','ebro-interior','levante','cantabrico-galicia','meseta-norte','centro-meseta','andalucia-sureste','canarias'])assert.ok(topology.regions.some(region=>region.id===id),`missing topology region ${id}`);

console.log('WAFT 0.23.9 ecology separates technical regions from ecological zones and places current fauna by real geographic habitat anchors.');
