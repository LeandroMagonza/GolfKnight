"""El ogro de la horda: un humanoide enorme, ancho y musculoso, sobre el esqueleto de 49 huesos de
PolygonDungeon (el mismo de los 16 personajes del pack, para que reciba los mismos clips).

Facetado como los personajes del pack (caras grandes y planas, con regiones de un solo color de la paleta
del atlas) y armado con las piezas de monster_body.py: trapecios y deltoides enormes, bíceps, tríceps y
antebrazos marcados en planos, pectorales sobre una panza con pliegue, omóplatos y surco de la columna,
piernas cortas y gruesas con rótula y gemelos, pies descalzos de cinco dedos con uñas. La cabeza, chica y
hundida entre los trapecios: mandíbula salida con colmillos y dientes, visera de cejas oscura sobre ojos
amarillos, nariz chata con fosas, orejas con su adentro y un arito, y un rodete de mechones atado con una
tira roja. Puño derecho cerrado sobre el garrote de los goblins (SM_Wep_Goblin_Club_01) agrandado, mano
izquierda abierta de dedos gruesos. Cinturón tachonado con hebilla de hierro y una bolsa del pack
(SM_Item_Bag_Large), taparrabos de cuero en capas con el borde roto, vendas de dos tonos en muñecas y
canillas, collar de colmillos y cuentas. Piel gris azulada (los goblins ya son verdes).

Uso: build(arm, atlas_image) desde retarget_to_glb.py (--with=monster_ogre) o kit_preview.py.
"""
import bpy, math, os, random, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from synty_kit import *
from monster_body import *

NAME = "Character_Ogre"
SKIN, SKIN_D, SKIN_L = 'steel:2', 'steel:3', 'steel:1'
LEATHER, LEATHER_D, HIDE, HIDE_D, BELT = 'leather:1', 'leather:2', 'mud:1', 'mud:2', 'leather:3'
WRAP, WRAP_D = 'tan:1', 'mud:3'
NAIL, HAIR, MOUTH, IRON, IRON_D = BONE_MID, 'umber:2', 'maroon:3', 'grey:1', 'grey:3'
LIFT = 0.11            # el brazo corrido hacia arriba en la pose T (ver monster_body)

TORSO = [   # z, medio ancho, media profundidad, centro en y[, potencia]
    (0.660, 0.170, 0.140, 0.010),
    (0.750, 0.275, 0.205, 0.010),
    (0.850, 0.310, 0.260, -0.020),
    (0.950, 0.305, 0.310, -0.065, 1.0),
    (1.010, 0.310, 0.322, -0.078, 1.0),
    (1.090, 0.318, 0.322, -0.085, 1.0),      # panza
    (1.190, 0.340, 0.285, -0.055),
    (1.310, 0.375, 0.270, -0.035),           # pectorales
    (1.410, 0.390, 0.238, -0.005),           # hombros
    (1.500, 0.360, 0.212, 0.030),
    (1.570, 0.290, 0.180, 0.045),            # trapecios, con la joroba atrás
    (1.635, 0.170, 0.125, 0.025),
    (1.700, 0.100, 0.080, -0.045),           # nuca: sube y se mete bajo el cráneo, sin meseta
    (1.745, 0.070, 0.060, -0.050),
]
HEAD_UP = 0.05         # la cabeza, más alta que el lugar donde se arma (que sigue al hueso)
TORSO_BUMPS = mirrored([
    (0.15, -0.27, 1.31, 0.10, 0.08, 0.05, 0.04),         # pectorales
    (0.15, -0.28, 1.19, 0.12, 0.08, 0.03, -0.012),       # sombra bajo los pectorales
    (0.0, -0.36, 0.95, 0.26, 0.10, 0.03, -0.02),         # pliegue de la panza sobre el cinturón
    (0.13, 0.03, 1.60, 0.08, 0.10, 0.06, 0.03),          # trapecios
    (0.17, 0.235, 1.38, 0.09, 0.06, 0.09, 0.03),         # omóplatos
    (0.0, 0.27, 1.20, 0.03, 0.08, 0.30, -0.022),         # surco de la columna
    (0.34, 0.06, 1.20, 0.06, 0.12, 0.12, 0.02),          # dorsales
    (0.12, 0.22, 0.75, 0.10, 0.06, 0.08, 0.025),         # nalgas
])


def torso(part, rnd):
    def key(c):
        a = abs(angle_of(c, -0.05))
        return SKIN_L if a < 45 and 0.95 < c.z < 1.20 else SKIN
    lathe(part, TORSO, 16, key, spine_weights(1.74), rnd, 0.008, TORSO_BUMPS, caps=(SKIN, SKIN))


