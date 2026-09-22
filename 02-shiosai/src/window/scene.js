import * as THREE from "three";
import {
  planeVertex,
  screenVertex,
  landscapeFragment,
  glassFragment,
} from "./shaders.js";
import { createCabin } from "./cabin.js";

export async function createWindow(
  container,
  { reducedMotion = false, onWipe, onError },
) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.autoClear = false;
  renderer.info.autoReset = false;
  const canvas = renderer.domElement;
  container.appendChild(canvas);
  canvas.tabIndex = 0;
  canvas.setAttribute(
    "aria-label",
    "비 오는 역의 창가. 드래그해 창을 닦을 수 있어요. 방향키로 시선을 옮기고 C키로 창을 맑게 닦아요.",
  );
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    onError(new Error("그래픽 연결이 끊겼어요. 새로 불러와 주세요."));
  });
  const loader = new THREE.TextureLoader();
  const [dusk, night] = await Promise.all([
    loader.loadAsync("/assets/window/station.webp"),
    loader.loadAsync("/assets/window/station-night.webp"),
  ]);
  for (const texture of [dusk, night]) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  }
  const scene = new THREE.Scene();
  const foreground = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 30);
  camera.position.set(0, 0, 6);
  const uniforms = {
    uDusk: { value: dusk },
    uNight: { value: night },
    uMood: { value: 0 },
    uTime: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: planeVertex,
    fragmentShader: landscapeFragment,
  });
  const geometry = new THREE.PlaneGeometry(1.5, 1, 120, 80);
  const source = geometry.attributes.position.array.slice();
  const plate = new THREE.Mesh(geometry, material);
  scene.add(plate);
  const cabin = createCabin(foreground);
  const target = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    depthBuffer: true,
  });
  const wipeCanvas = document.createElement("canvas");
  wipeCanvas.width = 768;
  wipeCanvas.height = 512;
  const brush = wipeCanvas.getContext("2d", { willReadFrequently: true });
  brush.fillStyle = "#000";
  brush.fillRect(0, 0, 768, 512);
  const wipeTexture = new THREE.CanvasTexture(wipeCanvas);
  const glassUniforms = {
    uScene: { value: target.texture },
    uWipe: { value: wipeTexture },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uRain: { value: 1 },
    uEntered: { value: 0 },
  };
  const glassMaterial = new THREE.ShaderMaterial({
    uniforms: glassUniforms,
    vertexShader: screenVertex,
    fragmentShader: glassFragment,
    depthTest: false,
    depthWrite: false,
  });
  const screen = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), glassMaterial);
  screen.add(quad);
  const ortho = new THREE.Camera();
  const state = {
    time: 8,
    running: !reducedMotion,
    night: false,
    rain: true,
    entered: false,
  };
  const pointer = new THREE.Vector2(),
    current = new THREE.Vector2();
  let frame,
    last = performance.now(),
    dirty = true,
    visible = !document.hidden;
  let drawing = false,
    previous = null,
    wipeEnergy = 0,
    wipeCount = 0,
    renderedFrames = 0;
  let lastFade = 0,
    recording = false;

  function resize() {
    const width = container.clientWidth,
      height = container.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    target.setSize(size.x, size.y);
    glassUniforms.uResolution.value.copy(size);
    // Project a shallow relief mesh to preserve the source photograph at rest.
    const fullHeight = 2 * Math.tan((42 * Math.PI) / 360) * 9;
    const scale = fullHeight * Math.max(1, camera.aspect / 1.5) * 1.035;
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const u = geometry.attributes.uv.getX(i),
        v = geometry.attributes.uv.getY(i);
      const ground = Math.max(0, 0.5 - v) * 1.4;
      const building = (1 - THREE.MathUtils.smoothstep(u, 0.27, 0.42)) * 0.55;
      const depth = Math.max(ground, building);
      const z = -3 + depth;
      const project = (6 - z) / 9;
      const mobileShift = camera.aspect < 0.9 ? -0.095 * scale : 0;
      positions.setXYZ(
        i,
        (source[i * 3] * scale + mobileShift) * project,
        source[i * 3 + 1] * scale * project,
        z,
      );
    }
    positions.needsUpdate = true;
    geometry.computeBoundingSphere();
    cabin.resize(camera.aspect);
    dirty = true;
  }
  function clearGlass() {
    brush.fillStyle = "#fff";
    brush.fillRect(0, 0, 768, 512);
    wipeTexture.needsUpdate = true;
    wipeEnergy = 1;
    wipeCount++;
    dirty = true;
    onWipe?.();
  }
  function wipe(event) {
    const bounds = canvas.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 768;
    const y = ((event.clientY - bounds.top) / bounds.height) * 512;
    const radius = Math.max(16, (42 / bounds.height) * 512);
    const from = previous || { x, y };
    const distance = Math.hypot(x - from.x, y - from.y);
    const count = Math.max(1, Math.ceil(distance / (radius * 0.3)));
    for (let i = 0; i <= count; i++) {
      const cx = from.x + ((x - from.x) * i) / count,
        cy = from.y + ((y - from.y) * i) / count;
      const gradient = brush.createRadialGradient(cx, cy, 0, cx, cy, radius);
      gradient.addColorStop(0, "rgba(255,255,255,.85)");
      gradient.addColorStop(0.65, "rgba(255,255,255,.72)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      brush.fillStyle = gradient;
      brush.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    }
    previous = { x, y };
    wipeEnergy = 1;
    wipeCount++;
    wipeTexture.needsUpdate = true;
    dirty = true;
    onWipe?.();
  }
  canvas.addEventListener("pointerdown", (event) => {
    if (!state.entered || event.button !== 0) return;
    drawing = true;
    previous = null;
    canvas.setPointerCapture(event.pointerId);
    wipe(event);
  });
  canvas.addEventListener("pointermove", (event) => {
    const bounds = canvas.getBoundingClientRect();
    if (!reducedMotion && state.running) {
      pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -(((event.clientY - bounds.top) / bounds.height) * 2 - 1),
      );
      dirty = true;
    }
    if (drawing) wipe(event);
  });
  const stopDrawing = () => {
    drawing = false;
    previous = null;
  };
  canvas.addEventListener("pointerup", stopDrawing);
  canvas.addEventListener("pointercancel", stopDrawing);
  canvas.addEventListener("lostpointercapture", stopDrawing);
  canvas.addEventListener("pointerleave", () => {
    if (!drawing) pointer.set(0, 0);
  });
  canvas.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "c" && state.entered) {
      event.preventDefault();
      clearGlass();
    }
    const directions = {
      ArrowLeft: [-0.3, 0],
      ArrowRight: [0.3, 0],
      ArrowUp: [0, 0.3],
      ArrowDown: [0, -0.3],
    };
    if (directions[event.key]) {
      event.preventDefault();
      const [x, y] = directions[event.key];
      pointer.x = THREE.MathUtils.clamp(pointer.x + x, -1, 1);
      pointer.y = THREE.MathUtils.clamp(pointer.y + y, -1, 1);
      dirty = true;
    }
  });
  function draw() {
    renderer.info.reset();
    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.render(screen, ortho);
    renderer.clearDepth();
    renderer.render(foreground, camera);
    renderedFrames++;
    dirty = false;
  }
  function render(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!visible && !recording) {
      frame = requestAnimationFrame(render);
      return;
    }
    const moving = state.running || recording;
    if (moving) state.time += dt;
    const blend = reducedMotion ? 1 : 1 - Math.exp(-dt * 1.8);
    const oldMood = uniforms.uMood.value,
      oldRain = glassUniforms.uRain.value,
      oldEntered = glassUniforms.uEntered.value;
    function approach(value, goal) {
      return Math.abs(goal - value) < 0.001
        ? goal
        : THREE.MathUtils.lerp(value, goal, blend);
    }
    uniforms.uMood.value = approach(oldMood, state.night ? 1 : 0);
    glassUniforms.uRain.value = approach(oldRain, state.rain ? 1 : 0);
    glassUniforms.uEntered.value = approach(oldEntered, state.entered ? 1 : 0);
    current.lerp(pointer, reducedMotion ? 1 : 1 - Math.exp(-dt * 3));
    if (current.distanceTo(pointer) < 0.001) current.copy(pointer);
    camera.position.x = current.x * 0.075;
    camera.position.y = current.y * 0.045;
    camera.lookAt(current.x * 0.017, current.y * 0.012, -3);
    uniforms.uTime.value = state.time;
    glassUniforms.uTime.value = state.time;
    cabin.update(uniforms.uMood.value);
    if (moving && wipeEnergy > 0.005 && now - lastFade > 100 && !drawing) {
      brush.fillStyle = "rgba(0,0,0,.008)";
      brush.fillRect(0, 0, 768, 512);
      wipeTexture.needsUpdate = true;
      wipeEnergy *= 0.992;
      lastFade = now;
    }
    if (
      moving ||
      dirty ||
      current.distanceTo(pointer) > 0 ||
      oldMood !== uniforms.uMood.value ||
      oldRain !== glassUniforms.uRain.value ||
      oldEntered !== glassUniforms.uEntered.value
    )
      draw();
    frame = requestAnimationFrame(render);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();
  draw();
  frame = requestAnimationFrame(render);
  return {
    state,
    canvas,
    clearGlass,
    setVisible(value) {
      visible = value;
      dirty = true;
    },
    setRecording(value) {
      recording = value;
    },
    capture() {
      draw();
      return canvas.toDataURL("image/png");
    },
    stats() {
      return {
        renderedFrames,
        wipeCount,
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        mood: uniforms.uMood.value,
        camera: camera.position.toArray(),
      };
    },
    dispose() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      cabin.dispose();
      [dusk, night, wipeTexture].forEach((t) => t.dispose());
      geometry.dispose();
      material.dispose();
      glassMaterial.dispose();
      quad.geometry.dispose();
      target.dispose();
      renderer.dispose();
    },
  };
}
