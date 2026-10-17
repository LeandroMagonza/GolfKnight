// El caddie (ver docs/jefes/caddie.md): un goblin grandote con una bolsa de golf más alta que él colgada a
// la espalda, con los cuatro palos asomando, cada uno con su funda del color del palo. El palo que canta
// sube de la bolsa y brilla: eso, más el ícono arriba de su cabeza, dice desde la cámara alta qué palo le
// pega. Hecho por código, en el estilo de PolygonDungeon (cajas y cilindros facetados, colores planos).
import * as THREE from 'three';
import type { ClubId } from '../../../core/clubs';
import type { Enemy } from '../../enemies';
import { flatMat } from '../kit';
import { CLUB_TINT } from './fx';

const ORDER: ClubId[] = ['driver', 'iron', 'wedge', 'putter'];
/** Cuánto sube el palo que canta (m), y lo que tarda. */
const RAISE = 0.75;
const RAISE_RATE = 7;

export class CaddieLook {
  /** La bolsa entera, colgada del pecho (sigue los movimientos del torso). */
  private readonly bag = new THREE.Group();
  private readonly clubs = new Map<ClubId, { group: THREE.Group; cover: THREE.MeshStandardMaterial; up: number }>();
  private readonly mats: THREE.Material[] = [];
  private readonly geos: THREE.BufferGeometry[] = [];
  private active: ClubId | null = null;
  private age = 0;

  constructor(private readonly e: Enemy) {
    const H = e.stats.height;
    const s = e.body.scale.x || 1;
    const mat = (c: number, extra: THREE.MeshStandardMaterialParameters = {}) => {
      const m = flatMat(c, extra);
      this.mats.push(m);
      return m;
    };
    const geo = <T extends THREE.BufferGeometry>(g: T): T => {
      this.geos.push(g);
      return g;
    };
    const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
      const o = new THREE.Mesh(g, m);
      o.position.set(x, y, z);
      o.castShadow = true;
      return o;
    };
    // la bolsa: cuero marrón con dos franjas rojas, la boca de metal, el bolsillo y la correa
    const leather = mat(0x6b3f22);
    const stripe = mat(0xb3312b);
    const metal = mat(0x9a9a92, { roughness: 0.5 });
    const R = 0.36;
    const LEN = 1.55;
    const body = mesh(geo(new THREE.CylinderGeometry(R, R * 0.92, LEN, 9)), leather, 0, LEN / 2, 0);
    const band1 = mesh(geo(new THREE.CylinderGeometry(R * 1.04, R * 1.04, 0.12, 9)), stripe, 0, LEN * 0.32, 0);
    const band2 = mesh(geo(new THREE.CylinderGeometry(R * 1.04, R * 1.04, 0.12, 9)), stripe, 0, LEN * 0.62, 0);
    const rim = mesh(geo(new THREE.CylinderGeometry(R * 1.1, R * 1.06, 0.14, 9)), metal, 0, LEN + 0.04, 0);
    const foot = mesh(geo(new THREE.CylinderGeometry(R * 0.98, R * 1.02, 0.12, 9)), metal, 0, 0.06, 0);
    const pocket = mesh(geo(new THREE.BoxGeometry(0.34, 0.6, 0.16)), stripe, 0, LEN * 0.45, R * 0.95);
    const strap = mesh(geo(new THREE.BoxGeometry(0.1, 1.1, 0.05)), mat(0x3a2414), 0.0, LEN * 0.55, R + 0.07);
    strap.rotation.z = 0.5;
    const bag = new THREE.Group();
    bag.add(body, band1, band2, rim, foot, pocket, strap);
    // los cuatro palos: la vara de metal y la funda tejida del color del palo, con su pompón
    const shaftGeo = geo(new THREE.CylinderGeometry(0.035, 0.035, 1.1, 5));
    const coverGeo = geo(new THREE.CylinderGeometry(0.15, 0.17, 0.42, 7));
    const pomGeo = geo(new THREE.IcosahedronGeometry(0.1, 0));
    ORDER.forEach((club, i) => {
      const a = (i / ORDER.length) * Math.PI * 2 + 0.4;
      const g = new THREE.Group();
      g.position.set(Math.cos(a) * R * 0.5, LEN - 0.35, Math.sin(a) * R * 0.5);
      g.rotation.set(Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12);
      const shaft = mesh(shaftGeo, metal, 0, 0.55, 0);
      const cover = mat(CLUB_TINT[club], { emissive: CLUB_TINT[club], emissiveIntensity: 0 });
      const sock = mesh(coverGeo, cover, 0, 1.2, 0);
      // el driver tiene la funda más gorda; el putter, la más chata
      sock.scale.set(club === 'driver' ? 1.35 : club === 'putter' ? 1.2 : 1, club === 'putter' ? 0.7 : 1, club === 'driver' ? 1.35 : club === 'putter' ? 0.8 : 1);
      const pom = mesh(pomGeo, mat(0xf2efe6), 0, 1.47, 0);
      g.add(shaft, sock, pom);
      bag.add(g);
      this.clubs.set(club, { group: g, cover: cover as THREE.MeshStandardMaterial, up: 0 });
    });
    // inclinada, colgada en diagonal a la espalda (el modelo mira a +z: la espalda es -z). En metros de un
    // caddie de 2.7 m: el grupo de afuera la escala con su altura
    bag.rotation.set(-0.28, 0, 0.22);
    bag.position.set(0.25, 0.45, -0.6);
    this.bag.add(bag);
    this.bag.scale.setScalar(H / 2.7 / s);
    e.body.add(this.bag);
    // al pecho, conservando dónde quedó: así se mueve con el torso (el grito, el saludo)
    const chest = e.body.getObjectByName('mixamorigSpine2');
    if (chest) {
      e.body.updateMatrixWorld(true);
      chest.attach(this.bag);
    }
  }

  /** El palo que canta: sube de la bolsa y brilla. Null: todos guardados. */
  setActive(club: ClubId | null): void {
    this.active = club;
  }

  update(dt: number): void {
    this.age += dt;
    for (const [club, c] of this.clubs) {
      const want = club === this.active ? 1 : 0;
      c.up += (want - c.up) * (1 - Math.exp(-RAISE_RATE * dt));
      c.group.position.y = 1.55 - 0.35 + RAISE * c.up;
      c.cover.emissiveIntensity = c.up * (0.55 + 0.25 * Math.sin(this.age * 6));
    }
  }

  dispose(): void {
    this.bag.parent?.remove(this.bag);
    for (const m of this.mats) m.dispose();
    for (const g of this.geos) g.dispose();
  }
}
