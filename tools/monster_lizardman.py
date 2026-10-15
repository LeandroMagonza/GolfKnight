"""El hombre lagarto de la horda: un escaramuzador flaco, rápido y algo encorvado, sobre el esqueleto de
49 huesos de PolygonDungeon (el mismo de los 16 personajes del pack, para que reciba los mismos clips).

Facetado como los personajes del pack (caras grandes y planas, con regiones de un solo color de la paleta
del atlas) y armado con las piezas de monster_body.py: torso angosto inclinado hacia adelante, con placas
claras en bandas en la panza y el lomo oscuro con escudos y una cresta de púas naranjas y rojas que baja
de la cabeza por la espalda hasta la punta de la cola. Un cuello largo que saca la cabeza por delante del
pecho: hocico largo con cejas de escamas, fosas, dientes arriba y abajo, ojos amarillos de pupila de raya
y un abanico de volados a los costados. Brazos y piernas finos con escudos en antebrazos y canillas,
espolones en los codos y garras en manos y pies (tres dedos largos y un espolón atrás). Hombrera de hueso
con púas, cinturón con hebilla de hueso y el atado de huesos del pack (SM_Item_Bones), taparrabos roto,
vendas, collar de dientes; puño derecho cerrado sobre la lanza de los goblins (SM_Wep_Goblin_Spear_01) y
mano izquierda abierta con garras. Piel verde azulada (los goblins son verde oliva).

Uso: build(arm, atlas_image) desde retarget_to_glb.py (--with=monster_lizardman) o kit_preview.py.
"""
import bpy, math, os, random, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from synty_kit import *
from monster_body import *

NAME = "Character_Lizardman"
SKIN, SKIN_D, SCUTE = 'teal:1', 'teal:3', 'teal:2'
BELLY, BELLY_D, BELLY_EDGE = 'mustard:0', 'gold:2', 'gold:3'
CREST, CREST_D, EYE = 'orange:1', 'brick:1', 'mustard:1'
CLAW, TOOTH, MOUTH = BONE_MID, BONE_HI, 'maroon:3'
CLOTH, CLOTH_D, BELT, WRAP, WRAP_D = 'leather:1', 'leather:2', 'leather:3', 'mud:1', 'mud:3'
LIFT = 0.03
HEAD_UP = (0, -0.035, 0.065)   # la cabeza, arriba y adelante del pecho, en la punta del cuello

TORSO = [   # z, medio ancho, media profundidad, centro en y: se inclina hacia adelante al subir
    (0.720, 0.120, 0.100, 0.030),
    (0.800, 0.165, 0.125, 0.030),
    (0.900, 0.175, 0.130, 0.020),            # cadera
    (1.000, 0.158, 0.122, 0.005),            # cintura
    (1.100, 0.172, 0.130, -0.012),
    (1.210, 0.200, 0.145, -0.035),
    (1.320, 0.228, 0.150, -0.055),           # pecho
    (1.410, 0.225, 0.138, -0.062),           # hombros, encorvados
    (1.470, 0.185, 0.118, -0.066),
    (1.520, 0.115, 0.088, -0.070),           # de acá sale el cuello
]
TORSO_BUMPS = mirrored([
    (0.10, -0.19, 1.31, 0.07, 0.05, 0.05, 0.02),         # pectorales
    (0.19, -0.04, 1.20, 0.03, 0.06, 0.03, 0.012),        # costillas
    (0.18, -0.03, 1.10, 0.03, 0.06, 0.03, 0.01),
    (0.11, 0.08, 1.36, 0.06, 0.04, 0.07, 0.018),         # omóplatos
    (0.0, 0.10, 1.20, 0.02, 0.05, 0.30, 0.012),          # lomo: la columna salida
    (0.08, 0.13, 0.82, 0.07, 0.04, 0.06, 0.016),         # ancas
])
NECK_W = lambda p: ramp(p.z, [(1.45, "Spine_03"), (1.51, "Neck"), (1.57, "Neck"), (1.64, "Head")])


