import bpy, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mt_blender import *
path = sys.argv[sys.argv.index("--") + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
import_fbx(path)
for o in bpy.data.objects:
    extra = ""
    if o.type == "MESH":
        extra = f" verts={len(o.data.vertices)} mats={[m.name if m else None for m in o.data.materials]}"
    if o.type == "ARMATURE":
        extra = f" bones={len(o.data.bones)} first={[b.name for b in o.data.bones][:3]}"
    print(f"{o.type:9} {o.name!r} parent={o.parent.name if o.parent else None} scale={tuple(round(v,3) for v in o.scale)}{extra}")
arms = [o for o in bpy.data.objects if o.type == "ARMATURE"]
if arms:
    a = arms[0]
    mw = a.matrix_world
    b = a.data.bones
    def P(n): return mw @ b[n].head_local
    if "mixamorig:Hips" in b:
        print("hips", tuple(round(v,3) for v in P("mixamorig:Hips")), "head", tuple(round(v,3) for v in P("mixamorig:Head")), "Lhand", tuple(round(v,3) for v in P("mixamorig:LeftHand")), "Lfoot", tuple(round(v,3) for v in P("mixamorig:LeftFoot")))
meshes = [o for o in bpy.data.objects if o.type == "MESH"]
mn, mx = world_bbox_eval(meshes, bpy.context.evaluated_depsgraph_get())
print("bbox min", tuple(round(v,3) for v in mn), "max", tuple(round(v,3) for v in mx))
print("actions", [(ac.name, tuple(ac.frame_range)) for ac in bpy.data.actions])
print("images", [(im.name, tuple(im.size)) for im in bpy.data.images])
