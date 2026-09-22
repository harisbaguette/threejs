import * as THREE from 'three';

const geometryCache = new Map();
const materialCache = new Map();

export function material(color, options = {}) {
  const key = `${color}${JSON.stringify(options)}`;
  if (!materialCache.has(key)) materialCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: .82, ...options }));
  return materialCache.get(key);
}

export function box(parent, size, position, mat, rotation = 0) {
  const key = size.join(',');
  if (!geometryCache.has(key)) geometryCache.set(key, new THREE.BoxGeometry(...size));
  const mesh = new THREE.Mesh(geometryCache.get(key), mat);
  mesh.position.set(...position);
  mesh.rotation.y = rotation;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function cylinder(parent, radiusTop, radiusBottom, height, position, mat, segments = 10) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), mat);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function makeCar(index, windows) {
  const car = new THREE.Group();
  const green = material('#294f42', { roughness: .46 });
  const cream = material('#e9deb6', { roughness: .58 });
  const roof = material('#586265', { roughness: .65 });
  const metal = material('#343e3b', { roughness: .5, metalness: .25 });
  const gold = material('#c19a50', { metalness: .35 });
  box(car, [2.2, .35, 6.05], [0, .8, 0], metal);
  box(car, [2.15, .88, 5.95], [0, 1.36, 0], green);
  box(car, [2.15, 1.04, 5.95], [0, 2.27, 0], cream);
  box(car, [2.2, .09, 6], [0, 1.78, 0], gold);
  box(car, [2.24, .22, 6.2], [0, 2.91, 0], roof);
  box(car, [1.84, .14, 5.94], [0, 3.07, 0], roof);
  const glass = material('#2b5055', { roughness: .3, metalness: .25, emissive: '#ffcb78', emissiveIntensity: .04 });
  windows.add(glass);
  for (const side of [-1, 1]) {
    for (let j = 0; j < 7; j++) {
      const z = -2.42 + j * .79;
      box(car, [.04, .73, .61], [side * 1.084, 2.28, z], metal);
      box(car, [.045, .61, .51], [side * 1.109, 2.29, z], glass);
      box(car, [.06, .045, .62], [side * 1.11, 2.17, z], cream);
    }
    box(car, [.05, 1.72, .13], [side * 1.09, 1.76, 2.73], gold);
    box(car, [.2, .12, 1.3], [side * 1.14, .82, 2.16], metal);
  }
  for (const z of [-1.94, 1.94]) {
    box(car, [1.65, .35, 1.27], [0, .57, z], metal);
    for (const dz of [-.39, .39]) {
      const wheel = cylinder(car, .36, .36, 2.05, [0, .37, z + dz], metal, 12);
      wheel.rotation.z = Math.PI / 2;
    }
  }
  box(car, [.6, .23, .68], [0, .92, -3.18], metal);
  box(car, [.6, .23, .68], [0, .92, 3.18], metal);
  for (const x of [-.53, .53]) box(car, [.75, .72, .06], [x, 2.27, 3], glass);
  box(car, [.08, .8, .09], [0, 2.28, 3.06], cream);
  if (index === 0) {
    const light = material('#fff4cd', { emissive: '#ffde97', emissiveIntensity: 1.5 });
    for (const x of [-.77, .77]) box(car, [.27, .21, .08], [x, 1.43, 3.025], light);
    box(car, [1.15, .23, .055], [0, 2.72, 3.03], metal);
    box(car, [.82, .085, .06], [0, 2.72, 3.07], light);
    const headlight = new THREE.SpotLight('#ffe0aa', 0, 60, .38, .55, 1);
    headlight.position.set(0, 1.4, 3.1);
    headlight.target.position.set(0, 0, 20);
    car.add(headlight, headlight.target);
    car.userData.headlight = headlight;
  }
  for (const z of [-1.6, 1.4]) box(car, [1.15, .16, .56], [0, 3.2, z], material('#85918b'));
  return car;
}

export function createTrain(parent, windows) {
  const cars = Array.from({ length: 5 }, (_, index) => makeCar(index, windows));
  cars.forEach(car => parent.add(car));
  return cars;
}

export function createHouse(parent, position, scale, windows, roofColor = '#a56743') {
  const house = new THREE.Group();
  house.position.set(...position);
  house.scale.setScalar(scale);
  box(house, [4.2, 2.8, 3.4], [0, 1.4, 0], material('#e2d8b8'));
  const gable = new THREE.Shape();
  gable.moveTo(-2.45, 0); gable.lineTo(0, 1.6); gable.lineTo(2.45, 0); gable.closePath();
  const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(gable, { depth: 4.1, bevelEnabled: false }), material(roofColor));
  roof.position.set(0, 2.8, -2.05);
  roof.castShadow = true;
  house.add(roof);
  for (const side of [-1, 1]) {
    for (const x of [-1.2, 1.2]) {
      const winMat = material('#739292', { emissive: '#ffc578', emissiveIntensity: .06 });
      windows.add(winMat);
      box(house, [.72, .95, .1], [x, 1.8, side * 1.74], material('#695941'));
      box(house, [.58, .78, .11], [x, 1.8, side * 1.79], winMat);
      box(house, [.055, .82, .12], [x, 1.8, side * 1.85], material('#dacfaa'));
    }
  }
  box(house, [.64, 1.7, .1], [0, .85, 1.75], material('#526953'));
  box(house, [.5, 1.5, .5], [1.1, 3.6, -.6], material('#b4a187'));
  parent.add(house);
  return house;
}
