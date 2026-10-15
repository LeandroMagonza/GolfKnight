"""Piezas comunes de los monstruos humanoides de la horda (monster_ogre.py, monster_minotaur.py,
monster_lizardman.py), armados con synty_kit sobre el esqueleto de 49 huesos de PolygonDungeon.

Los cuerpos son mucho más anchos que los del pack, así que no se copian pesos de otra malla: cada pieza
(torso, brazos, piernas, cabeza, dedos) es una superficie cerrada de anillos y sus pesos se reparten a lo
largo de su hueso con `ramp` (tramos rígidos y transiciones suaves en codos, rodillas y tobillos). Las
piezas se cruzan entre sí en vez de coserse, como en los personajes de Synty: el brazo nace adentro del
torso y la pierna adentro de la cadera, así al girar no se abre ningún agujero.

Como los personajes del pack: caras grandes y planas (anillos de 8 a 16 lados con un poco de ruido para
que el facetado salga cincelado), regiones de un solo color de la paleta y el detalle en piezas sueltas
(correas, vendas, remaches, placas, mechones, dedos):
- las filas de control de torsos y miembros se pueden interpolar con Catmull-Rom (`smooth_rows`);
- los músculos, huesos y pliegues son `bumps`: bultos gaussianos en coordenadas de mundo que empujan la
  superficie a lo largo de su normal (un pectoral, una rótula, el pliegue de la panza);
- `shade` (apagado por defecto, `paint=True` en `finish`) pinta tonos vecinos de la paleta según hacia
  dónde mira cada cara; SMOOTH_ANGLE suaviza el sombreado entre caras casi planas (None: todo facetado).

Truco de los hombros: la articulación del hombro está a 19 cm del centro, y en un cuerpo de 80 cm de
ancho el brazo caído quedaría metido en la panza. Por eso el tubo del brazo se corre hacia arriba en la
pose T (LIFT en cada monstruo): al bajar el brazo, ese corrimiento queda hacia afuera, y al doblar el
codo (que gira alrededor de un eje vertical en la pose T) no cambia nada.
"""
import bpy, math
from mathutils import Vector, Matrix
from synty_kit import *

LIKE = "Character_Goblin_Male"     # malla del pack de la que salen los nombres de las UV y el material
# los huesos del pack (cuernos del jefe goblin, garrotes de hueso) son cuadritos del atlas fuera de la
# franja de la paleta: del más claro al más oscuro
BONE_HI, BONE, BONE_MID, BONE_LO = (38, 636), (262, 636), (262, 660), (240, 636)
BONES = [BONE_HI, BONE, BONE_MID, BONE_LO]
# hacia dónde apunta el arma en la pose T (mundo) desde el puño derecho, medido sobre los clips de Mixamo:
# adelante y abajo al caminar, adelante y afuera en Idle, arriba y atrás en el golpe del juego
GRIP_DIR = (-0.8, -0.6, 0.1)
JITTER = 1.7          # escala del ruido de los vértices (el facetado cincelado del pack)
SMOOTH_ANGLE = None   # facetado plano como el pack; con un ángulo, sombreado suave entre caras más planas


# ------------------------------------------------------------ pesos

def mix(*ws):
    out = {}
    for w in ws:
        for g, v in w.items():
            out[g] = out.get(g, 0.0) + v
    return top4(out)


def ramp(s, stops):
    """Pesos a lo largo de un miembro: stops = [(s, hueso), ...] con s creciente. Entre dos paradas
    del mismo hueso es rígido; entre huesos distintos pasa de uno al otro con smoothstep."""
    if s <= stops[0][0]:
        return {stops[0][1]: 1.0}
    for (s0, b0), (s1, b1) in zip(stops, stops[1:]):
        if s <= s1:
            if b0 == b1:
                return {b0: 1.0}
            t = smoothstep(s0, s1, s)
            return mix({b0: 1.0 - t}, {b1: t})
    return {stops[-1][1]: 1.0}


def sd(name, side):
    return name + ("_L" if side > 0 else "_R")


def arm_weights(side, elbow=(0.46, 0.60), wrist=(0.76, 0.83)):
    """Brazo en pose T a lo largo de x: hombro rígido, codo y muñeca con transición."""
    stops = [(0.0, sd("Shoulder", side)), (elbow[0], sd("Shoulder", side)), (elbow[1], sd("Elbow", side)),
             (wrist[0], sd("Elbow", side)), (wrist[1], sd("Hand", side))]
    return lambda p: ramp(abs(p.x), stops)


def leg_weights(side, hip=(0.80, 0.95), knee=(0.38, 0.49), ankle=(0.075, 0.14)):
    """Pierna a lo largo de z: arriba se mezcla con la cadera para que el muslo no se salga por atrás."""
    stops = [(ankle[0], sd("Ankle", side)), (ankle[1], sd("LowerLeg", side)), (knee[0], sd("LowerLeg", side)),
             (knee[1], sd("UpperLeg", side)), (hip[0], sd("UpperLeg", side)), (hip[1], "Hips")]
    return lambda p: ramp(p.z, stops)


def foot_weights(side, ball=(-0.03, -0.09)):
    """Pie a lo largo de -y: el talón con el tobillo, los dedos con Ball (que Mixamo dobla)."""
    stops = [(-ball[0], sd("Ankle", side)), (-ball[1], sd("Ball", side))]
    return lambda p: ramp(-p.y, stops)


