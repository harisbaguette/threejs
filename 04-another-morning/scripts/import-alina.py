"""Package the public CC BY character for the application's humanoid controller."""
from pathlib import Path
import bpy, re
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'art-source/alina-original/prepared.gltf'))
rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
print('RIG', rig.name, rig.matrix_world)
for name in ['CC_Base_L_Upperarm_050', 'CC_Base_L_Forearm_051', 'CC_Base_Head_038', 'CC_Base_Hip_02']:
    b = rig.pose.bones.get(name)
    if b: print('BONE', name, tuple(rig.matrix_world @ b.head), tuple(rig.matrix_world @ b.tail))
mapping = {'Hip': 'Hips', 'Waist': 'Spine', 'Spine01': 'Spine1', 'Spine02': 'Spine2', 'NeckTwist01': 'Neck', 'Head': 'Head'}
for short, side in [('L', 'Left'), ('R', 'Right')]:
    for a, b in [('Clavicle','Shoulder'), ('Upperarm','Arm'), ('Forearm','ForeArm'), ('Hand','Hand'), ('Thigh','UpLeg'), ('Calf','Leg'), ('Foot','Foot'), ('ToeBase','ToeBase')]:
        mapping[f'{short}_{a}'] = side+b
    for finger, target in [('Thumb','Thumb'), ('Index','Index'), ('Mid','Middle'), ('Ring','Ring'), ('Pinky','Pinky')]:
        for i in [1, 2, 3]: mapping[f'{short}_{finger}{i}'] = f'{side}Hand{target}{i}'
for bone in rig.data.bones:
    key = re.sub(r'_\d+$', '', bone.name.removeprefix('CC_Base_'))
    if key in mapping: bone.name = mapping[key]
def activate(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

# Bind the A-pose asset to a T rest pose for the existing Mixamo locomotion.
for side, sign in [('Left', 1), ('Right', -1)]:
    for start, end in [('Arm', 'ForeArm'), ('ForeArm', 'Hand')]:
        bpy.context.view_layer.update()
        bone = rig.pose.bones[side+start]
        direction = rig.pose.bones[side+end].head-bone.head
        rotation = direction.rotation_difference(Vector((sign, 0, 0)))
        bone.matrix = Matrix.Translation(bone.head) @ rotation.to_matrix().to_4x4() @ Matrix.Translation(-bone.head) @ bone.matrix
        bpy.context.view_layer.update()
for obj in list(bpy.context.scene.objects):
    if obj.type != 'MESH': continue
    if not obj.data.materials:
        bpy.data.objects.remove(obj, do_unlink=True)
        continue
    activate(obj)
    for modifier in list(obj.modifiers):
        if modifier.type == 'ARMATURE': bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.name = obj.data.materials[0].name
    for mat in obj.data.materials:
        bs = mat.node_tree.nodes.get('Principled BSDF')
        if bs:
            bs.inputs['Roughness'].default_value = .72
            bs.inputs['Specular IOR Level'].default_value = .28
    print('MESH', obj.name, len(obj.data.vertices))
activate(rig)
bpy.ops.object.mode_set(mode='POSE')
bpy.ops.pose.armature_apply(selected=False)
bpy.ops.object.mode_set(mode='OBJECT')
for obj in bpy.context.scene.objects:
    if obj.type == 'MESH':
        mod = obj.modifiers.new('Skeleton', 'ARMATURE')
        mod.object = rig
# No face sculpt, body reshaping or generated clothing: retain the artist's asset.
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art-source/Alina-adapted.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/assets/Alina.glb'), export_format='GLB', export_animations=False)
print('EXPORTED Alina.glb')
