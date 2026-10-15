"""Huargo: el lobo grande que montan los goblins, el corredor rápido de la horda.

Se arma entero acá con synty_kit (anillos de pocos lados con algo de ruido y colores de la paleta del
atlas) sobre un esqueleto propio de 25 huesos (beast_rig.make_armature): body (raíz, el medio del lomo),
chest, pelvis, neck, head, jaw, tail1..3 y cuatro patas de cuatro huesos (fleg1..3 + fpaw adelante,
hleg1..3 + hpaw atrás, _L en +x). Mira a -Y, pisa en z = 0, mide ~1.37 m a las orejas y 2.35 m de la
nariz a la punta de la cola: lomo encorvado con cresta de pelo en el cuello, hocico largo con colmillos,
ojos rojos, cola peluda, collar de pinchos y cincha de cuero de los goblins.

Las acciones se arman cuadro por cuadro (beast_rig.Pose): el cuerpo con ángulos y las patas con IK desde
la punta de la pata (Leg), que en el apoyo se desliza para atrás justo a la velocidad del suelo del juego
(1.5·H/1.8 m/s caminando y 4·H/1.8 corriendo, H = alto de la malla) y en el vuelo se levanta con la
muñeca o el garrón doblados.
- Idle: respira, gruñe con la boca entreabierta y mira a los costados (2 s, loop).
- Walking: paso de cuatro tiempos; Running: galope rotatorio con el lomo que se encoge y se estira.
- Attack: se agacha, salta adelante con las manos y muerde (cierra la boca al 45%), vuelve a la guardia.
- Hard Landing (la muerte): da un respingo y se cae sobre el costado derecho; quieto desde el 32%.

uso: blender -b --python tools/beast_warg.py -- public/models/warg.glb
"""
import bpy, math, os, random, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from synty_kit import *
from beast_rig import *

NAME = "Character_Warg"
X = (1, 0, 0)

# columna, cabeza y cola: nombre, cabeza, cola, padre
SPINE = [
    ("body", (0, 0.02, 0.86), (0, -0.30, 0.90), None),
    ("chest", (0, -0.30, 0.90), (0, -0.58, 0.96), "body"),
    ("neck", (0, -0.58, 0.96), (0, -0.82, 1.10), "chest"),
    ("head", (0, -0.82, 1.10), (0, -1.20, 1.03), "neck"),
    ("jaw", (0, -0.88, 1.00), (0, -1.17, 0.97), "head"),
    ("pelvis", (0, 0.02, 0.86), (0, 0.45, 0.82), "body"),
    ("tail1", (0, 0.60, 0.88), (0, 0.76, 0.87), "pelvis"),
    ("tail2", (0, 0.76, 0.87), (0, 0.90, 0.80), "tail1"),
    ("tail3", (0, 0.90, 0.80), (0, 1.00, 0.67), "tail2"),
]
# patas izquierdas (+x): articulaciones de arriba a la punta de los dedos
FRONT = (["fleg1", "fleg2", "fleg3", "fpaw"], "chest",
         [(0.17, -0.50, 0.72), (0.18, -0.36, 0.48), (0.175, -0.38, 0.16), (0.17, -0.41, 0.065), (0.17, -0.55, 0.025)])
HIND = (["hleg1", "hleg2", "hleg3", "hpaw"], "pelvis",
        [(0.15, 0.40, 0.76), (0.17, 0.26, 0.48), (0.165, 0.50, 0.21), (0.16, 0.46, 0.065), (0.16, 0.32, 0.025)])
LEGS = {"FL": ("fleg", "_L"), "FR": ("fleg", "_R"), "HL": ("hleg", "_L"), "HR": ("hleg", "_R")}

C = dict(back='umber:1', side='grey:2', low='grey:1', belly='stone:2', throat='stone:1',
         mane=['umber:3', 'umber:2', 'grey:3', 'umber:1'], muzzle='stone:1', snout='grey:2', mouth='maroon:1',
         nose='black', eye='red', fang='stone:0', ear='umber:2', ear_in='maroon:1',
         leg='grey:2', leg_low='grey:1', paw='stone:2', claw='black',
         collar='leather:2', strap='leather:3', metal='ash:1', plate='ash:2', tail_tip='stone:1')

