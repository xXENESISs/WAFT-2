import fs from 'node:fs';

const path='regions/iberia/settlements.json';
const terrainPath='regions/iberia/terrain.bin';
const data=JSON.parse(fs.readFileSync(path,'utf8'));
const items=Array.isArray(data.items)?data.items:[];
const name='Sant Just Desvern';
if(!items.some(x=>x.name===name)){
  const lat=41.3817,lon=2.0751,population=21000;
  const buf=fs.readFileSync(terrainPath);
  const headerBytes=buf.readUInt16LE(10),cols=buf.readUInt16LE(12),rows=buf.readUInt16LE(14);
  const west=buf.readDoubleLE(16),east=buf.readDoubleLE(24),south=buf.readDoubleLE(32),north=buf.readDoubleLE(40),nodata=buf.readInt32LE(56);
  const col=Math.max(0,Math.min(cols-1,Math.round((lon-west)/(east-west)*(cols-1))));
  const row=Math.max(0,Math.min(rows-1,Math.round((north-lat)/(north-south)*(rows-1))));
  let elevation=buf.readInt16LE(headerBytes+(row*cols+col)*2);if(elevation===nodata)elevation=90;
  const U=1.45,lat0=39.775,lon0=-3.125,kmLat=111.132,kmLon=85.55640544079021;
  const x=(lon-lon0)*kmLon*U,z=-(lat-lat0)*kmLat*U;
  const deaths=Math.round(population*.55);
  items.push({
    capitalLevel:null,countryCode:'ES',id:'es-manual-sant-just-desvern',
    local:{x:+x.toFixed(4),y:elevation,z:+z.toFixed(4)},name,place:'PPLA3',population,populationTier:'small',
    position:{lat,lon},priority:48,protected:true,sectorId:'manual-0246',source:'manual-0246',sourceId:'manual-sant-just-desvern',terrainStatus:'dem-cell',
    warImpact:{fictional:true,nuclearWarDeaths:deaths,rate:.55,scenario:'WAFT-nuclear-war',survivorsImmediatelyAfter:population-deaths}
  });
  items.sort((a,b)=>String(a.name).localeCompare(String(b.name),'es'));
  data.items=items;data.generationStage='population-war-lore-markers-0246';
  fs.writeFileSync(path,JSON.stringify(data,null,2)+'\n');
  console.log(`Added ${name}: ${population} inhabitants at ${lat}, ${lon}.`);
}else console.log(`${name} already present.`);
