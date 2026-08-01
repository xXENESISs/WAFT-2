#!/usr/bin/env python3
import argparse
import datetime as dt
import gzip
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import sys
import tempfile
import urllib.request

try:
    import osmium
except ImportError as exc:
    raise SystemExit('pyosmium is required: python -m pip install osmium') from exc

ROOT = Path(__file__).resolve().parents[2]
SOURCE_URLS = {
    'baleares': 'https://download.geofabrik.de/europe/spain/islas-baleares-latest.osm.pbf'
}
PLACE_TYPES = {'city', 'town', 'village', 'suburb', 'quarter', 'neighbourhood', 'hamlet', 'locality', 'island'}
ROAD_TYPES = {
    'motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link',
    'secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'residential',
    'living_street', 'unclassified', 'service', 'track', 'path', 'footway',
    'cycleway', 'bridleway', 'pedestrian', 'steps'
}
KEEP_TAGS = {
    'name', 'name:ca', 'name:es', 'name:en', 'alt_name', 'official_name', 'short_name',
    'place', 'population', 'capital', 'admin_level', 'boundary',
    'highway', 'surface', 'tracktype', 'smoothness', 'lanes', 'maxspeed', 'oneway',
    'bridge', 'tunnel', 'layer', 'access', 'foot', 'bicycle', 'horse', 'motor_vehicle',
    'building', 'building:part', 'building:levels', 'building:min_level', 'height', 'min_height',
    'roof:shape', 'roof:levels', 'roof:height', 'roof:material', 'building:material',
    'tourism', 'amenity', 'historic', 'man_made', 'leisure', 'industrial', 'harbour',
    'seamark:type', 'seamark:name', 'religion', 'denomination', 'tower:type',
    'castle_type', 'ruins', 'memorial', 'heritage', 'heritage:operator',
    'wikidata', 'wikipedia', 'website', 'operator', 'brand', 'stars',
    'natural', 'waterway', 'water', 'landuse', 'aeroway', 'railway', 'public_transport'
}


def read_json(path):
    with open(path, 'r', encoding='utf-8') as handle:
        return json.load(handle)


def stable_json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')) + '\n').encode('utf-8')


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def copy_tags(tags):
    return {key: value for key, value in tags if key in KEEP_TAGS or key.startswith('addr:')}


def preferred_name(tags):
    return tags.get('name:ca') or tags.get('name') or tags.get('name:es') or tags.get('official_name') or tags.get('seamark:name')


def parse_number(value):
    if value is None:
        return None
    text = str(value).strip().lower().replace(',', '.')
    for suffix in (' metres', ' meters', ' metre', ' meter', ' m'):
        if text.endswith(suffix):
            text = text[:-len(suffix)].strip()
            break
    try:
        result = float(text)
        return result if math.isfinite(result) else None
    except ValueError:
        return None


def parse_population(value):
    if not value:
        return None
    digits = ''.join(character for character in str(value) if character.isdigit())
    return int(digits) if digits else None


def point_in_bounds(lon, lat, bounds, margin=0.02):
    return bounds['west'] - margin <= lon <= bounds['east'] + margin and bounds['south'] - margin <= lat <= bounds['north'] + margin


def point_segment_distance_m(point, start, end):
    lon, lat = point
    mean_lat = math.radians((lat + start[1] + end[1]) / 3)
    sx = (start[0] - lon) * 111320 * math.cos(mean_lat)
    sy = (start[1] - lat) * 111132
    ex = (end[0] - lon) * 111320 * math.cos(mean_lat)
    ey = (end[1] - lat) * 111132
    vx = ex - sx
    vy = ey - sy
    denominator = vx * vx + vy * vy
    if denominator == 0:
        return math.hypot(sx, sy)
    t = max(0.0, min(1.0, -(sx * vx + sy * vy) / denominator))
    return math.hypot(sx + vx * t, sy + vy * t)


