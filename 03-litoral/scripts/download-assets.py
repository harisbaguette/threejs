"""Download source assets; prepare-hair.mjs derives the reference hairstyle."""
import io
import json
import urllib.request
import zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'public' / 'assets'
HEADERS = {'User-Agent': 'Litoral-ThreeJS-Demo/1.0 (local educational project)'}
METAPERSON_REV = 'ba6eb2505ea3e4d05874bdf7c31a4e45003653d4'

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

def female():
    dest = ROOT / 'TravelerFemale.glb'
    if not dest.exists():
        url = 'https://drive.google.com/uc?export=download&id=1aOu0Yzr93_cj_IEXhqrFnfcrs1x_sE9b'
        with zipfile.ZipFile(io.BytesIO(read(url))) as archive:
            data = archive.read('model.glb')
            if data[:4] != b'glTF':
                raise ValueError('The female sample did not contain a GLB model.')
            dest.write_bytes(data)
    print(dest.name, dest.stat().st_size, flush=True)

if __name__ == '__main__':
    ROOT.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=5) as pool:
        tasks = [pool.submit(texture, a) for a in ('cobblestone_floor_001', 'plastered_wall_02', 'aerial_rocks_02', 'concrete_floor_02')]
        tasks.append(pool.submit(female))
        tasks += [pool.submit(file, item) for item in [
            ('Traveler.glb', 'https://raw.githubusercontent.com/hh-hang/three-player-controller/80d12e5c34e3567475006cab18077cd1b8a5e156/example/public/glb/josh.glb'),
            ('Traveler.LICENSE.txt', 'https://raw.githubusercontent.com/hh-hang/three-player-controller/80d12e5c34e3567475006cab18077cd1b8a5e156/LICENSE'),
            ('waternormals.jpg', 'https://raw.githubusercontent.com/mrdoob/three.js/r186/examples/textures/waternormals.jpg'),
            ('coastal-sky.hdr', 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/kloofendal_48d_partly_cloudy_puresky_2k.hdr'),
            ('MetaPerson.LICENSE.txt', f'https://raw.githubusercontent.com/avatarsdk/metaperson-loader-threejs/{METAPERSON_REV}/LICENSE.txt'),
        ]]
        for task in tasks:
            task.result()
