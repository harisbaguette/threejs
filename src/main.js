import './style.css';
import { createWorld } from './world.js';
import { LandscapeAudio } from './audio.js';

const $ = selector => document.querySelector(selector);
const app = $('#app');
const sound = new LandscapeAudio();
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let world, toastTimer;
let recorder, recordingTimer, recordingStream;

function icon(button, name) { button.querySelector('use').setAttribute('href', `/icons.svg#${name}`); }
function toast(message) {
  clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').classList.add('visible');
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 3000);
}
function setFollow(active) {
  $('#follow').setAttribute('aria-pressed', String(active));
  $('#follow span').textContent = active ? '함께 달리는 중' : '기차 따라가기';
}
function updatePlayback() {
  const running = world.state.running;
  icon($('#play'), running ? 'pause' : 'play');
  $('#play').setAttribute('aria-label', running ? '열차 정지' : '열차 출발');
  $('#play').setAttribute('title', `${running ? '열차 정지' : '열차 출발'} · Space`);
  $('#play').setAttribute('aria-pressed', String(!running));
  sound.setRunning(running, world.state.speed);
}
function togglePlayback() { world.state.running = !world.state.running; updatePlayback(); }

function toggleRecording() {
  if (recorder?.state === 'recording') { recorder.stop(); return; }
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) { toast('이 브라우저는 영상 저장을 지원하지 않아요. 엽서 저장을 이용해 주세요.'); return; }
  const types = ['video/mp4;codecs=avc1.42001E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
  const mimeType = types.find(type => MediaRecorder.isTypeSupported(type));
  if (!mimeType) { toast('지원하는 영상 형식이 없어요. Chrome에서 다시 시도해 주세요.'); return; }
  const chunks = [];
  try {
    recordingStream = world.stream();
    recorder = new MediaRecorder(recordingStream, { mimeType, videoBitsPerSecond: 8_000_000 });
    recorder.addEventListener('dataavailable', event => { if (event.data.size) chunks.push(event.data); });
    recorder.addEventListener('stop', () => finishRecording(chunks, mimeType));
    recorder.addEventListener('error', () => { toast('영상을 저장하지 못했어요.'); resetRecording(); });
    recorder.start(500);
    $('#record').setAttribute('aria-pressed', 'true'); $('#record').setAttribute('aria-label', '영상 녹화 마치기');
    let remaining = 12; $('#record .record-label').textContent = `녹화 중 ${remaining}초`;
    recordingTimer = setInterval(() => {
      remaining--; $('#record .record-label').textContent = `녹화 중 ${remaining}초`;
      if (remaining <= 0 && recorder.state === 'recording') recorder.stop();
    }, 1000);
    toast('12초 동안 풍경을 담아요. 한 번 더 누르면 저장합니다.');
  } catch (error) { console.error(error); resetRecording(); toast('영상 녹화를 시작하지 못했어요.'); }
}

function finishRecording(chunks, mimeType) {
  resetRecording();
  if (!chunks.length) return;
  const blob = new Blob(chunks, { type: mimeType });
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = `느린-궤도-${world.state.time}.${mimeType.includes('mp4') ? 'mp4' : 'webm'}`;
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  toast('여행의 한 장면을 영상으로 저장했어요.');
}

function resetRecording() {
  clearInterval(recordingTimer); recordingStream?.getTracks().forEach(track => track.stop());
  $('#record').setAttribute('aria-pressed', 'false'); $('#record').setAttribute('aria-label', '12초 영상 저장');
  $('#record .record-label').textContent = '영상 저장';
}

async function savePostcard() {
  const button = $('#save'); button.disabled = true;
  try {
    const img = new Image(); img.src = world.capture(); await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.width; canvas.height = img.height + Math.round(img.width * .075);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f4f3ed'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const border = Math.round(img.width * .018);
    ctx.drawImage(img, border, border, img.width - border * 2, img.height - border * 2);
    ctx.fillStyle = '#294f42'; ctx.textBaseline = 'middle';
    ctx.font = `${Math.round(img.width * .018)}px "AppleMyungjo", serif`;
    ctx.fillText('느린 궤도', border * 1.6, img.height + (canvas.height - img.height) * .42);
    ctx.textAlign = 'right'; ctx.font = `${Math.round(img.width * .009)}px sans-serif`;
    ctx.fillText('계곡을 따라, 느리게.', canvas.width - border * 1.6, img.height + (canvas.height - img.height) * .42);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('이미지를 만들지 못했습니다.');
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = `느린-궤도-${world.state.time}-${new Date().toISOString().slice(0, 10)}.png`;
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
    toast('지금의 풍경을 엽서로 저장했어요.');
  } catch (error) { console.error(error); toast('엽서 저장에 실패했어요. 다시 눌러 주세요.'); }
  finally { button.disabled = false; }
}

function connectControls() {
  $('#play').addEventListener('click', togglePlayback);
  $('#speed').addEventListener('input', event => {
    world.state.speed = Number(event.target.value); $('#speed-value').textContent = `${world.state.speed.toFixed(1)}×`;
    sound.setRunning(world.state.running, world.state.speed);
  });
  document.querySelectorAll('.time-switch button').forEach(button => button.addEventListener('click', () => {
    app.dataset.time = button.dataset.time; world.setTime(button.dataset.time);
    document.querySelectorAll('.time-switch button').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  }));
  $('#follow').addEventListener('click', () => setFollow(world.toggleFollow()));
  $('#zoom-in').addEventListener('click', () => world.zoom(.83));
  $('#zoom-out').addEventListener('click', () => world.zoom(1.2));
  $('#reset').addEventListener('click', () => { world.reset(); toast('기차와 함께 다시 출발합니다.'); });
  $('#save').addEventListener('click', savePostcard);
  $('#record').addEventListener('click', toggleRecording);
  $('#sound').addEventListener('click', async () => {
    try {
      const active = await sound.toggle();
      icon($('#sound'), active ? 'sound-on' : 'sound-off');
      $('#sound').setAttribute('aria-pressed', String(active));
      $('#sound').setAttribute('aria-label', active ? '풍경 소리 끄기' : '풍경 소리 켜기');
      $('#sound').title = active ? '풍경 소리 끄기' : '풍경 소리 켜기';
      sound.setRunning(world.state.running, world.state.speed);
    } catch (error) { toast(error.message); }
  });
  window.addEventListener('keydown', event => {
    if (event.code !== 'Space' || ['INPUT', 'BUTTON', 'A', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    event.preventDefault(); togglePlayback();
  });
  document.addEventListener('visibilitychange', () => sound.setVisible(!document.hidden).catch(() => {}));
}

async function init() {
  try {
    await new Promise(resolve => requestAnimationFrame(resolve));
    world = createWorld($('#scene'), { reducedMotion, onFollowChange: setFollow, onContextLost: () => { $('#error').hidden = false; } });
    connectControls(); updatePlayback(); setFollow(world.state.following);
    $('#loading').classList.add('loaded');
    setInterval(() => { $('#route-marker').style.left = `${Number($('#scene').dataset.progress) * 100}%`; }, 150);
    app.dataset.ready = 'true';
    if (import.meta.env.DEV) window.__slowRail = { state: world.state, stats: world.stats };
  } catch (error) {
    console.error(error); $('#loading').classList.add('loaded'); $('#error').hidden = false;
  }
}
init();