def plates(c):
    """Panza de placas claras en bandas, borde más oscuro, lomo oscuro."""
    a = angle_of(c, -0.02)
    if 0.88 < c.z < 1.43:
        if abs(a) < 24:
            return BELLY if int(c.z / 0.05) % 2 == 0 else BELLY_D
        if abs(a) < 40:
            return BELLY_EDGE
    return SKIN_D if abs(a) > 150 else SKIN


def torso(part, rnd):
    rows = smooth_rows(TORSO, [1, 1, 2, 2, 2, 2, 1, 1, 1])
    lathe(part, rows, 16, plates, spine_weights(), rnd, 0.006, TORSO_BUMPS, caps=(SKIN, SKIN))
    # el cuello, largo, con la garganta clara adelante
    limb(part, [(0, -0.06, 1.44, 0.088, 0.082), (0, -0.095, 1.52, 0.072, 0.07), (0, -0.13, 1.59, 0.063, 0.062),
                (0, -0.15, 1.645, 0.058, 0.058)], 1, 10, [tube_keys(10, lambda a: BELLY_D if a < 55 else SKIN)] * 3,
         NECK_W, rnd, 0.004, (), up=(0, -1, 0), caps=(SKIN, SKIN))
    # cresta: púas de la nuca a la cintura, cada una con el hueso de su altura, y escudos entre ellas
    sw = spine_weights()
    for k, z in enumerate((1.47, 1.40, 1.33, 1.26, 1.19, 1.12, 1.05, 0.98)):
        p = on_rows(TORSO, z, math.pi, -0.01) + Vector((0, 0.012, 0))
        h = (0.09 - 0.005 * k) * rnd.uniform(0.85, 1.1)
        fin(part, (0, p.y, z + 0.04), (0, p.y, z - 0.035), (0, p.y + h * 0.9, z - 0.05 + h * 0.3), 0.016,
            CREST if k % 2 == 0 else CREST_D, sw(p))
        if k % 2 == 0:
            for s in (1, -1):
                q = on_rows(TORSO, z - 0.03, math.pi - s * 0.34, 0.004)
                nrm = surface_normal(TORSO, z, math.pi - s * 0.34)
                cube(part, q, Vector((0, 0, 0.026)), nrm.cross(Vector((0, 0, 1))) * 0.024, nrm * 0.008, SCUTE, sw(q))
    for z in (1.60, 1.53):           # y dos más sobre la nuca
        c = Vector((0, -0.13 + (1.645 - z) * 0.5 + 0.06, z))
        fin(part, c + Vector((0, 0, 0.03)), c - Vector((0, 0, 0.03)), c + Vector((0, 0.07, 0.02)), 0.014, CREST_D, NECK_W(c))


def arm(part, side, rnd):
    s, L = side, LIFT
    xs = [0.12, 0.22, 0.33, 0.44, 0.53, 0.61, 0.69, 0.76, 0.80]
    ys = [0.010, 0.025, 0.045, 0.050, 0.053, 0.050, 0.045, 0.040, 0.038]
    zs = [1.38, 1.385, 1.38, 1.37, 1.365, 1.363, 1.362, 1.361, 1.361]
    radii = [(0.06, 0.06), (0.075, 0.07), (0.068, 0.064), (0.058, 0.056), (0.052, 0.05),
             (0.06, 0.056), (0.052, 0.05), (0.044, 0.042), (0.042, 0.04)]
    ctrl = [(s * x, y, z + L, ru, rv) for x, y, z, (ru, rv) in zip(xs, ys, zs, radii)]
    bumps = [(s * cx, cy, cz + L, rx, ry, rz, a) for cx, cy, cz, rx, ry, rz, a in [
        (0.38, -0.02, 1.38, 0.06, 0.03, 0.035, 0.014),   # bíceps
        (0.59, -0.01, 1.40, 0.05, 0.03, 0.03, 0.012),    # antebrazo
    ]]
    W = arm_weights(side)
    limb(part, ctrl, 1, 10, lambda c: SKIN_D if c.z > 1.36 + L + 0.035 else SKIN, W, rnd, 0.004, bumps, caps=(SKIN, SKIN))
    # escudos sobre el antebrazo y espolón en el codo
    for x in (0.60, 0.65):
        c = Vector((s * x, 0.045, 1.362 + L + 0.054 - (x - 0.6) * 0.1))
        cube(part, c, Vector((s * 0.022, 0, 0)), Vector((0, 0.028, 0)), Vector((0, 0, 0.008)), SKIN_D, W(c))
    horn(part, [(s * 0.535, 0.08, 1.365 + L), (s * 0.565, 0.11, 1.367 + L)], [0.022, 0.015], 5, CREST,
         W(Vector((0.55, 0, 0))), tip=(s * 0.61, 0.15, 1.375 + L), per=1)
    for k, (x, r) in enumerate(((0.722, 0.053), (0.752, 0.05))):
        c = Vector((s * x, 0.041, 1.361 + L))
        band(part, c, (s, 0.08 * (-1) ** k, 0.12 * (-1) ** k), r, 0.026, 0.009, 8, WRAP if k == 0 else WRAP_D, W(c))
    zc = 1.36 + L
    if side < 0:
        grip_fist(part, side, (-0.865, 0.035, zc), (-0.65, -0.72, 0.24), (-0.785, 0.038, zc), 0.78, SKIN, SKIN_D, CLAW,
                  rnd, shaft=0.022, claws=CLAW)
    else:
        open_hand(part, side, 0.78, 0.035, zc, 0.85, SKIN, SKIN_D, CLAW, rnd, curl=(15, 25, 20),
                  lengths=(0.085, 0.095, 0.09, 0.07), claws=CLAW)


