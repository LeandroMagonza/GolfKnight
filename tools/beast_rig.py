"""Esqueleto, poses, horneado y exportación para los bichos que no son humanoides (beast_warg.py,
beast_spider.py). Todo en metros de mundo, mirando a -Y y con el piso en z = 0, como synty_kit.

- make_armature: la armadura desde una lista de huesos (nombre, cabeza, cola, padre, eje x). El eje x de
  cada hueso es el eje en el que se dobla, así una rotación en x es "flexionar" en todos.
- Pose: una pose por cuadro armada en espacio de armadura. El cuerpo gira con ángulos en los ejes del
  padre (rot) y las patas se apuntan a puntos calculados con IK analítica (two_bone + aim). No se usan
  restricciones de Blender: cada pose se pasa a rotación local y se clava como clave (bake), así que no
  hay nada que hornear ni limpiar antes de exportar.
- bake: una acción con una clave por cuadro de 0 a n; los loops repiten la primera pose en el último.
- tube / shard / section: piezas de malla con Part (tubos por una polilínea, púas de pelo, cortes del
  cuerpo con lomo, costados y panza de colores distintos).
- check_feet / gait_sheet: medir cuánto patina cada pie apoyado y mirar un paso cuadro por cuadro.
- run: lo que hace cada bicho corrido como script: escena vacía, armar, exportar el GLB.
"""
import bpy, math, os, sys
from mathutils import Vector, Matrix, Euler
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from synty_kit import *

FPS = 30


def axes(y_dir, x_hint):
    """Base de un hueso: y a lo largo del hueso, x lo más parecido a `x_hint`, z = x × y."""
    y = Vector(y_dir).normalized()
    x = Vector(x_hint) - y * Vector(x_hint).dot(y)
    if x.length < 1e-6:
        x = Vector((1, 0, 0)) if abs(y.x) < 0.9 else Vector((0, 0, 1))
        x -= y * x.dot(y)
    x.normalize()
    return Matrix((x, y, x.cross(y))).transposed()


def bone_matrix(head, y_dir, x_hint):
    m = axes(y_dir, x_hint).to_4x4()
    m.translation = Vector(head)
    return m


def make_armature(bones, name="Armature"):
    """bones: [(nombre, cabeza, cola, padre o None, eje x)], padres antes que hijos."""
    data = bpy.data.armatures.new(name)
    arm = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    for n, head, tail, parent, xh in bones:
        eb = data.edit_bones.new(n)
        eb.head, eb.tail = Vector(head), Vector(tail)
        eb.matrix = bone_matrix(head, eb.tail - eb.head, xh)    # fija el giro (roll)
        if parent:
            eb.parent = data.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in arm.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    return arm


class Rig:
    """Datos de reposo de la armadura para armar poses rápido, sin evaluar la escena."""

    def __init__(self, arm, movable=()):
        self.arm = arm
        bones = arm.data.bones
        self.parent = {b.name: (b.parent.name if b.parent else None) for b in bones}
        self.order = []
        todo = [b for b in bones if b.parent is None]
        while todo:
            b = todo.pop(0)
            self.order.append(b.name)
            todo += list(b.children)
        self.rest = {b.name: b.matrix_local.copy() for b in bones}
        self.rest3 = {n: m.to_3x3() for n, m in self.rest.items()}
        self.rel = {n: (self.rest[p].inverted() @ self.rest[n] if p else self.rest[n]) for n, p in self.parent.items()}
        self.length = {b.name: b.length for b in bones}
        # los huesos que además de girar se pueden mover (las raíces siempre)
        self.movable = set(movable) | {n for n, p in self.parent.items() if p is None}

    def pose(self):
        return Pose(self)


