#!/usr/bin/env python3
from __future__ import annotations

import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'world-generator' / 'scripts' / 'import-wikidata-landmarks.py'
TEMPORARY = ROOT / 'world-generator' / 'scripts' / '.import-wikidata-landmarks-v2-generated.py'


def replace_once(source: str, search: str, replacement: str, label: str) -> str:
    count = source.count(search)
    if count != 1:
        raise RuntimeError(f'Expected one {label}, found {count}')
    return source.replace(search, replacement, 1)


def main() -> int:
    original = SOURCE.read_text(encoding='utf-8')
    old_query = "    qids = {qid_from_tags(item.get('tags')) for item in osm_snapshot.get('landmarks', [])}\n"
    new_query = (
        "    selected_landmarks_path = ROOT / 'regions' / region_id / 'landmarks.json'\n"
        "    if not selected_landmarks_path.exists():\n"
        "        raise SystemExit(f'Missing selected landmark package: {selected_landmarks_path}')\n"
        "    selected_landmarks = read_json(selected_landmarks_path)\n"
        "    qids = {qid_from_tags(item.get('tags')) for item in selected_landmarks.get('items', [])}\n"
    )
    generated = replace_once(original, old_query, new_query, 'Wikidata selected landmark query')
    old_match = "        if best and (best['nameSimilarity'] >= 0.45 or (best['typeMatch'] and best['distanceKm'] <= 0.65)):\n"
    new_match = (
        "        if best and (\n"
        "            (best['typeMatch'] and best['nameSimilarity'] >= 0.52 and best['distanceKm'] <= 0.65)\n"
        "            or (best['nameSimilarity'] >= 0.88 and best['distanceKm'] <= 1.5)\n"
        "        ):\n"
    )
    generated = replace_once(generated, old_match, new_match, 'protected landmark semantic threshold')
    old_hash = "    requested_hash = sha256_bytes(('\\n'.join(qids) + '\\n').encode('ascii'))\n"
    new_hash = "    requested_hash = sha256_bytes(('selected-landmarks-manual-match-v3\\n' + '\\n'.join(qids) + '\\n').encode('ascii'))\n"
    generated = replace_once(generated, old_hash, new_hash, 'snapshot algorithm fingerprint')
    TEMPORARY.write_text(generated, encoding='utf-8')
    try:
        result = subprocess.run([sys.executable, str(TEMPORARY), *sys.argv[1:]], cwd=ROOT)
        return result.returncode
    finally:
        TEMPORARY.unlink(missing_ok=True)


if __name__ == '__main__':
    raise SystemExit(main())
