#!/usr/bin/env python3
"""Build a compact WAFT DEM snapshot from Copernicus GLO-90.

This is intended for very large compressed regions where the final WAFT grid is
kilometre-scale. It downloads only intersecting public 1x1 COG tiles and uses
maximum resampling so major peaks survive the aggressive horizontal compression.
The output filenames intentionally match the generic regional bootstrap contract.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import math
import pathlib
import shutil
import struct
import time
import urllib.error
import urllib.request

MAGIC=b"WAFTDEM1"
HEADER_BYTES=64
NODATA=-32768
BUCKET="https://copernicus-dem-90m.s3.amazonaws.com"
DATASET="Copernicus DEM GLO-90"
RELEASE="2021"


def args():
    p=argparse.ArgumentParser()
    p.add_argument("region_id")
    p.add_argument("--root",default=None)
    p.add_argument("--cache-dir",default=None)
    p.add_argument("--retrieved-on",default=None)
    p.add_argument("--refresh",action="store_true")
    return p.parse_args()


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def stable(value):
    return json.dumps(value,ensure_ascii=False,indent=2,sort_keys=True)+"\n"


def sha(path):
    h=hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda:f.read(1024*1024),b""): h.update(block)
    return h.hexdigest()


def tile_name(lat,lon):
    ns="N" if lat>=0 else "S"; ew="E" if lon>=0 else "W"
    return f"Copernicus_DSM_COG_30_{ns}{abs(lat):02d}_00_{ew}{abs(lon):03d}_00_DEM"


def tiles(bounds):
    for lat in range(math.floor(bounds["south"]),math.ceil(bounds["north"])):
        for lon in range(math.floor(bounds["west"]),math.ceil(bounds["east"])):
            yield lat,lon,tile_name(lat,lon)


def request_bytes(url,attempts=4):
    error=None
    for attempt in range(1,attempts+1):
        try:
            req=urllib.request.Request(url,headers={"User-Agent":"WAFT-World-Generator/0.24"})
            with urllib.request.urlopen(req,timeout=120) as response: return response.read()
        except Exception as current:
            error=current
            if attempt<attempts: time.sleep(attempt*2)
    raise RuntimeError(f"Could not download {url}: {error}")


def download(url,target,attempts=4):
    target.parent.mkdir(parents=True,exist_ok=True)
    part=target.with_suffix(target.suffix+".part")
    error=None
    for attempt in range(1,attempts+1):
        try:
            req=urllib.request.Request(url,headers={"User-Agent":"WAFT-World-Generator/0.24"})
            with urllib.request.urlopen(req,timeout=180) as response,part.open("wb") as out:
                shutil.copyfileobj(response,out,length=1024*1024)
            if part.stat().st_size<1024: raise RuntimeError("download suspiciously small")
            part.replace(target); return
        except urllib.error.HTTPError as current:
            if current.code==404:
                part.unlink(missing_ok=True); raise FileNotFoundError(url) from current
            error=current
        except Exception as current: error=current
        part.unlink(missing_ok=True)
        if attempt<attempts: time.sleep(attempt*3)
    raise RuntimeError(f"Could not download {url}: {error}")


def write_snapshot(path,columns,rows,bounds,values):
    header=bytearray(HEADER_BYTES); header[:8]=MAGIC
    struct.pack_into("<H",header,8,1); struct.pack_into("<H",header,10,HEADER_BYTES)
    struct.pack_into("<H",header,12,columns); struct.pack_into("<H",header,14,rows)
    struct.pack_into("<d",header,16,bounds["west"]); struct.pack_into("<d",header,24,bounds["east"])
    struct.pack_into("<d",header,32,bounds["south"]); struct.pack_into("<d",header,40,bounds["north"])
    struct.pack_into("<i",header,48,NODATA); struct.pack_into("<I",header,52,columns*rows)
    struct.pack_into("<I",header,56,90); struct.pack_into("<I",header,60,0)
    path.parent.mkdir(parents=True,exist_ok=True)
    with path.open("wb") as out:
        out.write(header); out.write(values.astype("<i2",copy=False).tobytes(order="C"))


def validate_existing(binary,metadata,config):
    if not binary.exists() or not metadata.exists(): return False
    raw=binary.read_bytes()
    if len(raw)<HEADER_BYTES or raw[:8]!=MAGIC: return False
    cols=struct.unpack_from("<H",raw,12)[0]; rows=struct.unpack_from("<H",raw,14)[0]
    grid=config["generation"]["terrain"]["grid"]
    if cols!=grid["columns"] or rows!=grid["rows"]: return False
    return read_json(metadata).get("binarySha256")==sha(binary)


def main():
    a=args(); root=pathlib.Path(a.root).resolve() if a.root else pathlib.Path(__file__).resolve().parents[2]
    config=read_json(root/"world-generator"/"configs"/f"{a.region_id}.region.json")
    source_dir=root/"world-generator"/"sources"/a.region_id; source_dir.mkdir(parents=True,exist_ok=True)
    binary=source_dir/"copernicus-dem-glo30.bin"; metadata_path=source_dir/"copernicus-dem-glo30.json"
    cache=pathlib.Path(a.cache_dir).resolve() if a.cache_dir else root/"world-generator"/".cache"/"copernicus-dem-glo90"
    cache.mkdir(parents=True,exist_ok=True)
    if not a.refresh and validate_existing(binary,metadata_path,config):
        meta=read_json(metadata_path)
        print(stable({"regionId":a.region_id,"mode":"reused","tiles":len(meta.get("tiles",[])),"sha256":meta["binarySha256"]}),end=""); return 0

    import numpy as np
    import rasterio
    from rasterio.transform import from_bounds
    from rasterio.warp import Resampling,reproject

    bounds=config["geography"]["bounds"]; grid=config["generation"]["terrain"]["grid"]
    columns=int(grid["columns"]); rows=int(grid["rows"])
    tile_list=cache/"tileList.txt"
    if not tile_list.exists(): tile_list.write_bytes(request_bytes(f"{BUCKET}/tileList.txt"))
    available=tile_list.read_text(encoding="utf-8",errors="ignore")
    destination=np.full((rows,columns),np.nan,dtype=np.float32)
    transform=from_bounds(bounds["west"],bounds["south"],bounds["east"],bounds["north"],columns,rows)
    records=[]; missing=[]
    for _,_,name in tiles(bounds):
        if name not in available:
            missing.append(name); continue
        target=cache/f"{name}.tif"; url=f"{BUCKET}/{name}/{name}.tif"
        if not target.exists(): download(url,target)
        with rasterio.open(target) as src:
            temp=np.full((rows,columns),np.nan,dtype=np.float32)
            reproject(source=rasterio.band(src,1),destination=temp,src_transform=src.transform,src_crs=src.crs,
                      src_nodata=src.nodata,dst_transform=transform,dst_crs="EPSG:4326",dst_nodata=np.nan,
                      resampling=Resampling.max,init_dest_nodata=True,num_threads=2)
            valid=np.isfinite(temp); destination[valid]=np.fmax(destination[valid],temp[valid])
            records.append({"id":name,"url":url,"bytes":target.stat().st_size,"sha256":sha(target),"width":src.width,"height":src.height,"crs":str(src.crs)})
    finite=np.isfinite(destination)
    if int(finite.sum())<columns*rows*.2: raise RuntimeError("GLO-90 covers too little of target grid")
    output=np.full((rows,columns),NODATA,dtype=np.int16)
    output[finite]=np.clip(np.rint(destination[finite]),-32767,32767).astype(np.int16)
    write_snapshot(binary,columns,rows,bounds,output)
    vals=output[output!=NODATA]; retrieved=a.retrieved_on or dt.date.today().isoformat()
    metadata={
      "formatVersion":1,"regionId":config["id"],"dataset":DATASET,"datasetRelease":RELEASE,
      "provider":"Copernicus Programme","distribution":"Registry of Open Data on AWS","bucket":"s3://copernicus-dem-90m",
      "license":config["sources"]["terrain"]["license"],"attribution":config["sources"]["terrain"]["attribution"],"retrievedOn":retrieved,
      "nominalResolutionMeters":90,"targetGrid":{"columns":columns,"rows":rows,"bounds":bounds,"resampling":"maximum (peak-preserving)"},
      "availableCells":int(finite.sum()),"nodataCells":int((~finite).sum()),"minimumElevationMeters":int(vals.min()),
      "maximumElevationMeters":int(vals.max()),"meanElevationMeters":round(float(vals.mean()),3),
      "tiles":sorted(records,key=lambda item:item["id"]),"unavailableIntersectingTiles":sorted(missing),
      "binaryFile":binary.name,"binaryBytes":binary.stat().st_size,"binarySha256":sha(binary),
      "sourceDocumentation":"https://copernicus-dem-90m.s3.amazonaws.com/readme.html"
    }
    metadata_path.write_text(stable(metadata),encoding="utf-8")
    print(stable({"regionId":a.region_id,"mode":"downloaded-and-built","tiles":len(records),"grid":[columns,rows],"maximumElevationMeters":metadata["maximumElevationMeters"],"sha256":metadata["binarySha256"]}),end="")
    return 0

if __name__=="__main__": raise SystemExit(main())
