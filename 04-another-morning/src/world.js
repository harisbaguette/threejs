import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export function createApartment(scene) {
  const obstacles = [], cameraWalls = [];
  const material = (color, roughness = .8, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const wall = material('#e7e0d4'), wood = material('#655041'), oak = material('#ab8460');
  const cream = material('#dcd2bc'), dark = material('#292b29'), gold = material('#ae9360', .26, .75);
  const green = material('#355445'), porcelain = material('#e8e2d5', .25);
  function box(w, h, d, x, y, z, mat, rounded = false) {
    const mesh = new THREE.Mesh(rounded ? new RoundedBoxGeometry(w, h, d, 2, Math.min(.075, h / 4)) : new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh); return mesh;
  }
  function cylinder(r1, r2, h, x, y, z, mat) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, 32), mat);
    mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh); return mesh;
  }
  const obstacle = (x, z, w, d) => obstacles.push({ x, z, w, d });
  // Floor planks have individually varied grain instead of a uniform brown plane.
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ad8b69'; ctx.fillRect(0, 0, 512, 512);
  let seed = 48;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  for (let i = 0; i < 1800; i++) {
    ctx.strokeStyle = `rgba(65,41,24,${random() * .16})`;
    const y = random() * 512; ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(160, y + random() * 5, 360, y - random() * 4, 512, y); ctx.stroke();
  }
  ctx.strokeStyle = '#715337'; ctx.strokeRect(0, 0, 512, 512);
  const floorTexture = new THREE.CanvasTexture(canvas); floorTexture.colorSpace = THREE.SRGBColorSpace;
  floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping; floorTexture.repeat.set(4, 25); floorTexture.anisotropy = 8;
  box(12, .12, 10, 0, -.06, 0, new THREE.MeshStandardMaterial({ map: floorTexture, roughness: .48 }));
  cameraWalls.push(box(12, 3.4, .14, 0, 1.7, -5, wall), box(.14, 3.4, 10, -6, 1.7, 0, wall), box(12, 3.4, .14, 0, 1.7, 5, wall));
  box(12, .12, 10, 0, 3.46, 0, material('#ece7de'));
  for (const z of [-4.88, 4.88]) box(12, .1, .04, 0, .08, z, oak);
  box(.04, .1, 10, -5.88, .08, 0, oak);
  // The city is a deliberately abstract, distant Seoul-inspired skyline.
  const sky = new THREE.MeshBasicMaterial({ color: '#d5e0df' });
  box(.1, 50, 130, 45, 10, 0, sky);
  for (let i = 0; i < 65; i++) {
    const height = 2 + random() * 14;
    box(1 + random() * 3, height, 1 + random() * 2.2, 15 + random() * 25, -5 + height / 2, -42 + random() * 84, material(new THREE.Color().setHSL(.53, .05, .55 + random() * .23)));
  }
  // Full-height glazing. Opaque mullions and no tinted screen keep daylight natural.
  for (let z = -5; z <= 5; z += 2.5) box(.12, 3.4, .08, 5.97, 1.7, z, dark);
  for (const y of [.15, 3.25]) box(.12, .1, 10, 5.97, y, 0, dark);
  box(.15, .45, 10, 5.98, .225, 0, wall);
  for (const z of [-4.75, 4.7]) {
    for (let i = 0; i < 9; i++) box(.12, 3.1, .085, 5.66 + Math.sin(i) * .06, 1.77, z + i * .045, cream, true);
  }
  // Mirror, closet, dressing stool.
  box(2.14, 2.88, .12, -.5, 1.53, -4.83, gold, true);
  const mirror = new Reflector(new THREE.PlaneGeometry(2, 2.72), { color: 0xc4c4c4, textureWidth: 1024, textureHeight: 1024, clipBias: .002 });
  mirror.position.set(-.5, 1.53, -4.752); scene.add(mirror);
  for (const x of [-1.64, .64]) box(.035, 2.45, .035, x, 1.53, -4.70, new THREE.MeshBasicMaterial({ color: '#fff0ce' }));
  box(2.7, 2.8, .72, 3.6, 1.4, -4.55, wood, true); obstacle(3.6, -4.55, 2.7, .72);
  for (const x of [2.7, 3.6, 4.5]) {
    box(.85, 2.7, .035, x, 1.42, -4.165, oak);
    box(.025, .35, .05, x + .29, 1.4, -4.12, gold);
  }
  cylinder(.34, .3, .45, 1.45, .24, -3.95, cream); obstacle(1.45, -3.95, .65, .65);
  // Kitchen on the left wall.
  box(.85, .9, 3.2, -5.42, .45, -2.5, oak, true); obstacle(-5.42, -2.5, .85, 3.2);
  box(.97, .055, 3.32, -5.37, .93, -2.5, porcelain);
  for (const z of [-3.5, -2.5, -1.5]) box(.015, .03, .38, -4.97, .74, z, gold);
  box(.42, .42, .4, -5.3, 1.17, -1.5, dark, true);
  box(.22, .02, .25, -5.05, 1.01, -1.5, gold);
  const cup = cylinder(.07, .052, .12, -4.97, 1.08, -1.5, porcelain);
  cylinder(.062, .062, .003, -4.97, 1.142, -1.5, material('#342218', .25));
  const steam = new THREE.Group(); scene.add(steam); steam.visible = false;
  for (let i = 0; i < 5; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(.025, 8, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .12, depthWrite: false }));
    steam.add(puff);
  }
  box(.7, .04, 2.5, -5.5, 2.05, -2.5, oak);
  for (let i = 0; i < 5; i++) cylinder(.06, .06, .2 + i % 2 * .08, -5.4, 2.19, -3.4 + i * .27, i % 2 ? green : porcelain);
  // Living area: linen sofa, rug, low table and a small pendant.
  box(3.35, .02, 2.7, -2.2, .02, 2.3, material('#b7b4a5'));
  box(2.7, .36, 1, -2.55, .35, 1.25, cream, true);
  box(2.7, .6, .22, -2.55, .7, .78, cream, true);
  for (const x of [-3.89, -1.21]) box(.23, .51, 1.05, x, .58, 1.25, cream, true);
  for (const x of [-3.2, -1.9]) box(.6, .44, .18, x, .72, 1.03, x < -3 ? green : material('#a88367'), true).rotation.z = .12;
  obstacle(-2.55, 1.25, 2.95, 1.1);
  cylinder(.66, .66, .09, -2, .44, 2.8, wood); cylinder(.3, .38, .4, -2, .2, 2.8, wood); obstacle(-2, 2.8, 1.25, 1.25);
  box(.28, .025, .36, -2.12, .503, 2.72, cream).rotation.y = -.2;
  const pendant = new THREE.Mesh(new THREE.TorusGeometry(.075, .012, 8, 40), gold);
  pendant.rotation.x = -Math.PI / 2; pendant.position.set(-1.78, .5, 2.94); scene.add(pendant);
  // Desk and smartphone beside the window.
  box(1.65, .07, .68, 3.9, .82, .4, wood, true); obstacle(3.9, .4, 1.65, .68);
  for (const x of [3.2, 4.6]) box(.045, .8, .5, x, .4, .4, dark);
  box(.58, .45, .06, 3.8, 1.1, .15, dark, true);
  box(.5, .37, .008, 3.8, 1.1, .187, material('#839992'));
  box(.38, .02, .18, 3.8, .875, .55, dark, true);
  const phone = box(.13, .014, .24, 4.37, .87, .55, dark, true);
  box(.112, .003, .215, 4.37, .88, .55, new THREE.MeshBasicMaterial({ color: '#b8cfc2' }));
  cylinder(.33, .3, .1, 3.85, .45, 1.25, cream); obstacle(3.85, 1.25, .6, .6);
  // Reading nook, framed art and plants.
  box(1.4, .05, .7, 4.55, .43, -2.35, cream, true); obstacle(4.55, -2.35, 1.4, .7);
  for (const x of [4, 5.1]) box(.05, .4, .5, x, .2, -2.35, wood);
  box(1.3, 1.2, .035, -3.65, 2, -4.90, wood);
  box(1.2, 1.1, .04, -3.65, 2, -4.87, cream);
  const art = new THREE.Mesh(new THREE.CircleGeometry(.34, 64), material('#986e50')); art.position.set(-3.55, 2.03, -4.84); scene.add(art);
  function plant(x, z, height = 1) {
    cylinder(.2, .14, .36, x, .18, z, porcelain);
    cylinder(.025, .035, height, x, height / 2 + .25, z, wood);
    for (let i = 0; i < 12; i++) {
      const a = i * 2.4, leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), green);
      leaf.scale.set(.13, .3, .025); leaf.rotation.set(.4, a, .75);
      leaf.position.set(x + Math.cos(a) * .2, .55 + i / 12 * height, z + Math.sin(a) * .2); scene.add(leaf);
    }
    obstacle(x, z, .45, .45);
  }
  plant(5.15, -3.8, 1.15); plant(-4.9, 3.9, 1.35);
  box(1.15,2.4,.06,-3.6,1.2,4.88,wood);
  box(.08,.18,.07,-3.18,1.05,4.8,gold);
  // Warm practicals balance the cooler light from the windows.
  cylinder(.018, .025, 1.8, -4.25, .9, .7, gold);
  cylinder(.22, .35, .34, -4.25, 1.79, .7, cream);
  const practical = new THREE.PointLight('#ffdfa9', 14, 4, 2); practical.position.set(-4.25, 1.65, .7); scene.add(practical);
  const mirrorFill = new THREE.PointLight('#fff1de', 3, 4, 2); mirrorFill.position.set(-.5, 2.3, -3.9); scene.add(mirrorFill);
  const sun = new THREE.DirectionalLight('#fff1d6', 3.4); sun.position.set(7, 6, 1.8); sun.target.position.set(-2, 0, -1); scene.add(sun, sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 8, bottom: -8, near: .5, far: 30 });
  sun.shadow.normalBias = .02; sun.shadow.bias = -.0002;
  scene.add(new THREE.HemisphereLight('#e6edf1', '#b8a38a', 1.4));
  const stations = [
    { id: 'possess', name: '서연 · 28세', action: '빙의하기', x: .2, z: -1.2, radius: 1.75, y: 2.02 },
    { id: 'mirror', name: '전신 거울', action: '거울 보기', x: -.5, z: -3.45, radius: 1.45, y: 2.5 },
    { id: 'outfit', name: '옷장', action: '옷 색상 고르기', x: 3.4, z: -3.3, radius: 1.3, y: 2.35 },
    { id: 'coffee', name: '커피 머신', action: '커피 만들기', x: -4.15, z: -1.5, radius: 1.25, y: 1.6 },
    { id: 'phone', name: '서연의 휴대폰', action: '메시지 읽기', x: 4.35, z: 1.5, radius: 1.2, y: 1.5 },
    { id: 'window', name: '창가', action: '아침 바라보기', x: 5.05, z: 3.3, radius: 1.25, y: 1.7 },
    { id: 'return', name: '낯익은 펜던트', action: '남성으로 돌아가기', x: -.95, z: 2.8, radius: 1.05, y: 1.1 },
    { id: 'outing', name: '현관', action: '거리로 나가기', x: -3.6, z: 4.05, radius: 1.15, y: 2.05 },
  ];
  return { mirror, obstacles, cameraWalls, stations, cup, phone, steam, update(time) {
    steam.children.forEach((p, i) => {
      const phase = (time * .45 + i / 5) % 1;
      p.position.set(-4.97 + Math.sin(time + i) * .025, 1.18 + phase * .33, -1.5);
      p.scale.setScalar(.5 + phase); p.material.opacity = (1 - phase) * .15;
    });
  } };
}
