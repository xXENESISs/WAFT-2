#!/usr/bin/env python3
import hashlib
import io
import json
import math
import os
import struct
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REGION = ROOT / 'regions' / 'iberia'
CACHE = ROOT / 'world-generator' / '.cache' / 'geonames'
URL = 'https://download.geonames.org/export/dump/cities15000.zip'
MIN_POPULATION = 20_000
ALLOWED_CODES = {'PPL','PPLA','PPLA2','PPLA3','PPLA4','PPLC'}


def stable_json(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + '\n'


def sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()


def download():
    CACHE.mkdir(parents=True, exist_ok=True)
    target = CACHE / 'cities15000.zip'
    if target.exists() and target.stat().st_size > 1_000_000:
        return target
    request = urllib.request.Request(URL, headers={'User-Agent':'WAFT-world-generator/0.24.2'})
    with urllib.request.urlopen(request, timeout=60) as response:
        target.write_bytes(response.read())
    return target


def read_geonames(zip_path):
    with zipfile.ZipFile(zip_path) as archive:
        name = next(n for n in archive.namelist() if n.endswith('.txt'))
        text = archive.read(name).decode('utf-8')
    rows = []
    for line in text.splitlines():
        fields = line.split('\t')
        if len(fields) < 19:
            continue
        try:
            population = int(fields[14] or '0')
            lat = float(fields[4]); lon = float(fields[5])
        except ValueError:
            continue
        if fields[8] != 'ES' or population < MIN_POPULATION:
            continue
        if fields[6] != 'P' or fields[7] not in ALLOWED_CODES:
            continue
        # Iberian mainland only. Canary Islands fall south of the terrain;
        # Balearic islands are a separate WAFT regional runtime.
        if lat < 36.0 or lat > 43.8 or lon < -9.6 or lon > 3.35:
            continue
        if lon > 1.0 and lat < 40.3:
            continue
        rows.append({
            'geonameId': fields[0], 'name': fields[1], 'asciiName': fields[2],
            'lat': lat, 'lon': lon, 'featureCode': fields[7],
            'admin1': fields[10], 'admin2': fields[11],
            'population': population, 'modified': fields[18]
        })
    # GeoNames can contain multiple populated-place records for the same urban nucleus.
    # Keep only one record when normalized name + very-close coordinates coincide.
    seen = set(); result = []
    for item in sorted(rows, key=lambda x: (-x['population'], x['name'].casefold(), x['geonameId'])):
        key = (item['name'].casefold(), round(item['lat'], 2), round(item['lon'], 2))
        if key in seen:
            continue
        seen.add(key); result.append(item)
    return sorted(result, key=lambda x: (x['name'].casefold(), x['geonameId']))


def terrain_sampler():
    manifest = json.loads((REGION / 'manifest.json').read_text('utf-8'))
    data = (REGION / 'terrain.bin').read_bytes()
    if data[:8] != b'WAFTHGT1':
        raise RuntimeError('Invalid Iberia terrain magic')
    header_bytes, columns, rows = struct.unpack_from('<HHH', data, 10)
    west, east, south, north = struct.unpack_from('<dddd', data, 16)
    nodata = struct.unpack_from('<i', data, 56)[0]
    projection = manifest['projection']
    def local(lat, lon):
        x = (lon - projection['origin']['lon']) * projection['kmPerDegreeLon'] * projection['unitsPerKm']
        z = -(lat - projection['origin']['lat']) * projection['kmPerDegreeLat'] * projection['unitsPerKm']
        return x, z
    def elevation_at(lat, lon):
        col = max(0, min(columns - 1, round((lon - west) / (east - west) * (columns - 1))))
        # Terrain rows are north -> south.
        row = max(0, min(rows - 1, round((north - lat) / (north - south) * (rows - 1))))
        value = struct.unpack_from('<h', data, header_bytes + (row * columns + col) * 2)[0]
        if value == nodata:
            for radius in range(1, 5):
                for dy in range(-radius, radius + 1):
                    for dx in range(-radius, radius + 1):
                        cx, cy = col + dx, row + dy
                        if cx < 0 or cy < 0 or cx >= columns or cy >= rows:
                            continue
                        candidate = struct.unpack_from('<h', data, header_bytes + (cy * columns + cx) * 2)[0]
                        if candidate != nodata:
                            return candidate
            return 0
        return value
    return manifest, local, elevation_at


def sector_id(x, z, manifest):
    bounds = manifest['projection']['localBounds']
    size = 64
    col = max(0, min(25, int((x - bounds['minX']) // size)))
    row = max(0, min(20, int((z - bounds['minZ']) // size)))
    return f's-{col:02d}-{row:02d}'


def tier(population):
    if population < 50_000:
        return 'small', 48, .26, 18
    if population < 200_000:
        return 'medium', 72, .42, 34
    return 'large', 100, .68, 58


def main():
    zip_path = download()
    rows = read_geonames(zip_path)
    manifest, project, elevation_at = terrain_sampler()
    settlements = []
    objects = []
    for item in rows:
        x, z = project(item['lat'], item['lon'])
        y = elevation_at(item['lat'], item['lon'])
        level, priority, half, height = tier(item['population'])
        sid = sector_id(x, z, manifest)
        ident = f"es-{item['geonameId']}"
        settlements.append({
            'id': ident,
            'local': {'x': round(x,4), 'y': y, 'z': round(z,4)},
            'name': item['name'],
            'place': item['featureCode'],
            'population': item['population'],
            'populationTier': level,
            'position': {'lat': item['lat'], 'lon': item['lon']},
            'priority': priority,
            'protected': True,
            'sectorId': sid,
            'source': 'geonames-cities15000',
            'sourceId': item['geonameId'],
            'terrainStatus': 'dem-cell'
        })
        footprint = [
            [round(x-half,4), round(z-half,4)], [round(x+half,4), round(z-half,4)],
            [round(x+half,4), round(z+half,4)], [round(x-half,4), round(z+half,4)],
            [round(x-half,4), round(z-half,4)]
        ]
        objects.append({
            'areaM2': None,
            'collisionMode': 'none',
            'footprint': footprint,
            'heightMeters': height,
            'id': f'city-marker-{item["geonameId"]}',
            'kind': 'public',
            'local': {'x': round(x,4), 'y': y, 'z': round(z,4)},
            'name': item['name'],
            'position': {'lat': item['lat'], 'lon': item['lon']},
            'priority': priority,
            'roofWalkable': False,
            'scaleY': 1,
            'sectorId': sid,
            'source': 'geonames-cities15000',
            'sourceId': item['geonameId'],
            'tags': {'population': str(item['population']), 'waft:population_tier': level},
            'terrainStatus': 'dem-cell'
        })

    source = {
        'provider': 'GeoNames', 'dataset': 'cities15000', 'url': URL,
        'license': 'CC BY 4.0', 'retrievedOn': '2026-08-09',
        'minimumPopulation': MIN_POPULATION, 'country': 'ES', 'scope': 'Iberian mainland'
    }
    settlement_doc = {
        'formatVersion': 1, 'generationStage': 'geonames-population-markers',
        'regionId': 'iberia', 'source': source, 'items': settlements
    }
    object_doc = {
        'discardedBuildings': {}, 'formatVersion': 1, 'generatedBuildingsPending': False,
        'generationStage': 'geonames-population-markers', 'regionId': 'iberia',
        'source': source, 'items': objects
    }
    settlement_bytes = stable_json(settlement_doc).encode('utf-8')
    object_bytes = stable_json(object_doc).encode('utf-8')
    (REGION / 'settlements.json').write_bytes(settlement_bytes)
    (REGION / 'objects.json').write_bytes(object_bytes)

    manifest['content']['settlements'] = len(settlements)
    manifest['content']['generatedBuildings'] = len(objects)
    manifest['settlementMarkers'] = {
        'minimumPopulation': MIN_POPULATION,
        'tiers': {'small':[20000,49999], 'medium':[50000,199999], 'large':[200000,None]},
        'source': source
    }
    for filename, raw in [('settlements.json', settlement_bytes), ('objects.json', object_bytes)]:
        record = next((entry for entry in manifest['files'] if entry['path'] == filename), None)
        if record is None:
            record = {'path': filename}; manifest['files'].append(record)
        record['bytes'] = len(raw); record['sha256'] = sha256_bytes(raw)
    (REGION / 'manifest.json').write_text(stable_json(manifest), 'utf-8')

    counts = {'small':0,'medium':0,'large':0}
    for item in settlements: counts[item['populationTier']] += 1
    print(json.dumps({'regionId':'iberia','settlements':len(settlements),'tiers':counts,'minPopulation':MIN_POPULATION,'sourceSha256':sha256_bytes(zip_path.read_bytes())}, indent=2))

if __name__ == '__main__':
    main()
