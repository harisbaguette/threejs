import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, restoreState, complete, moveWithCollision, nextObjective } from '../src/state.js';

test('male cannot earn female experiences; repeated interactions do not inflate progress', () => {
  const state = initialState();
  assert.equal(complete(state, 'mirror'), false);
  state.character = 'female';
  assert.equal(complete(state, 'mirror'), true);
  assert.equal(complete(state, 'mirror'), false);
  assert.deepEqual(state.completed, ['mirror']);
  assert.equal(nextObjective(state), '옷장에서 옷 색상 고르기');
});
test('corrupt or old saves cannot break startup, unknown progress is removed', () => {
  for (const raw of ['{broken', 'null', '[]', '{"version":2}']) assert.equal(restoreState(raw), null);
  const state = restoreState(JSON.stringify({ version: 1, character: 'unknown', completed: ['mirror', 'mirror', 'x'], outfit: 'x', view: 'x', reply: '<script>' }));
  assert.deepEqual(state, { ...initialState(), completed: ['mirror'] });
});
test('room boundaries, collision sliding and fast-frame tunneling', () => {
  const wall = [{ x: 0, z: 0, w: .1, d: 3 }];
  const stopped = moveWithCollision({ x: -1, z: 0 }, 3, 0, wall);
  assert.ok(stopped.x <= -.3);
  const slide = moveWithCollision({ x: -.31, z: 0 }, 1, .5, wall);
  assert.ok(slide.x <= -.3); assert.ok(slide.z > .4);
  const edge = moveWithCollision({ x: 5.5, z: -4.5 }, 4, -4, []);
  assert.equal(edge.x, 5.65); assert.equal(edge.z, -4.62);
});