def arm(part, side, rnd):
    s, L = side, LIFT
    xs = [0.14, 0.25, 0.35, 0.45, 0.53, 0.61, 0.68, 0.76, 0.80]
    ys = [0.040, 0.045, 0.050, 0.050, 0.053, 0.050, 0.045, 0.040, 0.038]
    zs = [1.40, 1.40, 1.39, 1.375, 1.368, 1.364, 1.362, 1.361, 1.361]
    radii = [(0.10, 0.10), (0.165, 0.150), (0.150, 0.140), (0.125, 0.120), (0.112, 0.110),
             (0.132, 0.126), (0.122, 0.116), (0.100, 0.096), (0.095, 0.090)]
    ctrl = [(s * x, y, z + LIFT, ru, rv) for x, y, z, (ru, rv) in zip(xs, ys, zs, radii)]
    bumps = [(s * cx, cy, cz + L, rx, ry, rz, a) for cx, cy, cz, rx, ry, rz, a in [
        (0.27, 0.0, 1.53, 0.08, 0.10, 0.07, 0.03),       # deltoides
        (0.40, -0.10, 1.40, 0.08, 0.04, 0.05, 0.035),    # bíceps
        (0.38, 0.17, 1.40, 0.09, 0.04, 0.06, 0.028),     # tríceps
        (0.535, 0.155, 1.37, 0.03, 0.03, 0.03, 0.02),    # punta del codo
        (0.60, -0.07, 1.44, 0.06, 0.05, 0.05, 0.03),     # masa de arriba del antebrazo
    ]]
    W = arm_weights(side)
    limb(part, ctrl, 1, 10, SKIN, W, rnd, 0.007, bumps, caps=(SKIN, SKIN))
    # vendas de dos tonos en la muñeca, con la punta suelta
    for k, (x, r, tilt) in enumerate(((0.705, 0.122, 0.16), (0.738, 0.113, -0.12), (0.77, 0.104, 0.18))):
        c = Vector((s * x, 0.042, 1.361 + L))
        band(part, c, (s, 0.1, tilt), r, 0.034, 0.012, 10, WRAP if k % 2 == 0 else WRAP_D, W(c))
    tip = Vector((s * 0.73, -0.07, 1.30 + L))
    slab(part, [((s * 0.73, -0.075, 1.33 + L), (s * 0.755, -0.075, 1.33 + L), (0, -0.005, 0)),
                ((s * 0.72, -0.082, 1.26 + L), (s * 0.744, -0.08, 1.262 + L), (0, -0.005, 0))], WRAP, W(tip))
    zc = 1.36 + L
    if side < 0:
        grip_fist(part, side, (-0.885, 0.035, zc), GRIP_DIR, (-0.79, 0.04, zc), 1.35, SKIN, SKIN_D, NAIL, rnd,
                  shaft=0.034)
    else:
        open_hand(part, side, 0.78, 0.035, zc, 1.45, SKIN, SKIN_D, NAIL, rnd, curl=(12, 26, 18))


def leg(part, side, rnd):
    s = side
    zs = [0.86, 0.73, 0.59, 0.48, 0.40, 0.30, 0.20, 0.11]
    xs = [0.150, 0.165, 0.165, 0.158, 0.152, 0.150, 0.146, 0.142]
    ys = [0.020, 0.010, 0.000, 0.000, 0.005, 0.020, 0.030, 0.040]
    radii = [0.15, 0.168, 0.155, 0.128, 0.12, 0.13, 0.115, 0.10]
    ctrl = [(s * x, y, z, r, r) for x, y, z, r in zip(xs, ys, zs, radii)]
    bumps = [(s * cx, cy, cz, rx, ry, rz, a) for cx, cy, cz, rx, ry, rz, a in [
        (0.17, -0.13, 0.64, 0.07, 0.05, 0.12, 0.025),    # cuádriceps
        (0.152, -0.115, 0.40, 0.04, 0.03, 0.04, 0.026),  # rótula
        (0.155, 0.135, 0.30, 0.06, 0.05, 0.08, 0.032),   # gemelos
    ]]
    W = leg_weights(side)
    limb(part, ctrl, 1, 10, SKIN, W, rnd, 0.007, bumps, up=(0, -1, 0), caps=(SKIN, SKIN))
    for k, (z, r, tilt) in enumerate(((0.265, 0.135, 0.15), (0.215, 0.126, -0.12), (0.165, 0.117, 0.14))):
        c = Vector((s * 0.148, 0.03, z))
        band(part, c, (s * tilt, 0.08, 1), r, 0.042, 0.013, 10, WRAP if k % 2 == 0 else WRAP_D, W(c), up=(0, -1, 0))
    foot(part, side, rnd)


