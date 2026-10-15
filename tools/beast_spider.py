"""Araña gigante de mazmorra: cefalotórax con un racimo de ojos rojos, quelíceros con colmillos, un
abdomen redondo con rombos rojos en el lomo (y un reloj de arena en la panza) y ocho patas de tres
tramos con las rodillas bien arriba del cuerpo.

Se arma entero acá con synty_kit (anillos de pocos lados con algo de ruido y colores de la paleta del
atlas) sobre un esqueleto propio de 28 huesos (beast_rig.make_armature): body (raíz, el cefalotórax),
abdomen, fang_L/R y legL1_1..legR4_3 (fémur, tibia y tarso de cada pata; 1 la de adelante, _L en +x).
Mira a -Y, pisa en z = 0, ~1.1 m a las rodillas y ~2.5 m de punta a punta de las patas.

Las acciones se arman cuadro por cuadro (beast_rig.Pose) con IK de dos huesos para fémur y tibia (la
rodilla siempre arriba) y el tarso bajando casi derecho al piso desde el tobillo:
- Idle: respira, mueve los colmillos y tantea el piso con las patas de adelante (2 s, loop).
- Walking / Running: trípode alterno de a cuatro (L1 R2 L3 R4 contra R1 L2 R3 L4); el pie apoyado se
  desliza para atrás a 1.5·H/1.8 o 4·H/1.8 m/s (H = alto de la malla), la velocidad del juego.
- Attack: se para de manos con las patas de adelante arriba, abre los colmillos y clava al 45%.
- Hard Landing (la muerte): un respingo y se da vuelta panza arriba con las patas enroscadas; quieta
  desde el 32%.

uso: blender -b --python tools/beast_spider.py -- public/models/spider.glb
"""
import bpy, math, os, random, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from synty_kit import *
from beast_rig import *

NAME = "Character_Spider"
X = (1, 0, 0)
UP = Vector((0, 0, 1))

C = dict(top='umber:3', side='umber:2', belly='maroon:3', low='umber:3', stripe='maroon:1',
         abd_top='maroon:2', abd_side='umber:3', abd_low='maroon:3',
         mark='red', leg='umber:2', leg_dark='umber:3', band='brick:2', tip='black',
         chel='maroon:1', fang='stone:0', eye='red', palp='umber:2')

# cefalotórax a lo largo de y: y, z del centro, medio ancho, alto arriba, alto abajo
CEPH = [(-0.43, 0.52, 0.09, 0.07, 0.07), (-0.37, 0.53, 0.165, 0.125, 0.10), (-0.27, 0.54, 0.21, 0.14, 0.12),
        (-0.13, 0.535, 0.235, 0.13, 0.13), (0.01, 0.52, 0.215, 0.11, 0.12), (0.11, 0.51, 0.15, 0.085, 0.09),
        (0.17, 0.51, 0.07, 0.05, 0.05)]
# abdomen: de la cintura (A) a la punta (B); fracción, medio ancho, alto arriba, alto abajo
ABD_A, ABD_B = Vector((0, 0.14, 0.56)), Vector((0, 1.10, 0.74))
ABDO = [(0.0, 0.08, 0.07, 0.07), (0.07, 0.24, 0.19, 0.17), (0.2, 0.34, 0.28, 0.25), (0.37, 0.38, 0.32, 0.28),
        (0.55, 0.37, 0.31, 0.27), (0.72, 0.31, 0.26, 0.22), (0.87, 0.2, 0.17, 0.14), (0.97, 0.08, 0.07, 0.06)]
NC, NA = 8, 10        # lados del cefalotórax y del abdomen

# patas (lado izquierdo): cadera en el borde del cefalotórax, rumbo desde adelante hacia +x, alcance
# horizontal de la cadera al pie, largos de fémur, tibia y tarso
LEGS = [((0.20, -0.27, 0.50), 32, 1.14, (0.74, 0.80, 0.42)),
        ((0.23, -0.15, 0.50), 72, 1.08, (0.68, 0.76, 0.38)),
        ((0.22, -0.03, 0.50), 112, 1.05, (0.66, 0.74, 0.37)),
        ((0.17, 0.08, 0.50), 148, 1.14, (0.74, 0.80, 0.42))]