# corte del cuerpo de la grupa a la nariz: centro, medio ancho, alto arriba, alto abajo, pesos, colores
BODY = [
    ((0, 0.70, 0.835), 0.09, 0.07, 0.08, {"pelvis": 1}),
    ((0, 0.62, 0.84), 0.17, 0.11, 0.14, {"pelvis": 1}),
    ((0, 0.44, 0.84), 0.215, 0.13, 0.175, {"pelvis": 1}),
    ((0, 0.22, 0.855), 0.195, 0.13, 0.135, {"pelvis": 0.6, "body": 0.4}),
    ((0, 0.00, 0.865), 0.23, 0.18, 0.21, {"body": 1}),
    ((0, -0.22, 0.875), 0.275, 0.25, 0.30, {"body": 0.5, "chest": 0.5}),
    ((0, -0.44, 0.895), 0.29, 0.30, 0.30, {"chest": 1}),
    ((0, -0.60, 0.935), 0.245, 0.27, 0.27, {"chest": 0.8, "neck": 0.2}),
    ((0, -0.71, 0.995), 0.20, 0.22, 0.21, {"chest": 0.35, "neck": 0.65}),
    ((0, -0.80, 1.06), 0.175, 0.175, 0.165, {"neck": 0.7, "head": 0.3}),
    ((0, -0.865, 1.11), 0.17, 0.125, 0.13, {"head": 1}),
    ((0, -0.94, 1.125), 0.185, 0.13, 0.115, {"head": 1}),
    ((0, -1.01, 1.115), 0.14, 0.105, 0.09, {"head": 1}),
    ((0, -1.07, 1.075), 0.092, 0.06, 0.055, {"head": 1}),
    ((0, -1.16, 1.05), 0.075, 0.05, 0.045, {"head": 1}),
    ((0, -1.25, 1.035), 0.058, 0.04, 0.035, {"head": 1}),
    ((0, -1.29, 1.03), 0.04, 0.028, 0.028, {"head": 1}),
]
NB = 10      # lados de los cortes del cuerpo


def bone_list():
    out = [(n, h, t, p, X) for n, h, t, p in SPINE]
    for side, sx in (("_L", 1), ("_R", -1)):
        for names, parent, pts in (FRONT, HIND):
            prev = parent
            for i, n in enumerate(names):
                h, t = pts[i], pts[i + 1]
                out.append((n + side, (h[0] * sx, h[1], h[2]), (t[0] * sx, t[1], t[2]), prev, X))
                prev = n + side
    return out


# ------------------------------------------------------------ malla

def body_keys(i):
    """Colores de cada tramo del cuerpo según dónde está: tronco, cuello, cráneo, hocico."""
    y = BODY[i][0][1]
    if y > -0.6:
        return band_keys(NB, C['back'], C['side'], C['belly'], C['low'])
    if y > -0.85:
        return band_keys(NB, 'umber:2', C['side'], C['throat'], 'stone:2')
    if y > -1.0:
        return band_keys(NB, C['back'], C['side'], C['throat'], C['low'])
    return band_keys(NB, C['snout'], C['muzzle'], C['mouth'], C['muzzle'])


def body_axis(i):
    a = Vector(BODY[min(i + 1, len(BODY) - 1)][0]) - Vector(BODY[max(i - 1, 0)][0])
    return -a      # hacia adelante (-Y), como el hueso


def station(y):
    """Corte interpolado del cuerpo a la altura y (para crines, collar y cincha)."""
    for a, b in zip(BODY, BODY[1:]):
        if b[0][1] <= y <= a[0][1]:
            x = (a[0][1] - y) / (a[0][1] - b[0][1])
            c = Vector(a[0]).lerp(Vector(b[0]), x)
            near = a if x < 0.5 else b
            ax = (Vector(b[0]) - Vector(a[0])).normalized()
            return c, lerp(a[1], b[1], x), lerp(a[2], b[2], x), lerp(a[3], b[3], x), near[4], ax
    raise ValueError(y)


def surface(y, deg):
    """Punto de la piel a la altura y, a `deg` grados del lomo hacia +x, y su dirección hacia afuera."""
    c, w, top, bot, wt, ax = station(y)
    a = math.radians(deg)
    sa, ca = math.sin(a), math.cos(a)
    h = top if ca > 0 else bot
    p = Vector((w * abs(sa) ** 0.8, c.y, c.z + math.copysign(h * abs(ca) ** 0.8, ca)))
    return p, Vector((sa / w, 0, ca / h)).normalized()


