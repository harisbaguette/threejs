import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const geometries = new Map();
export const materials = {
  dark: new THREE.MeshStandardMaterial({
    color: "#272e2c",
    roughness: 0.7,
    metalness: 0.3,
  }),
  steel: new THREE.MeshStandardMaterial({
    color: "#8b9596",
    roughness: 0.3,
    metalness: 0.85,
  }),
  iron: new THREE.MeshStandardMaterial({
    color: "#5f635e",
    roughness: 0.72,
    metalness: 0.6,
  }),
  timber: new THREE.MeshStandardMaterial({ color: "#5e4635", roughness: 0.9 }),
  cream: new THREE.MeshStandardMaterial({ color: "#d8d3b5", roughness: 0.56 }),
  roof: new THREE.MeshStandardMaterial({
    color: "#384341",
    roughness: 0.65,
    metalness: 0.3,
  }),
  bulb: new THREE.MeshStandardMaterial({
    color: "#fff1ce",
    emissive: "#ffda9b",
    emissiveIntensity: 5,
    toneMapped: false,
  }),
};

export function box(parent, size, position, material, bevel = 0) {
  const key = `${size.join(",")}/${bevel}`;
  if (!geometries.has(key))
    geometries.set(
      key,
      bevel
        ? new RoundedBoxGeometry(...size, 2, bevel)
        : new THREE.BoxGeometry(...size),
    );
  const mesh = new THREE.Mesh(geometries.get(key), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function cylinder(
  parent,
  radius,
  length,
  position,
  material,
  radius2 = radius,
  segments = 16,
) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius2, length, segments),
    material,
  );
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function tube(parent, points, radius, material, segments = 32) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(...p)),
  );
  const mesh = new THREE.Mesh(
    new THREE.TubeGeometry(curve, segments, radius, 6, false),
    material,
  );
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

export function boardTexture(draw, width = 1024, height = 512) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext("2d"), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export function sign(
  parent,
  size,
  position,
  texture,
  { emissive = 0.15, rotation = 0 } = {},
) {
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    emissiveMap: texture,
    emissive: "#ffffff",
    emissiveIntensity: emissive,
    roughness: 0.45,
  });
  const mesh = box(
    parent,
    [size[0], size[1], 0.065],
    position,
    material,
    0.025,
  );
  mesh.rotation.y = rotation;
  return mesh;
}

export async function loadTextures(renderer) {
  const loader = new THREE.TextureLoader();
  const textures = {};
  await Promise.all(
    ["asphalt_02", "concrete_floor_02", "gravel_stones", "wood_planks"].map(
      async (name) => {
        const [map, normalMap, roughnessMap] = await Promise.all(
          ["diff", "nor_gl", "rough"].map((kind) =>
            loader.loadAsync(`/assets/${name}_${kind}_1k.jpg`),
          ),
        );
        map.colorSpace = THREE.SRGBColorSpace;
        for (const texture of [map, normalMap, roughnessMap]) {
          texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
          texture.anisotropy = Math.min(
            8,
            renderer.capabilities.getMaxAnisotropy(),
          );
        }
        textures[name] = { map, normalMap, roughnessMap };
      },
    ),
  );
  return textures;
}

export function pbr(textures, name, repeats, options = {}) {
  const maps = {};
  for (const [key, original] of Object.entries(textures[name])) {
    maps[key] = original.clone();
    maps[key].repeat.set(...repeats);
  }
  return new THREE.MeshStandardMaterial({
    ...maps,
    roughness: 0.8,
    normalScale: new THREE.Vector2(0.35, 0.35),
    ...options,
  });
}

export function applyPhotographicMaterials(textures) {
  Object.assign(materials.timber, {
    map: textures.wood_planks.map,
    normalMap: textures.wood_planks.normalMap,
    roughnessMap: textures.wood_planks.roughnessMap,
  });
  materials.timber.color.set("#a7a093");
  materials.timber.normalScale.set(0.45, 0.45);
  materials.roof.roughness = 0.94;
  materials.roof.metalness = 0.12;
  materials.iron.roughnessMap = textures.concrete_floor_02.roughnessMap;
}

export function batch(parent) {
  for (const child of [...parent.children])
    if (child.isGroup && !child.userData.dynamic) batch(child);
  const groups = new Map();
  for (const mesh of parent.children) {
    if (
      !mesh.isMesh ||
      mesh.isInstancedMesh ||
      mesh.material.isShaderMaterial ||
      mesh.userData.dynamic
    )
      continue;
    const key =
      mesh.material.uuid +
      Object.keys(mesh.geometry.attributes).sort().join(",");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(mesh);
  }
  for (const meshes of groups.values()) {
    if (meshes.length < 2) continue;
    const temporary = meshes.map((mesh) => {
      mesh.updateMatrix();
      const geometry = mesh.geometry.index
        ? mesh.geometry.toNonIndexed()
        : mesh.geometry.clone();
      return geometry.applyMatrix4(mesh.matrix);
    });
    const geometry = mergeGeometries(temporary);
    temporary.forEach((g) => g.dispose());
    if (!geometry) continue;
    const mesh = new THREE.Mesh(geometry, meshes[0].material);
    mesh.castShadow = meshes.some((m) => m.castShadow);
    mesh.receiveShadow = meshes.some((m) => m.receiveShadow);
    meshes.forEach((m) => parent.remove(m));
    parent.add(mesh);
  }
}

export function seededRandom(seed = 93) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function spatialInstances(mesh, cellSize = 48) {
  const cells = new Map(), matrix = new THREE.Matrix4(), color = new THREE.Color();
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, matrix);
    const key = `${Math.floor(matrix.elements[12] / cellSize)},${Math.floor(matrix.elements[14] / cellSize)}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(i);
  }
  return [...cells.values()].map(indices => {
    const cell = new THREE.InstancedMesh(mesh.geometry, mesh.material, indices.length);
    indices.forEach((source, index) => {
      mesh.getMatrixAt(source, matrix); cell.setMatrixAt(index, matrix);
      if (mesh.instanceColor) { mesh.getColorAt(source, color); cell.setColorAt(index, color); }
    });
    cell.castShadow = mesh.castShadow;
    cell.receiveShadow = mesh.receiveShadow;
    cell.computeBoundingSphere();
    return cell;
  });
}
