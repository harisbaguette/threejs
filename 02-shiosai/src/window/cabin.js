import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

// Real foreground geometry separates the glass from the distant relief surface.
export function createCabin(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const rubber = new THREE.MeshStandardMaterial({
    color: "#121918",
    roughness: 0.84,
  });
  const metal = new THREE.MeshStandardMaterial({
    color: "#8c938b",
    metalness: 0.8,
    roughness: 0.34,
  });
  const enamel = new THREE.MeshStandardMaterial({
    color: "#484d43",
    roughness: 0.65,
    metalness: 0.2,
  });
  const sill = new THREE.MeshStandardMaterial({
    color: "#353b34",
    roughness: 0.5,
    metalness: 0.3,
  });
  const materials = [rubber, metal, enamel, sill];
  const parts = [];
  function bar(w, h, d, material, x, y, z, radius = 0.02) {
    const geometry = new RoundedBoxGeometry(
      w,
      h,
      d,
      2,
      Math.min(radius, w / 3, h / 3),
    );
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    group.add(mesh);
    parts.push(mesh);
    return mesh;
  }
  const warm = new THREE.PointLight("#ffdeb0", 8, 12, 2);
  warm.position.set(-1, 3, 4);
  scene.add(warm, new THREE.HemisphereLight("#bdcfd7", "#1e241e", 1.1));
  function resize(aspect) {
    for (const mesh of parts) {
      group.remove(mesh);
      mesh.geometry.dispose();
    }
    parts.length = 0;
    const h = 2 * Math.tan((42 * Math.PI) / 360) * 5;
    const w = h * aspect;
    const x = w / 2 - (aspect < 1 ? 0.045 : 0.095);
    const top = h / 2 - 0.035;
    const bottom = -h / 2 + 0.22;
    for (const side of [-1, 1]) {
      bar(0.24, h + 1, 0.21, enamel, side * (x + 0.13), 0, 1);
      bar(0.075, h + 1, 0.06, rubber, side * x, 0, 1.12);
      bar(0.021, h + 1, 0.035, metal, side * (x - 0.052), 0, 1.15, 0.006);
    }
    bar(w + 1, 0.15, 0.18, enamel, 0, top + 0.08, 1.05);
    bar(w + 1, 0.052, 0.05, rubber, 0, top - 0.025, 1.12);
    bar(w + 1, 0.017, 0.035, metal, 0, top - 0.068, 1.15, 0.005);
    bar(w + 1, 0.07, 0.055, rubber, 0, bottom, 1.12);
    bar(w + 1, 0.028, 0.07, metal, 0, bottom - 0.057, 1.16, 0.008);
    bar(w + 1, 0.28, 0.52, sill, 0, bottom - 0.21, 1.22);
    // A tiny latch and its fixing screw, tucked into the near edge.
    bar(0.09, 0.26, 0.06, metal, x - 0.04, -0.4, 1.19);
    bar(0.13, 0.034, 0.09, rubber, x - 0.07, -0.37, 1.25, 0.008);
  }
  return {
    resize,
    update(night) {
      warm.intensity = 8 - night * 2;
    },
    dispose() {
      parts.forEach((m) => m.geometry.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
