// Cuando un enemigo gana un poder en plena oleada, o le sube (o le baja) el nivel (15/10, Leandro: «que
// haga animación y ruido cuando un enemigo gana un poder»; ver docs/poderes-visibles.md). Lo que se ve:
// - dos anillos del color del poder que le suben por el cuerpo, de los pies a la cabeza;
// - el ícono del poder, grande, que salta arriba de su vida, se queda un momento y se va subiendo;
// - el cuerpo que brilla del color del poder y se apaga (eso lo pinta el enemigo con `glow`).
// Al bajar de nivel, sin anillos: el ícono con el número nuevo se achica y se hunde, apagado.
// Todo cuelga del grupo del enemigo: se mueve con él y se va con él.
import * as THREE from 'three';

/** Lo que dura cada parte, en segundos. */
const RING_RISE = 0.55;
const RING_GAP = 0.13;
const ICON_UP = 1.35;
const ICON_DOWN = 0.9;
const GLOW = 0.6;
/** Lo grande del ícono que salta, en metros (antes de lo que le sume el nivel). */
const ICON_SIZE = 1.1;

const ringGeo = new THREE.RingGeometry(0.8, 1, 40);
ringGeo.rotateX(-Math.PI / 2);

/** Rebote al llegar: pasa de 1 y vuelve (como un `easeOutBack`). */
const backOut = (u: number) => 1 + 2.4 * Math.pow(u - 1, 3) + 1.4 * Math.pow(u - 1, 2);

interface Burst {
  t: number;
  up: boolean;
  /** El tamaño del ícono, en metros. */
  size: number;
  rings: THREE.Mesh[];
  icon: THREE.Sprite;
  color: THREE.Color;
}

export interface GainShow {
  /** Ganó (o subió de nivel): true. Bajó de nivel: false. */
  up: boolean;
  color: number;
  /** El ícono del poder con su número, ya dibujado (cuadrado). */
  icon: HTMLCanvasElement;
  /** Cuánto más grande va el ícono por su nivel (1, 1.4, 1.8). */
  scale: number;
}

export class PowerGainFx {
  private readonly bursts: Burst[] = [];
  private readonly glowColor = new THREE.Color();
  private glowLeft = 0;

  constructor(private readonly parent: THREE.Object3D) {}

  /** Arranca uno. */
  play(s: GainShow): void {
    const color = new THREE.Color(s.color);
    const rings: THREE.Mesh[] = [];
    if (s.up) {
      for (let i = 0; i < 2; i++) {
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(ringGeo, mat);
        ring.renderOrder = 9;
        ring.visible = false;
        this.parent.add(ring);
        rings.push(ring);
      }
      this.glowColor.copy(color);
      this.glowLeft = GLOW;
    }
    const tex = new THREE.CanvasTexture(s.icon);
    const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, color: s.up ? 0xffffff : 0x9aa3ad }));
    icon.renderOrder = 14;
    icon.visible = false;
    this.parent.add(icon);
    // el nivel lo agranda la mitad de lo que agranda el ícono de arriba: de cerca no tiene que tapar la cancha
    this.bursts.push({ t: 0, up: s.up, size: ICON_SIZE * (1 + (s.scale - 1) * 0.5), rings, icon, color });
  }

  /**
   * Avanza. `height` y `radius` son los del cuerpo sin escalar (los del grupo), `top` dónde va la vida
   * (en las mismas unidades) y `scale` la escala del grupo, para que el ícono mida lo mismo en un élite.
   */
  update(dt: number, height: number, radius: number, top: number, scale: number): void {
    if (this.glowLeft > 0) this.glowLeft = Math.max(0, this.glowLeft - dt);
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.t += dt;
      b.rings.forEach((ring, k) => {
        const u = (b.t - k * RING_GAP) / RING_RISE;
        ring.visible = u > 0 && u < 1;
        if (!ring.visible) return;
        const e = 1 - Math.pow(1 - u, 2);
        ring.position.y = height * (0.05 + 1.05 * e);
        ring.scale.setScalar(radius * (1.7 - 0.6 * e));
        (ring.material as THREE.MeshBasicMaterial).opacity = 0.95 * Math.min(1, u * 5) * (1 - u * u);
      });
      const life = b.up ? ICON_UP : ICON_DOWN;
      const u = b.t / life;
      const mat = b.icon.material;
      b.icon.visible = u < 1;
      if (b.up) {
        // salta (pasándose un poco), se queda, y al final sube y se apaga
        const pop = b.t < 0.28 ? backOut(b.t / 0.28) : 1;
        const s = (b.size * Math.max(0, pop)) / scale;
        b.icon.scale.set(s, s, 1);
        b.icon.position.y = top + 0.75 + (0.6 * Math.max(0, u - 0.6)) / scale + s * 0.5;
        mat.opacity = u < 0.72 ? 1 : Math.max(0, 1 - (u - 0.72) / 0.28);
      } else {
        // bajó: arranca grande y se achica hundiéndose
        const s = (b.size * (1.15 - 0.45 * u)) / scale;
        b.icon.scale.set(s, s, 1);
        b.icon.position.y = top + 0.75 - (0.4 * u) / scale + s * 0.5;
        mat.opacity = Math.min(1, 3 * (1 - u));
      }
      if (b.t >= Math.max(life, RING_GAP + RING_RISE)) {
        this.drop(b);
        this.bursts.splice(i, 1);
      }
    }
  }

  /** Cuánto brilla el cuerpo ahora (0 a 1), y de qué color (ver `glowColorNow`). */
  get glow(): number {
    return this.glowLeft > 0 ? this.glowLeft / GLOW : 0;
  }

  get glowColorNow(): THREE.Color {
    return this.glowColor;
  }

  /** Corta todo (murió, pasó la línea). */
  clear(): void {
    for (const b of this.bursts) this.drop(b);
    this.bursts.length = 0;
    this.glowLeft = 0;
  }

  private drop(b: Burst): void {
    for (const r of b.rings) {
      this.parent.remove(r);
      (r.material as THREE.Material).dispose();
    }
    this.parent.remove(b.icon);
    b.icon.material.map?.dispose();
    b.icon.material.dispose();
  }
}
