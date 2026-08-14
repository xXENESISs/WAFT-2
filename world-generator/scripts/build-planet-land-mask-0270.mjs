import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const sourcePath=path.resolve(process.argv[2]||'/tmp/waft-ne-50m-land.geojson');
const outputPath=path.resolve(process.argv[3]||path.join(root,'mallorca-mobile/adventure-0210/planet-0270/land-50m.bin'));
const metadataPath=path.resolve(process.argv[4]||path.join(root,'mallorca-mobile/adventure-0210/planet-0270/land-50m.meta.json'));
const source=fs.readFileSync(sourcePath);
const collection=JSON.parse(source);
const polygons=[];

for(const feature of collection.features||[]){
  const geometry=feature?.geometry;
  if(!geometry)continue;
  const coordinates=geometry.type==='Polygon'?[geometry.coordinates]:geometry.type==='MultiPolygon'?geometry.coordinates:[];
  for(const polygon of coordinates){
    const rings=[];
    let west=Infinity,east=-Infinity,south=Infinity,north=-Infinity;
    for(const sourceRing of polygon){
      const ring=[];
      for(const point of sourceRing||[]){
        const lon=Number(point?.[0]),lat=Number(point?.[1]);
        if(!Number.isFinite(lon)||!Number.isFinite(lat))continue;
        const previous=ring.at(-1);
        if(previous&&previous[0]===lon&&previous[1]===lat)continue;
        ring.push([lon,lat]);west=Math.min(west,lon);east=Math.max(east,lon);south=Math.min(south,lat);north=Math.max(north,lat);
      }
      if(ring.length>=4)rings.push(ring);
    }
    if(rings.length)polygons.push({west,east,south,north,rings});
  }
}

const ringCount=polygons.reduce((sum,polygon)=>sum+polygon.rings.length,0);
const pointCount=polygons.reduce((sum,polygon)=>sum+polygon.rings.reduce((total,ring)=>total+ring.length,0),0);
const headerBytes=32;
const byteLength=headerBytes+polygons.reduce((sum,polygon)=>sum+20+polygon.rings.reduce((total,ring)=>total+4+ring.length*8,0),0);
const buffer=Buffer.allocUnsafe(byteLength);
buffer.fill(0,0,headerBytes);buffer.write('WAFTLND1',0,'ascii');buffer.writeUInt16LE(1,8);buffer.writeUInt16LE(headerBytes,10);
buffer.writeUInt32LE(polygons.length,12);buffer.writeUInt32LE(ringCount,16);buffer.writeUInt32LE(pointCount,20);buffer.writeUInt16LE(50,24);
let offset=headerBytes;
for(const polygon of polygons){
  buffer.writeFloatLE(polygon.west,offset);buffer.writeFloatLE(polygon.east,offset+4);buffer.writeFloatLE(polygon.south,offset+8);buffer.writeFloatLE(polygon.north,offset+12);
  buffer.writeUInt16LE(polygon.rings.length,offset+16);buffer.writeUInt16LE(0,offset+18);offset+=20;
  for(const ring of polygon.rings){
    buffer.writeUInt32LE(ring.length,offset);offset+=4;
    for(const [lon,lat] of ring){buffer.writeFloatLE(lon,offset);buffer.writeFloatLE(lat,offset+4);offset+=8;}
  }
}
if(offset!==byteLength)throw new Error(`land mask size mismatch ${offset} != ${byteLength}`);
fs.mkdirSync(path.dirname(outputPath),{recursive:true});fs.writeFileSync(outputPath,buffer);
const metadata={
  schema:'waft-land-polygons-v1',scale:'1:50m',polygons:polygons.length,rings:ringCount,points:pointCount,bytes:byteLength,
  sha256:crypto.createHash('sha256').update(buffer).digest('hex'),
  source:{name:'Natural Earth 50m land',repository:'https://github.com/nvkelso/natural-earth-vector',path:'geojson/ne_50m_land.geojson',blob:'c412c52b5286ba727dcb7047ecd6080bcbeb8298',license:'public-domain'},
  sourceSha256:crypto.createHash('sha256').update(source).digest('hex')
};
fs.writeFileSync(metadataPath,`${JSON.stringify(metadata,null,2)}\n`);
console.log(JSON.stringify(metadata,null,2));
