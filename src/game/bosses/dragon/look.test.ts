// El modelo del dragón se arma, tiene todas las piezas que mueve la pelea, y las patas colgando bajan lo
// que la pelea espera (las garras a unos 1.6-1.9 m del centro del cuerpo).
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DragonRig, LEGS, dragonLook, restPose } from './look';

describe('el dragón', () => {
  it('arma el modelo con sus piezas y las garras cuelgan', () => {
    const model = dragonLook();
    const rig = new DragonRig(model);
    rig.apply({ ...restPose(), legs: 1, flapAmp: 0 }, 0);
    model.updateMatrixWorld(true);
    const p = new THREE.Vector3();
    for (const id of LEGS) {
      const y = rig.claws[id].getWorldPosition(p).y;
      expect(y).toBeLessThan(-1.4);
      expect(y).toBeGreaterThan(-2.1);
    }
    // recogidas, más arriba
    rig.apply({ ...restPose(), legs: 0, flapAmp: 0 }, 0);
    model.updateMatrixWorld(true);
    for (const id of LEGS) expect(rig.claws[id].getWorldPosition(p).y).toBeGreaterThan(-1.4);
  });
});
