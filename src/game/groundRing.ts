// La marca de dónde cae el tiro, proyectada en el piso (13/10, Leandro: en las lomas no se entendía dónde iba a
// pegar el wedge; el anillo era plano y quedaba flotando o metido en la ladera). Cada vértice va a la altura
// del terreno en su punto, así el anillo se dobla con las lomas y los montículos. Puede ir entero o punteado
// (el wedge mientras pifiaría: dónde va a caer, sin prometer el área).
import * as THREE from 'three';

/** Cuántos tramos tiene la vuelta; punteado, se dibuja `DASH` sí y `DASH` no. */
const SEGMENTS = 72;
const DASH = 2;
/** El ancho del anillo, como parte del radio (el de antes: de 0.86 a 1). */
const INNER = 0.86;
/** Cuánto va por encima del piso. */
const LIFT = 0.05;

export class GroundRing {
  readonly mesh: THREE.Mesh;
  private readonly pos: THREE.BufferAttribute;
  private readonly solid: THREE.BufferAttribute;
  private readonly dashed: THREE.BufferAttribute;
  private isDashed = false;
  /** Dónde está y qué radio tiene (para las fotos del que mira y las pruebas). */
  readonly at = { x: 0, z: 0, r: 1 };

  constructor(material: THREE.Material) {
    const geo = new THREE.BufferGeometry();
    this.pos = new THREE.BufferAttribute(new Float32Array((SEGMENTS + 1) * 2 * 3), 3);
    geo.setAttribute('position', this.pos);
    const quads = (keep: (i: number) => boolean) => {
      const idx: number[] = [];
      for (let i = 0; i < SEGMENTS; i++) {
        if (!keep(i)) continue;
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      return new THREE.BufferAttribute(new Uint16Array(idx), 1);
    };
    this.solid = quads(() => true);
    this.dashed = quads((i) => Math.floor(i / DASH) % 2 === 0);
    geo.setIndex(this.solid);
    this.mesh = new THREE.Mesh(geo, material);
    // los vértices van en coordenadas del mundo: se mueve el anillo, no la malla
    this.mesh.frustumCulled = false;
  }

  /** Lo pone en (`x`, `z`) con radio `r`, sobre el piso que dice `ground`; `dashed`, punteado. */
  place(x: number, z: number, r: number, ground: (x: number, z: number) => number, dashed = false): void {
    Object.assign(this.at, { x, z, r });
    for (let i = 0; i <= SEGMENTS; i++) {
      const a = (i / SEGMENTS) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      for (const [k, rad] of [[0, r * INNER], [1, r]] as const) {
        const px = x + c * rad;
        const pz = z + s * rad;
        this.pos.setXYZ(i * 2 + k, px, ground(px, pz) + LIFT, pz);
      }
    }
    this.pos.needsUpdate = true;
    if (dashed !== this.isDashed) {
      this.isDashed = dashed;
      this.mesh.geometry.setIndex(dashed ? this.dashed : this.solid);
    }
  }
}
