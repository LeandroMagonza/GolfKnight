"""El minotauro de la horda: un bruto con cabeza de toro sobre el esqueleto de 49 huesos de
PolygonDungeon (el mismo de los 16 personajes del pack, para que reciba los mismos clips).

Facetado como los personajes del pack (caras grandes y planas, con regiones de un solo color de la paleta
del atlas) y armado con las piezas de monster_body.py: torso en V con pectorales, abdominales y dorsales
marcados en planos; un cogote grueso que sube de la joroba a la nuca, con una melena de mechones; brazos
musculosos con brazaletes tachonados; piernas de pelo marrón que se oscurece de la rodilla para abajo,
con flecos, pezuñas partidas con espolones y cola con mechón. La cabeza: hocico ancho con fosas y argolla
de oro, mandíbula con barbita, cejas oscuras sobre ojos rojos, orejas con su adentro y cuernos de marfil
anillados que salen para afuera y suben hacia adelante, con un copete entre los dos. Faldón de tiras de
cuero rotas con remaches, delantal rojo, cinturón con ribete de piel, hebilla de oro y el cuerno de beber
del pack (SM_Item_Horn), correa cruzada al pecho con un aro; puño derecho cerrado sobre el hacha doble del
pack (SM_Wep_Axe_01) agrandada y mano izquierda abierta.

Uso: build(arm, atlas_image) desde retarget_to_glb.py (--with=monster_minotaur) o kit_preview.py.
"""
import bpy, math, os, random, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from synty_kit import *
from monster_body import *

NAME = "Character_Minotaur"
FUR, FUR_L, FUR_D, SHAG, MANE = 'wood:1', 'wood:0', 'wood:3', 'umber:3', 'umber:2'
MUZZLE, MUZZLE_D, HOOF, HAND = 'tan:0', 'tan:2', 'maroon:4', 'umber:2'
KILT, KILT_D, APRON, APRON_D, BELT = 'leather:3', 'leather:2', 'brick:2', 'brick:3', 'maroon:1'
GOLD, GOLD_D, STUD, EAR_IN = 'gold:1', 'gold:3', 'grey:0', 'clay:2'
LIFT = 0.07
HEAD_UP = (0, -0.01, 0.06)     # la cabeza más alta y apenas adelantada, sobre el cogote

TORSO = [   # z, medio ancho, media profundidad, centro en y[, potencia]
    (0.680, 0.150, 0.120, 0.010),
    (0.780, 0.225, 0.155, 0.010),
    (0.880, 0.240, 0.165, 0.005),            # cadera
    (0.980, 0.215, 0.152, 0.000),            # cintura
    (1.035, 0.228, 0.158, -0.004),
    (1.090, 0.248, 0.170, -0.008),
    (1.140, 0.272, 0.183, -0.013),
    (1.190, 0.302, 0.198, -0.018),
    (1.290, 0.352, 0.220, -0.025),           # pectorales
    (1.390, 0.372, 0.208, -0.005),           # hombros
    (1.480, 0.338, 0.198, 0.025),
    (1.565, 0.262, 0.188, 0.055),            # trapecios y joroba
    (1.630, 0.190, 0.160, 0.040),            # cogote: sube hacia adelante y se mete en la nuca
    (1.690, 0.145, 0.125, 0.005),
    (1.745, 0.110, 0.095, -0.030),
]
TORSO_BUMPS = mirrored([
    (0.14, -0.235, 1.29, 0.10, 0.07, 0.05, 0.036),       # pectorales
    (0.14, -0.24, 1.19, 0.11, 0.07, 0.03, -0.012),       # sombra bajo los pectorales
    (0.05, -0.19, 1.14, 0.034, 0.05, 0.022, 0.014),      # abdominales
    (0.05, -0.185, 1.09, 0.034, 0.05, 0.022, 0.012),
    (0.05, -0.18, 1.035, 0.034, 0.05, 0.022, 0.011),
    (0.20, -0.10, 0.98, 0.05, 0.08, 0.06, 0.012),        # oblicuos
    (0.0, 0.13, 1.60, 0.14, 0.08, 0.08, 0.03),           # joroba
    (0.15, 0.20, 1.39, 0.08, 0.05, 0.08, 0.024),         # omóplatos
    (0.0, 0.21, 1.20, 0.025, 0.06, 0.25, -0.016),        # surco de la columna
    (0.30, 0.08, 1.24, 0.05, 0.10, 0.12, 0.018),         # dorsales
    (0.11, 0.17, 0.78, 0.09, 0.05, 0.07, 0.02),          # glúteos
    (0.06, -0.12, 1.68, 0.05, 0.06, 0.06, 0.012),        # el cuello de toro, ancho adelante
])


