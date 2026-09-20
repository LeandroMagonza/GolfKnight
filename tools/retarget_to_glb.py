"""Build a GLB of a humanoid character animated by Mixamo clips made for another skeleton.

Each clip is retargeted onto the character's rig: per bone, the same world-space rotation change
from rest, plus a correction that lines up both rest poses (two T-poses are never quite the same:
shoulders and arms rest at slightly different angles). The hips travel is scaled by the ratio of
hip heights. A plain copy of the animation channels only works when both rigs rest identically.

Two kinds of base file:
- A Mixamo-rigged character (bones already named mixamorig:*). Pass "-" as the atlas.
- The Synty PolygonDungeon Characters.fbx: 16 characters sharing one 49-bone rig with Synty bone
  names and no animations. The mapped bones are renamed to their mixamorig equivalents, so the game
  code that looks bones up by name works unchanged, and all characters get the pack's atlas texture.
  At runtime the game keeps the one character mesh it wants and drops the rest.

usage: blender -b --python tools/retarget_to_glb.py -- <base.fbx> <atlas.png | -> <out.glb> "Name=clip.fbx" ...
"""
import bpy, sys, os, time
from mathutils import Vector, Matrix
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mt_blender import *

argv = sys.argv[sys.argv.index("--") + 1:]
src, atlas, out = argv[0], argv[1], argv[2]
clips = argv[3:]

M = "mixamorig:"
BONE_MAP = {
    "Hips": "Hips", "Spine_01": "Spine", "Spine_02": "Spine1", "Spine_03": "Spine2", "Neck": "Neck", "Head": "Head",
    "Clavicle_L": "LeftShoulder", "Shoulder_L": "LeftArm", "Elbow_L": "LeftForeArm", "Hand_L": "LeftHand",
    "Clavicle_R": "RightShoulder", "Shoulder_R": "RightArm", "Elbow_R": "RightForeArm", "Hand_R": "RightHand",
    "UpperLeg_L": "LeftUpLeg", "LowerLeg_L": "LeftLeg", "Ankle_L": "LeftFoot", "Ball_L": "LeftToeBase",
    "UpperLeg_R": "RightUpLeg", "LowerLeg_R": "RightLeg", "Ankle_R": "RightFoot", "Ball_R": "RightToeBase",
}
HIPS = M + "Hips"


def rot(m):
    return m.to_3x3().normalized()


def hierarchical(bones):
    order = []
    def visit(b):
        order.append(b.name)
        for c in b.children:
            visit(c)
    for b in bones:
        if b.parent is None:
            visit(b)
    return order


bpy.ops.wm.read_factory_settings(use_empty=True)
objs = import_fbx(src)
arm = next(o for o in objs if o.type == 'ARMATURE')
synty = "Spine_01" in arm.data.bones

if synty:
    # The FBX comes with the armature in centimetres and the meshes scaled 0.01 under it, so bones
    # and skin do not share a space. Put the 0.01 on the armature and leave the meshes at 1.
    arm.scale = (0.01, 0.01, 0.01)
    for o in list(objs):
        if o.type != 'MESH':
            continue
        if o.name.startswith("Character_"):
            o.scale = (1.0, 1.0, 1.0)
        else:
            bpy.data.objects.remove(o, do_unlink=True)   # loose props (bags, masks, sword...)
if arm.animation_data:
    arm.animation_data.action = None
for a in list(bpy.data.actions):
    bpy.data.actions.remove(a)
arm.animation_data_create()
for pb in arm.pose.bones:   # the base file may come posed by its own take
    pb.matrix_basis = Matrix.Identity(4)
bpy.context.view_layer.update()

if synty:
    for old, mix in BONE_MAP.items():
        arm.data.bones[old].name = M + mix
mapped = [M + m for m in BONE_MAP.values() if (M + m) in arm.data.bones]
chars = [o for o in bpy.data.objects if o.type == 'MESH']
print("base:", "Synty rig" if synty else "Mixamo rig", "meshes:", [o.name for o in chars])
missing_groups = [n for n in mapped if n not in chars[0].vertex_groups and n != HIPS]
print("vertex groups match the bones:", not missing_groups, missing_groups[:4])

if atlas != "-":
    # one material with the pack's atlas
    img = bpy.data.images.load(atlas)
    mat = bpy.data.materials.new("Dungeon")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    tex.interpolation = 'Closest'
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.85
    bsdf.inputs['Metallic'].default_value = 0.0
    for o in chars:
        o.data.materials.clear()
        o.data.materials.append(mat)

pmw = arm.matrix_world
pmw_rot = rot(pmw)
pmw_inv = pmw.inverted()
rest_t = {b.name: rot(pmw @ b.matrix_local) for b in arm.data.bones}
local_t = {b.name: rot(b.matrix_local) for b in arm.data.bones}
order = [n for n in hierarchical(arm.data.bones) if n in mapped]
hips_t = (pmw @ arm.data.bones[HIPS].head_local).z
for n in order:
    arm.pose.bones[n].rotation_mode = 'QUATERNION'