def foot(part, side, rnd):
    """Pie descalzo, ancho y plano: talón, tobillos marcados y cinco dedos gordos con uñas."""
    s = side
    W = foot_weights(side)
    x = s * 0.148
    ctrl = [(x, 0.13, 0.072, 0.07, 0.10), (x, 0.06, 0.11, 0.11, 0.125), (x, -0.03, 0.095, 0.095, 0.138),
            (x, -0.10, 0.072, 0.072, 0.15), (x, -0.16, 0.055, 0.052, 0.148)]
    bumps = [(x + 0.08, 0.05, 0.12, 0.025, 0.025, 0.025, 0.016), (x - 0.08, 0.05, 0.115, 0.025, 0.025, 0.025, 0.014)]
    limb(part, ctrl, 1, 10, SKIN, W, rnd, 0.005, bumps, caps=(SKIN, SKIN), floor=0.0)
    for k, (dx, r, ln) in enumerate([(-0.095, 0.038, 0.085), (-0.04, 0.032, 0.075), (0.01, 0.029, 0.068),
                                     (0.055, 0.026, 0.06), (0.095, 0.023, 0.05)]):
        base = Vector((x + s * dx, -0.15, r + 0.003))
        finger(part, base, (s * dx * 0.5, -1.0, -0.08), (0, 0, 1), [(ln * 0.55, 0), (ln * 0.45, 14)],
               [r, r * 0.95, r * 0.85], 5, SKIN, W, nail=NAIL)


def head(part, rnd):
    """Cabeza chica en forma de pera, salida para adelante: los planos de la cara salen de bultos que
    empujan solo adelante (labio de abajo, boca, cejas, pómulos), con una fila de anillo en cada uno."""
    W = {"Head": 1.0}
    rows = [
        (1.455, 0.112, 0.078, -0.125),
        (1.500, 0.162, 0.115, -0.112),    # mandíbula
        (1.535, 0.168, 0.120, -0.104),    # labio de abajo
        (1.556, 0.158, 0.114, -0.096),    # la boca
        (1.578, 0.146, 0.108, -0.086),    # labio de arriba
        (1.620, 0.143, 0.108, -0.078),    # pómulos
        (1.648, 0.138, 0.106, -0.072),    # ojos
        (1.672, 0.134, 0.108, -0.066),    # cejas
        (1.700, 0.120, 0.103, -0.056),
        (1.730, 0.096, 0.090, -0.043),
        (1.752, 0.058, 0.058, -0.035),
    ]
    bumps = mirrored([
        (0.0, -0.225, 1.535, 0.11, 0.05, 0.012, 0.03),       # labio de abajo, salido (prognatismo)
        (0.0, -0.215, 1.556, 0.10, 0.05, 0.01, -0.03),       # la boca: un surco
        (0.055, -0.18, 1.672, 0.05, 0.05, 0.012, 0.026),     # cejas en visera
        (0.05, -0.17, 1.648, 0.022, 0.04, 0.012, -0.014),    # cuencas
        (0.10, -0.15, 1.62, 0.04, 0.04, 0.015, 0.016),       # pómulos
        (0.15, -0.07, 1.50, 0.04, 0.05, 0.03, 0.016),        # esquinas de la mandíbula
    ])

    def key(c):
        a = abs(angle_of(c, -0.09))
        if a < 75 and 1.545 < c.z < 1.567:
            return MOUTH
        if a < 70 and 1.66 < c.z < 1.686:
            return SKIN_D                                    # visera oscura, como la de los goblins
        return SKIN
    lathe(part, rows, 14, key, W, rnd, 0.004, bumps, caps=(SKIN, SKIN), tips=(None, (0, -0.033, 1.765)))
    # nariz chata, ancha abajo, con las fosas
    limb(part, [(0, -0.168, 1.66, 0.012, 0.018), (0, -0.19, 1.628, 0.02, 0.028), (0, -0.207, 1.603, 0.024, 0.04),
                (0, -0.2, 1.588, 0.016, 0.032)], 1, 6, SKIN, W, up=(0, -1, 0), caps=(SKIN, SKIN))
    for s in (1, -1):
        cube(part, (s * 0.022, -0.207, 1.586), (0.009, 0, 0), (0, 0.007, 0), (0, 0, 0.005), 'black', W)
        # ojos chiquitos y amarillos bajo la visera
        cube(part, (s * 0.05, -0.172, 1.65), (0.016, 0, 0), (0, 0.006, 0), (0, 0, 0.009), 'gold:1', W)
        cube(part, (s * 0.05, -0.178, 1.65), (0.005, 0, 0), (0, 0.003, 0), (0, 0, 0.007), 'black', W)
        # colmillos curvos desde la mandíbula, por delante del labio de arriba
        horn(part, [(s * 0.092, -0.222, 1.53), (s * 0.098, -0.236, 1.578), (s * 0.114, -0.236, 1.622)],
             [0.026, 0.02, 0.012], 6, [BONE_MID, BONE_HI], W, tip=(s * 0.13, -0.222, 1.665), up=(0, -1, 0), per=1)
        # orejas cortas con su adentro
        leaf(part, (s * 0.128, -0.05, 1.622), (s, 0.35, 0.35), (0, -0.3 * s, s), 0.10, 0.07, 0.016, SKIN, W,
             inner=SKIN_D, cup=0.006)
    torus(part, (0.215, -0.012, 1.625), (0.3, 1, 0), 0.016, 0.005, 6, 4, 'gold:2', W)
    # dientes de abajo, desparejos
    for x, h in ((-0.055, 0.02), (-0.02, 0.028), (0.018, 0.022), (0.052, 0.018)):
        cone(part, (x, -0.236, 1.538), (x, -0.239, 1.538 + h), 0.011, 4, BONE_HI, W)
    # rodete: un moño de mechones atado con una tira roja y la cola caída para atrás
    ball(part, (0, 0.012, 1.758), 0.038, 6, 3, HAIR, W, squash=(1.0, 1.15, 0.85))
    for dx, h in ((-0.016, 0.05), (0.016, 0.045), (0.0, 0.065)):
        horn(part, [(dx, 0.01, 1.76), (dx * 1.2, 0.02, 1.795)], [0.022, 0.016], 5, HAIR, W,
             tip=(dx * 1.4, 0.045, 1.76 + h), up=(0, -1, 0), per=1)
    band(part, (0, 0.006, 1.736), (0, 0, 1), 0.047, 0.018, 0.007, 8, 'brick:1', W)
    for dx, ln in ((-0.02, 1.0), (0.02, 0.9)):
        horn(part, [(dx, 0.03, 1.78), (dx * 1.5, 0.08, 1.79), (dx * 2, 0.12, 1.76)], [0.024, 0.02, 0.013], 5, HAIR, W,
             tip=(dx * 2.2, 0.12 + 0.04 * ln, 1.72 - 0.02 * ln), up=(0, 0, 1), per=1)


