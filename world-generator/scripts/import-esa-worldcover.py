#!/usr/bin/env python3
"""Import ESA WorldCover 2021 v200 for a WAFT region.

The source is the public 3x3 degree COG grid hosted in the ESA WorldCover AWS
bucket. The result is a deterministic Uint8 snapshot aligned exactly with the
region terrain grid. Existing snapshots are validated and reused unless
--refresh is supplied.
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
import sys
import time
import urllib.error
import urllib.request

MAGIC = b"WAFTWCV1"
HEADER_BYTES = 64
FORMAT_VERSION = 1
NODATA = 0
YEAR = 2021
VERSION = "v200"
BUCKET = "https://esa-worldcover.s3.eu-central-1.amazonaws.com"
CLASS_NAMES = {
    0: "No data",
    10: "Tree cover",
    20: "Shrubland",
    30: "Grassland",
    40: "Cropland",
    50: "Built-up",
    60: "Bare or sparse vegetation",
    70: "Snow and ice",
    80: "Permanent water bodies",
    90: "Herbaceous wetland",
    95: "Mangroves",
    100: "Moss and lichen",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("region_id", nargs="?", default="baleares")
    parser.add_argument("--root", default=None)
    parser.add_argument("--output-dir", default=None)
    parser.add_argument("--cache-dir", default=None)
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--retrieved-on", default=None)
    return parser.parse_args()


def read_json(path: pathlib.Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def stable_json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def sha256_file(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def coordinate_label(latitude: int, longitude: int) -> str:
    lat_prefix = "N" if latitude >= 0 else "S"
    lon_prefix = "E" if longitude >= 0 else "W"
    return f"{lat_prefix}{abs(latitude):02d}{lon_prefix}{abs(longitude):03d}"


def tile_origins(bounds: dict):
    south = math.floor(bounds["south"] / 3) * 3
    north = math.ceil(bounds["north"] / 3) * 3
    west = math.floor(bounds["west"] / 3) * 3
    east = math.ceil(bounds["east"] / 3) * 3
    for latitude in range(south, north, 3):
        for longitude in range(west, east, 3):
            yield latitude, longitude, coordinate_label(latitude, longitude)


def download_file(url: str, target: pathlib.Path, attempts: int = 4) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix(target.suffix + ".part")
    error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "WAFT-World-Generator/0.2"})
            with urllib.request.urlopen(request, timeout=240) as response, temporary.open("wb") as output:
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


def encode_snapshot(path: pathlib.Path, columns: int, rows: int, bounds: dict, values) -> None:
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
        struct.pack_into("<I", header, 48, NODATA)
        struct.pack_into("<I", header, 52, columns * rows)
        struct.pack_into("<H", header, 56, YEAR)
        struct.pack_into("<H", header, 58, 200)
        struct.pack_into("<I", header, 60, 10)
        output.write(header)
        output.write(values.astype("u1", copy=False).tobytes(order="C"))


def read_snapshot_header(path: pathlib.Path) -> dict:
    with path.open("rb") as handle:
        header = handle.read(HEADER_BYTES)
    if len(header) != HEADER_BYTES or header[0:8] != MAGIC:
        raise RuntimeError(f"Invalid WorldCover snapshot: {path}")
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
        "nodata": struct.unpack_from("<I", header, 48)[0],
        "cellCount": struct.unpack_from("<I", header, 52)[0],
        "year": struct.unpack_from("<H", header, 56)[0],
        "algorithmVersion": struct.unpack_from("<H", header, 58)[0],
        "nominalResolutionMeters": struct.unpack_from("<I", header, 60)[0],
    }


def validate_existing(binary_path: pathlib.Path, metadata_path: pathlib.Path, config: dict) -> dict:
    if not binary_path.exists() or not metadata_path.exists():
        raise FileNotFoundError("WorldCover snapshot is incomplete")
    header = read_snapshot_header(binary_path)
    grid = config["generation"]["terrain"]["grid"]
    bounds = config["geography"]["bounds"]
    if header["columns"] != grid["columns"] or header["rows"] != grid["rows"]:
        raise RuntimeError("Existing WorldCover grid does not match region config")
    for key in ("west", "east", "south", "north"):
        if abs(header["bounds"][key] - bounds[key]) > 1e-10:
            raise RuntimeError(f"Existing WorldCover {key} bound does not match region config")
    if binary_path.stat().st_size != HEADER_BYTES + header["cellCount"]:
        raise RuntimeError("Existing WorldCover snapshot byte size is invalid")
    metadata = read_json(metadata_path)
    if metadata.get("binarySha256") != sha256_file(binary_path):
        raise RuntimeError("Existing WorldCover snapshot SHA-256 does not match metadata")
    return metadata


def build_snapshot(config: dict, binary_path: pathlib.Path, metadata_path: pathlib.Path, cache_dir: pathlib.Path, retrieved_on: str) -> dict:
    try:
        import numpy as np
        import rasterio
        from rasterio.transform import from_bounds
        from rasterio.warp import Resampling, reproject
    except ImportError as error:
        raise RuntimeError("Creating a WorldCover snapshot requires numpy and rasterio") from error

    bounds = config["geography"]["bounds"]
    grid = config["generation"]["terrain"]["grid"]
    columns = int(grid["columns"])
    rows = int(grid["rows"])
    cache_dir.mkdir(parents=True, exist_ok=True)
    destination = np.zeros((rows, columns), dtype=np.uint8)
    destination_transform = from_bounds(bounds["west"], bounds["south"], bounds["east"], bounds["north"], columns, rows)
    tile_records = []
    missing = []

    for _, _, label in tile_origins(bounds):
        filename = f"ESA_WorldCover_10m_{YEAR}_{VERSION}_{label}_Map.tif"
        url = f"{BUCKET}/{VERSION}/{YEAR}/map/{filename}"
        tile_path = cache_dir / filename
        if not tile_path.exists():
            try:
                download_file(url, tile_path)
            except FileNotFoundError:
                missing.append(label)
                continue
        with rasterio.open(tile_path) as source:
            temporary = np.zeros((rows, columns), dtype=np.uint8)
            reproject(
                source=rasterio.band(source, 1),
                destination=temporary,
                src_transform=source.transform,
                src_crs=source.crs,
                src_nodata=source.nodata or 0,
                dst_transform=destination_transform,
                dst_crs="EPSG:4326",
                dst_nodata=0,
                resampling=Resampling.nearest,
                init_dest_nodata=True,
                num_threads=2,
            )
            valid = temporary != 0
            destination[valid] = temporary[valid]
            tile_records.append({
                "id": label,
                "filename": filename,
                "url": url,
                "bytes": tile_path.stat().st_size,
                "sha256": sha256_file(tile_path),
                "crs": str(source.crs),
                "width": source.width,
                "height": source.height,
            })

    if not tile_records:
        raise RuntimeError("No ESA WorldCover tiles were available for the region")
    allowed = set(CLASS_NAMES)
    observed = set(int(value) for value in np.unique(destination))
    unknown = observed - allowed
    if unknown:
        raise RuntimeError(f"Unknown WorldCover classes: {sorted(unknown)}")
    if int((destination != 0).sum()) < columns * rows * 0.02:
        raise RuntimeError("WorldCover snapshot contains too little classified area")

    encode_snapshot(binary_path, columns, rows, bounds, destination)
    values, counts = np.unique(destination, return_counts=True)
    distribution = {
        str(int(value)): {
            "name": CLASS_NAMES[int(value)],
            "cells": int(count),
            "ratio": round(float(count) / destination.size, 8),
        }
        for value, count in zip(values, counts)
    }
    metadata = {
        "formatVersion": 1,
        "regionId": config["id"],
        "dataset": "ESA WorldCover 10 m 2021 v200",
        "datasetYear": YEAR,
        "algorithmVersion": VERSION,
        "provider": "European Space Agency WorldCover project",
        "distribution": "Registry of Open Data on AWS",
        "bucket": "s3://esa-worldcover/v200/2021/map",
        "license": "CC BY 4.0",
        "attribution": "© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium",
        "retrievedOn": retrieved_on,
        "nominalResolutionMeters": 10,
        "targetGrid": {
            "columns": columns,
            "rows": rows,
            "bounds": bounds,
            "resampling": "nearest",
        },
        "classifiedCells": int((destination != 0).sum()),
        "nodataCells": int((destination == 0).sum()),
        "classDistribution": distribution,
        "tiles": sorted(tile_records, key=lambda item: item["id"]),
        "unavailableIntersectingTiles": sorted(missing),
        "binaryFile": binary_path.name,
        "binaryBytes": binary_path.stat().st_size,
        "binarySha256": sha256_file(binary_path),
        "sourceDocumentation": "https://esa-worldcover.org/en/data-access",
        "doi": "10.5281/zenodo.7254221",
    }
    metadata_path.write_text(stable_json(metadata), encoding="utf-8")
    return metadata


def main() -> int:
    args = parse_args()
    root = pathlib.Path(args.root).resolve() if args.root else pathlib.Path(__file__).resolve().parents[2]
    config_path = root / "world-generator" / "configs" / f"{args.region_id}.region.json"
    config = read_json(config_path)
    output_dir = pathlib.Path(args.output_dir).resolve() if args.output_dir else root / "world-generator" / "sources" / args.region_id
    cache_dir = pathlib.Path(args.cache_dir).resolve() if args.cache_dir else root / "world-generator" / ".cache" / "esa-worldcover"
    output_dir.mkdir(parents=True, exist_ok=True)
    binary_path = output_dir / "esa-worldcover-2021-v200.bin"
    metadata_path = output_dir / "esa-worldcover-2021-v200.json"

    if binary_path.exists() and metadata_path.exists() and not args.refresh:
        metadata = validate_existing(binary_path, metadata_path, config)
        print(stable_json({
            "regionId": args.region_id,
            "mode": "reused-existing-snapshot",
            "binary": str(binary_path.relative_to(root)),
            "metadata": str(metadata_path.relative_to(root)),
            "bytes": binary_path.stat().st_size,
            "sha256": metadata["binarySha256"],
            "tiles": len(metadata.get("tiles", [])),
        }), end="")
        return 0

    metadata = build_snapshot(
        config,
        binary_path,
        metadata_path,
        cache_dir,
        args.retrieved_on or dt.date.today().isoformat(),
    )
    print(stable_json({
        "regionId": args.region_id,
        "mode": "downloaded-and-built",
        "binary": str(binary_path.relative_to(root)),
        "metadata": str(metadata_path.relative_to(root)),
        "bytes": binary_path.stat().st_size,
        "sha256": metadata["binarySha256"],
        "tiles": len(metadata["tiles"]),
        "classifiedCells": metadata["classifiedCells"],
        "classes": sorted(int(key) for key in metadata["classDistribution"]),
    }), end="")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"WorldCover import failed: {error}", file=sys.stderr)
        raise
