import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createRoute, createLandscape, riverX } from './terrain.js';
import { createTrain, material } from './models.js';
import { advanceDistance, carriageDistance, seededRandom } from './journey.js';

const palettes = {
  day: { sky: '#78bad4', horizon: '#c9e1d9', fog: '#b9d0bc', sun: '#fff0c8', light: 3.1, ambient: 2.1, water: '#317c7d', foam: '#a0d4bd', cloud: '#fff9e4', exposure: 1.15, night: 0 },
  sunset: { sky: '#7d91ad', horizon: '#f1b27c', fog: '#c8a288', sun: '#ffac60', light: 3.0, ambient: 1.35, water: '#536f75', foam: '#e4b99d', cloud: '#ffd5a9', exposure: 1.08, night: 0 },
  night: { sky: '#101e35', horizon: '#475773', fog: '#273f50', sun: '#a5c6ef', light: .62, ambient: .72, water: '#183a50', foam: '#678caa', cloud: '#7189a4', exposure: 1.08, night: 1 },
};

function createSky(scene) {
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { topColor: { value: new THREE.Color(palettes.day.sky) }, bottomColor: { value: new THREE.Color(palettes.day.horizon) } },
    vertexShader: 'varying vec3 vPosition; void main(){vPosition=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform vec3 topColor; uniform vec3 bottomColor; varying vec3 vPosition; void main(){float h=normalize(vPosition).y; gl_FragColor=vec4(mix(bottomColor,topColor,smoothstep(-.06,.7,h)),1.); #include <colorspace_fragment> }'.replace('; #include', ';\n#include').replace('fragment> }', 'fragment>\n}'),
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(700, 24, 18), skyMat);
  scene.add(sky);
  return skyMat;
}

function createClouds(scene) {
  const random = seededRandom(189);
  const mat = material('#fff9e4', { roughness: 1 });
  const geo = new THREE.IcosahedronGeometry(1, 2);
  const clouds = new THREE.Group();
  for (let i = 0; i < 28; i++) {
    const cloud = new THREE.Group();
    const angle = i / 28 * Math.PI * 2;
    const radius = 150 + random() * 90;
    cloud.position.set(Math.cos(angle) * radius, 48 + random() * 35, Math.sin(angle) * radius);
    const size = 8 + random() * 8;
    for (let j = 0; j < 7; j++) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set((j - 3) * size * .61, Math.sin(j / 6 * Math.PI) * size * .35, (random() - .5) * size);
      const scale = (.6 + Math.sin(j / 6 * Math.PI) * .45) * size;
      mesh.scale.set(scale, scale * .68, scale * .8);
      cloud.add(mesh);
    }
    clouds.add(cloud);
  }
  scene.add(clouds);
  return { clouds, material: mat };
}

function createStars(scene) {
  const rand = seededRandom(889);
  const positions = [];
  for (let i = 0; i < 650; i++) {
    const angle = rand() * Math.PI * 2, y = .15 + rand() * .85;
    const radial = Math.sqrt(1 - y * y);
    positions.push(Math.cos(angle) * radial * 480, y * 480, Math.sin(angle) * radial * 480);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: '#fff3d4', size: 1.25, transparent: true, opacity: 0, fog: false, depthWrite: false });
  const stars = new THREE.Points(geometry, mat); scene.add(stars);
  return stars;
}

function batchStaticMeshes(parent) {
  for (const child of [...parent.children]) if (child.isGroup) batchStaticMeshes(child);
  const buckets = new Map();
  for (const child of parent.children) {
    if (!child.isMesh || child.isInstancedMesh || child.material.isShaderMaterial || Array.isArray(child.material)) continue;
    const key = child.material.uuid;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(child);
  }
  for (const meshes of buckets.values()) {
    if (meshes.length < 2) continue;
    const geometries = meshes.map(mesh => { mesh.updateMatrix(); return mesh.geometry.clone().applyMatrix4(mesh.matrix); });
    const geometry = mergeGeometries(geometries);
    geometries.forEach(g => g.dispose());
    if (!geometry) continue;
    const merged = new THREE.Mesh(geometry, meshes[0].material);
    merged.castShadow = meshes.some(mesh => mesh.castShadow);
    merged.receiveShadow = meshes.some(mesh => mesh.receiveShadow);
    meshes.forEach(mesh => parent.remove(mesh)); parent.add(merged);
  }
}

