"""El futbolista, jefe del último escenario (docs/jefes/futbolista.md): el goblin de PolygonDungeon (el que va
casi desnudo, con taparrabos) vestido de futbolista pintándole las caras, como visten los del pack: camiseta a
bastones celestes y blancos, pantalón negro, medias blancas con una franja celeste y botines negros. La
pelota la pone el juego (por código).

El GLB lleva solo esta malla y el clip que el juego no tiene en dungeon.glb (Getting Up, que usan también
los enemigos que patea al levantarse). Correr y estar quieto salen de dungeon.glb (mismos huesos), y la
patada se arma por código en el juego (src/game/bosses/futbolista/look.ts).

Uso (con los turnos: node tools/lock.mjs blender -- <blender> -b --python ...):
  blender -b --python tools/retarget_to_glb.py -- ../Assets/PolygonDungeon/Models/Characters.fbx
      ../Assets/PolygonDungeon/Textures/Dungeons_Texture_01.png public/models/futbolista.glb
      --with=boss_futbolista "Getting Up=assets/mixamo/Getting Up.fbx"
  blender -b --python tools/kit_preview.py -- boss_futbolista logs/futbolista/vista.png
"""
import bpy, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from synty_kit import *

NAME = "Character_Futbolista"
BASE = "Character_Goblin_Male"

JERSEY = ('blue:0', 'white')   # los bastones, del centro para afuera
STRIPE = 0.11                  # ancho de cada bastón (m, el goblin sin escalar mide 1.6)
SHORTS = 'black'
SOCKS = 'white'
SOCK_BAND = 'blue:0'
BOOTS = 'black'
SLEEVE = 'blue:0'

SKIN = (145, 148, 93)          # el verde del goblin en el atlas
HEAD_BONES = ("Head", "Eyes", "Eyebrows", "Neck")
HAND_BONES = ("Hand_", "Finger_", "Thumb_", "IndexFinger_")
FOOT_BONES = ("Ankle_", "Ball_", "Toes_")


def joint(arm, name):
    return arm.matrix_world @ arm.data.bones[name].head_local


def paint(arm, obj, atlas):
    hip = joint(arm, "UpperLeg_L").z
    knee = joint(arm, "LowerLeg_L").z
    ankle = joint(arm, "Ankle_L").z
    shoulder_x = abs(joint(arm, "Shoulder_L").x)
    elbow_x = abs(joint(arm, "Elbow_L").x)
    shorts_to = knee + (hip - knee) * 0.45
    sleeve_to = shoulder_x + (elbow_x - shoulder_x) * 0.5
    sock_top = knee - 0.07
    print(f"futbolista: cadera {hip:.3f} rodilla {knee:.3f} tobillo {ankle:.3f} hombro {shoulder_x:.3f} codo {elbow_x:.3f}")

    dom = dominant(obj)
    me = obj.data
    mw = obj.matrix_world
    count = {}
    for p in me.polygons:
        b = dom[p.vertices[0]]
        c = mw @ p.center
        key = None
        if b.startswith(HEAD_BONES + HAND_BONES):
            key = None
        elif b.startswith("Elbow_"):
            # las muñequeras rojas del goblin, blancas (lo que no es piel)
            u = sum(me.uv_layers.active.data[i].uv.x for i in p.loop_indices) / p.loop_total
            v = sum(me.uv_layers.active.data[i].uv.y for i in p.loop_indices) / p.loop_total
            skin, _ = near(atlas.rgb(u, v), {SKIN: 1}, tol=20)
            key = None if skin else 'white'
        elif b.startswith(FOOT_BONES):
            key = SOCKS if c.z > ankle + 0.03 else BOOTS
        elif b.startswith("LowerLeg_"):
            if c.z < ankle + 0.03:
                key = BOOTS
            elif c.z < sock_top - 0.045:
                key = SOCKS
            elif c.z < sock_top:
                key = SOCK_BAND
        elif b.startswith("UpperLeg_"):
            if c.z > shorts_to:
                key = SHORTS
        elif b.startswith("Hips"):
            key = SHORTS
        elif b.startswith(("Spine_", "Clavicle_")):
            # bastones verticales, con el del medio celeste (por delante y por detrás)
            key = JERSEY[int(math.floor(abs(c.x) / STRIPE + 0.5)) % 2]
        elif b.startswith("Shoulder_"):
            if abs(c.x) < sleeve_to:
                key = SLEEVE
        if key is None:
            continue
        count[key] = count.get(key, 0) + 1
        uv = pal_uv(key)
        for li in p.loop_indices:
            for lay in me.uv_layers:
                lay.data[li].uv = uv
    print("futbolista: caras pintadas", count)


def build(arm, atlas_img):
    for o in [o for o in bpy.data.objects if o.name.startswith(NAME)]:
        bpy.data.objects.remove(o, do_unlink=True)
    src = bpy.data.objects[BASE]
    obj = src.copy()
    obj.data = src.data.copy()
    for c in src.users_collection:
        c.objects.link(obj)
    paint(arm, obj, Atlas(atlas_img))
    obj.name = NAME
    obj.data.name = NAME
    # el GLB lleva solo al futbolista
    for o in [o for o in bpy.data.objects if o.type == 'MESH' and o is not obj]:
        bpy.data.objects.remove(o, do_unlink=True)
    print("futbolista:", len(obj.data.vertices), "vértices,", len(obj.data.polygons), "caras")
    return obj