def simplify_line(points, tolerance_m):
    if len(points) <= 2 or tolerance_m <= 0:
        return points
    first = points[0]
    last = points[-1]
    maximum = -1.0
    split = -1
    for index in range(1, len(points) - 1):
        distance = point_segment_distance_m(points[index], first, last)
        if distance > maximum:
            maximum = distance
            split = index
    if maximum > tolerance_m:
        left = simplify_line(points[:split + 1], tolerance_m)
        right = simplify_line(points[split:], tolerance_m)
        return left[:-1] + right
    return [first, last]


def signed_area(points):
    if len(points) < 3:
        return 0.0
    mean_lat = math.radians(sum(point[1] for point in points) / len(points))
    scale_x = 111320 * math.cos(mean_lat)
    scale_y = 111132
    total = 0.0
    for index, current in enumerate(points):
        previous = points[index - 1]
        total += previous[0] * scale_x * current[1] * scale_y - current[0] * scale_x * previous[1] * scale_y
    return total * 0.5


def polygon_centroid(points):
    if not points:
        return None
    ring = points[:-1] if len(points) > 2 and points[0] == points[-1] else points
    if not ring:
        return None
    mean_lat = math.radians(sum(point[1] for point in ring) / len(ring))
    scale_x = 111320 * math.cos(mean_lat)
    scale_y = 111132
    area_twice = 0.0
    x_sum = 0.0
    y_sum = 0.0
    for index, current in enumerate(ring):
        previous = ring[index - 1]
        x1, y1 = previous[0] * scale_x, previous[1] * scale_y
        x2, y2 = current[0] * scale_x, current[1] * scale_y
        cross = x1 * y2 - x2 * y1
        area_twice += cross
        x_sum += (x1 + x2) * cross
        y_sum += (y1 + y2) * cross
    if abs(area_twice) < 1e-6:
        return {'lon': sum(point[0] for point in ring) / len(ring), 'lat': sum(point[1] for point in ring) / len(ring)}
    factor = 1.0 / (3.0 * area_twice)
    return {'lon': x_sum * factor / scale_x, 'lat': y_sum * factor / scale_y}


def normalize_ring(points, tolerance_m=1.4, maximum_points=28):
    cleaned = []
    for lon, lat in points:
        point = [round(float(lon), 7), round(float(lat), 7)]
        if not cleaned or point != cleaned[-1]:
            cleaned.append(point)
    if len(cleaned) < 3:
        return None
    if cleaned[0] != cleaned[-1]:
        cleaned.append(cleaned[0])
    open_ring = cleaned[:-1]
    simplified = simplify_line(open_ring + [open_ring[0]], tolerance_m)
    if simplified[0] == simplified[-1]:
        simplified = simplified[:-1]
    while len(simplified) > maximum_points:
        simplified = simplified[::2]
    if len(simplified) < 3:
        simplified = open_ring[:maximum_points]
    simplified.append(simplified[0])
    return simplified


def bbox(points):
    return {
        'west': min(point[0] for point in points),
        'east': max(point[0] for point in points),
        'south': min(point[1] for point in points),
        'north': max(point[1] for point in points)
    }


def infer_landmark_type(tags):
    historic = tags.get('historic')
    building = tags.get('building')
    amenity = tags.get('amenity')
    tourism = tags.get('tourism')
    man_made = tags.get('man_made')
    natural = tags.get('natural')
    if historic in {'castle', 'fort', 'fortress'} or building in {'castle', 'fortress'}:
        return 'castle' if historic == 'castle' or building == 'castle' else 'fortress'
    if man_made == 'lighthouse' or tags.get('seamark:type') == 'light_major':
        return 'lighthouse'
    if building == 'cathedral':
        return 'cathedral'
    if building in {'church', 'chapel', 'basilica'} or amenity == 'place_of_worship':
        return 'church'
    if building in {'monastery', 'convent'} or amenity == 'monastery':
        return 'monastery'
    if historic == 'palace' or building == 'palace':
        return 'palace'
    if historic in {'archaeological_site', 'ruins'}:
        return 'archaeological_site'
    if historic in {'monument', 'memorial'} or tourism == 'artwork':
        return 'monument'
    if man_made in {'tower', 'communications_tower', 'water_tower'} or building == 'tower':
        return 'tower'
    if natural in {'peak', 'cave_entrance', 'arch', 'cliff', 'rock'} or tourism == 'viewpoint':
        return 'natural_landmark'
    if tourism == 'attraction' and preferred_name(tags):
        return 'monument'
    return None