def torso(part, rnd):
    def key(c):
        a = abs(angle_of(c))
        return FUR_L if a < 40 and 1.0 < c.z < 1.34 else FUR
    lathe(part, TORSO, 16, key, spine_weights(1.75), rnd, 0.007, TORSO_BUMPS, caps=(FUR, FUR))
    # melena: una cresta de mechones planos de la nuca a la espalda (de atrás se ven de canto)
    sw = spine_weights(1.75)
    for k, z in enumerate((1.72, 1.665, 1.61, 1.555, 1.50, 1.445, 1.39, 1.335)):
        a = math.radians(180 + rnd.uniform(-3, 3))
        ln = (0.13 - 0.008 * k) * rnd.uniform(0.85, 1.1)
        b0 = on_rows(TORSO, z + 0.04, a, -0.02)
        b1 = on_rows(TORSO, z - 0.04, a, -0.02)
        out = surface_normal(TORSO, z, a)
        tip = (b0 + b1) / 2 + out * (ln + 0.02) + Vector((0, 0, ln * 0.45))
        fin(part, b0, b1, tip, 0.02, MANE if k % 2 else FUR_D, sw((b0 + b1) / 2))


def arm(part, side, rnd):
    s, L = side, LIFT
    xs = [0.13, 0.24, 0.34, 0.44, 0.53, 0.60, 0.665, 0.74, 0.79]
    ys = [0.040, 0.045, 0.050, 0.050, 0.053, 0.050, 0.045, 0.042, 0.038]
    zs = [1.40, 1.40, 1.39, 1.375, 1.368, 1.364, 1.362, 1.361, 1.361]
    radii = [(0.085, 0.085), (0.135, 0.124), (0.122, 0.114), (0.103, 0.097), (0.09, 0.088),
             (0.106, 0.1), (0.096, 0.092), (0.082, 0.079), (0.078, 0.075)]
    ctrl = [(s * x, y, z + L, ru, rv) for x, y, z, (ru, rv) in zip(xs, ys, zs, radii)]
    bumps = [(s * cx, cy, cz + L, rx, ry, rz, a) for cx, cy, cz, rx, ry, rz, a in [
        (0.25, 0.0, 1.50, 0.07, 0.09, 0.06, 0.026),      # deltoides
        (0.39, -0.085, 1.39, 0.07, 0.035, 0.045, 0.03),  # bíceps
        (0.37, 0.14, 1.40, 0.08, 0.035, 0.05, 0.024),    # tríceps
        (0.59, -0.06, 1.43, 0.05, 0.04, 0.04, 0.024),    # antebrazo arriba
    ]]
    W = arm_weights(side)
    limb(part, ctrl, 1, 10, FUR, W, rnd, 0.006, bumps, caps=(FUR, FUR))
    # brazalete de cuero con bordes de bronce y remaches
    for x, r, wd, key in ((0.675, 0.1, 0.014, GOLD_D), (0.72, 0.096, 0.07, KILT), (0.765, 0.09, 0.014, GOLD_D)):
        c = Vector((s * x, 0.043, 1.362 + L))
        band(part, c, (s, 0, 0), r, wd, 0.013, 10, key, W(c))
    for j in range(6):
        a = 2 * math.pi * (j + 0.5) / 6
        nrm = Vector((0, math.sin(a), math.cos(a)))
        c = Vector((s * 0.72, 0.043, 1.362 + L)) + nrm * 0.108
        stud(part, c, nrm, 0.01, 0.012, STUD, W(c))
    zc = 1.36 + L
    if side < 0:
        grip_fist(part, side, (-0.865, 0.035, zc), GRIP_DIR, (-0.785, 0.04, zc), 1.15, HAND, 'umber:3', 'umber:4', rnd,
                  shaft=0.032)
    else:
        open_hand(part, side, 0.775, 0.035, zc, 1.25, HAND, 'umber:3', 'umber:4', rnd, curl=(14, 28, 20))


