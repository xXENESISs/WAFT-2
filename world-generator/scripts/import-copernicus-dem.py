#!/usr/bin/env python3
"""Import a Copernicus GLO-30 regional DEM snapshot for WAFT.

The importer downloads only the 1x1 degree COG tiles intersecting a region,
resamples them to the region terrain grid and writes a deterministic compact
Int16 snapshot. Existing snapshots are validated and reused unless --refresh
is supplied, so ordinary region builds do not depend on network availability.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import math
import os
import pathlib
import shutil
import struct
import sys
import time
import urllib.error
import urllib.request
from typing import Iterable

MAGIC = b"WAFTDEM1"
HEADER_BYTES = 64
FORMAT_VERSION = 1
NODATA = -32768
BUCKET = "https://copernicus-dem-30m.s3.amazonaws.com"
DATASET = "Copernicus DEM GLO-30 Public"
RELEASE = "2021"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("region_id", nargs="?", default="baleares")
    parser.add_argument("--root", default=None)
    parser.add_argument("--output-dir", default=None)
    parser.add_argument("--cache-dir", default=None)
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--retrieved-on", default=None)
    return parser.parse_args()


def sha256_file(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def stable_json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def read_json(path: pathlib.Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def tile_name(latitude: int, longitude: int) -> str:
    lat_prefix = "N" if latitude >= 0 else "S"
    lon_prefix = "E" if longitude >= 0 else "W"
    return (
        f"Copernicus_DSM_COG_10_{lat_prefix}{abs(latitude):02d}_00_"
        f"{lon_prefix}{abs(longitude):03d}_00_DEM"
    )


def intersecting_tiles(bounds: dict) -> Iterable[tuple[int, int, str]]:
    for latitude in range(math.floor(bounds["south"]), math.ceil(bounds["north"])):
        for longitude in range(math.floor(bounds["west"]), math.ceil(bounds["east"])):
            yield latitude, longitude, tile_name(latitude, longitude)


def request_bytes(url: str, attempts: int = 4) -> bytes:
    error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            request = urllib.request.Request(
                url,
                headers={"User-Agent": "WAFT-World-Generator/0.2"},
            )
            with urllib.request.urlopen(request, timeout=120) as response:
                return response.read()
        except Exception as current:
            error = current
            if attempt < attempts:
                time.sleep(attempt * 2)
    raise RuntimeError(f"Could not download {url}: {error}")


def download_file(url: str, target: pathlib.Path, attempts: int = 4) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix(target.suffix + ".part")
    error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            request = urllib.request.Request(
                url,
                headers={"User-Agent": "WAFT-World-Generator/0.2"},
            )
            with urllib.request.urlopen(request, timeout=180) as response, temporary.open("wb") as output:
                shutil.copyfileobj(response, output, length=1024 * 1024)
            if temporary.stat().st_size < 1024:
                raise RuntimeError(f"Downloaded file is suspiciously small: {temporary.stat().st_size}")
            temporary.replace(target)
            return
        except urllib.error.HTTPError as current:
            if current.code == 404:
                temporary.unlink(missing_ok=True)
                raise FileNotFoundError(url) from current
            error = current
        except Exception as current:
            error = current
        temporary.unlink(missing_ok=True)
        if attempt < attempts:
            time.sleep(attempt * 3)
    raise RuntimeError(f"Could not download {url}: {error}")


def encode_snapshot(
    path: pathlib.Path,
    columns: int,
    rows: int,
    bounds: dict,
    values,
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as output:
        header = bytearray(HEADER_BYTES)
        header[0:8] = MAGIC
        struct.pack_into("<H", header, 8, FORMAT_VERSION)
        struct.pack_into("<H", header, 10, HEADER_BYTES)
        struct.pack_into("<H", header, 12, columns)
        struct.pack_into("<H", header, 14, rows)
        struct.pack_into("<d", header, 16, bounds["west"])
        struct.pack_into("<d", header, 24, bounds["east"])
        struct.pack_into("<d", header, 32, bounds["south"])
        struct.pack_into("<d", header, 40, bounds["north"])
        struct.pack_into("<i", header, 48, NODATA)
        struct.pack_into("<I", header, 52, columns * rows)
        struct.pack_into("<I", header, 56, 30)
        struct.pack_into("<I", header, 60, 0)
        output.write(header)
        output.write(values.astype("<i2", copy=False).tobytes(order="C"))


def read_snapshot_header(path: pathlib.Path) -> dict:
    with path.open("rb") as handle:
        header = handle.read(HEADER_BYTES)
    if len(header) != HEADER_BYTES or header[0:8] != MAGIC:
        raise RuntimeError(f"Invalid DEM snapshot: {path}")
    return {
        "formatVersion": struct.unpack_from("<H", header, 8)[0],
        "headerBytes": struct.unpack_from("<H", header, 10)[0],
        "columns": struct.unpack_from("<H", header, 12)[0],
        "rows": struct.unpack_from("<H", header, 14)[0],
        "bounds": {
            "west": struct.unpack_from("<d", header, 16)[0],
            "east": struct.unpack_from("<d", header, 24)[0],
            "south": struct.unpack_from("<d", header, 32)[0],
            "north": struct.unpack_from("<d", header, 40)[0],
        },
        "nodata": struct.unpack_from("<i", header, 48)[0],
        "cellCount": struct.unpack_from("<I", header, 52)[0],
        "nominalResolutionMeters": struct.unpack_from("<I", header, 56)[0],
    }


def validate_existing(binary_path: pathlib.Path, metadata_path: pathlib.Path, config: dict) -> dict:
    if not binary_path.exists() or not metadata_path.exists():
        raise FileNotFoundError("DEM snapshot is incomplete")
    header = read_snapshot_header(binary_path)
    grid = config["generation"]["terrain"]["grid"]
    bounds = config["geography"]["bounds"]
    if header["columns"] != grid["columns"] or header["rows"] != grid["rows"]:
        raise RuntimeError("Existing DEM snapshot grid does not match region config")
    for key in ("west", "east", "south", "north"):
        if abs(header["bounds"][key] - bounds[key]) > 1e-10:
            raise RuntimeError(f"Existing DEM snapshot {key} bound does not match region config")
    expected_bytes = HEADER_BYTES + header["cellCount"] * 2
    if binary_path.stat().st_size != expected_bytes:
        raise RuntimeError("Existing DEM snapshot byte size is invalid")
    metadata = read_json(metadata_path)
    if metadata.get("binarySha256") != sha256_file(binary_path):
        raise RuntimeError("Existing DEM snapshot SHA-256 does not match metadata")
    return metadata


def build_snapshot(
    config: dict,
    binary_path: pathlib.Path,
    metadata_path: pathlib.Path,
    cache_dir: pathlib.Path,
    retrieved_on: str,
) -> dict:
    try:
        import numpy as np
        import rasterio
        from rasterio.transform import from_bounds
        from rasterio.warp import Resampling, reproject
    except ImportError as error:
        raise RuntimeError(
            "Creating a new DEM snapshot requires numpy and rasterio. "
            "Install them before running with --refresh."
        ) from error

    bounds = config["geography"]["bounds"]
    grid = config["generation"]["terrain"]["grid"]
    columns = int(grid["columns"])
    rows = int(grid["rows"])
    cache_dir.mkdir(parents=True, exist_ok=True)

    tile_list_path = cache_dir / "tileList.txt"
    if not tile_list_path.exists():
        tile_list_path.write_bytes(request_bytes(f"{BUCKET}/tileList.txt"))
    tile_list_text = tile_list_path.read_text(encoding="utf-8", errors="ignore")

    selected = []
    missing = []
    for latitude, longitude, name in intersecting_tiles(bounds):
        if name not in tile_list_text:
            missing.append(name)
            continue
        target = cache_dir / f"{name}.tif"
        url = f"{BUCKET}/{name}/{name}.tif"
        if not target.exists():
            download_file(url, target)
        selected.append((latitude, longitude, name, target, url))

    if not selected:
        raise RuntimeError("Copernicus tile list contains no tiles intersecting this region")

    destination = np.full((rows, columns), np.nan, dtype=np.float32)
    destination_transform = from_bounds(
        bounds["west"], bounds["south"], bounds["east"], bounds["north"], columns, rows
    )
    tile_records = []
    for _, _, name, tile_path, url in selected:
        with rasterio.open(tile_path) as source:
            temporary = np.full((rows, columns), np.nan, dtype=np.float32)
            reproject(
                source=rasterio.band(source, 1),
                destination=temporary,
                src_transform=source.transform,
                src_crs=source.crs,
                src_nodata=source.nodata,
                dst_transform=destination_transform,
                dst_crs="EPSG:4326",
                dst_nodata=np.nan,
                resampling=Resampling.bilinear,
                init_dest_nodata=True,
                num_threads=2,
            )
            valid = np.isfinite(temporary)
            destination[valid] = temporary[valid]
            tile_records.append(
                {
                    "id": name,
                    "url": url,
                    "bytes": tile_path.stat().st_size,
                    "sha256": sha256_file(tile_path),
                    "crs": str(source.crs),
                    "width": source.width,
                    "height": source.height,
                }
            )

    finite = np.isfinite(destination)
    if int(finite.sum()) < columns * rows * 0.2:
        raise RuntimeError("Imported DEM covers too little of the target grid")
    output = np.full((rows, columns), NODATA, dtype=np.int16)
    clipped = np.clip(np.rint(destination[finite]), -32767, 32767).astype(np.int16)
    output[finite] = clipped
    encode_snapshot(binary_path, columns, rows, bounds, output)

    finite_values = output[output != NODATA]
    metadata = {
        "formatVersion": 1,
        "regionId": config["id"],
        "dataset": DATASET,
        "datasetRelease": RELEASE,
        "provider": "Copernicus Programme",
        "distribution": "Registry of Open Data on AWS",
        "bucket": "s3://copernicus-dem-30m",
        "license": config["sources"]["terrain"]["license"],
        "attribution": config["sources"]["terrain"]["attribution"],
        "retrievedOn": retrieved_on,
        "nominalResolutionMeters": 30,
        "targetGrid": {
            "columns": columns,
            "rows": rows,
            "bounds": bounds,
            "resampling": "bilinear",
        },
        "availableCells": int(finite.sum()),
        "nodataCells": int((~finite).sum()),
        "minimumElevationMeters": int(finite_values.min()),
        "maximumElevationMeters": int(finite_values.max()),
        "meanElevationMeters": round(float(finite_values.mean()), 3),
        "tiles": sorted(tile_records, key=lambda item: item["id"]),
        "unavailableIntersectingTiles": sorted(missing),
        "binaryFile": binary_path.name,
        "binaryBytes": binary_path.stat().st_size,
        "binarySha256": sha256_file(binary_path),
        "sourceDocumentation": "https://copernicus-dem-30m.s3.amazonaws.com/readme.html",
    }
    metadata_path.write_text(stable_json(metadata), encoding="utf-8")
    return metadata


def main() -> int:
    args = parse_args()
    script_root = pathlib.Path(__file__).resolve().parents[2]
    root = pathlib.Path(args.root).resolve() if args.root else script_root
    config_path = root / "world-generator" / "configs" / f"{args.region_id}.region.json"
    config = read_json(config_path)
    output_dir = pathlib.Path(args.output_dir).resolve() if args.output_dir else root / "world-generator" / "sources" / args.region_id
    cache_dir = pathlib.Path(args.cache_dir).resolve() if args.cache_dir else root / "world-generator" / ".cache" / "copernicus-dem"
    output_dir.mkdir(parents=True, exist_ok=True)
    binary_path = output_dir / "copernicus-dem-glo30.bin"
    metadata_path = output_dir / "copernicus-dem-glo30.json"

    if binary_path.exists() and metadata_path.exists() and not args.refresh:
        metadata = validate_existing(binary_path, metadata_path, config)
        result = {
            "regionId": args.region_id,
            "mode": "reused-existing-snapshot",
            "binary": str(binary_path.relative_to(root)),
            "metadata": str(metadata_path.relative_to(root)),
            "bytes": binary_path.stat().st_size,
            "sha256": metadata["binarySha256"],
            "tiles": len(metadata.get("tiles", [])),
        }
        print(stable_json(result), end="")
        return 0

    retrieved_on = args.retrieved_on or dt.date.today().isoformat()
    metadata = build_snapshot(config, binary_path, metadata_path, cache_dir, retrieved_on)
    result = {
        "regionId": args.region_id,
        "mode": "downloaded-and-built",
        "binary": str(binary_path.relative_to(root)),
        "metadata": str(metadata_path.relative_to(root)),
        "bytes": binary_path.stat().st_size,
        "sha256": metadata["binarySha256"],
        "tiles": len(metadata["tiles"]),
        "availableCells": metadata["availableCells"],
        "maximumElevationMeters": metadata["maximumElevationMeters"],
    }
    print(stable_json(result), end="")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"DEM import failed: {error}", file=sys.stderr)
        raise