def belt(part, rnd):
    """Cinturón tachonado bajo la panza, con hebilla de hierro."""
    w = {"Hips": 1.0}
    rows = [(0.937, 0.320, 0.303, -0.050, 0.95), (0.928, 0.329, 0.300, -0.046, 0.95),
            (0.865, 0.331, 0.272, -0.028, 0.95), (0.856, 0.324, 0.266, -0.026, 0.95)]
    lathe(part, rows, 16, BELT, w, caps=(BELT, BELT))
    for d in (-130, -95, -60, 60, 95, 130, 160, -160):
        a = math.radians(d)
        z = 0.896
        f, b = -0.30, 0.25
        p = Vector((0.333 * math.copysign(abs(math.sin(a)) ** 0.95, math.sin(a)),
                    -0.037 - 0.29 * math.copysign(abs(math.cos(a)) ** 0.95, math.cos(a)), z))
        stud(part, p, Vector((math.sin(a), -math.cos(a), 0)), 0.012, 0.012, IRON, w)
    c = Vector((0, -0.322, 0.896))
    for off, (ax, az) in (((0, 0.036), (0.05, 0.009)), ((0, -0.036), (0.05, 0.009)), ((-0.045, 0), (0.009, 0.045)),
                          ((0.045, 0), (0.009, 0.045))):
        cube(part, c + Vector((off[0], -0.007, off[1])), (ax, 0, 0), (0, 0.01, 0), (0, 0, az), IRON, w)
    cube(part, c + Vector((0.0, -0.012, 0)), (0.007, 0, 0), (0, 0.006, 0), (0, 0, 0.034), IRON_D, w)