def landmark_score(tags, landmark_type):
    base = {
        'castle': 72,
        'fortress': 68,
        'cathedral': 78,
        'church': 24,
        'monastery': 52,
        'lighthouse': 68,
        'palace': 48,
        'tower': 31,
        'monument': 35,
        'archaeological_site': 46,
        'natural_landmark': 34
    }.get(landmark_type, 15)
    if preferred_name(tags):
        base += 8
    if tags.get('wikidata'):
        base += 15
    if tags.get('wikipedia'):
        base += 12
    if tags.get('heritage'):
        base += 8
    if tags.get('tourism') == 'attraction':
        base += 7
    if tags.get('historic') in {'castle', 'fort', 'archaeological_site', 'ruins'}:
        base += 4
    return min(100, base)


def is_port(tags):
    return (
        tags.get('amenity') == 'ferry_terminal'
        or tags.get('leisure') == 'marina'
        or tags.get('harbour') in {'yes', 'port'}
        or tags.get('industrial') == 'port'
        or tags.get('seamark:type') in {'harbour', 'harbour_basin'}
    )


def port_type(tags):
    if tags.get('amenity') == 'ferry_terminal':
        return 'ferry-terminal'
    if tags.get('leisure') == 'marina':
        return 'marina'
    return 'port'


def is_building(tags):
    value = tags.get('building')
    return bool(value and value not in {'no', 'construction', 'collapsed'} and not tags.get('building:part'))


def building_kind(tags):
    if tags.get('tourism') in {'hotel', 'hostel', 'guest_house', 'apartment', 'motel', 'resort'} or tags.get('building') == 'hotel':
        return 'hotel'
    if tags.get('amenity') == 'place_of_worship' or tags.get('building') in {'church', 'cathedral', 'chapel', 'mosque', 'synagogue', 'temple'}:
        return 'religious'
    if tags.get('historic') or tags.get('building') in {'castle', 'fortress', 'palace'}:
        return 'historic'
    if tags.get('amenity') in {'school', 'university', 'hospital', 'townhall', 'fire_station', 'police'}:
        return 'public'
    if tags.get('building') in {'industrial', 'warehouse', 'commercial', 'retail'}:
        return 'commercial'
    return 'ordinary'


def building_priority(tags, area_m2):
    kind = building_kind(tags)
    score = {'hotel': 1000, 'historic': 950, 'religious': 850, 'public': 750, 'commercial': 420, 'ordinary': 100}[kind]
    if preferred_name(tags):
        score += 180
    if tags.get('wikidata'):
        score += 120
    score += min(200, int(math.sqrt(max(0.0, area_m2))))
    return score


def osm_identifier(prefix, object_id):
    return f'{prefix}{int(object_id)}'


