import bpy,json
from pathlib import Path
bpy.ops.wm.open_mainfile(filepath='C:/Users/ghd12/Desktop/threejs/04-another-morning/art-source/Seoyeon.blend')
for o in bpy.context.scene.objects:
 if o.type in ['MESH','ARMATURE']:
  print(o.name,'scale',tuple(o.scale),'loc',tuple(o.location),'parentinv',[list(r) for r in o.matrix_parent_inverse],'bounds',tuple(o.dimensions),'mat',[m.name for m in getattr(o.data,'materials',[])])
