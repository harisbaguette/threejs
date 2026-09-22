import bpy
from mathutils import Vector
bpy.ops.wm.open_mainfile(filepath='C:/Users/ghd12/Desktop/threejs/04-another-morning/art-source/Seoyeon.blend')
s=bpy.context.scene
for o in s.objects:
 if o.name.startswith('OutfitB'):o.hide_render=True
bpy.ops.object.camera_add(location=(0,-3,1.55));c=bpy.context.object;c.rotation_euler=(Vector((0,0,1.55))-c.location).to_track_quat('-Z','Y').to_euler();c.data.type='ORTHO';c.data.ortho_scale=.5;s.camera=c
for loc,power in [((1,-2,3),150),((-1,-2,2),80)]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=3;o.rotation_euler=(Vector((0,0,1.55))-o.location).to_track_quat('-Z','Y').to_euler()
s.render.engine='CYCLES';s.cycles.samples=16;s.render.resolution_x=800;s.render.resolution_y=800;s.render.resolution_percentage=100;s.world.color=(.2,.2,.2);s.render.filepath='C:/Users/ghd12/Desktop/threejs/04-another-morning/art-source/face-render.png';bpy.ops.render.render(write_still=True)