def torso(part, rnd):
    rings = []
    for i, (c, w, top, bot, wt) in enumerate(BODY):
        jit = 0.008 if i < len(BODY) - 3 else 0.004
        rings.append(part.ring(section(c, body_axis(i), (0, 0, 1), w, top, bot, NB, rnd, jit), wt))
    for i in range(len(rings) - 1):
        part.bridge(rings[i], rings[i + 1], body_keys(i))
    part.cap(rings[0], C['side'], Vector((0, 0.74, 0.845)), {"pelvis": 1})
    part.cap(rings[-1], C['nose'], Vector((0, -1.315, 1.032)), {"head": 1})


def mane(part, rnd):
    """Cresta de mechones angulosos del cráneo a la mitad del lomo, y la gola a los costados del cuello."""
    y = -0.88
    k = 0
    while y < 0.10:
        c, w, top, bot, wt, ax = station(y)
        zt = c.z + top
        # alto: máximo en el cuello y la cruz, se apaga hacia atrás; dos mechones anchos tirados para atrás
        h = 0.05 + 0.09 * smooth((y + 0.88) / 0.25) * (1 - smooth((y + 0.40) / 0.50))
        for s in ((1, -1) if k % 2 else (-1, 1)):
            hh = h * (1.0 if s > 0 else 0.8) * rnd.uniform(0.85, 1.1)
            x0 = s * 0.045
            bw = 0.06 + 0.25 * hh
            tip = (x0 + s * 0.05, y + 0.19 + hh * 0.7, zt + hh * 0.72)
            base = [(x0 - bw, y - 0.03, zt - 0.04), (x0 + bw, y - 0.03, zt - 0.04), (x0, y + 0.10, zt - 0.03)]
            shard(part, base, tip, [C['mane'][k % 4], C['mane'][(k + 1) % 4], C['mane'][k % 4]], wt)
        y += 0.10 + rnd.uniform(-0.012, 0.012)
        k += 1
    # gola: mechones a los costados del cuello y las mejillas, para atrás y afuera
    for y, up_, out_ in ((-0.90, 0.0, 0.0), (-0.80, 0.02, 0.02), (-0.70, 0.06, 0.03), (-0.62, 0.1, 0.02)):
        c, w, top, bot, wt, ax = station(y)
        for s in (1, -1):
            for dz, size in ((0.05 + up_, 1.0), (-0.07 + up_, 0.8)):
                x = s * w * 0.88
                z = c.z + dz
                base = [(x - s * 0.04, y - 0.05, z + 0.04), (x - s * 0.04, y - 0.05, z - 0.04), (x - s * 0.04, y + 0.04, z)]
                tip = (x + s * (0.09 + out_) * size, y + 0.13 * size, z - 0.03 * size + rnd.uniform(-0.01, 0.01))
                shard(part, base, tip, [C['mane'][1], C['mane'][0], C['mane'][2]], wt)


def head_bits(part, rnd):
    W = {"head": 1}
    # mandíbula: cuña abajo del hocico, con la lengua oscura arriba
    jaw = [((0, -0.885, 0.985), 0.10, 0.03, 0.045), ((0, -1.0, 0.978), 0.085, 0.025, 0.045),
           ((0, -1.12, 0.975), 0.065, 0.02, 0.035), ((0, -1.24, 0.98), 0.045, 0.015, 0.025)]
    rings = []
    for i, (c, w, top, bot) in enumerate(jaw):
        a = Vector(jaw[min(i + 1, 3)][0]) - Vector(jaw[max(i - 1, 0)][0])
        rings.append(part.ring(section(c, a, (0, 0, 1), w, top, bot, 8, rnd, 0.003), {"jaw": 1}))
    for i in range(3):
        part.bridge(rings[i], rings[i + 1], band_keys(8, C['mouth'], C['muzzle'], C['throat']))
    part.cap(rings[0], C['throat'])
    part.cap(rings[-1], C['muzzle'], Vector((0, -1.27, 0.978)), {"jaw": 1})
    for s in (1, -1):
        # colmillos de arriba, por fuera de la mandíbula
        for y, x, z, ln in ((-1.20, 0.058, 1.025, 0.085), (-1.10, 0.068, 1.03, 0.045)):
            base = [(s * (x - 0.012), y + 0.012, z), (s * (x + 0.012), y + 0.012, z), (s * x, y - 0.014, z)]
            shard(part, base, (s * (x + 0.004), y, z - ln), C['fang'], W)
        # orejas en punta
        base = [(s * 0.045, -0.85, 1.215), (s * 0.125, -0.86, 1.19), (s * 0.115, -0.91, 1.195), (s * 0.05, -0.905, 1.22)]
        shard(part, base, (s * 0.12, -0.835, 1.37), [C['ear'], C['ear'], C['ear_in'], C['ear']], W)
        # ojos rojos, rasgados
        p, out = surface(-0.99, 62)
        p, out = Vector((s * p.x, p.y, p.z)), Vector((s * out.x, out.y, out.z))
        fwd = Vector((0, -1, 0))
        upv = out.cross(fwd).normalized() * -s
        base = [p + fwd * 0.04 - upv * 0.01, p - fwd * 0.035 + upv * 0.016, p - fwd * 0.004 - upv * 0.02]
        shard(part, [tuple(b - out * 0.006) for b in base], tuple(p + out * 0.02 + fwd * 0.004), C['eye'], W)