class Pose:
    """Una pose: matrices de cada hueso en espacio de armadura (M) y locales (L). Cada hueso se pone una
    vez y después de su padre; lo que no se toca queda como en reposo respecto del padre."""

    def __init__(self, rig):
        self.rig, self.M, self.L = rig, {}, {}

    def inherit(self, n):
        p = self.rig.parent[n]
        if p is None:
            return self.rig.rel[n]
        if p not in self.M:
            self.rot(p)
        return self.M[p] @ self.rig.rel[n]

    def head(self, n):
        return self.M[n].translation.copy() if n in self.M else self.inherit(n).translation

    def tail(self, n):
        return self.M[n] @ Vector((0, self.rig.length[n], 0))

    def _set(self, n, inh, L):
        assert n not in self.M, f"hueso {n} puesto dos veces (o después de un hijo)"
        if n not in self.rig.movable:
            L.translation = Vector()
        self.L[n] = L
        self.M[n] = inh @ L

    def rot(self, n, rx=0.0, ry=0.0, rz=0.0, loc=None, pivot=None):
        """Gira el hueso (grados, en los ejes de la armadura como si el padre estuviera en reposo: o sea
        en los ejes del padre) alrededor de su cabeza o de `pivot` (en los mismos ejes), y lo corre `loc`."""
        R3 = self.rig.rest3[n]
        r = Euler((math.radians(rx), math.radians(ry), math.radians(rz)), 'XYZ').to_matrix()
        L = (R3.inverted() @ r @ R3).to_4x4()
        t = Vector(loc) if loc is not None else Vector()
        if pivot is not None:
            h = self.rig.rest[n].translation if self.rig.parent[n] is None else \
                (self.rig.rest[self.rig.parent[n]] @ self.rig.rel[n]).translation
            t += Vector(pivot) + r @ (h - Vector(pivot)) - h
        L.translation = R3.inverted() @ t
        self._set(n, self.inherit(n), L)

    def world(self, n, M):
        """El hueso con una matriz en espacio de armadura; si no se puede mover, solo gira."""
        inh = self.inherit(n)
        self._set(n, inh, inh.inverted() @ M)

    def aim(self, n, target, x_hint):
        """Apunta el hueso desde su cabeza (donde lo deja el padre) hacia `target`."""
        h = self.head(n)
        self.world(n, bone_matrix(h, Vector(target) - h, x_hint))

    def finish(self):
        for n in self.rig.order:
            if n not in self.M:
                self.rot(n)
        return self

    def key(self, frame, prev):
        pbs = self.rig.arm.pose.bones
        for n in self.rig.order:
            L = self.L[n]
            q = L.to_quaternion()
            if n in prev and prev[n].dot(q) < 0:      # sin saltos de signo entre cuadros
                q.negate()
            prev[n] = q
            pb = pbs[n]
            pb.rotation_quaternion = q
            pb.keyframe_insert("rotation_quaternion", frame=frame, group=n)
            if n in self.rig.movable:
                pb.location = L.translation
                pb.keyframe_insert("location", frame=frame, group=n)


def two_bone(a, c, l1, l2, pole):
    """IK de dos huesos de largo l1 y l2 desde `a` hacia `c`, con el codo del lado de `pole` (una
    dirección). Devuelve (codo, punta); si no llega, estira hasta casi derecho."""
    a, c, pole = Vector(a), Vector(c), Vector(pole)
    d = c - a
    dist = min(max(d.length, abs(l1 - l2) + 1e-4), (l1 + l2) * 0.9995)
    dn = d.normalized()
    ca = max(-1.0, min(1.0, (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist)))
    p = pole - dn * pole.dot(dn)
    p.normalize()
    return a + dn * (l1 * ca) + p * (l1 * math.sqrt(1 - ca * ca)), a + dn * dist


def bake(rig, name, nframes, pose_fn):
    """Acción con una clave por cuadro de 0 a nframes; pose_fn(t, u) arma la Pose para el segundo t
    (u = t / duración, de 0 a 1)."""
    arm = rig.arm
    bpy.context.scene.render.fps = FPS          # el exportador pasa cuadros a segundos con esto
    bpy.context.scene.render.fps_base = 1.0
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    arm.animation_data_create()
    arm.animation_data.action = act
    prev = {}
    for f in range(nframes + 1):
        pose_fn(f / FPS, f / nframes).finish().key(f, prev)
    arm.animation_data.action = None
    return act


