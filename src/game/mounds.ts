// Las lomas que se levantan durante la partida (el geomante), a la vista. La altura de verdad vive en
// core/terrain (`mounds`), y la pelota, los enemigos y la puntería ya la leen de ahí: esto solo la dibuja.
//
// Cada loma es su propia malla, apoyada sobre el piso que haya abajo (con relieve o liso), en lugar de
// rehacer la malla entera del campo, que se arma una sola vez al cargar. Se reescriben los vértices solo
// mientras la loma crece o baja.
import * as THREE from 'three';
import { heightAt, mounds, type Mound } from '../core/terrain';

const SEGMENTS = 30;
/** Hasta dónde se dibuja, en radios: más allá la loma ya no suma casi nada. */
const EXTENT = 3;
const LOW = new THREE.Color(0x4a9d4f);
const HIGH = new THREE.Color(0xa9d66b);
/** La tierra recién removida, que se va tapando de pasto a medida que la loma termina de subir. */
const DIRT = new THREE.Color(0x8a6a3e);

interface View {
  mesh: THREE.Mesh;
  drawn: number;
}

export class MoundView {
  private readonly views = new Map<Mound, View>();
  private readonly material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    // se dibuja encima del piso de abajo, que en el borde queda a centímetros: sin esto titila
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  constructor(private readonly scene: THREE.Scene) {}

  update(): void {
    for (const m of mounds) {
      let view = this.views.get(m);
      if (!view) {
        const geo = new THREE.PlaneGeometry(2 * EXTENT * m.rx, 2 * EXTENT * m.rz, SEGMENTS, SEGMENTS);
        geo.rotateX(-Math.PI / 2);
        geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));
        const mesh = new THREE.Mesh(geo, this.material);
        mesh.receiveShadow = true;
        mesh.castShadow = true;
        mesh.position.set(m.x, 0, m.z);
        this.scene.add(mesh);
        view = { mesh, drawn: -1 };
        this.views.set(m, view);
      }
      if (Math.abs(view.drawn - m.height) > 0.002) this.draw(m, view);
    }
    for (const [m, view] of this.views) {
      if (mounds.includes(m)) continue;
      this.scene.remove(view.mesh);
      view.mesh.geometry.dispose();
      this.views.delete(m);
    }
  }

  private draw(m: Mound, view: View): void {
    const geo = view.mesh.geometry;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const col = geo.attributes.color as THREE.BufferAttribute;
    // mientras sube se ve la tierra removida; ya arriba, vuelve el pasto
    const fresh = m.target > 0 ? 1 - Math.min(1, m.height / Math.max(0.01, m.target)) : 0;
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = m.x + pos.getX(i);
      const z = m.z + pos.getZ(i);
      const dx = (x - m.x) / m.rx;
      const dz = (z - m.z) / m.rz;
      const own = m.height * Math.exp(-0.5 * (dx * dx + dz * dz));
      pos.setY(i, heightAt(x, z) + 0.01);
      c.copy(LOW).lerp(HIGH, Math.min(1, own / 2.4) * 0.7);
      if (fresh > 0) c.lerp(DIRT, fresh * Math.min(1, own / 0.3));
      col.setXYZ(i, c.r, c.g, c.b);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    geo.computeVertexNormals();
    view.drawn = m.height;
  }
}
