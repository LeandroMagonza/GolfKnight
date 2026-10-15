"""El mago de la cinemática en el estilo de PolygonDungeon, sobre el esqueleto de 49 huesos que comparten
los 16 personajes del pack, para que reciba los mismos clips retargeteados que el caballero.

Se arma con piezas del pack y figuras low-poly hechas acá:
- manos y pies del Hero_Knight_Male (el caballero que juega Leandro), en color piel y cuero;
- la cabeza del Hero_Knight_Female, con el pelo canoso, sin tiara y con orejas humanas;
- túnica, mangas acampanadas, cinturón, sombrero de punta y barba: anillos de pocos lados con un poco
  de ruido, para que las caras queden facetadas como las del pack.
Los colores salen de la paleta del atlas (Dungeons_Texture_01): cada cara apunta su UV al centro de un
cuadrito, como hace el pack. Los pesos de la túnica y las mangas se copian del cuerpo de la caballero
(los vértices más cercanos); la falda se reparte entre la cadera y las piernas para no partirse al medio.

Se usa de dos formas:
- desde retarget_to_glb.py: build_mage(arm, atlas) con Characters.fbx ya importado y en metros, antes
  de renombrar los huesos;
- en un Blender abierto con el pack cargado (así), para ir viéndolo: corre build_mage sobre la escena.
"""
import bpy, bmesh, math, os, random, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from synty_kit import *

NAME = "Character_Mage"
BASE = "Character_Hero_Knight_Male"
HEAD = "Character_Hero_Knight_Female"

# colores que traen las piezas del pack (RGB del atlas) -> a qué pasan, o None para borrar esas caras
HEAD_COLORS = {
    (106, 62, 44): 'hair',          # pelo castaño
    (112, 50, 44): 'hair_dark',     # cejas
    (209, 164, 76): 'hair_dark',    # tiara y gomita del pelo
    (156, 78, 63): 'hair_dark',     # gema de la tiara
    (128, 53, 56): 'skin_dark',     # labios pintados
    (152, 156, 160): None,          # borde del cuello de la armadura
}
HAND_COLORS = {(169, 167, 165): 'skin', (71, 70, 70): 'skin_dark'}
FOOT_COLORS = {(169, 167, 165): 'leather', (71, 70, 70): 'leather_dark'}

HAND_BONES = ("Hand_", "Finger_", "Thumb_", "IndexFinger_")
FOOT_BONES = ("Ankle_", "Ball_", "Toes_")
HEAD_BONES = ("Head", "Eyes", "Eyebrows", "Neck")


def robe(part, body, rnd):
    """Túnica de una pieza del cuello al piso, con una franja dorada al frente y en el ruedo."""
    ang = sym_angles([7, 34, 62, 90, 118, 146, 173])
    n = len(ang)
    front = n // 2 - 1                    # la cara entre -7° y 7°
    # z, medio ancho, media profundidad, centro en y
    rows = [
        (1.515, 0.072, 0.072, 0.035),     # borde del cuello alto
        (1.455, 0.092, 0.092, 0.030),
        (1.435, 0.195, 0.125, 0.030),     # hombros
        (1.330, 0.205, 0.150, 0.012),     # pecho
        (1.180, 0.190, 0.148, 0.004),
        (1.040, 0.182, 0.145, 0.004),     # cintura
        (0.900, 0.212, 0.160, 0.012),     # cadera
        (0.600, 0.248, 0.190, 0.020),
        (0.330, 0.280, 0.218, 0.020),
        (0.130, 0.306, 0.240, 0.020),     # arriba de la franja del ruedo
        (0.060, 0.318, 0.250, 0.020),     # ruedo
        (0.085, 0.285, 0.218, 0.020),     # forro (adentro)
    ]

    def weights(p):
        if p.z >= 0.9:
            return body(p)
        # falda: de la cadera hacia abajo las piernas tiran cada vez más del costado de su lado
        t = smoothstep(0.9, 0.35, p.z)
        side = max(-1.0, min(1.0, p.x / 0.25))
        leg = t * 0.7 * smoothstep(0.0, 1.0, abs(side))
        w = {"Hips": 1.0 - leg}
        if leg > 0:
            w["UpperLeg_L" if side > 0 else "UpperLeg_R"] = leg
        return w

    rings = []
    for i, (z, rx, ry, yc) in enumerate(rows):
        jit = 0.0 if i in (0, 1) else 0.007
        pts = ellipse(z, rx, ry, yc, ang, rnd, jitter=jit)
        if i == 0:   # el cuello sube atrás, como de capa
            pts = [(x, y, z + 0.05 * max(0.0, -math.cos(a)) ** 0.7) for (x, y, z), a in zip(pts, ang)]
        rings.append(part.ring(pts, weights))
    for i in range(len(rings) - 1):
        z = rows[i][0]
        if i == 0:
            key = 'robe_dark'                                    # cuello
        elif i == 1:
            key = 'robe_dark'
        elif i == len(rows) - 3:
            key = 'trim'                                         # franja del ruedo
        elif i == len(rows) - 2:
            key = 'lining'
        else:
            key = 'robe'
        keys = [key] * n
        if key == 'robe' and z <= 1.40:
            keys[front] = 'trim'
        part.bridge(rings[i], rings[i + 1], keys)
    part.cap(rings[0], 'lining')
    part.cap(rings[-1], 'lining', Vector((0, 0.02, 0.11)), {"Hips": 1.0})