def pauldron(part, rnd):
    """Hombrera de hueso en el hombro izquierdo, en capas y con púas: rígida al brazo, como una de verdad."""
    W = {"Shoulder_L": 1.0}
    zc = 1.40 + LIFT
    limb(part, [(0.15, 0.03, zc + 0.01, 0.085, 0.085), (0.2, 0.03, zc + 0.012, 0.1, 0.097),
                (0.27, 0.035, zc + 0.008, 0.098, 0.094), (0.31, 0.04, zc, 0.082, 0.08)], 1, 10,
         lambda c: BONE_HI if c.z > zc + 0.06 else BONE, W, rnd, 0.004, caps=(BONE_HI, BONE_LO))
    for x, r in ((0.215, 0.104), (0.265, 0.1)):
        band(part, (x, 0.033, zc + 0.01), (1, 0, -0.05), r, 0.016, 0.009, 10, BONE_MID, W)
    for x, y, h in ((0.18, 0.0, 0.1), (0.235, 0.05, 0.12), (0.29, 0.0, 0.08)):
        horn(part, [(x, y, zc + 0.08), (x + 0.012, y + 0.008, zc + 0.12)], [0.024, 0.016], 5, BONE_HI, W,
             tip=(x + 0.03, y + 0.02, zc + 0.08 + h), per=1)


def leg(part, side, rnd):
    s = side
    zs = [0.88, 0.74, 0.60, 0.48, 0.42, 0.33, 0.22, 0.12]
    xs = [0.10, 0.11, 0.115, 0.115, 0.115, 0.115, 0.114, 0.114]
    ys = [0.02, 0.00, -0.01, 0.00, 0.01, 0.03, 0.04, 0.04]
    radii = [0.095, 0.115, 0.102, 0.078, 0.068, 0.074, 0.058, 0.05]
    ctrl = [(s * x, y, z, r, r) for x, y, z, r in zip(xs, ys, zs, radii)]
    bumps = [(s * cx, cy, cz, rx, ry, rz, a) for cx, cy, cz, rx, ry, rz, a in [
        (0.13, -0.09, 0.66, 0.05, 0.04, 0.10, 0.018),    # muslo
        (0.115, 0.09, 0.33, 0.04, 0.035, 0.07, 0.018),   # pantorrilla
        (0.115, -0.07, 0.42, 0.03, 0.025, 0.035, 0.014),  # rodilla
    ]]
    W = leg_weights(side)
    limb(part, ctrl, 1, 10, [tube_keys(10, lambda a: SKIN_D if a > 150 else SKIN)] * 7, W, rnd, 0.004, bumps,
         up=(0, -1, 0), caps=(SKIN, SKIN))
    for z in (0.37, 0.29, 0.21):       # escudos de la canilla
        r = 0.072 if z > 0.3 else 0.062
        c = Vector((s * 0.115, 0.03 - r - 0.002, z))
        cube(part, c, Vector((0.024, 0, 0)), Vector((0, 0.007, 0)), Vector((0, 0.002, 0.026)), SKIN_D, W(c))
    for k, (z, r) in enumerate(((0.165, 0.058), (0.135, 0.056))):    # vendas en el tobillo
        c = Vector((s * 0.114, 0.04, z))
        band(part, c, (0.1 * (-1) ** k, 0.12, 1), r, 0.026, 0.01, 10, WRAP if k == 0 else WRAP_D, W(c), up=(0, -1, 0))
    foot(part, side, rnd)


