#!/usr/bin/env python3
"""Create the minimal WAFTWCV1 land/water raster needed by build-region-v2.

For terrain-only macro regions we deliberately avoid downloading multi-gigabyte
10 m WorldCover tiles. Positive DEM cells become generic grassland;
zero or missing cells become water. Detailed biome classification comes later.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import struct

DEM_MAGIC=b"WAFTDEM1"; OUT_MAGIC=b"WAFTWCV1"; HEADER=64; DEM_NODATA=-32768


def sha(path):
    h=hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda:f.read(1024*1024),b""): h.update(block)
    return h.hexdigest()


def stable(v): return json.dumps(v,ensure_ascii=False,indent=2,sort_keys=True)+"\n"


def main():
    p=argparse.ArgumentParser(); p.add_argument("region_id"); p.add_argument("--root",default=None); a=p.parse_args()
    root=pathlib.Path(a.root).resolve() if a.root else pathlib.Path(__file__).resolve().parents[2]
    src=root/"world-generator"/"sources"/a.region_id
    dem_path=src/"copernicus-dem-glo30.bin"; dem_meta_path=src/"copernicus-dem-glo30.json"
    raw=dem_path.read_bytes(); meta=json.loads(dem_meta_path.read_text(encoding="utf-8"))
    if raw[:8]!=DEM_MAGIC: raise RuntimeError("invalid DEM source")
    columns=struct.unpack_from("<H",raw,12)[0]; rows=struct.unpack_from("<H",raw,14)[0]
    bounds={"west":struct.unpack_from("<d",raw,16)[0],"east":struct.unpack_from("<d",raw,24)[0],"south":struct.unpack_from("<d",raw,32)[0],"north":struct.unpack_from("<d",raw,40)[0]}
    count=struct.unpack_from("<I",raw,52)[0]
    classes=bytearray(count); land=0; water=0
    for i in range(count):
        elevation=struct.unpack_from("<h",raw,HEADER+i*2)[0]
        # Class 30 = grassland, class 80 = permanent water in ESA WorldCover coding.
        if elevation!=DEM_NODATA and elevation>0:
            classes[i]=30; land+=1
        else:
            classes[i]=80; water+=1
    header=bytearray(HEADER); header[:8]=OUT_MAGIC
    struct.pack_into("<H",header,8,1); struct.pack_into("<H",header,10,HEADER)
    struct.pack_into("<H",header,12,columns); struct.pack_into("<H",header,14,rows)
    struct.pack_into("<d",header,16,bounds["west"]); struct.pack_into("<d",header,24,bounds["east"])
    struct.pack_into("<d",header,32,bounds["south"]); struct.pack_into("<d",header,40,bounds["north"])
    struct.pack_into("<I",header,48,0); struct.pack_into("<I",header,52,count)
    struct.pack_into("<H",header,56,2021); struct.pack_into("<H",header,58,240)
    # 0 is the binary-contract sentinel for a source without one fixed nominal resolution.
    nominal_resolution=meta.get("nominalResolutionMeters")
    struct.pack_into("<I",header,60,int(nominal_resolution) if nominal_resolution is not None else 0)
    out=src/"esa-worldcover-2021-v200.bin"
    with out.open("wb") as f: f.write(header); f.write(classes)
    retrieved=meta.get("retrievedOn")
    out_meta={
      "formatVersion":1,"regionId":a.region_id,"dataset":"WAFT terrain-only land/water mask derived from elevation source",
      "datasetYear":2021,"algorithmVersion":"terrain-only-v2","provider":"WAFT / source terrain provider",
      "distribution":"Derived build artifact","nominalResolutionMeters":nominal_resolution,"retrievedOn":retrieved,
      "attribution":meta.get("attribution","Contains modified terrain data"),"license":meta.get("license","See source terrain metadata"),
      "doi":None,"targetGrid":{"columns":columns,"rows":rows,"bounds":bounds,"method":"DEM elevation > 0"},
      "classDistribution":{"30":{"name":"Grassland placeholder","cells":land,"ratio":round(land/count,8)},"80":{"name":"Water","cells":water,"ratio":round(water/count,8)}},
      "tiles":[],"binaryFile":out.name,"binaryBytes":out.stat().st_size,"binarySha256":sha(out),
      "sourceDocumentation":meta.get("sourceDocumentation")
    }
    (src/"esa-worldcover-2021-v200.json").write_text(stable(out_meta),encoding="utf-8")
    print(stable({"regionId":a.region_id,"landCells":land,"waterCells":water,"landRatio":round(land/count,6),"sha256":out_meta["binarySha256"]}),end="")
    return 0

if __name__=="__main__": raise SystemExit(main())
