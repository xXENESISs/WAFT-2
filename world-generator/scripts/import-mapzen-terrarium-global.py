#!/usr/bin/env python3
"""Build the WAFT 0.26.0 continuous global macro DEM.

The output uses WAFT's existing compact DEM contract but samples the public
Mapzen Terrarium terrain pyramid and a Natural Earth 1:50m land mask. The
atlas is intentionally coarse: one seamless mobile-safe base surface is always
present while later local detail can stream by sector without swapping worlds.
"""
from __future__ import annotations
import argparse, hashlib, json, math, pathlib, shutil, struct, time, urllib.request

SOURCE_MAGIC=b"WAFTDEM1"; HEADER=64; NODATA=-32768
TERRARIUM="https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
LAND_URL="https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_land.geojson"
ZOOM=4

def stable(v): return json.dumps(v,ensure_ascii=False,indent=2,sort_keys=True)+"\n"
def sha(path):
    h=hashlib.sha256()
    with path.open("rb") as f:
        for b in iter(lambda:f.read(1024*1024),b""): h.update(b)
    return h.hexdigest()
def fetch(url,target,attempts=4):
    target.parent.mkdir(parents=True,exist_ok=True)
    if target.exists() and target.stat().st_size>256: return target
    part=target.with_suffix(target.suffix+".part"); error=None
    for i in range(attempts):
        try:
            req=urllib.request.Request(url,headers={"User-Agent":"WAFT-Global-Atlas/0.26.0"})
            with urllib.request.urlopen(req,timeout=90) as r, part.open("wb") as out: shutil.copyfileobj(r,out)
            if part.stat().st_size<256: raise RuntimeError("download too small")
            part.replace(target); return target
        except Exception as e:
            error=e; part.unlink(missing_ok=True)
            if i+1<attempts: time.sleep(2*(i+1))
    raise RuntimeError(f"Could not download {url}: {error}")
def write_dem(path,columns,rows,bounds,values):
    header=bytearray(HEADER); header[:8]=SOURCE_MAGIC
    struct.pack_into("<H",header,8,1);struct.pack_into("<H",header,10,HEADER);struct.pack_into("<H",header,12,columns);struct.pack_into("<H",header,14,rows)
    struct.pack_into("<d",header,16,bounds["west"]);struct.pack_into("<d",header,24,bounds["east"]);struct.pack_into("<d",header,32,bounds["south"]);struct.pack_into("<d",header,40,bounds["north"])
    struct.pack_into("<i",header,48,NODATA);struct.pack_into("<I",header,52,columns*rows);struct.pack_into("<I",header,56,0);struct.pack_into("<I",header,60,0)
    path.parent.mkdir(parents=True,exist_ok=True)
    with path.open("wb") as out: out.write(header);out.write(values.astype("<i2",copy=False).tobytes(order="C"))
def valid_existing(binary,metadata,config):
    if not binary.exists() or not metadata.exists(): return False
    raw=binary.read_bytes()
    if len(raw)<HEADER or raw[:8]!=SOURCE_MAGIC:return False
    cols=struct.unpack_from("<H",raw,12)[0];rows=struct.unpack_from("<H",raw,14)[0];grid=config["generation"]["terrain"]["grid"]
    meta=json.loads(metadata.read_text("utf-8"))
    return cols==grid["columns"] and rows==grid["rows"] and meta.get("mode")=="mapzen-terrarium-z5" and meta.get("binarySha256")==sha(binary)
def xyz(lon,lat,z):
    n=2**z;lat=max(-85.05112878,min(85.05112878,lat));xf=(lon+180.0)/360.0*n;rad=math.radians(lat);yf=(1.0-math.asinh(math.tan(rad))/math.pi)/2.0*n;return xf,yf
def ring_pixels(ring,bounds,columns,rows):
    sx=(columns-1)/(bounds["east"]-bounds["west"]);sy=(rows-1)/(bounds["north"]-bounds["south"])
    return [((float(lon)-bounds["west"])*sx,(bounds["north"]-float(lat))*sy) for lon,lat,*_ in ring]