def belt(part, rnd):
    ang = sym_angles([7, 34, 62, 90, 118, 146, 173])
    top = part.ring(ellipse(1.075, 0.192, 0.155, 0.004, ang, rnd, jitter=0.002), {"Spine_01": 0.5, "Hips": 0.5})
    bot = part.ring(ellipse(1.010, 0.196, 0.158, 0.006, ang, rnd, jitter=0.002), {"Hips": 1.0})
    part.bridge(top, bot, 'leather')
    # hebilla: una cajita dorada al frente
    w = {"Hips": 0.6, "Spine_01": 0.4}
    a = part.ring([(-0.03, -0.158, 1.07), (0.03, -0.158, 1.07), (0.03, -0.158, 1.015), (-0.03, -0.158, 1.015)], w)
    b = part.ring([(-0.026, -0.172, 1.066), (0.026, -0.172, 1.066), (0.026, -0.172, 1.019), (-0.026, -0.172, 1.019)], w)
    part.bridge(a, b, 'trim')
    part.cap(b, 'trim_dark')


def sleeve(part, arms, side, rnd):
    """Manga acampanada en pose T, a lo largo de x; side = 1 izquierda, -1 derecha."""
    ang = [math.radians(a) for a in range(0, 360, 45)]
    # x, radio vertical, radio en y, centro y, centro z
    rows = [
        (0.120, 0.105, 0.110, 0.035, 1.385),
        (0.300, 0.088, 0.090, 0.040, 1.372),
        (0.520, 0.078, 0.080, 0.045, 1.362),
        (0.680, 0.100, 0.098, 0.045, 1.358),
        (0.790, 0.138, 0.128, 0.045, 1.352),   # boca de la manga
        (0.770, 0.112, 0.104, 0.045, 1.354),   # forro
        (0.690, 0.070, 0.068, 0.045, 1.358),
    ]
    rings = []
    for x, rz, ry, yc, zc in rows:
        pts = []
        for a in ang:
            pts.append((side * (x + rnd.uniform(-0.004, 0.004)),
                        yc + ry * math.cos(a) + rnd.uniform(-0.005, 0.005),
                        zc + rz * math.sin(a) + rnd.uniform(-0.005, 0.005)))
        rings.append(part.ring(pts, arms))
    for i in range(len(rings) - 1):
        key = 'robe' if i < 3 else ('trim' if i == 3 else 'lining')
        part.bridge(rings[i], rings[i + 1], key)
    part.cap(rings[-1], 'lining')


def hat(part, rnd):
    """Sombrero de punta con ala ancha y la punta doblada para atrás."""
    W = {"Head": 1.0}
    ang = [math.radians(a) for a in range(0, 360, 36)]
    yc = 0.035

    def circle(z, r, dy=0.0, droop=0.0, jit=0.006):
        out = []
        for a in ang:
            x, y = r * math.sin(a), yc + dy - r * math.cos(a)
            out.append((x + rnd.uniform(-jit, jit), y + rnd.uniform(-jit, jit),
                        z - droop * (0.6 + 0.4 * math.cos(a)) + rnd.uniform(-jit, jit) * 0.5))
        return out
    brim_in_b = part.ring(circle(1.752, 0.150, jit=0.002), W)
    brim_out_b = part.ring(circle(1.735, 0.275, droop=0.02, jit=0.008), W)
    brim_out_t = part.ring(circle(1.752, 0.278, droop=0.02, jit=0.008), W)
    base = part.ring(circle(1.772, 0.162, jit=0.002), W)
    band = part.ring(circle(1.825, 0.152, dy=0.004, jit=0.003), W)
    cone = [
        (1.905, 0.128, 0.012),
        (1.995, 0.096, 0.032),
        (2.075, 0.064, 0.064),
        (2.135, 0.038, 0.110),
    ]
    part.bridge(brim_in_b, brim_out_b, 'robe_dark')
    part.bridge(brim_out_b, brim_out_t, 'robe_dark')
    part.bridge(brim_out_t, base, 'robe')
    part.bridge(base, band, 'trim_dark')
    prev = band
    for z, r, dy in cone:
        cur = part.ring(circle(z, r, dy=dy, jit=0.007), W)
        part.bridge(prev, cur, 'robe')
        prev = cur
    part.cap(prev, 'robe', Vector((0.0, yc + 0.19, 2.15)), W)
    part.cap(brim_in_b, 'lining')


