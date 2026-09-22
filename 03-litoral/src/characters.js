import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

export const CHARACTERS = [
  { id: 'female', label: '여성', name: 'SOFIA', height: 1.69, url: '/assets/TravelerFemale.glb' },
  { id: 'male', label: '남성', name: 'JOSH', height: 1.8, url: '/assets/Traveler.glb' },
];
const CLIP_NAMES = { Idle: 'idle', Walk: 'walk', Run: 'run', Jump: 'Jump_Loop' };
const cleanName = name => name.replace(/^mixamorig:?/, '');

function fit(model, height) {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const scale = height / (box.max.y - box.min.y);
  model.scale.multiplyScalar(scale);
  model.position.y = -box.min.y * scale;
  model.updateMatrixWorld(true);
}

function prepareMaterials(model, female) {
  model.traverse(obj => {
    if (!obj.isMesh) return;
    obj.castShadow = obj.receiveShadow = true;
    obj.frustumCulled = false;
    const original = obj.material;
    const name = original.name.toLowerCase();
    const material = original.clone();
    if (female) {
      material.metalness = 0;
      material.envMapIntensity = .8;
      if (name.includes('head') || name.includes('body')) {
        const skin = new THREE.MeshPhysicalMaterial();
        THREE.MeshStandardMaterial.prototype.copy.call(skin, material);
        skin.roughness = .52; skin.metalness = 0;
        skin.sheen = .16; skin.sheenColor.set('#ba8b7b'); skin.sheenRoughness = .85;
        skin.specularIntensity = .36;
        if (skin.normalMap) skin.normalScale.set(.5, .5);
        obj.material = skin;
      } else if (name.includes('cornea')) {
        material.transparent = true; material.opacity = .17;
        material.roughness = .06; material.depthWrite = false;
        obj.material = material;
      } else if (name.includes('eyelashes')) {
        material.transparent = true; material.alphaTest = .35; material.depthWrite = false;
        material.side = THREE.DoubleSide; obj.material = material;
      } else {
        material.roughness = name.includes('eyeball') ? .24 : .8;
        obj.material = material;
      }
    } else {
      material.envMapIntensity = .6; material.roughness = .78; obj.material = material;
    }
    for (const item of Object.values(obj.material)) if (item?.isTexture) item.anisotropy = 8;
  });
}

/** Bake world-space skeletal deltas to the target's own rest pose.
 * Extra neck/twist bones keep their rest transforms; all limb lengths are preserved.
 * Sampling normalized characters at the origin avoids moving the mesh away from its controller.
 */
export function retargetLocomotion(source, target, original, name, heightRatio) {
  const sourceBones = new Map(), targetBones = [];
  source.traverse(b => { if (b.isBone && !sourceBones.has(cleanName(b.name))) sourceBones.set(cleanName(b.name), b); });
  target.traverse(b => { if (b.isBone) targetBones.push(b); });
  const sourceRest = new Map();
  source.updateMatrixWorld(true); target.updateMatrixWorld(true);
  for (const [key, bone] of sourceBones) sourceRest.set(key, {
    inverse: bone.getWorldQuaternion(new THREE.Quaternion()).invert(),
    position: bone.getWorldPosition(new THREE.Vector3()),
  });
  const bindings = targetBones.map(bone => ({
    bone, source: sourceBones.get(bone.name), sourceRest: sourceRest.get(bone.name),
    rotation: bone.quaternion.clone(), position: bone.position.clone(), scale: bone.scale.clone(),
    worldRotation: bone.getWorldQuaternion(new THREE.Quaternion()),
    worldPosition: bone.getWorldPosition(new THREE.Vector3()), values: [], positions: [],
  }));
  const duration = original.duration;
  const count = Math.max(2, Math.ceil(duration * 30) + 1), times = [];
  const sourceMixer = new THREE.AnimationMixer(source);
  const action = sourceMixer.clipAction(original); action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play();
  const worldRotation = new THREE.Quaternion(), parentInverse = new THREE.Quaternion(), point = new THREE.Vector3();
  for (let frame = 0; frame < count; frame++) {
    const t = Math.min(duration - .00001, frame / (count - 1) * duration);
    times.push(t); sourceMixer.setTime(t); source.updateMatrixWorld(true);
    for (const binding of bindings) {
      const { bone, source: from, sourceRest: rest } = binding;
      bone.position.copy(binding.position); bone.scale.copy(binding.scale);
      if (from) {
        from.getWorldQuaternion(worldRotation).multiply(rest.inverse).multiply(binding.worldRotation);
        bone.parent.getWorldQuaternion(parentInverse).invert();
        bone.quaternion.copy(parentInverse).multiply(worldRotation).normalize();
        if (bone.name === 'Hips') {
          const dy = from.getWorldPosition(point).y - rest.position.y;
          point.copy(binding.worldPosition); point.y += dy * heightRatio;
          bone.parent.worldToLocal(point); bone.position.copy(point);
          binding.positions.push(...bone.position.toArray());
        }
      } else bone.quaternion.copy(binding.rotation);
      bone.updateMatrixWorld(true);
      binding.values.push(...bone.quaternion.toArray());
    }
  }
  sourceMixer.stopAllAction(); sourceMixer.uncacheRoot(source);
  source.traverse(obj => { if (obj.isSkinnedMesh) obj.skeleton.pose(); });
  source.updateMatrixWorld(true);
  const tracks = [];
  for (const binding of bindings) {
    if (binding.source) tracks.push(new THREE.QuaternionKeyframeTrack(`${binding.bone.name}.quaternion`, times, binding.values));
    if (binding.positions.length) tracks.push(new THREE.VectorKeyframeTrack(`${binding.bone.name}.position`, times, binding.positions));
    binding.bone.position.copy(binding.position); binding.bone.quaternion.copy(binding.rotation); binding.bone.scale.copy(binding.scale);
  }
  target.updateMatrixWorld(true);
  return new THREE.AnimationClip(name, duration, tracks);
}

export async function loadCharacters(manager) {
  const loader = new GLTFLoader(manager);
  const [female, male] = await Promise.all(CHARACTERS.map(c => loader.loadAsync(c.url)));
  const library = new Map();
  fit(male.scene, 1.8); fit(female.scene, 1.69);
  prepareMaterials(male.scene, false); prepareMaterials(female.scene, true);
  const femaleClips = [];
  for (const [name, sourceName] of Object.entries(CLIP_NAMES)) {
    const original = male.animations.find(c => c.name === sourceName);
    if (!original) throw new Error(`Missing animation: ${sourceName}`);
    femaleClips.push(retargetLocomotion(male.scene, female.scene, original, name, 1.69 / 1.8));
  }
  library.set('female', { model: female.scene, clips: femaleClips });
  library.set('male', { model: male.scene, clips: Object.entries(CLIP_NAMES).map(([name, sourceName]) => {
    const clip = male.animations.find(c => c.name === sourceName).clone(); clip.name = name; return clip;
  }) });
  return {
    create(id) {
      const data = library.get(id) ?? library.get('female');
      const model = clone(data.model), mixer = new THREE.AnimationMixer(model), actions = {};
      for (const clip of data.clips) {
        const action = mixer.clipAction(clip); action.play(); action.setEffectiveWeight(clip.name === 'Idle' ? 1 : 0);
        actions[clip.name] = action;
      }
      mixer.update(0);
      return { model, mixer, actions };
    },
  };
}
