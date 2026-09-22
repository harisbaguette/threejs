import test from 'node:test';
import assert from 'node:assert/strict';
import { wrap, advanceDistance, carriageDistance, TRACK } from '../src/journey.js';
import { createRoute, makeTerrainSampler, riverX } from '../src/terrain.js';

test('정지하면 프레임이 진행되어도 열차 위치를 유지한다', () => {
  assert.equal(advanceDistance(24, 1, 2, false, 100), 24);
});
test('프레임 수와 관계없이 같은 시간 동안 같은 거리를 달린다', () => {
  let distance = 0;
  for (let i = 0; i < 60; i++) distance = advanceDistance(distance, 1 / 60, 1.5, true, 100);
  assert.ok(Math.abs(distance - advanceDistance(0, 1, 1.5, true, 100)) < 1e-10);
});
test('노선 끝을 통과해도 각 객차의 거리 간격이 유지된다', () => {
  assert.equal(wrap(-3, 100), 97);
  assert.ok(Math.abs(advanceDistance(99, 1, 1, true, 100) - 3.8) < 1e-10);
  assert.ok(Math.abs(wrap(2 - carriageDistance(2, 1, 100), 100) - TRACK.carSpacing) < 1e-10);
});
test('순환 선로의 시작과 끝 위치 및 방향이 이어진다', () => {
  const route = createRoute();
  assert.ok(route.getPointAt(0).distanceTo(route.getPointAt(1)) < .001);
  assert.ok(route.getTangentAt(0).dot(route.getTangentAt(.99999)) > .999);
});
test('선로가 지형에 묻히지 않고 계곡 물길은 수면 아래에 있다', () => {
  const route = createRoute(), { heightAt } = makeTerrainSampler(route);
  for (let i = 0; i < 150; i++) {
    const p = route.getPointAt(i / 150);
    assert.ok(heightAt(p.x, p.z) < p.y - .2);
  }
  for (let z = -150; z < 150; z += 10) assert.ok(heightAt(riverX(z), z) < 0);
});
