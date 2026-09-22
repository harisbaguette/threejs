"""Build a skinned, clothed fictional character and two mesh outfits for Three.js."""
from pathlib import Path
import bpy, math, json, random
import numpy as np
from mathutils import Vector, Matrix

ROOT=Path(__file__).resolve().parents[1]
random.seed(27)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'art-source/mpfb-base.blend'))
scene=bpy.context.scene
body=bpy.data.objects['Body_Base']; rig=next(o for o in scene.objects if o.type=='ARMATURE')
cal=json.loads((ROOT/'art-source/face-calibration.json').read_text())
portrait=bpy.data.images.load(str(ROOT/'art-source/seoyeon-face.png'))

def activate(o):
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active=o
def smooth(o):
    for p in o.data.polygons:p.use_smooth=True
def material(name,color,rough=.55):
    m=bpy.data.materials.new(name);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=rough
    return m
def mesh(name,verts,faces,mat):
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
    o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.data.materials.append(mat);smooth(o);return o
def bind(o,bone='Head'):
    g=o.vertex_groups.get(bone) or o.vertex_groups.new(name=bone);g.add(list(range(len(o.data.vertices))),1,'REPLACE')
    mod=o.modifiers.new('Skeleton','ARMATURE');mod.object=rig;o.parent=rig
def uv_photo(o):
    uv=o.data.uv_layers.get('Photo') or o.data.uv_layers.new(name='Photo')
    for loop in o.data.loops:
        co=o.data.vertices[loop.vertex_index].co
        uv.data[loop.index].uv=(cal['eye_u']+co.x/cal['photo_scale'],1-cal['eye_v']+(co.z-cal['eye_z'])/cal['photo_scale'])

# Body fit, anatomical silhouette, and neutral T rest pose.
for v,co in zip(body.data.vertices,np.load(ROOT/'art-source/seoyeon-vertices.npy')):v.co=co
activate(rig);bpy.ops.object.mode_set(mode='EDIT')
for b in rig.data.edit_bones:
    for attr in ['head','tail']:
        p=getattr(b,attr).copy();p.z+=.0283;p*=1.075;setattr(b,attr,p)
bpy.ops.object.mode_set(mode='OBJECT')
def align(name,end,direction):
    bpy.context.view_layer.update();b=rig.pose.bones[name]
    q=(rig.pose.bones[end].tail-b.head).rotation_difference(Vector(direction))
    b.matrix=Matrix.Translation(b.head)@q.to_matrix().to_4x4()@Matrix.Translation(-b.head)@b.matrix
    bpy.context.view_layer.update()
for side,sign in [('L',1),('R',-1)]:
    align('upperarm01.'+side,'upperarm02.'+side,(sign,0,0))
    align('lowerarm01.'+side,'lowerarm02.'+side,(sign,0,0))
activate(body)
for mod in list(body.modifiers):
    if mod.type in {'MASK','ARMATURE'}:bpy.ops.object.modifier_apply(modifier=mod.name)
activate(rig);bpy.ops.object.mode_set(mode='POSE');bpy.ops.pose.armature_apply(selected=False);bpy.ops.object.mode_set(mode='OBJECT')
for v in body.data.vertices:
    x,y,z=v.co
    if abs(x)<.23 and z<1.35:
        hip=math.exp(-((z-.91)/.14)**2);waist=math.exp(-((z-1.075)/.075)**2)
        v.co.x*=1+.15*hip-.065*waist
        if y<0:v.co.y*=1+.06*hip
body.data.update();smooth(body)
rename={'root':'Hips','spine05':'Spine','spine03':'Spine1','spine01':'Spine2','neck01':'Neck','head':'Head'}
for suffix,side in [('L','Left'),('R','Right')]:
    for source,target in [('clavicle','Shoulder'),('upperarm01','Arm'),('lowerarm01','ForeArm'),('wrist','Hand'),('upperleg01','UpLeg'),('lowerleg01','Leg'),('foot','Foot'),('toe1-1','ToeBase')]:rename[source+'.'+suffix]=side+target
    for finger,tag in [(1,'Thumb'),(2,'Index'),(3,'Middle'),(4,'Ring'),(5,'Pinky')]:
        for n in [1,2,3]:rename[f'finger{finger}-{n}.{suffix}']=f'{side}Hand{tag}{n}'
for old,new in rename.items():
    if old in body.vertex_groups:body.vertex_groups[old].name=new
    if old in rig.data.bones:rig.data.bones[old].name=new

