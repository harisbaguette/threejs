import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { loadCharacters } from './characters.js';
import { createApartment } from './world.js';
import { createDistrict, createCafe } from './district.js';
import { SAVE_KEY, EXPERIENCES, initialState, restoreState, complete, nextObjective, moveWithCollision } from './state.js';
import './style.css';

const $ = selector => document.querySelector(selector);
const canvas = $('#scene');
const keys = new Set();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let state = initialState(), mode = 'intro', ready = false, saved = null;
let renderer, scene, camera, apartment, actors, current, nearest;
let district, cafe, worlds, activeWorld, pedestrians = [], cupProp, mirrorSite = 'home', poseTurn = false;
let experience = null, experienceStart = 0, experienceRestore = null;
let yaw = 0, pitch = .15, distance = 2.9, mirrorView = 'full', smileUntil = 0;
let lastTime = performance.now(), subtitleUntil = 0, coffeeReadyAt = 0;
let drag = null, transitionTimer = null;
const player = new THREE.Group(), npc = new THREE.Group();
const cameraTarget = new THREE.Vector3(), desiredCamera = new THREE.Vector3();
const cameraRay = new THREE.Raycaster(), rayDirection = new THREE.Vector3();
const point = new THREE.Vector3();
try { saved = restoreState(localStorage.getItem(SAVE_KEY)); } catch { /* Storage can be disabled by the browser. */ }

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 1, ...state })); }
  catch { subtitle('저장 공간을 사용할 수 없어 이번 진행은 현재 창에만 남습니다.'); }
}
function subtitle(text, seconds = 5) {
  $('#subtitle').textContent = text; $('#subtitle').hidden = false;
  subtitleUntil = performance.now() + seconds * 1000;
}
function updateHUD() {
  const female = state.character === 'female';
  $('#identity-name').textContent = female ? '서연' : '도윤';
  $('#identity-role').textContent = female ? '여성 · 28세' : '남성 · 29세';
  $('#chapter').textContent = female ? '02 / 그녀의 하루' : '01 / 낯선 아침';
  $('#objective').textContent = nextObjective(state);
  $('#view').textContent = state.view === 'third' ? '1인칭' : '3인칭';
  $('#crosshair').hidden = state.view !== 'first' || mode !== 'playing';
  $('#progress').textContent = `${state.completed.length}/${EXPERIENCES.length}`;
}
function mark(id) {
  if (complete(state, id)) {
    updateHUD(); save();
    if (state.completed.length === EXPERIENCES.length) subtitle('이제, 이 아침도 나의 기억이 되었다.', 8);
  }
}
function setOutfit(value, persist = true) {
  state.outfit = value;
  for (const actor of [actors.female, actors.npc]) actor.model.traverse(mesh => {
    if (!mesh.isMesh) return;
    if (mesh.material.name === 'Camisole') mesh.material.color.set(value === 'wine' ? '#913e58' : '#ffffff');
  });
  if (persist) { mark('outfit'); save(); }
}
function selectCharacter(id) {
  if (current) player.remove(current.model);
  current = actors[id]; player.add(current.model); state.character = id;
  npc.visible = id === 'male' && state.zone === 'home';
  for (const [key, action] of Object.entries(current.actions)) action.setEffectiveWeight(key === 'Idle' ? 1 : 0);
  updateHUD();
}
function start(resume = false) {
  if (!ready) return;
  state = resume && saved ? { ...saved, completed: [...saved.completed] } : initialState();
  mode = 'playing'; selectCharacter(state.character); setOutfit(state.outfit, false);
  player.visible = true; changeZone(state.zone, false);
  pitch = .12; distance = 2.9; keys.clear();
  $('#intro').hidden = true; $('#hud').hidden = false;
  updateCamera(1, true); updateHUD(); save();
  subtitle(state.character === 'male' ? '저 사람에게 다가가면… 무언가 달라질 것 같다.' : '창문 너머로, 서연의 아침이 이어지고 있다.');
}
function closePanel() {
  $('#panel').close();
  if (mode === 'panel') mode = 'playing';
  keys.clear(); updateHUD();
}
function openPanel(kicker, title, content) {
  mode = 'panel'; keys.clear(); nearest = null;
  $('#interaction').hidden = true;
  $('#panel-kicker').textContent = kicker; $('#panel-title').textContent = title;
  $('#panel-body').innerHTML = content;
  if (!$('#panel').open) $('#panel').showModal();
}
function pause() {
  if (!ready || mode !== 'playing') return;
  openPanel('PAUSE', '잠깐, 숨 고르기', `
    <div class="panel-actions">
      <button data-command="resume">계속하기</button>
      <button data-command="photo">사진 저장하기</button>
      <button data-command="restart-confirm">처음부터 다시</button>
    </div>
    <p class="fine">WASD / 방향키 이동 · 드래그 시점 · E 상호작용 · V 시점 전환 · J 기록 · Esc 일시정지</p>`);
}
function journal() {
  if (mode !== 'playing') return;
  openPanel('TODAY’S MOMENTS', '오늘의 기록', `<ul class="journal-list">${EXPERIENCES.map(e => `
    <li><span class="tick">${state.completed.includes(e.id) ? '✓' : '○'}</span>
    <span>${e.title}<small>${e.hint}</small></span></li>`).join('')}</ul>
    <p class="fine">${state.completed.length === EXPERIENCES.length ? '집과 거리의 아홉 순간을 모두 경험했어요.' : '집 → 거리 → 편집숍 → 카페 → 지민과의 만남. 서연의 몸으로 경험한 순간들이 남아요.'}</p>`);
}
function changeZone(zone, persist = true, from = null) {
  state.zone = zone; activeWorld = zone === 'home' ? apartment : zone === 'street' ? district : cafe;
  for (const [id, group] of Object.entries(worlds)) group.visible = id === zone;
  scene.background.set(zone === 'street' ? '#c7dde5' : '#d9e2e0');
  npc.visible = zone === 'home' && state.character === 'male';
  const spawn = zone === 'home' ? [-3.5,3.45] : zone === 'cafe' ? [0,3.8] : from === 'cafe' ? [-7.65,-10] : [-7.5,-23.5];
  if (!persist && zone === 'home') { spawn[0]=.2; spawn[1]=state.character === 'female' ? -.8 : 3.7; }
  player.position.set(spawn[0],0,spawn[1]); player.rotation.y = zone === 'street' ? 0 : Math.PI;
  yaw = zone === 'street' ? Math.PI : 0; pitch=.12; distance=2.9; keys.clear(); nearest=null;
  updateHUD(); updateCamera(1,true); if(persist)save();
}
function beginExperience(type) {
  if(mode!=='playing')return;
  keys.clear();mode='experience';experience=type;experienceStart=performance.now();
  experienceRestore={view:state.view,yaw,pitch,position:player.position.clone(),rotation:player.rotation.y};
  $('#hud').hidden=true;$('#experience-ui').hidden=false;
  $('#experience-title').textContent=type==='hands'?'낯선 손, 그리고 나의 움직임':type==='sit'?'창가에서 쉬어가는 시간':'따뜻한 잔을 손에 쥔다';
  if(type==='hands'){state.view='first';pitch=.77;}
  if(type==='sit'){player.position.set(3.9,0,3.1);player.rotation.y=-Math.PI/2;}
  cupProp.visible=type!=='hands'; $('#experience-close').focus();
}
function endExperience() {
  if(mode!=='experience')return;
  if(experience==='coffee')mark('coffee');
  player.position.copy(experienceRestore.position);player.rotation.y=experienceRestore.rotation;
  state.view=experienceRestore.view;yaw=experienceRestore.yaw;pitch=experienceRestore.pitch;
  mode='playing';experience=null;cupProp.visible=false;$('#hud').hidden=false;$('#experience-ui').hidden=true;keys.clear();updateHUD();
}
function possess(returning = false) {
  if (mode !== 'playing') return;
  mode = 'transition'; keys.clear(); nearest = null; $('#interaction').hidden = true;
  $('#transition p').textContent = returning ? '익숙한 감각으로, 다시 돌아간다.' : '익숙한 내가, 조금씩 멀어진다.';
  $('#transition').classList.add('active');
  const duration = reducedMotion ? 80 : 850;
  transitionTimer = setTimeout(() => {
    selectCharacter(returning ? 'male' : 'female');
    if (!returning) { player.position.copy(npc.position); player.rotation.y = Math.PI; }
    else { player.position.set(.2, 0, 3.4); player.rotation.y = Math.PI; }
    yaw = 0; pitch = .12; state.view = 'third';
    updateCamera(1, true); updateHUD(); save();
    transitionTimer = setTimeout(() => {
      $('#transition').classList.remove('active');
      transitionTimer = setTimeout(() => {
        mode = 'playing'; updateHUD();
        subtitle(returning ? '다시 나의 몸이다. 원하면 서연에게 돌아갈 수 있다.' : '손을 들어 본다. 분명 내 뜻대로 움직이는데, 익숙한 손이 아니다.', 7);
        if(!returning)beginExperience('hands');
      }, reducedMotion ? 0 : 750);
    }, duration);
  }, duration);
}
function enterMirror(site = 'home') {
  mark('mirror'); mode = 'mirror'; keys.clear(); mirrorView = 'full'; mirrorSite=site;poseTurn=false;
  player.position.set(site==='home'?-.5:8.12,0,site==='home'?-3.25:1.8);player.rotation.y=site==='home'?Math.PI:Math.PI/2;
  $('#hud').hidden = true; $('#mirror-ui').hidden = false;
  $('#smile').hidden = !current.model.getObjectsByProperty('isMesh', true).some(m => m.morphTargetDictionary?.mouthSmileLeft !== undefined);
  document.querySelectorAll('[data-mirror]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mirror === mirrorView)));
  $('#mirror-close').focus(); updateCamera(1, true);
}
function leaveMirror() {
  mode = 'playing'; $('#mirror-ui').hidden = true; $('#hud').hidden = false;
  yaw = mirrorSite==='home'?0:-Math.PI/2; pitch = .12; keys.clear(); updateHUD(); updateCamera(1, true);
}
function interact() {
  if (mode !== 'playing' || !nearest) return;
  const id = nearest.id;
  if(id==='outing'){changeZone('street');mark('outing');subtitle('문 밖의 공기가 머리카락을 스친다. 이제 이 모습으로 거리를 걸어 본다.');return;}
  if(id==='home'){changeZone('home');return;}
  if(id==='cafe'){changeZone('cafe');subtitle(state.character==='female'?'어서 오세요, 서연 님. 오늘도 라테 드릴까요?':'어서 오세요. 편하게 둘러보세요.');return;}
  if(id==='street'){changeZone('street',true,'cafe');return;}
  if(id==='reflection'){enterMirror('street');return;}
  if (id === 'possess') { possess(); return; }
  if (id === 'return') { possess(true); return; }
  if (id === 'mirror') { enterMirror(); return; }
  if (state.character !== 'female') { subtitle('서연의 일상이다. 먼저 서연에게 다가가 보자.'); return; }
  if (id === 'outfit' || id === 'boutique') {
    if(id==='boutique')mark('boutique');
    openPanel('WARDROBE', '오늘은 어떤 모습으로?', `
      <div class="outfits">
        <button data-outfit="cream" class="${state.outfit === 'cream' ? 'selected' : ''}">
          <span class="swatches"><i style="--swatch:#e4e4e4"></i><i style="--swatch:#3d6482"></i></span>화이트 톱과 데님<small>원본 에셋의 캐주얼 차림</small></button>
        <button data-outfit="wine" class="${state.outfit === 'wine' ? 'selected' : ''}">
          <span class="swatches"><i style="--swatch:#913e58"></i><i style="--swatch:#3d6482"></i></span>와인 톱과 데님<small>같은 의상의 색상 변경</small></button>
      </div>`);
  } else if (id === 'coffee') {
    apartment.steam.visible = true;beginExperience('coffee');
  } else if (id === 'phone') {
    openPanel('09:14 · 지민', '오늘, 만날까?', `
      <div class="message"><small>지민 · 오전 9:12</small>서연아, 잘 잤어? 오늘 쉬는 날이지?<br />날씨 좋은데 오후에 만날래?</div>
      ${state.reply ? `<p class="fine">내 답장: ${state.reply === 'cafe' ? '좋아, 카페에서 보자.' : '한강 산책 어때?'}</p>` : ''}
      <div class="panel-actions"><button data-reply="cafe">좋아, 카페에서 보자.</button><button data-reply="walk">한강 산책 어때?</button></div>`);
  } else if (id === 'window') {
    mark('window');
    openPanel('SEOUL · 09:21 AM', '나의 새로운 아침', `<p>유리창 너머로 익숙한 도시가 보인다. 그런데 창에 비친 사람은 어제의 내가 아니다.</p><p>오늘은 서연의 걸음으로, 이 하루를 살아가 보기로 했다.</p><div class="panel-actions"><button data-command="resume">조금 더 머무르기</button></div>`);
  } else if(id==='order') {
    openPanel('MORNING COFFEE','서연 님, 오늘은요?',`<p>바리스타가 내 얼굴을 알아보고 먼저 인사한다. 서연에게는 익숙했을 곳이다.</p><div class="panel-actions"><button data-drink="latte">따뜻한 라테 주세요.</button><button data-drink="americano">오늘은 아메리카노로 할게요.</button></div>`);
  } else if(id==='sit') {
    if(!state.drink){subtitle('먼저 카운터에서 커피를 주문하자.');return;}beginExperience('sit');
  } else if(id==='friend') {
    openPanel('지민 · 오후의 약속','서연아, 여기!',`<p>지민이 손을 흔든다. 내 이름처럼 익숙하게, 서연이라는 이름이 들린다.</p><div class="message">오늘 ${state.outfit==='wine'?'와인색 톱':'옷'} 잘 어울린다. ${state.reply==='walk'?'산책하자고 해서 이쪽에서 기다렸어.':state.reply==='cafe'?'카페는 어땠어? 조금 걸을까?':'나올 줄 알았으면 먼저 연락할 걸.'}</div><div class="panel-actions"><button data-friend="honest">오늘은 모든 게 조금 새롭게 느껴져.</button><button data-friend="casual">고마워. 같이 좀 걸을까?</button></div>`);
  }
}
function photo() {
  renderer.render(scene, camera);
  canvas.toBlob(blob => {
    if (!blob) { subtitle('사진을 저장하지 못했습니다. 다시 시도해 주세요.'); return; }
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = `another-morning-${Date.now()}.png`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, 'image/png');
}
function updateCamera(dt, immediate = false) {
  let hideHead = false;
  if (mode === 'intro') {
    camera.position.set(4.7, 1.95, 3.9); camera.lookAt(-.4, 1.3, -1.9);
    camera.fov = 46;
  } else if (mode === 'mirror') {
    hideHead = true;
    // Camera stays physically in front of the mirror; zoom changes the lens, not the reflection.
    if(mirrorSite==='street') {
      desiredCamera.set(8.30,1.59,1.8);cameraTarget.set(11.2,mirrorView==='face'?1.54:.86,1.8);
    } else {
      desiredCamera.set(-.5, 1.59, -3.42);
      cameraTarget.set(-.5, mirrorView === 'face' ? 1.54 : .86, -6.2);
    }
    camera.position.copy(desiredCamera); camera.lookAt(cameraTarget);
    camera.fov = mirrorView === 'face' ? 15 : 60;
  } else if(mode==='experience' && experience!=='hands') {
    const offset=new THREE.Vector3(.9,experience==='sit'?1.8:1.5,2.1).applyAxisAngle(new THREE.Vector3(0,1,0),player.rotation.y);
    camera.position.copy(player.position).add(offset);cameraTarget.copy(player.position).add(new THREE.Vector3(0,1.15,0));camera.lookAt(cameraTarget);camera.fov=45;
  } else if (state.view === 'first') {
    hideHead = true;
    const height = state.character === 'female' ? 1.57 : 1.67;
    camera.position.copy(player.position).add(new THREE.Vector3(0, height, 0));
    const dir = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    camera.position.addScaledVector(dir, .07); camera.lookAt(point.copy(camera.position).add(dir));
    camera.fov = 66;
  } else {
    cameraTarget.copy(player.position).add(new THREE.Vector3(0, 1.24, 0));
    desiredCamera.set(Math.sin(yaw) * distance * Math.cos(pitch), 1.24 + Math.sin(pitch) * distance, Math.cos(yaw) * distance * Math.cos(pitch)).add(player.position);
    desiredCamera.y = Math.max(.4, Math.min(3.1, desiredCamera.y));
    rayDirection.copy(desiredCamera).sub(cameraTarget);
    cameraRay.set(cameraTarget, rayDirection.clone().normalize()); cameraRay.far = rayDirection.length();
    const hit = cameraRay.intersectObjects((activeWorld??apartment).cameraWalls, false)[0];
    if (hit) desiredCamera.copy(cameraTarget).addScaledVector(rayDirection.normalize(), Math.max(.35, hit.distance - .17));
    const bounds=activeWorld?.bounds??{minX:-5.82,maxX:5.82,minZ:-4.82,maxZ:4.82};
    desiredCamera.x = THREE.MathUtils.clamp(desiredCamera.x, bounds.minX, bounds.maxX);
    desiredCamera.z = THREE.MathUtils.clamp(desiredCamera.z, bounds.minZ, bounds.maxZ);
    camera.position.lerp(desiredCamera, immediate ? 1 : 1 - Math.exp(-11 * dt));
    camera.lookAt(cameraTarget); camera.fov = 58;
  }
  camera.layers.set(0); if (!hideHead) camera.layers.enable(1);
  // The main first-person camera excludes the head; the reflected camera always sees it.
  apartment.mirror.getReflectionCamera(camera).layers.enable(1);
  district?.mirror.getReflectionCamera(camera).layers.enable(1);
  camera.updateProjectionMatrix();
}
function updateInteractions() {
  if (mode !== 'playing') { $('#interaction').hidden = true; $('#waypoint').hidden = true; return; }
  const available = activeWorld.stations.filter(s => s.id === 'possess' ? state.character === 'male' : s.id === 'return' ? state.character === 'female' : true);
  nearest = available.map(s => ({ ...s, distance: Math.hypot(s.x - player.position.x, s.z - player.position.z) })).filter(s => s.distance < s.radius).sort((a, b) => a.distance - b.distance)[0];
  $('#interaction').hidden = !nearest;
  if (nearest) { $('#object-name').textContent = nearest.name; $('#action-name').textContent = nearest.action; }
  const targetId = state.character === 'male' ? 'possess' : EXPERIENCES.find(e => !state.completed.includes(e.id))?.id;
  let target = activeWorld.stations.find(s => s.id === targetId);
  if(!target && state.zone==='home' && state.character==='female')target=activeWorld.stations.find(s=>s.id==='outing');
  if(!target && state.zone==='street')target=activeWorld.stations.find(s=>s.id===(state.completed.includes('order')?'friend':'cafe'));
  if(!target && state.zone==='cafe')target=activeWorld.stations.find(s=>s.id===(state.completed.includes('order')?'street':'order'));
  if (!target) { $('#waypoint').hidden = true; return; }
  point.set(target.x, target.y, target.z).project(camera);
  const visible = point.z > -1 && point.z < 1 && Math.abs(point.x) < .94 && Math.abs(point.y) < .85;
  $('#waypoint').hidden = !visible;
  if (visible) {
    $('#waypoint').style.left = `${(point.x * .5 + .5) * innerWidth}px`;
    $('#waypoint').style.top = `${(-point.y * .5 + .5) * innerHeight}px`;
    $('#waypoint-label').textContent = `${target.name} · ${Math.hypot(target.x - player.position.x, target.z - player.position.z).toFixed(1)}m`;
  }
}
function move(dt) {
  let x = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'));
  let z = Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup'));
  const length = Math.hypot(x, z); if (length > 1) { x /= length; z /= length; }
  const speed = keys.has('shift') ? 3.9 : state.zone==='street'?2.25:1.65;
  const dx = (x * Math.cos(yaw) + z * Math.sin(yaw)) * dt * speed;
  const dz = (-x * Math.sin(yaw) + z * Math.cos(yaw)) * dt * speed;
  const obstacles = state.character === 'male' && state.zone==='home' ? [...activeWorld.obstacles, { x: npc.position.x, z: npc.position.z, w: .4, d: .4 }] : activeWorld.obstacles;
  const next = moveWithCollision(player.position, dx, dz, obstacles,.25,activeWorld.bounds);
  const moving = Math.hypot(next.x - player.position.x, next.z - player.position.z) > .0001;
  player.position.x = next.x; player.position.z = next.z;
  if (state.view === 'first') player.rotation.y = yaw + Math.PI;
  else if (moving) {
    const target = Math.atan2(dx, dz), delta = Math.atan2(Math.sin(target - player.rotation.y), Math.cos(target - player.rotation.y));
    player.rotation.y += delta * (1 - Math.exp(-14 * dt));
  }
  const clip = moving ? 'Walk' : 'Idle';
  for (const [name, action] of Object.entries(current.actions)) action.setEffectiveWeight(THREE.MathUtils.lerp(action.getEffectiveWeight(), name === clip ? 1 : 0, 1 - Math.exp(-10 * dt)));
  current.actions.Walk.timeScale = speed / 2.1;
}
function pointBone(name,endName,target) {
  const bone=current.model.getObjectByName(name),end=current.model.getObjectByName(endName);if(!bone||!end)return;
  player.updateMatrixWorld(true);
  const origin=bone.getWorldPosition(new THREE.Vector3());
  const from=end.getWorldPosition(new THREE.Vector3()).sub(origin).normalize();
  const to=player.localToWorld(new THREE.Vector3(...target)).sub(origin).normalize();
  const rotation=new THREE.Quaternion().setFromUnitVectors(from,to).multiply(bone.getWorldQuaternion(new THREE.Quaternion()));
  const parentInverse=bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
  bone.quaternion.copy(parentInverse.multiply(rotation));player.updateMatrixWorld(true);
}
function poseExperience(now) {
  if(experience==='sit') {
    player.position.y=-.40;
    for(const [side,sign] of [['Left',1],['Right',-1]]) {
      pointBone(side+'UpLeg',side+'Leg',[sign*.11,.91,.39]);
      pointBone(side+'Leg',side+'Foot',[sign*.11,.43,.43]);
    }
  }
  if(experience==='hands') {
    const bob=Math.sin((now-experienceStart)/900)*.025;
    for(const [side,sign] of [['Left',1],['Right',-1]]) {
      pointBone(side+'Arm',side+'ForeArm',[sign*.24,1.18,.22]);
      pointBone(side+'ForeArm',side+'Hand',[sign*.15,1.35+bob,.43]);
    }
  } else {
    const sip=(Math.sin((now-experienceStart)/1600)+1)/2;
    pointBone('LeftArm','LeftForeArm',[.25,1.18,.17]);
    pointBone('LeftForeArm','LeftHand',[.12,1.30+sip*.17,.26]);
    const hand=current.model.getObjectByName('LeftHand');
    if(hand){cupProp.position.copy(hand.getWorldPosition(new THREE.Vector3()));cupProp.position.y+=.025;}
  }
}
function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, .05); lastTime = now;
  if (ready) {
    if (mode === 'playing') move(dt);
    if (mode === 'mirror' || mode==='experience') for (const [name, action] of Object.entries(current.actions)) action.setEffectiveWeight(name === 'Idle' ? 1 : 0);
    if (mode !== 'panel') {
      if (current) current.update(dt);
      actors.npc.update(dt);
      if(mode==='experience')poseExperience(now);
      if(mode==='mirror')player.rotation.y=(mirrorSite==='home'?Math.PI:Math.PI/2)+(poseTurn?.72:0);
      for(const p of pedestrians) {
        if(state.zone!==p.zone)continue;
        if(p.walk){const phase=(now*.00035+p.phase)%2;p.pivot.position.z=p.start+(phase<1?phase:2-phase)*(p.end-p.start);p.pivot.rotation.y=phase<1?0:Math.PI;}
        p.actor.update(dt);
      }
      const smiling = now < smileUntil;
      actors.female.model.traverse(mesh => {
        for (const name of ['mouthSmileLeft', 'mouthSmileRight']) {
          const index = mesh.morphTargetDictionary?.[name];
          if (index !== undefined) mesh.morphTargetInfluences[index] = THREE.MathUtils.lerp(mesh.morphTargetInfluences[index], smiling ? .7 : 0, 1 - Math.exp(-8 * dt));
        }
      });
    }
    if (coffeeReadyAt && now > coffeeReadyAt) {
      coffeeReadyAt = 0; mark('coffee'); subtitle('따뜻한 잔을 쥔다. 이런 아침도, 나쁘지 않다.');
    }
    activeWorld.update(now / 1000); updateCamera(dt); updateInteractions();
    if (now > subtitleUntil) $('#subtitle').hidden = true;
    renderer.render(scene, camera);
  }
}

