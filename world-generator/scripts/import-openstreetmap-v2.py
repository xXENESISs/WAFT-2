#!/usr/bin/env python3
from __future__ import annotations

import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'world-generator' / 'scripts' / 'import-openstreetmap.py'
TEMPORARY = ROOT / 'world-generator' / 'scripts' / '.import-openstreetmap-v2-generated.py'
REGISTRY = ROOT / 'world-generator' / 'configs' / 'source-registry.json'


def replace_once(source: str, search: str, replacement: str, label: str) -> str:
    count = source.count(search)
    if count != 1:
        raise RuntimeError(f'Expected one {label}, found {count}')
    return source.replace(search, replacement, 1)


def main() -> int:
    registry = json.loads(REGISTRY.read_text(encoding='utf-8'))
    urls = registry.get('openstreetmap')
    if not isinstance(urls, dict) or not urls:
        raise RuntimeError('source-registry.json contains no OpenStreetMap sources')
    original = SOURCE.read_text(encoding='utf-8')
    old = "SOURCE_URLS = {\n    'baleares': 'https://download.geofabrik.de/europe/spain/islas-baleares-latest.osm.pbf'\n}"
    replacement = f"SOURCE_URLS = {repr(dict(sorted(urls.items())))}"
    generated = replace_once(original, old, replacement, 'OpenStreetMap source registry')
    TEMPORARY.write_text(generated, encoding='utf-8')
    try:
        result = subprocess.run([sys.executable, str(TEMPORARY), *sys.argv[1:]], cwd=ROOT)
        return result.returncode
    finally:
        TEMPORARY.unlink(missing_ok=True)


if __name__ == '__main__':
    raise SystemExit(main())
