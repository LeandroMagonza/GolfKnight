// Utilidades de modelos que comparten el juego y la cinemática.
import * as THREE from 'three';

/**
 * Los clips de Mixamo desplazan la cadera; el movimiento lo maneja el juego. Se fija la posición
 * horizontal de la cadera (en espacio mundo, porque el nodo Armature viene rotado) en su valor inicial.
 */
export function stripRootMotion(clip: THREE.AnimationClip, root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  for (const t of clip.tracks) {
    if (!t.name.endsWith('Hips.position')) continue;
    const node = root.getObjectByName(t.name.slice(0, -'.position'.length));
    const q = new THREE.Quaternion();
    (node?.parent ?? root).getWorldQuaternion(q);
    const inv = q.clone().invert();
    const v = t.values;
    const first = new THREE.Vector3(v[0], v[1], v[2]).applyQuaternion(q);
    const p = new THREE.Vector3();
    for (let i = 0; i < v.length; i += 3) {
      p.set(v[i], v[i + 1], v[i + 2]).applyQuaternion(q);
      p.x = first.x;
      p.z = first.z;
      p.applyQuaternion(inv);
      v[i] = p.x;
      v[i + 1] = p.y;
      v[i + 2] = p.z;
    }
  }
}

/** Deja en `root` solo la malla pedida (los GLB de PolygonDungeon traen los 16 personajes juntos). */
export function keepOnlyMesh(root: THREE.Object3D, mesh: string): void {
  const drop: THREE.Object3D[] = [];
  root.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh && o.name !== mesh) drop.push(o);
  });
  for (const o of drop) o.parent?.remove(o);
}

export function skinnedHeight(root: THREE.Object3D): number {
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const sm = o as THREE.SkinnedMesh;
    if (sm.isSkinnedMesh) sm.skeleton.update();
  });
  const box = new THREE.Box3().setFromObject(root, true);
  return box.max.y - Math.min(0, box.min.y);
}
