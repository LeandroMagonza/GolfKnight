// Variar a los personajes de Synty sin tocar los modelos: cada uno lleva su propia copia del atlas de
// paleta con los colores cambiados. El atlas son cuadraditos de color plano, así que alcanza con
// reconocer cada color por familia (grises = metal, rojos = tela y detalles, el marrón del pelo, la
// piel) y llevarlo al tono nuevo conservando qué tan claro u oscuro era.
import * as THREE from 'three';
import type { Look } from './types';

/** El pelo de la Caballera (Character_Hero_Knight_Female) en el atlas. */
const HAIR = [106, 62, 44];
const SKIN = [[255, 204, 174], [237, 175, 151]];
/** Qué tan claro es el tono de referencia de cada familia: el metal más usado, el rojo más usado, el pelo. */
const REF_METAL = 0.66;
const REF_ACCENT = 0.43;
const REF_HAIR = 0.29;

const near = (r: number, g: number, b: number, c: number[], tol: number) =>
  Math.abs(r - c[0]) <= tol && Math.abs(g - c[1]) <= tol && Math.abs(b - c[2]) <= tol;

const scratch = new THREE.Color();
const hsl = { h: 0, s: 0, l: 0 };
const rgb = { r: 0, g: 0, b: 0 };

/** El color nuevo: el tono y la saturación de `target`, con la claridad del original escalada. */
function shade(r: number, g: number, b: number, target: THREE.Color, ref: number): [number, number, number] {
  const t = { h: 0, s: 0, l: 0 };
  target.getHSL(t, THREE.SRGBColorSpace);
  scratch.setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace).getHSL(hsl, THREE.SRGBColorSpace);
  const l = Math.min(0.95, hsl.l * (t.l / ref));
  scratch.setHSL(t.h, t.s, l, THREE.SRGBColorSpace).getRGB(rgb, THREE.SRGBColorSpace);
  return [Math.round(rgb.r * 255), Math.round(rgb.g * 255), Math.round(rgb.b * 255)];
}

function recolor(r: number, g: number, b: number, look: Look): [number, number, number] | null {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (look.hair !== undefined && near(r, g, b, HAIR, 6)) return shade(r, g, b, new THREE.Color(look.hair), REF_HAIR);
  if (look.skin !== undefined && SKIN.some((c) => near(r, g, b, c, 8))) {
    return [Math.min(255, r * look.skin), Math.min(255, g * look.skin), Math.min(255, b * look.skin)];
  }
  if (look.armor !== undefined && max - min < 22 && max > 45) return shade(r, g, b, new THREE.Color(look.armor), REF_METAL);
  if (look.accent !== undefined && r > g + 45 && r > 70 && b < r - 30) return shade(r, g, b, new THREE.Color(look.accent), REF_ACCENT);
  return null;
}

/** Una copia del atlas con los colores de `look`. Los colores repetidos se calculan una sola vez. */
export function recolorTexture(map: THREE.Texture, look: Look): THREE.Texture {
  const img = map.image as CanvasImageSource & { width: number; height: number };
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  const cache = new Map<number, [number, number, number] | null>();
  for (let i = 0; i < px.length; i += 4) {
    const key = (px[i] << 16) | (px[i + 1] << 8) | px[i + 2];
    let out = cache.get(key);
    if (out === undefined) {
      out = recolor(px[i], px[i + 1], px[i + 2], look);
      cache.set(key, out);
    }
    if (out) {
      px[i] = out[0];
      px[i + 1] = out[1];
      px[i + 2] = out[2];
    }
  }
  ctx.putImageData(data, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY = map.flipY;
  tex.colorSpace = map.colorSpace;
  tex.wrapS = map.wrapS;
  tex.wrapT = map.wrapT;
  tex.magFilter = map.magFilter;
  tex.minFilter = map.minFilter;
  tex.channel = map.channel;
  return tex;
}

/** Aplica `look` a un personaje ya armado: material y atlas propios, y la escala (ancho, alto, profundidad). */
export function applyLook(model: THREE.Object3D, look: Look): void {
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = (m.material as THREE.MeshStandardMaterial).clone();
    if (mat.map) mat.map = recolorTexture(mat.map, look);
    m.material = mat;
  });
  if (look.scale) model.scale.multiply(new THREE.Vector3(...look.scale));
}