def collar(part, rnd):
    """Collar de cuero con pinchos (y la cincha del lomo con su argolla): para los goblins."""
    for y0, y1, grow, key, spikes in ((-0.635, -0.70, 1.07, C['collar'], True), (-0.08, -0.15, 1.035, C['strap'], False)):
        rr = []
        for y, g in ((y0, grow), (y1, grow), (y1, grow - 0.04), (y0, grow - 0.04)):
            c, w, top, bot, wt, ax = station(y)
            rr.append(part.ring(section(c, ax, (0, 0, 1), w * g, top * g, bot * g, NB), wt))
        for i in range(4):
            part.bridge(rr[i], rr[(i + 1) % 4], key)
        if spikes:
            c, w, top, bot, wt, ax = station((y0 + y1) / 2)
            pts = section(c, ax, (0, 0, 1), w * grow, top * grow, bot * grow, NB)
            for j in (1, 3, 5, 7, 9):
                p = Vector(pts[j])
                out = (p - c).normalized()
                side = out.cross(Vector(ax)).normalized()
                base = [p + side * 0.03 + Vector(ax) * 0.025, p - side * 0.03 + Vector(ax) * 0.025, p - Vector(ax) * 0.03]
                shard(part, [tuple(b - out * 0.01) for b in base], tuple(p + out * 0.09), C['metal'], wt)
        else:
            c, w, top, bot, wt, ax = station((y0 + y1) / 2)
            z = c.z + top * grow + 0.012
            plate = [(-0.06, y0 + 0.005, z), (0.06, y0 + 0.005, z), (0.06, y1 - 0.005, z), (-0.06, y1 - 0.005, z)]
            low = [(x, y, z - 0.04) for x, y, z in plate]
            a = part.ring(plate, wt)
            b = part.ring(low, wt)
            part.bridge(b, a, C['plate'])
            part.face(list(reversed(a)), C['plate'])


def tail(part, rnd):
    pts = [(0, 0.60, 0.88), (0, 0.68, 0.878), (0, 0.76, 0.87), (0, 0.83, 0.84), (0, 0.90, 0.80), (0, 0.95, 0.74),
           (0, 0.99, 0.68)]
    radii = [0.06, 0.085, 0.11, 0.12, 0.105, 0.08, 0.05]
    wts = [{"tail1": 0.7, "pelvis": 0.3}, {"tail1": 1}, {"tail1": 0.5, "tail2": 0.5}, {"tail2": 1},
           {"tail2": 0.5, "tail3": 0.5}, {"tail3": 1}, {"tail3": 1}]
    keys = [C['side'], C['back'], C['back'], C['side'], 'stone:3', C['tail_tip']]
    rings = tube(part, pts, radii, 6, wts, keys, rnd, 0.014, up=(0, 0, 1))
    part.cap(rings[-1], C['tail_tip'], Vector((0, 1.03, 0.61)), {"tail3": 1})