# Texture baking preserves the generated face on an ordinary glTF material.
skin=material('AvatarBody',(.63,.40,.30),.6);body.data.materials.clear();body.data.materials.append(skin)
uv_photo(body)
original_uv=body.data.uv_layers[0];body.data.uv_layers.active=original_uv;original_uv.active_render=True
blend=body.data.color_attributes.new(name='FaceBlend',type='FLOAT_COLOR',domain='POINT')
for v in body.data.vertices:
    x,y,z=v.co
    w=min(1,max(0,(z-1.405)/.035))*min(1,max(0,(-y-.018)/.048))*min(1,max(0,(.106-abs(x))/.024))
    blend.data[v.index].color=(w,w,w,1)
n=skin.node_tree.nodes;l=skin.node_tree.links
uv=n.new('ShaderNodeUVMap');uv.uv_map='Photo';tex=n.new('ShaderNodeTexImage');tex.image=portrait;l.new(uv.outputs[0],tex.inputs['Vector'])
vc=n.new('ShaderNodeVertexColor');vc.layer_name='FaceBlend'
mix=n.new('ShaderNodeMixRGB');mix.inputs[1].default_value=(.59,.365,.265,1);l.new(vc.outputs['Color'],mix.inputs[0]);l.new(tex.outputs['Color'],mix.inputs[2])
em=n.new('ShaderNodeEmission');l.new(mix.outputs[0],em.inputs['Color']);l.new(em.outputs[0],n.get('Material Output').inputs['Surface'])
atlas=bpy.data.images.new('SeoyeonSkin',width=2048,height=2048,alpha=False)
bake=n.new('ShaderNodeTexImage');bake.image=atlas;n.active=bake
activate(body);scene.render.engine='CYCLES';scene.cycles.samples=1;scene.render.bake.margin=12
bpy.ops.object.bake(type='EMIT')
atlas.filepath_raw=str(ROOT/'art-source/seoyeon-skin.png');atlas.file_format='PNG';atlas.save()
n.clear();out=n.new('ShaderNodeOutputMaterial');bs=n.new('ShaderNodeBsdfPrincipled');bs.inputs['Roughness'].default_value=.62;bs.inputs['Specular IOR Level'].default_value=.25
tex=n.new('ShaderNodeTexImage');tex.image=atlas;l.new(tex.outputs['Color'],bs.inputs['Base Color']);l.new(bs.outputs[0],out.inputs[0])
body.data.uv_layers.remove(body.data.uv_layers['Photo'])

# Closely fitted but fully opaque knit top, and two different lower silhouettes.
knit=material('outfit_top',(.83,.76,.64),.84);wine=material('outfit_dress',(.20,.026,.055),.68)
skirtmat=material('outfit_skirt',(.07,.055,.047),.7);shoe=material('Shoes',(.045,.029,.022),.3)
def garment(name,predicate,mat,offset=.006):
    indices=[];faces=[];mapping={}
    for p in body.data.polygons:
        co=sum((body.data.vertices[i].co for i in p.vertices),Vector())/len(p.vertices)
        if not predicate(co,p):continue
        face=[]
        for i in p.vertices:
            if i not in mapping:mapping[i]=len(indices);indices.append(i)
            face.append(mapping[i])
        faces.append(face)
    obj=mesh(name,[body.data.vertices[i].co+body.data.vertices[i].normal*offset for i in indices],faces,mat)
    for g in body.vertex_groups:obj.vertex_groups.new(name=g.name)
    for ni,oi in enumerate(indices):
        for g in body.data.vertices[oi].groups:obj.vertex_groups[g.group].add([ni],g.weight,'REPLACE')
    activate(obj)
    sm=obj.modifiers.new('Relax woven cloth','SMOOTH');sm.factor=.7;sm.iterations=3;bpy.ops.object.modifier_apply(modifier=sm.name)
    sub=obj.modifiers.new('Cloth subdivision','SUBSURF');sub.levels=2;bpy.ops.object.modifier_apply(modifier=sub.name)
    solid=obj.modifiers.new('Hem thickness','SOLIDIFY');solid.thickness=.002;bpy.ops.object.modifier_apply(modifier=solid.name)
    mod=obj.modifiers.new('Skeleton','ARMATURE');mod.object=rig;obj.parent=rig
    return obj
def sleeve(p):
    return sum(sum(g.weight for g in body.data.vertices[i].groups if any(k in body.vertex_groups[g.group].name for k in ['Arm','arm','Shoulder'])) for i in p.vertices)/len(p.vertices)>.4
