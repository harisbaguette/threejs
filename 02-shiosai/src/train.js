import * as THREE from "three";
import {
  box,
  cylinder,
  tube,
  sign,
  boardTexture,
  materials as m,
  batch,
} from "./materials.js";
import { createBody } from "./train-body.js";

function destinationTexture() {
  return boardTexture((ctx, w, h) => {
    ctx.fillStyle = "#162c28";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#f3e2a7";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = '500 180px "Hiragino Sans", sans-serif';
    ctx.fillText("海 岸 線", w / 2, h * 0.44);
    ctx.font = "46px sans-serif";
    ctx.fillText("SHIOSAI  •  LOCAL", w / 2, h * 0.83);
    ctx.fillStyle = "#17251c55";
    for (let y = 0; y < h; y += 5) ctx.fillRect(0, y, w, 1);
  });
}

function makeRoof(car) {
  const shape = new THREE.Shape();
  shape.moveTo(-1.4, 0);
  shape.quadraticCurveTo(-1.35, 0.52, 0, 0.55);
  shape.quadraticCurveTo(1.35, 0.52, 1.4, 0);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 17.45,
    bevelEnabled: true,
    bevelSize: 0.025,
    bevelThickness: 0.025,
    bevelSegments: 2,
    curveSegments: 20,
    steps: 1,
  });
  geometry.translate(0, 3.51, -8.725);
  const roof = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: "#63706a",
      metalness: 0.55,
      roughness: 0.46,
    }),
  );
  roof.castShadow = true;
  car.add(roof);
  for (const z of [-5.8, -2.9, 2.9, 5.8]) {
    box(car, [1.1, 0.12, 0.8], [0, 4.04, z], m.steel, 0.08);
    for (let n = 0; n < 5; n++)
      box(car, [0.88, 0.035, 0.035], [0, 4.12, z - 0.28 + n * 0.14], m.iron);
  }
  box(car, [1, 0.1, 1.5], [0, 4.02, 0], m.dark, 0.04);
  for (const x of [-0.4, 0.4]) {
    tube(
      car,
      [
        [x, 4.1, -0.8],
        [x, 4.7, 0],
        [x, 5.3, -0.8],
      ],
      0.035,
      m.iron,
      6,
    );
    tube(
      car,
      [
        [x, 4.1, 0.6],
        [x, 4.7, 0],
        [x, 5.3, -0.8],
      ],
      0.035,
      m.iron,
      6,
    );
  }
  box(car, [1.45, 0.045, 0.12], [0, 5.33, -0.8], m.steel);
}

function makeUndercarriage(car) {
  box(car, [2.48, 0.28, 17.1], [0, 0.89, 0], m.dark, 0.045);
  for (const z of [-5.8, 5.8]) {
    box(car, [1.8, 0.37, 2.65], [0, 0.76, z], m.iron, 0.09);
    for (const dz of [-0.85, 0.85]) {
      const axle = cylinder(car, 0.075, 1.62, [0, 0.68, z + dz], m.iron);
      axle.rotation.z = Math.PI / 2;
      for (const x of [-0.64, 0.64]) {
        const wheel = cylinder(
          car,
          0.34,
          0.15,
          [x, 0.68, z + dz],
          m.dark,
          0.34,
          28,
        );
        wheel.rotation.z = Math.PI / 2;
        const flange = cylinder(
          car,
          0.365,
          0.035,
          [x * 0.88, 0.68, z + dz],
          m.steel,
          0.365,
          28,
        );
        flange.rotation.z = Math.PI / 2;
      }
    }
    for (const side of [-1, 1]) {
      for (const dz of [-0.75, 0.75])
        box(car, [0.15, 0.3, 0.5], [side * 0.95, 0.79, z + dz], m.dark, 0.06);
    }
  }
  for (const z of [-3.3, 0, 3.1])
    box(car, [1.4, 0.44, 1.6], [0, 0.48, z], m.dark, 0.05);
  box(car, [0.25, 0.25, 1.1], [0, 0.72, 8.95], m.iron, 0.025);
}

function makeCar(index, lights) {
  const car = new THREE.Group();
  const paint = createBody(car, lights);
  for (const side of [-1, 1]) {
    const label = boardTexture((ctx, w, h) => {
      ctx.fillStyle = "#284b3c";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#d0ccad";
      ctx.textAlign = "center";
      ctx.font = '100px "Hiragino Mincho ProN",serif';
      ctx.fillText("潮 騒 電 鉄", w / 2, h * 0.55);
      ctx.font = "42px sans-serif";
      ctx.fillText("S H I O S A I   R A I L W A Y", w / 2, h * 0.85);
    });
    sign(car, [2.15, 0.47], [side * 1.425, 1.45, 0], label, {
      rotation: (side * Math.PI) / 2,
      emissive: 0,
    });
  }
  for (const x of [-0.78, 0.78]) {
    tube(
      car,
      [
        [x - 0.27, 2.33, 8.82],
        [x + 0.11, 2.92, 8.82],
        [x + 0.25, 3.04, 8.82],
      ],
      0.015,
      m.dark,
      6,
    );
  }
  box(car, [2.5, 0.22, 0.19], [0, 1.03, 8.74], m.dark, 0.045);
  sign(car, [1.6, 0.38], [0, 3.49, 8.73], destinationTexture(), {
    emissive: 0.75,
  });
  const number = boardTexture((ctx, w, h) => {
    ctx.fillStyle = "#284b3c";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#dad2b1";
    ctx.textAlign = "center";
    ctx.font = "160px serif";
    ctx.fillText(String(3001 + index), w / 2, h * 0.72);
  });
  sign(car, [0.54, 0.21], [-0.75, 1.7, 8.78], number, { emissive: 0 });
  for (const x of [-0.96, 0.96]) {
    const ring = cylinder(car, 0.16, 0.09, [x, 1.45, 8.8], m.steel, 0.16, 24);
    ring.rotation.x = Math.PI / 2;
    const bulb = cylinder(
      car,
      0.115,
      0.095,
      [x, 1.45, 8.85],
      m.bulb,
      0.115,
      24,
    );
    bulb.rotation.x = Math.PI / 2;
    if (index === 0) {
      const light = new THREE.SpotLight("#ffdfae", 36, 60, 0.28, 0.6, 1.6);
      light.position.set(x, 1.45, 8.94);
      light.target.position.set(x, 0.2, 32);
      car.add(light, light.target);
      lights.headlights.push(light);
    }
  }
  makeRoof(car);
  makeUndercarriage(car);
  batch(car);
  return car;
}

export function createTrain(scene, lights) {
  const train = new THREE.Group();
  train.userData.dynamic = true;
  for (let i = 0; i < 2; i++) {
    const car = makeCar(i, lights);
    car.position.z = -i * 18.1;
    train.add(car);
  }
  for (let i = 0; i < 9; i++)
    box(train, [2.05, 2.45, 0.08], [0, 2.13, -8.83 - i * 0.045], m.dark, 0.07);
  scene.add(train);
  return train;
}
