import bpy
bpy.ops.wm.open_mainfile(filepath='C:/Users/ghd12/Desktop/threejs/04-another-morning/art-source/Seoyeon.blend')
for o in bpy.data.objects:
 if o.type=='MESH' and o.data.shape_keys: print(o.name,[(k.name,k.value) for k in o.data.shape_keys.key_blocks])
for o in bpy.data.objects:
 if o.type=='MESH' and o.name.startswith('Hair'): print(o.name,'verts',len(o.data.vertices),'normal',o.data.vertices[10].normal[:])
