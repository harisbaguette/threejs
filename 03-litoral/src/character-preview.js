import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function createCharacterPreview(canvas, player, environment) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0x182321, 0);
  const scene = new THREE.Scene(); scene.environment = environment; scene.environmentIntensity = .55;
  const camera = new THREE.PerspectiveCamera(31, 1, .02, 20);
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false; controls.enableDamping = true; controls.dampingFactor = .1;
  controls.minDistance = .55; controls.maxDistance = 5;
  controls.minPolarAngle = .65; controls.maxPolarAngle = 1.7;
  const hemisphere = new THREE.HemisphereLight('#e9f4ff', '#887568', .85); scene.add(hemisphere);
  const key = new THREE.DirectionalLight('#fff0dc', 2.2); key.position.set(2, 3, 4); scene.add(key);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = key.shadow.camera.bottom = -2;
  key.shadow.camera.right = key.shadow.camera.top = 2;
  key.shadow.camera.near = .1; key.shadow.camera.far = 10;
  key.shadow.normalBias = .015; key.shadow.bias = -.0001;
  const fill = new THREE.DirectionalLight('#c7e4ff', .65); fill.position.set(-3, 2, 2); scene.add(fill);
  const rim = new THREE.DirectionalLight('#f5e6ce', 2.2); rim.position.set(-2, 2.8, -2); scene.add(rim);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(1.7, 64), new THREE.MeshStandardMaterial({ color: '#29423a', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -.01; scene.add(ground);
  ground.receiveShadow = true;
  const pool = new Map(); let current, view = 'full', previousWidth = 0, previousHeight = 0;
  function frameView() {
    const height = current?.id === 'female' ? 1.69 : 1.8;
    if (view === 'face') {
      controls.target.set(0, height - .16, .015);
      camera.position.set(.13, height - .12, .82);
      controls.minDistance = .55; controls.maxDistance = 1.5;
    } else {
      controls.target.set(0, height * .54, 0);
      camera.position.set(.15, height * .59, 3.85);
      controls.minDistance = 1.5; controls.maxDistance = 5;
    }
    controls.update();
  }
  return {
    select(id) {
      if (current) scene.remove(current.model);
      if (!pool.has(id)) pool.set(id, { ...player.createPreview(id), id });
      current = pool.get(id); scene.add(current.model); frameView();
    },
    setView(value) { view = value; frameView(); },
    update(dt) {
      const { width, height } = canvas.getBoundingClientRect();
      if (!width || !height) return;
      if (width !== previousWidth || height !== previousHeight) {
        renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
        previousWidth = width; previousHeight = height;
      }
      current?.update(dt); controls.update(); renderer.render(scene, camera);
    },
  };
}
