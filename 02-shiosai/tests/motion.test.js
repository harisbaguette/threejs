import test from 'node:test';
import assert from 'node:assert/strict';
import { journeyAt, advanceTime, LOOP_DURATION } from '../src/motion.js';

test('정차하는 동안 전철이 움직이지 않는다', () => {
  for (const time of [0, 1, 4.5, 8.999]) {
    assert.equal(journeyAt(time).z, -3);
    assert.equal(journeyAt(time).speed, 0);
  }
});

test('출발·가속·감속·정차 경계에서 위치와 속도가 이어진다', () => {
  for (const time of [9, 21, 78, 92]) {
    const before = journeyAt(time - .00001), after = journeyAt(time + .00001);
    assert.ok(Math.abs(before.z - after.z) < .001, `${time}초 위치`);
    assert.ok(Math.abs(before.speed - after.speed) < .001, `${time}초 속도`);
  }
});

test('반대쪽 진입 위치로 이동할 때는 역에서 멀리 떨어져 있다', () => {
  assert.ok(journeyAt(51.999).z > 160);
  assert.ok(journeyAt(52).z < -190);
});

test('여러 번 반복해도 같은 위치이며 역방향이나 잘못된 수치가 없다', () => {
  for (let time = -184; time < 400; time += .125) {
    const a = journeyAt(time), b = journeyAt(time + LOOP_DURATION);
    assert.ok(Number.isFinite(a.z) && Number.isFinite(a.speed));
    assert.ok(a.speed >= 0);
    assert.ok(Math.abs(a.z - b.z) < .000001);
  }
});

test('일시정지·탭 복귀·다른 프레임 속도를 처리한다', () => {
  assert.equal(advanceTime(18, .04, false), 18);
  assert.equal(advanceTime(18, 90, true), 18.1);
  assert.equal(advanceTime(18, -1, true), 18);
  const after = fps => Array.from({ length: fps }).reduce(t => advanceTime(t, 1 / fps, true), 0);
  assert.ok(Math.abs(after(30) - after(60)) < .000001);
});
