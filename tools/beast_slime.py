"""Limo ácido: un monstruo sin esqueleto humano para la horda, en el estilo de PolygonDungeon (Synty).

Una gota grande de baba con forma de domo, más ancha abajo y con lóbulos chorreados en el borde,
dos ojos grandes en pedúnculos cortos y una boca ancha. Lleva tragados a medias restos de la horda: la
cabeza con casco de un esqueleto soldado (de Characters.fbx), una espada rota clavada y un fémur.

- Colores: los de la baba están todos en GOO (por papel: arriba, cuerpo, abajo, lóbulos...). Por
  defecto es veneno violeta (GOO_VIOLET), que se ve sobre el pasto de la cancha; GOO_GREEN es el ácido
  verde original.
- Malla: anillos de 12 lados con un poco de ruido (synty_kit.Part); cada cara apunta su UV a un
  cuadrito de la paleta del atlas. Arriba la baba es más clara y chorrea hacia abajo en puntas: cada
  punta es una cara partida en cuatro triángulos alrededor de un vértice del medio.
- Esqueleto propio de 16 huesos: Root en el piso; la cadena Base > Mid > Top que aplasta, estira y
  dobla el cuerpo; cuatro lóbulos (Lobe_F/B/L/R) que empujan el borde; Jaw abre la boca; Eye_L/R con
  sus pupilas; y un hueso por cada resto tragado (Junk_*).
- Los ojos y los restos cuelgan de Root pero siguen la superficie: en cada cuadro se calcula a dónde va
  su punto de apoyo con los mismos pesos que el cuerpo, sin la escala (así el cráneo no se aplasta
  cuando la baba se derrite).
- Acciones (30 fps, en el lugar): Idle, Walking, Running (lazos), Attack y Hard Landing (la muerte). Se
  escriben como movimientos en ejes del mundo alrededor de un pivote y se pasan al espacio de cada hueso.

uso: blender -b --python tools/beast_slime.py -- public/models/slime.glb [--goo=verde]
     (kit_preview.py usa build_beast(atlas_image) -> (armadura, malla), en violeta)
"""
import bpy, math, os, random, sys
from mathutils import Vector, Matrix, Euler, Quaternion
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from synty_kit import *

NAME = "Character_Slime"
FPS = 30
SEED = 23
N = 12
ANG = sym_angles([15, 45, 75, 105, 135, 165])   # columnas; la cara 5 (entre -15° y 15°) es el frente
MOUTH = (4, 5, 6)                                 # caras de la boca, entre las columnas 4 y 7

# perfil del cuerpo: z, medio ancho, media profundidad, centro en y
PROFILE = [
    (0.00, 0.80, 0.72, 0.02),
    (0.06, 0.79, 0.71, 0.02),
    (0.17, 0.765, 0.69, 0.01),
    (0.30, 0.725, 0.655, 0.0),
    (0.40, 0.69, 0.625, 0.0),
    (0.60, 0.60, 0.545, 0.0),
    (0.72, 0.525, 0.48, 0.01),
    (0.84, 0.425, 0.39, 0.02),
    (0.93, 0.31, 0.285, 0.02),
    (1.00, 0.165, 0.155, 0.02),
    (1.04, 0.0, 0.0, 0.02),
]
RING_Z = [0.0, 0.06, 0.17, 0.30, None, None, None, None, 0.72, 0.84, 0.93, 1.0]
# colores de la baba por papel, para cambiar el esquema en un solo lugar. De claro a oscuro: la capa de
# arriba que chorrea, el cuerpo, la parte de abajo y la base; el borde del charco brilla.
GOO_VIOLET = {   # veneno violeta (el de siempre: contrasta con el pasto verde de la cancha)
    'top': 'orchid:0', 'body': 'orchid:2', 'lower': 'plum:3', 'glint': 'orchid:1', 'bottom': 'dusk:4',
    'lip': 'plum:3', 'lobe_low': 'plum:3', 'lobe_mid': 'plum:2', 'lobe_top': 'orchid:1',
    'bubble': 'orchid:1', 'stalk': 'orchid:2', 'lid': 'orchid:1', 'lid_edge': 'plum:2', 'shine': 'ice:0',
}
GOO_GREEN = {    # ácido verde (se pierde en el pasto)
    'top': 'lime:0', 'body': 'lime:2', 'lower': 'lime:3', 'glint': 'lime:1', 'bottom': 'lime:4',
    'lip': 'lime:3', 'lobe_low': 'lime:3', 'lobe_mid': 'lime:2', 'lobe_top': 'lime:1',
    'bubble': 'lime:1', 'stalk': 'lime:2', 'lid': 'lime:1', 'lid_edge': 'lime:2', 'shine': 'ice:0',
}
GOOS = {'violeta': GOO_VIOLET, 'verde': GOO_GREEN}
GOO = GOO_VIOLET
MOUTH_IN, IRIS = 'maroon:4', 'mustard:1'


def bands():
    """Color de cada franja del cuerpo, de abajo para arriba (la 9 y la 10 son la capa clara)."""
    return [GOO['glint']] + [GOO['lower']] * 3 + [GOO['body']] * 5 + [GOO['top']] * 2

# ojos: base del pedúnculo y centro del ojo (el izquierdo, en +X)
EYE_S = Vector((0.16, -0.17, 0.95))
EYE_C = Vector((0.205, -0.25, 1.13))
EYE_R = 0.115
# lóbulos del borde: ángulo, tamaño y cuánto se alargan hacia afuera
LOBES = [(-160, 1.0, 1.0), (-112, 0.8, 1.12), (-38, 1.1, 0.95), (22, 0.85, 1.12), (86, 1.05, 1.0), (140, 0.75, 1.1)]
# burbujas: ángulo, altura, radio
BUBBLES = [(108, 0.45, 0.06), (160, 0.66, 0.05), (-104, 0.56, 0.055), (-24, 0.80, 0.038), (-166, 0.34, 0.065)]


