import * as THREE from 'three';

export async function createMaterials(manager) {
  const loader = new THREE.TextureLoader(manager);
  const texture = async (file, color = false) => {
    const map = await loader.loadAsync(`/assets/${file}`);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = 8;
    if (color) map.colorSpace = THREE.SRGBColorSpace;
    return map;
  };
  const surface = async (name, color, normalStrength = 1) => {
    const [map, normalMap, roughnessMap] = await Promise.all([
      texture(`${name}_diff_1k.jpg`, true),
      texture(`${name}_nor_gl_1k.jpg`),
      texture(`${name}_rough_1k.jpg`),
    ]);
    return new THREE.MeshStandardMaterial({
      color, map, normalMap, roughnessMap, roughness: 1,
      normalScale: new THREE.Vector2(normalStrength, normalStrength),
    });
  };
  const [paving, plaster, rock, concrete] = await Promise.all([
    surface('cobblestone_floor_001', '#d2c6b0', .8),
    surface('plastered_wall_02', '#e6d7bd', .45),
    surface('aerial_rocks_02', '#b3ada0', 1.2),
    surface('concrete_floor_02', '#dbcfb9', .5),
  ]);
  const standard = (color, roughness = .8, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const wallColors = ['#e8d4b5', '#d8ac85', '#e8dfc9', '#bbaa83', '#dfb0a0', '#e6c891'];
  const walls = wallColors.map(color => { const m = plaster.clone(); m.color.set(color); return m; });
  const roofCanvas = document.createElement('canvas');
  roofCanvas.width = roofCanvas.height = 512;
  const c = roofCanvas.getContext('2d');
  c.fillStyle = '#a65e3e'; c.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 64) {
    for (let x = 0; x < 512; x += 32) {
      const tone = Math.floor(145 + Math.random() * 35);
      const gradient = c.createLinearGradient(x, 0, x + 32, 0);
      gradient.addColorStop(0, `rgb(${tone - 30},62,39)`);
      gradient.addColorStop(.5, `rgb(${tone + 30},109,73)`);
      gradient.addColorStop(1, `rgb(${tone - 15},76,47)`);
      c.fillStyle = gradient; c.fillRect(x, y, 31, 62);
      c.fillStyle = 'rgba(65,35,20,.45)'; c.fillRect(x, y + 60, 32, 4);
    }
  }
  const roofMap = new THREE.CanvasTexture(roofCanvas);
  roofMap.colorSpace = THREE.SRGBColorSpace;
  roofMap.wrapS = roofMap.wrapT = THREE.RepeatWrapping;
  roofMap.anisotropy = 8;
  return {
    paving, plaster, rock, concrete, walls,
    roof: new THREE.MeshStandardMaterial({ map: roofMap, roughness: .88, bumpMap: roofMap, bumpScale: .035 }),
    trim: standard('#d7cfb9'), wood: standard('#655643'), darkWood: standard('#384036'),
    shutters: [standard('#365c54'), standard('#698078'), standard('#526977')],
    metal: standard('#303934', .52, .65), brass: standard('#947c47', .4, .7),
    glass: new THREE.MeshStandardMaterial({ color: '#263d3c', roughness: .16, metalness: .48 }),
    cloth: standard('#e6ddc8'), awning: standard('#46635a'), terracotta: standard('#a97557'),
    foliage: standard('#426045'), leafLight: standard('#7d8a57'), flower: standard('#b64b75'),
    white: standard('#e9e1ca'), boat: standard('#316a71', .4), rubber: standard('#20251f'),
    lamp: new THREE.MeshStandardMaterial({ color: '#ffedc2', emissive: '#ffb75d', emissiveIntensity: .7, roughness: .25 }),
  };
}

export function signTexture(text, subtitle = '', bg = '#263f37', color = '#e9dec0') {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
  const c = canvas.getContext('2d'); c.fillStyle = bg; c.fillRect(0, 0, 1024, 256);
  c.strokeStyle = color; c.lineWidth = 3; c.strokeRect(12, 12, 1000, 232);
  c.textAlign = 'center'; c.fillStyle = color; c.font = '54px Georgia';
  c.fillText(text, 512, subtitle ? 119 : 148);
  if (subtitle) { c.font = '22px sans-serif'; c.fillText(subtitle, 512, 180); }
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  return new THREE.MeshStandardMaterial({ map, roughness: .85 });
}