def topregion(co,p):
    x,y,z=co
    if abs(x)>.20:return abs(x)<.65 and z>1.12
    neckline=1.36 if abs(x)<.095 and y<0 else 1.46
    return 1.005<z<neckline
top=garment('OutfitA_Top',topregion,knit,.011)
dressTop=garment('OutfitB_Top',topregion,wine,.013)
top_hidden={p.index for p in body.data.polygons if topregion(sum((body.data.vertices[i].co for i in p.vertices),Vector())/len(p.vertices),p)}
def skirt(name,mat,bottom,flare):
    verts=[];faces=[];N=80;R=28
    for j in range(R+1):
        t=j/R;z=1.045-(1.045-bottom)*t
        hip=math.exp(-((z-.91)/.13)**2)
        rx=.157+.095*hip+flare*t*t;ry=.119+.065*hip+flare*t*t*.5
        for i in range(N):
            a=i/N*math.tau;fold=(.0015+.003*t)*math.sin(a*18)*t
            verts.append(((rx+fold)*math.cos(a),.012+(ry+fold)*math.sin(a),z))
    for j in range(R):
        for i in range(N):a=j*N+i;b=j*N+(i+1)%N;faces.append((a,b,b+N,a+N))
    o=mesh(name,verts,[tuple(reversed(f)) for f in faces],mat)
    hips=o.vertex_groups.new(name='Hips');left=o.vertex_groups.new(name='LeftUpLeg');right=o.vertex_groups.new(name='RightUpLeg')
    for v in o.data.vertices:
        t=(1.045-v.co.z)/(1.045-bottom);w=max(0,min(.65,(t-.2)*.8))
        hips.add([v.index],1-w,'REPLACE');(left if v.co.x>0 else right).add([v.index],w,'REPLACE')
    mod=o.modifiers.new('Skeleton','ARMATURE');mod.object=rig;o.parent=rig
    o.data.materials[0].use_backface_culling=False
    return o
skirt('OutfitA_Skirt',skirtmat,.52,.048)
skirt('OutfitB_Skirt',wine,.48,.11)
garment('Shoes',lambda co,p:co.z<.09,shoe,.006)

# Remove the fully covered skin under both skirts. This prevents skin crossing
# the fabric during leg animation; hands and all exposed legs remain intact.
import bmesh
bm=bmesh.new();bm.from_mesh(body.data)
covered=[]
for f in bm.faces:
    co=f.calc_center_median();x,y,z=co
    skirt_hidden=.505<z<1.065 and abs(x)<.29
    if skirt_hidden or f.index in top_hidden:covered.append(f)
bmesh.ops.delete(bm,geom=covered,context='FACES');bm.to_mesh(body.data);bm.free();body.data.update()

# Split head from body so first-person rendering can hide only the head.
headmat=skin.copy();headmat.name='AvatarHead';body.data.materials.append(headmat)
for p in body.data.polygons:
    if all(body.data.vertices[i].co.z>1.405 for i in p.vertices):p.material_index=1
activate(body);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.separate(type='MATERIAL');bpy.ops.object.mode_set(mode='OBJECT')
skins=[o for o in scene.objects if o.type=='MESH' and any(m and m.name in ['AvatarHead','AvatarBody'] for m in o.data.materials)]
for o in skins:
    activate(o);sub=o.modifiers.new('Skin smoothing','SUBSURF');sub.levels=1;bpy.ops.object.modifier_apply(modifier=sub.name)
    arm=o.modifiers.new('Skeleton','ARMATURE');arm.object=rig;o.parent=rig
    if o.data.materials[0].name=='AvatarHead':
        o.name='Seoyeon_Head';o.shape_key_add(name='Basis')
        landmarks=cal['landmarks'];lip_z=cal['eye_z']+(cal['eye_v']-landmarks[13][1])*cal['photo_scale']
        for side,sign in [('Left',1),('Right',-1)]:
            smile=o.shape_key_add(name='mouthSmile'+side,from_mix=False);smile.value=0
            blink=o.shape_key_add(name='eyeBlink'+side,from_mix=False);blink.value=0
            for v in o.data.vertices:
                x,y,z=v.co
                if y<-.065 and x*sign>0:
                    w=math.exp(-((abs(x)-.025)/.015)**2-((z-lip_z)/.015)**2)
                    smile.data[v.index].co.z+=.004*w;smile.data[v.index].co.x+=sign*.002*w
                    eye_w=math.exp(-((abs(x)-.0305)/.014)**2-((z-cal['eye_z'])/.010)**2)
                    blink.data[v.index].co.z+=(cal['eye_z']-z)*eye_w*.95

