import test from 'node:test';
import assert from 'node:assert/strict';
import { presets, cameraPreset, constrainCamera } from '../src/camera.js';

test('모바일과 데스크톱의 3개 시점이 지면·전철과 충돌하지 않는다', () => {
  for (const width of [320, 375, 768, 1440]) {
    for (const name of Object.keys(presets)) {
      const preset = cameraPreset(name, width);
      const [x, y, z] = preset.position;
      assert.deepEqual(constrainCamera({ x, y, z }, y, -3), { x, y, z });
      assert.ok(preset.fov >= 40 && preset.fov <= 60);
    }
  }
});

test('카메라를 아래로 계속 돌려도 지면 아래로 들어가지 않는다', () => {
  for (let phi = 0; phi <= Math.PI; phi += .01) {
    const position = { x: -5, y: 2.15 + Math.cos(phi) * 40, z: -17 + Math.sin(phi) * 40 };
    constrainCamera(position, 2.5, -3);
    assert.ok(position.y >= 1.2);
    assert.ok(position.y <= 4 || position.y >= 5.05);
  }
});

test('처마와 차체의 안쪽으로 통과하지 않는다', () => {
  assert.equal(constrainCamera({ x: -5, y: 4.5, z: 0 }, 3.9, -3).y, 4);
  assert.equal(constrainCamera({ x: -5, y: 4.5, z: 0 }, 5.2, -3).y, 5.05);
  assert.equal(constrainCamera({ x: -.5, y: 2, z: 2 }, 2, -3).x, -1.8);
  assert.equal(constrainCamera({ x: .5, y: 2, z: 2 }, 2, -3).x, 1.8);
  assert.equal(constrainCamera({ x: .5, y: 2, z: 2 }, 2, 90).x, .5);
});