# the child that defines each bone's direction: the one that continues the chain (spine up, limbs out)
CHAIN_CHILD = {
    "Hips": "Spine", "Spine": "Spine1", "Spine1": "Spine2", "Spine2": "Neck", "Neck": "Head",
    "LeftShoulder": "LeftArm", "LeftArm": "LeftForeArm", "LeftForeArm": "LeftHand",
    "RightShoulder": "RightArm", "RightArm": "RightForeArm", "RightForeArm": "RightHand",
    "LeftUpLeg": "LeftLeg", "LeftLeg": "LeftFoot", "LeftFoot": "LeftToeBase",
    "RightUpLeg": "RightLeg", "RightLeg": "RightFoot", "RightFoot": "RightToeBase",
}


def child_dir(a, name):
    """World direction from a bone to the next bone of its chain, in the rest pose (None for leaf bones)."""
    kid = CHAIN_CHILD.get(name[len(M):])
    if kid is None or (M + kid) not in a.data.bones or name not in a.data.bones:
        return None
    return ((a.matrix_world @ a.data.bones[M + kid].head_local) - (a.matrix_world @ a.data.bones[name].head_local)).normalized()


dir_t = {n: child_dir(arm, n) for n in order}
actions = []
t_all = time.time()
for spec in clips:
    name, path = spec.split("=", 1)
    new = import_fbx(path)
    sarm = next(o for o in new if o.type == 'ARMATURE')
    sact = sarm.animation_data.action
    f0, f1 = int(sact.frame_range[0]), int(sact.frame_range[1])
    smw = sarm.matrix_world
    rest_s = {b.name: rot(smw @ b.matrix_local) for b in sarm.data.bones}
    hips_s = (smw @ sarm.data.bones[HIPS].head_local).z
    ratio = hips_t / hips_s
    # both rigs rest in a T-pose, but not the same one: line each target bone up with its source
    # bone before applying the clip's rotation change
    corr = {}
    for n in order:
        # only the limbs: a correction on the hips or spine would tilt the whole body
        limb = any(k in n for k in ("Arm", "Shoulder", "Leg", "Foot"))
        ds = child_dir(sarm, n) if limb else None
        corr[n] = dir_t[n].rotation_difference(ds).to_matrix() if (ds is not None and dir_t[n] is not None) else Matrix.Identity(3)
    pose = {}
    for f in range(f0, f1 + 1):
        bpy.context.scene.frame_set(f)
        pose[f] = {pb.name: (smw @ pb.matrix).copy() for pb in sarm.pose.bones if pb.name in rest_t}
    for o in new:
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.actions.remove(sact)

    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    arm.animation_data.action = act
    for f in range(f0, f1 + 1):
        desired = {}
        for n in order:
            delta = rot(pose[f][n]) @ rest_s[n].inverted()
            desired[n] = pmw_rot.inverted() @ (delta @ corr[n] @ rest_t[n])
        for n in order:
            b = arm.data.bones[n]
            pb = arm.pose.bones[n]
            if b.parent is not None and b.parent.name in desired:
                pre = desired[b.parent.name] @ local_t[b.parent.name].inverted() @ local_t[n]
            else:
                pre = local_t[n]
            pb.rotation_quaternion = (pre.inverted() @ desired[n]).to_quaternion()
            pb.keyframe_insert("rotation_quaternion", frame=f)
            if n == HIPS:
                t = pose[f][HIPS].translation * ratio
                full = pmw_inv @ (Matrix.Translation(t) @ (pmw_rot @ desired[n]).to_4x4())
                pb.location = (b.matrix_local.inverted() @ full).translation
                pb.keyframe_insert("location", frame=f)
    actions.append(act)
    print(f"clip {name}: frames {f0}-{f1}, hips ratio {ratio:.3f}")
print(f"retarget done in {time.time() - t_all:.1f}s")

# sanity check on the first clip's first frame: feet near the ground, head up
arm.animation_data.action = actions[0]
bpy.context.scene.frame_set(int(actions[0].frame_range[0]))
mn, mx = world_bbox_eval([chars[0]], bpy.context.evaluated_depsgraph_get())
print(f"posed bbox of {chars[0].name} in '{actions[0].name}': z {mn.z:.3f}..{mx.z:.3f}, x {mn.x:.3f}..{mx.x:.3f}")
for pb in arm.pose.bones:
    pb.matrix_basis = Matrix.Identity(4)
arm.animation_data.action = None

keep = set(actions)
for a in list(bpy.data.actions):
    if a not in keep:
        bpy.data.actions.remove(a)
print("actions to export:", [a.name for a in bpy.data.actions])
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animation_mode='ACTIONS',
                          export_anim_single_armature=True, export_frame_range=False,
                          export_apply=False, export_yup=True)
print("WROTE", out, os.path.getsize(out), "bytes")