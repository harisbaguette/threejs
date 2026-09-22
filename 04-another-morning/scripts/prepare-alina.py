"""Convert the artist's legacy glTF materials without changing their geometry."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / 'art-source/alina-original'
data = json.loads((source/'scene.gltf').read_text())
data.pop('animations', None)
data.pop('extensionsRequired', None)
data.pop('extensionsUsed', None)
for mat in data['materials']:
    old = mat.pop('extensions', {}).get('KHR_materials_pbrSpecularGlossiness', {})
    mat['pbrMetallicRoughness'] = {
        'baseColorFactor': old.get('diffuseFactor', [1, 1, 1, 1]),
        'metallicFactor': 0,
        'roughnessFactor': .7,
    }
    if 'diffuseTexture' in old:
        mat['pbrMetallicRoughness']['baseColorTexture'] = old['diffuseTexture']
    if mat['name'] == 'Camisole':
        mat['alphaMode'] = 'OPAQUE'
    elif any(s in mat['name'] for s in ['Hair', 'Skullcap', 'Eyelash']):
        mat['alphaMode'] = 'MASK'
        mat['alphaCutoff'] = .35
    mat['doubleSided'] = True
for mesh in data['meshes']:
    mesh.pop('weights', None)
    for primitive in mesh['primitives']:
        primitive.pop('targets', None)
        primitive['attributes'].pop('COLOR_0', None)
(source/'prepared.gltf').write_text(json.dumps(data), encoding='utf-8')
print('Prepared artist materials and removed unused animation data.')
