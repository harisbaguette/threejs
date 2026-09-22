import * as THREE from 'three';
import { loadCharacters } from './characters.js';
import { WALK_SPEED, RUN_SPEED, GROUND_Y, resolveMotion, stepVertical } from './physics.js';

export async function createPlayer(scene, manager, position = { x: 0, z: 33 }, characterId = 'female') {
  const library = await loadCharacters(manager);
  const pivot = new THREE.Group(); scene.add(pivot);
  const actors = new Map([['female', library.create('female')], ['male', library.create('male')]]);
  let current = actors.get(characterId) ?? actors.get('female');
  pivot.add(current.model);
  pivot.position.set(position.x, GROUND_Y, position.z);
  pivot.rotation.y = Math.PI;
  const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 64;
  const shadowContext = shadowCanvas.getContext('2d');
  const gradient = shadowContext.createRadialGradient(32, 32, 2, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(10,16,12,.45)'); gradient.addColorStop(.4, 'rgba(10,16,12,.22)'); gradient.addColorStop(1, 'rgba(10,16,12,0)');
  shadowContext.fillStyle = gradient; shadowContext.fillRect(0, 0, 64, 64);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.25), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; scene.add(shadow);
  const pedestrians = [
    { x: 3.1, start: -27, end: 8, phase: .22 },
    { x: -3.2, start: -79, end: -48, phase: .5 },
    { x: 4.2, start: 49, end: 76, phase: .6 },
  ].map((route, i) => {
    const npc = library.create(i === 1 ? 'female' : 'male');
    const group = new THREE.Group(); group.add(npc.model); group.position.set(route.x, GROUND_Y, route.start); scene.add(group);
    npc.actions.Idle.setEffectiveWeight(0); npc.actions.Walk.setEffectiveWeight(1);
    return { ...route, actor: group, animation: npc };
  });
  const state = { character: actors.has(characterId) ? characterId : 'female', x: position.x, y: GROUND_Y, z: position.z, velocityY: 0, grounded: true, stamina: 1, speed: 0, distance: 0, running: false, exhausted: false };
  const desired = new THREE.Vector3();
  let vx = 0, vz = 0;
  return {
    pivot, state,
    createPreview(id) { return library.create(id); },
    selectCharacter(id) {
      if (!actors.has(id) || id === state.character) return;
      pivot.remove(current.model); current = actors.get(id); pivot.add(current.model);
      state.character = id; vx = vz = 0;
      for (const [name, action] of Object.entries(current.actions)) action.reset().play().setEffectiveWeight(name === 'Idle' ? 1 : 0);
      current.mixer.update(0); pivot.updateMatrixWorld(true);
    },
    get modelBounds() {
      pivot.updateMatrixWorld(true);
      current.model.traverse(obj => { if (obj.isSkinnedMesh) obj.computeBoundingBox(); });
      return new THREE.Box3().setFromObject(pivot);
    },
    updatePedestrians(time, dt) {
      for (const p of pedestrians) {
        const length = p.end - p.start, phase = (time * 1.1 / length + p.phase) % 2;
        const forward = phase < 1;
        p.actor.position.z = p.start + (forward ? phase : 2 - phase) * length;
        p.actor.rotation.y = forward ? 0 : Math.PI;
        p.animation.update(dt * .6);
      }
    },
    reset() {
      state.x = 0; state.z = 33; state.y = GROUND_Y; state.velocityY = 0; state.grounded = true;
      state.stamina = 1; vx = vz = 0; pivot.position.set(state.x, state.y, state.z);
      pivot.rotation.y = Math.PI;
    },
    update(dt, input, cameraYaw, obstacles) {
      const length = Math.hypot(input.x, input.z);
      const moving = length > .1;
      if (state.stamina <= .01) state.exhausted = true;
      if (state.stamina >= .3) state.exhausted = false;
      const running = moving && input.run && !state.exhausted;
      state.running = running;
      state.stamina = THREE.MathUtils.clamp(state.stamina + (running ? -.16 : .13) * dt, 0, 1);
      desired.set(input.x, 0, input.z);
      if (length > 1) desired.normalize();
      desired.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw);
      const speed = running ? RUN_SPEED : WALK_SPEED;
      const smoothing = 1 - Math.exp(-12 * dt);
      vx = THREE.MathUtils.lerp(vx, desired.x * speed, smoothing);
      vz = THREE.MathUtils.lerp(vz, desired.z * speed, smoothing);
      const next = resolveMotion(state, vx * dt, vz * dt, obstacles);
      state.speed = Math.hypot(next.x - state.x, next.z - state.z) / Math.max(.0001, dt);
      state.distance += state.speed * dt;
      state.x = next.x; state.z = next.z;
      stepVertical(state, dt, input.jump, obstacles);
      pivot.position.set(state.x, state.y, state.z);
      if (moving) {
        const target = Math.atan2(desired.x, desired.z);
        const delta = Math.atan2(Math.sin(target - pivot.rotation.y), Math.cos(target - pivot.rotation.y));
        pivot.rotation.y += delta * (1 - Math.exp(-13 * dt));
      }
      const name = !state.grounded ? 'Jump' : state.speed < .15 ? 'Idle' : running ? 'Run' : 'Walk';
      const { actions } = current;
      for (const [key, action] of Object.entries(actions)) {
        action.setEffectiveWeight(THREE.MathUtils.lerp(action.getEffectiveWeight(), key === name ? 1 : 0, 1 - Math.exp(-9 * dt)));
      }
      actions.Walk.timeScale = Math.max(.5, state.speed / 2.6);
      actions.Run.timeScale = Math.max(.5, state.speed / 5.7);
      current.update(dt * (state.grounded ? 1 : .4));
      shadow.position.set(state.x, .105, state.z);
      shadow.material.opacity = Math.max(.12, 1 - (state.y - GROUND_Y) * .6);
    },
  };
}

