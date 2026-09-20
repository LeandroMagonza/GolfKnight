"""Helpers shared by the Blender CLI scripts (run with blender -b --python ...)."""
import bpy, os
from mathutils import Vector, Matrix


def import_fbx(path, **kw):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=path, **kw)
    return [o for o in bpy.data.objects if o not in before]


def snap_axis(v):
    v = Vector(v)
    i = max(range(3), key=lambda k: abs(v[k]))
    out = Vector((0.0, 0.0, 0.0))
    out[i] = 1.0 if v[i] > 0 else -1.0
    return out


def humanoid_frame(arm, head="mixamorig:Head", foot="mixamorig:LeftFoot", toe="mixamorig:LeftToe_End"):
    """(up, facing) unit axis vectors in world space, computed from the rest skeleton."""
    mw = arm.matrix_world
    b = arm.data.bones
    if toe not in b:  # rigs without toe tips (43-bone Mixamo skeletons)
        toe = "mixamorig:LeftToeBase"
    up = snap_axis(mw @ b[head].head_local - mw @ b[foot].head_local)
    f = mw @ b[toe].head_local - mw @ b[foot].head_local
    f = f - f.dot(up) * up
    return up, snap_axis(f)


def normalize_matrix(up, facing, height, target_height):
    """Matrix that maps up->+Z, facing->-Y (Blender front) and scales to target_height."""
    right = (-facing).cross(up)
    R = Matrix((right, -facing, up)).to_4x4()
    s = target_height / height
    return Matrix.Scale(s, 4) @ R, s


def world_bbox_eval(objs, dg):
    pts = []
    for o in objs:
        if o.type != 'MESH':
            continue
        oe = o.evaluated_get(dg)
        pts += [oe.matrix_world @ Vector(c) for c in oe.bound_box]
    mn = Vector([min(p[i] for p in pts) for i in range(3)])
    mx = Vector([max(p[i] for p in pts) for i in range(3)])
    return mn, mx


def fix_missing_images(search_root):
    for im in bpy.data.images:
        if im.size[0] == 0:
            base = os.path.basename(im.filepath) or im.name
            for root, _, files in os.walk(search_root):
                if base in files:
                    im.filepath = os.path.join(root, base)
                    im.reload()
                    print("relinked image", base, "->", im.filepath)
                    break
