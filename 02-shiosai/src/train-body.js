import * as THREE from "three";
import {
  box,
  tube,
  materials as m,
  boardTexture,
  seededRandom,
} from "./materials.js";

function enamel(color) {
  const grain = boardTexture(
    (ctx, w, h) => {
      ctx.fillStyle = "#e4e5df";
      ctx.fillRect(0, 0, w, h);
      const random = seededRandom(94);
      for (let i = 0; i < 2600; i++) {
        const shade = 178 + Math.floor(random() * 65);
        ctx.fillStyle = `rgba(${shade},${shade},${shade},.2)`;
        ctx.fillRect(random() * w, random() * h, 0.7, 1 + random() * 20);
      }
      const dirt = ctx.createLinearGradient(0, h * 0.7, 0, h);
      dirt.addColorStop(0, "#4c483600");
      dirt.addColorStop(1, "#4c483644");
      ctx.fillStyle = dirt;
      ctx.fillRect(0, 0, w, h);
    },
    256,
    256,
  );
  return new THREE.MeshPhysicalMaterial({
    color,
    map: grain,
    metalness: 0.22,
    roughness: 0.4,
    clearcoat: 0.38,
    clearcoatRoughness: 0.25,
  });
}

function windowFrame(car, width, height, position, rotation, glass) {
  const origin = new THREE.Vector3(...position);
  const rotationMatrix = new THREE.Matrix4().makeRotationY(rotation);
  for (const [size, offset] of [
    [
      [width + 0.1, 0.047, 0.05],
      [0, height / 2 + 0.023, 0],
    ],
    [
      [width + 0.1, 0.047, 0.05],
      [0, -height / 2 - 0.023, 0],
    ],
    [
      [0.045, height, 0.05],
      [-width / 2 - 0.022, 0, 0],
    ],
    [
      [0.045, height, 0.05],
      [width / 2 + 0.022, 0, 0],
    ],
  ]) {
    const p = new THREE.Vector3(...offset)
      .applyMatrix4(rotationMatrix)
      .add(origin);
    box(car, size, p.toArray(), m.dark, 0.012).rotation.y = rotation;
  }
  const transform = new THREE.Object3D();
  transform.position.copy(origin);
  transform.rotation.y = rotation;
  transform.scale.set(width, height, 1);
  transform.updateMatrix();
  if (!car.userData.windowFaces.has(rotation)) car.userData.windowFaces.set(rotation, []);
  car.userData.windowFaces.get(rotation).push(transform.matrix.clone());
}

function installGlass(car, glass) {
  // Coplanar panes do not overlap. Keep four faces sortable, batch each face.
  for (const matrices of car.userData.windowFaces.values()) {
    const panes = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), glass, matrices.length);
    matrices.forEach((matrix, i) => panes.setMatrixAt(i, matrix));
    panes.computeBoundingSphere();
    car.add(panes);
  }
  delete car.userData.windowFaces;
}

function interior(car, lights) {
  const lining = new THREE.MeshStandardMaterial({
    color: "#b6b8a6",
    roughness: 0.8,
    emissive: "#b8a687",
    emissiveIntensity: 0.1,
  });
  const seat = new THREE.MeshStandardMaterial({
    color: "#576a58",
    roughness: 0.95,
    emissive: "#626b4b",
    emissiveIntensity: 0.1,
  });
  lights.windows.push(lining, seat);
  box(car, [2.5, 0.08, 17.1], [0, 1.08, 0], m.dark);
  box(car, [2.55, 0.08, 16.95], [0, 3.47, 0], lining);
  for (const x of [-1, 1]) {
    box(car, [0.64, 0.18, 13.2], [x, 1.5, -0.7], seat, 0.07);
    box(car, [0.1, 0.57, 13.2], [x * 1.24, 1.82, -0.7], seat, 0.04);
    tube(
      car,
      [
        [x * 0.8, 3.14, -7.9],
        [x * 0.8, 3.14, 6.7],
      ],
      0.022,
      m.steel,
      2,
    );
    for (let z = -7.2; z < 6.5; z += 1.36) {
      tube(
        car,
        [
          [x * 0.8, 3.14, z],
          [x * 0.8, 2.95, z],
        ],
        0.012,
        m.dark,
        1,
      );
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.066, 0.01, 5, 12),
        lining,
      );
      ring.position.set(x * 0.8, 2.9, z);
      car.add(ring);
    }
  }
  for (const x of [-0.65, 0.65])
    box(car, [0.05, 0.035, 15.5], [x, 3.39, -0.4], m.bulb);
  box(car, [0.62, 0.17, 0.58], [-0.74, 1.59, 7.55], seat, 0.05);
  box(car, [0.62, 0.76, 0.12], [-0.74, 1.99, 7.31], seat, 0.05);
  box(car, [1.12, 0.28, 0.42], [-0.72, 2.13, 8.22], m.dark, 0.04);
  tube(
    car,
    [
      [-0.9, 2.29, 8.17],
      [-0.9, 2.48, 8.11],
      [-0.67, 2.48, 8.11],
    ],
    0.022,
    m.steel,
    5,
  );
  for (let i = 0; i < 4; i++)
    box(car, [0.06, 0.015, 0.07], [-1.06 + i * 0.16, 2.279, 8.25], lining);
}