class OSMCollector(osmium.SimpleHandler):
    def __init__(self, bounds, road_simplification_m):
        super().__init__()
        self.bounds = bounds
        self.road_simplification_m = road_simplification_m
        self.settlements = []
        self.roads = []
        self.buildings = []
        self.landmarks = []
        self.ports = []
        self.statistics = {
            'nodesSeen': 0,
            'waysSeen': 0,
            'relationsSeen': 0,
            'areasSeen': 0,
            'invalidGeometries': 0
        }
        self.geojson_factory = osmium.geom.GeoJSONFactory()

    def node(self, node):
        self.statistics['nodesSeen'] += 1
        if not node.location.valid():
            return
        lon = float(node.location.lon)
        lat = float(node.location.lat)
        if not point_in_bounds(lon, lat, self.bounds):
            return
        tags = copy_tags(node.tags)
        position = {'lon': round(lon, 7), 'lat': round(lat, 7)}
        source_id = osm_identifier('n', node.id)
        place = tags.get('place')
        if place in PLACE_TYPES and preferred_name(tags):
            self.settlements.append({
                'sourceId': source_id,
                'name': preferred_name(tags),
                'place': place,
                'position': position,
                'population': parse_population(tags.get('population')),
                'tags': tags
            })
        landmark_type = infer_landmark_type(tags)
        if landmark_type:
            self.landmarks.append({
                'sourceId': source_id,
                'name': preferred_name(tags),
                'type': landmark_type,
                'position': position,
                'score': landmark_score(tags, landmark_type),
                'geometryType': 'point',
                'tags': tags
            })
        if is_port(tags):
            self.ports.append({
                'sourceId': source_id,
                'name': preferred_name(tags),
                'type': port_type(tags),
                'position': position,
                'geometryType': 'point',
                'tags': tags
            })

    def way(self, way):
        self.statistics['waysSeen'] += 1
        tags = copy_tags(way.tags)
        highway = tags.get('highway')
        coordinates = []
        try:
            for node in way.nodes:
                if node.location.valid():
                    coordinates.append([round(float(node.lon), 7), round(float(node.lat), 7)])
        except (osmium.InvalidLocationError, RuntimeError):
            self.statistics['invalidGeometries'] += 1
            return
        if highway in ROAD_TYPES and len(coordinates) >= 2:
            simplified = simplify_line(coordinates, self.road_simplification_m)
            if len(simplified) >= 2:
                self.roads.append({
                    'sourceId': osm_identifier('w', way.id),
                    'name': preferred_name(tags),
                    'class': highway,
                    'points': simplified,
                    'tags': tags
                })
        if len(coordinates) < 3 or coordinates[0] != coordinates[-1]:
            return
        ring = normalize_ring(coordinates)
        if not ring:
            self.statistics['invalidGeometries'] += 1
            return
        self._collect_area(osm_identifier('w', way.id), tags, ring)

    def relation(self, relation):
        self.statistics['relationsSeen'] += 1

    def area(self, area):
        self.statistics['areasSeen'] += 1
        if area.from_way():
            return
        tags = copy_tags(area.tags)
        if not (is_building(tags) or tags.get('place') in PLACE_TYPES or infer_landmark_type(tags) or is_port(tags)):
            return
        try:
            geometry = json.loads(self.geojson_factory.create_multipolygon(area))
            polygons = geometry.get('coordinates') or []
            candidates = []
            for polygon in polygons:
                if not polygon:
                    continue
                ring = normalize_ring(polygon[0])
                if ring:
                    candidates.append(ring)
            if not candidates:
                self.statistics['invalidGeometries'] += 1
                return
            ring = max(candidates, key=lambda candidate: abs(signed_area(candidate)))
            self._collect_area(osm_identifier('r', area.orig_id()), tags, ring)
        except (RuntimeError, ValueError, TypeError, json.JSONDecodeError):
            self.statistics['invalidGeometries'] += 1

    def _collect_area(self, source_id, tags, ring):
        center = polygon_centroid(ring)
        if not center or not point_in_bounds(center['lon'], center['lat'], self.bounds):
            return
        area_m2 = abs(signed_area(ring))
        if area_m2 < 2:
            return
        extent = bbox(ring)
        if tags.get('place') in PLACE_TYPES and preferred_name(tags):
            self.settlements.append({
                'sourceId': source_id,
                'name': preferred_name(tags),
                'place': tags.get('place'),
                'position': center,
                'population': parse_population(tags.get('population')),
                'boundary': ring,
                'areaM2': round(area_m2, 2),
                'tags': tags
            })
        if is_building(tags):
            self.buildings.append({
                'sourceId': source_id,
                'name': preferred_name(tags),
                'kind': building_kind(tags),
                'position': center,
                'footprint': ring,
                'bbox': extent,
                'areaM2': round(area_m2, 2),
                'priority': building_priority(tags, area_m2),
                'heightMeters': parse_number(tags.get('height')),
                'levels': parse_number(tags.get('building:levels')),
                'tags': tags
            })
        landmark_type = infer_landmark_type(tags)
        if landmark_type:
            self.landmarks.append({
                'sourceId': source_id,
                'name': preferred_name(tags),
                'type': landmark_type,
                'position': center,
                'score': landmark_score(tags, landmark_type),
                'geometryType': 'polygon',
                'footprint': ring,
                'areaM2': round(area_m2, 2),
                'tags': tags
            })
        if is_port(tags):
            self.ports.append({
                'sourceId': source_id,
                'name': preferred_name(tags),
                'type': port_type(tags),
                'position': center,
                'geometryType': 'polygon',
                'footprint': ring,
                'areaM2': round(area_m2, 2),
                'tags': tags
            })


