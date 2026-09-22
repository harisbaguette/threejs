"""Poly Haven CC0 원본을 내려받고 파일 지문을 기록한다."""
from pathlib import Path
import concurrent.futures
import hashlib
import json
import urllib.request

TARGET = Path(__file__).resolve().parents[1] / 'public' / 'assets'
ASSETS = [
    ('venice_sunset', 'venice_sunset_1k.hdr', 'HDRIs/hdr/1k/venice_sunset_1k.hdr'),
]
for name in ['asphalt_02', 'concrete_floor_02']:
    for kind in ['diff', 'nor_gl', 'rough']:
        filename = f'{name}_{kind}_1k.jpg'
        ASSETS.append((name, filename, f'Textures/jpg/1k/{name}/{filename}'))

def download(item):
    asset, name, path = item
    url = 'https://dl.polyhaven.org/file/ph-assets/' + path
    request = urllib.request.Request(url, headers={'User-Agent': 'ShiosaiThreeJSStudy/1.0'})
    with urllib.request.urlopen(request, timeout=45) as response:
        content = response.read()
    (TARGET / name).write_bytes(content)
    print(name, len(content))
    return {'file': name, 'source': f'https://polyhaven.com/a/{asset}', 'download': url,
            'license': 'CC0-1.0', 'sha256': hashlib.sha256(content).hexdigest()}

TARGET.mkdir(parents=True, exist_ok=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
    records = list(executor.map(download, ASSETS))
(TARGET / 'sources.json').write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n')
