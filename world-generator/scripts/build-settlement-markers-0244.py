#!/usr/bin/env python3
import argparse
import hashlib
import json
import math
import struct
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / 'world-generator' / '.cache' / 'geonames'
URL = 'https://download.geonames.org/export/dump/cities15000.zip'
ALLOWED_CODES = {'PPL','PPLA','PPLA2','PPLA3','PPLA4','PPLC'}

SPECIAL_IBERIA = [
    {
        'geonameId': 'waft-ayodar', 'name': 'Ayódar', 'asciiName': 'Ayodar',
        'lat': 39.99956587, 'lon': -0.37573917, 'featureCode': 'PPL',
        'admin1': '60', 'admin2': 'CS', 'population': 153, 'modified': '2026-08-09',
        'countryCode': 'ES', 'specialMarker': 'christmas-tree', 'populationException': True,
        'note': 'Lugar especial WAFT · árbol navideño comunitario'
    },
    {
        'geonameId': 'waft-peniscola', 'name': 'Peñíscola', 'asciiName': 'Peniscola',
        'lat': 40.3574021751, 'lon': 0.4069232941, 'featureCode': 'PPL',
        'admin1': '60', 'admin2': 'CS', 'population': 7447, 'modified': '2026-08-09',
        'countryCode': 'ES', 'specialMarker': 'castle', 'populationException': True,
        'note': 'Lugar especial WAFT · Castillo del Papa Luna'
    }
]


