#!/usr/bin/env python3
from __future__ import annotations

import gzip
import hashlib
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'world-generator' / 'scripts' / 'import-openstreetmap.py'
TEMPORARY = ROOT / 'world-generator' / 'scripts' / '.import-openstreetmap-v2-generated.py'
REGISTRY = ROOT / 'world-generator' / 'configs' / 'source-registry.json'
MAJOR_ROADS = {
    'motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link',
    'secondary', 'secondary_link', 'tertiary', 'tertiary_link'
}
TAG_KEYS = {
    'settlements': {'name', 'name:ca', 'name:es', 'place', 'population', 'wikidata', 'wikipedia'},
    'buildings': {'name', 'name:ca', 'name:es', 'building', 'building:levels', 'height', 'tourism', 'amenity', 'historic', 'wikidata', 'wikipedia'},
    'roads': {'name', 'name:ca', 'name:es', 'highway', 'bridge', 'tunnel', 'surface', 'access'},
    'landmarks': {'name', 'name:ca', 'name:es', 'building', 'tourism', 'amenity', 'historic', 'heritage', 'man_made', 'natural', 'seamark:type', 'wikidata', 'wikipedia'},
    'ports': {'name', 'name:ca', 'name:es', 'amenity', 'leisure', 'harbour', 'industrial', 'seamark:type', 'wikidata'}
}


def replace_once(source: str, search: str, replacement: str, label: str) -> str:
    count = source.count(search)
    if count != 1:
        raise RuntimeError(f'Expected one {label}, found {count}')
    return source.replace(search, replacement, 1)


def stable_json_bytes(value) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')) + '\n').encode('utf-8')


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def compact_tags(item: dict, category: str) -> dict:
    allowed = TAG_KEYS[category]
    tags = item.get('tags') or {}
    item['tags'] = {key: tags[key] for key in sorted(tags) if key in allowed and tags[key] not in (None, '')}
    return item


def grid_key(position: dict, bounds: dict, columns: int = 18, rows: int = 14) -> tuple[int, int]:
    width = max(1e-9, bounds['east'] - bounds['west'])
    height = max(1e-9, bounds['north'] - bounds['south'])
    x = int((position['lon'] - bounds['west']) / width * columns)
    y = int((position['lat'] - bounds['south']) / height * rows)
    return max(0, min(columns - 1, x)), max(0, min(rows - 1, y))


def compact_buildings(items: list[dict], bounds: dict, per_cell: int = 220) -> list[dict]:
    buckets: dict[tuple[int, int], list[dict]] = {}
    for item in items:
        buckets.setdefault(grid_key(item['position'], bounds), []).append(item)
    selected = []
    for key in sorted(buckets):
        ordered = sorted(
            buckets[key],
            key=lambda item: (
                -int(item.get('priority') or 0),
                -int(bool(item.get('name'))),
                -float(item.get('areaM2') or 0),
                item['sourceId']
            )
        )
        selected.extend(compact_tags(dict(item), 'buildings') for item in ordered[:per_cell])
    return sorted(selected, key=lambda item: item['sourceId'])


def compact_roads(items: list[dict], bounds: dict, minor_per_cell: int = 300) -> list[dict]:
    major = []
    minor: dict[tuple[int, int], list[dict]] = {}
    for item in items:
        points = item.get('points') or []
        if len(points) < 2:
            continue
        copied = compact_tags(dict(item), 'roads')
        if item.get('class') in MAJOR_ROADS:
            major.append(copied)
            continue
        position = {'lon': points[0][0], 'lat': points[0][1]}
        minor.setdefault(grid_key(position, bounds), []).append(copied)
    selected = list(major)
    class_priority = {'residential': 6, 'living_street': 5, 'service': 4, 'track': 3, 'path': 2, 'footway': 1}
    for key in sorted(minor):
        ordered = sorted(
            minor[key],
            key=lambda item: (
                -int(bool(item.get('name'))),
                -class_priority.get(item.get('class'), 0),
                item['sourceId']
            )
        )
        selected.extend(ordered[:minor_per_cell])
    return sorted(selected, key=lambda item: item['sourceId'])