def leg(part, side, rnd):
    s = side
    zs = [0.86, 0.72, 0.59, 0.49, 0.43, 0.31, 0.20, 0.12]
    xs = [0.115, 0.125, 0.125, 0.120, 0.118, 0.116, 0.115, 0.114]
    ys = [0.020, 0.010, 0.000, 0.000, 0.005, 0.020, 0.030, 0.040]
    radii = [0.122, 0.14, 0.126, 0.104, 0.096, 0.104, 0.086, 0.078]
    ctrl = [(s * x, y, z, r, r) for x, y, z, r in zip(xs, ys, zs, radii)]
    bumps = [(s * cx, cy, cz, rx, ry, rz, a) for cx, cy, cz, rx, ry, rz, a in [
        (0.14, -0.11, 0.64, 0.06, 0.045, 0.11, 0.024),   # cuádriceps
        (0.12, -0.10, 0.43, 0.035, 0.03, 0.04, 0.022),   # rótula
        (0.12, 0.12, 0.31, 0.05, 0.045, 0.08, 0.028),    # gemelos
    ]]
    W = leg_weights(side)
    limb(part, ctrl, 1, 10, lambda c: FUR if c.z > 0.46 else SHAG, W, rnd, 0.006, bumps, up=(0, -1, 0),
         caps=(FUR, SHAG))
    # flecos de pelo desgreñado que cuelgan de la rodilla y sobre la pezuña
    for z, r, ln, n in ((0.46, 0.098, 0.09, 8), (0.15, 0.084, 0.06, 7)):
        for j in range(n):
            a = 2 * math.pi * (j + 0.5 * (z < 0.3)) / n + rnd.uniform(-0.15, 0.15)
            dirv = Vector((math.sin(a), -math.cos(a), 0))
            c = Vector((s * 0.117, 0.02, z))
            side_v = Vector((0, 0, 1)).cross(dirv)
            base = c + dirv * r * 0.85
            tip = c + dirv * (r + 0.015) + Vector((0, 0, -ln * rnd.uniform(0.8, 1.2)))
            fin(part, base + side_v * 0.03, base - side_v * 0.03, tip, 0.014, SHAG if j % 2 else MANE, W(base))
    hoof(part, side, rnd)


def hoof(part, side, rnd):
    """Pezuña partida: dos dedos negros de cara plana por dentro, con la ranura al medio, y dos espolones
    atrás."""
    s = side
    W = foot_weights(side, ball=(-0.02, -0.08))
    xc = s * 0.115
    for k in (-1, 1):
        x = xc + 0.036 * k

        def flat(p, k=k):
            if (p.x - xc) * k < 0.005:          # la cara de adentro de cada dedo, plana
                p.x = xc + 0.005 * k
            return p
        ctrl = [(x, 0.07, 0.07, 0.05, 0.034), (x, 0.0, 0.07, 0.065, 0.037), (x, -0.07, 0.05, 0.05, 0.035),
                (x, -0.115, 0.025, 0.026, 0.026)]
        limb(part, ctrl, 1, 8, HOOF, W, rnd, 0.002, (), caps=(HOOF, HOOF), tips=(None, (x, -0.13, 0.008)), floor=0.0,
             post=flat)
    band(part, (xc, 0.01, 0.105), (0, 0.15, 1), 0.075, 0.03, 0.014, 10, 'umber:4', W(Vector((xc, 0.01, 0.1))),
         up=(0, -1, 0), rv=0.07)
    for k in (-1, 1):
        cone(part, (xc + 0.03 * k, 0.07, 0.10), (xc + 0.036 * k, 0.1, 0.055), 0.014, 5, HOOF, {sd("Ankle", side): 1.0})


