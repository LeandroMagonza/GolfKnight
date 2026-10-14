# Inventario de los paquetes del Asset Store (13/10, Leandro: ver qué sirve de lo que bajó, sin abrir Unity).
# Un .unitypackage es un tar.gz con una carpeta por archivo (el GUID de Unity): `pathname` (la ruta en el
# proyecto), `asset` (el archivo) y a veces `preview.png` (la miniatura que muestra Unity). Por cada paquete
# deja en logs/assets-catalogo/: <paquete>.tsv con ruta y tamaño de cada archivo, y las miniaturas de los
# modelos y prefabs en previews/<paquete>/. No extrae los archivos (ver `--sacar`).
#
#   python tools/inventario-assets.py [carpeta del Asset Store] [--solo=texto] [--procesos=4]
#   python tools/inventario-assets.py --sacar=<paquete.unitypackage> --rutas=<archivo con una ruta por línea> --a=<carpeta>
import os
import re
import sys
import tarfile
from multiprocessing import Pool

STORE = os.path.expandvars(r'%APPDATA%\Unity\Asset Store-5.x')
OUT = os.path.join(os.path.dirname(__file__), '..', 'logs', 'assets-catalogo')
PREVIEW_EXT = ('.fbx', '.prefab', '.obj', '.blend', '.mat')


def short(pkg_path):
    vendor = os.path.basename(os.path.dirname(os.path.dirname(pkg_path)))
    name = os.path.splitext(os.path.basename(pkg_path))[0]
    return re.sub(r'[^\w\-]+', '_', f'{vendor}__{name}')


def safe(path):
    return re.sub(r'[^\w\-.]+', '_', path)[-150:]


def inventory(pkg_path):
    key = short(pkg_path)
    tsv = os.path.join(OUT, key + '.tsv')
    if os.path.exists(tsv):
        return key, 'ya estaba'
    entries = {}
    try:
        with tarfile.open(pkg_path, 'r:gz') as tar:
            for m in tar:
                parts = m.name.lstrip('./').split('/')
                if len(parts) != 2:
                    continue
                guid, leaf = parts
                e = entries.setdefault(guid, {})
                if leaf == 'pathname':
                    e['path'] = tar.extractfile(m).read().decode('utf-8', 'replace').splitlines()[0].strip()
                elif leaf == 'asset':
                    e['size'] = m.size
                elif leaf == 'preview.png':
                    e['preview'] = tar.extractfile(m).read()
    except Exception as ex:  # paquete cortado o raro
        return key, f'error: {ex}'
    rows = sorted((e['path'], e.get('size', -1)) for e in entries.values() if 'path' in e)
    prev_dir = os.path.join(OUT, 'previews', key)
    for e in entries.values():
        p = e.get('path', '')
        if 'preview' in e and p.lower().endswith(PREVIEW_EXT):
            os.makedirs(prev_dir, exist_ok=True)
            with open(os.path.join(prev_dir, safe(p) + '.png'), 'wb') as f:
                f.write(e['preview'])
    with open(tsv, 'w', encoding='utf-8') as f:
        for p, s in rows:
            f.write(f'{p}\t{s}\n')
    return key, f'{len(rows)} archivos'


def extract(pkg_path, wanted, dest):
    """Saca de un paquete los archivos de `wanted` (rutas del proyecto de Unity), con su carpeta."""
    paths, assets = {}, {}
    with tarfile.open(pkg_path, 'r:gz') as tar:
        for m in tar:
            parts = m.name.lstrip('./').split('/')
            if len(parts) != 2:
                continue
            guid, leaf = parts
            if leaf == 'pathname':
                paths[guid] = tar.extractfile(m).read().decode('utf-8', 'replace').splitlines()[0].strip()
            elif leaf == 'asset':
                assets[guid] = tar.extractfile(m).read()
    n = 0
    for guid, p in paths.items():
        if p in wanted and guid in assets:
            out = os.path.join(dest, p)
            os.makedirs(os.path.dirname(out), exist_ok=True)
            with open(out, 'wb') as f:
                f.write(assets[guid])
            n += 1
    print(f'{n} de {len(wanted)} archivos en {dest}')


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    opts = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--') and '=' in a)
    if 'sacar' in opts:
        wanted = set(l.strip() for l in open(opts['rutas'], encoding='utf-8') if l.strip())
        extract(opts['sacar'], wanted, opts['a'])
        return
    store = args[0] if args else STORE
    os.makedirs(OUT, exist_ok=True)
    pkgs = []
    for root, _, files in os.walk(store):
        for f in files:
            if f.endswith('.unitypackage') and opts.get('solo', '').lower() in os.path.join(root, f).lower():
                pkgs.append(os.path.join(root, f))
    # los más grandes primero, así no queda uno enorme para el final
    pkgs.sort(key=os.path.getsize, reverse=True)
    with Pool(int(opts.get('procesos', 4))) as pool:
        for key, msg in pool.imap_unordered(inventory, pkgs):
            print(f'{key}: {msg}', flush=True)
    print('listo-inventario', flush=True)


if __name__ == '__main__':
    main()
