import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { createWorld, LANDMARKS } from './world.js';
import { createPlayer, createFollowCamera } from './player.js';
import { createAudio } from './audio.js';
import { drawMap } from './map.js';
import { createCharacterPreview } from './character-preview.js';
import { CHARACTERS } from './characters.js';
import { validSave, collides } from './physics.js';
import './style.css';

const $ = selector => document.querySelector(selector);
const app = $('#app'), canvas = $('#world');
const SAVE_KEY = 'litoral-journey-v1';
const keys = new Set();
const input = { x: 0, z: 0, run: false, jump: false };
const touch = { x: 0, z: 0, run: false };
let mode = 'loading', world, player, follow, renderer, composer, ao, camera, scene;
let time = 0, lastTime = 0, lastSave = 0, lastMap = 0, frames = 0, fps = 60, frameAccum = 0;
let toastTimer, nearSpot = null, drag = null, quality = 'balanced', photoRequested = false;
const audio = createAudio();
const found = new Set();
const pauseDialog = $('#pause-dialog'), mapDialog = $('#map-dialog');
const characterDialog = $('#character-dialog');
let characterPreview, pendingCharacter = 'female', characterReturnMode = 'intro', characterAccepted = false;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = matchMedia('(pointer: coarse)').matches;
const waypointVector = new THREE.Vector3();
const ui = {
  stamina: $('#stamina div'), waypoint: $('#waypoint'), waypointLabel: $('#waypoint-label'),
  interact: $('#interact'), minimap: $('#minimap'), largeMap: $('#large-map'),
};

function toast(message) {
  clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').classList.add('visible');
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 3800);
}

function readSave() {
  try { return validSave(JSON.parse(localStorage.getItem(SAVE_KEY)), LANDMARKS.map(l => l.id)); }
  catch { return null; }
}

function save() {
  if (!player) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 1, found: [...found], character: player.state.character, position: { x: player.state.x, z: player.state.z } }));
  } catch { /* Private browsing still supports the full unsaved game. */ }
}

function updateProgress() {
  $('#progress-count').textContent = `${found.size} / 4`;
  $('#objective-title').textContent = found.size === 4 ? '네 곳의 풍경을 모두 담았어요' : '마을의 풍경을 모아 보세요';
  document.querySelectorAll('#progress-dots i').forEach((el, i) => el.classList.toggle('done', found.has(LANDMARKS[i].id)));
  $('#journal').replaceChildren(...LANDMARKS.map(spot => {
    const row = document.createElement('div'); row.className = found.has(spot.id) ? 'found' : '';
    row.textContent = `${found.has(spot.id) ? '✓' : '◇'}  ${spot.name}`; return row;
  }));
}

function collect() {
  if (mode !== 'playing' || !nearSpot || found.has(nearSpot.id)) return;
  found.add(nearSpot.id); updateProgress(); save();
  toast(found.size === 4 ? '네 곳의 풍경을 모두 기록했어요. 이제 자유롭게 걸어 보세요.' : `${nearSpot.name} — ${nearSpot.description}`);
  $('#photo-flash').classList.remove('flash'); void $('#photo-flash').offsetWidth; $('#photo-flash').classList.add('flash');
}

function clearInput() { keys.clear(); touch.x = touch.z = 0; touch.run = false; input.jump = false; drag = null; $('#joystick-knob').style.transform = ''; $('#touch-run').setAttribute('aria-pressed', 'false'); }
function setMode(value) { mode = value; app.dataset.mode = value; if (value !== 'playing') clearInput(); }
function openDialog(dialog) {
  if (mode === 'loading' || mode === 'intro') return;
  if (document.pointerLockElement) document.exitPointerLock();
  setMode('paused');
  if (dialog === mapDialog) drawMap(ui.largeMap, player.state, world, found, true, follow.state.yaw);
  if (!dialog.open) dialog.showModal();
}
function closeDialogs() {
  pauseDialog.close(); mapDialog.close();
  if (player && mode !== 'intro') setMode('playing');
}

function updateCharacterUI() {
  const selected = CHARACTERS.find(c => c.id === player.state.character);
  $('#selected-character').textContent = `${selected.name} · ${selected.label}`;
}