def head(part, rnd):
    """Cabeza de toro (armada en el lugar del hueso, después se levanta con HEAD_UP): cráneo ancho y chato
    arriba, hocico largo y ancho, cuernos anillados."""
    W = {"Head": 1.0}
    ctrl = [(0, 0.04, 1.665, 0.08, 0.085), (0, -0.01, 1.69, 0.112, 0.128), (0, -0.09, 1.665, 0.102, 0.118),
            (0, -0.16, 1.62, 0.08, 0.09), (0, -0.225, 1.578, 0.078, 0.10), (0, -0.268, 1.556, 0.066, 0.09)]
    bumps = mirrored([
        (0.075, -0.095, 1.735, 0.04, 0.04, 0.02, 0.022),     # cejas
        (0.10, -0.05, 1.60, 0.04, 0.05, 0.04, 0.016),        # maseteros
        (0.045, -0.262, 1.574, 0.03, 0.03, 0.025, 0.018),    # ollares
    ])

    def key(c):
        if c.y < -0.205:
            return MUZZLE if c.z > 1.545 else MUZZLE_D
        if abs(c.x) < 0.045 and c.z > 1.66 and -0.17 < c.y < -0.02:
            return FUR_D                                     # lucero oscuro de la frente
        return FUR
    limb(part, ctrl, 1, 12, key, W, rnd, 0.004, bumps, caps=(FUR, MUZZLE), tips=(None, (0, -0.282, 1.55)))
    # mandíbula de abajo con barbita
    limb(part, [(0, -0.07, 1.585, 0.045, 0.07), (0, -0.16, 1.54, 0.038, 0.068), (0, -0.235, 1.518, 0.028, 0.056)], 1, 8,
         MUZZLE_D, W, rnd, 0.003, caps=(MUZZLE_D, MUZZLE_D))
    for dx in (-0.016, 0.0, 0.016):
        horn(part, [(dx, -0.19, 1.51), (dx * 1.2, -0.195, 1.485)], [0.016, 0.012], 4, FUR_D, W,
             tip=(dx * 1.4, -0.205, 1.455), up=(0, -1, 0), per=1)
    # fosas y argolla de oro
    for x in (-0.034, 0.034):
        cube(part, (x * 1.05, -0.281, 1.561), (0.009, 0, 0), (0, 0.005, 0), (0, 0, 0.007), 'maroon:4', W)
    torus(part, (0, -0.288, 1.526), (1, 0, 0), 0.034, 0.009, 8, 4, GOLD, W)
    # copete entre los cuernos
    for k in range(5):
        x = -0.04 + 0.02 * k
        h = 0.05 + 0.02 * math.sin(k * 1.7) + rnd.uniform(0, 0.015)
        horn(part, [(x, -0.0, 1.785), (x * 1.1, -0.03, 1.80)], [0.02, 0.016], 4, FUR_D if k % 2 else MANE, W,
             tip=(x * 1.25, -0.07 - 0.02 * rnd.random(), 1.785 + h * 0.4), up=(0, 0, 1), per=1)
    for s in (1, -1):
        # ojos rojos bajo una ceja oscura
        cube(part, (s * 0.1, -0.112, 1.688), (0.008, 0, 0), (0, 0.016, 0), (0, 0, 0.009), 'red', W)
        cube(part, (s * 0.106, -0.112, 1.688), (0.003, 0, 0), (0, 0.004, 0), (0, 0, 0.007), 'black', W)
        cube(part, (s * 0.095, -0.115, 1.708), (0.018, 0, 0.004 * s), (0, 0.03, 0), (0, 0, 0.008), FUR_D, W)
        # orejas con su adentro
        leaf(part, (s * 0.1, 0.015, 1.695), (s, 0.15, -0.2), (0, 0, s), 0.11, 0.055, 0.014, FUR, W, inner=EAR_IN, cup=0.006)
        # cuernos: para afuera, después arriba y hacia adelante, con anillos
        hp = [(0.06, -0.01, 1.75), (0.14, -0.01, 1.765), (0.22, -0.015, 1.782), (0.30, -0.03, 1.808),
              (0.35, -0.06, 1.85), (0.368, -0.10, 1.89)]
        hr = [0.042, 0.05, 0.044, 0.036, 0.027, 0.018]
        horn(part, [(s * x, y, z) for x, y, z in hp], hr, 8, [BONE_LO, BONE, BONE_HI, BONE, BONE_HI, BONE_MID], W,
             tip=(s * 0.362, -0.145, 1.92), up=(0, -1, 0), per=1)
        band(part, (s * 0.115, -0.01, 1.762), (s, 0, 0.18), 0.05, 0.022, 0.013, 8, MANE, W)