def mirror(v, side):
    return Vector((v.x * side, v.y, v.z))


def prof(z):
    """Medio ancho, media profundidad y centro en y del cuerpo a la altura z."""
    for (z0, *a), (z1, *b) in zip(PROFILE, PROFILE[1:]):
        if z <= z1:
            t = (z - z0) / (z1 - z0)
            return [u + (v - u) * t for u, v in zip(a, b)]
    return PROFILE[-1][1:]


def surf(a, z, d=0.0):
    """Punto del cuerpo en el ángulo a (radianes, 0 = frente -Y, + hacia +X) y la altura z, corrido d
    metros hacia afuera."""
    rx, ry, yc = prof(z)
    k = 1 + d / max((rx + ry) / 2, 0.05)
    return Vector((k * rx * math.sin(a), yc - k * ry * math.cos(a), z))


def normal(a, z):
    e = 0.01
    n = (surf(a + e, z) - surf(a - e, z)).cross(surf(a, z + e) - surf(a, z - e))
    return n.normalized()


def deg_surf(adeg, z, d=0.0):
    return surf(math.radians(adeg), z, d)


# ------------------------------------------------------------------ esqueleto

def _bones():
    b = [
        ("Root", (0, 0, 0), (0, 0, 0.2), None),
        ("Base", (0, 0, 0), (0, 0, 0.35), "Root"),
        ("Mid", (0, 0, 0.35), (0, 0, 0.68), "Base"),
        ("Top", (0, 0, 0.68), (0, 0, 1.0), "Mid"),
        ("Jaw", (0, -0.10, 0.48), (0, -0.50, 0.48), "Mid"),
        ("Lobe_F", (0, -0.30, 0), (0, -0.80, 0), "Root"),
        ("Lobe_B", (0, 0.30, 0), (0, 0.80, 0), "Root"),
        ("Lobe_L", (0.30, 0, 0), (0.85, 0, 0), "Root"),
        ("Lobe_R", (-0.30, 0, 0), (-0.85, 0, 0), "Root"),
    ]
    for side, s in ((1, "L"), (-1, "R")):
        S = mirror(EYE_S, side)
        b.append(("Eye_" + s, tuple(S), tuple(S + Vector((0, 0, 0.15))), "Root"))
    for side, s in ((1, "L"), (-1, "R")):
        C = mirror(EYE_C, side)
        b.append(("Pupil_" + s, tuple(C), tuple(C + Vector((0, -0.12, 0))), "Eye_" + s))
    for name, p in JUNK.items():
        b.append((name, tuple(p), tuple(p + Vector((0, 0, 0.15))), "Root"))
    return b


# punto de apoyo de cada resto (donde sale de la baba): el hueso nace ahí y sigue a la superficie
JUNK = {
    "Junk_Skull": deg_surf(62, 0.66, -0.02),
    "Junk_Sword": deg_surf(-140, 0.80, 0.0),
    "Junk_Bone": deg_surf(-76, 0.27, 0.0),
}
BONES = _bones()
HEADS = {name: Vector(h) for name, h, t, p in BONES}
FOLLOW = {"Eye_L": mirror(EYE_S, 1), "Eye_R": mirror(EYE_S, -1), **JUNK}