function previewCharacter(id) {
  pendingCharacter = id;
  const selected = CHARACTERS.find(c => c.id === id);
  document.querySelectorAll('[data-character]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.character === id)));
  $('#preview-name').textContent = selected.name;
  characterPreview.select(id);
}

function openCharacterDialog() {
  if (!player || mode === 'loading') return;
  characterReturnMode = mode;
  characterAccepted = false;
  clearInput();
  if (pauseDialog.open) pauseDialog.close();
  if (mode !== 'intro') setMode('paused');
  characterDialog.showModal();
  if (!characterPreview) characterPreview = createCharacterPreview($('#avatar-preview'), player, scene.environment);
  previewCharacter(player.state.character);
  $('#character-status').textContent = '';
}

function startGame() {
  setMode('playing'); follow.update(0, true);
  toast(mobile ? '왼쪽 패드로 이동 · 오른쪽 화면을 밀어 둘러보기' : 'WASD로 이동하고, 화면을 드래그해 둘러보세요.');
}

async function init() {
  const manager = new THREE.LoadingManager(); let progress = 0;
  manager.onProgress = (_url, loaded, total) => {
    progress = Math.max(progress, Math.min(92, loaded / total * 90));
    $('#load-progress').style.width = `${progress}%`;
  };
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.3 : 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.info.autoReset = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .87;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(53, innerWidth / innerHeight, .1, 1600);
  camera.position.set(-2.5, 3.8, 43); camera.lookAt(5, 2.6, -8);
  const saved = readSave();
  saved?.found.forEach(id => found.add(id));
  [world, player] = await Promise.all([createWorld(scene, renderer, manager), createPlayer(scene, manager, saved?.position, saved?.character)]);
  if (collides(player.state.x, player.state.z, world.obstacles)) player.reset();
  follow = createFollowCamera(camera, player, world.cameraObstacles);
  const target = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 2 });
  composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  ao = new SSAOPass(scene, camera, innerWidth, innerHeight);
  ao.kernelRadius = .55; ao.minDistance = .002; ao.maxDistance = .14; ao.enabled = false;
  composer.addPass(ao); composer.addPass(new OutputPass());
  const finish = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, time: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float time;
      varying vec2 vUv;
      void main() {
        vec3 color = texture2D(tDiffuse, vUv).rgb;
        float vignette = 1. - smoothstep(.2, .8, distance(vUv, vec2(.5))) * .16;
        float grain = fract(sin(dot(vUv + fract(time), vec2(12.9898,78.233))) * 43758.5453);
        color *= vignette;
        color += (grain - .5) * .009;
        gl_FragColor = vec4(color, 1.);
      }`,
  });
  composer.addPass(finish);
  resize(); updateProgress();
  world.update(0, player.pivot.position);
  player.update(.016, { x: 0, z: 0, run: false, jump: false }, 0, world.obstacles);
  await renderer.compileAsync(scene, camera);
  composer.render();
  setMode('intro'); app.dataset.ready = 'true';
  $('#load-progress').style.width = '100%'; $('#start').disabled = false;
  $('#start-label').textContent = saved ? '이어서 걷기' : '산책 시작하기';
  $('#intro-character').disabled = false; updateCharacterUI();

  // Read-only observability for performance checks and integration tests.
  Object.defineProperty(window, '__litoral', { value: {
    get state() {
      const box = player.modelBounds;
      return { mode, ...player.state, found: [...found], near: nearSpot?.id ?? null,
        cameraYaw: follow.state.yaw, quality, fps: Math.round(fps), drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles, avatarHeight: box.max.y - box.min.y,
        avatarGround: box.min.y, avatarCenter: box.getCenter(new THREE.Vector3()).toArray(),
      };
    },
  } });
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('test')) {
    window.__litoralTest = {
      place(x, z) { player.state.x = x; player.state.z = z; player.state.y = .16; player.state.velocityY = 0; player.pivot.position.set(x, .16, z); follow.update(0, true); },
    };
  }
  bindControls();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - (lastTime || now)) / 1000, .05); lastTime = now;
    if (document.hidden) return;
    frames++; frameAccum += dt;
    if (frameAccum > 1) { fps = frames / frameAccum; frames = 0; frameAccum = 0; }
    if (mode !== 'paused') {
      time += dt;
      if (mode === 'playing') {
        input.x = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + touch.x;
        input.z = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) + touch.z;
        input.run = keys.has('ShiftLeft') || keys.has('ShiftRight') || touch.run;
        player.update(dt, input, follow.state.yaw, world.obstacles); input.jump = false;
        follow.update(dt);
        updateHUD();
        lastSave += dt;
        if (lastSave > 10) { save(); lastSave = 0; }
      } else {
        player.update(dt, { x: 0, z: 0, run: false, jump: false }, 0, world.obstacles);
        const drift = reducedMotion ? 0 : Math.sin(time * .05) * 1.5;
        camera.position.set(-2.5 + drift, 3.8, 43); camera.lookAt(5, 2.6, -8);
      }
      world.update(time, player.pivot.position);
      player.updatePedestrians(time, dt);
      audio.update(dt, player.state.speed, player.state.grounded, time, false);
    }
    finish.uniforms.time.value = reducedMotion ? 0 : time;
    renderer.info.reset();
    composer.render();
    if (photoRequested) { photoRequested = false; capturePhoto(); }
    if (characterDialog.open) characterPreview?.update(dt);
    lastMap += dt;
    if (mode === 'playing' && lastMap > .1) { drawMap(ui.minimap, player.state, world, found, false, follow.state.yaw); lastMap = 0; }
  }
  requestAnimationFrame(frame);
}

function updateHUD() {
  ui.stamina.style.width = `${Math.round(player.state.stamina * 100)}%`;
  let nearest = null, distance = Infinity;
  for (const spot of world.landmarks) {
    if (found.has(spot.id)) continue;
    const d = Math.hypot(spot.x - player.state.x, spot.z - player.state.z);
    if (d < distance) { distance = d; nearest = spot; }
  }
  nearSpot = distance < 3.5 ? nearest : null;
  ui.interact.hidden = !nearSpot;
  if (nearSpot) ui.interact.querySelector('span').textContent = `${nearSpot.name} 기록하기`;
  if (nearest) {
    waypointVector.set(nearest.x, 2.65, nearest.z).project(camera);
    const visible = waypointVector.z < 1 && Math.abs(waypointVector.x) < .91 && Math.abs(waypointVector.y) < .75;
    ui.waypoint.style.display = visible && !nearSpot ? 'block' : 'none';
    ui.waypoint.style.left = `${(waypointVector.x * .5 + .5) * innerWidth}px`;
    ui.waypoint.style.top = `${(-waypointVector.y * .5 + .5) * innerHeight}px`;
    ui.waypointLabel.textContent = `${nearest.name} · ${Math.round(distance)} m`;
  } else ui.waypoint.style.display = 'none';
}

function resize() {
  if (!renderer) return;
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer?.setSize(innerWidth, innerHeight);
}

function changeQuality(value) {
  quality = value;
  const cap = value === 'high' ? 2 : value === 'low' ? 1 : 1.5;
  renderer.setPixelRatio(Math.min(devicePixelRatio, cap));
  composer.setPixelRatio(renderer.getPixelRatio());
  ao.enabled = value === 'high';
  renderer.shadowMap.enabled = value !== 'low';
  renderer.shadowMap.needsUpdate = true;
  resize();
}

function capturePhoto() {
  const photo = document.createElement('canvas'); photo.width = canvas.width; photo.height = canvas.height;
  const c = photo.getContext('2d'); c.drawImage(canvas, 0, 0);
  const fontSize = Math.max(16, Math.round(photo.width * .013));
  c.font = `${fontSize}px sans-serif`; c.fillStyle = '#f5f1e7'; c.shadowColor = '#18332e'; c.shadowBlur = 6;
  c.fillText('L I T O R A L  /  PORTO SERENO', fontSize * 2, photo.height - fontSize * 2);
  photo.toBlob(blob => {
    if (!blob) { toast('사진을 저장하지 못했어요. 다시 시도해 주세요.'); return; }
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = `litoral-${new Date().toISOString().slice(0, 10)}.png`;
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('오늘의 풍경을 사진으로 저장했어요.');
  }, 'image/png');
}

function bindControls() {
  $('#start').addEventListener('click', startGame);
  for (const selector of ['#intro-character', '#character-open', '#pause-character']) $(selector).addEventListener('click', openCharacterDialog);
  document.querySelectorAll('[data-character]').forEach(button => button.addEventListener('click', () => previewCharacter(button.dataset.character)));
  document.querySelectorAll('[data-portrait]').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('[data-portrait]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    characterPreview.setView(button.dataset.portrait);
  }));
  $('#character-confirm').addEventListener('click', () => {
    player.selectCharacter(pendingCharacter); save(); updateCharacterUI();
    characterAccepted = true; characterDialog.close();
  });
  characterDialog.addEventListener('close', () => {
    clearInput();
    if (characterAccepted) {
      startGame();
    } else if (characterReturnMode === 'intro') setMode('intro');
    else if (characterReturnMode === 'paused') { setMode('paused'); pauseDialog.showModal(); }
    else setMode('playing');
  });
  $('#sound').addEventListener('click', async () => {
    const enabled = await audio.toggle(); $('#sound').setAttribute('aria-pressed', String(enabled));
    $('#sound').setAttribute('aria-label', enabled ? '자연 소리 끄기' : '자연 소리 켜기');
  });
  $('#pause').addEventListener('click', () => openDialog(pauseDialog));
  $('#resume').addEventListener('click', closeDialogs);
  $('#map-toggle').addEventListener('click', () => openDialog(mapDialog));
  $('#minimap-button').addEventListener('click', () => openDialog(mapDialog));
  $('#photo').addEventListener('click', () => { if (mode === 'playing') photoRequested = true; });
  $('#interact').addEventListener('click', collect);
  $('#quality').addEventListener('change', e => changeQuality(e.target.value));
  $('#sensitivity').addEventListener('input', e => { follow.state.sensitivity = Number(e.target.value); });
  $('#reset-position').addEventListener('click', () => { player.reset(); follow.state.yaw = -.09; follow.update(0, true); save(); closeDialogs(); toast('해안 산책로로 돌아왔어요.'); });
  for (const dialog of [pauseDialog, mapDialog]) {
    dialog.addEventListener('close', () => { clearInput(); if (!pauseDialog.open && !mapDialog.open && !characterDialog.open) setMode('playing'); });
    dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
  }
  window.addEventListener('keydown', e => {
    if (characterDialog.open) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    if (mode === 'intro' && e.code === 'Enter') { $('#start').click(); return; }
    if (e.code === 'Escape') {
      if (mode === 'playing') { e.preventDefault(); openDialog(pauseDialog); }
      return;
    }
    if (mode !== 'playing') return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    keys.add(e.code);
    if (e.repeat) return;
    if (e.code === 'Space') input.jump = true;
    if (e.code === 'KeyE') collect();
    if (e.code === 'KeyM') openDialog(mapDialog);
    if (e.code === 'KeyP') photoRequested = true;
  });
  window.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', () => { clearInput(); if (mode === 'playing') openDialog(pauseDialog); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { save(); clearInput(); if (mode === 'playing') openDialog(pauseDialog); } lastTime = 0; });
  window.addEventListener('pagehide', save);
  canvas.addEventListener('pointerdown', e => {
    if (mode !== 'playing' || e.button !== 0) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag || drag.id !== e.pointerId || mode !== 'playing') return;
    follow.orbit(e.clientX - drag.x, e.clientY - drag.y); drag.x = e.clientX; drag.y = e.clientY;
  });
  const release = () => { drag = null; };
  canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('wheel', e => { if (mode === 'playing') { e.preventDefault(); follow.zoom(e.deltaY); } }, { passive: false });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  const stick = $('#joystick'); let stickPointer = null;
  const moveStick = e => {
    if (mode !== 'playing') return;
    const r = stick.getBoundingClientRect(); let x = (e.clientX - r.left - r.width / 2) / 42, z = (e.clientY - r.top - r.height / 2) / 42;
    const length = Math.hypot(x, z); if (length > 1) { x /= length; z /= length; }
    touch.x = x; touch.z = z; $('#joystick-knob').style.transform = `translate(${x * 32}px, ${z * 32}px)`;
  };
  stick.addEventListener('pointerdown', e => { stickPointer = e.pointerId; stick.setPointerCapture(e.pointerId); moveStick(e); });
  stick.addEventListener('pointermove', e => { if (e.pointerId === stickPointer) moveStick(e); });
  const stopStick = () => { stickPointer = null; touch.x = touch.z = 0; $('#joystick-knob').style.transform = ''; };
  stick.addEventListener('pointerup', stopStick); stick.addEventListener('pointercancel', stopStick);
  $('#touch-jump').addEventListener('pointerdown', e => { e.preventDefault(); if (mode === 'playing') input.jump = true; });
  $('#touch-run').addEventListener('click', () => { touch.run = !touch.run; $('#touch-run').setAttribute('aria-pressed', String(touch.run)); });
}

window.addEventListener('resize', resize);
canvas.addEventListener('webglcontextlost', e => {
  e.preventDefault(); setMode('paused'); $('#error').hidden = false;
  $('#error-message').textContent = '그래픽 연결이 중단됐어요. 다시 시도하면 마지막 저장 지점에서 이어집니다.';
});
init().catch(error => {
  console.error(error); $('#error').hidden = false;
  $('#error-message').textContent = 'WebGL 2를 지원하는 브라우저에서 열어 주세요. 파일이 모두 준비되어 있는지도 확인해 주세요.';
  $('#intro').hidden = true;
});