def foot(part, side, rnd):
    """Pie de lagarto: almohadilla, tres dedos largos con garras para adelante, espolón atrás."""
    s = side
    W = foot_weights(side)
    x = s * 0.114
    limb(part, [(x, 0.07, 0.05, 0.045, 0.05), (x, 0.01, 0.065, 0.06, 0.06), (x, -0.07, 0.035, 0.032, 0.066)], 1, 8,
         SKIN, W, rnd, 0.003, caps=(SKIN, SKIN), floor=0.0)
    for dx, ln in ((-0.042, 0.85), (0.0, 1.0), (0.042, 0.85)):
        base = Vector((x + dx, -0.06, 0.024))
        finger(part, base, (dx * 0.8, -1.0, 0.15), (0, 0, 1), [(0.055 * ln, 0), (0.045 * ln, 10), (0.035 * ln, 12)],
               [0.022, 0.019, 0.016, 0.013], 5, SKIN, W, claw=(CLAW, 0.04, 55), floor=0.0)
    horn(part, [(x, 0.08, 0.04), (x, 0.11, 0.02)], [0.016, 0.01], 5, CLAW, {sd("Ankle", side): 1.0},
         tip=(x, 0.135, 0.004), per=1, floor=0.0)


def along(path, y):
    """Altura del centro y radios (arriba, costado) del hocico a la profundidad y."""
    for p0, p1 in zip(path, path[1:]):
        if p1[1] <= y <= p0[1]:
            t = (y - p0[1]) / (p1[1] - p0[1])
            return tuple(a + (b - a) * t for a, b in zip(p0[2:], p1[2:]))
    return tuple(path[-1][2:])