def make_armature():
    data = bpy.data.armatures.new("Slime")
    arm = bpy.data.objects.new("Armature", data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    for name, head, tail, parent in BONES:
        eb = data.edit_bones.new(name)
        eb.head, eb.tail, eb.roll = head, tail, 0.0
        if parent:
            eb.parent = data.edit_bones[parent]
            eb.use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in arm.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    return arm


# ------------------------------------------------------------------ pesos

def body_w(p):
    """Pesos del cuerpo: la cadena por altura, los lóbulos cerca del piso y la mandíbula en el labio
    de abajo."""
    z = p.z
    t1, t2 = smoothstep(0.20, 0.50, z), smoothstep(0.55, 0.85, z)
    chain = {"Base": 1 - t1, "Mid": t1 * (1 - t2), "Top": t2}
    rho = math.hypot(p.x, p.y) / 0.78
    ang = math.atan2(p.x, -p.y)
    g = 0.85 * (1 - smoothstep(0.02, 0.30, z)) * smoothstep(0.35, 0.85, rho)
    j = (smoothstep(math.radians(55), math.radians(25), abs(ang)) * smoothstep(0.26, 0.38, z)
         * (1 - smoothstep(0.47, 0.50, z)) * smoothstep(0.55, 0.75, rho))
    w = {b: v * (1 - g) * (1 - j) for b, v in chain.items()}
    for name, a in (("Lobe_F", 0), ("Lobe_L", 90), ("Lobe_B", 180), ("Lobe_R", -90)):
        c = max(0.0, math.cos(ang - math.radians(a))) ** 2
        w[name] = w.get(name, 0) + g * c
    if j > 0:
        w["Jaw"] = j
    return top4(w)


def lobe_w(p):
    rho = math.hypot(p.x, p.y) / 0.78
    ang = math.atan2(p.x, -p.y)
    g = 0.92 * smoothstep(0.55, 1.0, rho)
    w = {"Base": 1 - g}
    for name, a in (("Lobe_F", 0), ("Lobe_L", 90), ("Lobe_B", 180), ("Lobe_R", -90)):
        w[name] = g * max(0.0, math.cos(ang - math.radians(a))) ** 2
    return top4(w)


def mix(a, b, t):
    out = {k: v * (1 - t) for k, v in a.items()}
    for k, v in b.items():
        out[k] = out.get(k, 0) + v * t
    return top4(out)


# ------------------------------------------------------------------ malla

def mouth_rows(j):
    """Las cuatro filas de la boca en la columna j: (z, cuánto sale o se hunde)."""
    if j in (5, 6):
        return [(0.39, 0.02), (0.415, -0.085), (0.555, -0.085), (0.585, 0.02)]
    if j in (4, 7):
        return [(0.472, 0.01), (0.485, -0.03), (0.502, -0.03), (0.515, 0.01)]
    return [(0.40, 0.0), (0.467, 0.0), (0.533, 0.0), (0.60, 0.0)]


def vtip(part, q, up, down, w, depth=0.8, bulge=0.012):
    """Cara partida en cuatro triángulos alrededor de un punto bajo: el de arriba (color `up`) queda
    como una gota que cae sobre el color `down`."""
    bl, br, tr, tl = q
    V = part.verts
    p = ((V[tl] + V[tr]) / 2).lerp((V[bl] + V[br]) / 2, depth)
    n = (V[tr] - V[bl]).cross(V[tl] - V[br]).normalized()
    c = part.ring([p + n * bulge], w)[0]
    part.face((bl, br, c), down)
    part.face((br, tr, c), down)
    part.face((tr, tl, c), up)
    part.face((tl, bl, c), down)


def body(part, rnd):
    rows = []
    for i, zf in enumerate(RING_Z):
        pts = []
        for j, a in enumerate(ANG):
            if zf is None:
                z, d = mouth_rows(j)[i - 4]
                jit = 0.004
            else:
                z, d = zf, 0.0
                jit = 0.012
            if i == 0:
                d = 0.05 * (1 if j % 2 else -1) + rnd.uniform(-0.015, 0.015)    # borde festoneado
            elif i == 1:
                d = 0.025 * (1 if j % 2 else -1)
            p = surf(a, z, d)
            p += Vector((rnd.uniform(-jit, jit), rnd.uniform(-jit, jit), 0 if i == 0 else rnd.uniform(-jit, jit) * 0.6))
            pts.append(p)
        rows.append(part.ring(pts, body_w))

    # largo de cada chorreado de la capa clara (en franjas enteras debajo de la 9; -1 = sin punta)
    drip = [rnd.choice([-1, 0, 1, 1, 2, 2, 3]) for _ in range(N)]
    for j in MOUTH:
        drip[j] = min(drip[j], 1)
    tip3 = [rnd.random() < 0.5 and j not in MOUTH for j in range(N)]

    BAND, LIGHT, LIP = bands(), GOO['top'], GOO['lip']
    for b in range(len(rows) - 1):
        for j in range(N):
            k = (j + 1) % N
            q = (rows[b][j], rows[b][k], rows[b + 1][k], rows[b + 1][j])
            key = BAND[b]
            if j in MOUTH and b in (4, 6):
                key = LIP
            elif j in MOUTH and b == 5:
                key = MOUTH_IN
            d = drip[j]
            if 8 - d < b <= 8:
                key = LIGHT
            if b == 8 - d and d >= 0:
                vtip(part, q, LIGHT, key, body_w)
            elif b == 3 and tip3[j]:
                vtip(part, q, BAND[4], key, body_w)
            else:
                part.face(q, key)
    top = part.ring([Vector((0, 0.02, 1.04))], body_w)[0]
    for j in range(N):
        part.face((rows[-1][j], rows[-1][(j + 1) % N], top), LIGHT)
    part.face(list(reversed(rows[0])), GOO['bottom'])
    return rows


def lobes(part, rnd):
    """Lóbulos de baba que se desparraman por el borde."""
    for adeg, s, e in LOBES:
        a = math.radians(adeg + rnd.uniform(-5, 5))
        d = Vector((math.sin(a), -math.cos(a), 0))
        t = Vector((-d.y, d.x, 0))
        rim = surf(a, 0.0).to_2d().length
        yc = Vector((0, prof(0.0)[2], 0))
        spec = [(0.0, 0.0, 0.28, 0.24), (0.05, -0.01, 0.245, 0.21), (0.088, -0.03, 0.15, 0.13)]
        rings = []
        for z, dr, rr, rt in spec:
            c = yc + d * (rim * 0.86 + 0.1 * (e - 1) + dr)
            pts = []
            for m in range(8):
                psi = 2 * math.pi * m / 8 + 0.2
                p = c + d * (rr * s * e * math.cos(psi)) + t * (rt * s / e * math.sin(psi))
                pts.append(p + Vector((rnd.uniform(-0.016, 0.016), rnd.uniform(-0.016, 0.016), z * s if z else 0.0)))
            rings.append(part.ring(pts, lobe_w))
        part.bridge(rings[0], rings[1], GOO['lobe_low'])
        part.bridge(rings[1], rings[2], GOO['lobe_mid'])
        apex = part.ring([yc + d * (rim * 0.86 + 0.1 * (e - 1) - 0.04) + Vector((0, 0, 0.104 * s))], lobe_w)[0]
        for m in range(8):
            part.face((rings[2][m], rings[2][(m + 1) % 8], apex), GOO['lobe_top'])
        part.face(list(reversed(rings[0])), GOO['bottom'])


def bubbles(part, rnd):
    for adeg, z, r in BUBBLES:
        a = math.radians(adeg)
        p, n = surf(a, z), normal(a, z)
        r0 = part.ring(ring_around(p - n * 0.012, n, r, r, 6, rnd, 0.004), body_w)
        r1 = part.ring(ring_around(p + n * r * 0.5, n, r * 0.78, r * 0.78, 6, phase=0.5), body_w)
        tip = part.ring([p + n * r * 0.85], body_w)[0]
        under, light = GOO['bubble'], GOO['top']
        part.bridge(r0, r1, under)
        for m in range(6):
            part.face((r1[m], r1[(m + 1) % 6], tip), light)


def shine(part):
    """Dos brillos chatos arriba del domo: la baba se ve mojada."""
    for adeg, z, w, h in ((-38, 0.80, 0.075, 0.03), (-62, 0.70, 0.035, 0.016)):
        a = math.radians(adeg)
        p, n = surf(a, z, 0.008), normal(a, z)
        side = (surf(a + 0.02, z) - surf(a - 0.02, z)).normalized()
        up = n.cross(side).normalized()
        idx = part.ring([p - side * w, p - up * h, p + side * w, p + up * h], body_w)
        part.face(idx, GOO['shine'])


def drool(part):
    """Babas que cuelgan del labio de arriba, como dientes."""
    for adeg, length in ((-22, 0.11), (2, 0.075), (20, 0.12)):
        a = math.radians(adeg)
        z = 0.556
        top = surf(a, z, -0.075)
        n = normal(a, z)
        side = Vector((math.cos(a), math.sin(a), 0))
        tri = [top + side * 0.04 + n * 0.006, top - side * 0.04 + n * 0.006, top - n * 0.04]
        idx = part.ring(tri, body_w)
        tip = part.ring([top + n * 0.0 - Vector((0, 0, length))], body_w)[0]
        for m in range(3):
            part.face((idx[m], idx[(m + 1) % 3], tip), GOO['top'])


def eye(part, side, rnd):
    s = "L" if side > 0 else "R"
    E, Pu = {"Eye_" + s: 1.0}, {"Pupil_" + s: 1.0}
    S, C = mirror(EYE_S, side), mirror(EYE_C, side)
    ax = (C - S).normalized()
    # pedúnculo
    r0 = part.ring(ring_around(S, ax, 0.075, 0.075, 6, rnd, 0.004), body_w)
    r1 = part.ring(ring_around(S.lerp(C, 0.45), ax, 0.052, 0.052, 6, rnd, 0.003, phase=0.3),
                   lambda p: mix(body_w(p), E, 0.5))
    r2 = part.ring(ring_around(S.lerp(C, 0.8), ax, 0.048, 0.048, 6, phase=0.6), E)
    part.bridge(r0, r1, GOO['stalk'])
    part.bridge(r1, r2, GOO['stalk'])
    # el ojo: mira adelante y un poco arriba (a la cámara alta del juego)
    f = Vector((0.22 * side, -1.0, 0.42)).normalized()
    up = Vector((0, 0, 1))
    R = EYE_R
    rings = [part.ring(ring_around(C + f * R * math.cos(math.radians(th)), f, R * math.sin(math.radians(th)),
                                   R * math.sin(math.radians(th)), 8, up=up), E) for th in (32, 68, 104, 142)]
    for k in range(len(rings) - 1):
        part.bridge(rings[k + 1], rings[k], 'white')
    front = part.ring([C + f * R], E)[0]
    for m in range(8):
        part.face((rings[0][m], rings[0][(m + 1) % 8], front), 'white')
    part.cap(rings[-1], 'white', C - f * R, E)
    # iris y pupila: un casquete apenas afuera del ojo, que gira con Pupil
    u = (up - up.dot(f) * f).normalized()
    v = f.cross(u)
    Ri = R + 0.006

    def on(tu, ts, psi):
        d = f + u * (math.tan(math.radians(tu)) * math.cos(psi)) + v * (math.tan(math.radians(ts)) * math.sin(psi))
        return C + d.normalized() * Ri
    iris = part.ring([on(40, 40, 2 * math.pi * m / 8) for m in range(8)], Pu)
    pupil = part.ring([on(23, 10, 2 * math.pi * m / 8) for m in range(8)], Pu)
    center = part.ring([C + f * Ri], Pu)[0]
    part.bridge(iris, pupil, IRIS)
    for m in range(8):
        part.face((pupil[m], pupil[(m + 1) % 8], center), 'black')
    # párpado de baba, caído hacia adentro: cara de malo
    ln = (up + Vector((-side * 0.6, 0, 0)) + f * 0.25).normalized()
    Rl = R + 0.014
    lid = [part.ring(ring_around(C + ln * Rl * math.cos(math.radians(th)), ln, Rl * math.sin(math.radians(th)),
                                 Rl * math.sin(math.radians(th)), 8, up=f), E) for th in (55, 27)]
    part.bridge(lid[0], lid[1], GOO['lid_edge'])
    apex = part.ring([C + ln * Rl], E)[0]
    for m in range(8):
        part.face((lid[1][m], lid[1][(m + 1) % 8], apex), GOO['lid'])


# ------------------------------------------------------------------ restos tragados

def prop_ready(obj, mat, bone, M):
    """Lleva una pieza del pack a su lugar, con un solo mapa UV, el material del atlas y todo su peso
    en `bone`."""
    me = obj.data
    M = M @ obj.matrix_world
    for v in me.vertices:
        v.co = M @ v.co
    obj.matrix_world = Matrix.Identity(4)
    keep = me.uv_layers.active.name
    for n in [l.name for l in me.uv_layers if l.name != keep]:
        me.uv_layers.remove(me.uv_layers[n])
    me.uv_layers[keep].name = "UVMap"
    me.materials.clear()
    me.materials.append(mat)
    for p in me.polygons:
        p.material_index = 0
    obj.vertex_groups.clear()
    obj.vertex_groups.new(name=bone).add(range(len(me.vertices)), 1.0, 'REPLACE')
    return obj


def skull_head(atlas):
    """La cabeza con casco del esqueleto soldado de la horda, sacada de Characters.fbx."""
    before = set(bpy.data.objects)
    load_synty()
    new = [o for o in bpy.data.objects if o not in before]
    src = bpy.data.objects["Character_Skeleton_Soldier_01"]
    head = copy_part(src, ("Head", "Eyes", "Eyebrows", "Jaw"), {}, atlas, "Slime_skull")
    mw = head.matrix_world.copy()
    for v in head.data.vertices:
        v.co = mw @ v.co
    head.parent = None
    head.matrix_world = Matrix.Identity(4)
    head.modifiers.clear()
    for o in new:
        bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.armatures, bpy.data.actions):
        for d in list(coll):
            if d.users == 0:
                coll.remove(d)
    return head


