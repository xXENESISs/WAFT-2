#!/usr/bin/env python3
import argparse
import difflib
import gzip
import hashlib
import json
import math
import re
import time
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
API_URL = 'https://www.wikidata.org/w/api.php'
USER_AGENT = 'WAFT-Adventure-region-generator/0.1 (https://github.com/xXENESISs/WAFT-2)'
QID_RE = re.compile(r'^Q[1-9][0-9]*$')
LANGUAGES = ['ca', 'es', 'en', 'fr', 'de', 'it']


def read_json(path):
    with open(path, 'r', encoding='utf-8') as handle:
        return json.load(handle)


def stable_json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')) + '\n').encode('utf-8')


def sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()


def normalize_name(value):
    text = unicodedata.normalize('NFD', str(value or ''))
    text = ''.join(character for character in text if unicodedata.category(character) != 'Mn')
    return re.sub(r'[^a-z0-9]+', ' ', text.lower()).strip()


def geo_distance_km(a, b):
    mean_lat = math.radians((a['lat'] + b['lat']) * 0.5)
    dx = (a['lon'] - b['lon']) * 111.320 * math.cos(mean_lat)
    dz = (a['lat'] - b['lat']) * 111.132
    return math.hypot(dx, dz)


def qid_from_tags(tags):
    value = (tags or {}).get('wikidata')
    if not value:
        return None
    for candidate in re.split(r'[;,\s]+', value.strip()):
        if QID_RE.fullmatch(candidate):
            return candidate
    return None


def match_manual_landmarks(config, osm_snapshot):
    candidates = []
    for landmark in osm_snapshot.get('landmarks', []):
        qid = qid_from_tags(landmark.get('tags'))
        if qid:
            candidates.append((landmark, qid))

    matches = {}
    for manual in config['generation']['landmarks']['manualInclude']:
        manual_name = normalize_name(manual.get('name'))
        best = None
        for candidate, qid in candidates:
            distance = geo_distance_km(manual['position'], candidate['position'])
            if distance > 5:
                continue
            candidate_name = normalize_name(candidate.get('name'))
            similarity = difflib.SequenceMatcher(None, manual_name, candidate_name).ratio() if manual_name and candidate_name else 0
            type_match = manual.get('type') == candidate.get('type')
            distance_score = max(0.0, 1.0 - distance / 5.0)
            score = similarity * 0.66 + (0.22 if type_match else 0) + distance_score * 0.12
            if best is None or score > best['score']:
                best = {
                    'qid': qid,
                    'sourceId': candidate.get('sourceId'),
                    'sourceName': candidate.get('name'),
                    'distanceKm': round(distance, 4),
                    'nameSimilarity': round(similarity, 4),
                    'typeMatch': type_match,
                    'score': round(score, 4)
                }
        if best and (best['nameSimilarity'] >= 0.45 or (best['typeMatch'] and best['distanceKm'] <= 0.65)):
            matches[manual['id']] = best
    return matches


def claim_entity_ids(entity, property_id):
    values = []
    for statement in entity.get('claims', {}).get(property_id, []):
        value = statement.get('mainsnak', {}).get('datavalue', {}).get('value')
        if isinstance(value, dict) and value.get('entity-type') == 'item' and isinstance(value.get('id'), str):
            values.append(value['id'])
    return sorted(set(values))


def claim_string(entity, property_id):
    for statement in entity.get('claims', {}).get(property_id, []):
        value = statement.get('mainsnak', {}).get('datavalue', {}).get('value')
        if isinstance(value, str) and value:
            return value
    return None


def claim_quantity(entity, property_id):
    for statement in entity.get('claims', {}).get(property_id, []):
        value = statement.get('mainsnak', {}).get('datavalue', {}).get('value')
        if isinstance(value, dict) and value.get('amount') is not None:
            try:
                amount = float(value['amount'])
                if math.isfinite(amount):
                    return amount
            except (TypeError, ValueError):
                pass
    return None


def claim_time(entity, property_id):
    for statement in entity.get('claims', {}).get(property_id, []):
        value = statement.get('mainsnak', {}).get('datavalue', {}).get('value')
        if isinstance(value, dict) and isinstance(value.get('time'), str):
            return value['time']
    return None


def claim_coordinate(entity):
    for statement in entity.get('claims', {}).get('P625', []):
        value = statement.get('mainsnak', {}).get('datavalue', {}).get('value')
        if isinstance(value, dict) and isinstance(value.get('latitude'), (int, float)) and isinstance(value.get('longitude'), (int, float)):
            return {'lat': value['latitude'], 'lon': value['longitude']}
    return None


