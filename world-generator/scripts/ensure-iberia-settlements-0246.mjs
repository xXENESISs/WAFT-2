import fs from 'node:fs';

const settlementsPath='regions/iberia/settlements.json';
const objectsPath='regions/iberia/objects.json';
const terrainPath='regions/iberia/terrain.bin';
const data=JSON.parse(fs.readFileSync(settlementsPath,'utf8'));
const items=Array.isArray(data.items)?data.items:[];
const name='Sant Just Desvern',lat=41.3817,lon=2.0751,population=21000;
let sant=items.find(x=>x.name===name);
if(!sant){
  const buf=fs.readFileSync(terrainPath);
  const headerBytes=buf.readUInt16LE(10),cols=buf.readUInt16LE(12),rows=buf.readUInt16LE(14);
  const west=buf.readDoubleLE(16),east=buf.readDoubleLE(24),south=buf.readDoubleLE(32),north=buf.readDoubleLE(40),nodata=buf.readInt32LE(56);
  const col=Math.max(0,Math.min(cols-1,Math.round((lon-west)/(east-west)*(cols-1))));
  const row=Math.max(0,Math.min(rows-1,Math.round((north-lat)/(north-south)*(rows-1))));
  let elevation=buf.readInt16LE(headerBytes+(row*cols+col)*2);if(elevation===nodata)elevation=90;
  const U=1.45,lat0=39.775,lon0=-3.125,kmLat=111.132,kmLon=85.55640544079021;
  const x=(lon-lon0)*kmLon*U,z=-(lat-lat0)*kmLat*U,deaths=Math.round(population*.55);
  sant={capitalLevel:null,countryCode:'ES',id:'es-manual-sant-just-desvern',local:{x:+x.toFixed(4),y:elevation,z:+z.toFixed(4)},name,place:'PPLA3',population,populationTier:'small',position:{lat,lon},priority:48,protected:true,sectorId:'manual-0246',source:'manual-0246',sourceId:'manual-sant-just-desvern',terrainStatus:'dem-cell',warImpact:{fictional:true,nuclearWarDeaths:deaths,rate:.55,scenario:'WAFT-nuclear-war',survivorsImmediatelyAfter:population-deaths}};
  items.push(sant);items.sort((a,b)=>String(a.name).localeCompare(String(b.name),'es'));data.items=items;data.generationStage='population-war-lore-markers-0246';fs.writeFileSync(settlementsPath,JSON.stringify(data,null,2)+'\n');
}

const objects=JSON.parse(fs.readFileSync(objectsPath,'utf8'));objects.items=Array.isArray(objects.items)?objects.items:[];
if(!objects.items.some(x=>x.name===name)){
  const {x,y,z}=sant.local,h=.26;
  objects.items.push({areaM2:null,collisionMode:'none',footprint:[[x-h,z-h],[x+h,z-h],[x+h,z+h],[x-h,z+h],[x-h,z-h]],heightMeters:18,id:'marker-es-manual-sant-just-desvern',kind:'public',local:{x,y,z},name,position:{lat,lon},priority:48,roofWalkable:false,scaleY:1,sectorId:'manual-0246',source:'manual-0246',sourceId:'manual-sant-just-desvern',tags:{population:String(population),'waft:lore':'fictional','waft:nuclear_war_deaths':String(sant.warImpact.nuclearWarDeaths),'waft:population_tier':'small'},terrainStatus:'dem-cell'});
  objects.items.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'es'));objects.generationStage='population-war-lore-markers-0246';fs.writeFileSync(objectsPath,JSON.stringify(objects,null,2)+'\n');
}
console.log(`${name}: settlement + physical marker ready (${population} inhabitants).`);