def debris(mat, atlas):
    out = []
    # el cráneo con casco, de costado a la izquierda, mirando para afuera y un poco para arriba
    head = skull_head(atlas)
    c0 = Vector((0.0, 0.0, 1.655))
    p = JUNK["Junk_Skull"] + normal(math.radians(62), 0.66) * 0.02
    M = (Matrix.Translation(p) @ Matrix.Rotation(math.radians(48), 4, 'Z') @ Matrix.Rotation(math.radians(-36), 4, 'X')
         @ Matrix.Rotation(math.radians(-16), 4, 'Y') @ Matrix.Translation(-c0))
    out.append(prop_ready(head, mat, "Junk_Skull", M))
    # la espada rota clavada arriba atrás a la derecha: se ve el mango y un poco de hoja
    sword = import_prop("SM_Wep_BrokenSword_01")
    a = math.radians(-140)
    n = normal(a, 0.80)
    blade = (-n * 0.55 + Vector((0, 0, -1.0))).normalized()      # de la guarda a la punta, hacia adentro
    guard = JUNK["Junk_Sword"] - blade * 0.30
    R = Vector((0, 0, 1)).rotation_difference(blade).to_matrix().to_4x4()
    M = Matrix.Translation(guard) @ R @ Matrix.Rotation(math.radians(40), 4, 'Z') @ Matrix.Scale(125, 4)
    out.append(prop_ready(sword, mat, "Junk_Sword", M))
    # un fémur que asoma abajo a la derecha
    bone = import_prop("SM_Wep_Bone_01")
    a = math.radians(-76)
    axis = (normal(a, 0.27) + Vector((0, -0.2, 0.75))).normalized()
    R = Vector((0, 0, 1)).rotation_difference(axis).to_matrix().to_4x4()
    M = Matrix.Translation(JUNK["Junk_Bone"] + axis * 0.08) @ R @ Matrix.Scale(68, 4)
    out.append(prop_ready(bone, mat, "Junk_Bone", M))
    return out