# ------------------------------------------------------------ curvas

def smooth(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def ramp(t, a, b):
    """0 antes de a, 1 después de b, suave en el medio."""
    return smooth((t - a) / (b - a)) if b > a else float(t >= a)


def lerp(a, b, x):
    return a + (b - a) * x


def keys_at(t, pts):
    """Interpola suave entre claves [(t, valor)] (valor número o tupla); constante fuera del rango."""
    if t <= pts[0][0]:
        return pts[0][1]
    for (t0, v0), (t1, v1) in zip(pts, pts[1:]):
        if t <= t1:
            x = smooth((t - t0) / (t1 - t0))
            if isinstance(v0, (tuple, list)):
                return tuple(lerp(a, b, x) for a, b in zip(v0, v1))
            return lerp(v0, v1, x)
    return pts[-1][1]


def wave(u, cycles=1.0, phase=0.0):
    return math.sin(2 * math.pi * (u * cycles - phase))


# ------------------------------------------------------------ piezas de malla

def tube(part, pts, radii, n, weights, keys, rnd=None, jitter=0.0, up=(0, 0, 1), phase=0.0):
    """Tubo de anillos de n lados por los puntos `pts`. radii: r o (r en la dirección de `up`, r de
    costado) por punto; weights y keys: uno solo o una lista (pesos por anillo, color por tramo o lista
    por cara, o uno solo para todo). Devuelve los anillos, para taparlos o seguirlos."""
    pts = [Vector(p) for p in pts]
    rings = []
    for i, p in enumerate(pts):
        ax = pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]
        r = radii[i]
        ru, rv = (r, r) if isinstance(r, (int, float)) else r
        w = weights[i] if isinstance(weights, list) else weights
        rings.append(part.ring(ring_around(p, ax, ru, rv, n, rnd, jitter, phase, up), w))
    for i in range(len(rings) - 1):
        part.bridge(rings[i], rings[i + 1], keys[i] if isinstance(keys, list) else keys)
    return rings


def section(center, axis, up, w, top, bot, n, rnd=None, jitter=0.0, power=0.8, ridge=0.0):
    """Corte de un cuerpo: anillo de n puntos en el plano perpendicular a `axis`, con el punto 0 arriba
    (lomo) y yendo hacia +x; medio ancho w, alto `top` arriba del centro y `bot` abajo. `ridge` levanta
    el punto del lomo (para la cresta)."""
    axis = Vector(axis).normalized()
    u = Vector(up) - axis * Vector(up).dot(axis)
    u.normalize()
    s = u.cross(axis)
    if s.x < 0:
        s = -s
    pts = []
    for j in range(n):
        a = 2 * math.pi * j / n
        sa, ca = math.sin(a), math.cos(a)
        x = w * math.copysign(abs(sa) ** power, sa)
        z = (top if ca > 0 else bot) * math.copysign(abs(ca) ** power, ca)
        if j == 0:
            z += ridge
        p = Vector(center) + s * x + u * z
        if rnd and jitter:
            p += Vector((rnd.uniform(-jitter, jitter), rnd.uniform(-jitter, jitter), rnd.uniform(-jitter, jitter)))
        pts.append(tuple(p))
    return pts


def band_keys(n, top, side, belly, low=None):
    """Colores por cara de un anillo de `section` (cara j entre los puntos j y j+1): lomo, costados,
    panza; `low` para la franja entre costado y panza."""
    out = []
    for j in range(n):
        a = math.cos(2 * math.pi * (j + 0.5) / n)        # 1 arriba, -1 abajo
        if a > 0.55:
            out.append(top)
        elif a > -0.25:
            out.append(side)
        elif a > -0.75 and low:
            out.append(low)
        else:
            out.append(belly)
    return out


def shard(part, base, tip, key, w, base_key=None):
    """Púa: base de 3 o 4 puntos (metida en el cuerpo) y una punta."""
    b = part.ring(base, w)
    t = part.ring([tip], w)[0]
    for j in range(len(b)):
        part.face((b[j], b[(j + 1) % len(b)], t), key if not isinstance(key, list) else key[j % len(key)])
    part.cap(b, base_key or (key if not isinstance(key, list) else key[0]))


