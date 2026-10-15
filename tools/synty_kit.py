"""Piezas comunes para armar personajes nuevos en el estilo de PolygonDungeon (Synty) con Blender.

Lo usan el mago de la cinemática (synty_mage.py) y los monstruos (monster_*.py, beast_*.py). Todo
trabaja en metros de mundo, con el personaje mirando a -Y (el frente de los de Synty; el exportador
de glTF lo pasa a +Z, que es el frente en el juego) y los pies en z = 0.

- Colores: los cuadritos de la paleta del atlas Dungeons_Texture_01. Cada cara apunta su UV al centro
  de un cuadrito, como hace el pack, así que todo comparte el mismo material. `pal_uv` acepta un nombre
  de PAL o "columna:fila" (ver COLS; fila 0 la más clara a 4 la más oscura) o un (x, y) en píxeles.
  La carta con los nombres se arma con `python tools/synty_kit.py carta <salida.png>`.
- Part: malla hecha de anillos (tubos, tapas), con color por cara y pesos por vértice.
- Weights: pesos copiados de los vértices más cercanos de otro personaje del pack.
- copy_part / recolor_by_bone: reusar pedazos de los personajes del pack (manos, pies, cabezas).
- fill_holes: tapar los bordes abiertos que quedan al recortar.
- load_synty / atlas_material / render: para armar y mirar sin abrir Blender (kit_preview.py).
"""
import math, os, random

try:
    import bpy, bmesh
    from mathutils import Vector, Matrix
    from mathutils.kdtree import KDTree
except ImportError:   # fuera de Blender solo sirve la carta de colores
    bpy = None

HERE = os.path.dirname(os.path.abspath(__file__))
SYNTY = os.path.normpath(os.path.join(HERE, "..", "..", "Assets", "PolygonDungeon"))
CHARACTERS_FBX = os.path.join(SYNTY, "Models", "Characters.fbx")
ATLAS_PNG = os.path.join(SYNTY, "Textures", "Dungeons_Texture_01.png")

ATLAS_SIZE = 1024
# la franja de la paleta: columnas (centro en x) y cinco filas, de la más clara a la más oscura
COLS = {
    'blue': 7, 'indigo': 22, 'dusk': 37, 'violet': 52, 'plum': 68, 'orchid': 84, 'mauve': 100, 'rose': 115,
    'brick': 130, 'clay': 161, 'orange': 177, 'mud': 192, 'tan': 208, 'gold': 223, 'mustard': 239,
    'grass': 254, 'lime': 270, 'moss': 285, 'sage': 301, 'teal': 316, 'aqua': 332, 'steel': 347,
    'ice': 378, 'stone': 394, 'ash': 410, 'grey': 428, 'wood': 444, 'leather': 462, 'maroon': 482, 'umber': 502,
}
ROWS = (520, 541, 566, 592, 614)
# otros cuadritos sueltos del atlas
EXTRA = {
    'skin': (16, 830), 'skin_dark': (14, 811), 'skin_shadow': (16, 855),
    'black': (15, 1015), 'white': (495, 1015), 'red': (141, 530), 'lips': (39, 808),
    'eye': (79, 1012),
}
# nombres del mago (y de lo que quiera reusarlos)
PAL = {
    'robe': (52, 566), 'robe_light': (52, 541), 'robe_dark': (52, 592), 'lining': (52, 614),
    'trim': (223, 541), 'trim_dark': (223, 592),
    'hair': (410, 520), 'hair_dark': (394, 541),
    'leather': (462, 566), 'leather_dark': (462, 592),
}
PAL.update(EXTRA)


def pal_xy(key):
    if isinstance(key, tuple):
        return key
    if key in PAL:
        return PAL[key]
    col, _, row = key.partition(':')
    return (COLS[col], ROWS[int(row or 2)])


def pal_uv(key):
    x, y = pal_xy(key)
    return ((x + 0.5) / ATLAS_SIZE, 1 - (y + 0.5) / ATLAS_SIZE)


def smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def top4(acc):
    best = sorted(((g, w) for g, w in acc.items() if w > 0), key=lambda kv: -kv[1])[:4]
    s = sum(w for _, w in best) or 1.0
    return {g: w / s for g, w in best}