# ------------------------------------------------------------------ animación

def curve(f, keys, loop=None):
    """Valor en el cuadro f de claves [(cuadro, valor), ...] con tangentes suaves que se frenan en los
    extremos (como las asas automáticas de Blender). Con loop=N las claves dan la vuelta (N es 0)."""
    fs, vs = [k[0] for k in keys], [k[1] for k in keys]
    if loop:
        f = f % loop
        fs = [x - loop for x in fs[-2:]] + fs + [x + loop for x in fs[:2]]
        vs = vs[-2:] + vs + vs[:2]
    else:
        if f <= fs[0]:
            return vs[0]
        if f >= fs[-1]:
            return vs[-1]
        fs, vs = [fs[0] - 1] + fs + [fs[-1] + 1], [vs[0]] + vs + [vs[-1]]

    def tan(i):
        if (vs[i] - vs[i - 1]) * (vs[i + 1] - vs[i]) <= 0:
            return 0.0
        return (vs[i + 1] - vs[i - 1]) / (fs[i + 1] - fs[i - 1])
    for i in range(1, len(fs) - 2):
        if fs[i] <= f <= fs[i + 1]:
            h = fs[i + 1] - fs[i]
            t = (f - fs[i]) / h
            t2, t3 = t * t, t * t * t
            return ((2 * t3 - 3 * t2 + 1) * vs[i] + (t3 - 2 * t2 + t) * h * tan(i)
                    + (-2 * t3 + 3 * t2) * vs[i + 1] + (t3 - t2) * h * tan(i + 1))
    return vs[-1]


def vol(sz, sy=None):
    """Escala que más o menos conserva el volumen: sz en vertical; con sy (hacia adelante) compensa
    solo el ancho."""
    if sy is None:
        s = 1 / math.sqrt(sz)
        return (s, s, sz)
    return ((1 / (sz * sy)) ** 0.6, sy, sz)


def put(P, bone, loc=(0, 0, 0), rot=(0, 0, 0), scl=(1, 1, 1), pivot=None):
    """Suma un movimiento del hueso en el cuadro: escala y giro (grados, ejes del mundo) alrededor de
    `pivot` (la cabeza del hueso si no se da) y después un corrimiento."""
    pv = Vector(pivot) if pivot is not None else HEADS[bone]
    D = (Matrix.Translation(pv + Vector(loc)) @ Euler([math.radians(x) for x in rot], 'XYZ').to_matrix().to_4x4()
         @ Matrix.Diagonal((*scl, 1.0)) @ Matrix.Translation(-pv))
    P[bone] = P[bone] @ D if bone in P else D


