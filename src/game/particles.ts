// Las partículas del pulido (14/10, ver docs/assets.md): sprites del atlas de efectos (public/fx/atlas.webp,
// máscaras en grises de Cartoon FX Remaster, Hovl y GAPH; el color lo pone cada partícula), dibujados como
// cuadrados instanciados: una llamada de dibujo por capa, sean cuantas sean. Cuatro capas: brillo (aditivo),
// humo (mezcla normal), y en el piso las marcas que brillan y las que oscurecen.
import * as THREE from 'three';
import { FX_ATLAS_SIZE, FX_SPRITES, type FxSprite } from './fxAtlas';

export type Layer = 'add' | 'alpha' | 'groundAdd' | 'ground';
const LAYERS: Layer[] = ['add', 'alpha', 'groundAdd', 'ground'];
const MAX = 1600;

/** Lo que se le puede pedir a una partícula. Lo que no se dice, sale de los valores de abajo. */
export interface Spawn {
  sprite: FxSprite;
  /** Qué cuadro de la tira (si el sprite tiene varios); -1, uno al azar. */
  frame?: number;
  layer?: Layer;
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
  /** Aceleración en y (negativa: cae). */
  gravity?: number;
  /** Cuánto frena por segundo (0: nada; 3: frena rápido). */
  drag?: number;
  life: number;
  /** Alto en metros al nacer y al morir (el ancho sale de la forma del sprite). */
  size: number;
  sizeEnd?: number;
  /** Cuánto más ancho que su forma (los rastros estirados). */
  stretch?: number;
  /** Giro inicial y por segundo, en radianes. En el piso, el giro sobre sí. */
  rot?: number;
  spin?: number;
  /** Se orienta con su velocidad en pantalla (los rastros y los triángulos del impacto). */
  aligned?: boolean;
  color: number;
  colorEnd?: number;
  /** Brillo: más de 1 lo levanta el bloom. */
  intensity?: number;
  alpha?: number;
  /** Qué parte de la vida tarda en aparecer, y desde qué parte se empieza a apagar. */
  fadeIn?: number;
  fadeOut?: number;
}

interface Particle {
  layer: number;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  gravity: number; drag: number;
  age: number; life: number;
  size: number; sizeEnd: number; aspect: number;
  rot: number; spin: number; aligned: boolean;
  r0: number; g0: number; b0: number; r1: number; g1: number; b1: number;
  alpha: number; fadeIn: number; fadeOut: number;
  u0: number; v0: number; u1: number; v1: number;
}

const VERTEX = /* glsl, i18n-ok */ `
attribute vec3 iPos;
attribute vec4 iSize; // ancho, alto, giro, orientado a la velocidad
attribute vec4 iColor;
attribute vec4 iUv;
attribute vec3 iVel;
varying vec2 vUv;
varying vec4 vColor;
void main() {
  vUv = mix(iUv.xy, iUv.zw, uv);
  vColor = iColor;
  vec2 p = vec2(position.x * iSize.x, position.y * iSize.y);
#ifdef GROUND
  float c = cos(iSize.z), s = sin(iSize.z);
  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  vec4 mv = viewMatrix * vec4(iPos.x + p.x, iPos.y, iPos.z + p.y, 1.0);
#else
  vec4 mv = viewMatrix * vec4(iPos, 1.0);
  float ang = iSize.z;
  if (iSize.w > 0.5) {
    vec4 ahead = viewMatrix * vec4(iPos + iVel, 1.0);
    vec2 d = ahead.xy - mv.xy;
    if (dot(d, d) > 1e-8) ang += atan(d.y, d.x);
  }
  float c = cos(ang), s = sin(ang);
  mv.xy += vec2(c * p.x - s * p.y, s * p.x + c * p.y);
#endif
  gl_Position = projectionMatrix * mv;
}`;

const FRAGMENT = /* glsl, i18n-ok */ `
uniform sampler2D map;
varying vec2 vUv;
varying vec4 vColor;
void main() {
  float m = texture2D(map, vUv).r;
#ifdef ADDITIVE
  gl_FragColor = vec4(vColor.rgb, m * vColor.a);
#else
  gl_FragColor = vec4(vColor.rgb * (0.6 + 0.4 * m), smoothstep(0.06, 0.45, m) * vColor.a);
#endif
  if (gl_FragColor.a < 0.003) discard;
  #include <colorspace_fragment>
}`;

const tmp = new THREE.Color();

export class Particles {
  private readonly list: Particle[] = [];
  private readonly meshes: THREE.Mesh[] = [];
  private readonly attrs: { pos: THREE.InstancedBufferAttribute; size: THREE.InstancedBufferAttribute; color: THREE.InstancedBufferAttribute; uv: THREE.InstancedBufferAttribute; vel: THREE.InstancedBufferAttribute }[] = [];
  private readonly geos: THREE.InstancedBufferGeometry[] = [];