def leg_mesh(part, rnd, names, parent, pts, sx):
    """Pata: tubo de seis lados del hombro o la cadera al nudillo, y la mano como una cuña con garras."""
    P = [Vector((p[0] * sx, p[1], p[2])) for p in pts]
    b1, b2, b3, b4 = names
    top = P[0] + Vector((0, 0.03, 0.12))
    front = names[0].startswith("f")
    r0 = (0.15, 0.13) if front else (0.16, 0.15)
    r1 = (0.145, 0.13) if front else (0.16, 0.15)
    r2 = 0.12 if front else 0.13
    path = [top, P[0], P[0].lerp(P[1], 0.5), P[1], P[1].lerp(P[2], 0.5), P[2], P[2].lerp(P[3], 0.5), P[3]]
    radii = [r0, r1, r2] + ([0.09, 0.078, 0.062, 0.052, 0.054] if front else [0.085, 0.07, 0.055, 0.046, 0.05])
    wts = [{parent: 0.6, b1: 0.4}, {b1: 0.8, parent: 0.2}, {b1: 1}, {b1: 0.5, b2: 0.5}, {b2: 1},
           {b2: 0.5, b3: 0.5}, {b3: 1}, {b3: 0.5, b4: 0.5}]
    keys = [C['leg'], C['leg'], C['leg'], C['leg'], C['leg_low'], C['leg_low'], C['leg_low']]
    tube(part, path, radii, 6, wts, keys, rnd, 0.008, up=(0, -1, 0))
    # mano: de atrás del nudillo a la punta de los dedos
    fet, toe = P[3], P[4]
    d = (toe - fet)
    flat = Vector((d.x, d.y, 0)).normalized()
    c0 = fet + flat * -0.02 + Vector((0, 0, -0.012))
    c1 = fet.lerp(toe, 0.55) + Vector((0, 0, -0.008))
    c2 = toe + Vector((0, 0, 0.002))
    rings = tube(part, [c0, c1, c2], [(0.045, 0.055), (0.04, 0.068), (0.026, 0.06)], 6,
                 [{b4: 0.7, b3: 0.3}, {b4: 1}, {b4: 1}], [C['paw'], C['paw']], rnd, 0.004, up=(0, 0, 1))
    part.cap(rings[0], C['paw'])
    part.cap(rings[-1], C['paw'], toe + flat * 0.02 + Vector((0, 0, -0.008)), {b4: 1})
    for k in (-1, 0, 1):
        side = Vector((1, 0, 0)) * (k * 0.036)
        base = [toe + side + Vector(d) for d in ((0.008, 0.01, 0.012), (-0.008, 0.01, 0.012), (0, 0.01, -0.01))]
        shard(part, [tuple(b) for b in base], tuple(toe + side + flat * 0.05 + Vector((0, 0, -0.02))), C['claw'], {b4: 1})


def build_mesh(arm, mat, seed=11):
    rnd = random.Random(seed)
    part = Part()
    torso(part, rnd)
    mane(part, rnd)
    head_bits(part, rnd)
    collar(part, rnd)
    tail(part, rnd)
    for sx, side in ((1, "_L"), (-1, "_R")):
        for names, parent, pts in (FRONT, HIND):
            leg_mesh(part, rnd, [n + side for n in names], parent, pts, sx)
    mesh = part.to_object(NAME, mat)
    bind(mesh, arm)
    return mesh


# ------------------------------------------------------------ animación