def head(part, rnd):
    """Cabeza de hocico largo (armada en el lugar del hueso, después se corre con HEAD_UP): boca
    entreabierta con dientes, ojos amarillos y volados de púas."""
    W = {"Head": 1.0}
    path = [(0, -0.07, 1.59, 0.065, 0.068), (0, -0.13, 1.61, 0.068, 0.08), (0, -0.21, 1.592, 0.052, 0.062),
            (0, -0.29, 1.573, 0.04, 0.05), (0, -0.355, 1.559, 0.03, 0.04)]
    bumps = mirrored([
        (0.05, -0.125, 1.665, 0.03, 0.04, 0.014, 0.016),     # cejas de escamas
        (0.07, -0.08, 1.58, 0.03, 0.04, 0.03, 0.012),        # músculos de la mandíbula
    ])

    def key(c):
        if c.z < along(path, c.y)[0] - 0.02:
            return BELLY
        return SKIN_D if abs(c.x) < 0.02 and c.z > 1.6 else SKIN
    limb(part, path, 1, 12, key, W, rnd, 0.003, bumps, caps=(SKIN, SKIN), tips=(None, (0, -0.38, 1.555)))
    limb(part, [(0, -0.11, 1.55, 0.024, 0.05), (0, -0.22, 1.515, 0.02, 0.042), (0, -0.33, 1.49, 0.016, 0.03)], 1, 8,
         BELLY, W, rnd, 0.002, caps=(BELLY, BELLY), tips=(None, (0, -0.35, 1.485)))
    tube(part, [(0, -0.13, 1.545), (0, -0.32, 1.52)], [(0.018, 0.035), (0.012, 0.022)], 6, MOUTH, W, up=(0, 0, 1),
         caps=(MOUTH, MOUTH))
    for s in (1, -1):
        for k, y in enumerate((-0.16, -0.21, -0.26, -0.30, -0.335)):
            z, ru, rv = along(path, y)
            ln = 0.024 if k in (1, 3) else 0.016
            cone(part, (s * rv * 0.72, y, z - ru * 0.7), (s * rv * 0.74, y - 0.003, z - ru - ln), 0.008, 3, TOOTH, W)
        for y in (-0.21, -0.27, -0.31):
            t = (y + 0.11) / -0.22
            zj = 1.55 - 0.035 * t + 0.018
            cone(part, (s * (0.042 - 0.02 * t), y, zj - 0.006), (s * (0.042 - 0.02 * t), y - 0.003, zj + 0.016), 0.007, 3,
                 TOOTH, W)
        cube(part, (s * 0.02, -0.366, 1.575), (0.006, 0, 0), (0, 0.004, 0), (0, 0, 0.005), 'black', W)
        # ojos amarillos con pupila de raya bajo una ceja de escamas
        cube(part, (s * 0.063, -0.125, 1.634), (0.008, 0, 0), (0, 0.018, 0), (0, 0, 0.012), EYE, W)
        cube(part, (s * 0.07, -0.125, 1.634), (0.002, 0, 0), (0, 0.003, 0), (0, 0, 0.011), 'black', W)
        cube(part, (s * 0.058, -0.128, 1.652), (0.016, 0, 0), (0, 0.028, 0), (0, 0, 0.008), SKIN_D, W)
        # volados: abanico de púas a cada lado de la nuca
        for k, (dy, dz, ln) in enumerate(((0.02, 0.05, 0.12), (0.04, 0.02, 0.14), (0.05, -0.015, 0.12), (0.045, -0.045, 0.09))):
            b0 = Vector((s * 0.05, -0.05, 1.6 + dz * 0.5 + 0.018))
            b1 = Vector((s * 0.05, -0.045, 1.6 + dz * 0.5 - 0.018))
            tip = Vector((s * (0.06 + ln * 0.75), -0.04 + dy + ln * 0.35, 1.6 + dz + ln * 0.2 * (dz > 0)))
            fin(part, b0, b1, tip, 0.01, CREST if k % 2 == 0 else CREST_D, W)
    # cresta de la cabeza: placas de distinta altura
    for y, h, k in ((-0.17, 0.04, CREST), (-0.125, 0.065, CREST_D), (-0.08, 0.085, CREST), (-0.035, 0.095, CREST_D),
                    (0.005, 0.075, CREST)):
        z = along(path, min(y, -0.07))[0] + along(path, min(y, -0.07))[1] - 0.008
        fin(part, (0, y - 0.025, z), (0, y + 0.025, z - 0.006), (0, y + 0.045, z + h), 0.014, k, W)


def tail(part, rnd):
    """Cola larga y gruesa, rígida a la cadera, con la panza clara abajo y púas arriba."""
    W = {"Hips": 1.0}
    path = [(0, 0.06, 0.92), (0, 0.18, 0.86), (0, 0.33, 0.73), (0, 0.50, 0.56), (0, 0.68, 0.40), (0, 0.86, 0.28),
            (0, 1.03, 0.20)]
    radii = [0.10, 0.098, 0.085, 0.07, 0.054, 0.04, 0.026]
    keys = [tube_keys(12, lambda a: BELLY_D if a > 125 else (SKIN_D if a < 40 else SKIN))] * 6
    limb(part, [p + (r, r) for p, r in zip(path, radii)], 1, 12, keys, W, rnd, 0.004, (), caps=(SKIN, SKIN),
         tips=(None, (0, 1.16, 0.16)))
    for k in range(8):
        t = 0.6 + k * 0.68
        i = min(int(t), 5)
        f = t - i
        a, b = Vector(path[i]), Vector(path[i + 1])
        d = (b - a).normalized()
        upv = Vector((0, -d.z, d.y))
        c = a.lerp(b, f) + upv * (radii[i] * (1 - f) + radii[i + 1] * f) * 0.85
        h = (0.075 - 0.006 * k) * rnd.uniform(0.85, 1.1)
        fin(part, c - d * 0.035, c + d * 0.025, c + d * 0.05 + upv * h, 0.014, CREST if k % 2 else CREST_D, W)