GAMMA = math.radians(20)     # el tarso baja hacia afuera, 20° de la vertical


def flat(v):
    v = Vector((v.x, v.y, 0))
    return v.normalized() if v.length > 1e-6 else Vector((0, -1, 0))


def leg_points(hip, foot, lens, gamma, pole_out=0.35):
    """Cadera, rodilla, tobillo y pie de una pata con el pie en `foot` (IK con la rodilla arriba)."""
    l1, l2, l3 = lens
    out = flat(foot - hip)
    ank = foot - out * (l3 * math.sin(gamma)) + UP * (l3 * math.cos(gamma))
    knee, ank = two_bone(hip, ank, l1, l2, UP + out * pole_out)
    return hip, knee, ank, foot, out


def rest_legs():
    """Las 8 patas en reposo: {(lado, i): (cadera, rodilla, tobillo, pie, afuera)}."""
    out = {}
    for i, (hip, yaw, reach, lens) in enumerate(LEGS, 1):
        for side, s in (("L", 1), ("R", -1)):
            h = Vector((hip[0] * s, hip[1], hip[2]))
            a = math.radians(yaw)
            foot = h + Vector((s * math.sin(a), -math.cos(a), 0)) * reach
            foot.z = 0.0
            out[(side, i)] = leg_points(h, foot, lens, GAMMA)
    return out


def bone_list():
    out = [("body", (0, -0.05, 0.50), (0, -0.40, 0.50), None, X),
           ("abdomen", tuple(ABD_A), (0, 1.0, 0.72), "body", X)]
    for side, s in (("L", 1), ("R", -1)):
        out.append((f"fang_{side}", (0.065 * s, -0.36, 0.47), (0.06 * s, -0.43, 0.30), "body", X))
    for (side, i), (hip, knee, ank, foot, o) in rest_legs().items():
        xh = UP.cross(o)
        n = f"leg{side}{i}"
        out += [(n + "_1", hip, knee, "body", xh), (n + "_2", knee, ank, n + "_1", xh), (n + "_3", ank, foot, n + "_2", xh)]
    return out


# ------------------------------------------------------------ malla

def ceph_at(y):
    for a, b in zip(CEPH, CEPH[1:]):
        if a[0] <= y <= b[0]:
            x = (y - a[0]) / (b[0] - a[0])
            return [lerp(p, q, x) for p, q in zip(a, b)]
    raise ValueError(y)


def ceph_surface(y, deg):
    """Punto del cefalotórax a la altura y, a `deg` grados del lomo hacia +x, y la normal aproximada."""
    _, zc, w, top, bot = ceph_at(y)
    a = math.radians(deg)
    sa, ca = math.sin(a), math.cos(a)
    h = top if ca > 0 else bot
    p = Vector((w * math.copysign(abs(sa) ** 0.8, sa), y, zc + math.copysign(h * abs(ca) ** 0.8, ca)))
    return p, Vector((sa / w, 0, ca / h)).normalized()


def cephalothorax(part, rnd):
    W = {"body": 1}
    rings = [part.ring(section((0, y, zc), (0, -1, 0), (0, 0, 1), w, top, bot, NC, rnd, 0.006), W)
             for y, zc, w, top, bot in CEPH]
    for i in range(len(rings) - 1):
        keys = band_keys(NC, C['top'], C['side'], C['belly'], C['low'])
        if 1 <= i <= 4:
            keys[0] = keys[NC - 1] = C['stripe']        # raya del medio, oscura
        part.bridge(rings[i + 1], rings[i], keys)
    part.cap(rings[0], C['low'], Vector((0, -0.45, 0.52)), W)
    part.cap(rings[-1], C['belly'], Vector((0, 0.19, 0.51)), W)