def belt(part, rnd):
    """Cinturón con hebilla de oro y un ribete de piel arriba."""
    w = {"Hips": 1.0}
    rows = []
    for z, push in ((0.99, -0.004), (0.982, 0.004), (0.932, 0.006), (0.925, 0.0)):
        rows.append((z, on_rows(KILT_ROWS, z, math.pi / 2, push).x, -on_rows(KILT_ROWS, z, 0, push).y, 0.0, 0.85))
    lathe(part, rows, 16, BELT, w, caps=(BELT, BELT))
    box(part, (0, -0.19, 0.958), (0.05, 0.012, 0.035), GOLD, w, rnd, 0.002)
    torus(part, (0, -0.205, 0.958), (0, 1, 0), 0.022, 0.006, 8, 4, GOLD_D, w)
    cube(part, (0, -0.212, 0.958), (0.003, 0, 0), (0, 0.003, 0), (0, 0, 0.022), GOLD_D, w)
    for j in range(16):
        a = 2 * math.pi * (j + 0.5) / 16
        p = on_rows(KILT_ROWS, 0.99, a, 0.004)
        nrm = surface_normal(KILT_ROWS, 0.99, a)
        t = Vector((math.cos(a), math.sin(a), 0)) * 0.035
        fin(part, p + t, p - t, p + nrm * 0.02 + Vector((0, 0, 0.035 + 0.012 * rnd.random())), 0.016,
            FUR_D if j % 2 else MANE, w)


KILT_ROWS = [(0.62, 0.330, 0.245, 0.0), (0.78, 0.292, 0.212, 0.0), (0.95, 0.248, 0.178, 0.0)]


def kilt(part, rnd):
    """Faldón de tiras de cuero con la punta rota y remaches, y un delantal rojo adelante."""
    for j, d in enumerate(range(-150, 181, 30)):
        if d == 0:
            continue
        a = math.radians(d)
        side = 0 if abs(d) == 180 else (1 if d > 0 else -1)
        w = flap_weights(side, 0.75, 0.9, 0.62)
        cut = [0.035 * rnd.random() for _ in range(3)]
        grid, nrm = [], []
        for i, (z, push) in enumerate(((0.94, 0.012), (0.78, 0.016), (0.63, 0.02))):
            t = i / 2
            grid.append([on_rows(KILT_ROWS, z - cut[m] * t * t, a + math.radians(da), push)
                         for m, da in enumerate((-13, 0, 13))])
            nrm.append([surface_normal(KILT_ROWS, z, a + math.radians(da)) for da in (-13, 0, 13)])
        key = KILT if j % 2 else KILT_D
        cloth(part, grid, nrm, 0.018, key, w)
        p = on_rows(KILT_ROWS, 0.86, a, 0.03)
        stud(part, p, surface_normal(KILT_ROWS, 0.86, a), 0.01, 0.01, STUD, w(p))
    # delantal rojo con el borde oscuro y la punta rota
    w = flap_weights(0, 0.5, 0.9, 0.55)
    xs = [-0.1 + 0.2 * m / 4 for m in range(5)]
    cut = [0.05 * rnd.random() for _ in xs]
    grid, nrm = [], []
    for i in range(5):
        t = i / 4
        z0 = 0.95 - 0.40 * t
        grid.append([Vector((x, on_rows(KILT_ROWS, max(z0, 0.62), 0.0, 0.03 + 0.03 * t).y + 0.03 * (x / 0.1) ** 2,
                             z0 - cut[m] * t * t)) for m, x in enumerate(xs)])
        nrm.append([Vector((0, -1, 0))] * len(xs))
    cloth(part, grid, nrm, 0.014, lambda c, i, j: APRON_D if i == 3 else APRON, w)


