// Las lomas que se levantan durante la partida (el geomante), a la vista. La altura de verdad vive en
// core/terrain (`mounds`), y la pelota, los enemigos y la puntería ya la leen de ahí: esto solo la dibuja.
//
// Con relieve, la loma **deforma la malla del campo**: queda con el mismo color y las mismas franjas, y
// las rayas de distancia se le apoyan encima. Se rehace solo el rectángulo que toca, y solo cuando la
// altura cambió unos centímetros. En el campo liso (el de las pruebas) no hay malla que deformar, así
// que cada loma lleva una propia.
import * as THREE from 'three';
import { heightAt, mounds, type Mound } from '../core/terrain';
import type { World } from './world';

const SEGMENTS = 30;
/** Hasta dónde llega una loma, en radios: más allá ya no suma casi nada. */
const EXTENT = 3;
/** Cada cuánto de altura se redibuja mientras sube o baja, en metros. */
const STEP = 0.03;
const LOW = new THREE.Color(0x4a9d4f);
const HIGH = new THREE.Color(0xa9d66b);

interface View {
  drawn: number;
  /** Solo en el campo liso. */
  mesh: THREE.Mesh | null;
}

export class MoundView {
  private readonly views = new Map<Mound, View>();
  private readonly material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    // en el campo liso se dibuja encima del piso, que en el borde queda a centímetros: sin esto titila
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  constructor(private readonly scene: THREE.Scene, private readonly world: World) {}

  update(): void {
    for (const m of mounds) {
      let view = this.views.get(m);
      if (!view) {
        view = { drawn: 0, mesh: this.world.hasTerrain ? null : this.makeMesh(m) };
        this.views.set(m, view);
      }
      if (Math.abs(view.drawn - m.height) < STEP && !(m.height === m.target && view.drawn !== m.height)) continue;
      view.drawn = m.height;
      this.refresh(m);
      if (view.mesh) this.drawMesh(m, view.mesh);
    }
    for (const [m, view] of this.views) {
      if (mounds.includes(m)) continue;
      // se fue: el piso vuelve a como era
      this.views.delete(m);
      this.refresh(m);
      if (view.mesh) {
        this.scene.remove(view.mesh);
        view.mesh.geometry.dispose();
      }
    }
  }

  private refresh(m: Mound): void {
    this.world.refreshGround(m.x - EXTENT * m.rx, m.x + EXTENT * m.rx, m.z - EXTENT * m.rz, m.z + EXTENT * m.rz);
  }

  private makeMesh(m: Mound): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(2 * EXTENT * m.rx, 2 * EXTENT * m.rz, SEGMENTS, SEGMENTS);
    geo.rotateX(-Math.PI / 2);
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));
    const mesh = new THREE.Mesh(geo, this.material);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    mesh.position.set(m.x, 0, m.z);
    this.scene.add(mesh);
    return mesh;
  }

  private drawMesh(m: Mound, mesh: THREE.Mesh): void {
    const geo = mesh.geometry;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const col = geo.attributes.color as THREE.BufferAttribute;
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = m.x + pos.getX(i);
      const z = m.z + pos.getZ(i);
      const h = heightAt(x, z);
      pos.setY(i, h + 0.01);
      c.copy(LOW).lerp(HIGH, Math.min(1, h / 2.4) * 0.7);
      col.setXYZ(i, c.r, c.g, c.b);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    geo.computeVertexNormals();
  }
}