def flap(part, xs, z0, z1, yfront, normal, rnd, key, w, ragged=0.05, curve=0.08, rows=4):
    """Paño de cuero que cuelga de z0 a z1, con el borde de abajo roto (columnas de largo desparejo)."""
    C = len(xs)
    cut = [ragged * (rnd.random() if 0 < j < C - 1 else 0.3) for j in range(C)]
    grid, nrm = [], []
    for i in range(rows + 1):
        t = i / rows
        grid.append([Vector((x, yfront(z0 + (z1 - z0) * t) - normal * curve * (x / max(abs(xs[0]), 1e-6)) ** 2,
                             z0 + (z1 - cut[j] * t * t - z0) * t)) for j, x in enumerate(xs)])
        nrm.append([Vector((0, normal, 0))] * C)
    cloth(part, grid, nrm, 0.016, key, w)


def loincloth(part, rnd):
    """Taparrabos en capas: un paño largo adelante y otro de cuero crudo encima, uno atrás y dos de los
    costados, todos con el borde roto."""
    w = flap_weights(0, 0.5)
    hem = lambda c, i, j: LEATHER_D if i >= 3 else LEATHER
    flap(part, [-0.17 + 0.34 * j / 5 for j in range(6)], 0.88, 0.47, lambda z: -0.30 + 0.07 * (0.88 - z), -1, rnd,
         hem, w, ragged=0.07)
    flap(part, [-0.11 + 0.22 * j / 4 for j in range(5)], 0.875, 0.6, lambda z: -0.32 + 0.07 * (0.88 - z), -1, rnd,
         lambda c, i, j: HIDE_D if i >= 2 else HIDE, w, ragged=0.05, rows=3)
    flap(part, [-0.19 + 0.38 * j / 5 for j in range(6)], 0.875, 0.52, lambda z: 0.25 - 0.05 * (0.875 - z), 1, rnd,
         hem, w, ragged=0.07)
    for s in (1, -1):
        grid, nrm = [], []
        for i in range(4):
            t = i / 3
            z = 0.875 - 0.17 * t
            grid.append([Vector((s * (0.322 + 0.03 * t), y, z - (0.035 * rnd.random() if i == 3 else 0)))
                         for y in (-0.10, -0.03, 0.04, 0.10)])
            nrm.append([Vector((s, 0, 0))] * 4)
        cloth(part, grid, nrm, 0.014, lambda c, i, j: HIDE_D if i >= 2 else HIDE, flap_weights(s, 0.4))


def necklace(part, rnd):
    """Collar de colmillos y cuentas colgando de un cordón, apoyado sobre el pecho."""
    w = {"Spine_03": 1.0}
    zf = lambda a: 1.385 + 0.07 * (abs(a) / math.radians(62)) ** 1.6
    cord = [on_rows(TORSO, zf(a), a, 0.035) for a in (math.radians(d) for d in range(-62, 63, 12))]
    tube(part, cord, [0.011] * len(cord), 4, BELT, w, caps=(BELT, BELT))
    for k, d in enumerate(range(-48, 49, 12)):
        a = math.radians(d)
        p = on_rows(TORSO, zf(a), a, 0.04)
        if k % 2 == 1:
            cube(part, p, (0.012, 0, 0), (0, 0.012, 0), (0, 0, 0.012), 'brick:2' if k % 4 == 1 else 'gold:2', w)
            continue
        ln = (0.11 if d == 0 else 0.075) * rnd.uniform(0.85, 1.1)
        horn(part, [p, p + Vector((0, -0.02, -ln * 0.6))], [0.022 if d else 0.028, 0.014], 5,
             BONE_HI if k % 4 == 0 else BONE, w, tip=p + Vector((0, -0.012, -ln)), up=(0, -1, 0), per=1)


def build(arm_obj, atlas_img, seed=11):
    rnd = random.Random(seed)
    part = Part()
    torso(part, rnd)
    for side in (1, -1):
        arm(part, side, rnd)
        leg(part, side, rnd)
    i0 = len(part.verts)
    head(part, rnd)
    lift_from(part, i0, (0, 0, HEAD_UP))
    belt(part, rnd)
    loincloth(part, rnd)
    necklace(part, rnd)
    like = bpy.data.objects[LIKE]
    # el garrote, agarrado del mango (ver GRIP_DIR): cae adelante al caminar y sube atrás de la cabeza
    # en el golpe
    club = weapon("SM_Wep_Goblin_Club_01", (0, 0, 0.04), (-0.885, 0.035, 1.36 + LIFT), GRIP_DIR, (0, 0, 1),
                  scale=1.3, like=like)
    bag = item("SM_Item_Bag_Large", (-0.30, 0.10, 0.905), 15, 1.5, like)
    return finish(arm_obj, NAME, part, [club, bag], seed=seed)