def abdomen(part, rnd):
    ax = (ABD_B - ABD_A).normalized()
    rings = []
    for k, (t, w, top, bot) in enumerate(ABDO):
        c = ABD_A.lerp(ABD_B, t)
        wt = {"abdomen": 0.6, "body": 0.4} if k == 0 else {"abdomen": 1}
        jit = 0.012 if 0 < k < len(ABDO) - 1 else 0.004
        rings.append(part.ring(section(c, ax, (0, 0, 1), w, top, bot, NA, rnd, jit), wt))
    for k in range(len(rings) - 1):
        keys = band_keys(NA, C['abd_top'], C['abd_side'], C['belly'], C['abd_low'])
        part.bridge(rings[k], rings[k + 1], keys)
    part.cap(rings[0], C['belly'])
    part.cap(rings[-1], C['low'], ABD_A.lerp(ABD_B, 1.02), {"abdomen": 1})
    # dibujo: tres rombos rojos en el lomo y el reloj de arena en la panza (se ve
    # cuando se muere panza arriba); placas finitas apenas levantadas sobre la piel
    for t, dt, half in ((0.27, 0.085, 34), (0.48, 0.075, 28), (0.66, 0.06, 21)):
        decal(part, [(t - dt, 0), (t, half), (t + dt, 0), (t, -half)], C['mark'])
    decal(part, [(0.30, 156), (0.47, 180), (0.30, 204)], C['mark'])
    decal(part, [(0.47, 180), (0.64, 156), (0.64, 204)], C['mark'])
    # hilanderas: dos conitos atrás, abajo
    for s in (1, -1):
        c = ABD_A.lerp(ABD_B, 0.93) + Vector((s * 0.035, 0, -0.07))
        base = [c + Vector((0.02, 0, 0.02)), c + Vector((-0.02, 0, 0.02)), c + Vector((0, -0.03, -0.01))]
        shard(part, [tuple(b) for b in base], tuple(c + Vector((s * 0.01, 0.08, -0.02))), C['low'], {"abdomen": 1})


def abd_point(t, deg):
    """Punto de la piel del abdomen a la fracción t del largo y `deg` grados del lomo hacia +x, y su
    dirección hacia afuera."""
    for a, b in zip(ABDO, ABDO[1:]):
        if a[0] <= t <= b[0]:
            x = (t - a[0]) / (b[0] - a[0])
            w, top, bot = (lerp(p, q, x) for p, q in zip(a[1:], b[1:]))
            break
    c = ABD_A.lerp(ABD_B, t)
    ax = (ABD_B - ABD_A).normalized()
    u = (UP - ax * UP.dot(ax)).normalized()
    s = Vector((1, 0, 0))
    r = math.radians(deg)
    sa, ca = math.sin(r), math.cos(r)
    h = top if ca > 0 else bot
    p = c + s * (w * math.copysign(abs(sa) ** 0.8, sa)) + u * math.copysign(h * abs(ca) ** 0.8, ca)
    return p, (p - c).normalized()


def decal(part, outline, key, lift=0.02):
    """Placa de color sobre el abdomen: contorno de (t, grados), un poco levantada y con espesor."""
    pts = [abd_point(t, d) for t, d in outline]
    W = {"abdomen": 1}
    top = part.ring([tuple(p + n * lift) for p, n in pts], W)
    bot = part.ring([tuple(p - n * 0.01) for p, n in pts], W)
    part.bridge(bot, top, key)
    # tapa con un punto en el medio: un cuadrilátero sobre la panza curva se doblaba y se hundía
    c, n = abd_point(sum(t for t, _ in outline) / len(outline), sum(d for _, d in outline) / len(outline))
    part.cap(top, key, c + n * lift, W)
    part.cap(bot, key)