def compact_snapshot(region_id: str) -> None:
    source_directory = ROOT / 'world-generator' / 'sources' / region_id
    snapshot_path = source_directory / 'openstreetmap-extract.json.gz'
    metadata_path = source_directory / 'openstreetmap-extract.json'
    if not snapshot_path.exists() or not metadata_path.exists():
        raise RuntimeError(f'Missing generated OpenStreetMap snapshot for {region_id}')
    with gzip.open(snapshot_path, 'rt', encoding='utf-8') as handle:
        snapshot = json.load(handle)
    metadata = json.loads(metadata_path.read_text(encoding='utf-8'))
    bounds = snapshot['bounds']
    original_counts = {
        key: len(snapshot.get(key, []))
        for key in ('settlements', 'roads', 'buildings', 'landmarks', 'ports')
    }
    snapshot['settlements'] = [compact_tags(dict(item), 'settlements') for item in snapshot.get('settlements', [])]
    snapshot['buildings'] = compact_buildings(snapshot.get('buildings', []), bounds)
    snapshot['roads'] = compact_roads(snapshot.get('roads', []), bounds)
    snapshot['landmarks'] = [compact_tags(dict(item), 'landmarks') for item in snapshot.get('landmarks', [])]
    snapshot['ports'] = [compact_tags(dict(item), 'ports') for item in snapshot.get('ports', [])]
    snapshot['generation']['compaction'] = {
        'mode': 'spatial-priority-v1',
        'gridColumns': 18,
        'gridRows': 14,
        'maximumBuildingsPerCell': 220,
        'maximumMinorRoadsPerCell': 300,
        'majorRoadsPreserved': True,
        'tagFiltering': True,
        'originalCounts': original_counts
    }
    uncompressed = stable_json_bytes(snapshot)
    with open(snapshot_path, 'wb') as raw:
        with gzip.GzipFile(filename='', mode='wb', fileobj=raw, compresslevel=9, mtime=0) as compressed:
            compressed.write(uncompressed)
    compressed = snapshot_path.read_bytes()
    buildings = snapshot['buildings']
    metadata['snapshotBytes'] = len(compressed)
    metadata['snapshotSha256'] = sha256_bytes(compressed)
    metadata['uncompressedBytes'] = len(uncompressed)
    metadata['counts'] = {
        'settlements': len(snapshot['settlements']),
        'roads': len(snapshot['roads']),
        'buildings': len(buildings),
        'hotels': sum(1 for item in buildings if item.get('kind') == 'hotel'),
        'landmarks': len(snapshot['landmarks']),
        'ports': len(snapshot['ports'])
    }
    metadata['compaction'] = snapshot['generation']['compaction']
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, sort_keys=True, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({
        'regionId': region_id,
        'status': 'compacted',
        'snapshotBytes': len(compressed),
        'counts': metadata['counts'],
        'originalCounts': original_counts
    }, ensure_ascii=False, sort_keys=True, indent=2))


def main() -> int:
    registry = json.loads(REGISTRY.read_text(encoding='utf-8'))
    urls = registry.get('openstreetmap')
    if not isinstance(urls, dict) or not urls:
        raise RuntimeError('source-registry.json contains no OpenStreetMap sources')
    region_id = next((arg for arg in sys.argv[1:] if not arg.startswith('-')), 'baleares')
    original = SOURCE.read_text(encoding='utf-8')
    old = "SOURCE_URLS = {\n    'baleares': 'https://download.geofabrik.de/europe/spain/islas-baleares-latest.osm.pbf'\n}"
    replacement = f"SOURCE_URLS = {repr(dict(sorted(urls.items())))}"
    generated = replace_once(original, old, replacement, 'OpenStreetMap source registry')
    TEMPORARY.write_text(generated, encoding='utf-8')
    try:
        result = subprocess.run([sys.executable, str(TEMPORARY), *sys.argv[1:]], cwd=ROOT)
        if result.returncode != 0:
            return result.returncode
        compact_snapshot(region_id)
        return 0
    finally:
        TEMPORARY.unlink(missing_ok=True)


if __name__ == '__main__':
    raise SystemExit(main())