function sideWall(car, side, paint, ivory, glass) {
  const x = side * 1.3;
  box(car, [0.14, 0.98, 17.4], [x, 1.51, 0], paint, 0.06);
  box(car, [0.14, 0.19, 17.4], [x, 2.105, 0], ivory);
  box(car, [0.14, 0.21, 17.4], [x, 3.385, 0], ivory, 0.03);
  const openings = [
    [-7.13, 1.05],
    [-5.71, 1.05],
    [-4.15, 1.25, true],
    [-2.57, 1.06],
    [-1.15, 1.06],
    [0.27, 1.06],
    [1.69, 1.06],
    [3.25, 1.25, true],
    [4.82, 1.06],
    [6.24, 1.06],
    [7.6, 0.8],
  ];
  let edge = -8.7;
  for (const [z, width, door] of openings) {
    const left = z - width / 2,
      gap = left - edge;
    box(car, [0.14, 1.08, gap], [x, 2.74, edge + gap / 2], ivory);
    windowFrame(
      car,
      width,
      1.08,
      [side * 1.383, 2.74, z],
      (side * Math.PI) / 2,
      glass,
    );
    if (door) {
      box(car, [0.035, 1.07, width + 0.06], [side * 1.391, 1.63, z], ivory);
      box(car, [0.06, 2.26, 0.025], [side * 1.42, 2.21, z], m.steel);
      box(car, [0.21, 0.065, width + 0.14], [side * 1.42, 1.08, z], m.steel);
    } else {
      box(car, [0.04, 0.035, width], [side * 1.402, 2.76, z], m.steel);
    }
    edge = z + width / 2;
  }
  box(car, [0.14, 1.08, 8.7 - edge], [x, 2.74, (8.7 + edge) / 2], ivory);
}

export function createBody(car, lights) {
  car.userData.windowFaces = new Map();
  const paint = enamel("#224b40"),
    ivory = enamel("#ded9bc");
  const glass = new THREE.MeshPhysicalMaterial({
    color: "#9cb8b3",
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    roughness: 0.12,
    metalness: 0.12,
    clearcoat: 0.9,
    envMapIntensity: 0.7,
    side: THREE.DoubleSide,
    forceSinglePass: true,
  });
  sideWall(car, -1, paint, ivory, glass);
  sideWall(car, 1, paint, ivory, glass);
  for (const z of [-8.66, 8.66]) {
    box(car, [2.72, 1.02, 0.16], [0, 1.51, z], paint, 0.06);
    box(car, [2.72, 0.19, 0.16], [0, 2.105, z], ivory);
    box(car, [2.72, 0.22, 0.16], [0, 3.38, z], ivory, 0.06);
    for (const x of [-1.29, -0.27, 0.27, 1.29])
      box(car, [0.14, 1.11, 0.16], [x, 2.745, z], ivory, 0.025);
    for (const x of [-0.77, 0.77])
      windowFrame(
        car,
        0.91,
        1.06,
        [x, 2.755, z > 0 ? 8.766 : -8.766],
        z > 0 ? 0 : Math.PI,
        glass,
      );
    box(car, [0.43, 1.07, 0.13], [0, 1.59, z * 1.015], paint, 0.02);
    windowFrame(
      car,
      0.39,
      1.06,
      [0, 2.755, z > 0 ? 8.79 : -8.79],
      z > 0 ? 0 : Math.PI,
      glass,
    );
  }
  for (const x of [-1.38, 1.38]) {
    box(car, [0.045, 0.065, 17.36], [x, 2, 0], m.cream, 0.015);
    box(car, [0.04, 0.025, 17.36], [x, 1.81, 0], m.steel);
  }
  interior(car, lights);
  installGlass(car, glass);
  return paint;
}