def eyes(part):
    W = {"body": 1}
    # (y, grados desde el lomo, tamaño): medios grandes al frente, laterales, y dos arriba
    for y, deg, size in ((-0.40, 24, 0.045), (-0.38, 56, 0.032), (-0.325, 14, 0.036), (-0.30, 50, 0.03)):
        for s in (1, -1):
            p, n = ceph_surface(y, deg)
            p, n = Vector((s * p.x, p.y, p.z)), Vector((s * n.x, n.y, n.z))
            t1 = n.cross(Vector((0, 0, 1)))
            if t1.length < 1e-3:
                t1 = Vector((1, 0, 0))
            t1.normalize()
            t2 = n.cross(t1).normalized()
            base = [p + (t1 * math.cos(a) + t2 * math.sin(a)) * size - n * 0.01 for a in (0.3, 2.4, 4.4)]
            shard(part, [tuple(b) for b in base], tuple(p + n * size * 0.8), C['eye'], W)


def jaws(part, rnd):
    """Quelíceros gruesos con el colmillo curvo para adentro, y los pedipalpos a los costados."""
    for side, s in (("L", 1), ("R", -1)):
        W = {f"fang_{side}": 1}
        pts = [(0.06 * s, -0.33, 0.50), (0.07 * s, -0.40, 0.43), (0.064 * s, -0.435, 0.34)]
        rings = tube(part, pts, [0.06, 0.056, 0.042], 6, [{"body": 0.5, f"fang_{side}": 0.5}, W, W], C['chel'],
                     rnd, 0.004, up=(0, -1, 0))
        part.cap(rings[0], C['chel'])
        f = tube(part, [(0.064 * s, -0.435, 0.34), (0.05 * s, -0.45, 0.28), (0.028 * s, -0.43, 0.235)],
                 [0.026, 0.018, 0.008], 5, W, C['fang'], rnd, 0.0, up=(0, -1, 0))
        part.cap(f[0], C['fang'])
        part.cap(f[-1], C['fang'], Vector((0.016 * s, -0.415, 0.22)), W)
        # pedipalpo: patita corta adelante, se mueve con el quelícero de su lado
        pts = [(0.12 * s, -0.33, 0.47), (0.17 * s, -0.45, 0.42), (0.18 * s, -0.53, 0.32), (0.16 * s, -0.57, 0.24)]
        p = tube(part, pts, [0.03, 0.03, 0.026, 0.014], 5, [{"body": 1}, {"body": 0.5, f"fang_{side}": 0.5}, W, W],
                 [C['palp'], C['band'], C['leg_dark']], rnd, 0.003, up=(0, -1, 0))
        part.cap(p[0], C['palp'])
        part.cap(p[-1], C['tip'], Vector((0.15 * s, -0.585, 0.21)), W)


def legs(part, rnd):
    for (side, i), (hip, knee, ank, foot, o) in rest_legs().items():
        n = [f"leg{side}{i}_{k}" for k in (1, 2, 3)]
        tang = UP.cross(o)

        def along(a, b, d):
            return a + (b - a).normalized() * d
        pts = [hip - o * 0.09, hip, along(knee, hip, 0.07), knee, along(knee, ank, 0.07),
               along(ank, knee, 0.06), ank, along(ank, foot, 0.06), along(foot, ank, 0.03)]
        r = [0.075, 0.078, 0.064, 0.07, 0.06, 0.046, 0.05, 0.04, 0.013]
        b1, b2, b3 = n
        w = [{"body": 0.5, b1: 0.5}, {b1: 0.85, "body": 0.15}, {b1: 1}, {b1: 0.5, b2: 0.5}, {b2: 1},
             {b2: 1}, {b2: 0.5, b3: 0.5}, {b3: 1}, {b3: 1}]
        k = [C['leg'], C['leg'], C['band'], C['band'], C['leg'], C['band'], C['band'], C['leg_dark']]
        rings = tube(part, pts, r, 5, w, k, rnd, 0.005, up=tang)
        part.cap(rings[0], C['leg'])
        part.cap(rings[-1], C['tip'], foot, {b3: 1})
        # un pelo duro arriba del fémur y otro de la tibia
        for a, b, wt in ((hip, knee, {b1: 1}), (knee, ank, {b2: 1})):
            c = a.lerp(b, 0.5)
            d = (b - a).normalized()
            ny = tang.cross(d).normalized()
            if ny.z < 0:
                ny = -ny
            base = [c + tang * 0.025, c - tang * 0.025, c + d * 0.04]
            shard(part, [tuple(x + ny * 0.03) for x in base], tuple(c + ny * 0.11 - d * 0.05), C['leg_dark'], wt)


