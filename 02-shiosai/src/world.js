import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { loadTextures, applyPhotographicMaterials } from "./materials.js";
import { createEnvironment } from "./environment.js";
import { createStation } from "./station.js";
import { createTrain } from "./train.js";
import { journeyAt, advanceTime } from "./motion.js";
import { presets, cameraPreset, constrainCamera } from "./camera.js";

const filmShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 } },
  vertexShader:
    "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
  fragmentShader: `uniform sampler2D tDiffuse;uniform float uTime;varying vec2 vUv;
    void main(){
      vec3 col=texture2D(tDiffuse,vUv).rgb;
      float luma=dot(col,vec3(.2126,.7152,.0722));col=mix(vec3(luma),col,.94);
      col=pow(max(col,vec3(0.)),vec3(.97,1.,1.025));
      float vignette=smoothstep(.15,.87,length((vUv-.5)*vec2(1.,.83)));
      float grain=fract(sin(dot(vUv+uTime*.0001,vec2(12.9898,78.233)))*43758.5453)-.5;
      col=col*(1.-vignette*.22)+grain*.012;
      gl_FragColor=vec4(col,1.);
    }`,
};

export async function createWorld(
  container,
  { reducedMotion, onStatus, onFreeCamera, onError },
) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.info.autoReset = false;
  container.appendChild(renderer.domElement);
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute(
    "aria-label",
    "일본 해안역의 3D 풍경. 드래그나 방향키로 둘러볼 수 있습니다.",
  );
  renderer.domElement.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    onError(new Error("그래픽 연결이 끊겼어요. 새로고침해 주세요."));
  });
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2("#8c9993", 0.005);
  const camera = new THREE.PerspectiveCamera(
    48,
    container.clientWidth / container.clientHeight,
    0.12,
    2400,
  );
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  controls.enablePan = false;
  controls.minDistance = 6;
  controls.maxDistance = 50;
  controls.maxPolarAngle = Math.PI * 0.52;
  controls.minPolarAngle = 0.35;
  const [textures, hdr] = await Promise.all([
    loadTextures(renderer),
    new HDRLoader().loadAsync("/assets/venice_sunset_1k.hdr"),
  ]);
  applyPhotographicMaterials(textures);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTarget = pmrem.fromEquirectangular(hdr);
  scene.environment = envTarget.texture;
  scene.environmentIntensity = 0.54;
  scene.environmentRotation.y = 1.2;
  hdr.dispose();
  pmrem.dispose();
  const hemi = new THREE.HemisphereLight("#adc1d1", "#534a39", 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight("#ffd9a5", 2.3);
  sun.position.set(35, 24, -70);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -40,
    right: 40,
    top: 55,
    bottom: -55,
    near: 1,
    far: 150,
  });
  sun.shadow.bias = -0.00015;
  sun.shadow.normalBias = 0.025;
  sun.target.position.set(0, 0, -15);
  scene.add(sun, sun.target);
  const lights = { station: [], headlights: [], windows: [] };
  const environment = createEnvironment(scene, textures),
    platform = createStation(scene, textures, lights),
    train = createTrain(scene, lights);
  const target = new THREE.WebGLRenderTarget(
    container.clientWidth,
    container.clientHeight,
    { type: THREE.HalfFloatType, samples: 4 },
  );
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(container.clientWidth, container.clientHeight),
    0.12,
    0.45,
    1.7,
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const film = new ShaderPass(filmShader);
  composer.addPass(film);
  const state = {
    time: 0,
    running: !reducedMotion,
    rain: true,
    night: false,
    camera: "platform",
  };
  const goalPosition = new THREE.Vector3(),
    goalTarget = new THREE.Vector3();
  let transitioning = false,
    lastTime = performance.now(),
    frameId,
    dirty = true,
    renderedFrames = 0,
    lastRenderedTime = -1;
  let previousY = 2.5;

  function preset(name, immediate = false) {
    if (!presets[name]) return;
    state.camera = name;
    const p = cameraPreset(name, container.clientWidth);
    goalPosition.set(...p.position);
    goalTarget.set(...p.target);
    camera.fov = p.fov;
    dirty = true;
    camera.updateProjectionMatrix();
    transitioning = !immediate;
    if (immediate) {
      camera.position.copy(goalPosition);
      controls.target.copy(goalTarget);
      controls.update();
    }
  }
  preset("platform", true);
  controls.addEventListener("change", () => {
    constrainCamera(camera.position, previousY, journeyAt(state.time).z);
    previousY = camera.position.y;
    camera.lookAt(controls.target);
    dirty = true;
  });
  controls.addEventListener("start", () => {
    transitioning = false;
    state.camera = "free";
    onFreeCamera();
  });
  renderer.domElement.addEventListener("keydown", (event) => {
    if (
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    )
      return;
    event.preventDefault();
    transitioning = false;
    state.camera = "free";
    onFreeCamera();
    const s = new THREE.Spherical().setFromVector3(
      camera.position.clone().sub(controls.target),
    );
    s.theta +=
      event.key === "ArrowLeft"
        ? -0.035
        : event.key === "ArrowRight"
          ? 0.035
          : 0;
    s.phi = THREE.MathUtils.clamp(
      s.phi +
        (event.key === "ArrowUp"
          ? -0.025
          : event.key === "ArrowDown"
            ? 0.025
            : 0),
      0.35,
      Math.PI * 0.52,
    );
    camera.position
      .copy(controls.target)
      .add(new THREE.Vector3().setFromSpherical(s));
    controls.update();
  });
  const color = new THREE.Color();
  let lastStatus = "";
  function updateMood(dt) {
    const n = environment.sky.uniforms.uNight.value;
    const targetNight = state.night ? 1 : 0,
      targetRain = state.rain ? 0.095 : 0;
    const remaining =
      Math.abs(targetNight - n) +
      Math.abs(targetRain - environment.rain.uniforms.uOpacity.value);
    if (remaining < 0.0001) return false;
    const blend =
      reducedMotion || remaining < 0.002 ? 1 : 1 - Math.exp(-dt * 1.65);
    const night = THREE.MathUtils.lerp(n, state.night ? 1 : 0, blend);
    environment.sky.uniforms.uNight.value = night;
    environment.ocean.uniforms.uNight.value = night;
    environment.sky.uniforms.uTop.value.lerp(
      color.set(state.night ? "#152c45" : "#728a99"),
      blend,
    );
    environment.sky.uniforms.uHorizon.value.lerp(
      color.set(state.night ? "#48677a" : "#e8b184"),
      blend,
    );
    environment.ocean.uniforms.uHorizon.value.copy(
      environment.sky.uniforms.uHorizon.value,
    );
    environment.ocean.uniforms.uDeep.value.lerp(
      color.set(state.night ? "#223d49" : "#36565a"),
      blend,
    );
    scene.fog.color.lerp(color.set(state.night ? "#425a68" : "#8c9993"), blend);
    sun.intensity = THREE.MathUtils.lerp(2.3, 0.04, night);
    hemi.intensity = THREE.MathUtils.lerp(0.9, 0.42, night);
    sun.color.lerp(color.set(state.night ? "#aac0d8" : "#ffd9a5"), blend);
    scene.environmentIntensity = THREE.MathUtils.lerp(0.54, 0.18, night);
    lights.windows.forEach((m) => (m.emissiveIntensity = 0.12 + night * 0.78));
    lights.station.forEach((l) => (l.intensity = 7 + night * 5));
    lights.headlights.forEach((l) => (l.intensity = 25 + night * 20));
    platform.material.uniforms.uNight.value = night;
    environment.rain.uniforms.uOpacity.value = THREE.MathUtils.lerp(
      environment.rain.uniforms.uOpacity.value,
      state.rain ? 0.095 : 0,
      blend,
    );
    return true;
  }
  function render(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.07);
    lastTime = now;
    state.time = advanceTime(state.time, dt, state.running);
    const journey = journeyAt(state.time);
    train.position.z = journey.z;
    const status = state.running ? journey.status : "멈춰 둔 풍경";
    if (status !== lastStatus) {
      onStatus(status);
      lastStatus = status;
    }
    if (transitioning) {
      const lerp = 1 - Math.exp(-dt * 3.3);
      camera.position.lerp(goalPosition, lerp);
      controls.target.lerp(goalTarget, lerp);
      if (camera.position.distanceTo(goalPosition) < 0.02)
        transitioning = false;
    }
    controls.update();
    constrainCamera(camera.position, previousY, journey.z);
    previousY = camera.position.y;
    camera.lookAt(controls.target);
    const moodChanged = updateMood(dt);
    environment.sky.uniforms.uTime.value = state.time;
    environment.ocean.uniforms.uTime.value = state.time;
    environment.ocean.uniforms.uCamera.value.copy(camera.position);
    environment.rain.uniforms.uTime.value = state.time;
    platform.material.uniforms.uTime.value = state.time;
    film.uniforms.uTime.value = state.time;
    if (
      state.running ||
      transitioning ||
      dirty ||
      moodChanged ||
      lastRenderedTime !== state.time
    ) {
      renderer.info.reset();
      composer.render();
      renderedFrames++;
      lastRenderedTime = state.time;
      dirty = false;
    }
    frameId = requestAnimationFrame(render);
  }
  const observer = new ResizeObserver(() => {
    const w = container.clientWidth,
      h = container.clientHeight;
    camera.aspect = w / h;
    if (presets[state.camera]) preset(state.camera, true);
    camera.updateProjectionMatrix();
    dirty = true;
    renderer.setSize(w, h);
    composer.setSize(w, h);
  });
  observer.observe(container);
  frameId = requestAnimationFrame(render);
  return {
    state,
    preset,
    capture() {
      composer.render();
      return renderer.domElement.toDataURL("image/png");
    },
    stream() {
      return renderer.domElement.captureStream(30);
    },
    stats() {
      return {
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        renderedFrames,
        camera: camera.position.toArray(),
      };
    },
    dispose() {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      controls.dispose();
      composer.dispose();
      renderer.dispose();
      envTarget.dispose();
    },
  };
}
