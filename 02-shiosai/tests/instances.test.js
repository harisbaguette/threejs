import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { spatialInstances } from '../src/materials.js';

test('공간별 최적화가 모든 식생의 위치·색과 표시 경계를 보존한다', () => {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), 12);
  const matrix = new THREE.Matrix4(), color = new THREE.Color(), expected = new Map();
  for (let i = 0; i < 12; i++) {
    const x = -100 + i * 19, z = -70 + (i % 4) * 53;
    matrix.makeTranslation(x, i * .5, z); mesh.setMatrixAt(i, matrix);
    color.setRGB(i / 12, .4, .2); mesh.setColorAt(i, color);
    expected.set(x, { z, red: i / 12 });
  }
  const cells = spatialInstances(mesh);
  assert.equal(cells.reduce((sum, cell) => sum + cell.count, 0), 12);
  for (const cell of cells) {
    for (let i = 0; i < cell.count; i++) {
      cell.getMatrixAt(i, matrix); cell.getColorAt(i, color);
      const position = new THREE.Vector3().setFromMatrixPosition(matrix), source = expected.get(position.x);
      assert.ok(source); assert.equal(position.z, source.z);
      assert.ok(Math.abs(color.r - source.red) < .000001);
      assert.ok(cell.boundingSphere.containsPoint(position));
      expected.delete(position.x);
    }
  }
  assert.equal(expected.size, 0);
});
