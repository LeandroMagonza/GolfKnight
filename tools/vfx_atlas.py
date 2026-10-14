# El atlas de los efectos (14/10, ver docs/assets.md): junta en una sola textura las máscaras de Cartoon FX
# Remaster, Hovl y GAPH (sacadas con tools/inventario-assets.py a assets/vfx-src/), en escala de grises: el
# color lo pone el juego. Cada sprite se achica a lo que se necesita en pantalla. Deja public/fx/atlas.webp y
# src/game/fxAtlas.ts (dónde está cada uno). Además arma public/fx/bubble.webp, la textura de la burbuja del
# bendito: R ruido, G otro ruido, B la máscara en bandas, A los hexágonos (las cuatro se repiten).
#
#   python tools/vfx_atlas.py
import os
from PIL import Image, ImageOps

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'assets', 'vfx-src', 'Assets')
CFXR = 'JMO Assets/Cartoon FX Remaster/CFXR Assets/Graphics/cfxr '
HOVL = 'Hovl Studio/HSFiles/Textures/'
GAPH = 'SpecialSkillsEffectsPack/Textures/SimpleTextures/'
BUB = 'MagicSheildBubbles_HDRP/Art/Textures/'

# nombre: (archivo, ancho, alto, columnas, filas) — el tamaño es el del sprite entero en el atlas
SPRITES = {
    'hit': (CFXR + 'hit triangle.png', 64, 128, 1, 1),
    'spikes': (CFXR + 'spikes impact.png', 256, 256, 1, 1),
    'trait': (CFXR + 'stretch trait.png', 256, 64, 1, 1),
    'traitBlur': (CFXR + 'stretch trait blur.png', 256, 64, 1, 1),
    'stretchSpikes': (CFXR + 'stretch sipkes x2.png', 256, 256, 1, 2),
    'star': (CFXR + 'star.png', 128, 128, 1, 1),
    'flare': (CFXR + 'flare.png', 256, 128, 1, 1),
    'smoke': (CFXR + 'smoke cloud x4.png', 256, 256, 2, 2),
    'flame': (CFXR + 'flamme crisp.png', 64, 128, 1, 1),
    'fireBlur': (CFXR + 'fire circle blur.png', 128, 128, 1, 1),
    'ember': (CFXR + 'ember blur.png', 128, 64, 1, 1),
    'arcs': (CFXR + 'electric arcs x4.png', 256, 256, 1, 4),
    'spark': (CFXR + 'electric spark.png', 128, 128, 1, 1),
    'glow': (HOVL + 'Glow1.png', 128, 128, 1, 1),
    'snow': (HOVL + 'Snow5.png', 128, 128, 1, 1),
    'plus': (HOVL + 'Plus1.png', 128, 128, 1, 1),
    'point': (HOVL + 'Point12.png', 64, 64, 1, 1),
    'cross': (HOVL + 'Flare6.png', 128, 128, 1, 1),
    'circle': (HOVL + 'MagicCircle77.png', 256, 256, 1, 1),
    'crater': (HOVL + 'Crater13.png', 128, 128, 1, 1),
    'holy': (GAPH + 'HolyTexture.png', 128, 128, 1, 1),
    'crack': (GAPH + 'Crack.png', 256, 256, 1, 1),
}
SIZE = 1024
PAD = 2
# debajo de esto es fondo (ver `intensity`)
BLACK = 14


def intensity(path):
    """La máscara en grises: el brillo por el alfa (como se vería aditivo sobre negro)."""
    im = Image.open(path)
    if im.mode in ('LA', 'RGBA', 'P'):
        im = im.convert('RGBA')
        black = Image.new('RGBA', im.size, (0, 0, 0, 255))
        im = Image.alpha_composite(black, im)
    g = ImageOps.grayscale(im.convert('RGB'))
    # el negro de fondo de algunas no es negro del todo: se recorta, si no queda un cuadrado tenue alrededor
    return g.point(lambda v: 0 if v < BLACK else min(255, round((v - BLACK) * 255 / (255 - BLACK))))


def pack():
    atlas = Image.new('L', (SIZE, SIZE), 0)
    # estantes: de más alto a más bajo
    order = sorted(SPRITES.items(), key=lambda kv: -kv[1][2])
    x = y = shelf = 0
    rects = {}
    for name, (rel, w, h, cols, rows) in order:
        if x + w > SIZE:
            x, y, shelf = 0, y + shelf + PAD, 0
        assert y + h <= SIZE, f'no entra {name}'
        img = intensity(os.path.join(SRC, rel)).resize((w, h), Image.LANCZOS)
        atlas.paste(img, (x, y))
        rects[name] = (x, y, w, h, cols, rows)
        x += w + PAD
        shelf = max(shelf, h)
    os.makedirs(os.path.join(ROOT, 'public', 'fx'), exist_ok=True)
    atlas.convert('RGB').save(os.path.join(ROOT, 'public', 'fx', 'atlas.webp'), quality=88, method=6)
    lines = [
        '// Generado por tools/vfx_atlas.py: no editar a mano. Dónde está cada sprite en public/fx/atlas.webp',
        '// (x, y, ancho, alto en px de un atlas de ' + str(SIZE) + '; y las columnas y filas si es una tira de cuadros).',
        f'export const FX_ATLAS_SIZE = {SIZE};',
        'export const FX_SPRITES = {',
    ]
    for name, r in rects.items():
        lines.append(f'  {name}: [{", ".join(str(v) for v in r)}],')
    lines.append('} as const;')
    lines.append('export type FxSprite = keyof typeof FX_SPRITES;')
    with open(os.path.join(ROOT, 'src', 'game', 'fxAtlas.ts'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(lines) + '\n')
    print('atlas', os.path.getsize(os.path.join(ROOT, 'public', 'fx', 'atlas.webp')) // 1024, 'KB, usado hasta y =', y + shelf)


def bubble():
    def gray(rel):
        return ImageOps.grayscale(Image.open(os.path.join(SRC, rel)).convert('RGB')).resize((256, 256), Image.LANCZOS)
    hexes = intensity(os.path.join(SRC, BUB + 'Shield01.png')).resize((256, 256), Image.LANCZOS)
    out = Image.merge('RGBA', (gray(BUB + 'T_noise01.png'), gray(BUB + 'T_noise02.png'), gray(BUB + 'ShieldMask02.png'), hexes))
    path = os.path.join(ROOT, 'public', 'fx', 'bubble.webp')
    out.save(path, quality=90, method=6, exact=True)
    print('burbuja', os.path.getsize(path) // 1024, 'KB')


if __name__ == '__main__':
    pack()
    bubble()
