import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveMotion, isWalkable, stepVertical, validSave, GROUND_Y } from '../src/physics.js';

test('fast movement cannot tunnel through a narrow obstacle', () => {
  const p = resolveMotion({ x: 0, z: 0, y: GROUND_Y }, 8, 0, [{ x: 3, z: 0, halfX: .1, halfZ: 3, height: 5 }]);
  assert.ok(p.x < 2.62 && p.x > 2.3);
});
test('diagonal movement slides along a wall', () => {
  const p = resolveMotion({ x: 1, z: 0, y: GROUND_Y }, 4, -4, [{ x: 3, z: 0, halfX: .3, halfZ: 10, height: 5 }]);
  assert.ok(p.x < 2.42); assert.ok(p.z < -3.9);
});
test('the waterfront edge prevents falling into the sea', () => {
  const p = resolveMotion({ x: -9, z: 30, y: GROUND_Y }, -10, 0, []);
  assert.ok(p.x >= -10.2); assert.ok(p.x < -10);
  assert.equal(isWalkable(-23, 5.5), true);
  assert.equal(isWalkable(-31, -70), true);
  assert.equal(isWalkable(-23, 25), false);
});
test('jump returns to ground without hovering or double jumping', () => {
  const s = { x: 0, z: 0, y: GROUND_Y, velocityY: 0, grounded: true };
  stepVertical(s, 1 / 60, true); const launch = s.velocityY;
  stepVertical(s, 1 / 60, true); assert.ok(s.velocityY < launch);
  let peak = s.y;
  for (let i = 0; i < 90; i++) { stepVertical(s, 1 / 60, false); peak = Math.max(peak, s.y); }
  assert.ok(peak > 1); assert.equal(s.y, GROUND_Y); assert.equal(s.grounded, true);
});
test('corrupt or out-of-bounds saved games safely recover', () => {
  assert.equal(validSave(null, ['harbor']), null);
  assert.equal(validSave({ version: 2, found: [] }, ['harbor']), null);
  const save = validSave({ version: 1, found: ['harbor', 'harbor', 'fake'], position: { x: -500, z: 9 } }, ['harbor']);
  assert.deepEqual(save, { found: ['harbor'], position: { x: 0, z: 33 }, character: 'female' });
});
test('character choice survives save validation and older saves default to female', () => {
  const save = { version: 1, found: ['harbor'], position: { x: 0, z: 33 } };
  assert.equal(validSave({ ...save, character: 'male' }, ['harbor']).character, 'male');
  assert.equal(validSave({ ...save, character: 'female' }, ['harbor']).character, 'female');
  assert.equal(validSave({ ...save, character: 'unknown' }, ['harbor']).character, 'female');
  assert.equal(validSave(save, ['harbor']).character, 'female');
});
