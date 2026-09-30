// Modo tenis: la cancha. Dos alambrados a los costados, donde rebota la pelota, y la línea de fondo
// del tenista. Todo con primitivas.
import * as THREE from 'three';
import { FIELD_HALF_WIDTH, GATE_Z, SPAWN_Z, TEE_LINE_Z } from '../game/world';

const FENCE_HEIGHT = 1.4;
const POST_EVERY = 4;

export function buildCourt(scene: THREE.Scene): THREE.Group {
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
  scene.add(court);
  return court;
}