def belt(part, rnd):
    """Cinturón con hebilla de hueso, taparrabos roto adelante y atrás."""
    hips = {"Hips": 1.0}
    rows = []
    for z, push in ((0.957, 0.004), (0.948, 0.01), (0.912, 0.011), (0.903, 0.006)):
        f, b = on_rows(TORSO, z, 0, push).y, on_rows(TORSO, z, math.pi, push).y
        rows.append((z, on_rows(TORSO, z, math.pi / 2, push).x, (b - f) / 2, (b + f) / 2, 0.85))
    lathe(part, rows, 14, BELT, hips, caps=(BELT, BELT))
    c = on_rows(TORSO, 0.93, 0.0, 0.02)
    box(part, c, (0.032, 0.012, 0.028), BONE, hips, rnd, 0.003)
    cube(part, c + Vector((0, -0.012, 0)), (0.012, 0, 0), (0, 0.006, 0), (0, 0, 0.012), BONE_HI, hips)
    w = flap_weights(0, 0.5, 0.85, 0.55)
    for front, (z0, z1, hw, cols) in ((-1, (0.905, 0.55, 0.085, 5)), (1, (0.895, 0.66, 0.09, 4))):
        xs = [-hw + 2 * hw * m / (cols - 1) for m in range(cols)]
        cut = [0.05 * rnd.random() for _ in xs]
        grid, nrm = [], []
        for i in range(4):
            t = i / 3
            z = z0 + (z1 - z0) * t
            y = on_rows(TORSO, max(z, 0.72), 0.0 if front < 0 else math.pi, 0.012 + 0.03 * t).y
            grid.append([Vector((x, y - front * 0.02 * (x / hw) ** 2, z - cut[m] * t * t)) for m, x in enumerate(xs)])
            nrm.append([Vector((0, front, 0))] * cols)
        cloth(part, grid, nrm, 0.014, lambda cc, i, j: CLOTH_D if i >= 2 else CLOTH, w)


def necklace(part, rnd):
    """Collar de dientes sobre el pecho."""
    w = {"Spine_03": 1.0}
    zf = lambda a: 1.40 + 0.05 * (abs(a) / math.radians(60)) ** 1.6
    cord = [on_rows(TORSO, zf(a), a, 0.014) for a in (math.radians(d) for d in range(-60, 61, 15))]
    tube(part, cord, [0.007] * len(cord), 4, BELT, w, caps=(BELT, BELT))
    for k, d in enumerate(range(-30, 31, 15)):
        a = math.radians(d)
        p = on_rows(TORSO, zf(a), a, 0.018)
        ln = 0.05 if d else 0.07
        horn(part, [p, p + Vector((0, -0.006, -ln * 0.5))], [0.012, 0.009], 4, BONE_HI if k % 2 == 0 else BONE, w,
             tip=p + Vector((0, -0.01, -ln)), up=(0, -1, 0), per=1)


def build(arm_obj, atlas_img, seed=5):
    rnd = random.Random(seed)
    part = Part()
    torso(part, rnd)
    for side in (1, -1):
        arm(part, side, rnd)
        leg(part, side, rnd)
    i0 = len(part.verts)
    head(part, rnd)
    lift_from(part, i0, HEAD_UP)
    tail(part, rnd)
    pauldron(part, rnd)
    belt(part, rnd)
    necklace(part, rnd)
    like = bpy.data.objects[LIKE]
    # la lanza agarrada por la mitad, más horizontal que GRIP_DIR: la punta queda adelante al caminar
    spear = weapon("SM_Wep_Goblin_Spear_01", (0, 0, 0.45), (-0.865, 0.035, 1.36 + LIFT), (-0.65, -0.72, 0.24),
                   (0, 0, 1), scale=1.0, like=like)
    bones = item("SM_Item_Bones", (-0.165, 0.03, 0.93), 0, 1.0, like)
    return finish(arm_obj, NAME, part, [spear, bones], seed=seed)
