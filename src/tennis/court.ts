// Modo tenis: la cancha. Dos alambrados a los costados, donde rebota la pelota, la línea de fondo del
// tenista y, al fondo del campo, la pared mágica que devuelve todo lo que llega. Todo con primitivas.
import * as THREE from 'three';
import { MAGIC_WALL_COLOR } from '../game/balls';
import { FIELD_HALF_WIDTH, GATE_Z, SPAWN_Z, TEE_LINE_Z } from '../game/world';
import { TENNIS } from './bounce';

const FENCE_HEIGHT = 1.4;
const POST_EVERY = 4;
const MAGIC_HEIGHT = 3.2;

export class Court {
  private readonly magic: THREE.Mesh;
  private readonly magicMat = new THREE.MeshBasicMaterial({ color: MAGIC_WALL_COLOR, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  private readonly edge: THREE.Mesh;
  private age = 0;

  constructor(scene: THREE.Scene) {
    const court = new THREE.Group();
    const postMat = new THREE.MeshStandardMaterial({ color: 0x2f5d3a, roughness: 0.6, metalness: 0.3 });
    const netMat = new THREE.MeshBasicMaterial({ color: 0x9fd7a8, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
    const railMat = new THREE.MeshStandardMaterial({ color: 0xe8efe9, roughness: 0.5 });
    const from = GATE_Z + 1;
    const to = SPAWN_Z + 6;
    const length = to - from;
    for (const side of [-1, 1]) {
      const x = side * FIELD_HALF_WIDTH;
      const net = new THREE.Mesh(new THREE.PlaneGeometry(length, FENCE_HEIGHT), netMat);
      net.rotation.y = Math.PI / 2;
      net.position.set(x, FENCE_HEIGHT / 2, from + length / 2);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, length), railMat);
      rail.position.set(x, FENCE_HEIGHT, from + length / 2);
      court.add(net, rail);
      for (let z = from; z <= to + 0.01; z += POST_EVERY) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, FENCE_HEIGHT + 0.1, 6), postMat);
        post.position.set(x, (FENCE_HEIGHT + 0.1) / 2, z);
        court.add(post);
      }
    }
    // la línea de fondo, donde está el tenista
    const line = new THREE.Mesh(new THREE.PlaneGeometry(FIELD_HALF_WIDTH * 2, 0.1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false }));
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, 0.03, TEE_LINE_Z + 0.4);
    court.add(line);
    // la pared mágica: un velo violeta de lado a lado, y su borde en el piso
    this.magic = new THREE.Mesh(new THREE.PlaneGeometry(FIELD_HALF_WIDTH * 2, MAGIC_HEIGHT), this.magicMat);
    this.edge = new THREE.Mesh(new THREE.PlaneGeometry(FIELD_HALF_WIDTH * 2, 0.25), new THREE.MeshBasicMaterial({ color: MAGIC_WALL_COLOR, transparent: true, opacity: 0.8, depthWrite: false }));
    this.edge.rotation.x = -Math.PI / 2;
    court.add(this.magic, this.edge);
    scene.add(court);
    this.update(0);
  }

  /** La pared sigue a `TENNIS.backWall` (se toca en el panel) y titila un poco. */
  update(dt: number): void {
    this.age += dt;
    const z = TEE_LINE_Z + TENNIS.backWall;
    this.magic.position.set(0, MAGIC_HEIGHT / 2, z);
    this.edge.position.set(0, 0.04, z);
    this.magicMat.opacity = 0.18 + 0.07 * Math.sin(this.age * 3);
  }
}