def chest_strap(part, rnd):
    """Correa del hombro izquierdo a la cadera derecha, por adelante y por atrás, con un aro de oro."""
    loop = [(-80, 1.0), (-50, 1.08), (-20, 1.18), (10, 1.30), (35, 1.42), (58, 1.52), (80, 1.585), (100, 1.585),
            (122, 1.52), (148, 1.42), (175, 1.30), (205, 1.18), (235, 1.08), (262, 1.0), (280, 1.0)]
    pts, nrm = [], []
    for d, z in loop:
        a = math.radians(d)
        pts.append(on_rows(TORSO, z, a, 0.014))
        nrm.append(surface_normal(TORSO, z, a))
    sw = spine_weights()
    strap(part, pts, nrm, 0.07, 0.018, KILT, sw)
    p = on_rows(TORSO, 1.25, math.radians(-2), 0.03)
    torus(part, p, (0, 1, 0), 0.03, 0.009, 8, 4, GOLD, sw(p))
    for d, z in ((35, 1.42), (148, 1.42), (-50, 1.08)):
        a = math.radians(d)
        stud(part, on_rows(TORSO, z, a, 0.025), surface_normal(TORSO, z, a), 0.011, 0.012, STUD, sw(on_rows(TORSO, z, a)))


def tail(part, rnd):
    """Cola fina con mechón de pelo oscuro en la punta, rígida a la cadera."""
    W = {"Hips": 1.0}
    limb(part, [(0, 0.12, 0.92, 0.03, 0.03), (0, 0.2, 0.86, 0.028, 0.028), (0, 0.255, 0.74, 0.024, 0.024),
                (0, 0.27, 0.6, 0.02, 0.02), (0, 0.27, 0.5, 0.019, 0.019)], 1, 6, FUR, W, caps=(FUR, FUR))
    for k in range(5):
        a = 2 * math.pi * k / 5
        o = Vector((0.018 * math.sin(a), 0.018 * math.cos(a), 0))
        horn(part, [Vector((0, 0.27, 0.53)) + o, Vector((0, 0.27, 0.46)) + o * 1.8], [0.02, 0.022], 4,
             FUR_D if k % 2 else MANE, W, tip=Vector((0, 0.27, 0.36 + 0.03 * rnd.random())) + o * 1.2, up=(0, -1, 0), per=1)


def build(arm_obj, atlas_img, seed=23):
    rnd = random.Random(seed)
    part = Part()
    torso(part, rnd)
    for side in (1, -1):
        arm(part, side, rnd)
        leg(part, side, rnd)
    i0 = len(part.verts)
    head(part, rnd)
    lift_from(part, i0, HEAD_UP)
    belt(part, rnd)
    kilt(part, rnd)
    chest_strap(part, rnd)
    tail(part, rnd)
    like = bpy.data.objects[LIKE]
    # el hacha doble agarrada en la parte baja del mango (ver GRIP_DIR), con las hojas paradas en la pose T
    axe = weapon("SM_Wep_Axe_01", (0, 0, 0.12), (-0.865, 0.035, 1.36 + LIFT), GRIP_DIR, (0, 0, 1), scale=1.5, like=like)
    drink = item("SM_Item_Horn", (0.255, 0.06, 0.95), -15, 1.3, like)
    return finish(arm_obj, NAME, part, [axe, drink], seed=seed)