def stable_json(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + '\n'


def sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()


def download():
    CACHE.mkdir(parents=True, exist_ok=True)
    target = CACHE / 'cities15000.zip'
    if target.exists() and target.stat().st_size > 1_000_000:
        return target
    request = urllib.request.Request(URL, headers={'User-Agent':'WAFT-world-generator/0.24.4'})
    with urllib.request.urlopen(request, timeout=60) as response:
        target.write_bytes(response.read())
    return target


def parse_countries(raw):
    return {part.strip().upper() for part in raw.split(',') if part.strip()}


def read_geonames(zip_path, countries, bounds, minimum_population, exclude_balearics=False):
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
        country = fields[8].upper()
        if country not in countries or population < minimum_population:
            continue
        if fields[6] != 'P' or fields[7] not in ALLOWED_CODES:
            continue
        if not (bounds['south'] <= lat <= bounds['north'] and bounds['west'] <= lon <= bounds['east']):
            continue
        # Iberia's regional city layer intentionally leaves Balearic towns to their island/local layers.
        if exclude_balearics and lon > 1.0 and lat < 40.3:
            continue
        rows.append({
            'geonameId': fields[0], 'name': fields[1], 'asciiName': fields[2],
            'lat': lat, 'lon': lon, 'featureCode': fields[7],
            'admin1': fields[10], 'admin2': fields[11],
            'population': population, 'modified': fields[18], 'countryCode': country
        })
    seen = set(); result = []
    for item in sorted(rows, key=lambda x: (-x['population'], x['name'].casefold(), x['geonameId'])):
        key = (item['name'].casefold(), round(item['lat'], 2), round(item['lon'], 2))
        if key in seen:
            continue
        seen.add(key); result.append(item)
    return sorted(result, key=lambda x: (x['name'].casefold(), x['geonameId']))


def terrain_sampler(region_dir):
    manifest = json.loads((region_dir / 'manifest.json').read_text('utf-8'))
    data = (region_dir / 'terrain.bin').read_bytes()
    if data[:8] != b'WAFTHGT1':
        raise RuntimeError(f'Invalid terrain magic for {region_dir.name}')
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
    cols = max(1, math.ceil((bounds['maxX'] - bounds['minX']) / size))
    rows = max(1, math.ceil((bounds['maxZ'] - bounds['minZ']) / size))
    col = max(0, min(cols - 1, int((x - bounds['minX']) // size)))
    row = max(0, min(rows - 1, int((z - bounds['minZ']) // size)))
    return f's-{col:02d}-{row:02d}'


def tier(population):
    if population < 50_000:
        return 'small', 48, .26, 18
    if population < 200_000:
        return 'medium', 72, .42, 34
    return 'large', 100, .68, 58


def capital_level(feature_code):
    if feature_code == 'PPLC': return 'national'
    if feature_code == 'PPLA': return 'regional'
    if feature_code == 'PPLA2': return 'provincial'
    return None


def capital_style(level, priority, half, height):
    if level == 'national': return max(priority,120), max(half,.82), max(height,90)
    if level == 'regional': return max(priority,106), max(half,.62), max(height,72)
    if level == 'provincial': return max(priority,86), max(half,.50), max(height,54)
    return priority, half, height


def fictional_war_impact(population, key, capital=None):
    seed = int(hashlib.sha256(str(key).encode('utf-8')).hexdigest()[:8], 16) / 0xffffffff
    if capital == 'national': lo, hi = .93, .988
    elif population >= 200_000: lo, hi = .70, .95
    elif population >= 50_000: lo, hi = .53, .87
    elif population >= 20_000: lo, hi = .38, .76
    else: lo, hi = .18, .58
    rate = lo + (hi - lo) * seed
    deaths = min(population, max(0, round(population * rate)))
    return {
        'fictional': True,
        'scenario': 'WAFT-nuclear-war',
        'nuclearWarDeaths': deaths,
        'survivorsImmediatelyAfter': population - deaths,
        'rate': round(rate, 4)
    }


def special_style(item, priority, half, height):
    marker = item.get('specialMarker')
    if marker == 'christmas-tree': return max(priority,92), max(half,.32), max(height,30)
    if marker == 'castle': return max(priority,96), max(half,.56), max(height,46)
    if marker == 'rock': return max(priority,100), max(half,.50), max(height,58)
    return priority, half, height


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('region_id')
    parser.add_argument('--countries', required=True)
    parser.add_argument('--minimum-population', type=int, default=20_000)
    parser.add_argument('--exclude-balearics', action='store_true')
    args = parser.parse_args()

    region_dir = ROOT / 'regions' / args.region_id
    config = json.loads((ROOT / 'world-generator' / 'configs' / f'{args.region_id}.region.json').read_text('utf-8'))
    countries = parse_countries(args.countries)
    zip_path = download()
    rows = read_geonames(zip_path, countries, config['geography']['bounds'], args.minimum_population, args.exclude_balearics)
    if args.region_id == 'iberia':
        # Keep user's meaningful small places even though they deliberately sit below the regional 20k threshold.
        rows.extend(SPECIAL_IBERIA)
        for item in rows:
            if item.get('countryCode') == 'GI' or item['name'].casefold() == 'gibraltar':
                item['specialMarker'] = 'rock'; item['populationException'] = True
        rows = sorted(rows, key=lambda x: (x['name'].casefold(), str(x['geonameId'])))

    manifest, project, elevation_at = terrain_sampler(region_dir)
    settlements, objects = [], []
    seen_ids = set()
    for item in rows:
        ident = f"{item.get('countryCode','xx').lower()}-{item['geonameId']}"
        if ident in seen_ids: continue
        seen_ids.add(ident)
        x, z = project(item['lat'], item['lon']); y = elevation_at(item['lat'], item['lon'])
        level, priority, half, height = tier(item['population'])
        capital = capital_level(item['featureCode'])
        priority, half, height = capital_style(capital, priority, half, height)
        priority, half, height = special_style(item, priority, half, height)
        sid = sector_id(x, z, manifest)
        war = fictional_war_impact(item['population'], item['geonameId'], capital)
        settlement = {
            'id': ident,
            'local': {'x': round(x,4), 'y': y, 'z': round(z,4)},
            'name': item['name'], 'place': item['featureCode'], 'population': item['population'],
            'populationTier': level, 'capitalLevel': capital,
            'position': {'lat': item['lat'], 'lon': item['lon']},
            'priority': priority, 'protected': True, 'sectorId': sid,
            'source': 'waft-special' if item.get('populationException') else 'geonames-cities15000',
            'sourceId': item['geonameId'], 'terrainStatus': 'dem-cell',
            'countryCode': item.get('countryCode'), 'warImpact': war
        }
        if item.get('populationException'): settlement['populationException'] = True
        if item.get('specialMarker'): settlement['specialMarker'] = item['specialMarker']
        if item.get('note'): settlement['note'] = item['note']
        settlements.append(settlement)

        # Special WAFT places use their dedicated local icon/landmark layer. Turning a tiny
        # footprint into a generic building created the long needle/tower artefacts seen in 0.24.4.
        if not item.get('specialMarker'):
            footprint = [[round(x-half,4),round(z-half,4)],[round(x+half,4),round(z-half,4)],[round(x+half,4),round(z+half,4)],[round(x-half,4),round(z+half,4)],[round(x-half,4),round(z-half,4)]]
            tags = {
                'population': str(item['population']), 'waft:population_tier': level,
                'waft:nuclear_war_deaths': str(war['nuclearWarDeaths']), 'waft:lore': 'fictional'
            }
            if capital: tags['waft:capital_level'] = capital
            objects.append({
                'areaM2': None, 'collisionMode': 'none', 'footprint': footprint, 'heightMeters': height,
                'id': f'marker-{ident}', 'kind': 'public', 'local': {'x':round(x,4),'y':y,'z':round(z,4)},
                'name': item['name'], 'position': {'lat':item['lat'],'lon':item['lon']}, 'priority': priority,
                'roofWalkable': False, 'scaleY': 1, 'sectorId': sid,
                'source': settlement['source'], 'sourceId': item['geonameId'], 'tags': tags, 'terrainStatus':'dem-cell'
            })

    source = {
        'provider': 'GeoNames + WAFT manual exceptions', 'dataset': 'cities15000', 'url': URL,
        'license': 'GeoNames CC BY 4.0; WAFT manual metadata', 'retrievedOn': '2026-08-09',
        'minimumPopulation': args.minimum_population, 'countries': sorted(countries), 'regionId': args.region_id,
        'fictionalWarImpact': True
    }
    settlement_doc = {'formatVersion':1,'generationStage':'population-war-lore-markers-0244','regionId':args.region_id,'source':source,'items':settlements}
    object_doc = {'discardedBuildings':{},'formatVersion':1,'generatedBuildingsPending':False,'generationStage':'population-war-lore-markers-0244','regionId':args.region_id,'source':source,'items':objects}
    settlement_bytes=stable_json(settlement_doc).encode('utf-8'); object_bytes=stable_json(object_doc).encode('utf-8')
    (region_dir/'settlements.json').write_bytes(settlement_bytes); (region_dir/'objects.json').write_bytes(object_bytes)
    manifest['content']['settlements']=len(settlements); manifest['content']['generatedBuildings']=len(objects)
    manifest['settlementMarkers']={
        'minimumPopulation':args.minimum_population,
        'tiers':{'small':[20000,49999],'medium':[50000,199999],'large':[200000,None]},
        'manualPopulationExceptions':sum(1 for item in settlements if item.get('populationException')),
        'fictionalWarImpact':True,
        'source':source
    }
    for filename,raw in [('settlements.json',settlement_bytes),('objects.json',object_bytes)]:
        record=next((entry for entry in manifest['files'] if entry['path']==filename),None)
        if record is None: record={'path':filename};manifest['files'].append(record)
        record['bytes']=len(raw);record['sha256']=sha256_bytes(raw)
    (region_dir/'manifest.json').write_text(stable_json(manifest),'utf-8')
    counts={'small':0,'medium':0,'large':0}; specials=[]
    for item in settlements:
        counts[item['populationTier']]+=1
        if item.get('specialMarker'): specials.append(item['name'])
    print(json.dumps({'regionId':args.region_id,'settlements':len(settlements),'tiers':counts,'specials':specials,'minPopulation':args.minimum_population,'sourceSha256':sha256_bytes(zip_path.read_bytes())},ensure_ascii=False,indent=2))

if __name__=='__main__':
    main()