class Leg:
    """Una pata con IK: se le da la punta de los dedos, cuánto se inclina la mano (p, hacia abajo desde
    adelante) y el metacarpo/metatarso (m, desde la vertical hacia atrás) y apunta los cuatro huesos."""

    def __init__(self, rig, prefix, side):
        self.front = prefix == "fleg"
        p = "f" if self.front else "h"
        self.names = [f"{p}leg1{side}", f"{p}leg2{side}", f"{p}leg3{side}", f"{p}paw{side}"]
        R, ln = rig.rest, rig.length
        self.l1, self.l2, self.l3, self.l4 = (ln[n] for n in self.names)
        self.hip = R[self.names[0]].translation.copy()
        fet = R[self.names[3]].translation
        self.toe = R[self.names[3]] @ Vector((0, self.l4, 0))
        d = self.toe - fet
        self.p0 = math.atan2(-d.z, -d.y)
        u = R[self.names[2]].translation - fet
        self.m0 = math.atan2(u.y, u.z)
        self.th0 = self.angle(self.hip, self.toe)
        self.k = 0.45 if self.front else 0.75       # cuánto sigue el metatarso al ángulo de la pata

    @staticmethod
    def angle(hip, toe):
        return math.atan2(hip.y - toe.y, hip.z - toe.z)

    def m_stance(self, hip, toe):
        return self.m0 + self.k * (self.angle(hip, toe) - self.th0)

    def solve(self, pose, toe, p, m):
        b1, b2, b3, b4 = self.names
        toe = Vector(toe)
        fet = toe - Vector((0, -math.cos(p), -math.sin(p))) * self.l4
        ank = fet + Vector((0, math.sin(m), math.cos(m))) * self.l3
        hip = pose.head(b1)
        pole = Vector((0, 1, -0.1)) if self.front else Vector((0, -1, -0.1))
        knee, _ = two_bone(hip, ank, self.l1, self.l2, pole)
        pose.aim(b1, knee, X)
        pose.aim(b2, ank, X)
        pose.aim(b3, fet, X)
        pose.aim(b4, toe, X)

    def stand(self, pose, dy=0.0, dz=0.0, heel=0.0):
        toe = self.toe + Vector((0, dy, dz))
        hip = pose.head(self.names[0])
        self.solve(pose, toe, self.p0 + math.radians(heel), self.m_stance(hip, toe))

    def step(self, pose, ph, g):
        """La pata en el ciclo de un paso: ph 0 = apoya adelante."""
        hip = pose.head(self.names[0])
        duty, sweep = g['duty'], g['sweep']
        heel = math.radians(g['heel'])
        lift, curl, fold, shift = g['front'] if self.front else g['hind']
        y_td = self.toe.y + shift - sweep / 2
        y_lo = y_td + sweep
        ph %= 1.0
        if ph < duty:
            s = ph / duty
            toe = Vector((self.toe.x, y_td + sweep * s, self.toe.z))
            p = self.p0 + heel * ramp(s, 0.5, 1.0)
            m = self.m_stance(hip, toe)
        else:
            s = (ph - duty) / (1 - duty)
            e = smooth(s)
            toe = Vector((self.toe.x, lerp(y_lo, y_td, e), self.toe.z + lift * math.sin(math.pi * s ** 0.85)))
            arc = math.sin(math.pi * s)
            p = lerp(self.p0 + heel, self.p0, e) + math.radians(curl) * arc
            a = Vector((self.toe.x, y_lo, self.toe.z))
            b = Vector((self.toe.x, y_td, self.toe.z))
            m = lerp(self.m_stance(hip, a), self.m_stance(hip, b), e) + math.radians(fold) * arc
        self.solve(pose, toe, p, m)


