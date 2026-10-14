// Los efectos del pulido (14/10, Leandro: que las habilidades se sientan potentes, sin hacer pesado el
// juego; ver docs/assets.md): el impacto de la pelota según el golpe, las explosiones, el fuego en los
// enemigos y en el aura del golfista, el hielo, la curación y la burbuja del bendito al romperse. Todo sale de
// las partículas del atlas (game/particles) y de unos cristales de hielo hechos acá. Cada cosa se prende y
// se apaga con su llave de POLISH (core/polish): lo que está apagado lo sigue dibujando game/effects como
// antes.
import * as THREE from 'three';
import type { Element } from '../core/abilities';
import { polished } from '../core/polish';
import { heightAt } from '../core/terrain';
import { Particles, type Spawn } from './particles';

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;

/** Los colores de cada elemento en el aura del golfista (el primero al nacer, el segundo al morir). */
const AURA: Record<Element, { a: number; b: number }> = {
  fire: { a: 0xffd25a, b: 0xff3a12 },
  ice: { a: 0xeaf8ff, b: 0x7fd0ff },
  lightning: { a: 0xeef4ff, b: 0x7f9cff },
  wind: { a: 0xd8ffe8, b: 0x5fd894 },
  ghost: { a: 0xf2f6ff, b: 0x9fb4ff },
  silence: { a: 0xffb8a0, b: 0xff5a3a },
};

/** Lo que alcanza de un enemigo para dibujarle encima (no hace falta el enemigo entero). */
export interface FxBody {
  readonly id: number;
  readonly position: THREE.Vector3;
  readonly height: number;
  readonly radius: number;
  readonly alive: boolean;
  readonly burning: boolean;
  readonly frozen: boolean;
}

interface Crystals {
  body: FxBody;
  /** Dónde va cada cristal, relativo al cuerpo (en múltiplos de su radio y su alto), y su giro. */
  parts: { dx: number; dy: number; dz: number; s: number; tilt: number; yaw: number }[];
  /** De 0 a 1: crece al congelarse. */
  grow: number;
}

const crystalGeo = (() => {
  // un cristal: una pirámide alargada de seis caras con la punta para arriba
  const g = new THREE.ConeGeometry(0.22, 1, 6, 1);
  g.translate(0, 0.5, 0);
  return g;
})();

