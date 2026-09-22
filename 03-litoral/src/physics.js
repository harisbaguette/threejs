export const WALK_SPEED = 2.7;
export const RUN_SPEED = 6.1;
export const PLAYER_RADIUS = .29;
export const GROUND_Y = .16;
export const ZONES = [
  { minX: -10.2, maxX: 11, minZ: -96, maxZ: 82 },
  { minX: 8, maxX: 37, minZ: -49, maxZ: -28 },
  { minX: -37, maxX: -8, minZ: -73.8, maxZ: -66.2 },
  { minX: -32.8, maxX: -9, minZ: 3.65, maxZ: 7.35 },
];

export function isWalkable(x, z) {
  return ZONES.some(a => x >= a.minX && x <= a.maxX && z >= a.minZ && z <= a.maxZ);
}

export function collides(x, z, obstacles, y = GROUND_Y) {
  return obstacles.some(o => {
    if (y > o.height + .06) return false;
    const dx = x - Math.max(o.x - o.halfX, Math.min(x, o.x + o.halfX));
    const dz = z - Math.max(o.z - o.halfZ, Math.min(z, o.z + o.halfZ));
    return dx * dx + dz * dz < PLAYER_RADIUS * PLAYER_RADIUS;
  });
}

export function resolveMotion(position, dx, dz, obstacles) {
  // Short substeps prevent tunnelling during a slow frame and permit wall sliding.
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .12));
  let x = position.x, z = position.z;
  for (let i = 0; i < steps; i++) {
    const nextX = x + dx / steps;
    if (isWalkable(nextX, z) && !collides(nextX, z, obstacles, position.y)) x = nextX;
    const nextZ = z + dz / steps;
    if (isWalkable(x, nextZ) && !collides(x, nextZ, obstacles, position.y)) z = nextZ;
  }
  return { x, z };
}

export function stepVertical(state, dt, jump, obstacles = []) {
  if (jump && state.grounded) { state.velocityY = 6.6; state.grounded = false; }
  state.velocityY -= 20 * dt;
  const nextY = state.y + state.velocityY * dt;
  let floor = GROUND_Y;
  for (const o of obstacles) {
    const top = o.height + .08;
    if (state.y >= top && nextY <= top && state.velocityY < 0 &&
        Math.abs(state.x - o.x) <= o.halfX + PLAYER_RADIUS * .7 &&
        Math.abs(state.z - o.z) <= o.halfZ + PLAYER_RADIUS * .7) floor = Math.max(floor, top);
  }
  state.y = Math.max(floor, nextY);
  if (state.y <= floor) { state.velocityY = 0; state.grounded = true; }
  else state.grounded = false;
}

export function validSave(value, landmarkIds) {
  if (!value || value.version !== 1 || !Array.isArray(value.found)) return null;
  const found = [...new Set(value.found.filter(id => landmarkIds.includes(id)))];
  const p = value.position;
  const position = p && Number.isFinite(p.x) && Number.isFinite(p.z) && isWalkable(p.x, p.z)
    ? { x: p.x, z: p.z } : { x: 0, z: 33 };
  const character = value.character === 'male' ? 'male' : 'female';
  return { found, position, character };
}
