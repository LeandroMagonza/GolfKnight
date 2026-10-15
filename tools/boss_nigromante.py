"""El nigromante, jefe del último escenario (docs/jefes/nigromante.md): el mago de la cinemática
(synty_mage.py) de negro y violeta con ribetes verdes, con la calavera y las manos de hueso del esqueleto
esclavo del pack, y una capucha en vez del sombrero de punta. El bastón lo pone el juego (por código).

El GLB lleva solo esta malla y los clips que usa el jefe: build() borra los demás personajes del pack
después de armarlo, así retarget_to_glb.py exporta uno solo.

Uso (con los turnos: node tools/lock.mjs blender -- <blender> -b --python ...):
  blender -b --python tools/retarget_to_glb.py -- <PolygonDungeon>/Models/Characters.fbx
      <PolygonDungeon>/Textures/Dungeons_Texture_01.png public/models/nigromante.glb --with=boss_nigromante
      "Idle=<pack>/idle.fbx" "Walking=<pack>/walking.fbx" "Hard Landing=<pack>/hard landing.fbx"
      "Pointing=assets/mixamo/Pointing.fbx" "Rallying=assets/mixamo/Rallying.fbx"
  blender -b --python tools/kit_preview.py -- boss_nigromante logs/nigro/vista.png
"""
import bpy, math, os, random, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import synty_kit
from synty_kit import *
import synty_mage as mage

NAME = "Character_Necromancer"
# de dónde salen la calavera, las manos y los pies de hueso
BONES_FROM = "Character_Skeleton_Slave_01"
# los colores que piden las piezas del mago (robe, trim...), cambiados: túnica casi negra, ribete verde
COLORS = {
    'robe': 'dusk:4', 'robe_light': 'dusk:3', 'robe_dark': 'maroon:4', 'lining': 'black',
    'trim': 'lime:1', 'trim_dark': 'lime:3', 'leather': 'umber:3', 'leather_dark': 'umber:4',
}
# la capucha: abierta adelante (de -OPEN a OPEN grados desde el frente), con un grosor
HOOD_OPEN = 52
HOOD_THICK = 0.9


def hood(part, rnd):
    """Capucha de dos capas (afuera la túnica, adentro negro) con el borde de la cara en verde, cerrada
    como un cascarón para que no se vea a través con las caras de atrás ocultas."""
    ang = [math.radians(HOOD_OPEN + (360 - 2 * HOOD_OPEN) * j / 10) for j in range(11)]
    # z, medio ancho, media profundidad, centro en y, pesos
    neck = {"Neck": 0.5, "Spine_03": 0.5}
    head = {"Head": 1.0}
    rows = [
        (1.440, 0.215, 0.195, 0.045, neck),
        (1.545, 0.172, 0.172, 0.040, {"Head": 0.6, "Neck": 0.4}),
        (1.660, 0.168, 0.178, 0.032, head),
        (1.770, 0.158, 0.172, 0.040, head),
        (1.865, 0.122, 0.150, 0.060, head),
        (1.935, 0.062, 0.100, 0.100, head),
    ]
    outer, inner = [], []
    for i, (z, rx, ry, yc, w) in enumerate(rows):
        jit = 0.006 if i else 0.003
        pts = ellipse(z, rx, ry, yc, ang, rnd, jitter=jit)
        outer.append(part.ring(pts, w))
        # adentro: el mismo anillo más chico alrededor del centro de la cabeza
        ins = [(x * HOOD_THICK, yc + (y - yc) * HOOD_THICK, z - 0.012) for x, y, z in pts]
        inner.append(part.ring(ins, w))
    last = len(rows) - 1
    for i in range(last):
        part.bridge(outer[i], outer[i + 1], 'robe', closed=False)
        part.bridge(inner[i + 1], inner[i], 'lining', closed=False)
        # los dos bordes de la cara
        for j in (0, len(ang) - 1):
            a, b, c, d = outer[i][j], outer[i + 1][j], inner[i + 1][j], inner[i][j]
            part.face((a, b, c, d) if j == 0 else (d, c, b, a), 'trim')
    # el borde de abajo, sobre los hombros
    part.bridge(inner[0], outer[0], 'robe_dark', closed=False)
    # la punta cae para atrás
    tip_w = {"Head": 1.0}
    part.cap(outer[last], 'robe', Vector((0.0, 0.17, 1.955)), tip_w)
    part.cap(list(reversed(inner[last])), 'lining', Vector((0.0, 0.13, 1.925)), tip_w)
    # las puntas abiertas de los anillos de arriba (cap cierra en abanico: le faltan las dos esquinas)
    for ring_o, ring_i in ((outer[last], inner[last]),):
        part.face((ring_o[0], ring_i[0], ring_i[-1], ring_o[-1]), 'trim')


def build(arm, atlas_img, seed=13):
    for key, value in COLORS.items():
        synty_kit.PAL[key] = pal_xy(value)
    for o in [o for o in bpy.data.objects if o.name.startswith(NAME)]:
        bpy.data.objects.remove(o, do_unlink=True)
    base = bpy.data.objects[mage.BASE]
    weights_src = bpy.data.objects[mage.HEAD]
    bones = bpy.data.objects[BONES_FROM]
    mat = base.data.materials[0]
    atlas = Atlas(atlas_img)
    rnd = random.Random(seed)

    body_w = Weights(weights_src, lambda g: not g.startswith(mage.HAND_BONES + mage.FOOT_BONES + ("Head", "Eyes", "Eyebrows", "Elbow_", "LowerLeg_")))
    arms_w = Weights(weights_src, lambda g: g.startswith(("Shoulder_", "Elbow_", "Clavicle_", "Spine_03")))

    necro = copy_part(bones, mage.HAND_BONES + mage.FOOT_BONES, {}, atlas, NAME)
    skull = copy_part(bones, mage.HEAD_BONES, {}, atlas, NAME + "_head")
    # las muñecas cortadas se ven adentro de la manga
    fill_holes(necro, lambda c: abs(c.x) > 0.7, 'black')

    part = Part()
    mage.robe(part, body_w, rnd)
    mage.belt(part, rnd)
    mage.sleeve(part, arms_w, 1, rnd)
    mage.sleeve(part, arms_w, -1, rnd)
    hood(part, rnd)
    cloth = part.to_object(NAME + "_cloth", mat, like=base)

    join(necro, [skull, cloth])
    necro.name = NAME
    necro.data.name = NAME
    # el GLB lleva solo al nigromante
    for o in [o for o in bpy.data.objects if o.type == 'MESH' and o is not necro]:
        bpy.data.objects.remove(o, do_unlink=True)
    print("nigromante:", len(necro.data.vertices), "vértices,", len(necro.data.polygons), "caras")
    return necro
