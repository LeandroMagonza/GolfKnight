"""Junta props estáticos de PolygonDungeon (escudos, estandartes...) en un solo GLB, con el atlas de
texturas del pack. Cada prop queda como un nodo con el nombre del archivo, sin el «SM_Wep_».

Uso:
  blender -b --python tools/props_to_glb.py -- <carpeta con los .fbx> <atlas.png> <salida.glb>

Ejemplo (los escudos):
  blender -b --python tools/props_to_glb.py -- assets/props/shields assets/props/shields/Dungeons_Texture_01.png public/models/shields.glb
"""
import bpy, sys, os, glob

argv = sys.argv[sys.argv.index('--') + 1:]
src_dir, atlas, out = argv

bpy.ops.wm.read_factory_settings(use_empty=True)

img = bpy.data.images.load(os.path.abspath(atlas))
mat = bpy.data.materials.new('Dungeons')
mat.use_nodes = True
nodes = mat.node_tree.nodes
bsdf = nodes['Principled BSDF']
bsdf.inputs['Roughness'].default_value = 0.8
tex = nodes.new('ShaderNodeTexImage')
tex.image = img
mat.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])

for path in sorted(glob.glob(os.path.join(src_dir, '*.fbx'))):
    name = os.path.splitext(os.path.basename(path))[0].replace('SM_Wep_', '')
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=os.path.abspath(path))
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == 'MESH']
    # todo a metros y sin rotaciones colgadas: el juego lo acomoda por su caja
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if len(meshes) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.parent = None
    obj.location = (0, 0, 0)
    obj.name = name
    obj.data.name = name
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    for o in new:
        if o != obj and o.name in bpy.data.objects:
            bpy.data.objects.remove(o, do_unlink=True)

os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath(out), export_format='GLB', export_apply=True)
print('props:', [o.name for o in bpy.data.objects])
