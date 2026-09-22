"""Fetch the CC BY 4.0 original with its attribution from a public asset mirror."""
import json
from pathlib import Path
from urllib.request import urlopen, urlretrieve
from concurrent.futures import ThreadPoolExecutor

ROOT = Path(__file__).resolve().parents[1]
ASSET = 'raw/sketchfab/Alina_Ip_realistic_Asian_woman_Animated__600d4d4a'
REPO = 'fernandotonon/QtMeshEditor-motion-corpus'
DEST = ROOT / 'art-source/alina-original'
DEST.mkdir(parents=True, exist_ok=True)
with urlopen(f'https://huggingface.co/api/datasets/{REPO}/tree/main/{ASSET}?recursive=true') as response:
    entries = json.load(response)

def fetch(entry):
    if entry['type'] != 'file' or entry['path'].endswith('canonical.json'):
        return
    relative = entry['path'][len(ASSET)+1:]
    target = DEST / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists() or target.stat().st_size != entry['size']:
        urlretrieve(f'https://huggingface.co/datasets/{REPO}/resolve/main/{entry["path"]}', target)
    print(relative, target.stat().st_size, flush=True)

with ThreadPoolExecutor(max_workers=6) as executor:
    list(executor.map(fetch, entries))