def lobe(P, name, radial=1.0, zs=1.0, tang=1.0, loc=(0, 0, 0)):
    scl = (radial, tang, zs) if name in ("Lobe_L", "Lobe_R") else (tang, radial, zs)
    put(P, name, loc=loc, scl=scl)


def follow(A, Q, p):
    """Movimiento rígido que lleva el punto p del cuerpo a donde lo llevan los huesos que lo pesan. El
    giro es el promedio de los giros de esos huesos sin sus escalas: con la baba aplastada, el giro de
    la deformación se tuerce mucho."""
    w = body_w(p)
    M = sum((A[b] * v for b, v in w.items()), Matrix.Identity(4) * 0)
    ref = Q[max(w, key=w.get)]
    q = sum((Q[b] * (v if Q[b].dot(ref) >= 0 else -v) for b, v in w.items()), Quaternion((0, 0, 0, 0)))
    q.normalize()
    return Matrix.Translation(M @ p) @ q.to_matrix().to_4x4() @ Matrix.Translation(-p), q


def solve(P):
    """Matrices de cada hueso en el espacio de la armadura (relativas a la pose de reposo)."""
    A, Q = {}, {}
    for name, head, tail, parent in BONES:
        D = P.get(name, Matrix.Identity(4))
        qd = D.decompose()[1]
        if name in FOLLOW:
            F, qf = follow(A, Q, FOLLOW[name])
            A[name], Q[name] = F @ D, qf @ qd
        elif parent:
            A[name], Q[name] = A[parent] @ D, Q[parent] @ qd
        else:
            A[name], Q[name] = D, qd
    return A


def bake(arm, name, frames, fn):
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    arm.animation_data.action = act
    prev = {}
    for f in range(frames + 1):
        A = solve(fn(f))
        for b in arm.data.bones:
            pb = arm.pose.bones[b.name]
            par = A[b.parent.name] if b.parent else Matrix.Identity(4)
            R = b.matrix_local
            loc, q, s = (R.inverted() @ par.inverted() @ A[b.name] @ R).decompose()
            if b.name in prev and prev[b.name].dot(q) < 0:
                q.negate()
            prev[b.name] = q
            pb.location, pb.rotation_quaternion, pb.scale = loc, q, s
            for path in ("location", "rotation_quaternion", "scale"):
                pb.keyframe_insert(path, frame=f)
    return act


def eyes_look(P, yaw, pitch=0.0, sway=(0, 0, 0)):
    """Los dos ojos: la pupila gira (yaw + = a su izquierda, pitch + = arriba) y el pedúnculo se mece
    (grados en ejes del mundo)."""
    for s in ("L", "R"):
        put(P, "Eye_" + s, rot=sway)
        put(P, "Pupil_" + s, rot=(-pitch, 0, yaw))


def idle(f, n=60):
    w = 2 * math.pi * f / n
    P = {}
    put(P, "Base", scl=vol(1 + 0.035 * math.sin(w)))
    put(P, "Mid", rot=(1.8 * math.sin(w - 0.8), 2.4 * math.sin(w - 0.4), 0))
    put(P, "Top", rot=(2.4 * math.sin(w - 1.7), 3.4 * math.sin(w - 1.3), 2.0 * math.sin(w)),
        scl=vol(1 + 0.03 * math.sin(2 * w - 1.4)))
    for k, name in enumerate(("Lobe_F", "Lobe_L", "Lobe_B", "Lobe_R")):
        s = math.sin(w - k * math.pi / 2)
        lobe(P, name, radial=1 + 0.07 * s, zs=1 + 0.14 * s)
    put(P, "Jaw", rot=(3 + 3 * math.sin(w - 0.5), 0, 0))
    look = curve(f, [(0, 0), (8, 0), (11, 30), (24, 30), (27, -28), (40, -28), (43, 0), (60, 0)])
    lag = curve(f - 3, [(0, 0), (8, 0), (11, 30), (24, 30), (27, -28), (40, -28), (43, 0), (60, 0)])
    up = curve(f, [(0, 0), (44, 0), (47, 14), (56, 14), (59, 0)])
    blink = curve(f, [(0, 1), (49, 1), (51, 0.15), (54, 1)])
    for side, s in ((1, "L"), (-1, "R")):
        put(P, "Eye_" + s, rot=(3 * math.sin(w + 0.7 * side) - 0.25 * up, 0.35 * lag + 2.5 * math.sin(w + side), 0.2 * lag))
        if blink < 1:
            put(P, "Eye_" + s, scl=(1, 1, blink), pivot=mirror(EYE_C, side))
        put(P, "Pupil_" + s, rot=(-up, 0, look))
    return P


