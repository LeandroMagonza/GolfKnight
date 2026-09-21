// Tótems del putter. La pelota del putter rueda lento y, donde para, deja un tótem clavado en el piso.
// El tótem no hace nada solo: espera. Cuando una pelota de driver le pega, explota, hace daño en área y
// manda a todos hacia afuera. Cuánto pega lo decidió la carga del putt, y se ve escrito sobre el tótem.
//
// Es la única forma de hacer daño lejos de la línea de tiro: se siembra antes y se cobra después.
import * as THREE from 'three';
import { TRAP_KNOCKBACK, TRAP_LIFE, TRAP_MAX, TRAP_RADIUS, trapDamage } from '../core/clubs';
import { heightAt } from '../core/terrain';
import type { Effects } from './effects';
import type { Horde } from './enemies';

export interface Trap {
  pos: THREE.Vector3;
  damage: number;
  perfect: boolean;
  age: number;
  group: THREE.Group;
  crystal: THREE.Mesh;
  ring: THREE.Mesh;
  label: { tex: THREE.CanvasTexture; sprite: THREE.Sprite };
  done: boolean;
}

const COLOR = 0xc9a2ff;
const baseGeo = new THREE.CylinderGeometry(0.34, 0.42, 0.5, 7);
const crystalGeo = new THREE.OctahedronGeometry(0.3, 0);
const ringGeo = new THREE.RingGeometry(0.94, 1, 40);

function damageLabel(damage: number, perfect: boolean): { tex: THREE.CanvasTexture; sprite: THREE.Sprite } {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = perfect ? '#ff2d3c' : '#c9a2ff';
  g.beginPath();
  g.arc(32, 32, 27, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 5;
  g.strokeStyle = 'rgba(8, 12, 18, 0.85)';
  g.stroke();
  g.fillStyle = '#10161d';
  g.font = 'bold 36px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(damage), 32, 35);
  const tex = new THREE.CanvasTexture(c);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.scale.set(0.62, 0.62, 1);
  sprite.position.y = 1.5;
  sprite.renderOrder = 12;
  return { tex, sprite };
}

export type TrapEvent =
  | { type: 'placed'; trap: Trap }
  | { type: 'blast'; pos: THREE.Vector3; damage: number; hits: number; perfect: boolean }
  | { type: 'expired'; pos: THREE.Vector3 };

export class Traps {
  readonly list: Trap[] = [];
  onEvent: ((e: TrapEvent) => void) | null = null;

  constructor(private readonly scene: THREE.Scene, private readonly horde: Horde, private readonly effects: Effects) {}

  /** Planta un tótem donde quedó la pelota del putter. Más de TRAP_MAX y se cae el más viejo. */
  place(pos: THREE.Vector3, power: number, perfect: boolean): Trap {
    while (this.list.length >= TRAP_MAX) this.remove(this.list[0]);
    const damage = trapDamage(power, perfect);
    const group = new THREE.Group();
    group.position.set(pos.x, heightAt(pos.x, pos.z), pos.z);
    const base = new THREE.Mesh(baseGeo, new THREE.MeshStandardMaterial({ color: 0x5a4a6b, roughness: 0.9, flatShading: true }));
    base.position.y = 0.25;
    const crystal = new THREE.Mesh(crystalGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: perfect ? 0xff2d3c : COLOR, emissiveIntensity: 1.2 }));
    crystal.position.y = 0.95;
    // el anillo dice hasta dónde llega la explosión, para poder plantarlo con criterio
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: COLOR, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    ring.scale.setScalar(TRAP_RADIUS);
    const label = damageLabel(damage, perfect);
    group.add(base, crystal, ring, label.sprite);
    this.scene.add(group);
    const trap: Trap = { pos: group.position.clone(), damage, perfect, age: 0, group, crystal, ring, label, done: false };
    this.list.push(trap);
    this.effects.blink(pos, COLOR);
    this.onEvent?.({ type: 'placed', trap });
    return trap;
  }

  /** El tótem que toca una pelota en (x, y, z), o null. */
  hitBy(x: number, y: number, z: number): Trap | null {
    for (const t of this.list) {
      if (t.done || y - t.pos.y > 1.4) continue;
      const dx = x - t.pos.x;
      const dz = z - t.pos.z;
      if (dx * dx + dz * dz <= 0.62 * 0.62) return t;
    }
    return null;
  }

  /** Lo detona: daño en área con caída hacia el borde, y a todos hacia afuera. */
  detonate(trap: Trap): void {
    if (trap.done) return;
    trap.done = true;
    const pos = trap.pos.clone();
    this.effects.explosion(pos, TRAP_RADIUS, trap.perfect ? 0xff2d3c : COLOR);
    const hits = this.horde.blast(pos, TRAP_RADIUS, trap.damage, TRAP_KNOCKBACK);
    this.onEvent?.({ type: 'blast', pos, damage: trap.damage, hits, perfect: trap.perfect });
  }

  private remove(trap: Trap): void {
    trap.done = true;
    this.scene.remove(trap.group);
    trap.label.tex.dispose();
    (trap.label.sprite.material as THREE.Material).dispose();
    (trap.crystal.material as THREE.Material).dispose();
    (trap.ring.material as THREE.Material).dispose();
    const i = this.list.indexOf(trap);
    if (i >= 0) this.list.splice(i, 1);
  }

  clear(): void {
    while (this.list.length) this.remove(this.list[0]);
  }

  update(dt: number): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const t = this.list[i];
      t.age += dt;
      // el cristal gira y late; el anillo respira. Cerca del final, titila para avisar
      t.crystal.rotation.y += dt * 1.8;
      t.crystal.position.y = 0.95 + Math.sin(t.age * 3) * 0.08;
      const left = TRAP_LIFE - t.age;
      const blink = left < 4 && Math.floor(left * 4) % 2 === 0;
      t.crystal.visible = !blink;
      (t.ring.material as THREE.MeshBasicMaterial).opacity = 0.22 + 0.12 * Math.sin(t.age * 2.5);
      if (t.done) {
        this.remove(t);
      } else if (t.age >= TRAP_LIFE) {
        this.onEvent?.({ type: 'expired', pos: t.pos.clone() });
        this.remove(t);
      }
    }
  }
}