function createBirds(scene) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, .15, 0, .15, 0, 1, 0, .15], 3));
  const birds = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const bird = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#40544e' }));
    bird.position.set(i * 4, Math.sin(i) * 2, i * 3); birds.add(bird);
  }
  scene.add(birds);
  return birds;
}

export function createWorld(container, { reducedMotion, onFollowChange, onContextLost }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.domElement.setAttribute('tabindex', '0');
  renderer.domElement.setAttribute('aria-label', '3D 기차 풍경. 드래그하거나 방향키로 시점을 돌릴 수 있습니다.');
  container.appendChild(renderer.domElement);
  renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); onContextLost(); });
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(palettes.day.fog, 115, 335);
  const camera = new THREE.PerspectiveCamera(52, container.clientWidth / container.clientHeight, .5, 900);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = .06;
  controls.maxPolarAngle = Math.PI * .47; controls.minPolarAngle = .15;
  controls.minDistance = 15; controls.maxDistance = 155;
  controls.enablePan = false;
  const sky = createSky(scene), cloud = createClouds(scene), stars = createStars(scene), birds = createBirds(scene);
  const ambient = new THREE.HemisphereLight('#d5eaf0', '#6e754b', 2.1); scene.add(ambient);
  const sun = new THREE.DirectionalLight('#fff0c8', 3.1);
  sun.position.set(-70, 95, 30); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -95, right: 95, top: 95, bottom: -95, near: 1, far: 250 });
  sun.shadow.bias = -.00035; sun.shadow.normalBias = .07;
  scene.add(sun, sun.target);
  const route = createRoute(), windows = new Set();
  const landscape = createLandscape(scene, route, windows);
  const cars = createTrain(scene, windows);
  batchStaticMeshes(scene);
  const state = { running: !reducedMotion, speed: 1, distance: landscape.length * .34, following: true, time: 'day', elapsed: 0 };
  const color = new THREE.Color();
  const focus = new THREE.Vector3();
  let followZoom = 1;
  let lastFrame = performance.now(), disposed = false, frameId;

  function placeTrain() {
    cars.forEach((car, index) => {
      const t = carriageDistance(state.distance, index, landscape.length) / landscape.length;
      car.position.copy(route.getPointAt(t)); car.position.y += .03;
      const tangent = route.getTangentAt(t);
      car.rotation.set(-Math.asin(tangent.y), Math.atan2(tangent.x, tangent.z), 0, 'YXZ');
    });
    focus.copy(cars[2].position).add(new THREE.Vector3(0, 11, 0));
  }
  function followPosition() {
    const scale = (container.clientWidth < 700 ? 1.4 : 1) * followZoom;
    const dx = (riverX(focus.z + 35) - focus.x) * .8 - 13;
    const position = focus.clone().add(new THREE.Vector3(dx, 20, 49).multiplyScalar(scale));
    for (let i = 1; i <= 6; i++) {
      const fraction = i / 6;
      const x = THREE.MathUtils.lerp(focus.x, position.x, fraction);
      const z = THREE.MathUtils.lerp(focus.z, position.z, fraction);
      const clearance = landscape.sampler.heightAt(x, z) + 10;
      position.y = Math.max(position.y, focus.y + (clearance - focus.y) / fraction);
    }
    return position;
  }
  function resetCamera() {
    placeTrain();
    followZoom = 1;
    camera.position.copy(followPosition());
    controls.target.copy(focus);
    controls.update();
  }
  resetCamera();
  controls.addEventListener('start', () => { if (state.following) { state.following = false; onFollowChange(false); } });
  function handleArrow(event) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault(); state.following = false; onFollowChange(false);
    const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    if (event.key === 'ArrowLeft') spherical.theta -= .08;
    if (event.key === 'ArrowRight') spherical.theta += .08;
    if (event.key === 'ArrowUp') spherical.phi -= .08;
    if (event.key === 'ArrowDown') spherical.phi += .08;
    spherical.phi = THREE.MathUtils.clamp(spherical.phi, controls.minPolarAngle, controls.maxPolarAngle);
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical)); controls.update();
  }
  renderer.domElement.addEventListener('keydown', handleArrow);

  function updatePalette(delta) {
    const p = palettes[state.time], blend = 1 - Math.exp(-delta * 2);
    const mix = (target, hex) => target.lerp(color.set(hex), blend);
    mix(sky.uniforms.topColor.value, p.sky); mix(sky.uniforms.bottomColor.value, p.horizon);
    mix(scene.fog.color, p.fog); mix(sun.color, p.sun); mix(cloud.material.color, p.cloud);
    mix(landscape.water.uniforms.uDeep.value, p.water); mix(landscape.water.uniforms.uLight.value, p.foam);
    sun.intensity = THREE.MathUtils.lerp(sun.intensity, p.light, blend);
    ambient.intensity = THREE.MathUtils.lerp(ambient.intensity, p.ambient, blend);
    renderer.toneMappingExposure = THREE.MathUtils.lerp(renderer.toneMappingExposure, p.exposure, blend);
    stars.material.opacity = THREE.MathUtils.lerp(stars.material.opacity, p.night, blend);
    landscape.water.uniforms.uNight.value = stars.material.opacity;
    for (const windowMat of windows) windowMat.emissiveIntensity = .04 + stars.material.opacity * 2;
    cars[0].userData.headlight.intensity = stars.material.opacity * 110;
    sun.position.lerp(state.time === 'sunset' ? new THREE.Vector3(-90, 32, -55) : new THREE.Vector3(-70, 95, 30), blend);
  }
  function render(now) {
    if (disposed) return;
    const delta = Math.min((now - lastFrame) / 1000, .05); lastFrame = now;
    state.distance = advanceDistance(state.distance, delta, state.speed, state.running, landscape.length);
    if (!reducedMotion && state.running) state.elapsed += delta;
    placeTrain();
    if (state.following) {
      camera.position.lerp(followPosition(), 1 - Math.exp(-delta * 3));
      controls.target.lerp(focus, 1 - Math.exp(-delta * 5));
    }
    controls.update(); updatePalette(delta);
    landscape.water.uniforms.uTime.value = state.elapsed;
    cloud.clouds.rotation.y = Math.sin(state.elapsed * .003) * .035;
    birds.position.set(-18 + Math.sin(state.elapsed * .045) * 35, 36, -45 + Math.cos(state.elapsed * .045) * 28);
    birds.rotation.y = -state.elapsed * .045;
    birds.children.forEach((bird, i) => { bird.scale.y = Math.sin(state.elapsed * 3 + i) * .7 + 1; });
    renderer.render(scene, camera);
    container.dataset.progress = (state.distance / landscape.length).toFixed(5);
    frameId = requestAnimationFrame(render);
  }
  frameId = requestAnimationFrame(render);
  const observer = new ResizeObserver(() => {
    camera.aspect = container.clientWidth / container.clientHeight; camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });
  observer.observe(container);
  return {
    state,
    setTime(time) { if (palettes[time]) state.time = time; },
    toggleFollow() { state.following = !state.following; if (state.following) resetCamera(); return state.following; },
    reset() { state.following = true; resetCamera(); onFollowChange(true); },
    zoom(factor) {
      if (state.following) followZoom = THREE.MathUtils.clamp(followZoom * factor, .45, 2);
      const offset = camera.position.clone().sub(controls.target).multiplyScalar(factor);
      offset.clampLength(controls.minDistance, controls.maxDistance); camera.position.copy(controls.target).add(offset); controls.update();
    },
    capture() { renderer.render(scene, camera); return renderer.domElement.toDataURL('image/png'); },
    stream() { return renderer.domElement.captureStream(30); },
    stats() { return { trees: landscape.treeCount, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, length: landscape.length }; },
    dispose() { disposed = true; cancelAnimationFrame(frameId); observer.disconnect(); renderer.domElement.removeEventListener('keydown', handleArrow); controls.dispose(); renderer.dispose(); },
  };
}