def beard(part, rnd):
    """Barba larga en punta desde las mejillas hasta el pecho, y bigote caído."""
    W = {"Head": 1.0}
    ang = [math.radians(a) for a in (-160, -125, -90, -60, -30, 0, 30, 60, 90, 125, 160)]
    # z, medio ancho, profundidad, centro y
    rows = [
        (1.640, 0.098, 0.050, -0.055),
        (1.590, 0.106, 0.080, -0.075),
        (1.500, 0.098, 0.080, -0.098),
        (1.400, 0.072, 0.068, -0.110),
        (1.310, 0.038, 0.045, -0.118),
    ]
    rings = [part.ring(ellipse(z, rx, ry, yc, ang, rnd, jitter=0.006, power=0.9), W) for z, rx, ry, yc in rows]
    for i in range(len(rings) - 1):
        part.bridge(rings[i], rings[i + 1], 'hair' if i % 2 == 0 else 'hair_dark')
    part.cap(rings[0], 'hair_dark')
    part.cap(rings[-1], 'hair', Vector((0.0, -0.135, 1.245)), W)
    # bigote: dos cuñas que salen de abajo de la nariz y caen hacia los costados
    for s in (1, -1):
        pts = [(0.0, -0.152, 1.628), (s * 0.04, -0.150, 1.618), (s * 0.075, -0.135, 1.585), (s * 0.085, -0.120, 1.555)]
        th = [0.016, 0.016, 0.012, 0.004]
        prev = None
        for (x, y, z), t in zip(pts, th):
            cur = part.ring([(x, y - t, z + t), (x, y - t * 1.4, z - t), (x, y + t, z)], W)
            if prev:
                part.bridge(prev, cur, 'hair')
            else:
                part.cap(cur, 'hair')
            prev = cur
        part.cap(prev, 'hair', Vector((s * 0.088, -0.118, 1.535)), W)


def build_mage(arm, atlas_img, seed=7):
    for o in [o for o in bpy.data.objects if o.name.startswith(NAME)]:
        bpy.data.objects.remove(o, do_unlink=True)
    base_src = bpy.data.objects[BASE]
    head_src = bpy.data.objects[HEAD]
    mat = base_src.data.materials[0]
    atlas = Atlas(atlas_img)
    rnd = random.Random(seed)

    body_w = Weights(head_src, lambda g: not g.startswith(HAND_BONES + FOOT_BONES + ("Head", "Eyes", "Eyebrows", "Elbow_", "LowerLeg_")))
    arms_w = Weights(head_src, lambda g: g.startswith(("Shoulder_", "Elbow_", "Clavicle_", "Spine_03")))

    mage = copy_part(base_src, HAND_BONES + FOOT_BONES, {}, atlas, NAME)
    # manos en piel y botas en cuero: los pies son lo único del caballero que comparte color con las manos
    recolor_by_bone(mage, atlas, HAND_BONES, HAND_COLORS)
    recolor_by_bone(mage, atlas, FOOT_BONES, FOOT_COLORS)
    # las muñecas quedan abiertas al cortar el antebrazo, y se ven mirando adentro de la manga
    fill_holes(mage, lambda c: abs(c.x) > 0.7, 'skin_dark')
    head = copy_part(head_src, HEAD_BONES, HEAD_COLORS, atlas, NAME + "_head")
    human_ears(head)
    drop_ponytail(head)
    # sin la colita quedan dos agujeros en la nuca (Leandro los vio en el .blend)
    fill_holes(head, lambda c: c.y > 0.09 and c.z > 1.55, 'hair')

    part = Part()
    robe(part, body_w, rnd)
    belt(part, rnd)
    sleeve(part, arms_w, 1, rnd)
    sleeve(part, arms_w, -1, rnd)
    hat(part, rnd)
    beard(part, rnd)
    new = part.to_object(NAME + "_cloth", mat, like=base_src)

    join(mage, [head, new])
    mage.name = NAME
    mage.data.name = NAME
    return mage


def drop_ponytail(obj):
    """La colita de la caballero asomaba atrás del sombrero como un palito."""
    mw = obj.matrix_world
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    tail = [f for f in bm.faces if (mw @ f.calc_center_median()).y > 0.135]
    bmesh.ops.delete(bm, geom=tail, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(obj.data)
    bm.free()


def human_ears(obj):
    """Las orejas de elfa de la caballero, achicadas hacia la cabeza y sin la punta."""
    mw = obj.matrix_world
    inv = mw.inverted()
    for v in obj.data.vertices:
        p = mw @ v.co
        ax = abs(p.x)
        if ax > 0.105 and 1.58 < p.z < 1.80 and -0.06 < p.y < 0.10:
            k = 0.35
            nx = 0.105 + (ax - 0.105) * k
            p.x = math.copysign(nx, p.x)
            p.z = 1.655 + (p.z - 1.655) * 0.55
            p.y = 0.02 + (p.y - 0.02) * 0.7
            v.co = inv @ p


if globals().get("__name__") != "synty_mage":
    # en un Blender abierto, con Characters.fbx importado y la escala ya arreglada
    img = next(i for i in bpy.data.images if i.name.startswith("Dungeons_Texture_01"))
    m = build_mage(bpy.data.objects["Armature"], img)
    for o in bpy.data.objects:
        if o.type == 'MESH':
            o.hide_set(o.name != NAME)
            o.hide_render = o.name != NAME
    print("mago:", len(m.data.vertices), "vértices,", len(m.data.polygons), "caras")


build = build_mage