def build_mesh(arm, mat, seed=5):
    rnd = random.Random(seed)
    part = Part()
    cephalothorax(part, rnd)
    abdomen(part, rnd)
    eyes(part)
    jaws(part, rnd)
    legs(part, rnd)
    mesh = part.to_object(NAME, mat)
    bind(mesh, arm)
    return mesh


# ------------------------------------------------------------ animación

class SpiderLeg:
    def __init__(self, rig, side, i, pts):
        self.side, self.i = side, i
        self.names = [f"leg{side}{i}_{k}" for k in (1, 2, 3)]
        self.lens = tuple(rig.length[n] for n in self.names)
        self.foot = pts[3].copy()
        self.out0 = pts[4].copy()
        self.group = 0 if (side == "L") == (i % 2 == 1) else 1     # L1 R2 L3 R4 / R1 L2 R3 L4

    def ik(self, P, foot, gamma=GAMMA):
        """Rodilla, tobillo y pie con el pie en `foot` (IK, rodilla arriba), y el eje x de los huesos."""
        _, knee, ank, foot, out = leg_points(P.head(self.names[0]), Vector(foot), self.lens, gamma)
        return [knee, ank, foot], UP.cross(out)

    def fk(self, P, a1, a2, a3, yaw=0.0):
        """Lo mismo por ángulos en el plano de la pata (grados desde la horizontal hacia afuera, + para
        arriba), en los ejes del cuerpo: para pararse de manos y para la muerte, cuando da la vuelta."""
        Rb = P.M["body"].to_3x3() @ P.rig.rest3["body"].inverted()
        o = self.out0.copy()
        if yaw:
            o.rotate(Matrix.Rotation(math.radians(yaw if self.side == "L" else -yaw), 3, 'Z'))
        o, up = Rb @ o, Rb @ UP
        p, pts = P.head(self.names[0]), []
        for a, ln in zip((a1, a2, a3), self.lens):
            r = math.radians(a)
            p = p + (o * math.cos(r) + up * math.sin(r)) * ln
            pts.append(p)
        return pts, up.cross(o)

    def place(self, P, pts, xh):
        for n, p in zip(self.names, pts):
            P.aim(n, p, xh)

    def blend(self, P, a, b, w):
        """Mezcla dos juegos de puntos (ik/fk) y apunta la pata."""
        if w <= 0:
            return self.place(P, *a)
        if w >= 1:
            return self.place(P, *b)
        self.place(P, [p.lerp(q, w) for p, q in zip(a[0], b[0])], a[1].lerp(b[1], w))

    def solve(self, P, foot, gamma=GAMMA):
        self.place(P, *self.ik(P, foot, gamma))

    def stand(self, P, d=(0, 0, 0), gamma=GAMMA):
        self.solve(P, self.foot + Vector(d), gamma)

    def step(self, P, ph, g):
        """La pata en el ciclo del paso: ph 0 = apoya adelante, se desliza atrás y vuelve por el aire."""
        duty, sweep, lift = g['duty'], g['sweep'], g['lift']
        ph %= 1.0
        if ph < duty:
            s = ph / duty
            foot = self.foot + Vector((0, -sweep / 2 + sweep * s, 0))
            gamma = GAMMA
        else:
            s = (ph - duty) / (1 - duty)
            e = smooth(s)
            arc = math.sin(math.pi * s)
            foot = self.foot + Vector((0, sweep / 2 - sweep * e, lift * arc))
            foot += self.out0 * (-0.06 * arc)        # se recoge un poco al levantarla
            gamma = GAMMA + math.radians(20) * arc
        self.solve(P, foot, gamma)