def main():
    p=argparse.ArgumentParser();p.add_argument("region_id",nargs="?",default="global-atlas");p.add_argument("--root",default=None);p.add_argument("--refresh",action="store_true");a=p.parse_args()
    root=pathlib.Path(a.root).resolve() if a.root else pathlib.Path(__file__).resolve().parents[2]
    config=json.loads((root/"world-generator/configs"/f"{a.region_id}.region.json").read_text("utf-8"));bounds=config["geography"]["bounds"];grid=config["generation"]["terrain"]["grid"];columns=int(grid["columns"]);rows=int(grid["rows"])
    src=root/"world-generator/sources"/a.region_id;src.mkdir(parents=True,exist_ok=True);binary=src/"copernicus-dem-glo30.bin";metadata=src/"copernicus-dem-glo30.json"
    if not a.refresh and valid_existing(binary,metadata,config):
        meta=json.loads(metadata.read_text("utf-8"));print(stable({"regionId":a.region_id,"mode":"reused","tiles":len(meta.get("tiles",[])),"sha256":meta["binarySha256"]}),end="");return 0
    import numpy as np
    from PIL import Image,ImageDraw
    cache=root/"world-generator/.cache/mapzen-terrarium";cache.mkdir(parents=True,exist_ok=True);ne=fetch(LAND_URL,cache/"ne_50m_land.geojson");geo=json.loads(ne.read_text("utf-8"))
    mask=Image.new("L",(columns,rows),0);draw=ImageDraw.Draw(mask)
    for feature in geo.get("features",[]):
        geom=feature.get("geometry") or {};typ=geom.get("type");coords=geom.get("coordinates") or [];polygons=coords if typ=="MultiPolygon" else [coords] if typ=="Polygon" else []
        for poly in polygons:
            if not poly: continue
            draw.polygon(ring_pixels(poly[0],bounds,columns,rows),fill=1)
            for hole in poly[1:]: draw.polygon(ring_pixels(hole,bounds,columns,rows),fill=0)
    land=np.asarray(mask,dtype=np.uint8)>0;tiles={};records={}
    def tile_image(tx,ty):
        key=(tx,ty)
        if key in tiles:return tiles[key]
        target=cache/f"{ZOOM}-{tx}-{ty}.png";url=TERRARIUM.format(z=ZOOM,x=tx,y=ty);fetch(url,target);img=Image.open(target).convert("RGB");tiles[key]=img;records[key]={"id":f"{ZOOM}/{tx}/{ty}","url":url,"bytes":target.stat().st_size,"sha256":sha(target)};return img
    def elevation(lon,lat):
        xf,yf=xyz(lon,lat,ZOOM);n=2**ZOOM;tx=max(0,min(n-1,int(math.floor(xf))));ty=max(0,min(n-1,int(math.floor(yf))));px=max(0,min(255,int((xf-tx)*256)));py=max(0,min(255,int((yf-ty)*256)));r,g,b=tile_image(tx,ty).getpixel((px,py));return (r*256.0+g+b/256.0)-32768.0
    out=np.full((rows,columns),NODATA,dtype=np.int16);dlon=(bounds["east"]-bounds["west"])/max(1,columns-1);dlat=(bounds["north"]-bounds["south"])/max(1,rows-1);offsets=[(-.34,-.34),(0,-.34),(.34,-.34),(-.34,0),(0,0),(.34,0),(-.34,.34),(0,.34),(.34,.34)]
    for r in range(rows):
        lat=bounds["north"]-r*dlat
        for c in range(columns):
            if not land[r,c]:continue
            lon=bounds["west"]+c*dlon;vals=sorted(elevation(lon+ox*dlon,lat+oy*dlat) for ox,oy in offsets);v=vals[int(round((len(vals)-1)*.72))];out[r,c]=int(max(0,min(32767,round(v))))
    for _ in range(2):
        nxt=out.copy()
        for r in range(1,rows-1):
            for c in range(1,columns-1):
                if out[r,c]==NODATA:continue
                vals=[int(out[rr,cc]) for rr in range(r-1,r+2) for cc in range(c-1,c+2) if out[rr,cc]!=NODATA]
                if vals:nxt[r,c]=int(round(.62*int(out[r,c])+.38*(sum(vals)/len(vals))))
        out=nxt
    write_dem(binary,columns,rows,bounds,out);vals=out[out!=NODATA]
    meta={"formatVersion":1,"regionId":a.region_id,"mode":"mapzen-terrarium-z5","dataset":"Mapzen Terrain Tiles · Terrarium","provider":"Mapzen terrain tiles / AWS Open Data","distribution":"elevation-tiles-prod public S3 bucket","license":"Source-dependent; see Mapzen terrain tile attribution","attribution":"Mapzen terrain tiles and contributing elevation datasets","retrievedOn":"2026-08-10","nominalResolutionMeters":None,"targetGrid":{"columns":columns,"rows":rows,"bounds":bounds,"terrainZoom":ZOOM,"elevationSampling":"9-point p72 + two gentle smoothing passes","landMask":"Natural Earth 1:50m"},"availableCells":int((out!=NODATA).sum()),"nodataCells":int((out==NODATA).sum()),"minimumElevationMeters":int(vals.min()),"maximumElevationMeters":int(vals.max()),"meanElevationMeters":round(float(vals.mean()),3),"tiles":sorted(records.values(),key=lambda x:x["id"]),"landMaskSource":{"dataset":"Natural Earth 1:50m land","url":LAND_URL,"sha256":sha(ne),"license":"Public domain"},"binaryFile":binary.name,"binaryBytes":binary.stat().st_size,"binarySha256":sha(binary)}
    metadata.write_text(stable(meta),"utf-8");print(stable({"regionId":a.region_id,"mode":"built","grid":[columns,rows],"landCells":meta["availableCells"],"landRatio":round(meta["availableCells"]/(columns*rows),6),"tiles":len(records),"maximumElevationMeters":meta["maximumElevationMeters"],"sha256":meta["binarySha256"]}),end="");return 0
if __name__=="__main__": raise SystemExit(main())