def walking(f, n=30):
    """Se desliza con una onda que corre de adelante para atrás: estira el frente y se inclina, la
    panza pasa por el medio y atrás empuja; la punta de arriba llega tarde. Una onda por vuelta de 1 s:
    a 1.5·H/1.8 ≈ 1.05 m/s avanza un metro por onda, más o menos lo que mide de adelante a atrás."""
    c = lambda keys: curve(f, keys, loop=n)
    P = {}
    sz = c([(0, 1.05), (8, 0.91), (15, 0.95), (23, 1.07)])
    sy = c([(0, 0.95), (8, 1.13), (15, 1.06), (23, 0.93)])
    put(P, "Base", loc=(0, c([(0, 0.025), (8, -0.06), (15, -0.045), (23, 0.03)]), 0), scl=vol(sz, sy))
    put(P, "Mid", rot=(c([(0, 3), (8, 12), (15, 10), (23, 2)]), c([(0, -1.5), (15, 1.5)]), 0))
    put(P, "Top", rot=(c([(0, -1), (8, 8), (15, 15), (23, 6)]), c([(4, -2.5), (19, 2.5)]), c([(0, 2), (15, -2)])))
    lobe(P, "Lobe_F", radial=c([(0, 1.0), (8, 1.34), (15, 1.16), (23, 0.94)]), zs=c([(0, 1.0), (8, 1.3), (15, 0.9), (23, 0.88)]))
    for name in ("Lobe_L", "Lobe_R"):
        lobe(P, name, radial=c([(0, 1.0), (8, 1.04), (15, 1.2), (23, 1.04)]), zs=c([(0, 1.0), (8, 0.95), (15, 1.25), (23, 1.0)]))
    lobe(P, "Lobe_B", radial=c([(0, 1.16), (8, 0.9), (15, 0.96), (23, 1.3)]), zs=c([(0, 1.05), (8, 0.85), (15, 1.0), (23, 1.3)]))
    put(P, "Jaw", rot=(c([(0, 2), (8, 7), (15, 4), (23, 1)]), 0, 0))
    eyes_look(P, 0, pitch=-4, sway=(c([(0, 6), (8, -8), (15, -11), (23, 4)]), c([(4, 3), (19, -3)]), 0))
    return P


RUN = 20


def running(f, n=RUN):
    """Saltos largos: junta, se lanza estirándose para adelante, vuela largo y bajo (se despega del
    piso ~19 cm) y cae aplastado. Un salto cada 0.67 s: a 4·H/1.8 ≈ 2.8 m/s son ~1.9 m por salto."""
    c = lambda keys: curve(f, keys, loop=n)
    P = {}
    sz = c([(0, 0.80), (5, 1.20), (10, 0.86), (15, 0.68)])
    sy = c([(0, 1.04), (5, 0.92), (10, 1.38), (15, 1.18)])
    hop = c([(0, 0), (5, 0.08), (10, 0.19), (15, 0)])
    put(P, "Base", loc=(0, c([(0, 0.04), (5, -0.02), (10, -0.12), (15, -0.02)]), hop), scl=vol(sz, sy))
    put(P, "Mid", rot=(c([(0, 2), (5, 18), (10, 16), (15, -2)]), 0, 0))
    put(P, "Top", rot=(c([(0, -4), (5, 8), (10, 22), (15, 10)]), 0, 0),
        scl=vol(c([(0, 0.9), (5, 1.1), (10, 1.0), (15, 0.86)])))
    lobe(P, "Lobe_F", radial=c([(0, 1.0), (5, 1.2), (10, 1.5), (15, 1.35)]), zs=c([(0, 1.1), (5, 1.0), (10, 0.8), (15, 0.65)]), loc=(0, 0, hop))
    lobe(P, "Lobe_B", radial=c([(0, 1.15), (5, 1.4), (10, 1.2), (15, 0.9)]), zs=c([(0, 1.0), (5, 1.1), (10, 0.9), (15, 0.65)]), loc=(0, 0, hop))
    for name in ("Lobe_L", "Lobe_R"):
        lobe(P, name, radial=c([(0, 1.15), (5, 0.88), (10, 0.92), (15, 1.4)]), zs=c([(0, 1.0), (5, 1.0), (10, 0.85), (15, 0.65)]), loc=(0, 0, hop))
    put(P, "Jaw", rot=(c([(0, 2), (5, 10), (10, 22), (15, 4)]), 0, 0))
    eyes_look(P, 0, pitch=-6, sway=(c([(0, 10), (5, -18), (10, -24), (15, 16)]), 0, 0))
    return P


ATTACK = 27     # 0.9 s; el golpe cae en el cuadro 12 (45 %)


def attack(f):
    """Se para alto y para atrás con la boca abierta, y cae de golpe hacia adelante cerrándola."""
    c = lambda keys: curve(f, keys)
    P = {}
    sz = c([(0, 1.0), (8, 1.26), (10, 1.28), (12, 0.66), (15, 0.8), (18, 1.08), (21, 0.97), (24, 1.0)])
    put(P, "Base", loc=(0, c([(0, 0), (8, 0.14), (10, 0.15), (12, -0.18), (16, -0.13), (22, 0.0)]), 0), scl=vol(sz))
    put(P, "Mid", rot=(c([(0, 0), (8, -20), (10, -23), (12, 12), (15, 10), (19, -4), (23, 2), (26, 0)]), 0, 0))
    put(P, "Top", rot=(c([(0, 0), (8, -16), (10, -25), (12, 2), (15, 10), (19, -6), (23, 2), (26, 0)]), 0, 0))
    put(P, "Jaw", rot=(c([(0, 0), (8, 38), (10, 44), (12, -2), (15, 6), (20, 0)]), 0, 0))
    lobe(P, "Lobe_F", radial=c([(0, 1), (8, 0.85), (12, 1.55), (16, 1.42), (23, 1.0)]), zs=c([(0, 1), (8, 1.1), (12, 0.6), (18, 1.0)]))
    lobe(P, "Lobe_B", radial=c([(0, 1), (8, 1.25), (12, 0.95), (18, 1.0)]))
    for name in ("Lobe_L", "Lobe_R"):
        lobe(P, name, radial=c([(0, 1), (8, 0.92), (12, 1.35), (17, 1.1), (23, 1.0)]), zs=c([(0, 1), (12, 0.7), (18, 1.0)]))
    eyes_look(P, 0, pitch=c([(0, 0), (8, 12), (11, -18), (16, -8), (22, 0)]),
              sway=(c([(0, 0), (8, -10), (10, -14), (12, -16), (15, 6), (19, -4), (24, 0)]), 0, 0))
    return P


