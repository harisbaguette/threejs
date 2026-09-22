import * as THREE from 'three';
import { box, cylinder, tube, sign, boardTexture, materials as m, batch, seededRandom } from './materials.js';

function windowTexture(cab = false) {
  return boardTexture((ctx, w, h) => {
    const gradient = ctx.createLinearGradient(0, 0, w * .35, h);
    gradient.addColorStop(0, cab ? '#52666b' : '#7c8b86');
    gradient.addColorStop(.42, cab ? '#23363c' : '#344b4b');
    gradient.addColorStop(1, '#111e23');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
    if (!cab) {
      ctx.fillStyle = '#b2a87b'; ctx.fillRect(0, h * .055, w, h * .034);
      ctx.fillStyle = '#252e2c'; ctx.fillRect(0, h * .68, w, h * .32);
      ctx.fillStyle = '#515c50'; ctx.fillRect(w * .07, h * .66, w * .86, h * .1);
      ctx.strokeStyle = '#93a49a'; ctx.lineWidth = 2;
      for (const x of [.22, .78]) {
        ctx.beginPath(); ctx.moveTo(w * x, h * .1); ctx.lineTo(w * x, h * .28); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(w * x, h * .31, w * .035, h * .036, 0, 0, Math.PI * 2); ctx.stroke();
      }
    } else {
      ctx.fillStyle = '#101c20'; ctx.fillRect(0, h * .85, w, h * .15);
      ctx.fillStyle = '#1d2d2e'; ctx.fillRect(w * .25, h * .78, w * .48, h * .08);
    }
    ctx.fillStyle = '#9cafad1a'; ctx.beginPath();
    ctx.moveTo(0, h * .12); ctx.lineTo(w, h * .35); ctx.lineTo(w, h * .53); ctx.lineTo(0, h * .29); ctx.fill();
    const random = seededRandom(cab ? 42 : 24);
    ctx.strokeStyle = '#b3c4ba25'; ctx.lineWidth = .65;
    for (let i = 0; i < 80; i++) {
      const x = random() * w, y = random() * h;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 1, y + 2 + random() * 6); ctx.stroke();
    }
  }, 256, 320);
}

function destinationTexture() {
  return boardTexture((ctx, w, h) => {
    ctx.fillStyle = '#162c28'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f3e2a7'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '500 180px "Hiragino Sans", sans-serif'; ctx.fillText('海 岸 線', w / 2, h * .44);
    ctx.font = '46px sans-serif'; ctx.fillText('SHIOSAI  •  LOCAL', w / 2, h * .83);
    ctx.fillStyle = '#17251c55';
    for (let y = 0; y < h; y += 5) ctx.fillRect(0, y, w, 1);
  });
}

function makeRoof(car) {
  const shape = new THREE.Shape();
  shape.moveTo(-1.4, 0); shape.quadraticCurveTo(-1.35, .52, 0, .55);
  shape.quadraticCurveTo(1.35, .52, 1.4, 0); shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 17.45, bevelEnabled: true, bevelSize: .025, bevelThickness: .025, bevelSegments: 2, curveSegments: 20, steps: 1 });
  geometry.translate(0, 3.51, -8.725);
  const roof = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: '#63706a', metalness: .55, roughness: .46 }));
  roof.castShadow = true; car.add(roof);
  for (const z of [-5.8, -2.9, 2.9, 5.8]) {
    box(car, [1.1, .12, .8], [0, 4.04, z], m.steel, .08);
    for (let n = 0; n < 5; n++) box(car, [.88, .035, .035], [0, 4.12, z - .28 + n * .14], m.iron);
  }
  box(car, [1, .1, 1.5], [0, 4.02, 0], m.dark, .04);
  for (const x of [-.4, .4]) {
    tube(car, [[x, 4.1, -.8], [x, 4.7, 0], [x, 5.3, -.8]], .035, m.iron, 6);
    tube(car, [[x, 4.1, .6], [x, 4.7, 0], [x, 5.3, -.8]], .035, m.iron, 6);
  }
  box(car, [1.45, .045, .12], [0, 5.33, -.8], m.steel);
}

function makeUndercarriage(car) {
  box(car, [2.48, .28, 17.1], [0, .89, 0], m.dark, .045);
  for (const z of [-5.8, 5.8]) {
    box(car, [1.8, .37, 2.65], [0, .76, z], m.iron, .09);
    for (const dz of [-.85, .85]) {
      const axle = cylinder(car, .075, 1.62, [0, .68, z + dz], m.iron); axle.rotation.z = Math.PI / 2;
      for (const x of [-.64, .64]) {
        const wheel = cylinder(car, .34, .15, [x, .68, z + dz], m.dark, .34, 28); wheel.rotation.z = Math.PI / 2;
        const flange = cylinder(car, .365, .035, [x * .88, .68, z + dz], m.steel, .365, 28); flange.rotation.z = Math.PI / 2;
      }
    }
    for (const side of [-1, 1]) {
      for (const dz of [-.75, .75]) box(car, [.15, .3, .5], [side * .95, .79, z + dz], m.dark, .06);
    }
  }
  for (const z of [-3.3, 0, 3.1]) box(car, [1.4, .44, 1.6], [0, .48, z], m.dark, .05);
  box(car, [.25, .25, 1.1], [0, .72, 8.95], m.iron, .025);
}