def spine_weights(head_z=None):
    """Torso a lo largo de z: cadera, las tres vértebras y el cuello; con `head_z`, la punta del cuello
    se va pasando a la cabeza hasta esa altura (para cuellos que suben a meterse en la nuca)."""
    stops = [(0.90, "Hips"), (1.04, "Spine_01"), (1.10, "Spine_01"), (1.24, "Spine_02"),
             (1.28, "Spine_02"), (1.40, "Spine_03"), (1.52, "Spine_03"), (1.62, "Neck")]
    if head_z:
        stops += [(head_z - 0.06, "Neck"), (head_z, "Head")]
    return lambda p: ramp(p.z, stops)


def lift_from(part, i0, off):
    """Corre en bloque los vértices agregados desde el índice i0 (una cabeza armada en su lugar de
    siempre y después levantada sobre el cuello)."""
    off = Vector(off)
    for i in range(i0, len(part.verts)):
        part.verts[i] = part.verts[i] + off


def flap_weights(side=0, k=0.5, z0=0.85, z1=0.5):
    """Paños que cuelgan de la cadera: abajo los tira la pierna de su lado (o las dos, si side = 0)."""
    def w(p):
        t = smoothstep(z0, z1, p.z) * k
        if side == 0:
            return mix({"Hips": 1.0 - t}, {"UpperLeg_L": t / 2, "UpperLeg_R": t / 2})
        return mix({"Hips": 1.0 - t}, {sd("UpperLeg", side): t})
    return w


# ------------------------------------------------------------ interpolación y bultos

def _cr(p0, p1, p2, p3, t):
    t2, t3 = t * t, t * t * t
    return 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (3 * p1 - p0 - 3 * p2 + p3) * t3)


def smooth_rows(ctrl, per):
    """Filas de control (tuplas de números) interpoladas con Catmull-Rom: `per` filas por tramo (un número
    o una lista por tramo). Pasa por todas las de control."""
    out = []
    m = len(ctrl)
    for i in range(m - 1):
        p0, p1, p2, p3 = ctrl[max(i - 1, 0)], ctrl[i], ctrl[i + 1], ctrl[min(i + 2, m - 1)]
        k = per[i] if isinstance(per, (list, tuple)) else per
        for s in range(k):
            out.append(tuple(_cr(a, b, c, d, s / k) for a, b, c, d in zip(p0, p1, p2, p3)))
    out.append(tuple(ctrl[-1]))
    return out


def mirrored(bumps):
    """Agrega la copia del otro lado (x negativa) de cada bulto que no está en el centro."""
    out = list(bumps)
    out += [(-b[0],) + tuple(b[1:]) for b in bumps if abs(b[0]) > 1e-6]
    return out


def bump_sum(p, bumps):
    """Bultos gaussianos (cx, cy, cz, rx, ry, rz, cuánto): cuánto empujar el punto p hacia afuera."""
    d = 0.0
    for cx, cy, cz, rx, ry, rz, amt in bumps:
        q = ((p.x - cx) / rx) ** 2 + ((p.y - cy) / ry) ** 2 + ((p.z - cz) / rz) ** 2
        if q < 9.0:
            d += amt * math.exp(-q)
    return d


# ------------------------------------------------------------ superficies

def _key(key, i, j, c):
    if callable(key):
        return key(c)
    if isinstance(key, list):
        k = key[i]
        if isinstance(k, list):
            return k[j]
        return k(c) if callable(k) else k
    return key


def _bridge(part, ra, rb, key, i):
    n = len(ra)
    for j in range(n):
        k = (j + 1) % n
        q = (ra[j], ra[k], rb[k], rb[j])
        c = sum((part.verts[v] for v in q), Vector()) / 4
        part.faces.append(q)
        part.keys.append(_key(key, i, j, c))


def _caps(part, rings, caps, tips, weights):
    for ring, key, tip in ((rings[0], caps[0], tips[0]), (rings[-1], caps[1], tips[1])):
        if key:
            part.cap(ring, key, Vector(tip) if tip is not None else None, weights if tip is not None else None)


def tube_keys(n, fn):
    """Color de cada cara de un anillo de `limb`/`tube` (con la fase por defecto), según su ángulo desde
    `up` en grados, sin signo: 0 = la cara del lado de `up`, 180 = la opuesta. Así sale simétrico."""
    return [fn(abs(((360.0 * (j + 1) / n + 180) % 360) - 180)) for j in range(n)]