if bpy is not None:

    class Atlas:
        """Lee colores del atlas en coordenadas UV (los valores crudos del PNG, 0..255)."""

        def __init__(self, img):
            self.w, self.h = img.size
            self.px = img.pixels[:]

        def rgb(self, u, v):
            x = min(self.w - 1, max(0, int((u % 1.0) * self.w)))
            y = min(self.h - 1, max(0, int((v % 1.0) * self.h)))
            i = (y * self.w + x) * 4
            return tuple(round(self.px[i + k] * 255) for k in range(3))

    def near(c, table, tol=6):
        for k, v in table.items():
            if all(abs(a - b) <= tol for a, b in zip(c, k)):
                return True, v
        return False, None

    def dominant(obj):
        names = {g.index: g.name for g in obj.vertex_groups}
        return [names[max(v.groups, key=lambda g: g.weight).group] if v.groups else "" for v in obj.data.vertices]

    def copy_part(src, keep_bones, colors, atlas, name):
        """Copia de un personaje del pack con solo los vértices de esos huesos (los que más pesan), con los
        colores de `colors` cambiados: {rgb del atlas: clave de pal_uv, o None para borrar esas caras}."""
        obj = src.copy()
        obj.data = src.data.copy()
        obj.name = name
        for c in src.users_collection:
            c.objects.link(obj)
        dom = dominant(obj)
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bm.verts.ensure_lookup_table()
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not dom[v.index].startswith(keep_bones)], context='VERTS')
        layers = list(bm.loops.layers.uv.values())
        main = bm.loops.layers.uv.active or layers[0]
        drop = []
        for f in bm.faces:
            u = sum(l[main].uv.x for l in f.loops) / len(f.loops)
            v = sum(l[main].uv.y for l in f.loops) / len(f.loops)
            hit, key = near(atlas.rgb(u, v), colors)
            if not hit:
                continue
            if key is None:
                drop.append(f)
                continue
            for l in f.loops:
                for lay in layers:
                    l[lay].uv = pal_uv(key)
        bmesh.ops.delete(bm, geom=drop, context='FACES')
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
        bm.to_mesh(obj.data)
        bm.free()
        return obj

    def recolor_by_bone(obj, atlas, bones, colors):
        """Cambia colores solo en las caras de esos huesos (prefijos de nombre)."""
        dom = dominant(obj)
        me = obj.data
        main = me.uv_layers.active
        for p in me.polygons:
            if not dom[p.vertices[0]].startswith(bones):
                continue
            u = sum(main.data[i].uv.x for i in p.loop_indices) / p.loop_total
            v = sum(main.data[i].uv.y for i in p.loop_indices) / p.loop_total
            hit, key = near(atlas.rgb(u, v), colors)
            if hit and key:
                for li in p.loop_indices:
                    for lay in me.uv_layers:
                        lay.data[li].uv = pal_uv(key)

    def recolor_all(obj, key):
        """Toda la malla de un solo color (para accesorios del pack: armas, cascos)."""
        me = obj.data
        for lay in me.uv_layers:
            for d in lay.data:
                d.uv = pal_uv(key)

    def colors_used(obj, atlas):
        """{rgb: cantidad de caras}, para saber qué colores trae una pieza del pack."""
        me = obj.data
        main = me.uv_layers.active
        out = {}
        for p in me.polygons:
            u = sum(main.data[i].uv.x for i in p.loop_indices) / p.loop_total
            v = sum(main.data[i].uv.y for i in p.loop_indices) / p.loop_total
            c = atlas.rgb(u, v)
            out[c] = out.get(c, 0) + 1
        return out

    class Part:
        """Malla en metros de mundo: anillos unidos en tubo, color por cara y pesos por vértice.
        `weights` de cada anillo es un dict {hueso: peso} o una función punto -> dict."""

        def __init__(self):
            self.verts, self.faces, self.keys, self.weights = [], [], [], []

        def ring(self, pts, weights):
            i0 = len(self.verts)
            self.verts += [Vector(p) for p in pts]
            self.weights += [weights(Vector(p)) if callable(weights) else weights for p in pts]
            return list(range(i0, len(self.verts)))

        def bridge(self, a, b, key, closed=True):
            keys = key if isinstance(key, list) else [key] * len(a)
            n = len(a)
            for j in range(n if closed else n - 1):
                k = (j + 1) % n
                self.faces.append((a[j], a[k], b[k], b[j]))
                self.keys.append(keys[j])

        def cap(self, a, key, point=None, weights=None):
            if point is None:
                self.faces.append(tuple(reversed(a)))
                self.keys.append(key)
                return
            c = self.ring([point], weights)[0]
            for j in range(len(a)):
                self.faces.append((a[(j + 1) % len(a)], a[j], c))
                self.keys.append(key)

        def face(self, idx, key):
            self.faces.append(tuple(idx))
            self.keys.append(key)

        def to_object(self, name, mat, like=None, collection=None, recalc=True):
            me = bpy.data.meshes.new(name)
            me.from_pydata([tuple(v) for v in self.verts], [], self.faces)
            names = [l.name for l in like.data.uv_layers] if like else ["UVMap"]
            for lname in names:
                me.uv_layers.new(name=lname)
            for p, key in zip(me.polygons, self.keys):
                for li in p.loop_indices:
                    for lay in me.uv_layers:
                        lay.data[li].uv = pal_uv(key)
            me.materials.append(mat)
            obj = bpy.data.objects.new(name, me)
            cols = like.users_collection if like else [collection or bpy.context.scene.collection]
            for c in cols:
                c.objects.link(obj)
            groups = {}
            for i, w in enumerate(self.weights):
                for g, val in (w or {}).items():
                    if val <= 0:
                        continue
                    if g not in groups:
                        groups[g] = obj.vertex_groups.new(name=g)
                    groups[g].add([i], val, 'REPLACE')
            if recalc:
                bm = bmesh.new()
                bm.from_mesh(me)
                bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
                bm.to_mesh(me)
                bm.free()
            return obj

    def ellipse(z, rx, ry, yc, angles, rnd, jitter=0.006, power=0.85, x0=0.0):
        """Anillo horizontal a la altura z; ángulo 0 = frente (-Y). power < 1 lo hace más cuadrado."""
        pts = []
        for a in angles:
            s, c = math.sin(a), math.cos(a)
            x = x0 + rx * math.copysign(abs(s) ** power, s)
            y = yc - ry * math.copysign(abs(c) ** power, c)
            pts.append((x + rnd.uniform(-jitter, jitter), y + rnd.uniform(-jitter, jitter), z + rnd.uniform(-jitter, jitter) * 0.5))
        return pts

    def sym_angles(half_deg):
        """Ángulos simétricos alrededor del cuerpo, medidos desde el frente (-Y)."""
        h = [math.radians(d) for d in half_deg]
        return [-a for a in reversed(h)] + h

    def ring_around(center, axis, radius_u, radius_v, n, rnd=None, jitter=0.0, phase=0.0, up=None):
        """Anillo de n puntos alrededor de `axis` (cualquier dirección): para miembros, colas, cuernos."""
        axis = Vector(axis).normalized()
        ref = Vector(up) if up is not None else (Vector((0, 0, 1)) if abs(axis.z) < 0.9 else Vector((0, -1, 0)))
        u = (ref - ref.dot(axis) * axis).normalized()
        v = axis.cross(u)
        out = []
        for j in range(n):
            a = phase + 2 * math.pi * j / n
            p = Vector(center) + u * (radius_u * math.cos(a)) + v * (radius_v * math.sin(a))
            if rnd and jitter:
                p += Vector((rnd.uniform(-jitter, jitter), rnd.uniform(-jitter, jitter), rnd.uniform(-jitter, jitter)))
            out.append(tuple(p))
        return out

    class Weights:
        """Pesos copiados del cuerpo de un personaje del pack: promedio de los vértices más cercanos.
        `allow(nombre_de_hueso)` filtra qué huesos se pueden copiar."""

        def __init__(self, src, allow=lambda g: True):
            names = {g.index: g.name for g in src.vertex_groups}
            mw = src.matrix_world
            self.data = []
            pts = []
            for v in src.data.vertices:
                w = {names[g.group]: g.weight for g in v.groups if allow(names[g.group])}
                if sum(w.values()) < 0.5:
                    continue
                pts.append(mw @ v.co)
                self.data.append(w)
            self.kd = KDTree(len(pts))
            for i, p in enumerate(pts):
                self.kd.insert(p, i)
            self.kd.balance()

        def __call__(self, p, k=6):
            acc = {}
            for _, i, d in self.kd.find_n(p, k):
                f = 1.0 / (d + 0.01) ** 2
                for g, w in self.data[i].items():
                    acc[g] = acc.get(g, 0.0) + w * f
            return top4(acc)

    class BoneWeights:
        """Pesos por cercanía a los huesos (segmentos cabeza-cola en reposo), sin otra malla de
        referencia: cada hueso pesa 1/d^power, con d la distancia al segmento. Sirve para cuerpos más
        anchos que cualquier personaje del pack."""

        def __init__(self, arm, bones, power=4.0):
            mw = arm.matrix_world
            self.segs = []
            for name in bones:
                b = arm.data.bones[name]
                self.segs.append((name, mw @ b.head_local, mw @ b.tail_local))
            self.power = power

        def __call__(self, p):
            acc = {}
            for name, a, b in self.segs:
                ab = b - a
                t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-9)))
                d = (p - (a + ab * t)).length
                acc[name] = 1.0 / (d + 0.02) ** self.power
            return top4(acc)

    def fill_holes(obj, pick, key):
        """Tapa los bordes abiertos cuyo centro (en metros de mundo) cumple `pick`, con el color `key`."""
        mw = obj.matrix_world
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bnd = {e for e in bm.edges if e.is_boundary}
        seen, new = set(), []
        for e in bnd:
            if e in seen:
                continue
            # recorre el borde siguiendo la vuelta de las caras vecinas, girando alrededor de cada vértice
            # hasta la próxima arista abierta (holes_fill no tapaba la base de la colita del mago)
            ring, cur = [], e.link_loops[0]
            for _ in range(1000):
                seen.add(cur.edge)
                ring.append(cur.vert)
                cur = cur.link_loop_next
                while not cur.edge.is_boundary:
                    cur = cur.link_loop_radial_next.link_loop_next
                if cur.edge in seen:
                    break
            c = sum((mw @ p.co for p in ring), Vector()) / len(ring)
            if not pick(c):
                continue
            for part in split_eights(ring):
                if len(part) >= 3:
                    new.append(bm.faces.new(list(reversed(part))))   # al revés que las vecinas
        layers = list(bm.loops.layers.uv.values())
        for f in new:
            for l in f.loops:
                for lay in layers:
                    l[lay].uv = pal_uv(key)
        bm.to_mesh(obj.data)
        bm.free()

    def split_eights(ring):
        """Dos agujeros que se tocan en un vértice salen como un solo borde en ocho, con ese vértice dos
        veces (las caras de alrededor llevan de uno al otro): se parte ahí en dos bordes simples."""
        out, todo = [], [ring]
        while todo:
            r = todo.pop()
            first = {}
            for j, v in enumerate(r):
                if v in first:
                    i = first[v]
                    todo += [r[i:j], r[:i] + r[j:]]
                    break
                first[v] = j
            else:
                out.append(r)
        return out

    def join(into, others):
        """Une las mallas en `into` (que conserva su padre y su modificador de armadura)."""
        objs = [into] + [o for o in others if o is not None]
        with bpy.context.temp_override(active_object=into, object=into, selected_objects=objs,
                                       selected_editable_objects=objs):
            bpy.ops.object.join()
        return into

    def bind(obj, arm):
        """Pone la malla bajo la armadura, con su modificador, sin moverla."""
        mw = obj.matrix_world.copy()
        obj.parent = arm
        obj.matrix_world = mw
        if not any(m.type == 'ARMATURE' for m in obj.modifiers):
            obj.modifiers.new("Armature", 'ARMATURE').object = arm
        return obj

    def to_local(obj):
        """Lleva los vértices a la escala del objeto (las mallas de Synty viven en cm bajo una armadura 0.01)."""
        inv = obj.matrix_world.inverted()
        for v in obj.data.vertices:
            v.co = inv @ v.co

    def import_prop(name, key=None):
        """Importa una pieza suelta del pack (SM_Wep_..., SM_Item_...) en metros, sin padre, centrada
        como viene. Con `key`, toda de ese color."""
        path = os.path.join(SYNTY, "Models", name + ".fbx")
        before = set(bpy.data.objects)
        bpy.ops.import_scene.fbx(filepath=path)
        new = [o for o in bpy.data.objects if o not in before]
        mesh = next(o for o in new if o.type == 'MESH')
        mw = mesh.matrix_world.copy()
        mesh.parent = None
        mesh.matrix_world = mw
        with bpy.context.temp_override(active_object=mesh, object=mesh, selected_objects=[mesh], selected_editable_objects=[mesh]):
            bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        for o in new:
            if o is not mesh:
                bpy.data.objects.remove(o, do_unlink=True)
        if key:
            recolor_all(mesh, key)
        return mesh

    def load_synty():
        """Importa Characters.fbx como lo usa retarget_to_glb.py: en metros, sin la toma de animación y en
        reposo. Devuelve la armadura."""
        before = set(bpy.data.objects)
        bpy.ops.import_scene.fbx(filepath=CHARACTERS_FBX)
        new = [o for o in bpy.data.objects if o not in before]
        arm = next(o for o in new if o.type == 'ARMATURE')
        arm.scale = (0.01, 0.01, 0.01)
        for o in new:
            if o.type != 'MESH':
                continue
            if o.name.startswith("Character_"):
                o.scale = (1.0, 1.0, 1.0)
            else:
                bpy.data.objects.remove(o, do_unlink=True)
        if arm.animation_data:
            arm.animation_data.action = None
        for pb in arm.pose.bones:
            pb.matrix_basis = Matrix.Identity(4)
        bpy.context.view_layer.update()
        return arm

    def atlas_material(img, name="Dungeon"):
        mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
        mat.use_nodes = True
        nt = mat.node_tree
        bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
        tex = next((n for n in nt.nodes if n.type == 'TEX_IMAGE'), None) or nt.nodes.new('ShaderNodeTexImage')
        tex.image = img
        tex.interpolation = 'Closest'
        nt.nodes.active = tex
        nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
        bsdf.inputs['Roughness'].default_value = 0.85
        bsdf.inputs['Metallic'].default_value = 0.0
        return mat

    def atlas_image():
        return bpy.data.images.load(ATLAS_PNG, check_existing=True)

    # ------------------------------------------------------------ vistas previas (Workbench)

    def _camera():
        sc = bpy.context.scene
        sc.render.engine = 'BLENDER_WORKBENCH'
        if sc.world is None:
            sc.world = bpy.data.worlds.new("Preview")
        sc.world.color = (0.18, 0.18, 0.2)
        sh = sc.display.shading
        sh.light = 'STUDIO'
        sh.color_type = 'TEXTURE'
        sh.show_cavity = False
        sh.show_object_outline = True
        sh.show_backface_culling = True      # como en el juego: un agujero se ve
        cam = bpy.data.objects.get('PreviewCam')
        if not cam:
            cam = bpy.data.objects.new('PreviewCam', bpy.data.cameras.new('PreviewCam'))
            sc.collection.objects.link(cam)
        sc.camera = cam
        return cam

    def render(objs, path, yaw=30.0, pitch=10.0, res=(480, 600), margin=1.15, target=None, size=None):
        """Renderiza solo `objs` (con la pose actual) desde un ángulo: yaw 0 = de frente, 90 = desde +X."""
        sc = bpy.context.scene
        cam = _camera()
        sc.render.resolution_x, sc.render.resolution_y = res
        sc.render.film_transparent = False
        names = {o.name for o in objs}
        for o in bpy.data.objects:
            if o.type == 'MESH':
                o.hide_render = o.name not in names
        dg = bpy.context.evaluated_depsgraph_get()
        pts = []
        for o in objs:
            oe = o.evaluated_get(dg)
            pts += [oe.matrix_world @ Vector(c) for c in oe.bound_box]
        mn = Vector([min(p[i] for p in pts) for i in range(3)])
        mx = Vector([max(p[i] for p in pts) for i in range(3)])
        c = Vector(target) if target is not None else (mn + mx) / 2
        radius = size if size is not None else (mx - mn).length / 2
        cam.data.lens = 50
        fov = 2 * math.atan(36 / 2 / 50) * min(1.0, res[1] / res[0])
        dist = radius * margin / math.tan(fov / 2)
        a, e = math.radians(yaw), math.radians(pitch)
        cam.location = c + Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * dist
        cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = path
        bpy.ops.render.render(write_still=True)
        return path

    def sheet(paths, out, cols=4):
        """Une imágenes del mismo tamaño en una grilla (con numpy, adentro de Blender)."""
        import numpy as np
        ims = []
        for p in paths:
            im = bpy.data.images.load(p)
            w, h = im.size
            a = np.array(im.pixels[:], dtype=np.float32).reshape(h, w, 4)
            ims.append(a)
            bpy.data.images.remove(im)
        h, w = ims[0].shape[:2]
        rows = (len(ims) + cols - 1) // cols
        grid = np.ones((rows * h, min(cols, len(ims)) * w, 4), dtype=np.float32) * 0.2
        grid[..., 3] = 1
        for i, a in enumerate(ims):
            r, c = divmod(i, cols)
            y0 = (rows - 1 - r) * h          # las filas de Blender van de abajo para arriba
            grid[y0:y0 + h, c * w:(c + 1) * w] = a[:h, :w]
        img = bpy.data.images.new("sheet", grid.shape[1], grid.shape[0])
        img.pixels = grid.ravel()
        img.filepath_raw = out
        img.file_format = 'PNG'
        img.save()
        bpy.data.images.remove(img)
        return out

    def pose_bone_world(arm, name, axis, deg):
        """Gira un hueso alrededor de su cabeza sobre un eje del mundo ('X' izquierda-derecha, 'Y'
        adelante-atrás, 'Z' arriba), para probar poses a mano. La armadura de Synty viene rotada 90° en X,
        así que el eje se pasa a su espacio antes de girar."""
        pb = arm.pose.bones[name]
        world = {'X': Vector((1, 0, 0)), 'Y': Vector((0, 1, 0)), 'Z': Vector((0, 0, 1))}[axis] if isinstance(axis, str) else Vector(axis)
        local = (arm.matrix_world.to_3x3().normalized().inverted() @ world).normalized()
        m = pb.matrix.copy()
        h = m.translation.copy()
        pb.matrix = Matrix.Translation(h) @ Matrix.Rotation(math.radians(deg), 4, local) @ Matrix.Translation(-h) @ m
        bpy.context.view_layer.update()

    def rest(arm):
        for pb in arm.pose.bones:
            pb.matrix_basis = Matrix.Identity(4)
        bpy.context.view_layer.update()


