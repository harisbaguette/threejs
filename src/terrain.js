import * as THREE from 'three';
import { seededRandom } from './journey.js';
import { box, material, createHouse } from './models.js';

export function riverX(z) { return -16 + Math.sin(z * .026) * 11 + Math.sin(z * .064) * 3; }
export function riverWidth(z) { return 6 + Math.sin(z * .047) * 1.8; }

export function createRoute() {
  return new THREE.CatmullRomCurve3([
    new THREE.Vector3(9, 5, -76), new THREE.Vector3(20, 6, -48),
    new THREE.Vector3(18, 7, -12), new THREE.Vector3(7, 8, 22),
    new THREE.Vector3(-9, 9, 47), new THREE.Vector3(-36, 11, 66),
    new THREE.Vector3(-58, 13, 46), new THREE.Vector3(-61, 11, 8),
    new THREE.Vector3(-47, 9, -32), new THREE.Vector3(-34, 6, -69),
    new THREE.Vector3(-11, 5, -88),
  ], true, 'catmullrom', .28);
}

export function makeTerrainSampler(route) {
  const samples = route.getSpacedPoints(480);
  function nearestTrack(x, z) {
    let distance = Infinity, height = 0;
    for (const point of samples) {
      const d = (point.x - x) ** 2 + (point.z - z) ** 2;
      if (d < distance) { distance = d; height = point.y; }
    }
    return { distance: Math.sqrt(distance), height };
  }
  function heightAt(x, z) {
    const bank = Math.abs(x - riverX(z)) - riverWidth(z);
    if (bank < 0) return -.8 + bank * .05;
    const hills = Math.sin(x * .046 + z * .022) * 8 + Math.sin(z * .066 - x * .033) * 5;
    const base = Math.min(bank * .55, 43) + hills * Math.min(bank / 22, 1);
    const track = nearestTrack(x, z);
    const influence = 1 - THREE.MathUtils.smoothstep(track.distance, 2.4, 10);
    const flattened = THREE.MathUtils.lerp(Math.max(.25, base), track.height - .48, influence);
    return flattened * THREE.MathUtils.smoothstep(bank, 0, 3.5);
  }
  return { heightAt, nearestTrack };
}

function createGround(parent, sampler) {
  const geo = new THREE.PlaneGeometry(340, 380, 160, 176);
  geo.rotateX(-Math.PI / 2);
  const vertices = geo.attributes.position;
  const colors = [];
  const c = new THREE.Color();
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i), z = vertices.getZ(i);
    const y = sampler.heightAt(x, z);
    vertices.setY(i, y);
    const noise = Math.sin(x * .15 + z * .072) * Math.sin(z * .19) * .05;
    const bank = Math.abs(x - riverX(z)) - riverWidth(z);
    if (bank < 3) c.set('#c6c5a1');
    else c.setHSL(.23 + noise * .2, .38 + noise, .34 + noise + Math.max(0, y - 28) * .001, THREE.SRGBColorSpace);
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const pixels = new Uint8Array(64 * 64 * 4), random = seededRandom(551);
  for (let i = 0; i < 64 * 64; i++) {
    const shade = Math.round(210 + random() * 45);
    pixels.set([shade, shade, shade, 255], i * 4);
  }
  const texture = new THREE.DataTexture(pixels, 64, 64);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true; texture.repeat.set(24, 28); texture.needsUpdate = true;
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: texture, vertexColors: true, roughness: 1, flatShading: true }));
  ground.receiveShadow = true;
  parent.add(ground);
}

