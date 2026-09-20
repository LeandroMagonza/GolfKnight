"""Convert the 'Used Golf Club' model into a GLB normalized for the game:
grip end at the origin, shaft along glTF +Z, toe of the head towards glTF +Y, total length 1.
Textures are reduced to 1024 px and saved as JPEG so the file stays small.

usage: blender -b --python tools/club_to_glb.py -- "<Golf Club Model.fbx>" "<textures dir>" "<out.glb>"
"""
import bpy, sys, os
from mathutils import Vector, Matrix
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mt_blender import *

fbx, texdir, out = sys.argv[sys.argv.index("--") + 1:][:3]
bpy.ops.wm.read_factory_settings(use_empty=True)
objs = import_fbx(fbx)
meshes = [o for o in objs if o.type == 'MESH']
print("objects:", [(o.name, o.type, len(o.data.vertices) if o.type == 'MESH' else 0) for o in objs])

# join everything into one mesh with transforms applied
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
club = bpy.context.view_layer.objects.active
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for o in [o for o in bpy.data.objects if o is not club]:
    bpy.data.objects.remove(o, do_unlink=True)

pts = [v.co.copy() for v in club.data.vertices]
mn = Vector([min(p[i] for p in pts) for i in range(3)])
mx = Vector([max(p[i] for p in pts) for i in range(3)])
size = mx - mn
axis = max(range(3), key=lambda i: size[i])
length = size[axis]
print("bbox", tuple(round(v, 4) for v in mn), tuple(round(v, 4) for v in mx), "long axis", axis, "length", round(length, 4))

# the head is the end whose cross-section is wider
others = [i for i in range(3) if i != axis]
def spread(sel):
    return sum(max(p[i] for p in sel) - min(p[i] for p in sel) for i in others)
lo = [p for p in pts if p[axis] < mn[axis] + 0.12 * length]
hi = [p for p in pts if p[axis] > mx[axis] - 0.12 * length]
head_at_max = spread(hi) > spread(lo)
head_pts, grip_pts = (hi, lo) if head_at_max else (lo, hi)
grip_center = sum(grip_pts, Vector()) / len(grip_pts)
grip_end = grip_center.copy()
grip_end[axis] = mn[axis] if head_at_max else mx[axis]
shaft = Vector((0, 0, 0))
shaft[axis] = 1.0 if head_at_max else -1.0
head_center = sum(head_pts, Vector()) / len(head_pts)
toe = head_center - grip_end
toe -= toe.dot(shaft) * shaft
toe.normalize()
print("head at", "max" if head_at_max else "min", "toe dir", tuple(round(v, 3) for v in toe))

# Blender (x, y, z) -> glTF (x, z, -y): glTF +Z is Blender -Y, glTF +Y is Blender +Z
side = toe.cross(shaft)
R = Matrix((side, -shaft, toe)).to_4x4()   # rows: world X <- side, world Y <- -shaft, world Z <- toe
M = Matrix.Scale(1.0 / length, 4) @ R @ Matrix.Translation(-grip_end)
club.data.transform(M)
club.data.update()

# material from the pack's textures
def load(name):
    p = os.path.join(texdir, name)
    im = bpy.data.images.load(p)
    if max(im.size) > 1024:
        im.scale(1024, 1024)
    return im
mat = bpy.data.materials.new("GolfClub")
mat.use_nodes = True
nt = mat.node_tree
bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
def tex(name, colorspace):
    n = nt.nodes.new('ShaderNodeTexImage')
    n.image = load(name)
    n.image.colorspace_settings.name = colorspace
    return n
nt.links.new(tex("Golf Club Diff.png", 'sRGB').outputs['Color'], bsdf.inputs['Base Color'])
nt.links.new(tex("Golf Club Metalness.png", 'Non-Color').outputs['Color'], bsdf.inputs['Metallic'])
nm = nt.nodes.new('ShaderNodeNormalMap')
nt.links.new(tex("Golf Club Normal.png", 'Non-Color').outputs['Color'], nm.inputs['Color'])
nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
bsdf.inputs['Roughness'].default_value = 0.45
club.data.materials.clear()
club.data.materials.append(mat)

bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=85,
                          export_animations=False, export_apply=True, export_yup=True)
print("WROTE", out, os.path.getsize(out), "bytes")
