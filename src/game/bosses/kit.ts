// Herramientas comunes para armar jefes (ver types.ts y docs/jefes.md): las medidas del campo, números de
// una parte de jefe a partir de un tipo, modelos de cajas facetados como los de PolygonDungeon, marcas en
// el piso y la barra de vida grande de arriba.
import * as THREE from 'three';
import { FIELD_HALF_WIDTH, SPAWN_Z, fieldHalfAt } from '../../core/field';
import { heightAt } from '../../core/terrain';
import { ENEMIES, type EnemyKind, type EnemyStats } from '../../core/waves';
import type { Enemy } from '../enemies';
import { TEE_Z } from '../tees';
import { GATE_HALF_WIDTH, GATE_Z } from '../world';
import type { BossCtx } from './types';

/**
 * Las medidas del campo. z crece hacia la horda: la puerta en GATE_Z (0), la línea de los puestos en
 * TEE_Z (9), los enemigos aparecen en SPAWN_Z (68). x va de -FIELD_HALF_WIDTH a +FIELD_HALF_WIDTH (en el
 * campo en trapecio, el ancho a cada z lo da `fieldHalfAt`). `heightAt(x, z)` es la altura del piso.
 */
export { FIELD_HALF_WIDTH, GATE_HALF_WIDTH, GATE_Z, SPAWN_Z, TEE_Z, fieldHalfAt, heightAt };

/**
 * Los números de una parte de jefe: los de un tipo (`kind`) con otros valores. El tipo dice qué cuenta en
 * el registro y cómo suena al recibir. Lo que no se cambia queda como en el tipo (radio, altura...).
 */
export function partStats(kind: EnemyKind, over: Partial<EnemyStats>): EnemyStats {
  return { ...ENEMIES[kind], ...over };
}

/** Material plano, sin brillo, como los de PolygonDungeon en el juego. */
export function flatMat(color: number, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, flatShading: true, ...extra });
}

/**
 * Facetada: mueve un poco cada vértice (al azar con `seed`, el mismo en los vértices repetidos) y deja las
 * caras planas. Para que una figura simple (una esfera, un cono) se vea low-poly como el pack.
 */
export function facet(geo: THREE.BufferGeometry, amount = 0.12, seed = 1): THREE.BufferGeometry {
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280) * 2 - 1;
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const moved = new Map<string, [number, number, number]>();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    let d = moved.get(key);
    if (!d) moved.set(key, (d = [rnd() * amount, rnd() * amount, rnd() * amount]));
    pos.setXYZ(i, pos.getX(i) * (1 + d[0]), pos.getY(i) * (1 + d[1]), pos.getZ(i) * (1 + d[2]));
  }
  const out = geo.index ? geo.toNonIndexed() : geo;
  out.computeVertexNormals();
  return out;
}

/** Una piedra facetada de radio `r`, apoyada en el piso (y de 0 a 2r). */
export function rockLook(r = 1, color = 0x7d7a74, seed = 1): THREE.Object3D {
  const mesh = new THREE.Mesh(facet(new THREE.IcosahedronGeometry(r, 1), 0.16, seed), flatMat(color));
  mesh.position.y = r;
  mesh.castShadow = true;
  const g = new THREE.Group();
  g.add(mesh);
  return g;
}