# Separate eyeballs with UV-projected generated iris detail.
eyemat=material('AvatarEyes',(.7,.65,.58),.3)
n=eyemat.node_tree.nodes;l=eyemat.node_tree.links;t=n.new('ShaderNodeTexImage');t.image=portrait;l.new(t.outputs['Color'],n.get('Principled BSDF').inputs['Base Color'])
for suffix,index in [('L',473),('R',468)]:
    lm=cal['landmarks'][index];x=(lm[0]-cal['eye_u'])*cal['photo_scale'];z=cal['eye_z']+(cal['eye_v']-lm[1])*cal['photo_scale']
    center=Vector((x,rig.data.bones['eye.'+suffix].head_local.y-.002,z))
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=20,radius=.0122,location=(0,0,0))
    o=bpy.context.object;o.name='Seoyeon_Eye_'+suffix
    for v in o.data.vertices:v.co+=center
    o.data.materials.append(eyemat);smooth(o)
    for layer in list(o.data.uv_layers):o.data.uv_layers.remove(layer)
    uv_photo(o);bind(o)

# CC-BY hair by Elvaerwyn, fitted to the new head using original MHCLO barycentrics.
hairdir=ROOT/'art-source/hair-assets/hair/elvs_adrienne_hair'
baseverts=np.load(ROOT/'art-source/seoyeon-vertices.npy')
lines=(hairdir/'elvs_adrienne_hair.mhclo').read_text().splitlines()
scales={};mappings=[];reading=False
for line in lines:
    words=line.split()
    if not words or words[0].startswith('#'):continue
    if words[0] in ['x_scale','y_scale','z_scale']:
        axis={'x_scale':0,'y_scale':2,'z_scale':1}[words[0]]
        scales[words[0]]=abs(baseverts[int(words[1]),axis]-baseverts[int(words[2]),axis])/float(words[3])
    if words[0]=='verts':reading=True;continue
    if reading:
        if len(words)==9:
            ids=list(map(int,words[:3]));weights=list(map(float,words[3:6]));dx,dy,dz=map(float,words[6:])
            co=sum((baseverts[i]*w for i,w in zip(ids,weights)),np.zeros(3))
            co+=np.array([dx*scales['x_scale'],-dz*scales['z_scale'],dy*scales['y_scale']]);mappings.append(co)
        elif len(words)==1 and words[0].isdigit():mappings.append(baseverts[int(words[0])])
        else:break
bpy.ops.wm.obj_import(filepath=str(hairdir/'elvs_adrienne_hair1.obj'))
hair=bpy.context.object;hair.name='Hair_Adrienne';hair.matrix_world=Matrix.Identity(4)
if len(hair.data.vertices)!=len(mappings):raise RuntimeError('Hair fitting vertex count mismatch')
for v,co in zip(hair.data.vertices,mappings):
    v.co=co
    if v.co.z>1.50:
        v.co.z=1.50+(v.co.z-1.50)*.84
        v.co.x*=.90
hair.data.materials.clear();hairmat=material('Hair',(.16,.13,.11),.55)
n=hairmat.node_tree.nodes;l=hairmat.node_tree.links;bs=n.get('Principled BSDF')
tex=n.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(hairdir/'Adriennehairtex1.png'))
l.new(tex.outputs['Color'],bs.inputs['Base Color']);l.new(tex.outputs['Alpha'],bs.inputs['Alpha'])
bs.inputs['Specular IOR Level'].default_value=.22
hair.data.materials.append(hairmat);smooth(hair);bind(hair)

# Keep only the character, embed textures, and export a normal rigged glTF.
for o in list(scene.objects):
    if o.type not in {'MESH','ARMATURE'}:bpy.data.objects.remove(o,do_unlink=True)
rig.name='SeoyeonRig'
for image in bpy.data.images:
    if image.source=='FILE' or image.name=='SeoyeonSkin':
        try:image.pack()
        except RuntimeError:pass
bpy.ops.object.select_all(action='SELECT')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art-source/Seoyeon.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/assets/Seoyeon.glb'),export_format='GLB',use_selection=True,export_animations=False,export_yup=True,export_apply=False,export_texcoords=True,export_normals=True,export_skins=True,export_morph=True)
print('EXPORTED Seoyeon.glb',sum(len(o.data.vertices) for o in scene.objects if o.type=='MESH'),'vertices')