def dedupe_points(items, maximum_distance_m=35):
    ordered = sorted(items, key=lambda item: (-int(bool(item.get('name'))), item['sourceId']))
    accepted = []
    seen_sources = set()
    for item in ordered:
        if item['sourceId'] in seen_sources:
            continue
        duplicate = False
        for previous in accepted[-400:]:
            if item.get('name') and previous.get('name') and item['name'].casefold() != previous['name'].casefold():
                continue
            distance = point_segment_distance_m(
                [item['position']['lon'], item['position']['lat']],
                [previous['position']['lon'], previous['position']['lat']],
                [previous['position']['lon'], previous['position']['lat']]
            )
            if distance <= maximum_distance_m:
                duplicate = True
                break
        if not duplicate:
            accepted.append(item)
            seen_sources.add(item['sourceId'])
    return sorted(accepted, key=lambda item: item['sourceId'])


def dedupe_areas(items):
    ordered = sorted(items, key=lambda item: (-item.get('priority', item.get('score', 0)), item['sourceId']))
    accepted = []
    buckets = set()
    for item in ordered:
        position = item['position']
        key = (
            round(position['lon'], 5),
            round(position['lat'], 5),
            (item.get('name') or '').casefold(),
            item.get('kind') or item.get('type') or ''
        )
        if key in buckets:
            continue
        buckets.add(key)
        accepted.append(item)
    return sorted(accepted, key=lambda item: item['sourceId'])


def pbf_header_timestamp(path):
    try:
        reader = osmium.io.Reader(str(path))
        header = reader.header()
        value = header.get('osmosis_replication_timestamp') or header.get('timestamp')
        reader.close()
        return value or None
    except Exception:
        return None


