"""Vista previa de un personaje armado con synty_kit, sin abrir Blender: una hoja con el modelo de
frente, de tres cuartos, de costado y de atrás, más algunas poses. Se renderiza con Workbench y las
caras de atrás ocultas, como en el juego, así que un agujero se ve.

- Humanoides (monster_*.py, synty_mage.py): build(arm, atlas_image) sobre el esqueleto de Synty. Las
  poses giran huesos a mano: brazos abajo con un paso, el golpe con el brazo derecho en alto (el ataque
  del juego es así, por código) y agachado mirando al costado.
- Bichos (beast_*.py): build_beast(atlas_image) -> (armadura, malla), con sus acciones ya creadas. Se
  muestran los cuadros de PREVIEW_FRAMES del módulo [(acción, cuadro), ...] o, si no hay, el principio
  y la mitad de cada acción.

uso: blender -b --python tools/kit_preview.py -- <módulo> <salida.png> [--size=W,H]
"""
import bpy, importlib, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from synty_kit import *

argv = sys.argv[sys.argv.index("--") + 1:]
mod_name, out = argv[0], os.path.abspath(argv[1])
size = next((tuple(int(v) for v in a.split("=")[1].split(",")) for a in argv[2:] if a.startswith("--size=")), (360, 480))

bpy.ops.wm.read_factory_settings(use_empty=True)
img = atlas_image()
mod = importlib.import_module(mod_name)
parts = os.path.splitext(out)[0] + "_parts"
os.makedirs(parts, exist_ok=True)
paths = []


def shot(objs, name, **kw):
    paths.append(render(objs, os.path.join(parts, name + ".png"), res=size, **kw))


if hasattr(mod, "build_beast"):
    arm, mesh = mod.build_beast(img)
    if arm.animation_data:
        arm.animation_data.action = None
    rest(arm)
    for yaw, name in [(0, "frente"), (40, "tres_cuartos"), (90, "costado"), (180, "atras")]:
        shot([mesh], name, yaw=yaw, pitch=12)
    frames = getattr(mod, "PREVIEW_FRAMES", None)
    if not frames:
        frames = []
        for a in bpy.data.actions:
            f0, f1 = a.frame_range
            frames += [(a.name, int(f0)), (a.name, int(f0 + (f1 - f0) / 2))]
    arm.animation_data_create()
    for i, (action, frame) in enumerate(frames):
        arm.animation_data.action = bpy.data.actions[action]
        bpy.context.scene.frame_set(int(frame))
        shot([mesh], f"{i:02d}_{action}_{int(frame)}", yaw=60, pitch=15)
else:
    arm = load_synty()
    mat = atlas_material(img)
    for o in bpy.data.objects:
        if o.type == 'MESH':
            o.data.materials.clear()
            o.data.materials.append(mat)
    mesh = mod.build(arm, img)
    for o in bpy.data.objects:
        if o.type == 'MESH':
            o.hide_render = o is not mesh
    for yaw, name in [(0, "frente"), (40, "tres_cuartos"), (90, "costado"), (180, "atras")]:
        shot([mesh], name, yaw=yaw)
    # brazos abajo y un paso: lo más parecido a caminar
    pose_bone_world(arm, "Shoulder_L", 'Y', 72)
    pose_bone_world(arm, "Shoulder_R", 'Y', -72)
    pose_bone_world(arm, "Elbow_L", 'X', -25)
    pose_bone_world(arm, "Elbow_R", 'X', -25)
    pose_bone_world(arm, "UpperLeg_L", 'X', -30)
    pose_bone_world(arm, "LowerLeg_L", 'X', 30)
    pose_bone_world(arm, "UpperLeg_R", 'X', 18)
    shot([mesh], "paso", yaw=35)
    shot([mesh], "paso_costado", yaw=90)
    # el golpe: el brazo derecho arriba y adelante, como lo levanta el juego antes de bajarlo
    rest(arm)
    pose_bone_world(arm, "Shoulder_L", 'Y', 72)
    pose_bone_world(arm, "Shoulder_R", 'Y', -72)
    pose_bone_world(arm, "Shoulder_R", 'X', -150)
    pose_bone_world(arm, "Spine_02", 'X', 10)
    shot([mesh], "golpe", yaw=50)
    # agachado, cabeza al costado
    rest(arm)
    pose_bone_world(arm, "Shoulder_L", 'Y', 60)
    pose_bone_world(arm, "Shoulder_R", 'Y', -60)
    pose_bone_world(arm, "Spine_01", 'X', -25)
    pose_bone_world(arm, "Head", 'Z', 35)
    pose_bone_world(arm, "UpperLeg_L", 'X', -50)
    pose_bone_world(arm, "LowerLeg_L", 'X', 70)
    pose_bone_world(arm, "UpperLeg_R", 'X', -50)
    pose_bone_world(arm, "LowerLeg_R", 'X', 70)
    shot([mesh], "agachado", yaw=30)
    rest(arm)

sheet(paths, out, cols=4)
print("PREVIEW", out, len(paths), "vistas")
