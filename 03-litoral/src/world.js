import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Water } from 'three/addons/objects/Water.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { createMaterials, signTexture } from './materials.js';

export const LANDMARKS = [
  { id: 'harbor', name: '작은 선착장', x: -23, z: 5.5, description: '잔물결에 흔들리는 파란 배.' },
  { id: 'cafe', name: '카페 벨라 비스타', x: 7, z: -15, description: '커피 향이 머무는 골목.' },
  { id: 'fountain', name: '오래된 분수', x: 25, z: -40, description: '마을 한가운데, 잠시 쉬어 가는 곳.' },
  { id: 'lighthouse', name: '세레노 등대', x: -31, z: -70, description: '바다와 하늘이 만나는 자리.' },
];

let seed = 214;
const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

export async function createWorld(scene, renderer, manager) {
  const m = await createMaterials(manager);
  const staticRoot = new THREE.Group(); scene.add(staticRoot);
  const obstacles = [], buildings = [], boats = [], birds = [];
  const batch = new Map();
  const v = new THREE.Vector3();
  const cube = new THREE.BoxGeometry(1, 1, 1);

  function mesh(geometry, material, x = 0, y = 0, z = 0, parent = staticRoot) {
    const obj = new THREE.Mesh(geometry, material);
    obj.position.set(x, y, z); obj.castShadow = obj.receiveShadow = true;
    parent.add(obj); return obj;
  }
  function box(x, y, z, w, h, d, material, parent = staticRoot) {
    const g = cube.clone(); g.scale(w, h, d);
    const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      if (Math.abs(n.getY(i)) > .5) uv.setXY(i, p.getX(i) / 3, p.getZ(i) / 3);
      else if (Math.abs(n.getX(i)) > .5) uv.setXY(i, p.getZ(i) / 3, p.getY(i) / 3);
      else uv.setXY(i, p.getX(i) / 3, p.getY(i) / 3);
    }
    return mesh(g, material, x, y, z, parent);
  }
  function cylinder(x, y, z, r1, r2, height, material, segments = 10, parent = staticRoot) {
    return mesh(new THREE.CylinderGeometry(r1, r2, height, segments), material, x, y, z, parent);
  }
  function rod(a, b, r, material, parent = staticRoot) {
    const delta = new THREE.Vector3().subVectors(b, a);
    const obj = cylinder(0, 0, 0, r * .72, r, delta.length(), material, 7, parent);
    obj.position.copy(a).add(b).multiplyScalar(.5);
    obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    return obj;
  }
  function obstacle(x, z, w, d, height = 3) { obstacles.push({ x, z, halfX: w / 2, halfZ: d / 2, height }); }
  function label(text, subtitle, x, y, z, w, h, ry = -Math.PI / 2) {
    const mat = signTexture(text, subtitle);
    const s = mesh(new THREE.PlaneGeometry(w, h), mat, x, y, z);
    s.rotation.y = ry; return s;
  }

  // A continuous waterfront with a street, a shaded arcade, and two piers.
  box(94, -.72, -3, 210, 1.35, 260, m.rock);
  box(.5, -.08, -2, 22, .16, 204, m.paving);
  box(10, .045, -2, 3.3, .24, 204, m.concrete);
  box(-9.55, .025, -2, 2.3, .2, 204, m.concrete);
  box(-10.8, -.6, -2, .65, 2.8, 205, m.rock);
  box(-10.75, .15, -2, .85, .28, 205, m.trim);
  box(27, -.04, -39, 33, .15, 21, m.paving);
  box(-24, -.16, -70, 29, .55, 9, m.concrete);
  box(-22, -.18, 5.5, 24, .45, 4.3, m.wood);
  for (let z = -99; z < 101; z += 3.4) {
    if (Math.abs(z - 5.5) < 4 || Math.abs(z + 70) < 6) continue;
    cylinder(-10.75, .66, z, .13, .17, 1.05, m.trim, 8);
    cylinder(-10.75, 1.18, z, .21, .18, .12, m.trim, 8);
    if (Math.abs(z - 3) > 5 && Math.abs(z + 72) > 7) {
      rod(new THREE.Vector3(-10.75, .86, z), new THREE.Vector3(-10.75, .86, z + 3.4), .035, m.metal);
      rod(new THREE.Vector3(-10.75, .51, z), new THREE.Vector3(-10.75, .51, z + 3.4), .022, m.metal);
    }
  }
  for (let z = -99; z < 100; z += 1.6) box(8.45, .16, z, .24, .16, 1.55, m.trim);
  for (let x = -33; x < -11; x += 3) {
    for (const z of [3.2, 7.8]) cylinder(x, -.45, z, .12, .16, 2.2, m.darkWood);
    box(x, .066, 5.5, .04, .015, 4.2, m.darkWood);
  }

  function windowUnit(x, y, z, shutter, balcony = false) {
    box(x, y, z, .12, 1.96, 1.28, m.trim);
    box(x - .075, y, z, .08, 1.7, 1.04, m.glass);
    box(x - .135, y, z, .09, 1.72, .055, m.darkWood);
    box(x - .14, y, z, .09, .055, 1.05, m.darkWood);
    for (const side of [-1, 1]) {
      const zz = z + side * .88;
      box(x - .09, y, zz, .16, 1.92, .57, shutter);
      for (let row = 0; row < 9; row++) box(x - .18, y - .8 + row * .19, zz, .055, .06, .5, shutter);
    }
    box(x - .13, y - 1.02, z, .5, .14, 1.53, m.trim);
    if (balcony) {
      box(x - .64, y - 1.05, z, 1.42, .17, 2.27, m.trim);
      for (let j = -5; j <= 5; j++) box(x - 1.26, y - .55, z + j * .2, .035, 1, .035, m.metal);
      box(x - 1.26, y - .08, z, .05, .06, 2.24, m.metal);
      for (const s of [-1, 1]) box(x - .66, y - .08, z + s * 1.1, 1.2, .06, .05, m.metal);
      box(x - 1.18, y - .48, z, .28, .28, 1.26, m.terracotta);
      flowers(x - 1.2, y - .22, z, 1.4, 13);
    }
  }

  function flowers(x, y, z, width = 1, count = 14) {
    for (let i = 0; i < count; i++) {
      const px = x + (random() - .5) * .4, pz = z + (random() - .5) * width;
      const py = y + random() * .27;
      const leaf = mesh(new THREE.IcosahedronGeometry(.13, 0), i % 3 ? m.foliage : m.flower, px, py, pz);
      leaf.scale.set(1, .8, 1.3);
    }
  }

  function house(z, width, height, index, x = 18) {
    const depth = 11 + random() * 3;
    const front = x - depth / 2;
    const wall = m.walls[index % m.walls.length];
    const shutter = m.shutters[index % 3];
    box(x, height / 2, z, depth, height, width, wall);
    buildings.push({ x, z, w: depth, d: width });
    obstacle(x, z, depth, width, height + 3);
    box(front - .08, .6, z, .2, 1.2, width + .1, m.concrete);
    box(x, height + .05, z, depth + .4, .27, width + .5, m.trim);
    box(front - .12, 3.15, z, .24, .16, width, m.trim);
    for (const side of [-1, 1]) {
      box(front - .12, height / 2, z + side * (width / 2 - .18), .24, height, .28, m.trim);
      const roof = box(x + side * depth / 4, height + .92, z, depth / 2 + .65, .17, width + .7, m.roof);
      roof.rotation.z = -side * .29;
      const end = z + side * width / 2;
      const points = side === 1
        ? [front, height, end, x + depth / 2, height, end, x, height + 1.85, end]
        : [front, height, end, x, height + 1.85, end, x + depth / 2, height, end];
      const gable = new THREE.BufferGeometry();
      gable.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
      gable.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 3, 0, 1.5, .6], 2));
      gable.computeVertexNormals(); mesh(gable, wall);
    }
    cylinder(x, height + 1.83, z, .13, .13, width + .6, m.terracotta).rotation.x = Math.PI / 2;
    box(x + 2, height + 1.8, z + width / 3, .68, 1.5, .72, m.concrete);
    box(x + 2, height + 2.6, z + width / 3, .96, .2, 1, m.trim);
    // Drainpipe and stone corner blocks provide real scale cues.
    cylinder(front - .22, height / 2, z + width / 2 - .4, .055, .055, height, m.metal, 6);
    const columns = Math.max(2, Math.floor(width / 2.9));
    for (let floor = 0; floor < Math.floor((height - 2.8) / 2.65); floor++) {
      for (let col = 0; col < columns; col++) {
        const zz = z + (col - (columns - 1) / 2) * (width - 2) / columns;
        windowUnit(front - .12, 4.35 + floor * 2.8, zz, shutter, floor === 0 && col % 2 === 0);
      }
    }
    for (let j = 0; j < columns; j++) {
      const zz = z + (j - (columns - 1) / 2) * (width - 1.4) / columns;
      box(front - .08, 1.42, zz, .15, 2.8, 1.8, m.trim);
      box(front - .19, 1.4, zz, .12, 2.55, 1.53, j % 2 ? shutter : m.glass);
      box(front - .29, 1.4, zz, .035, 2.5, .055, m.darkWood);
      box(front - .29, 1.45, zz, .035, .07, 1.55, m.darkWood);
      box(front - .4, .12, zz, .6, .18, 1.95, m.concrete);
    }
    if ([1, 3, 5, 7].includes(index)) {
      const awning = box(front - 1.12, 2.9, z, 2.1, .07, width * .77, m.cloth);
      awning.rotation.z = -.13;
      for (let j = 0; j < Math.floor(width * 1.2); j++) {
        const stripe = box(front - 1.13, 2.946, z - width * .37 + j * .65, 2.11, .016, .27, m.awning);
        stripe.rotation.z = -.13;
      }
      box(front - 2.16, 2.66, z, .045, .26, width * .77, m.awning);
      const names = { 1: 'ALIMENTARI', 3: 'BELLA VISTA', 5: 'CASA SERENA', 7: 'BOTTEGA' };
      label(names[index], index === 3 ? 'CAFFÈ · DAL 1962' : 'PORTO SERENO', front - .17, 3.55, z, width * .64, .66);
    }
  }

  const row = [
    [64, 11, 9, 0], [51, 12, 8.7, 1], [37, 13, 11.8, 2],
    [22, 12, 9.3, 4], [8, 13, 8.7, 5], [-6, 10, 11.7, 6],
    [-18, 12, 9.2, 3], [-56, 13, 11.2, 7], [-71, 13, 8.7, 0], [-85, 12, 11.5, 1],
  ];
  row.forEach(args => house(...args));
  house(-38, 15, 10.8, 2, 44);
  house(-24, 12, 8.8, 4, 35);
  house(-52, 12, 8.9, 1, 35);
  // A second layer of hillside homes avoids a flat, theatre-set silhouette.
  for (let i = 0; i < 16; i++) {
    const x = 40 + random() * 75, z = -105 + random() * 190, h = 6 + random() * 11;
    box(x, h / 2 + (x - 40) * .14, z, 8 + random() * 5, h, 9 + random() * 4, m.walls[i % 6]);
    box(x, h + (x - 40) * .14, z, 11, .7, 12, m.roof);
  }

  function lamp(x, z) {
    cylinder(x, 2.05, z, .045, .11, 4.1, m.metal);
    cylinder(x, .2, z, .18, .24, .4, m.metal);
    rod(new THREE.Vector3(x, 4, z), new THREE.Vector3(x + .65, 4.35, z), .045, m.metal);
    box(x + .65, 4.1, z, .34, .49, .34, m.lamp);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(x + .65 + sx * .18, 4.12, z + sz * .18, .026, .56, .026, m.metal);
    cylinder(x + .65, 4.43, z, .04, .33, .22, m.metal, 4).rotation.y = Math.PI / 4;
    cylinder(x + .65, 3.82, z, .28, .13, .12, m.metal, 4).rotation.y = Math.PI / 4;
    obstacle(x, z, .35, .35);
  }
  for (let z = -86; z < 90; z += 21) lamp(-8.8, z);

  function bench(x, z) {
    for (let i = 0; i < 5; i++) box(x + (i - 2) * .13, .55, z, .11, .07, 2.2, m.wood);
    for (let i = 0; i < 4; i++) box(x + .38, .83 + i * .14, z, .07, .11, 2.2, m.wood);
    for (const dz of [-.82, .82]) {
      box(x, .3, z + dz, .55, .55, .08, m.metal);
      box(x + .35, .81, z + dz, .065, 1.1, .07, m.metal);
      box(x, .81, z + dz, .69, .055, .055, m.metal);
    }
    obstacle(x, z, 1, 2.3, 1.4);
  }
  [-53, -24, 22, 57].forEach(z => bench(-7.7, z));

  function bicycle(x, z, angle = 0) {
    const group = new THREE.Group(); group.position.set(x, 0, z); group.rotation.y = angle; staticRoot.add(group);
    for (const zz of [-.65, .65]) {
      const tire = mesh(new THREE.TorusGeometry(.35, .025, 7, 24), m.rubber, 0, .38, zz, group); tire.rotation.y = Math.PI / 2;
      const rim = mesh(new THREE.TorusGeometry(.32, .009, 4, 24), m.brass, 0, .38, zz, group); rim.rotation.y = Math.PI / 2;
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        rod(new THREE.Vector3(0, .38, zz), new THREE.Vector3(0, .38 + Math.sin(a) * .32, zz + Math.cos(a) * .32), .004, m.metal, group);
      }
    }
    const a = new THREE.Vector3(0, .39, .65), b = new THREE.Vector3(0, .42, -.05), c = new THREE.Vector3(0, .95, .3), d = new THREE.Vector3(0, 1.02, -.49), e = new THREE.Vector3(0, .38, -.65);
    [[a, b], [b, c], [c, a], [c, d], [d, b], [d, e]].forEach(([p1, p2]) => rod(p1, p2, .022, m.awning, group));
    box(0, 1.03, .3, .2, .06, .31, m.darkWood, group);
    rod(d, new THREE.Vector3(0, 1.18, -.5), .016, m.brass, group);
    rod(new THREE.Vector3(-.28, 1.18, -.5), new THREE.Vector3(.28, 1.18, -.5), .016, m.brass, group);
    box(.11, .35, -.05, .26, .035, .09, m.metal, group);
    obstacle(x, z, .65, 2.1, 1.2);
  }
  bicycle(-9.1, 17, .12); bicycle(10, 26, -.2); bicycle(10.2, -63, .07);

  // Olive leaves are small, individually oriented surfaces, rendered in one draw call.
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, -.13); leafShape.quadraticCurveTo(.065, 0, 0, .13); leafShape.quadraticCurveTo(-.065, 0, 0, -.13);
  const leafGeo = new THREE.ShapeGeometry(leafShape, 3);
  const leafMat = new THREE.MeshStandardMaterial({ color: '#7b8655', roughness: .85, side: THREE.DoubleSide });
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, 17000);
  const dummy = new THREE.Object3D(); let leafIndex = 0;
  function olive(x, z, size = 1) {
    cylinder(x, .3, z, 1.05, 1.13, .6, m.concrete, 12);
    cylinder(x, .61, z, .94, .94, .05, m.darkWood, 12);
    obstacle(x, z, 2.2, 2.2, .65);
    rod(new THREE.Vector3(x, .6, z), new THREE.Vector3(x + .25, 3.8 * size, z), .18, m.wood);
    for (let b = 0; b < 8; b++) {
      const a = b / 8 * Math.PI * 2, distance = (1.2 + random() * .6) * size;
      const end = new THREE.Vector3(x + Math.cos(a) * distance, (3.6 + random()) * size, z + Math.sin(a) * distance);
      rod(new THREE.Vector3(x + .18, 2.5 * size, z), end, .06, m.wood);
      for (let j = 0; j < 185; j++) {
        if (leafIndex >= leaves.count) break;
        const angle = random() * Math.PI * 2, r = Math.sqrt(random()) * 1.2 * size;
        dummy.position.set(end.x + Math.cos(angle) * r, end.y + (random() - .35) * 1.25, end.z + Math.sin(angle) * r);
        dummy.rotation.set(random() * 3, random() * 6, random() * 3);
        dummy.scale.setScalar(.7 + random() * .9); dummy.updateMatrix();
        leaves.setMatrixAt(leafIndex, dummy.matrix);
        leaves.setColorAt(leafIndex++, new THREE.Color().setHSL(.19 + random() * .045, .2 + random() * .2, .26 + random() * .2));
      }
    }
  }
  [[-6.4, 43], [-6.4, 8], [-6.4, -30], [-6.4, -60], [28, -33], [30, -45], [7, 72], [7, -83]].forEach(([x, z]) => olive(x, z, .92 + random() * .22));
  leaves.count = leafIndex; leaves.castShadow = true; leaves.receiveShadow = true; scene.add(leaves);

  function palm(x, z, height) {
    for (let i = 0; i < 12; i++) {
      const t = i / 12;
      const a = new THREE.Vector3(x + Math.sin(t * 1.5) * .6, t * height, z);
      const b = new THREE.Vector3(x + Math.sin((t + 1 / 12) * 1.5) * .6, (t + 1 / 12) * height, z);
      rod(a, b, .16 - t * .035, m.wood);
    }
    const vertices = [], normals = [];
    for (let f = 0; f < 11; f++) {
      const angle = f / 11 * Math.PI * 2;
      for (let i = 0; i < 15; i++) {
        const t = i / 15, t2 = (i + 1) / 15;
        for (const side of [-1, 1]) {
          const center = t => new THREE.Vector3(x + .6 + Math.cos(angle) * t * 3.5, height + Math.sin(t * 3.2) * 1.3 - t * 1.5, z + Math.sin(angle) * t * 3.5);
          const a = center(t), b = center(t2), c = center(t + .07);
          const width = Math.sin(t * Math.PI) * .85;
          c.x += Math.cos(angle + side * 1.3) * width; c.z += Math.sin(angle + side * 1.3) * width; c.y -= .14;
          vertices.push(...a.toArray(), ...b.toArray(), ...c.toArray());
          normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
        }
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(vertices.length / 3 * 2).fill(0), 2));
    const mat = m.foliage.clone(); mat.side = THREE.DoubleSide; mesh(g, mat);
    obstacle(x, z, .5, .5);
  }
  palm(-7.6, 66, 7.5); palm(-7.2, -10, 8.3); palm(-7.7, -81, 8.9); palm(31, -39, 7.1);

  function cafeTable(x, z, umbrella = false) {
    cylinder(x, .79, z, .58, .58, .07, m.trim, 16);
    cylinder(x, .4, z, .045, .055, .76, m.metal);
    cylinder(x, .035, z, .32, .35, .06, m.metal);
    for (const a of [-1, 1]) {
      box(x + a * .92, .47, z, .43, .07, .45, m.wood);
      box(x + a * 1.09, .78, z, .06, .59, .47, m.wood);
      for (const dx of [-.16, .16]) for (const dz of [-.17, .17]) box(x + a * .92 + dx, .22, z + dz, .035, .44, .035, m.metal);
    }
    cylinder(x, .87, z, .07, .05, .13, m.white, 10);
    if (umbrella) {
      cylinder(x, 1.55, z, .035, .04, 3.1, m.wood);
      const shade = cylinder(x, 2.8, z, .06, 1.65, .55, m.cloth, 10); shade.material.side = THREE.DoubleSide;
      cylinder(x, 2.53, z, 1.65, 1.65, .13, m.cloth, 10);
    }
    obstacle(x, z, 2.5, 1.3, 1.3);
  }
  cafeTable(7.2, -17.5, true); cafeTable(7, -21.3); cafeTable(7.3, -12.4, true);
  cafeTable(8, 7.7); cafeTable(8, 3.5, true);
  for (const z of [30, 11, -9, -25, -62]) {
    cylinder(10.5, .32, z, .42, .27, .64, m.terracotta);
    flowers(10.5, .7, z, .75, 25); obstacle(10.5, z, .85, .85, 1.2);
  }
  label('PORTO SERENO', 'LUNGOMARE', -8.55, 1.6, 34, 2.5, .63, Math.PI / 2);
  cylinder(-8.6, .82, 34, .04, .04, 1.6, m.metal);

  // Fountain plaza.
  cylinder(25, .2, -39, 2.5, 2.6, .4, m.trim, 32);
  cylinder(25, .51, -39, 2.28, 2.4, .3, m.concrete, 32);
  cylinder(25, .68, -39, 2.04, 2.04, .025, new THREE.MeshStandardMaterial({ color: '#517f74', metalness: .4, roughness: .16 }), 32);
  cylinder(25, 1.3, -39, .32, .65, 1.5, m.trim, 16);
  cylinder(25, 2.03, -39, 1.15, .3, .35, m.trim, 24);
  cylinder(25, 2.38, -39, .13, .3, .6, m.trim, 16);
  mesh(new THREE.SphereGeometry(.21, 12, 8), m.trim, 25, 2.81, -39);
  obstacle(25, -39, 5.15, 5.15, .95);
  LANDMARKS[2].x = 21.5;

  // Weathered lighthouse on the end of the breakwater.
  cylinder(-34, .23, -70, 3.3, 3.6, .48, m.trim, 20);
  cylinder(-34, 4.5, -70, 1.4, 2.05, 8.6, m.walls[2], 24);
  cylinder(-34, 8.8, -70, 2, 1.5, .4, m.trim, 24);
  cylinder(-34, 9.4, -70, 1.23, 1.23, 1, m.glass, 16);
  cylinder(-34, 10.1, -70, .06, 1.8, .65, m.roof, 16);
  cylinder(-34, 10.8, -70, .03, .04, .9, m.metal);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    cylinder(-34 + Math.cos(a) * 1.82, 9.35, -70 + Math.sin(a) * 1.82, .023, .023, .8, m.metal, 5);
  }
  const rail = mesh(new THREE.TorusGeometry(1.82, .028, 5, 32), m.metal, -34, 9.72, -70); rail.rotation.x = Math.PI / 2;
  box(-32.01, 1.1, -70, .08, 2.1, .95, m.darkWood);
  box(-32.35, 5.7, -70, .12, 1.35, .54, m.glass);
  obstacle(-34, -70, 4.3, 4.3, 12);

  function boat(x, z, scale = 1, angle = 0, sail = false) {
    const group = new THREE.Group(); group.position.set(x, -.73, z); group.rotation.y = angle; group.scale.setScalar(scale); scene.add(group);
    const shape = new THREE.Shape();
    shape.moveTo(0, -2.5); shape.bezierCurveTo(-1.05, -1.65, -1.05, .9, -.72, 1.8);
    shape.lineTo(.72, 1.8); shape.bezierCurveTo(1.05, .9, 1.05, -1.65, 0, -2.5);
    const hullGeo = new THREE.ExtrudeGeometry(shape, { depth: .65, bevelEnabled: true, bevelSize: .15, bevelThickness: .15, bevelSegments: 2, steps: 1 });
    hullGeo.rotateX(Math.PI / 2);
    mesh(hullGeo, m.white, 0, .15, 0, group);
    const inside = mesh(new THREE.ShapeGeometry(shape), m.boat, 0, .18, 0, group); inside.rotation.x = -Math.PI / 2; inside.scale.set(.8, .88, 1);
    for (const zz of [-1.1, .1, 1.1]) box(0, .29, zz, 1.55, .09, .3, m.wood, group);
    if (sail) {
      cylinder(0, 3, 0, .035, .06, 6, m.wood, 8, group);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([.08, 1, 0, .08, 5.9, 0, 2.4, 1.2, 0], 3));
      g.computeVertexNormals();
      const mat = m.cloth.clone(); mat.side = THREE.DoubleSide; mesh(g, mat, 0, 0, 0, group);
    }
    boats.push({ group, phase: random() * 6 });
  }
  boat(-20, 10, 1.1, .1); boat(-29, 11, .9, -.18); boat(-21, -24, 1.1, .4, true);
  boat(-55, -52, 1.4, .8, true); boat(-47, 34, 1.2, -.5, true);

  // Shore boulders, individually deformed to avoid regular polyhedral silhouettes.
  for (let i = 0; i < 67; i++) {
    const g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position;
    for (let j = 0; j < p.count; j++) { v.fromBufferAttribute(p, j).multiplyScalar(.82 + random() * .35); p.setXYZ(j, v.x, v.y, v.z); }
    g.computeVertexNormals();
    const rock = mesh(g, m.rock, -12.2 - random() * 2.1, -1, -100 + i * 3.1);
    rock.scale.set(1 + random(), .7 + random(), 1 + random()); rock.rotation.set(random(), random(), random());
  }
  // Distant coast: rounded relief, aerial perspective, and no artificial world edge.
  for (let i = 0; i < 12; i++) {
    const hill = mesh(new THREE.SphereGeometry(1, 28, 16), m.foliage, 130 + i * 20, -15, -200 + i * 30);
    hill.scale.set(65, 45 + random() * 40, 80); hill.castShadow = false;
  }
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group(); scene.add(g);
    for (const side of [-1, 1]) {
      const wing = mesh(new THREE.SphereGeometry(.2, 5, 3), m.white, side * .24, 0, 0, g);
      wing.scale.set(2, .1, .5);
    }
    birds.push({ group: g, phase: i * 1.8, radius: 16 + i * 5 });
  }

  // Merge static geometry by material: thousands of architectural details, few draw calls.
  staticRoot.updateMatrixWorld(true);
  staticRoot.traverse(obj => {
    if (!obj.isMesh) return;
    let geo = obj.geometry.clone();
    if (geo.index) { const indexed = geo; geo = geo.toNonIndexed(); indexed.dispose(); }
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(geo.attributes.position.count * 2).fill(0), 2));
    for (const name of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geo.deleteAttribute(name);
    geo.applyMatrix4(obj.matrixWorld);
    if (!batch.has(obj.material)) batch.set(obj.material, []);
    batch.get(obj.material).push(geo);
    obj.geometry.dispose();
  });
  scene.remove(staticRoot);
  const cameraObstacles = [];
  for (const [material, geometries] of batch) {
    const merged = mergeGeometries(geometries, false);
    if (!merged) throw new Error('World geometry could not be assembled.');
    const obj = new THREE.Mesh(merged, material); obj.castShadow = obj.receiveShadow = true; scene.add(obj);
    geometries.forEach(g => g.dispose());
  }
  // Lightweight, invisible proxy boxes used only by the camera raycast.
  for (const b of buildings) {
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(b.w, 18, b.d));
    proxy.position.set(b.x, 9, b.z); proxy.updateMatrixWorld(); cameraObstacles.push(proxy);
  }

  const hdr = await new HDRLoader(manager).loadAsync('/assets/coastal-sky.hdr');
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromEquirectangular(hdr);
  scene.environment = environment.texture; scene.environmentIntensity = .55;
  scene.background = hdr; scene.backgroundIntensity = .48;
  scene.backgroundRotation.y = 1.15;
  pmrem.dispose();
  scene.fog = new THREE.FogExp2('#b5cccf', .0024);
  const sunPosition = new THREE.Vector3(-100, 95, -130);
  scene.add(new THREE.HemisphereLight('#bed9e4', '#97876b', .7));
  const sun = new THREE.DirectionalLight('#ffe2b0', 3.4);
  sun.position.copy(sunPosition); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 360;
  sun.shadow.camera.left = -48; sun.shadow.camera.right = 48;
  sun.shadow.camera.top = 48; sun.shadow.camera.bottom = -48;
  sun.shadow.bias = -.00012; sun.shadow.normalBias = .035;
  sun.shadow.radius = 3;
  scene.add(sun); scene.add(sun.target);

  const waterNormals = await new THREE.TextureLoader(manager).loadAsync('/assets/waternormals.jpg');
  waterNormals.wrapS = waterNormals.wrapT = THREE.RepeatWrapping;
  const water = new Water(new THREE.PlaneGeometry(4000, 4000), {
    textureWidth: 512, textureHeight: 512, waterNormals,
    sunDirection: sunPosition.clone().normalize(), sunColor: '#ffe8c5', waterColor: '#087b80',
    distortionScale: 3.2, fog: true, alpha: 1,
  });
  water.rotation.x = -Math.PI / 2; water.position.y = -1.05; scene.add(water);
  water.material.uniforms.size.value = 5;
  const fountainDrops = new Float32Array(170 * 3);
  const drops = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: '#dcefed', size: .04, transparent: true, opacity: .68 }));
  drops.geometry.setAttribute('position', new THREE.BufferAttribute(fountainDrops, 3)); scene.add(drops);

  return {
    obstacles, buildings, cameraObstacles, sun, water, landmarks: LANDMARKS,
    update(time, playerPosition) {
      water.material.uniforms.time.value = time * .45;
      boats.forEach(({ group, phase }) => { group.position.y = -.76 + Math.sin(time * 1.25 + phase) * .08; group.rotation.z = Math.sin(time * .7 + phase) * .035; });
      birds.forEach(({ group, phase, radius }) => {
        const a = time * .055 + phase; group.position.set(-34 + Math.cos(a) * radius, 15 + Math.sin(a * 2) * 2, -28 + Math.sin(a) * radius);
        group.rotation.y = -a; group.children.forEach((w, i) => { w.rotation.z = Math.sin(time * 2.5 + phase) * .22 * (i ? 1 : -1); });
      });
      for (let i = 0; i < 170; i++) {
        const t = (time * .6 + i / 170) % 1, a = i * 2.3999;
        fountainDrops[i * 3] = 25 + Math.cos(a) * (.18 + t * 1.45);
        fountainDrops[i * 3 + 1] = 2.5 + Math.sin(t * Math.PI) * .7 - t * 1.8;
        fountainDrops[i * 3 + 2] = -39 + Math.sin(a) * (.18 + t * 1.45);
      }
      drops.geometry.attributes.position.needsUpdate = true;
      // A player-centered shadow volume preserves detail along the entire promenade.
      sun.position.copy(playerPosition).add(sunPosition);
      sun.target.position.copy(playerPosition); sun.target.updateMatrixWorld();
    },
  };
}