def download(url, destination):
    destination.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(url, headers={'User-Agent': 'WAFT-World-Generator/0.2 (+https://github.com/xXENESISs/WAFT-2)'})
    with urllib.request.urlopen(request, timeout=180) as response, tempfile.NamedTemporaryFile(delete=False, dir=destination.parent) as temporary:
        shutil.copyfileobj(response, temporary)
        temporary_path = Path(temporary.name)
        headers = dict(response.headers.items())
    temporary_path.replace(destination)
    return headers


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('region_id', nargs='?', default='baleares')
    parser.add_argument('--retrieved-on', default=dt.datetime.now(dt.timezone.utc).date().isoformat())
    parser.add_argument('--force', action='store_true')
    args = parser.parse_args()

    config_path = ROOT / 'world-generator' / 'configs' / f'{args.region_id}.region.json'
    config = read_json(config_path)
    source_url = SOURCE_URLS.get(args.region_id)
    if not source_url:
        raise SystemExit(f'No OpenStreetMap source URL configured for {args.region_id}')
    source_directory = ROOT / 'world-generator' / 'sources' / args.region_id
    snapshot_path = source_directory / 'openstreetmap-extract.json.gz'
    metadata_path = source_directory / 'openstreetmap-extract.json'
    if snapshot_path.exists() and metadata_path.exists() and not args.force:
        print(json.dumps({'regionId': args.region_id, 'status': 'reused', 'snapshot': str(snapshot_path.relative_to(ROOT))}, sort_keys=True))
        return

    cache_directory = ROOT / 'world-generator' / '.cache' / 'openstreetmap'
    pbf_path = cache_directory / f'{args.region_id}.osm.pbf'
    response_headers = {}
    if not pbf_path.exists() or args.force:
        response_headers = download(source_url, pbf_path)

    bounds = config['geography']['bounds']
    simplification = float(config['generation']['transport']['simplificationMeters'])
    collector = OSMCollector(bounds, simplification)
    collector.apply_file(str(pbf_path), locations=True, idx='flex_mem')

    settlements = dedupe_points(collector.settlements, 80)
    buildings = dedupe_areas(collector.buildings)
    landmarks = dedupe_areas(collector.landmarks)
    ports = dedupe_points(collector.ports, 45)
    roads = sorted(collector.roads, key=lambda item: item['sourceId'])

    snapshot = {
        'formatVersion': 1,
        'regionId': args.region_id,
        'bounds': bounds,
        'source': {
            'provider': 'OpenStreetMap contributors',
            'distribution': 'Geofabrik regional extract',
            'url': source_url,
            'license': 'ODbL 1.0',
            'attribution': '© OpenStreetMap contributors',
            'pbfSha256': sha256_file(pbf_path),
            'pbfBytes': pbf_path.stat().st_size,
            'osmTimestamp': pbf_header_timestamp(pbf_path),
            'retrievedOn': args.retrieved_on
        },
        'generation': {
            'roadSimplificationMeters': simplification,
            'buildingRingToleranceMeters': 1.4,
            'maximumBuildingRingPoints': 28
        },
        'settlements': settlements,
        'roads': roads,
        'buildings': buildings,
        'landmarks': landmarks,
        'ports': ports
    }
    uncompressed = stable_json_bytes(snapshot)
    source_directory.mkdir(parents=True, exist_ok=True)
    with open(snapshot_path, 'wb') as raw_handle:
        with gzip.GzipFile(filename='', mode='wb', fileobj=raw_handle, compresslevel=9, mtime=0) as gzip_handle:
            gzip_handle.write(uncompressed)
    metadata = {
        'formatVersion': 1,
        'regionId': args.region_id,
        'provider': 'OpenStreetMap contributors',
        'dataset': 'OpenStreetMap regional extract',
        'distribution': 'Geofabrik',
        'sourceUrl': source_url,
        'license': 'ODbL 1.0',
        'attribution': '© OpenStreetMap contributors',
        'retrievedOn': args.retrieved_on,
        'osmTimestamp': snapshot['source']['osmTimestamp'],
        'pbfBytes': snapshot['source']['pbfBytes'],
        'pbfSha256': snapshot['source']['pbfSha256'],
        'httpLastModified': response_headers.get('Last-Modified'),
        'snapshotFile': snapshot_path.name,
        'snapshotBytes': snapshot_path.stat().st_size,
        'snapshotSha256': sha256_file(snapshot_path),
        'uncompressedBytes': len(uncompressed),
        'counts': {
            'settlements': len(settlements),
            'roads': len(roads),
            'buildings': len(buildings),
            'hotels': sum(1 for item in buildings if item['kind'] == 'hotel'),
            'landmarks': len(landmarks),
            'ports': len(ports)
        },
        'parserStatistics': collector.statistics
    }
    with open(metadata_path, 'w', encoding='utf-8') as handle:
        json.dump(metadata, handle, ensure_ascii=False, sort_keys=True, indent=2)
        handle.write('\n')
    print(json.dumps(metadata, ensure_ascii=False, sort_keys=True, indent=2))


if __name__ == '__main__':
    main()