DEATH = 45      # 1.5 s; derretido y quieto desde el cuadro 15 (33 %)


def death(f):
    """Se estira del susto y se derrite en un charco; los ojos caen a los costados y quedan tirados
    arriba del charco, y los restos que tenía tragados quedan a la vista."""
    c = lambda keys: curve(f, keys)
    P = {}
    sz = c([(0, 1.0), (3, 1.12), (7, 0.62), (11, 0.2), (13, 0.12), (15, 0.13)])
    sxy = c([(0, 1.0), (3, 0.95), (7, 1.12), (11, 1.42), (13, 1.56), (15, 1.52)])
    put(P, "Base", scl=(sxy, sxy, sz))
    put(P, "Mid", rot=(c([(0, 0), (3, -6), (8, 10), (15, 4)]), c([(0, 0), (8, -6), (15, -3)]), 0), scl=(1, 1, c([(0, 1), (8, 0.8), (13, 0.55)])))
    put(P, "Top", rot=(c([(0, 0), (3, -8), (9, 14), (15, 6)]), c([(0, 0), (9, 8), (15, 4)]), 0), scl=(1, 1, c([(0, 1), (9, 0.7), (13, 0.5)])))
    put(P, "Jaw", rot=(c([(0, 0), (3, 28), (9, 14), (15, 8)]), 0, 0))
    for name in ("Lobe_F", "Lobe_B", "Lobe_L", "Lobe_R"):
        lobe(P, name, radial=c([(0, 1), (4, 0.95), (10, 1.38), (13, 1.5), (15, 1.46)]), tang=c([(0, 1), (13, 1.5)]),
             zs=c([(0, 1), (4, 1.1), (10, 0.5), (14, 0.32)]))
    # los ojos se caen a los costados y quedan tirados arriba del charco, bizcos
    k = c([(0, 0), (3, -0.15), (9, 0.7), (13, 1.06), (15, 1.0)])
    for side, s in ((1, "L"), (-1, "R")):
        put(P, "Eye_" + s, loc=(side * 0.075 * k, 0.02 * k, -0.14 * k),
            rot=(c([(0, 0), (3, -8), (9, -26), (13, -48), (15, -44)]), side * c([(0, 0), (3, -6), (9, 15), (13, 30), (15, 26)]), 0),
            scl=[c([(0, 1), (3, 1.18), (8, 1.0), (15, 0.92)])] * 3, pivot=mirror(EYE_C, side))
        put(P, "Pupil_" + s, rot=(c([(0, 0), (3, -10), (9, -6), (15, -14)]), 0, side * c([(0, 0), (9, 14), (15, 22)])))
    # el cráneo queda acostado arriba del charco; la espada y el fémur, clavados
    k = c([(0, 0), (5, 0), (14, 1)])
    put(P, "Junk_Skull", loc=(0, 0, 0.08 * k), rot=(-30 * k, 18 * k, 0))
    return P


# ------------------------------------------------------------------ armado

PREVIEW_FRAMES = [("Idle", 0), ("Idle", 20), ("Walking", 0), ("Walking", 15), ("Running", 5), ("Running", 12),
                  ("Attack", 9), ("Attack", 12), ("Hard Landing", 6), ("Hard Landing", 20)]


def build_beast(atlas_img, goo='violeta'):
    """Arma el limo en la escena vacía; `goo` elige el esquema de colores de GOOS."""
    global GOO
    GOO = GOOS[goo]
    sc = bpy.context.scene
    rnd = random.Random(SEED)
    mat = atlas_material(atlas_img)
    atlas = Atlas(atlas_img)
    junk = debris(mat, atlas)
    sc.render.fps, sc.render.fps_base = FPS, 1.0

    arm = make_armature()
    part = Part()
    body(part, rnd)
    lobes(part, rnd)
    bubbles(part, rnd)
    shine(part)
    drool(part)
    eye(part, 1, rnd)
    eye(part, -1, rnd)
    mesh = part.to_object(NAME, mat, recalc=False)
    join(mesh, junk)
    mesh.name = mesh.data.name = NAME
    me = mesh.data
    if me.has_custom_normals:
        with bpy.context.temp_override(object=mesh, active_object=mesh, selected_objects=[mesh], selected_editable_objects=[mesh]):
            bpy.ops.mesh.customdata_custom_splitnormals_clear()
    me.shade_flat()
    bind(mesh, arm)

    for a in list(bpy.data.actions):
        bpy.data.actions.remove(a)
    arm.animation_data_create()
    bake(arm, "Idle", 60, idle)
    bake(arm, "Walking", 30, walking)
    bake(arm, "Running", RUN, running)
    bake(arm, "Attack", ATTACK, attack)
    bake(arm, "Hard Landing", DEATH, death)
    arm.animation_data.action = None
    rest(arm)
    sc.frame_set(0)
    return arm, mesh


if __name__ == "__main__":
    # uso: ... -- <salida.glb> [--goo=verde]
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    pos = [a for a in argv if not a.startswith("--")]
    goo = next((a.split("=", 1)[1] for a in argv if a.startswith("--goo=")), 'violeta')
    out = os.path.abspath(pos[0] if pos else os.path.join(HERE, "..", "public", "models", "slime.glb"))
    bpy.ops.wm.read_factory_settings(use_empty=True)
    arm, mesh = build_beast(atlas_image(), goo)
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animation_mode='ACTIONS',
                              export_anim_single_armature=True, export_frame_range=False,
                              export_apply=False, export_yup=True)
    print("WROTE", out, os.path.getsize(out), "bytes,", len(mesh.data.vertices), "vertices")