def carta(out):
    """La paleta con nombres, para elegir colores (corre con el Python común, con Pillow)."""
    from PIL import Image, ImageDraw
    src = Image.open(ATLAS_PNG).convert('RGB')
    cell = 44
    names = list(COLS) + list(EXTRA)
    img = Image.new('RGB', (cell * 5 + 120, cell * len(names) // 2 + 40), (40, 40, 40))
    img = Image.new('RGB', (2 * (cell * 5 + 130), (len(names) + 1) // 2 * cell + 10), (40, 40, 40))
    d = ImageDraw.Draw(img)
    for i, n in enumerate(names):
        col, row = divmod(i, (len(names) + 1) // 2)
        x0, y0 = col * (cell * 5 + 130), row * cell + 5
        d.text((x0 + 4, y0 + cell // 2 - 6), n, fill=(230, 230, 230))
        keys = [f"{n}:{r}" for r in range(5)] if n in COLS else [n]
        for k, key in enumerate(keys):
            c = src.getpixel(pal_xy(key))
            d.rectangle([x0 + 110 + k * cell, y0 + 2, x0 + 110 + (k + 1) * cell - 3, y0 + cell - 3], fill=c)
            if n in COLS:
                d.text((x0 + 112 + k * cell, y0 + 4), str(k), fill=(255, 255, 255) if sum(c) < 380 else (0, 0, 0))
    img.save(out)


if __name__ == "__main__" and bpy is None:
    import sys
    if len(sys.argv) >= 3 and sys.argv[1] == "carta":
        carta(sys.argv[2])