def compact_entity(entity):
    labels = {language: entity.get('labels', {}).get(language, {}).get('value') for language in LANGUAGES}
    labels = {language: value for language, value in labels.items() if value}
    descriptions = {language: entity.get('descriptions', {}).get(language, {}).get('value') for language in LANGUAGES}
    descriptions = {language: value for language, value in descriptions.items() if value}
    sitelinks = entity.get('sitelinks', {})
    article_languages = sorted({key[:-4] for key in sitelinks if key.endswith('wiki') and not key.endswith('commonswiki')})
    selected_sitelinks = {}
    for language in LANGUAGES:
        key = f'{language}wiki'
        if key in sitelinks:
            selected_sitelinks[language] = sitelinks[key].get('title')
    return {
        'qid': entity['id'],
        'labels': labels,
        'descriptions': descriptions,
        'sitelinkCount': len([key for key in sitelinks if key.endswith('wiki')]),
        'articleLanguages': article_languages,
        'sitelinks': selected_sitelinks,
        'instanceOf': claim_entity_ids(entity, 'P31'),
        'heritageDesignations': claim_entity_ids(entity, 'P1435'),
        'architects': claim_entity_ids(entity, 'P84'),
        'country': claim_entity_ids(entity, 'P17'),
        'image': claim_string(entity, 'P18'),
        'commonsCategory': claim_string(entity, 'P373'),
        'officialWebsite': claim_string(entity, 'P856'),
        'heightMeters': claim_quantity(entity, 'P2048'),
        'inception': claim_time(entity, 'P571'),
        'coordinate': claim_coordinate(entity)
    }


def fetch_entities(qids):
    entities = {}
    for index in range(0, len(qids), 50):
        batch = qids[index:index + 50]
        query = urllib.parse.urlencode({
            'action': 'wbgetentities',
            'ids': '|'.join(batch),
            'props': 'labels|descriptions|claims|sitelinks',
            'languages': '|'.join(LANGUAGES),
            'languagefallback': '1',
            'format': 'json',
            'formatversion': '2'
        })
        request = urllib.request.Request(f'{API_URL}?{query}', headers={'User-Agent': USER_AGENT, 'Accept': 'application/json'})
        with urllib.request.urlopen(request, timeout=90) as response:
            payload = json.load(response)
        for entity in payload.get('entities', {}).values():
            if entity.get('missing') or not QID_RE.fullmatch(entity.get('id', '')):
                continue
            entities[entity['id']] = compact_entity(entity)
        if index + 50 < len(qids):
            time.sleep(0.12)
    return entities


def main():
    parser = argparse.ArgumentParser(description='Create a deterministic Wikidata landmark snapshot for a WAFT region.')
    parser.add_argument('region_id', nargs='?', default='baleares')
    parser.add_argument('--retrieved-on', default=None)
    args = parser.parse_args()

    region_id = args.region_id
    config = read_json(ROOT / 'world-generator' / 'configs' / f'{region_id}.region.json')
    source_directory = ROOT / 'world-generator' / 'sources' / region_id
    osm_snapshot_path = source_directory / 'openstreetmap-extract.json.gz'
    if not osm_snapshot_path.exists():
        raise SystemExit(f'Missing OpenStreetMap snapshot: {osm_snapshot_path}')
    with gzip.open(osm_snapshot_path, 'rt', encoding='utf-8') as handle:
        osm_snapshot = json.load(handle)

    manual_matches = match_manual_landmarks(config, osm_snapshot)
    qids = {qid_from_tags(item.get('tags')) for item in osm_snapshot.get('landmarks', [])}
    qids.update(match['qid'] for match in manual_matches.values())
    qids = sorted(qid for qid in qids if qid)
    requested_hash = sha256_bytes(('\n'.join(qids) + '\n').encode('ascii'))

    snapshot_path = source_directory / 'wikidata-landmarks.json.gz'
    metadata_path = source_directory / 'wikidata-landmarks.json'
    if snapshot_path.exists() and metadata_path.exists():
        metadata = read_json(metadata_path)
        if metadata.get('requestedQidsSha256') == requested_hash and metadata.get('snapshotSha256') == sha256_bytes(snapshot_path.read_bytes()):
            print(json.dumps({'regionId': region_id, 'snapshot': str(snapshot_path.relative_to(ROOT)), 'status': 'reused', 'entities': metadata.get('entityCount', 0)}, indent=2))
            return

    entities = fetch_entities(qids)
    snapshot = {
        'formatVersion': 1,
        'regionId': region_id,
        'requestedQidsSha256': requested_hash,
        'manualMatches': manual_matches,
        'entities': entities
    }
    uncompressed = stable_json_bytes(snapshot)
    source_directory.mkdir(parents=True, exist_ok=True)
    with open(snapshot_path, 'wb') as raw:
        with gzip.GzipFile(filename='', mode='wb', fileobj=raw, mtime=0, compresslevel=9) as compressed:
            compressed.write(uncompressed)
    compressed_bytes = snapshot_path.read_bytes()
    metadata = {
        'formatVersion': 1,
        'regionId': region_id,
        'dataset': 'Wikidata landmark enrichment',
        'provider': 'Wikimedia Foundation and Wikidata contributors',
        'endpoint': API_URL,
        'license': 'CC0 1.0',
        'retrievedOn': args.retrieved_on,
        'requestedQids': len(qids),
        'requestedQidsSha256': requested_hash,
        'entityCount': len(entities),
        'manualMatchCount': len(manual_matches),
        'snapshotFile': snapshot_path.name,
        'snapshotBytes': len(compressed_bytes),
        'snapshotSha256': sha256_bytes(compressed_bytes),
        'uncompressedBytes': len(uncompressed)
    }
    metadata_path.write_bytes(stable_json_bytes(metadata))
    print(json.dumps(metadata, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