function makeCar(index, lights) {
  const car = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color: '#284b3c', metalness: .32, roughness: .32, clearcoat: .7, clearcoatRoughness: .22 });
  const ivory = new THREE.MeshPhysicalMaterial({ color: '#d6d3ba', metalness: .16, roughness: .4, clearcoat: .35 });
  const windows = windowTexture();
  const glass = new THREE.MeshPhysicalMaterial({ map: windows, metalness: .18, roughness: .18, clearcoat: 1, envMapIntensity: .35, emissiveMap: windows, emissive: '#e0d3ae', emissiveIntensity: .08 });
  const cabGlass = new THREE.MeshPhysicalMaterial({ map: windowTexture(true), metalness: .1, roughness: .15, clearcoat: 1, envMapIntensity: .22 });
  lights.windows.push(glass);
  box(car, [2.72, 1.02, 17.4], [0, 1.51, 0], paint, .11);
  box(car, [2.72, 1.52, 17.4], [0, 2.72, 0], ivory, .1);
  box(car, [2.78, .085, 17.42], [0, 1.99, 0], m.cream, .02);
  box(car, [2.77, .035, 17.4], [0, 1.81, 0], m.steel, .01);
  for (const side of [-1, 1]) {
    for (let j = 0; j < 12; j++) {
      const z = -7.52 + j * 1.365;
      box(car, [.075, 1.18, 1.08], [side * 1.37, 2.71, z], m.dark, .035);
      box(car, [.082, 1.08, .98], [side * 1.408, 2.72, z], glass, .025);
      box(car, [.092, .045, 1.02], [side * 1.414, 2.7, z], m.steel);
    }
    for (const z of [-4.11, 4.08]) {
      box(car, [.12, 2.28, 1.36], [side * 1.405, 2.16, z], ivory, .025);
      for (const dz of [-.34, .34]) {
        box(car, [.13, 1.12, .47], [side * 1.42, 2.72, z + dz], m.dark, .04);
        box(car, [.135, 1, .39], [side * 1.44, 2.72, z + dz], glass, .035);
      }
      box(car, [.145, 2.12, .02], [side * 1.44, 2.17, z], m.iron);
      box(car, [.23, .09, 1.45], [side * 1.43, 1.04, z], m.steel);
    }
    const label = boardTexture((ctx,w,h) => {
      ctx.fillStyle='#284b3c'; ctx.fillRect(0,0,w,h); ctx.fillStyle='#d0ccad'; ctx.textAlign='center';
      ctx.font='100px "Hiragino Mincho ProN",serif'; ctx.fillText('潮 騒 電 鉄',w/2,h*.55);
      ctx.font='42px sans-serif'; ctx.fillText('S H I O S A I   R A I L W A Y',w/2,h*.85);
    });
    sign(car, [2.15, .47], [side * 1.425, 1.45, 0], label, { rotation: side * Math.PI / 2, emissive: 0 });
  }
  for (const x of [-.78, .78]) {
    box(car, [.95, 1.14, .07], [x, 2.76, 8.72], m.dark, .06);
    box(car, [.84, 1.03, .08], [x, 2.77, 8.76], cabGlass, .055);
    tube(car, [[x-.27,2.33,8.82],[x+.11,2.92,8.82],[x+.25,3.04,8.82]], .015, m.dark, 6);
  }
  box(car, [.53, 2.38, .09], [0, 2.16, 8.73], paint, .035);
  box(car, [.39, 1.11, .1], [0, 2.78, 8.8], cabGlass, .025);
  box(car, [2.5, .22, .19], [0, 1.03, 8.74], m.dark, .045);
  sign(car, [1.6, .38], [0, 3.49, 8.73], destinationTexture(), { emissive: .75 });
  const number = boardTexture((ctx,w,h) => { ctx.fillStyle='#284b3c';ctx.fillRect(0,0,w,h);ctx.fillStyle='#dad2b1';ctx.textAlign='center';ctx.font='160px serif';ctx.fillText(String(3001+index),w/2,h*.72); });
  sign(car, [.54, .21], [-.75, 1.7, 8.78], number, { emissive: 0 });
  for (const x of [-.96, .96]) {
    const ring = cylinder(car, .16, .09, [x, 1.45, 8.8], m.steel, .16, 24); ring.rotation.x = Math.PI/2;
    const bulb = cylinder(car, .115, .095, [x, 1.45, 8.85], m.bulb, .115, 24); bulb.rotation.x = Math.PI/2;
    if (index === 0) {
      const light = new THREE.SpotLight('#ffdfae', 36, 60, .28, .6, 1.6);
      light.position.set(x,1.45,8.94); light.target.position.set(x,.2,32); car.add(light,light.target); lights.headlights.push(light);
    }
  }
  makeRoof(car); makeUndercarriage(car); batch(car);
  return car;
}

export function createTrain(scene, lights) {
  const train = new THREE.Group(); train.userData.dynamic = true;
  for (let i=0;i<2;i++) { const car=makeCar(i,lights); car.position.z=-i*18.1; train.add(car); }
  for (let i=0;i<9;i++) box(train,[2.05,2.45,.08],[0,2.13,-8.83-i*.045],m.dark,.07);
  scene.add(train); return train;
}
