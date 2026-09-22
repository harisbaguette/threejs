"""Download original, unmodified demo assets into the local project."""
import json
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'public' / 'assets'
HEADERS = {'User-Agent': 'Litoral-ThreeJS-Demo/1.0 (local educational project)'}

def read(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=90).read()

def texture(asset):
    data = json.loads(read('https://api.polyhaven.com/files/' + asset))
    for key in ('Diffuse', 'nor_gl', 'Rough'):
        item = data[key]['1k']['jpg']
        dest = ROOT / item['url'].rsplit('/', 1)[-1]
        if not dest.exists():
            dest.write_bytes(read(item['url']))
        print(dest.name, dest.stat().st_size, flush=True)

def file(item):
    name, url = item
    dest = ROOT / name
    if not dest.exists():
        dest.write_bytes(read(url))
    print(name, dest.stat().st_size, flush=True)

if __name__ == '__main__':
    ROOT.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=5) as pool:
        tasks = [pool.submit(texture, a) for a in ('cobblestone_floor_001', 'plastered_wall_02', 'aerial_rocks_02')]
        tasks += [pool.submit(file, item) for item in [
            ('Traveler.glb', 'https://raw.githubusercontent.com/hh-hang/three-player-controller/80d12e5c34e3567475006cab18077cd1b8a5e156/example/public/glb/josh.glb'),
            ('Traveler.LICENSE.txt', 'https://raw.githubusercontent.com/hh-hang/three-player-controller/80d12e5c34e3567475006cab18077cd1b8a5e156/LICENSE'),
            ('waternormals.jpg', 'https://raw.githubusercontent.com/mrdoob/three.js/r186/examples/textures/waternormals.jpg'),
            ('coastal-sky.hdr', 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/kloofendal_48d_partly_cloudy_puresky_2k.hdr'),
        ]]
        for task in tasks:
            task.result()