$('#start').addEventListener('click', () => start());
$('#continue').addEventListener('click', () => start(true));
$('#view').addEventListener('click', () => {
  if (mode !== 'playing') return;
  state.view = state.view === 'third' ? 'first' : 'third'; pitch = .08; updateHUD(); save(); updateCamera(1, true);
});
$('#interact').addEventListener('click', interact);
$('#pause').addEventListener('click', pause);
$('#journal').addEventListener('click', journal);
$('#panel-close').addEventListener('click', closePanel);
$('#panel').addEventListener('cancel', e => { e.preventDefault(); closePanel(); });
$('#mirror-close').addEventListener('click', leaveMirror);
$('#smile').addEventListener('click', () => { smileUntil = performance.now() + 3500; });
$('#turn-pose').addEventListener('click',()=>{poseTurn=!poseTurn;$('#turn-pose').textContent=poseTurn?'정면 보기':'옆모습 보기';});
$('#body-inspect').addEventListener('click',()=>{if(state.character==='female')beginExperience('hands');else subtitle('먼저 서연에게 빙의해 보자.');});
$('#experience-close').addEventListener('click',endExperience);
document.querySelectorAll('[data-mirror]').forEach(b => b.addEventListener('click', () => {
  mirrorView = b.dataset.mirror;
  document.querySelectorAll('[data-mirror]').forEach(item => item.setAttribute('aria-pressed', String(item === b)));
}));
$('#panel-body').addEventListener('click', event => {
  const button = event.target.closest('button'); if (!button) return;
  if (button.dataset.outfit) { setOutfit(button.dataset.outfit); closePanel(); subtitle('이 색, 생각보다 잘 어울린다. 거울에서 확인해 볼까?'); }
  else if (button.dataset.reply) {
    state.reply = button.dataset.reply; mark('phone'); save();
    openPanel('09:16 · 지민', '오후의 약속', `<div class="message"><small>지민</small>${state.reply === 'walk' ? '좋아! 세 시에 한강 입구에서 만나. 편한 신발 신고 와 :)' : '좋아! 세 시에 늘 가던 카페에서 보자 :)'}</div><div class="panel-actions"><button data-command="resume">휴대폰 내려놓기</button></div>`);
  } else if (button.dataset.command === 'resume') closePanel();
  else if(button.dataset.drink) {
    state.drink=button.dataset.drink;mark('order');save();
    openPanel('MORNING COFFEE','서연 님, 주문하신 커피 나왔어요.',`<p>${state.drink==='latte'?'따뜻한 라테':'아메리카노'} 한 잔을 받았다. 창가에 앉아 쉬었다 가자.</p><div class="panel-actions"><button data-command="resume">커피 받기</button></div>`);
  } else if(button.dataset.friend) {
    mark('friend');
    openPanel('지민','익숙한 듯 새로운 대화',`<div class="message">${button.dataset.friend==='honest'?'그럴 때 있지. 서연아, 오늘은 천천히 걷자. 네 얘기도 듣고 싶어.':'좋아. 저쪽 골목에 새로 생긴 가게도 구경하자.'}</div><p class="fine">누군가 나를 서연으로 알고, 평범하게 말을 건넨다. 이 하루가 조금 더 내 것이 된다.</p><div class="panel-actions"><button data-command="resume">거리로 돌아가기</button></div>`);
  }
  else if (button.dataset.command === 'photo') photo();
  else if (button.dataset.command === 'restart-confirm') openPanel('NEW MORNING', '새 아침을 시작할까요?', `<p>이 브라우저에 저장된 체험 기록이 초기화됩니다.</p><div class="panel-actions"><button data-command="restart">처음부터 시작</button><button data-command="resume">계속 둘러보기</button></div>`);
  else if (button.dataset.command === 'restart') { closePanel(); clearTimeout(transitionTimer); coffeeReadyAt = 0; apartment.steam.visible = false; start(false); }
});
window.addEventListener('keydown', event => {
  const key = event.key.toLowerCase();
  if (mode === 'playing' && ['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift'].includes(key)) { keys.add(key); event.preventDefault(); }
  if (event.repeat) return;
  if (key === 'escape') { if (mode === 'mirror') leaveMirror(); else if(mode==='experience')endExperience();else if (mode === 'playing') pause(); }
  if (mode !== 'playing') return;
  if (key === 'e') interact();
  if (key === 'v') $('#view').click();
  if (key === 'j') journal();
  if (key === 'p') photo();
  if (key === 'b') $('#body-inspect').click();
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => { keys.clear(); drag = null; if (mode === 'playing') pause(); });
document.addEventListener('visibilitychange', () => { keys.clear(); if (document.hidden && mode === 'playing') pause(); });
canvas.addEventListener('pointerdown', e => {
  if (mode !== 'playing') return;
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
  if (!drag || drag.id !== e.pointerId || mode !== 'playing') return;
  yaw -= (e.clientX - drag.x) * .005; pitch = THREE.MathUtils.clamp(pitch + (e.clientY - drag.y) * .0035, -.55, 1.1);
  drag.x = e.clientX; drag.y = e.clientY;
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(type, () => { drag = null; });
canvas.addEventListener('wheel', e => { if (mode === 'playing') { e.preventDefault(); distance = THREE.MathUtils.clamp(distance + e.deltaY * .003, 1.4, 4.5); } }, { passive: false });
document.querySelectorAll('[data-move]').forEach(button => {
  button.addEventListener('pointerdown', e => { if (mode !== 'playing') return; e.preventDefault(); button.setPointerCapture(e.pointerId); keys.add(button.dataset.move); });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, () => keys.delete(button.dataset.move));
});

async function boot() {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.setSize(innerWidth, innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .9;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene = new THREE.Scene(); scene.background = new THREE.Color('#d9e2e0');
    const pmrem = new THREE.PMREMGenerator(renderer), environment = new RoomEnvironment();
    const envTarget = pmrem.fromScene(environment, .04);
    scene.environment = envTarget.texture; scene.environmentIntensity = .35;
    environment.dispose(); pmrem.dispose();
    camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, .035, 150);
    worlds={home:new THREE.Group(),street:new THREE.Group(),cafe:new THREE.Group()};
    Object.values(worlds).forEach(g=>scene.add(g));
    apartment = createApartment(worlds.home);district=createDistrict(worlds.street);cafe=createCafe(worlds.cafe);activeWorld=apartment;
    worlds.street.visible=worlds.cafe.visible=false;scene.add(player);worlds.home.add(npc);
    cupProp=new THREE.Group();
    const cupMesh=new THREE.Mesh(new THREE.CylinderGeometry(.05,.036,.105,24),new THREE.MeshStandardMaterial({color:'#eee2cf',roughness:.3}));cupProp.add(cupMesh);
    const coffeeSurface=new THREE.Mesh(new THREE.CircleGeometry(.044,24),new THREE.MeshStandardMaterial({color:'#4b2c18',roughness:.25}));coffeeSurface.rotation.x=-Math.PI/2;coffeeSurface.position.y=.053;cupProp.add(coffeeSurface);
    scene.add(cupProp);cupProp.visible=false;
    const manager = new THREE.LoadingManager();
    manager.onProgress = (_, loaded, total) => { $('#loading').textContent = `인물과 공간을 불러오는 중 · ${Math.round(loaded / total * 100)}%`; };
    const library = await loadCharacters(manager);
    actors = { male: library.create('male'), female: library.create('female'), npc: library.create('female') };
    // Clone per actor so wardrobe edits never recolor unrelated actors through shared materials.
    for (const [id, actor] of Object.entries(actors)) actor.model.traverse(mesh => {
      if (!mesh.isMesh) return;
      mesh.material = mesh.material.clone();
      const name = mesh.material.name.toLowerCase();
      const head = id === 'male' || /head|eye|cornea|teeth|tongue|hair|skullcap/.test(name) || mesh.parent?.name === 'Head';
      if (id !== 'npc' && head) mesh.layers.set(1);
    });
    // All descendants of head-mounted hair belong to the first-person-hidden layer.
    actors.female.model.getObjectByName('Head')?.traverse(o => { if (o.isMesh) o.layers.set(1); });
    npc.add(actors.npc.model); npc.position.set(.2, 0, -1.2); npc.rotation.y = .18;
    for(const [zone,x,z,walk,phase] of [['street',-6.3,-16,true,.1],['street',6.3,8,true,.8],['street',6.9,21,false,0],['cafe',0,-3.9,false,0]]) {
      const actor=library.create('male'),pivot=new THREE.Group();pivot.add(actor.model);pivot.position.set(x,0,z);worlds[zone].add(pivot);
      actor.model.traverse(m=>{if(m.isMesh){m.material=m.material.clone();if(m.material.color)m.material.color.multiplyScalar(phase===.8?.65:.92);}});
      if(walk){actor.actions.Idle.setEffectiveWeight(0);actor.actions.Walk.setEffectiveWeight(1);actor.actions.Walk.timeScale=.45;}
      pedestrians.push({actor,pivot,zone,walk,phase,start:-21,end:17});
    }
    player.visible = false; setOutfit('cream', false);
    ready = true; $('#start').disabled = false; $('#start').textContent = '아침 시작하기 →';
    $('#start').addEventListener('click', () => { player.visible = true; });
    $('#continue').addEventListener('click', () => { player.visible = true; });
    $('#continue').hidden = !saved; $('#loading').textContent = '가상의 성인 인물 · 집에서 거리까지';
    document.body.dataset.ready = 'true';
    updateCamera(1, true); renderer.setAnimationLoop(frame);
    if (import.meta.env.DEV && new URLSearchParams(location.search).has('test')) {
      window.__morning = {
        get state() {
          const garments=[],headLayers=[];
          current?.model.traverse(o=>{
            if(!o.isMesh)return;
            if(o.material.name==='Camisole')garments.push({name:o.material.name,color:o.material.color.getHexString()});
            if(/head|tongue|hair|skullcap/i.test(o.material.name))headLayers.push(o.layers.mask);
          });
          return { ...state, completed: [...state.completed], mode, experience, cupVisible:cupProp.visible, garments, headLayers, asset:state.character==='female'?'Alina.glb':'Traveler.glb', x: player.position.x, z: player.position.z, npc: npc.visible, nearest: nearest?.id, mirrorView, cameraLayers: camera.layers.mask, reflectedLayers: apartment.mirror.getReflectionCamera(camera).layers.mask };
        },
        goTo(id) { const station = activeWorld.stations.find(s => s.id === id); if (station && mode === 'playing') { player.position.set(station.x, 0, station.z + (id === 'possess' ? 1 : 0)); updateCamera(1, true); updateInteractions(); } },
        inspect() { return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }; },
      };
    }
  } catch (error) {
    console.error(error); $('#start').textContent = '다시 불러오기'; $('#start').disabled = false;
    $('#start').addEventListener('click', () => location.reload());
    $('#loading').textContent = '3D 화면을 준비하지 못했습니다. WebGL 지원과 에셋 파일을 확인해 주세요.';
  }
}
window.addEventListener('resize', () => {
  if (!renderer || !camera) return;
  renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
});
boot();