def make_actions(rig, H):
    RL = rest_legs()
    legs = [SpiderLeg(rig, side, i, pts) for (side, i), pts in RL.items()]

    def plane_ang(a, b, o):
        d = b - a
        return math.degrees(math.atan2(d.z, Vector((d.x, d.y, 0)).dot(o)))
    rest_ang = {key: (plane_ang(h, kn, o), plane_ang(kn, an, o), plane_ang(an, ft, o))
                for key, (h, kn, an, ft, o) in RL.items()}

    def jaw(P, open_, strike=0.0):
        for side, s in (("L", 1), ("R", -1)):
            P.rot(f"fang_{side}", rx=-0.6 * open_ + strike, ry=-s * 0.7 * open_)

    # ---- Idle: respira, mastica y tantea con las de adelante
    def idle(t, u):
        P = rig.pose()
        br = wave(u, 2)
        P.rot("body", rx=0.8 * wave(u, 1, 0.2), rz=2.0 * wave(u, 1), loc=(0, 0, 0.008 * br))
        P.rot("abdomen", rx=-1.5 * br, rz=-2.5 * wave(u, 1, 0.1))
        jaw(P, 14 + 10 * wave(u, 4))
        for lg in legs:
            if lg.i == 1:
                ph = (u - (0.15 if lg.side == "L" else 0.6)) % 1.0
                s = min(1.0, ph / 0.3)
                arc = math.sin(math.pi * s) if ph < 0.3 else 0.0
                lg.stand(P, d=(0, -0.08 * arc, 0.16 * arc), gamma=GAMMA + math.radians(25) * arc)
            else:
                lg.stand(P)
        return P

    walk = dict(T=24 / FPS, duty=0.55, lift=0.17, speed=1.5 * H / 1.8, bob=0.015, crouch=0.0)
    scuttle = dict(T=12 / FPS, duty=0.5, lift=0.2, speed=4.0 * H / 1.8, bob=0.025, crouch=-0.06)
    for g in (walk, scuttle):
        g['sweep'] = g['speed'] * g['duty'] * g['T']

    def gait(g, sway):
        def f(t, u):
            P = rig.pose()
            P.rot("body", rx=-1.0 + 1.2 * wave(u, 2, 0.1), ry=sway * wave(u, 1, 0.1), rz=sway * 0.8 * wave(u, 1, 0.3),
                  loc=(0, 0, g['crouch'] + g['bob'] * math.cos(4 * math.pi * u)))
            P.rot("abdomen", rx=-2.5 * wave(u, 2, 0.3), rz=-sway * 1.6 * wave(u, 1, 0.25))
            jaw(P, 10 + 6 * wave(u, 2))
            for lg in legs:
                lg.step(P, u - 0.5 * lg.group - 0.02 * (4 - lg.i), g)
            return P
        return f

    # ---- Attack: se para de manos, abre los colmillos y clava al 45% (0.40 s)
    bite = 0.40

    def attack(t, u):
        P = rig.pose()
        k = lambda pts: keys_at(t, pts)
        rx = k([(0, 0), (0.24, -30), (0.31, -32), (bite, 10), (0.56, 8), (0.84, 0)])
        P.rot("body", rx=rx, pivot=(0, 0.20, 0.50),
              loc=(0, k([(0, 0), (0.24, 0.08), (0.31, 0.08), (bite, -0.18), (0.56, -0.16), (0.84, 0)]),
                   k([(0, 0), (0.24, 0.08), (0.31, 0.09), (bite, -0.08), (0.56, -0.06), (0.84, 0)])))
        P.rot("abdomen", rx=-0.8 * rx + k([(0, 0), (0.24, 8), (bite, -4), (0.84, 0)]))
        jaw(P, k([(0, 10), (0.24, 45), (bite - 0.03, 50), (bite, -5), (0.56, 0), (0.84, 10)]),
            strike=k([(0, 0), (bite - 0.03, 0), (bite, 32), (0.56, 22), (0.84, 0)]))
        for lg in legs:
            if lg.i in (1, 2):
                # arriba y abiertas (por ángulos), después golpean el piso adelante y vuelven a su lugar
                big = lg.i == 1
                w = k([(0, 0), (0.22, 1), (0.31, 1), (bite, 0)]) * (1.0 if big else 0.45)
                dy = k([(0, 0), (bite, -0.30 if big else -0.12), (0.58, -0.30 if big else -0.12), (0.82, 0)])
                dz = 0.08 * math.sin(math.pi * (t - 0.58) / 0.24) if 0.58 < t < 0.82 else 0.0
                raised = lg.fk(P, 62, 30, -12, yaw=-25) if big else lg.fk(P, 45, -5, -55)
                lg.blend(P, lg.ik(P, lg.foot + Vector((0, dy, dz))), raised, w)
            else:
                lg.stand(P)
        return P

    # ---- Hard Landing: respingo y vuelta panza arriba con las patas enroscadas; quieta desde 0.48 s
    # fémur hacia la panza, tibia doblada de vuelta como una navaja y el tarso hacia adentro
    curl = {1: (-40, -195, -295), 2: (-50, -198, -300), 3: (-50, -198, -300), 4: (-45, -195, -295)}
    rj = random.Random(3)
    jit = {(lg.side, lg.i): (rj.uniform(-14, 14), rj.uniform(-18, 18), rj.uniform(-20, 20)) for lg in legs}

    def death(t, u):
        P = rig.pose()
        k = lambda pts: keys_at(t, pts)
        roll = k([(0, 0), (0.08, -6), (0.38, 180), (0.44, 172), (0.48, 176)])
        P.rot("body", ry=roll, rx=k([(0, 0), (0.08, -8), (0.38, 4), (0.48, 0)]),
              loc=(k([(0, 0), (0.38, 0.12)]), k([(0, 0), (0.38, 0.05)]),
                   k([(0, 0), (0.08, 0.12), (0.22, 0.28), (0.38, -0.01), (0.44, 0.04), (0.48, 0.014)])))
        P.rot("abdomen", rx=k([(0, 0), (0.1, -10), (0.38, 6), (0.48, 4)]), rz=k([(0, 0), (0.44, 5)]))
        jaw(P, k([(0, 10), (0.06, 50), (0.3, 30), (0.48, 20)]))
        f = k([(0, 0), (0.06, 0), (0.40, 1)])
        spasm = k([(0, 0), (0.05, 1), (0.14, 0)])
        for lg in legs:
            # de la pose de reposo (sus ángulos en el plano de la pata) a la enroscada
            a0 = rest_ang[(lg.side, lg.i)]
            c = [x + dx for x, dx in zip(curl[lg.i], jit[(lg.side, lg.i)])]
            a = [lerp(a0[j] - 12 * spasm * (j == 0), c[j], f) for j in range(3)]
            lg.place(P, *lg.fk(P, *a))
        return P

    bake(rig, "Idle", 60, idle)
    bake(rig, "Walking", round(walk['T'] * FPS), gait(walk, 2.0))
    bake(rig, "Running", round(scuttle['T'] * FPS), gait(scuttle, 3.0))
    bake(rig, "Attack", 27, attack)
    bake(rig, "Hard Landing", 45, death)
    return walk, scuttle


def build_beast(atlas_img):
    arm = make_armature(bone_list())
    mesh = build_mesh(arm, atlas_material(atlas_img))
    H = mesh_stats(mesh)[2].z
    make_actions(Rig(arm), H)
    return arm, mesh


PREVIEW_FRAMES = [("Idle", 0), ("Idle", 15), ("Walking", 0), ("Walking", 6), ("Running", 0), ("Running", 3),
                  ("Attack", 8), ("Attack", 12), ("Attack", 18),
                  ("Hard Landing", 6), ("Hard Landing", 10), ("Hard Landing", 44)]

if __name__ == "__main__":
    run(build_beast)