# ------------------------------------------------------------ medir y mirar

def mesh_stats(mesh):
    pts = [(mesh.matrix_world @ v.co) for v in mesh.data.vertices]
    mn = Vector([min(p[i] for p in pts) for i in range(3)])
    mx = Vector([max(p[i] for p in pts) for i in range(3)])
    return len(mesh.data.vertices), mn, mx


def check_feet(arm, action, feet, speed, ground=0.035):
    """Cuánto patina cada punto de apoyo: con el cuerpo avanzando a `speed` hacia -Y, mientras el punto
    está en el piso (z < ground) su y en el mundo (y - speed·t) tiene que quedar quieta. feet: [(hueso,
    'head'|'tail')]. Devuelve {hueso: (patinada máxima en m, cuadros apoyado)}."""
    arm.animation_data_create()
    arm.animation_data.action = action
    f0, f1 = int(action.frame_range[0]), int(action.frame_range[1])
    out = {}
    tracks = {b: [] for b, _ in feet}
    for f in range(f0, f1 + 1):
        bpy.context.scene.frame_set(f)
        for b, end in feet:
            pb = arm.pose.bones[b]
            p = arm.matrix_world @ (pb.tail if end == 'tail' else pb.head)
            tracks[b].append((p.y, p.z, f))
    for b, tr in tracks.items():
        worst, down, run = 0.0, 0, []
        for (y, z, f) in tr + [(0, 9, -1)]:
            if z < ground:
                run.append(y - speed * f / FPS)
                down += 1
            else:
                if len(run) > 1:
                    worst = max(worst, max(run) - min(run))
                run = []
        out[b] = (round(worst, 4), down)
    arm.animation_data.action = None
    return out


def gait_sheet(arm, mesh, action, frames, out, yaw=90.0, pitch=8.0, target=(0, 0, 0.6), size=1.4, cols=4,
               res=(360, 300)):
    """Cuadros de una acción con la cámara quieta, en una grilla, para juzgar el movimiento."""
    parts = os.path.splitext(out)[0] + "_parts"
    os.makedirs(parts, exist_ok=True)
    arm.animation_data_create()
    arm.animation_data.action = bpy.data.actions[action]
    paths = []
    for f in frames:
        bpy.context.scene.frame_set(f)
        paths.append(render([mesh], os.path.join(parts, f"{action.replace(' ', '_')}_{f:03d}.png"), yaw=yaw,
                            pitch=pitch, res=res, target=target, size=size))
    sheet(paths, out, cols=cols)
    arm.animation_data.action = None
    return out


def export_glb(arm, out):
    if arm.animation_data:
        arm.animation_data.action = None
    rest(arm)
    bpy.context.scene.render.fps, bpy.context.scene.render.fps_base = FPS, 1.0
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animation_mode='ACTIONS',
                              export_anim_single_armature=True, export_frame_range=False,
                              export_apply=False, export_yup=True)
    print("WROTE", out, os.path.getsize(out), "bytes")


def run(build_beast):
    """Como script: escena vacía, armar el bicho y exportar al GLB que viene después de `--`."""
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    bpy.ops.wm.read_factory_settings(use_empty=True)
    arm, mesh = build_beast(atlas_image())
    n, mn, mx = mesh_stats(mesh)
    print(f"{mesh.name}: {n} vértices, {len(mesh.data.polygons)} caras, {len(arm.data.bones)} huesos, "
          f"caja x {mn.x:.2f}..{mx.x:.2f} y {mn.y:.2f}..{mx.y:.2f} z {mn.z:.3f}..{mx.z:.3f}")
    for a in bpy.data.actions:
        f0, f1 = a.frame_range
        print(f"  acción {a.name}: cuadros {int(f0)}-{int(f1)} ({(f1 - f0) / FPS:.2f} s)")
    if argv:
        export_glb(arm, os.path.abspath(argv[0]))
