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
    old = "    qids = {qid_from_tags(item.get('tags')) for item in osm_snapshot.get('landmarks', [])}\n"
    new = (
        "    selected_landmarks_path = ROOT / 'regions' / region_id / 'landmarks.json'\n"
        "    if not selected_landmarks_path.exists():\n"
        "        raise SystemExit(f'Missing selected landmark package: {selected_landmarks_path}')\n"
        "    selected_landmarks = read_json(selected_landmarks_path)\n"
        "    qids = {qid_from_tags(item.get('tags')) for item in selected_landmarks.get('items', [])}\n"
    )
    generated = replace_once(original, old, new, 'Wikidata selected landmark query')
    TEMPORARY.write_text(generated, encoding='utf-8')
    try:
        result = subprocess.run([sys.executable, str(TEMPORARY), *sys.argv[1:]], cwd=ROOT)
        return result.returncode
    finally:
        TEMPORARY.unlink(missing_ok=True)


if __name__ == '__main__':
    raise SystemExit(main())
