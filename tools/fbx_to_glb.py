"""Convert an FBX model (+ optional Mixamo/Unity-style '@clip' FBX files) into one GLB.
usage: blender -b --python tools/fbx_to_glb.py -- "<base.fbx>" "<out.glb>" [--scene-anim] [--max-texture=N] [clip.fbx ...]
  clips        : each clip FBX's armature action becomes a glTF animation named after the part after '@'
  --scene-anim : no clips; export the file's own animation as one glTF animation (all objects together)
  --max-texture=N : shrink every texture larger than N px (Mixamo characters bring 4K maps: too heavy for the web)
"""
import bpy, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mt_blender import *

argv = sys.argv[sys.argv.index("--") + 1:]
base, out = argv[0], argv[1]
rest = argv[2:]
scene_anim = "--scene-anim" in rest
normalize = "--normalize-humanoid" in rest   # mixamorig rig: stand up on +Z, face -Y, 1.75 m, feet at 0
clips = [c for c in rest if not c.startswith("--")]
max_texture = next((int(a.split("=", 1)[1]) for a in rest if a.startswith("--max-texture=")), 0)
TARGET_H = 1.75

bpy.ops.wm.read_factory_settings(use_empty=True)
base_objs = import_fbx(base)
arm = next((o for o in base_objs if o.type == 'ARMATURE'), None)
print("BASE objects:", [(o.name, o.type) for o in base_objs])

if clips:
    assert arm, "no armature in base file"
    # drop rig gizmo empties and whatever take the base file carries; clips provide the animations
    for o in list(base_objs):
        if o.type == 'EMPTY':
            bpy.data.objects.remove(o, do_unlink=True)
        elif o.animation_data:
            o.animation_data.action = None
    for act in list(bpy.data.actions):
        bpy.data.actions.remove(act)
    found = []
    HIPS = "mixamorig:Hips"
    def hips_height(a):
        return (a.matrix_world @ a.data.bones[HIPS].head_local).length if HIPS in a.data.bones else None
    base_hips = hips_height(arm)
    for c in clips:
        # "Name=path" names the clip explicitly; otherwise it is the file name (after '@' if any)
        if "=" in c and not os.path.exists(c):
            name, c = c.split("=", 1)
        else:
            name = os.path.splitext(os.path.basename(c))[0].split("@", 1)[-1]
        new = import_fbx(c)
        carm = next((o for o in new if o.type == 'ARMATURE'), None)
        act = carm.animation_data.action if carm and carm.animation_data else None
        if act is None:
            print("WARN: no action in", c)
        else:
            act.name = name
            bone_names = {fc.data_path.split('"')[1] for fc in act.fcurves if 'pose.bones' in fc.data_path}
            missing = bone_names - set(arm.data.bones.keys())
            if missing:
                # clips made for a fuller skeleton (fingers, etc.): drop the tracks the base cannot use
                for fc in [fc for fc in act.fcurves if 'pose.bones' in fc.data_path and fc.data_path.split('"')[1] in missing]:
                    act.fcurves.remove(fc)
                print(f"clip {name}: dropped tracks of {len(missing)} bones missing in base, e.g. {sorted(missing)[:3]}")
            # Clips from a Mixamo skeleton of other proportions: the hips travel is in that skeleton's
            # scale, so rescale it by the ratio of hip heights or the feet float / sink.
            src_hips = hips_height(carm)
            if base_hips and src_hips and abs(src_hips / base_hips - 1) > 0.02:
                k = base_hips / src_hips
                for fc in act.fcurves:
                    if fc.data_path == f'pose.bones["{HIPS}"].location':
                        for kp in fc.keyframe_points:
                            kp.co[1] *= k
                            kp.handle_left[1] *= k
                            kp.handle_right[1] *= k
                print(f"clip {name}: hips travel scaled x{k:.3f} (source hips {src_hips:.3f} m, base {base_hips:.3f} m)")
            # rest orientations must match for a plain channel copy to be valid
            worst = (0.0, None)
            for b in arm.data.bones:
                sb = carm.data.bones.get(b.name)
                if sb:
                    ang = b.matrix_local.to_quaternion().rotation_difference(sb.matrix_local.to_quaternion()).angle
                    ang = min(ang, 6.283185 - ang)
                    if ang > worst[0]:
                        worst = (ang, b.name)
            if worst[0] > 0.09:
                print(f"WARN clip {name}: rest orientation differs up to {worst[0] * 57.3:.1f} deg at {worst[1]}")
            found.append((name, act))
        for o in new:
            bpy.data.objects.remove(o, do_unlink=True)
    # With a single armature in the scene, the glTF exporter (ACTIONS mode) exports every
    # armature action in bpy.data, named after the action. Remove anything that is not a clip.
    # The exporter only does that when the armature has animation_data at all.
    keep = {act for _, act in found}
    for act in list(bpy.data.actions):
        if act not in keep:
            bpy.data.actions.remove(act)
    if arm.animation_data is None:
        arm.animation_data_create()
    for name, act in found:
        act.use_fake_user = True
        print(f"clip {name}: frames {act.frame_range[0]:.0f}-{act.frame_range[1]:.0f}  slots={[ (s.name_display, s.target_id_type) for s in getattr(act, 'slots', [])]}")

if normalize:
    harm = next(o for o in bpy.data.objects if o.type == 'ARMATURE' and "mixamorig:Hips" in o.data.bones)
    skins = [o for o in bpy.data.objects if o.type == 'MESH'
             and any(m.type == 'ARMATURE' and m.object == harm for m in o.modifiers)]
    prev_pose = harm.data.pose_position
    harm.data.pose_position = 'REST'
    bpy.context.view_layer.update()
    up, facing = humanoid_frame(harm)
    mn, mx = world_bbox_eval(skins, bpy.context.evaluated_depsgraph_get())
    axis = [i for i in range(3) if abs(up[i]) > 0.5][0]
    height = (mx - mn)[axis]
    M, s = normalize_matrix(up, facing, height, TARGET_H)
    root = bpy.data.objects.new("Root", None)
    bpy.context.scene.collection.objects.link(root)
    for o in [o for o in bpy.data.objects if o.parent is None and o is not root]:
        o.parent = root          # root is identity here, so world transforms are unchanged
    root.matrix_world = M
    bpy.context.view_layer.update()
    mn, mx = world_bbox_eval(skins, bpy.context.evaluated_depsgraph_get())
    root.location.z -= mn.z
    bpy.context.view_layer.update()
    harm.data.pose_position = prev_pose
    print(f"normalized: up={tuple(up)} facing={tuple(facing)} height={height:.4f} scale x{s:.2f} "
          f"bbox z {mn.z - mn.z:.3f}..{mx.z - mn.z:.3f}")

fix_missing_images(os.path.dirname(os.path.dirname(base)))
for im in bpy.data.images:
    if max_texture and max(im.size) > max_texture:
        k = max_texture / max(im.size)
        im.scale(max(1, round(im.size[0] * k)), max(1, round(im.size[1] * k)))
        im.pack()   # the exporter reads packed data: repack the shrunk pixels, not the original file
    print("image", im.name, tuple(im.size), os.path.basename(im.filepath))
print("fps", bpy.context.scene.render.fps, "frame range", bpy.context.scene.frame_start, bpy.context.scene.frame_end)

mode = 'SCENE' if (scene_anim and not clips) else 'ACTIONS'
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animation_mode=mode,
                          export_anim_single_armature=True, export_frame_range=False,
                          export_apply=False, export_yup=True)
print("WROTE", out, os.path.getsize(out), "bytes")