def sym(n):
    """n ángulos (n par) alrededor del cuerpo con una cara centrada adelante (0 = -Y)."""
    step = 360.0 / n
    return sym_angles([step * (k + 0.5) for k in range(n // 2)])


def lathe(part, rows, n, key, weights, rnd=None, jitter=0.0, bumps=(), caps=(None, None), tips=(None, None)):
    """Torso o cabeza de anillos horizontales: rows = [(z, rx, ry, yc[, potencia])] (ya interpoladas),
    n lados por anillo, `bumps` en mundo empujando a lo largo de la normal. `key` es un color, una lista
    por tramo o una función del centro de la cara."""
    angles = sym(n)
    rings = []
    for r in rows:
        z, rx, ry, yc = r[:4]
        pw = r[4] if len(r) > 4 else 0.85
        pts = []
        for a in angles:
            s, c = math.sin(a), math.cos(a)
            ss, cc = math.copysign(abs(s) ** pw, s), math.copysign(abs(c) ** pw, c)
            p = Vector((rx * ss, yc - ry * cc, z))
            nrm = Vector((ss / rx, -cc / ry, 0.0)).normalized()
            p += nrm * bump_sum(p, bumps)
            if rnd and jitter:
                j = jitter * JITTER
                p += Vector((rnd.uniform(-j, j), rnd.uniform(-j, j), rnd.uniform(-j, j) * 0.5))
            pts.append(p)
        rings.append(part.ring(pts, weights))
    for i in range(len(rings) - 1):
        _bridge(part, rings[i], rings[i + 1], key, i)
    _caps(part, rings, caps, tips, weights)
    return rings


def limb(part, ctrl, per, n, key, weights, rnd=None, jitter=0.0, bumps=(), up=(0, 0, 1), caps=(None, None),
         tips=(None, None), floor=None, post=None):
    """Tubo por filas de control (x, y, z, radio_arriba, radio_costado), interpoladas con `per` anillos por
    tramo (0 = sin interpolar). Los bultos empujan en la dirección radial. `post(p)` retoca cada punto."""
    rows = smooth_rows(ctrl, per) if per else [tuple(r) for r in ctrl]
    centers = [Vector(r[:3]) for r in rows]
    m = len(rows)
    rings = []
    for i, r in enumerate(rows):
        c = centers[i]
        axis = (centers[min(i + 1, m - 1)] - centers[max(i - 1, 0)]).normalized()
        pts = []
        for q in ring_around(c, axis, r[3], r[4], n, None, 0.0, math.pi / n, up):
            q = Vector(q)
            d = q - c
            if d.length > 1e-9:
                q += d.normalized() * bump_sum(q, bumps)
            if rnd and jitter:
                j = jitter * JITTER
                q += Vector((rnd.uniform(-j, j), rnd.uniform(-j, j), rnd.uniform(-j, j)))
            if post:
                q = post(q)
            if floor is not None and q.z < floor:
                q.z = floor
            pts.append(q)
        rings.append(part.ring(pts, weights))
    for i in range(m - 1):
        _bridge(part, rings[i], rings[i + 1], key, i)
    _caps(part, rings, caps, tips, weights)
    return rings


def tube(part, path, radii, n, keys, weights, rnd=None, jitter=0.0, up=(0, 0, 1), caps=(None, None),
         tips=(None, None), floor=None):
    """Tubo simple por puntos con radios r o (r_arriba, r_costado), sin interpolar."""
    ctrl = [tuple(p) + ((r, r) if isinstance(r, (int, float)) else tuple(r)) for p, r in zip(path, radii)]
    return limb(part, ctrl, 0, n, keys, weights, rnd, jitter, (), up, caps, tips, floor)


def ball(part, c, r, n, m, key, weights, squash=(1.0, 1.0, 1.0)):
    """Esfera chata de n lados y m anillos (ojos, cuentas, verrugas)."""
    c = Vector(c)
    rings = []
    for i in range(1, m):
        t = math.pi * i / m
        pts = [c + Vector((r * math.sin(t) * math.sin(2 * math.pi * j / n) * squash[0],
                           -r * math.sin(t) * math.cos(2 * math.pi * j / n) * squash[1],
                           r * math.cos(t) * squash[2])) for j in range(n)]
        rings.append(part.ring(pts, weights))
    for i in range(len(rings) - 1):
        part.bridge(rings[i], rings[i + 1], key)
    part.cap(rings[0], key, c + Vector((0, 0, r * squash[2])), weights)
    part.cap(rings[-1], key, c - Vector((0, 0, r * squash[2])), weights)


def cone(part, base, tip, r, n, key, weights, up=(0, 0, 1), base_key=None):
    """Púa, colmillo, garra o diente: un anillo y una punta."""
    base, tip = Vector(base), Vector(tip)
    ring = part.ring(ring_around(base, tip - base, r, r, n, None, 0.0, math.pi / n, up), weights)
    part.cap(ring, key, tip, weights)
    part.cap(ring, base_key or key)
    return ring


def horn(part, path, radii, n, keys, weights, tip, up=(0, 0, 1), per=2, floor=None):
    """Cuerno, garra curva o colmillo largo: tubo interpolado que termina en punta."""
    ctrl = [tuple(p) + (r, r) for p, r in zip(path, radii)]
    k0, k1 = (keys[0], keys[-1]) if isinstance(keys, list) else (keys, keys)
    k0, k1 = (k[0] if isinstance(k, list) else k for k in (k0, k1))
    return limb(part, ctrl, per, n, keys, weights, up=up, caps=(k0, k1), tips=(None, tip), floor=floor)


def cube(part, c, ax, ay, az, key, weights):
    """Caja de 8 vértices con medios lados ax, ay, az (vectores): placas, remaches, puntadas."""
    c, ax, ay, az = Vector(c), Vector(ax), Vector(ay), Vector(az)
    lo = part.ring([c - ax - ay - az, c + ax - ay - az, c + ax + ay - az, c - ax + ay - az], weights)
    hi = part.ring([c - ax - ay + az, c + ax - ay + az, c + ax + ay + az, c - ax + ay + az], weights)
    part.bridge(lo, hi, key)
    part.cap(lo, key)
    part.cap(hi, key)


def box(part, c, size, key, weights, rnd=None, jitter=0.0, bevel=0.25):
    """Caja con las aristas biseladas, centrada en c; size = medios lados (x, y, z)."""
    c = Vector(c)
    sx, sy, sz = size
    b = bevel
    prof = [(1, 1 - b), (1 - b, 1), (b - 1, 1), (-1, 1 - b), (-1, b - 1), (b - 1, -1), (1 - b, -1), (1, b - 1)]
    rings = []
    for zz, k in ((-sz, 1 - b * 0.6), (-sz * 0.6, 1.0), (sz * 0.6, 1.0), (sz, 1 - b * 0.6)):
        pts = []
        for px, py in prof:
            d = Vector((px * sx * k, py * sy * k, zz))
            if rnd and jitter:
                d += Vector((rnd.uniform(-jitter, jitter), rnd.uniform(-jitter, jitter), rnd.uniform(-jitter, jitter)))
            pts.append(c + d)
        rings.append(part.ring(pts, weights))
    for i in range(3):
        part.bridge(rings[i], rings[i + 1], key)
    part.cap(rings[0], key)
    part.cap(rings[-1], key)


def stud(part, c, nrm, r, h, key, weights, n=5):
    """Remache o perla: un anillito sobre la superficie y una punta roma hacia afuera."""
    c, nrm = Vector(c), Vector(nrm).normalized()
    return cone(part, c - nrm * h * 0.3, c + nrm * h, r, n, key, weights)


def fin(part, a, b, tip, thick, key, weights):
    """Aleta o púa plana (cresta, volados, mechones): un triángulo con espesor."""
    a, b, tip = Vector(a), Vector(b), Vector(tip)
    n = (b - a).cross(tip - a).normalized() * (thick / 2)
    r0 = part.ring([a - n, b - n, tip - n], weights)
    r1 = part.ring([a + n, b + n, tip + n], weights)
    part.bridge(r0, r1, key)
    part.cap(r0, key)
    part.cap(r1, key)


def leaf(part, base, along, side, length, width, thick, key, weights, inner=None, cup=0.0):
    """Hoja con espesor (orejas, placas): contorno de 8 puntos en el plano (along, side). Con `inner`,
    una hoja más chica y metida del lado de la normal, de otro color (el adentro de una oreja)."""
    base, along, side = Vector(base), Vector(along).normalized(), Vector(side).normalized()
    nrm = along.cross(side).normalized()
    prof = [(0.0, 0.0), (0.15, 0.42), (0.45, 0.5), (0.75, 0.36), (1.0, 0.0), (0.75, -0.36), (0.45, -0.5), (0.15, -0.42)]

    def outline(scale, off, shift):
        return [base + along * (length * (u * scale + shift)) + side * (width * v * scale) + nrm * (off - cup * (1 - abs(v) * 2))
                for u, v in prof]
    r0 = part.ring(outline(1.0, -thick / 2, 0.0), weights)
    r1 = part.ring(outline(1.0, thick / 2, 0.0), weights)
    part.bridge(r0, r1, key)
    part.face(list(reversed(r0)), key)
    part.face(r1, key)
    if inner:
        s0 = part.ring(outline(0.7, thick / 2 - 0.001, 0.12), weights)
        s1 = part.ring(outline(0.7, thick / 2 + thick * 0.6, 0.12), weights)
        part.bridge(s0, s1, inner)
        part.face(list(reversed(s0)), inner)
        part.face(s1, inner)


def slab(part, rows, key, weights, keys=None):
    """Tira con espesor (correa, faldón simple): rows = [(punto_izq, punto_der, normal*espesor)]."""
    rings = []
    for l, r, t in rows:
        l, r, t = Vector(l), Vector(r), Vector(t)
        rings.append(part.ring([l - t, r - t, r + t, l + t], weights))
    for i in range(len(rings) - 1):
        part.bridge(rings[i], rings[i + 1], keys[i] if keys else key)
    part.cap(rings[0], key)
    part.cap(rings[-1], key)
    return rings


def cloth(part, grid, normals, thick, key, weights):
    """Paño con espesor a partir de una grilla de puntos (filas de arriba a abajo) y su normal en cada
    punto: cara de adelante, de atrás y los cuatro bordes. `key(centro, fila, columna)` o un color."""
    R, C = len(grid), len(grid[0])
    front = [part.ring([Vector(grid[i][j]) + Vector(normals[i][j]) * (thick / 2) for j in range(C)], weights) for i in range(R)]
    back = [part.ring([Vector(grid[i][j]) - Vector(normals[i][j]) * (thick / 2) for j in range(C)], weights) for i in range(R)]

    def k(q, i, j):
        if callable(key):
            return key(sum((part.verts[v] for v in q), Vector()) / len(q), i, j)
        return key
    for i in range(R - 1):
        for j in range(C - 1):
            q = (front[i][j], front[i][j + 1], front[i + 1][j + 1], front[i + 1][j])
            part.face(q, k(q, i, j))
            q = (back[i][j], back[i + 1][j], back[i + 1][j + 1], back[i][j + 1])
            part.face(q, k(q, i, j))
    for j in range(C - 1):
        for i, (a, b) in ((0, (front[0], back[0])), (R - 2, (back[-1], front[-1]))):
            q = (a[j + 1], a[j], b[j], b[j + 1])
            part.face(q, k(q, i, j))
    for i in range(R - 1):
        for jj, (a, b) in ((0, (back, front)), (C - 1, (front, back))):
            q = (a[i][jj], a[i + 1][jj], b[i + 1][jj], b[i][jj])
            part.face(q, k(q, i, min(jj, C - 2)))


def band(part, c, axis, r, width, thick, n, key, weights, up=(0, 0, 1), rv=None):
    """Venda, brazalete o aro alrededor de un miembro: anillo plano con espesor."""
    c, axis = Vector(c), Vector(axis).normalized()
    rv = rv or r
    h = axis * (width / 2)
    rings = [part.ring(ring_around(c + o, axis, rr, rr * rv / r, n, None, 0.0, math.pi / n, up), weights)
             for o, rr in ((-h, r), (-h, r + thick), (h, r + thick), (h, r))]
    for i in range(3):
        part.bridge(rings[i], rings[i + 1], key)
    part.bridge(rings[3], rings[0], key)
    return rings


def strap(part, pts, normals, width, thick, key, weights):
    """Correa plana que sigue los puntos `pts` sobre la piel (con su normal hacia afuera)."""
    rows = []
    m = len(pts)
    for i, (p, n) in enumerate(zip(pts, normals)):
        p, n = Vector(p), Vector(n).normalized()
        t = (Vector(pts[min(i + 1, m - 1)]) - Vector(pts[max(i - 1, 0)])).normalized()
        w = t.cross(n).normalized() * (width / 2)
        rows.append((p + w, p - w, n * (thick / 2)))
    return slab(part, rows, key, weights)


def torus(part, center, axis, R, r, n, m, key, weights):
    """Aro (argolla de la nariz, eslabones): n tramos alrededor de `axis`, m lados por tramo."""
    center, axis = Vector(center), Vector(axis).normalized()
    ref = Vector((0, 0, 1)) if abs(axis.z) < 0.9 else Vector((1, 0, 0))
    u = (ref - ref.dot(axis) * axis).normalized()
    v = axis.cross(u)
    rings = []
    for j in range(n):
        a = 2 * math.pi * j / n
        c = center + (u * math.cos(a) + v * math.sin(a)) * R
        rings.append(part.ring(ring_around(c, -u * math.sin(a) + v * math.cos(a), r, r, m, None, 0.0, 0.0, axis), weights))
    for j in range(n):
        part.bridge(rings[j], rings[(j + 1) % n], key)
    return rings


# ------------------------------------------------------------ torsos: superficie y colores por zona

def on_rows(rows, z, a, push=0.0):
    """Punto sobre la superficie de filas (z, rx, ry, yc[, potencia]) a la altura z y el ángulo a
    (radianes desde el frente), corrido `push` hacia afuera: para apoyar cinturones, correas y collares."""
    rows = sorted(rows)
    i = max(0, min(len(rows) - 2, next((k for k in range(len(rows) - 1) if rows[k + 1][0] >= z), len(rows) - 2)))
    r0, r1 = rows[i], rows[i + 1]
    t = max(0.0, min(1.0, (z - r0[0]) / (r1[0] - r0[0])))
    rx, ry, yc = (r0[k] + (r1[k] - r0[k]) * t for k in (1, 2, 3))
    pw = (r0[4] if len(r0) > 4 else 0.85) * (1 - t) + (r1[4] if len(r1) > 4 else 0.85) * t
    s, c = math.sin(a), math.cos(a)
    x = (rx + push) * math.copysign(abs(s) ** pw, s)
    y = yc - (ry + push) * math.copysign(abs(c) ** pw, c)
    return Vector((x, y, z))


def surface_normal(rows, z, a):
    """Normal horizontal aproximada de las filas en la altura z y el ángulo a."""
    return (on_rows(rows, z, a, 0.05) - on_rows(rows, z, a)).normalized()


def angle_of(p, yc=0.0):
    """Ángulo en grados de un punto alrededor del eje vertical: 0 adelante, ±90 a los costados, 180 atrás."""
    return math.degrees(math.atan2(p.x, -(p.y - yc)))


# ------------------------------------------------------------ manos y pies

def finger(part, base, d, back, segs, radii, n, key, weights, nail=None, claw=None, bulge=None, floor=None):
    """Dedo de falanges: arranca en `base` hacia `d` (con el dorso hacia `back`); segs = [(largo, ángulo
    con que se dobla al empezar ese tramo)], hacia la palma. radii = radio en cada nudillo y en la punta.
    Con `nail`, una uña sobre la última falange; con `claw`, una garra curva que sigue la curva del dedo."""
    d, back = Vector(d).normalized(), Vector(back).normalized()
    axis = d.cross(-back).normalized()          # girar alrededor de este eje dobla hacia la palma
    pts, dirs = [Vector(base)], []
    cur = Vector(base)
    for L, ang in segs:
        R = Matrix.Rotation(math.radians(ang), 3, axis)
        d, back = R @ d, R @ back
        dirs.append((d.copy(), back.copy()))
        cur = cur + d * L
        pts.append(cur.copy())
    ctrl = []
    for i, p in enumerate(pts):
        r = radii[i]
        if bulge and 0 < i < len(pts) - 1:     # nudillo más grueso, con un anillo más fino a cada lado
            a, b = pts[i - 1], pts[i + 1]
            ctrl.append(tuple(p + (a - p) * 0.3) + (radii[i] * 0.95, radii[i] * 0.95))
            ctrl.append(tuple(p) + (r * bulge, r * bulge))
            ctrl.append(tuple(p + (b - p) * 0.3) + (radii[i] * 0.95, radii[i] * 0.95))
        else:
            ctrl.append(tuple(p) + (r, r))
    d_end, b_end = dirs[-1]
    limb(part, ctrl, 0, n, key, weights, up=axis, caps=(key, key), tips=(None, pts[-1] + d_end * radii[-1] * 0.8),
         floor=floor)
    if nail:
        L = segs[-1][0]
        c = pts[-1] - d_end * L * 0.35 + b_end * radii[-1] * 0.75
        cube(part, c, d_end * L * 0.32, axis * radii[-1] * 0.75, b_end * radii[-1] * 0.28, nail, weights)
    if claw:
        ck, clen, cbend = claw
        p0 = pts[-1] - d_end * radii[-1] * 0.2 + b_end * radii[-1] * 0.25
        dd = d_end.copy()
        path = [p0]
        for s in range(3):
            dd = Matrix.Rotation(math.radians(cbend / 3), 3, axis) @ dd
            path.append(path[-1] + dd * clen / 3)
        tip = path[-1].copy()
        if floor is not None:
            tip.z = max(tip.z, floor)
        horn(part, path[:-1], [radii[-1] * 0.85, radii[-1] * 0.6, radii[-1] * 0.35], 5, ck, weights, tip=tip, up=axis, per=1,
             floor=floor)
    return pts


def open_hand(part, side, x0, yc, zc, size, skin, knuckle, nail, rnd, curl=(10, 22, 16), spread=6.0,
              lengths=(0.075, 0.085, 0.08, 0.062), claws=None, n=5):
    """Mano abierta y relajada, palma abajo en la pose T: palma, cuatro dedos gruesos con nudillos y
    uñas (o garras) que se curvan un poco hacia abajo, y el pulgar adelante. Rígida a la mano."""
    s, k = side, size
    W = {sd("Hand", side): 1.0}
    x1 = x0 + 0.115 * k
    ctrl = [(s * x0, yc, zc, 0.032 * k, 0.045 * k), (s * (x0 + 0.04 * k), yc, zc - 0.002 * k, 0.036 * k, 0.058 * k),
            (s * (x0 + 0.09 * k), yc, zc - 0.006 * k, 0.034 * k, 0.064 * k), (s * x1, yc, zc - 0.01 * k, 0.026 * k, 0.06 * k)]
    limb(part, ctrl, 1, 8, skin, W, rnd, 0.003 * k, caps=(skin, skin))
    back = Vector((0, 0, 1))
    for i, ln in enumerate(lengths):
        off = (-0.045 + 0.03 * i) * k                  # índice adelante (-y)
        base = Vector((s * (x1 - 0.01 * k), yc + off, zc - 0.006 * k))
        a = math.radians(spread * (i - 1.5))
        d = Vector((s * math.cos(a), math.sin(a), -0.08)).normalized()
        L = ln * k
        segs = [(L * 0.42, curl[0]), (L * 0.32, curl[1]), (L * 0.26, curl[2])]
        r = 0.0165 * k * (1.0 if i < 3 else 0.88)
        finger(part, base, d, back, segs, [r * 1.05, r, r * 0.92, r * 0.8], n, skin, W,
               nail=None if claws else nail, claw=(claws, 0.035 * k, 50) if claws else None)
        cube(part, base + Vector((s * 0.004 * k, 0, r * 0.75)), Vector((s * r * 0.9, 0, 0)), Vector((0, r * 0.8, 0)),
             Vector((0, 0, r * 0.35)), knuckle, W)
    tb = Vector((s * (x0 + 0.035 * k), yc - 0.045 * k, zc - 0.012 * k))
    finger(part, tb, Vector((s * 0.55, -1.0, -0.35)), Vector((0, 0.3, 1)),
           [(0.035 * k, 0), (0.03 * k, 18), (0.025 * k, 18)], [0.021 * k, 0.019 * k, 0.017 * k, 0.014 * k], n, skin, W,
           nail=None if claws else nail, claw=(claws, 0.03 * k, 45) if claws else None)


def grip_fist(part, side, g, d, wrist, size, skin, knuckle, nail, rnd, shaft=0.03, claws=None, n=5):
    """Puño cerrado alrededor del mango de un arma: los cuatro dedos se enroscan alrededor del eje `d`
    que pasa por `g`, con los nudillos marcados, el pulgar cruzado por adelante y la palma que llega
    hasta la muñeca. Rígido a la mano."""
    k = size
    W = {sd("Hand", side): 1.0}
    g, wrist = Vector(g), Vector(wrist)
    kd = Vector(d).normalized()                                   # línea de nudillos = eje del mango
    b = Vector((0, 0, 1))
    b = (b - b.dot(kd) * kd).normalized()                         # dorso de la mano
    f = kd.cross(b)
    if f.dot(g - wrist) < 0:
        f = -f                                                    # hacia donde apuntan los dedos
    rf = 0.019 * k
    R = shaft + rf * 0.9
    # palma: de la muñeca al dorso de los nudillos, ancha a lo largo del mango
    heel = g - f * (R + 0.045 * k)
    knuck = g - f * R * 0.2 + b * R * 0.35
    ctrl = [tuple(wrist) + (0.07 * k, 0.07 * k), tuple(heel.lerp(wrist, 0.3)) + (0.08 * k, 0.085 * k),
            tuple(heel) + (0.085 * k, 0.095 * k), tuple(knuck) + (0.055 * k, 0.088 * k)]
    limb(part, ctrl, 1, 8, skin, W, rnd, 0.003 * k, up=b, caps=(skin, skin))
    for i in range(4):
        off = (0.048 - 0.032 * i) * k                             # índice del lado de la punta del arma
        c = g + kd * off
        r = rf * (1.0 if i < 3 else 0.88)
        # el dedo da la vuelta al mango: arriba, adelante, abajo y vuelve hacia la palma
        angs = [-25, 40, 115, 200]
        rad = [R * 1.05, R * 1.1, R * 1.06, R * 0.95]
        pts = [c + (b * math.cos(math.radians(t)) + f * math.sin(math.radians(t))) * rr for t, rr in zip(angs, rad)]
        ctrl = [tuple(p) + (r * (1.1 if j == 1 else 1.0),) * 2 for j, p in enumerate(pts)]
        limb(part, ctrl, 1, n, skin, W, up=kd, caps=(skin, skin))
        cube(part, pts[1] + (pts[1] - c).normalized() * r * 0.75, f * r * 0.6, kd * r * 0.8,
             (pts[1] - c).normalized() * r * 0.3, knuckle, W)
        if claws:
            tip = pts[-1]
            horn(part, [tip, tip - f * 0.012 * k - b * 0.008 * k], [r * 0.7, r * 0.45], 5, claws, W,
                 tip=tip - f * 0.03 * k - b * 0.006 * k, up=kd, per=1)
    # pulgar: de abajo de la palma, por adelante del índice y del medio
    tc = g + kd * 0.066 * k
    angs = [235, 190, 140, 95]
    rad = [R * 1.2, R * 1.45, R * 1.55, R * 1.5]
    offs = [0.0, -0.006, -0.018, -0.03]
    pts = [tc + kd * (o * k) + (b * math.cos(math.radians(t)) + f * math.sin(math.radians(t))) * rr
           for t, rr, o in zip(angs, rad, offs)]
    rt = rf * 1.15
    limb(part, [tuple(p) + (rt * s_, rt * s_) for p, s_ in zip(pts, (1.1, 1.0, 0.95, 0.85))], 1, n, skin, W, up=kd,
         caps=(skin, skin), tips=(None, pts[-1] + (pts[-1] - pts[-2]).normalized() * rt * 0.7))
    if nail and not claws:
        tdir = (pts[-1] - pts[-2]).normalized()
        out = (pts[-1] - tc).normalized()
        cube(part, pts[-1] - tdir * rt * 0.6 + out * rt * 0.75, tdir * rt * 0.7, kd * rt * 0.7, out * rt * 0.25, nail, W)


# ------------------------------------------------------------ pintado a mano

def tone(key, step):
    """El cuadrito vecino de la misma columna de la paleta (step -1 más claro, +1 más oscuro)."""
    if isinstance(key, str) and ':' in key:
        col, _, row = key.partition(':')
        r = max(0, min(4, int(row) + step))
        return f"{col}:{r}"
    if key in BONES:
        return BONES[max(0, min(3, BONES.index(key) + step))]
    return key


def noise3(p, scale, seed=0):
    """Ruido de valor 3D, suave, entre 0 y 1: manchas de unos `scale` metros."""
    x, y, z = p.x / scale, p.y / scale, p.z / scale
    i, j, k = math.floor(x), math.floor(y), math.floor(z)
    fx, fy, fz = (smoothstep(0, 1, v - math.floor(v)) for v in (x, y, z))

    def h(a, b, c):
        n = (a * 73856093) ^ (b * 19349663) ^ (c * 83492791) ^ (seed * 2654435761)
        n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff
        return (n & 0xffff) / 65535.0
    lerp = lambda a, b, t: a + (b - a) * t
    x00 = lerp(h(i, j, k), h(i + 1, j, k), fx)
    x10 = lerp(h(i, j + 1, k), h(i + 1, j + 1, k), fx)
    x01 = lerp(h(i, j, k + 1), h(i + 1, j, k + 1), fx)
    x11 = lerp(h(i, j + 1, k + 1), h(i + 1, j + 1, k + 1), fx)
    return lerp(lerp(x00, x10, fy), lerp(x01, x11, fy), fz)


def shade(obj, keys, rnd, light=0.5, dark=-0.45, mottle=0.6, scale=0.24, speckle=0.004, skip=(), custom=None,
          seed=0):
    """Pinta a mano sobre los colores de cada cara: lo que mira arriba un tono más claro de la misma
    columna de la paleta, lo que mira abajo uno más oscuro, con manchas suaves de ruido (como pinceladas)
    y alguna cara suelta al azar. `custom` = {color: (claro, oscuro)} para columnas con saltos grandes;
    los colores de `skip` (ojos, bocas) no cambian."""
    me = obj.data
    vn = [v.normal.z for v in me.vertices]          # normales suaves: los cambios de tono siguen la curva
    for p, key in zip(me.polygons, keys):
        if key in skip or not (isinstance(key, str) and ':' in key or key in BONES):
            continue
        nz = sum(vn[i] for i in p.vertices) / len(p.vertices) * 0.7 + p.normal.z * 0.3
        score = nz * 0.8 + (noise3(p.center, scale, seed) - 0.5) * mottle
        step = -1 if score > light else (1 if score < dark else 0)
        r = rnd.random()
        if r < speckle:
            step += -1 if r < speckle / 2 else 1
        step = max(-1, min(1, step))
        if step == 0:
            continue
        if custom and key in custom:
            new = custom[key][0 if step < 0 else 1]
        else:
            new = tone(key, step)
        uv = pal_uv(new)
        for li in p.loop_indices:
            for lay in me.uv_layers:
                lay.data[li].uv = uv


# ------------------------------------------------------------ armado final

def weapon(name, grip, at, along, side_dir, scale=1.0, like=None, bone="Hand_R"):
    """Arma del pack (vienen paradas en +Z y 100 veces chicas) puesta en la mano: el punto `grip` del
    arma (en metros, sobre su eje) va a `at`, +Z apunta a `along` y +Y a lo más parecido a `side_dir`.
    Rígida a `bone`, con las capas de UV y el material de `like` para que se una sin sobrantes."""
    obj = import_prop(name)
    z = Vector(along).normalized()
    y = Vector(side_dir)
    y = (y - y.dot(z) * z).normalized()
    R = Matrix((y.cross(z), y, z)).transposed()
    g, at = Vector(grip), Vector(at)
    for v in obj.data.vertices:
        v.co = at + R @ ((v.co * 100.0 - g) * scale)
    me = obj.data
    src = me.uv_layers.active or me.uv_layers[0]
    uvs = [d.uv.copy() for d in src.data]
    while me.uv_layers:
        me.uv_layers.remove(me.uv_layers[0])
    for lname in [l.name for l in like.data.uv_layers]:
        lay = me.uv_layers.new(name=lname)
        for d, uv in zip(lay.data, uvs):
            d.uv = uv
    me.materials.clear()
    me.materials.append(like.data.materials[0])
    obj.vertex_groups.new(name=bone).add(list(range(len(me.vertices))), 1.0, 'REPLACE')
    return obj


def item(name, at, yaw, scale, like, bone="Hips"):
    """Cosa del pack que se cuelga del cinturón (SM_Item_Bag_Large, SM_Item_Horn, SM_Item_Bones): vienen
    en metros, con su origen en el punto de donde cuelgan, del lado derecho de un personaje del pack.
    Se gira `yaw` grados alrededor de z y se pone en `at`. Rígida a `bone`."""
    obj = import_prop(name)
    R = Matrix.Rotation(math.radians(yaw), 3, 'Z')
    at = Vector(at)
    for v in obj.data.vertices:
        v.co = at + R @ (v.co * scale)
    obj.matrix_world = Matrix.Identity(4)
    me = obj.data
    src = me.uv_layers.active or me.uv_layers[0]
    uvs = [d.uv.copy() for d in src.data]
    while me.uv_layers:
        me.uv_layers.remove(me.uv_layers[0])
    for lname in [l.name for l in like.data.uv_layers]:
        lay = me.uv_layers.new(name=lname)
        for d, uv in zip(lay.data, uvs):
            d.uv = uv
    me.materials.clear()
    me.materials.append(like.data.materials[0])
    obj.vertex_groups.new(name=bone).add(list(range(len(me.vertices))), 1.0, 'REPLACE')
    return obj


def finish(arm, name, part, extras=(), seed=0, paint=False, **shading):
    """Arma el personaje final: la malla de anillos (pintada con `shade`) más las piezas sueltas (armas),
    en el espacio de la armadura (en cm bajo su escala 0.01, como las del pack), con su modificador."""
    import random
    like = bpy.data.objects[LIKE]
    for o in [o for o in bpy.data.objects if o.name.startswith(name)]:
        bpy.data.objects.remove(o, do_unlink=True)
    obj = part.to_object(name, like.data.materials[0], like=like)
    if paint:     # el pack pinta regiones planas y deja la luz para el sombreado: apagado por defecto
        shade(obj, part.keys, random.Random(seed), seed=seed, **shading)
    # con caras de pocos centímetros el facetado plano se ve como una grilla: lo curvo va suave y los
    # quiebres de verdad (cinturones, aletas, labios, placas) quedan marcados
    if SMOOTH_ANGLE:
        obj.data.shade_smooth()
        obj.data.set_sharp_from_angle(angle=math.radians(SMOOTH_ANGLE))
    if extras:
        join(obj, list(extras))
    obj.name = name
    obj.data.name = name
    inv = arm.matrix_world.inverted()
    for v in obj.data.vertices:
        v.co = inv @ v.co
    obj.parent = arm
    obj.matrix_parent_inverse = Matrix.Identity(4)
    obj.matrix_basis = Matrix.Identity(4)
    obj.modifiers.new("Armature", 'ARMATURE').object = arm
    return obj