/** Una marca en el piso: un anillo (o un disco lleno) de color, que late si se le pide. */
export class GroundMark {
  readonly mesh: THREE.Mesh;
  private readonly mat: THREE.MeshBasicMaterial;
  constructor(private readonly scene: THREE.Scene, color: number, filled = false, radius = 1) {
    this.mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
    const geo = filled ? new THREE.CircleGeometry(1, 32) : new THREE.RingGeometry(0.82, 1, 40);
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.renderOrder = 2;
    this.mesh.scale.setScalar(radius);
    scene.add(this.mesh);
  }
  at(x: number, z: number): this {
    this.mesh.position.set(x, heightAt(x, z) + 0.06, z);
    return this;
  }
  size(radius: number): this {
    this.mesh.scale.setScalar(radius);
    return this;
  }
  opacity(a: number): this {
    this.mat.opacity = a;
    this.mesh.visible = a > 0.001;
    return this;
  }
  color(c: number): this {
    this.mat.color.setHex(c);
    return this;
  }
  dispose(): void {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}

/** Una franja en el piso entre dos puntos (un carril: por dónde va a pasar algo). */
export class LaneMark {
  readonly mesh: THREE.Mesh;
  private readonly mat: THREE.MeshBasicMaterial;
  constructor(private readonly scene: THREE.Scene, color: number, private width = 1.4) {
    this.mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.mat);
    this.mesh.rotation.order = 'YXZ';
    this.mesh.renderOrder = 2;
    scene.add(this.mesh);
  }
  between(x1: number, z1: number, x2: number, z2: number): this {
    const len = Math.hypot(x2 - x1, z2 - z1);
    this.mesh.position.set((x1 + x2) / 2, Math.max(heightAt(x1, z1), heightAt(x2, z2)) + 0.05, (z1 + z2) / 2);
    this.mesh.rotation.set(-Math.PI / 2, Math.atan2(x2 - x1, z2 - z1), 0);
    this.mesh.scale.set(this.width, len, 1);
    return this;
  }
  opacity(a: number): this {
    this.mat.opacity = a;
    this.mesh.visible = a > 0.001;
    return this;
  }
  color(c: number): this {
    this.mat.color.setHex(c);
    return this;
  }
  dispose(): void {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}

/**
 * La barra grande del jefe, arriba al medio: el nombre, la barra y una línea chica abajo (lo que está por
 * hacer, cuántas le faltan...). Para jefes cuya vida no es la de un solo enemigo; los demás ya tienen la
 * barra sobre la cabeza.
 */
export class BossBar {
  private readonly el = document.createElement('div');
  private readonly fill = document.createElement('div');
  private readonly sub = document.createElement('div');
  constructor(title: string, color = '#d94a3a') {
    this.el.style.cssText = 'position:fixed;top:58px;left:50%;transform:translateX(-50%);width:min(440px,70vw);z-index:6;pointer-events:none;font:600 14px system-ui,sans-serif;color:#fff;text-align:center;text-shadow:0 1px 3px #000';
    const name = document.createElement('div');
    name.textContent = title;
    const track = document.createElement('div');
    track.style.cssText = 'height:10px;margin-top:3px;border-radius:5px;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.35);overflow:hidden';
    this.fill.style.cssText = `height:100%;width:100%;background:${color};transition:width .15s`;
    this.sub.style.cssText = 'margin-top:3px;font-size:12px;font-weight:500;color:#e8e0d0';
    track.append(this.fill);
    this.el.append(name, track, this.sub);
    document.body.append(this.el);
  }
  set(value: number, max: number, sub = ''): void {
    this.fill.style.width = `${Math.max(0, Math.min(1, value / Math.max(1e-6, max))) * 100}%`;
    this.sub.textContent = sub;
  }
  color(c: string): void {
    this.fill.style.background = c;
  }
  show(on: boolean): void {
    this.el.style.display = on ? '' : 'none';
  }
  dispose(): void {
    this.el.remove();
  }
}

/** Un punto en un arco de `from` a `to` (u de 0 a 1), que sube `height` m en el medio. */
export function arcPoint(from: THREE.Vector3, to: THREE.Vector3, u: number, height: number, out = new THREE.Vector3()): THREE.Vector3 {
  out.lerpVectors(from, to, u);
  out.y += Math.sin(Math.PI * u) * height;
  return out;
}

/** ¿Está el golfista a menos de `reach` de `e` (en el piso)? Para atropellar. */
export function touchesPlayer(ctx: BossCtx, e: Enemy, reach = e.radius + 0.55): boolean {
  const p = ctx.player();
  return p.alive && Math.hypot(p.position.x - e.position.x, p.position.z - e.position.z) < reach;
}

/** El puesto más cercano a `x`. */
export function nearestSpot(ctx: BossCtx, x: number): number {
  const spots = ctx.spots();
  let best = 0;
  for (let i = 1; i < spots.length; i++) if (Math.abs(spots[i] - x) < Math.abs(spots[best] - x)) best = i;
  return best;
}

/** Saca de la escena y libera un objeto hecho por código (geometrías y materiales). */
export function disposeObject(scene: THREE.Scene, o: THREE.Object3D): void {
  scene.remove(o);
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (!m.isMesh) return;
    m.geometry?.dispose();
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) mat?.dispose();
  });
}