export class Fx {
  readonly particles: Particles;
  private readonly crystals = new Map<number, Crystals>();
  private readonly crystalMesh: THREE.InstancedMesh;
  private readonly burnClock = new Map<number, number>();
  private auraClock = 0;
  private trailClock = 0;
  private readonly m4 = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly v = new THREE.Vector3();
  private readonly sc = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.particles = new Particles(scene);
    const mat = new THREE.MeshStandardMaterial({ color: 0xbfeaff, emissive: 0x2a7fb8, emissiveIntensity: 0.6, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.82, flatShading: true });
    this.crystalMesh = new THREE.InstancedMesh(crystalGeo, mat, 256);
    this.crystalMesh.count = 0;
    this.crystalMesh.frustumCulled = false;
    scene.add(this.crystalMesh);
  }

  private add(s: Spawn): void {
    this.particles.spawn(s);
  }

  /**
   * La pelota le pegó a uno: más grande y más brillante cuanto mejor el golpe. 1, triangulitos blancos; 2,
   * una estrella de puntas y rayitas; 3, además un destello; el perfecto, el estallido grande con
   * estrellas que saltan.
   */
  impact(pos: THREE.Vector3, quality: number, perfect: boolean): void {
    const { x, y, z } = pos;
    const q = perfect ? 4 : Math.min(3, Math.max(1, quality));
    const color = q === 1 ? 0xffffff : q === 2 ? 0xffe680 : q === 3 ? 0xffb14a : 0xffe14a;
    // los triangulitos que salen para afuera
    const tris = [5, 6, 8, 10][q - 1];
    for (let i = 0; i < tris; i++) {
      const a = (i / tris) * TAU + rand(-0.3, 0.3);
      const up = rand(-0.4, 0.8);
      const sp = rand(5, 8) * (0.8 + q * 0.15);
      this.add({ sprite: 'hit', layer: 'alpha', x, y, z, vx: Math.cos(a) * sp, vy: up * sp, vz: Math.sin(a) * sp, drag: 9, life: 0.24 + q * 0.03, size: 0.3 + q * 0.07, sizeEnd: 0.06, aligned: true, color, intensity: 1.15, fadeOut: 0.45 });
    }
    if (q >= 2) {
      this.add({ sprite: 'spikes', layer: 'alpha', x, y, z, life: 0.16 + q * 0.03, size: 0.8 + q * 0.4, sizeEnd: 1.3 + q * 0.6, rot: rand(0, TAU), color, intensity: 1.15, fadeOut: 0.25 });
      this.add({ sprite: 'spikes', layer: 'alpha', x, y, z, life: 0.12 + q * 0.02, size: 0.5 + q * 0.25, sizeEnd: 0.8 + q * 0.35, rot: rand(0, TAU), color: 0xffffff, intensity: 1.2, fadeOut: 0.2 });
      for (let i = 0; i < 4 + q * 2; i++) {
        const a = rand(0, TAU);
        const sp = rand(9, 14);
        this.add({ sprite: 'trait', layer: 'alpha', x, y, z, vx: Math.cos(a) * sp, vy: rand(-3, 6), vz: Math.sin(a) * sp, drag: 10, life: 0.22, size: 0.16, sizeEnd: 0.03, stretch: 1.4, aligned: true, color: 0xffffff, colorEnd: color, intensity: 1.15 });
      }
    }
    if (q >= 3) {
      this.add({ sprite: 'flare', x, y, z, life: 0.2, size: 0.9 + q * 0.2, sizeEnd: 0.4, color: 0xffffff, colorEnd: color, intensity: 2.2, fadeOut: 0.3 });
      this.add({ sprite: 'glow', x, y, z, life: 0.25, size: 1.6, sizeEnd: 2.6, color, intensity: 1.4, alpha: 0.7, fadeOut: 0.2 });
    }
    if (q === 4) {
      // el estallido: puntas naranjas grandes, blancas adentro, y un destello
      this.add({ sprite: 'spikes', layer: 'alpha', x, y, z, life: 0.26, size: 2.6, sizeEnd: 3.4, rot: rand(0, TAU), color: 0xffb02a, colorEnd: 0xff6a1a, intensity: 1.2, fadeOut: 0.3 });
      this.add({ sprite: 'spikes', layer: 'alpha', x, y, z, life: 0.22, size: 1.8, sizeEnd: 2.4, rot: rand(0, TAU), color: 0xffe14a, intensity: 1.25, fadeOut: 0.3 });
      this.add({ sprite: 'flare', x, y, z, life: 0.25, size: 2.2, sizeEnd: 1, color: 0xffffff, colorEnd: 0xffd24a, intensity: 2.4, fadeOut: 0.3 });
      for (let i = 0; i < 6; i++) {
        const a = rand(0, TAU);
        this.add({ sprite: 'star', layer: 'alpha', x, y: y + 0.3, z, vx: Math.cos(a) * rand(2.5, 5), vy: rand(4, 8), vz: Math.sin(a) * rand(2.5, 5), gravity: -14, life: rand(0.6, 0.85), size: rand(0.4, 0.6), spin: rand(-8, 8), color: 0xffe14a, intensity: 1.2, fadeOut: 0.65 });
      }
    }
  }

  /** Chispas de metal: el blindado y el escudo. */
  sparks(pos: THREE.Vector3, color = 0xffe3a0): void {
    for (let i = 0; i < 9; i++) {
      const a = rand(0, TAU);
      const sp = rand(6, 12);
      this.add({ sprite: 'trait', x: pos.x, y: pos.y, z: pos.z, vx: Math.cos(a) * sp, vy: rand(1, 8), vz: Math.sin(a) * sp, gravity: -20, drag: 2, life: rand(0.25, 0.45), size: 0.08, stretch: 1.6, aligned: true, color: 0xffffff, colorEnd: color, intensity: 2 });
    }
    this.add({ sprite: 'spark', x: pos.x, y: pos.y, z: pos.z, life: 0.15, size: 0.9, sizeEnd: 1.3, color, intensity: 2 });
  }

  /** Rebotó contra un intocable o un protegido: un anillo violeta que se abre, como agua. */
  repel(pos: THREE.Vector3, color = 0xb26bff): void {
    this.add({ sprite: 'spark', x: pos.x, y: pos.y, z: pos.z, life: 0.25, size: 0.6, sizeEnd: 2, color, intensity: 1.6, fadeOut: 0.2 });
    this.add({ sprite: 'glow', x: pos.x, y: pos.y, z: pos.z, life: 0.3, size: 1.4, sizeEnd: 0.4, color, intensity: 1.2, alpha: 0.6 });
  }

  /** Una explosión: el fogonazo, el humo, las rayas y la marca quemada en el piso. */
  explosion(pos: THREE.Vector3, radius: number, color: number): void {
    const ground = heightAt(pos.x, pos.z);
    const x = pos.x, z = pos.z;
    const y = Math.max(ground + 0.4, pos.y);
    const r = Math.max(0.6, radius);
    this.add({ sprite: 'glow', x, y, z, life: 0.22, size: r * 2.2, sizeEnd: r * 3, color: 0xfff1b8, intensity: 2.2, fadeOut: 0.2 });
    this.add({ sprite: 'spikes', layer: 'alpha', x, y, z, life: 0.22, size: r * 1.6, sizeEnd: r * 2.6, rot: rand(0, TAU), color: 0xffd25a, colorEnd: color, intensity: 1.2, fadeOut: 0.3 });
    // el humo: varias bocanadas que suben y se apagan
    const puffs = Math.round(4 + r * 2);
    for (let i = 0; i < puffs; i++) {
      const a = rand(0, TAU);
      const d = rand(0.2, 0.8) * r;
      this.add({ sprite: 'smoke', frame: -1, layer: 'alpha', x: x + Math.cos(a) * d, y: y + rand(-0.2, 0.4), z: z + Math.sin(a) * d, vx: Math.cos(a) * rand(1, 2.5), vy: rand(1.2, 2.6), vz: Math.sin(a) * rand(1, 2.5), drag: 2.5, life: rand(0.6, 1.0), size: r * rand(0.7, 1.0), sizeEnd: r * rand(1.3, 1.8), rot: rand(0, TAU), spin: rand(-1, 1), color: 0x5a524c, colorEnd: 0x2e2a28, alpha: 0.75, fadeIn: 0.05, fadeOut: 0.35 });
    }
    // el fuego adentro del humo
    for (let i = 0; i < puffs; i++) {
      const a = rand(0, TAU);
      this.add({ sprite: 'fireBlur', layer: 'alpha', x: x + Math.cos(a) * r * 0.3, y, z: z + Math.sin(a) * r * 0.3, vx: Math.cos(a) * rand(2, 5), vy: rand(1, 3), vz: Math.sin(a) * rand(2, 5), drag: 5, life: rand(0.25, 0.4), size: r * 0.9, sizeEnd: r * 0.35, color: 0xffe08a, colorEnd: color, intensity: 1.2 });
    }
    for (let i = 0; i < 10; i++) {
      const a = rand(0, TAU);
      const sp = rand(10, 18) * Math.sqrt(r);
      this.add({ sprite: 'trait', x, y, z, vx: Math.cos(a) * sp, vy: rand(2, 9), vz: Math.sin(a) * sp, gravity: -12, drag: 4, life: rand(0.25, 0.4), size: 0.14, stretch: 1.6, aligned: true, color: 0xfff1b8, colorEnd: color, intensity: 1.8 });
    }
    this.add({ sprite: 'crater', layer: 'ground', x, y: ground + 0.04, z, life: 3.5, size: r * 1.7, rot: rand(0, TAU), color: 0x1a1410, alpha: 0.7, fadeOut: 0.6 });
  }

  /** Una nube que se esfuma: aparece o se va uno. */
  poof(pos: THREE.Vector3, size: number, color = 0xe8e4dc): void {
    for (let i = 0; i < 5; i++) {
      const a = rand(0, TAU);
      this.add({ sprite: 'smoke', frame: -1, layer: 'alpha', x: pos.x + Math.cos(a) * size * 0.3, y: pos.y + rand(0, size * 0.6), z: pos.z + Math.sin(a) * size * 0.3, vx: Math.cos(a) * 1.5, vy: rand(0.5, 1.5), vz: Math.sin(a) * 1.5, drag: 3, life: rand(0.45, 0.7), size: size * 0.6, sizeEnd: size * 1.1, rot: rand(0, TAU), color, alpha: 0.8, fadeOut: 0.4 });
    }
    for (let i = 0; i < 4; i++) {
      this.add({ sprite: 'star', x: pos.x, y: pos.y + size * 0.5, z: pos.z, vx: rand(-2, 2), vy: rand(2, 4), vz: rand(-2, 2), gravity: -8, life: 0.5, size: 0.2, spin: rand(-6, 6), color: 0xfff6c8, intensity: 1.5, fadeOut: 0.5 });
    }
  }

  /** Un mordisco del fuego: un fogonazo chico y chispas. */
  burnTick(body: FxBody): void {
    const p = body.position;
    const y = p.y + body.height * rand(0.35, 0.7);
    this.add({ sprite: 'fireBlur', x: p.x, y, z: p.z, life: 0.25, size: body.radius * 1.8, sizeEnd: body.radius * 2.6, color: 0xffd25a, colorEnd: 0xff3a12, intensity: 2, fadeOut: 0.2 });
    for (let i = 0; i < 5; i++) this.add({ sprite: 'ember', x: p.x + rand(-0.3, 0.3), y, z: p.z + rand(-0.3, 0.3), vx: rand(-1.5, 1.5), vy: rand(2, 4), vz: rand(-1.5, 1.5), gravity: 2, life: rand(0.4, 0.7), size: 0.1, color: 0xffb04a, colorEnd: 0xff3a12, intensity: 2.2, fadeOut: 0.5 });
  }

  /** Se curó: cruces que suben y un brillo verde. */
  heal(pos: THREE.Vector3, height: number, amount = 1): void {
    const n = Math.min(8, 2 + amount);
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      this.add({ sprite: 'plus', layer: 'alpha', x: pos.x + Math.cos(a) * 0.5, y: pos.y + height * rand(0.3, 0.8), z: pos.z + Math.sin(a) * 0.5, vy: rand(1.2, 2.2), drag: 1, life: rand(0.7, 1), size: 0.42, sizeEnd: 0.26, color: 0xb8ffa8, colorEnd: 0x2fd86a, intensity: 1.2, fadeIn: 0.1, fadeOut: 0.5 });
    }
    this.add({ sprite: 'glow', x: pos.x, y: pos.y + height * 0.55, z: pos.z, life: 0.5, size: height * 1.1, sizeEnd: height * 1.4, color: 0x3ee07a, intensity: 1.2, alpha: 0.6, fadeIn: 0.15, fadeOut: 0.4 });
  }

  /** El curandero cumplió su ciclo: su círculo de runas se abre en el piso. */
  healPulse(pos: THREE.Vector3, radius: number): void {
    this.add({ sprite: 'circle', layer: 'groundAdd', x: pos.x, y: heightAt(pos.x, pos.z) + 0.07, z: pos.z, life: 0.9, size: radius * 0.6, sizeEnd: radius * 2.1, spin: 1.2, color: 0x7dff9a, intensity: 1.6, fadeOut: 0.4 });
  }

  /** Se rompió la burbuja del bendito: el destello sagrado y los pedazos dorados. */
  bubblePop(pos: THREE.Vector3, height: number, radius: number): void {
    const y = pos.y + height * 0.5;
    this.add({ sprite: 'holy', x: pos.x, y, z: pos.z, life: 0.35, size: height * 0.9, sizeEnd: height * 1.4, color: 0xfff1a8, intensity: 2.2, fadeOut: 0.3 });
    this.add({ sprite: 'glow', x: pos.x, y, z: pos.z, life: 0.3, size: height * 1.4, sizeEnd: height * 1.8, color: 0xffd84a, intensity: 1.2, alpha: 0.6 });
    for (let i = 0; i < 12; i++) {
      const a = rand(0, TAU);
      const up = rand(-0.4, 1);
      const sp = rand(3, 6);
      this.add({ sprite: 'hit', layer: 'alpha', x: pos.x + Math.cos(a) * radius, y: y + up * height * 0.4, z: pos.z + Math.sin(a) * radius, vx: Math.cos(a) * sp, vy: up * sp, vz: Math.sin(a) * sp, gravity: -10, drag: 2, life: rand(0.4, 0.6), size: 0.3, aligned: true, color: 0xfff1a8, colorEnd: 0xffb43a, intensity: 1.2 });
    }
  }

  /** La burbuja se vuelve a armar: chispitas doradas que se juntan. */
  bubbleUp(pos: THREE.Vector3, height: number, radius: number): void {
    const y = pos.y + height * 0.5;
    for (let i = 0; i < 10; i++) {
      const a = rand(0, TAU);
      const d = radius * 2.2;
      this.add({ sprite: 'point', x: pos.x + Math.cos(a) * d, y: y + rand(-0.4, 0.4) * height, z: pos.z + Math.sin(a) * d, vx: -Math.cos(a) * d * 2.6, vz: -Math.sin(a) * d * 2.6, life: 0.38, size: 0.25, sizeEnd: 0.1, color: 0xfff1a8, intensity: 2, fadeIn: 0.2 });
    }
  }

  /** Esquivó: unas rayas para el lado que saltó. */
  dodge(pos: THREE.Vector3, height: number): void {
    for (let i = 0; i < 6; i++) {
      this.add({ sprite: 'traitBlur', x: pos.x + rand(-0.3, 0.3), y: pos.y + height * rand(0.2, 0.9), z: pos.z + rand(-0.3, 0.3), vx: rand(-1, 1), life: 0.25, size: 0.18, stretch: 1.2, color: 0xffffff, alpha: 0.7, fadeOut: 0.3 });
    }
  }

  /**
   * Lo que se dibuja solo en cada cuadro: las llamas de los que se queman, los cristales de los congelados,
   * el aura del golfista con guante (`glove`) y la estela de las pelotas de fuego.
   */
  update(dt: number, bodies: readonly FxBody[], player: THREE.Vector3 | null, glove: Element | null, fireBalls: readonly THREE.Vector3[]): void {
    if (dt > 0) {
      if (polished('burning')) this.burnFlames(dt, bodies);
      if (polished('auras') && player && glove) this.aura(dt, player, glove);
      if (polished('auras') && fireBalls.length) this.trails(dt, fireBalls);
    }
    this.updateCrystals(dt, bodies);
    this.particles.update(dt);
  }

  private burnFlames(dt: number, bodies: readonly FxBody[]): void {
    for (const b of bodies) {
      if (!b.alive || !b.burning) {
        this.burnClock.delete(b.id);
        continue;
      }
      // unas 16 llamas por segundo, más en los grandes
      let t = (this.burnClock.get(b.id) ?? 0) + dt * (18 + b.radius * 14);
      while (t >= 1) {
        t -= 1;
        const a = rand(0, TAU);
        const d = rand(0, b.radius * 0.7);
        const h = b.height * rand(0.1, 0.8);
        this.add({ sprite: 'flame', layer: 'alpha', x: b.position.x + Math.cos(a) * d, y: b.position.y + h, z: b.position.z + Math.sin(a) * d, vy: rand(1.4, 2.6), drag: 1, life: rand(0.4, 0.6), size: b.height * rand(0.4, 0.55), sizeEnd: b.height * 0.1, color: 0xffe68a, colorEnd: 0xff3a12, intensity: 1.25, fadeIn: 0.1, fadeOut: 0.5 });
        if (Math.random() < 0.25) this.add({ sprite: 'glow', x: b.position.x, y: b.position.y + b.height * 0.5, z: b.position.z, life: 0.3, size: b.height * 1.2, color: 0xff7a2a, intensity: 1, alpha: 0.35, fadeIn: 0.3 });
        if (Math.random() < 0.15) this.add({ sprite: 'ember', x: b.position.x, y: b.position.y + h, z: b.position.z, vx: rand(-1, 1), vy: rand(2, 3.5), vz: rand(-1, 1), life: 0.6, size: 0.08, color: 0xffb04a, intensity: 2.2, fadeOut: 0.5 });
      }
      this.burnClock.set(b.id, t);
    }
  }

  private aura(dt: number, at: THREE.Vector3, element: Element): void {
    const c = AURA[element];
    this.auraClock += dt * 30;
    while (this.auraClock >= 1) {
      this.auraClock -= 1;
      const a = rand(0, TAU);
      const d = rand(0.25, 0.55);
      const x = at.x + Math.cos(a) * d;
      const z = at.z + Math.sin(a) * d;
      const y = at.y + rand(0.05, 1.4);
      switch (element) {
        case 'fire':
          this.add({ sprite: 'flame', layer: 'alpha', x, y, z, vy: rand(1.6, 2.8), life: rand(0.4, 0.6), size: rand(0.55, 0.85), sizeEnd: 0.12, color: c.a, colorEnd: c.b, intensity: 1.25, fadeIn: 0.12, fadeOut: 0.5 });
          break;
        case 'ice':
          this.add({ sprite: 'snow', x, y: y + 0.6, z, vy: -rand(0.4, 0.9), vx: rand(-0.3, 0.3), life: rand(0.8, 1.2), size: rand(0.12, 0.2), spin: rand(-2, 2), color: c.a, colorEnd: c.b, intensity: 1.5, fadeIn: 0.15, fadeOut: 0.6 });
          break;
        case 'lightning':
          if (Math.random() < 0.4) this.add({ sprite: 'arcs', frame: -1, x, y, z, life: 0.08, size: rand(0.25, 0.4), stretch: 0.6, rot: rand(0, TAU), color: c.a, colorEnd: c.b, intensity: 2.4 });
          else this.add({ sprite: 'point', x, y, z, vx: rand(-1, 1), vy: rand(-1, 1), vz: rand(-1, 1), life: 0.2, size: 0.12, color: c.a, colorEnd: c.b, intensity: 2.2 });
          break;
        case 'wind':
          this.add({ sprite: 'traitBlur', x, y, z, vx: -Math.sin(a) * 4, vz: Math.cos(a) * 4, life: 0.3, size: 0.12, stretch: 1.2, aligned: true, color: c.a, colorEnd: c.b, intensity: 1.3, alpha: 0.8 });
          break;
        case 'ghost':
          this.add({ sprite: 'smoke', frame: -1, x, y, z, vy: rand(0.4, 0.9), life: rand(0.6, 0.9), size: 0.35, sizeEnd: 0.6, rot: rand(0, TAU), color: c.a, colorEnd: c.b, intensity: 0.9, alpha: 0.5, fadeIn: 0.2, fadeOut: 0.4 });
          break;
        case 'silence':
          this.add({ sprite: 'point', x, y, z, vy: rand(0.3, 0.8), life: 0.6, size: 0.14, color: c.a, colorEnd: c.b, intensity: 1.8, fadeIn: 0.2 });
          break;
      }
    }
    // el brillo del golfista, que late
    if (Math.random() < dt * 8) this.add({ sprite: 'glow', x: at.x, y: at.y + 0.9, z: at.z, life: 0.35, size: 2.2, sizeEnd: 2.6, color: c.b, intensity: 0.8, alpha: 0.35, fadeIn: 0.3, fadeOut: 0.5 });
  }

  private trails(dt: number, balls: readonly THREE.Vector3[]): void {
    this.trailClock += dt * 40;
    while (this.trailClock >= 1) {
      this.trailClock -= 1;
      for (const b of balls) this.add({ sprite: 'fireBlur', layer: 'alpha', x: b.x + rand(-0.05, 0.05), y: b.y, z: b.z + rand(-0.05, 0.05), vy: rand(0.2, 0.6), life: 0.32, size: 0.6, sizeEnd: 0.12, color: 0xffe08a, colorEnd: 0xff3a12, intensity: 1.2 });
    }
  }

  /** Los congelados llevan cristales; al soltarse se rompen y saltan. */
  private updateCrystals(dt: number, bodies: readonly FxBody[]): void {
    const on = polished('frozen');
    const seen = new Set<number>();
    for (const b of bodies) {
      if (!on || !b.alive || !b.frozen) continue;
      seen.add(b.id);
      let c = this.crystals.get(b.id);
      if (!c) {
        const n = 4 + Math.floor(Math.random() * 3);
        c = { body: b, grow: 0, parts: Array.from({ length: n }, (_, i) => {
          const a = (i / n) * TAU + rand(-0.4, 0.4);
          return { dx: Math.cos(a) * rand(0.5, 0.9), dy: rand(0, 0.55), dz: Math.sin(a) * rand(0.5, 0.9), s: rand(0.35, 0.6), tilt: rand(0.2, 0.6), yaw: a };
        }) };
        this.crystals.set(b.id, c);
      }
      c.grow = Math.min(1, c.grow + dt * 8);
    }
    // los que se soltaron (o murieron): se rompen
    for (const [id, c] of this.crystals) {
      if (seen.has(id)) continue;
      this.crystals.delete(id);
      if (on) this.shatter(c.body.position, c.body.height, c.body.radius);
    }
    let n = 0;
    for (const c of this.crystals.values()) {
      const b = c.body;
      for (const p of c.parts) {
        if (n >= this.crystalMesh.instanceMatrix.count) break;
        const s = p.s * b.height * c.grow;
        this.v.set(b.position.x + p.dx * b.radius, b.position.y + p.dy * b.height, b.position.z + p.dz * b.radius);
        this.e.set(Math.sin(p.yaw) * p.tilt, 0, -Math.cos(p.yaw) * p.tilt);
        this.q.setFromEuler(this.e);
        this.sc.set(s, s, s);
        this.m4.compose(this.v, this.q, this.sc);
        this.crystalMesh.setMatrixAt(n++, this.m4);
      }
    }
    this.crystalMesh.count = n;
    this.crystalMesh.instanceMatrix.needsUpdate = true;
  }

  /** El hielo que se rompe: pedazos celestes y copos. */
  shatter(pos: THREE.Vector3, height: number, radius: number): void {
    const y = pos.y + height * 0.4;
    for (let i = 0; i < 12; i++) {
      const a = rand(0, TAU);
      const sp = rand(3, 7);
      this.add({ sprite: 'hit', layer: 'alpha', x: pos.x + Math.cos(a) * radius * 0.6, y: y + rand(-0.3, 0.6), z: pos.z + Math.sin(a) * radius * 0.6, vx: Math.cos(a) * sp, vy: rand(2, 6), vz: Math.sin(a) * sp, gravity: -18, life: rand(0.45, 0.65), size: 0.3, aligned: true, color: 0xeaf8ff, colorEnd: 0x7fd0ff, intensity: 1.15 });
    }
    for (let i = 0; i < 6; i++) this.add({ sprite: 'snow', x: pos.x + rand(-0.6, 0.6), y: y + rand(0, 0.8), z: pos.z + rand(-0.6, 0.6), vy: -0.5, life: 0.9, size: 0.18, spin: rand(-3, 3), color: 0xeaf8ff, intensity: 1.4, fadeOut: 0.5 });
    this.add({ sprite: 'crack', layer: 'groundAdd', x: pos.x, y: heightAt(pos.x, pos.z) + 0.05, z: pos.z, life: 1.2, size: radius * 2.6, rot: rand(0, TAU), color: 0x9fe0ff, intensity: 1.2, alpha: 0.8, fadeOut: 0.4 });
  }
}