def make_actions(rig, H):
    legs = {k: Leg(rig, *v) for k, v in LEGS.items()}

    def tails(P, u, amp, lag=0.12, lift=0.0):
        """Cola que se mece con un retraso que crece hacia la punta."""
        for i, n in enumerate(("tail1", "tail2", "tail3")):
            P.rot(n, rx=lift * (1 - 0.3 * i), rz=amp * (0.6 + 0.4 * i) * wave(u, 1, lag * (i + 1)))

    # ---- Idle: respira, gruñe con la boca entreabierta, mira a un lado y al otro
    def idle(t, u):
        P = rig.pose()
        br = wave(u, 2)
        P.rot("body", rx=0.6 * br, loc=(0, 0, -0.012 + 0.008 * br))
        P.rot("chest", rx=-1.0 * br)
        P.rot("pelvis", rx=-0.5 * br)
        P.rot("neck", rx=8 + 2 * wave(u, 1, 0.1), rz=9 * wave(u, 1))
        P.rot("head", rx=-6 - 2 * wave(u, 1, 0.1), rz=7 * wave(u, 1, 0.08), ry=-4 * wave(u, 1, 0.05))
        P.rot("jaw", rx=7 + 3 * wave(u, 4))
        tails(P, u, 6, lift=-6)
        for lg in legs.values():
            lg.stand(P)
        return P

    # ---- pasos: velocidad del suelo en el juego para timeScale 1
    # patas: (alto del vuelo, cuánto se enrosca la mano, cuánto se dobla la muñeca/garrón, corrimiento)
    walk = dict(T=0.9, duty=0.6, heel=30, front=(0.10, 45, -40, 0.06), hind=(0.09, 30, 25, 0.06),
                phases={"HL": 0.0, "FL": 0.25, "HR": 0.5, "FR": 0.75}, speed=1.5 * H / 1.8)
    gallop = dict(T=16 / FPS, duty=0.38, heel=40, front=(0.22, 85, -80, -0.04), hind=(0.18, 50, 40, -0.06),
               phases={"HL": 0.0, "HR": 0.1, "FR": 0.5, "FL": 0.6}, speed=4.0 * H / 1.8)
    for g in (walk, gallop):
        g['sweep'] = g['speed'] * g['duty'] * g['T']

    def walking(t, u):
        g = walk
        P = rig.pose()
        P.rot("body", rx=1.0 * wave(u, 2, 0.1), ry=2.0 * wave(u, 1, 0.05), rz=1.5 * wave(u, 1, 0.2),
              loc=(0, 0, -0.015 + 0.012 * wave(u, 2, 0.05)))
        P.rot("chest", rz=-2.5 * wave(u, 1, 0.45), ry=-1.0 * wave(u, 1, 0.3))
        P.rot("pelvis", rz=-3.0 * wave(u, 1, 0.2), ry=-1.5 * wave(u, 1, 0.05))
        P.rot("neck", rx=5 + 3 * wave(u, 2, 0.25), rz=2.5 * wave(u, 1, 0.5))
        P.rot("head", rx=-4 - 2.5 * wave(u, 2, 0.3))
        P.rot("jaw", rx=5 + 2 * wave(u, 2))
        tails(P, u, 9, lift=-4)
        for k, lg in legs.items():
            lg.step(P, u - g['phases'][k], g)
        return P

    def running(t, u):
        g = gallop
        P = rig.pose()
        flex = math.cos(2 * math.pi * u)               # 1 encogido (al apoyar atrás), -1 estirado
        P.rot("body", rx=-6 * wave(u, 1), loc=(0, 0, -0.03 + 0.035 * math.cos(4 * math.pi * (u - 0.47))))
        P.rot("chest", rx=10 * flex, rz=-2 * wave(u, 1, 0.5))
        P.rot("pelvis", rx=-14 * flex)
        P.rot("neck", rx=-8 - 4 * flex + 3 * wave(u, 1, 0.1), rz=1.5 * wave(u, 1))
        P.rot("head", rx=4 + 6 * wave(u, 1, 0.05))
        P.rot("jaw", rx=14 + 4 * wave(u, 2))
        for i, n in enumerate(("tail1", "tail2", "tail3")):
            P.rot(n, rx=14 - 3 * i + 8 * wave(u, 1, 0.15 + 0.1 * i))
        for k, lg in legs.items():
            lg.step(P, u - g['phases'][k], g)
        return P

    # ---- Attack: se agacha, salta con las manos adelante y muerde al 45%; vuelve a la guardia
    A_T = 27 / FPS
    bite = 0.40

    def attack(t, u):
        P = rig.pose()
        k = lambda pts: keys_at(t, pts)
        by = k([(0, 0), (0.20, 0.09), (0.34, -0.20), (bite, -0.24), (0.62, -0.20), (0.86, 0)])
        bz = k([(0, 0), (0.20, -0.09), (0.34, 0.04), (bite, -0.01), (0.62, -0.03), (0.86, 0)])
        brx = k([(0, 0), (0.20, 3), (0.34, -5), (bite, 3), (0.62, 2), (0.86, 0)])
        P.rot("body", rx=brx, loc=(0, by, bz))
        P.rot("chest", rx=k([(0, 0), (0.20, 4), (0.34, -4), (bite, 3), (0.86, 0)]))
        P.rot("pelvis", rx=k([(0, 0), (0.20, -6), (0.34, 4), (bite, 0), (0.86, 0)]))
        shake = 12 * math.sin(2 * math.pi * (t - bite) / 0.16) * ramp(t, bite, bite + 0.04) * (1 - ramp(t, 0.58, 0.68))
        P.rot("neck", rx=k([(0, 0), (0.20, 16), (0.34, -2), (bite, 8), (0.62, 4), (0.86, 0)]), rz=shake * 0.6)
        P.rot("head", rx=k([(0, 0), (0.20, -14), (0.34, 0), (bite, 14), (0.62, 6), (0.86, 0)]), rz=shake, ry=-shake * 0.5)
        P.rot("jaw", rx=k([(0, 0), (0.20, 14), (0.33, 45), (bite - 0.025, 42), (bite, 0), (0.86, 0)]))
        for i, n in enumerate(("tail1", "tail2", "tail3")):
            P.rot(n, rx=k([(0, 0), (0.20, -8), (0.36, 18 - 4 * i), (0.62, 8), (0.86, 0)]))
        for key, lg in legs.items():
            if lg.front:
                d = 0.02 if key == "FL" else 0.0
                fy = k([(0, 0), (0.22 + d, 0), (bite + d, -0.30), (0.60 + d, -0.30), (0.82, 0)])
                fz = k([(0.22 + d, 0), (0.31 + d, 0.22), (bite + d, 0)])
                if t > 0.60 + d:
                    fz = 0.07 * math.sin(math.pi * min(1.0, (t - 0.60 - d) / (0.82 - 0.60 - d)))
                heel = k([(0.22, 0), (0.30, 30), (bite, 0)])
                lg.stand(P, dy=fy, dz=fz, heel=heel)
            else:
                lg.stand(P, heel=k([(0, 0), (0.20, 0), (0.36, 22), (0.62, 15), (0.86, 0)]))
        return P

    # ---- Hard Landing: respingo, se le aflojan las patas y cae sobre el costado derecho
    def death(t, u):
        P = rig.pose()
        k = lambda pts: keys_at(t, pts)
        fall = [(0, 0), (0.10, 0), (0.42, 1)]
        f = k(fall)
        roll = k([(0, 0), (0.10, 0), (0.40, -86), (0.44, -82), (0.48, -84)])
        P.rot("body", rx=k([(0, 0), (0.08, -7), (0.30, 4), (0.44, 0)]), ry=roll,
              loc=(k([(0, 0), (0.10, 0), (0.40, -0.33)]), k([(0, 0), (0.08, 0.04), (0.40, 0.06)]),
                   k([(0, 0), (0.08, 0.03), (0.20, -0.12), (0.40, -0.55), (0.44, -0.525), (0.48, -0.54)])))
        P.rot("chest", rx=k([(0, 0), (0.44, -4)]), rz=k([(0, 0), (0.44, -6)]))
        P.rot("pelvis", rz=k([(0, 0), (0.44, 5)]))
        P.rot("neck", rx=k([(0, 0), (0.08, -22), (0.30, -10), (0.44, 6)]),
              rz=k([(0, 0), (0.30, -6), (0.42, -14), (0.48, -12)]))
        P.rot("head", rx=k([(0, 0), (0.08, -6), (0.44, 8)]), rz=k([(0, 0), (0.44, -6)]))
        P.rot("jaw", rx=k([(0, 0), (0.06, 30), (0.30, 18), (0.44, 12)]))
        for i, n in enumerate(("tail1", "tail2", "tail3")):
            P.rot(n, rx=k([(0, 0), (0.10, 10), (0.44, -18)]), rz=k([(0, 0), (0.42, 10 + 5 * i), (0.48, 8 + 5 * i)]))
        for side, s in (("_L", 1), ("_R", -1)):
            top = side == "_L"            # las de la izquierda quedan arriba
            droop = 22 if top else -4
            P.rot("fleg1" + side, rx=k([(0, 0), (0.12, -12), (0.44, -24 if top else -32)]), ry=f * droop)
            P.rot("fleg2" + side, rx=k([(0, 0), (0.12, 14), (0.44, 10 if top else 28)]))
            P.rot("fleg3" + side, rx=k([(0, 0), (0.12, -20), (0.44, -30)]))
            P.rot("fpaw" + side, rx=k([(0, 0), (0.44, -20)]))
            P.rot("hleg1" + side, rx=k([(0, 0), (0.12, 14), (0.44, 26 if top else 8)]), ry=f * droop)
            P.rot("hleg2" + side, rx=k([(0, 0), (0.12, -18), (0.44, -18 if top else -6)]))
            P.rot("hleg3" + side, rx=k([(0, 0), (0.12, 16), (0.44, 26)]))
            P.rot("hpaw" + side, rx=k([(0, 0), (0.44, 20)]))
        return P

    bake(rig, "Idle", 60, idle)
    bake(rig, "Walking", round(walk['T'] * FPS), walking)
    bake(rig, "Running", round(gallop['T'] * FPS), running)
    bake(rig, "Attack", 27, attack)
    bake(rig, "Hard Landing", 45, death)
    return walk, gallop


def build_beast(atlas_img):
    arm = make_armature(bone_list())
    mesh = build_mesh(arm, atlas_material(atlas_img))
    H = mesh_stats(mesh)[2].z
    rig = Rig(arm, movable=("body",))
    make_actions(rig, H)
    return arm, mesh


PREVIEW_FRAMES = [("Idle", 0), ("Idle", 30), ("Walking", 0), ("Walking", 7), ("Running", 0), ("Running", 4),
                  ("Running", 8), ("Attack", 6), ("Attack", 11), ("Attack", 12), ("Hard Landing", 8), ("Hard Landing", 44)]

if __name__ == "__main__":
    run(build_beast)