export function createFollowCamera(camera, player, cameraObstacles) {
  const state = { yaw: -.09, pitch: .24, distance: 5.4, sensitivity: 1 };
  const look = new THREE.Vector3(), desired = new THREE.Vector3(), direction = new THREE.Vector3();
  const smoothedLook = player.pivot.position.clone().add(new THREE.Vector3(0, 1.35, 0));
  const ray = new THREE.Raycaster();
  return {
    state,
    orbit(dx, dy) { state.yaw -= dx * .004 * state.sensitivity; state.pitch = THREE.MathUtils.clamp(state.pitch + dy * .003 * state.sensitivity, -.06, .95); },
    zoom(delta) { state.distance = THREE.MathUtils.clamp(state.distance + delta * .005, 2.3, 9.5); },
    update(dt, immediate = false) {
      look.copy(player.pivot.position).add(new THREE.Vector3(0, 1.4, 0));
      smoothedLook.lerp(look, immediate ? 1 : 1 - Math.exp(-12 * dt));
      desired.set(Math.sin(state.yaw) * Math.cos(state.pitch), Math.sin(state.pitch), Math.cos(state.yaw) * Math.cos(state.pitch));
      desired.multiplyScalar(state.distance).add(smoothedLook);
      direction.copy(desired).sub(smoothedLook); const fullDistance = direction.length(); direction.normalize();
      ray.set(smoothedLook, direction); ray.far = fullDistance;
      const hits = ray.intersectObjects(cameraObstacles, false);
      if (hits.length) desired.copy(smoothedLook).addScaledVector(direction, Math.max(.6, hits[0].distance - .35));
      desired.y = Math.max(.65, desired.y);
      camera.position.lerp(desired, immediate ? 1 : 1 - Math.exp(-9 * dt));
      camera.lookAt(smoothedLook);
      player.pivot.visible = camera.position.distanceTo(smoothedLook) > 1;
    },
  };
}