function createWater(parent) {
  const positions = [], uvs = [], indices = [];
  const segments = 380;
  for (let i = 0; i <= segments; i++) {
    const z = -190 + i;
    for (const side of [-1, 1]) {
      positions.push(riverX(z) + side * (riverWidth(z) + .35), .08, z);
      uvs.push((side + 1) / 2, i / segments);
    }
    if (i < segments) {
      const a = i * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices); geo.computeVertexNormals();
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uDeep: { value: new THREE.Color('#287d80') }, uLight: { value: new THREE.Color('#a3e1d6') }, uNight: { value: 0 } },
    vertexShader: `varying vec2 vUv; varying vec3 vWorld; void main(){ vUv=uv; vec4 p=modelMatrix*vec4(position,1.); vWorld=p.xyz; gl_Position=projectionMatrix*viewMatrix*p; }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uDeep; uniform vec3 uLight; uniform float uNight;
      varying vec2 vUv; varying vec3 vWorld;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){
        float flow=vWorld.z*.68+uTime*.75;
        float wave=sin(vWorld.x*2.3+sin(flow*.7))*sin(flow*1.4);
        float detail=sin(vWorld.x*7.+flow*.7)*sin(flow*4.3);
        float banks=pow(abs(vUv.x-.5)*2.,10.);
        float sparkle=smoothstep(.91,1.,wave)*smoothstep(.2,.75,detail);
        vec2 cell=vec2(vWorld.x*2.1,vWorld.z*.65+uTime*.5);
        float grain=hash(floor(cell));
        vec2 local=fract(cell);
        float ripples=step(.84,grain)*smoothstep(.17,.02,abs(local.x-.5))*smoothstep(.45,.06,abs(local.y-.5));
        vec3 color=mix(uDeep,uLight,.12+wave*.06+banks*.55+ripples*.7);
        color+=vec3(sparkle*.2)*(1.-uNight*.6);
        color=mix(color,uLight,banks*.25);
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const water = new THREE.Mesh(geo, mat);
  parent.add(water);
  return mat;
}

function makeForest(parent, sampler) {
  const random = seededRandom(732);
  const trunkGeo = new THREE.CylinderGeometry(.14, .23, 1, 5);
  trunkGeo.translate(0, .5, 0);
  const leafGeo = new THREE.IcosahedronGeometry(1, 1);
  const pineGeo = new THREE.ConeGeometry(1, 1, 7);
  const trees = [], rocks = [];
  for (let i = 0; i < 5500; i++) {
    const x = (random() - .5) * (i < 3600 ? 180 : 310), z = (random() - .5) * (i < 3600 ? 250 : 350);
    const bank = Math.abs(x - riverX(z)) - riverWidth(z);
    const track = sampler.nearestTrack(x, z);
    if (bank < 3.7 || track.distance < 4 || (x > 12 && x < 35 && z > -43 && z < -26)) continue;
    trees.push({ x, z, y: sampler.heightAt(x, z), scale: 2.3 + random() * 3.2, pine: random() < .3, hue: random(), rot: random() * 6.28 });
  }
  const trunks = new THREE.InstancedMesh(trunkGeo, material('#6b6750'), trees.length);
  const leaves = new THREE.InstancedMesh(leafGeo, material('#ffffff', { flatShading: true }), trees.length * 4);
  const pines = new THREE.InstancedMesh(pineGeo, material('#ffffff', { flatShading: true }), trees.length * 3);
  const dummy = new THREE.Object3D(), color = new THREE.Color();
  let leafIndex = 0, pineIndex = 0;
  trees.forEach((t, index) => {
    dummy.position.set(t.x, t.y, t.z); dummy.scale.set(.85, t.scale, .85); dummy.rotation.set(0, t.rot, 0); dummy.updateMatrix();
    trunks.setMatrixAt(index, dummy.matrix);
    if (t.pine) {
      for (let n = 0; n < 3; n++) {
        dummy.position.set(t.x, t.y + t.scale * (.57 + n * .35), t.z);
        dummy.scale.set(t.scale * (.43 - n * .1), t.scale * .95, t.scale * (.43 - n * .1)); dummy.updateMatrix();
        pines.setMatrixAt(pineIndex, dummy.matrix);
        color.setHSL(.32 + t.hue * .04, .30, .21 + n * .035 + t.hue * .04, THREE.SRGBColorSpace);
        pines.setColorAt(pineIndex++, color);
      }
    } else {
      for (let n = 0; n < 4; n++) {
        const a = n * 2.4 + t.rot;
        dummy.position.set(t.x + Math.sin(a) * t.scale * .24, t.y + t.scale * (.76 + n * .105), t.z + Math.cos(a) * t.scale * .24);
        dummy.scale.set(t.scale * .43, t.scale * .39, t.scale * .4); dummy.updateMatrix();
        leaves.setMatrixAt(leafIndex, dummy.matrix);
        color.setHSL(t.hue > .84 ? .095 : .23 + t.hue * .025, .40 + t.hue * .12, .32 + n * .016 + t.hue * .065, THREE.SRGBColorSpace);
        leaves.setColorAt(leafIndex++, color);
      }
    }
  });
  leaves.count = leafIndex; pines.count = pineIndex;
  for (const mesh of [trunks, leaves, pines]) { mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); }
  for (let i = 0; i < 780; i++) {
    let z = (random() - .5) * 310;
    let x = i < 440 ? riverX(z) + (random() > .5 ? 1 : -1) * (riverWidth(z) + random() * 5) : (random() - .5) * 260;
    if (sampler.nearestTrack(x, z).distance < 2.7) continue;
    rocks.push({ x, z, y: sampler.heightAt(x, z), scale: .4 + random() * 2.4 });
  }
  const rockMesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), material('#9a9f8c', { flatShading: true }), rocks.length);
  rocks.forEach((r, i) => {
    dummy.position.set(r.x, r.y + r.scale * .2, r.z); dummy.scale.set(r.scale, r.scale * .65, r.scale * .8); dummy.rotation.set(random(), random() * 6, random()); dummy.updateMatrix();
    rockMesh.setMatrixAt(i, dummy.matrix); color.setHSL(.16, .07, .4 + random() * .18); rockMesh.setColorAt(i, color);
  });
  rockMesh.castShadow = true; rockMesh.receiveShadow = true; parent.add(rockMesh);
  return trees.length;
}

function createTrack(parent, route, sampler) {
  const rail = material('#626961', { metalness: .35, roughness: .55 });
  const sleeper = material('#746c52');
  const length = route.getLength();
  const count = Math.ceil(length / .72);
  const ties = new THREE.InstancedMesh(new THREE.BoxGeometry(3.1, .18, .34), sleeper, count);
  const dummy = new THREE.Object3D();
  const up = new THREE.Vector3(0, 1, 0);
  const points = [[], []];
  for (let i = 0; i <= count; i++) {
    const t = i / count, p = route.getPointAt(t), tangent = route.getTangentAt(t);
    const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
    for (let side = 0; side < 2; side++) points[side].push(p.clone().addScaledVector(normal, side === 0 ? -.89 : .89));
    if (i < count) {
      dummy.position.copy(p); dummy.position.y -= .15; dummy.rotation.y = Math.atan2(tangent.x, tangent.z); dummy.updateMatrix(); ties.setMatrixAt(i, dummy.matrix);
    }
  }
  ties.castShadow = true; ties.receiveShadow = true; parent.add(ties);
  for (const line of points) {
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(line, true), 800, .065, 5, true), rail);
    mesh.castShadow = true; parent.add(mesh);
  }
  // A ribbon keeps the track bed flat even where the railway curves.
  const bedPositions = [], bedIndices = [];
  for (let i = 0; i <= 650; i++) {
    const p = route.getPointAt(i / 650), dir = route.getTangentAt(i / 650);
    const normal = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    for (const side of [-1, 1]) bedPositions.push(p.x + normal.x * side * 1.82, p.y - .25, p.z + normal.z * side * 1.82);
    if (i < 650) { const a = i * 2; bedIndices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const bedGeo = new THREE.BufferGeometry(); bedGeo.setAttribute('position', new THREE.Float32BufferAttribute(bedPositions, 3)); bedGeo.setIndex(bedIndices); bedGeo.computeVertexNormals();
  const ribbon = new THREE.Mesh(bedGeo, material('#aaa48a', { side: THREE.DoubleSide })); ribbon.receiveShadow = true; parent.add(ribbon);
  createViaduct(parent, route, sampler);
  createPoles(parent, route);
  return length;
}

function createViaduct(parent, route, sampler) {
  const stone = material('#c0b79d');
  const n = 95;
  for (let i = 0; i < n; i++) {
    const a = route.getPointAt(i / n), b = route.getPointAt((i + 1) / n);
    const mid = a.clone().lerp(b, .5);
    const gap = mid.y - sampler.heightAt(mid.x, mid.z);
    if (gap < 1.4) continue;
    const width = a.distanceTo(b) + .15, top = mid.y - .29;
    const s = new THREE.Shape();
    s.moveTo(-width / 2, 0); s.lineTo(-width / 2, top); s.lineTo(width / 2, top); s.lineTo(width / 2, 0);
    s.lineTo(width * .34, 0); s.lineTo(width * .34, top - 2.1);
    s.quadraticCurveTo(0, top + .2, -width * .34, top - 2.1); s.lineTo(-width * .34, 0); s.closePath();
    const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 3.3, bevelEnabled: false }), stone);
    mesh.position.set(mid.x, 0, mid.z); mesh.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
    mesh.geometry.translate(0, 0, -1.65); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh);
  }
}

function createPoles(parent, route) {
  const poleMat = material('#5c695b');
  const cables = [];
  for (let i = 0; i < 35; i++) {
    const p = route.getPointAt(i / 35), tangent = route.getTangentAt(i / 35);
    const pole = new THREE.Group(); pole.position.copy(p); pole.rotation.y = Math.atan2(tangent.x, tangent.z);
    box(pole, [.13, 6.3, .13], [2.8, 2.85, 0], poleMat);
    box(pole, [3.45, .1, .1], [1.1, 5.9, 0], poleMat);
    box(pole, [.12, .65, .12], [0, 5.65, 0], material('#c7c6b1'));
    parent.add(pole); cables.push(new THREE.Vector3(p.x, p.y + 5.45, p.z));
  }
  const wire = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cables, true), 500, .025, 3, true), poleMat);
  parent.add(wire);
}

function createVillage(parent, sampler, windows) {
  for (const [x, z, scale, color] of [[28, -34, 1, '#8b6550'], [33, -29, .72, '#756452'], [25, -42, .8, '#a8754e']]) {
    createHouse(parent, [x, sampler.heightAt(x, z), z], scale, windows, color);
  }
  const y = sampler.heightAt(23, -34);
  box(parent, [3.2, .35, 14], [22.8, y + .12, -34], material('#c4bfaa'));
  box(parent, [.12, 3.3, .12], [22, y + 1.75, -30], material('#536751'));
  box(parent, [2.1, .55, .12], [22, y + 3.1, -30], material('#e7e0c3'));
}

export function createLandscape(parent, route, windows) {
  const sampler = makeTerrainSampler(route);
  createGround(parent, sampler);
  const water = createWater(parent);
  const treeCount = makeForest(parent, sampler);
  const length = createTrack(parent, route, sampler);
  createVillage(parent, sampler, windows);
  return { water, length, treeCount, sampler };
}