  constructor(scene: THREE.Scene) {
    const map = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}fx/atlas.webp`);
    map.colorSpace = THREE.NoColorSpace;
    const quad = new THREE.PlaneGeometry(1, 1);
    for (const layer of LAYERS) {
      const geo = new THREE.InstancedBufferGeometry();
      geo.index = quad.index;
      geo.setAttribute('position', quad.getAttribute('position'));
      geo.setAttribute('uv', quad.getAttribute('uv'));
      const attr = (n: number) => new THREE.InstancedBufferAttribute(new Float32Array(MAX * n), n).setUsage(THREE.DynamicDrawUsage);
      const a = { pos: attr(3), size: attr(4), color: attr(4), uv: attr(4), vel: attr(3) };
      geo.setAttribute('iPos', a.pos);
      geo.setAttribute('iSize', a.size);
      geo.setAttribute('iColor', a.color);
      geo.setAttribute('iUv', a.uv);
      geo.setAttribute('iVel', a.vel);
      geo.instanceCount = 0;
      const additive = layer === 'add' || layer === 'groundAdd';
      const mat = new THREE.ShaderMaterial({
        uniforms: { map: { value: map } },
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        defines: { ...(additive ? { ADDITIVE: 1 } : {}), ...(layer.startsWith('ground') ? { GROUND: 1 } : {}) },
        transparent: true,
        depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      // el humo sobre lo que brilla; las marcas del piso, antes que todo
      mesh.renderOrder = layer === 'ground' ? 1 : layer === 'groundAdd' ? 2 : layer === 'alpha' ? 3 : 4;
      scene.add(mesh);
      this.meshes.push(mesh);
      this.attrs.push(a);
      this.geos.push(geo);
    }
  }

  get count(): number {
    return this.list.length;
  }

  spawn(s: Spawn): void {
    if (this.list.length >= MAX * 2) return;
    const [x, y, w, h, cols, rows] = FX_SPRITES[s.sprite];
    const frames = cols * rows;
    const f = s.frame === undefined ? 0 : s.frame < 0 ? Math.floor(Math.random() * frames) : s.frame % frames;
    const fw = w / cols;
    const fh = h / rows;
    const fx = x + (f % cols) * fw;
    const fy = y + Math.floor(f / cols) * fh;
    const S = FX_ATLAS_SIZE;
    const c0 = tmp.setHex(s.color);
    const k = s.intensity ?? 1;
    const r0 = c0.r * k, g0 = c0.g * k, b0 = c0.b * k;
    let r1 = r0, g1 = g0, b1 = b0;
    if (s.colorEnd !== undefined) {
      const c1 = tmp.setHex(s.colorEnd);
      r1 = c1.r * k; g1 = c1.g * k; b1 = c1.b * k;
    }
    this.list.push({
      layer: LAYERS.indexOf(s.layer ?? 'add'),
      x: s.x, y: s.y, z: s.z, vx: s.vx ?? 0, vy: s.vy ?? 0, vz: s.vz ?? 0,
      gravity: s.gravity ?? 0, drag: s.drag ?? 0,
      age: 0, life: s.life,
      size: s.size, sizeEnd: s.sizeEnd ?? s.size, aspect: (fw / fh) * (s.stretch ?? 1),
      rot: s.rot ?? 0, spin: s.spin ?? 0, aligned: !!s.aligned,
      r0, g0, b0, r1, g1, b1,
      alpha: s.alpha ?? 1, fadeIn: s.fadeIn ?? 0, fadeOut: s.fadeOut ?? 0.5,
      u0: (fx + 0.5) / S, u1: (fx + fw - 0.5) / S, v1: 1 - (fy + 0.5) / S, v0: 1 - (fy + fh - 0.5) / S,
    });
  }

  update(dt: number): void {
    const counts = [0, 0, 0, 0];
    const list = this.list;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.age += dt;
      if (p.age >= p.life) {
        list[i] = list[list.length - 1];
        list.pop();
        continue;
      }
      p.vy += p.gravity * dt;
      if (p.drag) {
        const k = Math.max(0, 1 - p.drag * dt);
        p.vx *= k; p.vy *= k; p.vz *= k;
      }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.rot += p.spin * dt;
      const n = counts[p.layer];
      if (n >= MAX) continue;
      counts[p.layer] = n + 1;
      const t = p.age / p.life;
      const ease = 1 - (1 - t) * (1 - t);
      const size = p.size + (p.sizeEnd - p.size) * ease;
      let a = p.alpha;
      if (p.fadeIn > 0 && t < p.fadeIn) a *= t / p.fadeIn;
      if (t > p.fadeOut) a *= 1 - (t - p.fadeOut) / (1 - p.fadeOut);
      const at = this.attrs[p.layer];
      at.pos.array[n * 3] = p.x; at.pos.array[n * 3 + 1] = p.y; at.pos.array[n * 3 + 2] = p.z;
      at.size.array[n * 4] = size * p.aspect; at.size.array[n * 4 + 1] = size; at.size.array[n * 4 + 2] = p.rot; at.size.array[n * 4 + 3] = p.aligned ? 1 : 0;
      at.color.array[n * 4] = p.r0 + (p.r1 - p.r0) * t;
      at.color.array[n * 4 + 1] = p.g0 + (p.g1 - p.g0) * t;
      at.color.array[n * 4 + 2] = p.b0 + (p.b1 - p.b0) * t;
      at.color.array[n * 4 + 3] = a;
      at.uv.array[n * 4] = p.u0; at.uv.array[n * 4 + 1] = p.v0; at.uv.array[n * 4 + 2] = p.u1; at.uv.array[n * 4 + 3] = p.v1;
      at.vel.array[n * 3] = p.vx; at.vel.array[n * 3 + 1] = p.vy; at.vel.array[n * 3 + 2] = p.vz;
    }
    for (let l = 0; l < LAYERS.length; l++) {
      this.geos[l].instanceCount = counts[l];
      if (!counts[l]) continue;
      const at = this.attrs[l];
      for (const attr of [at.pos, at.size, at.color, at.uv, at.vel]) {
        attr.clearUpdateRanges();
        attr.addUpdateRange(0, counts[l] * attr.itemSize);
        attr.needsUpdate = true;
      }
    }
  }

  clear(): void {
    this.list.length = 0;
  }
}
