// Lo que se ve del caddie (ver docs/jefes/caddie.md): un color y un ícono por palo, el sello sobre la cabeza
// de un enemigo (un círculo oscuro con el ícono del palo, del color del palo, y un anillo a los pies), el hoyo
// de donde sale una formación, el grito del palo arriba de él y la funda que tira para sellar. Todo tiene que
// leerse desde la cámara alta: el color dice el palo, el ícono lo confirma.
import * as THREE from 'three';
import type { ClubId } from '../../../core/clubs';
import { L } from '../../../i18n';
import type { Enemy } from '../../enemies';
import { heightAt } from '../kit';

/**
 * El color de cada palo en esta pelea. Los palos del HUD comparten color (el de las habilidades es otra cosa),
 * así que acá van cuatro tonos bien distintos entre sí: amarillo el driver, rojo el hierro, verde el wedge y
 * azul el putter. El ícono (el mismo del HUD) dice el palo aunque el color se confunda con un poder.
 */
export const CLUB_TINT: Record<ClubId, number> = { driver: 0xffc83d, iron: 0xff6b4a, wedge: 0x5fd38a, putter: 0x56a8ff };
export const CLUB_CSS: Record<ClubId, string> = { driver: '#ffc83d', iron: '#ff6b4a', wedge: '#5fd38a', putter: '#56a8ff' };
/** El nombre que grita (lo ve el jugador). */
export const CLUB_CALL: Record<ClubId, string> = {
  driver: L('¡Driver!', 'Driver!'),
  iron: L('¡Hierro!', 'Iron!'),
  wedge: L('¡Wedge!', 'Wedge!'),
  putter: L('¡Putter!', 'Putter!'),
};

const additive = (color: number, opacity: number) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });

/** El ícono del palo (public/clubs, blanco sobre transparente), teñido con su color, en un círculo oscuro. */
function drawBadge(club: ClubId, tex: THREE.CanvasTexture, canvas: HTMLCanvasElement): void {
  const g = canvas.getContext('2d')!;
  const S = canvas.width;
  g.clearRect(0, 0, S, S);
  g.fillStyle = 'rgba(12,14,20,0.86)';
  g.strokeStyle = CLUB_CSS[club];
  g.lineWidth = S * 0.08;
  g.beginPath();
  g.arc(S / 2, S / 2, S / 2 - g.lineWidth / 2 - 1, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  const img = new Image();
  img.onload = () => {
    // el ícono blanco, teñido: se dibuja en otro lienzo y se pinta encima con el color (source-in)
    const t = document.createElement('canvas');
    t.width = t.height = S;
    const tg = t.getContext('2d')!;
    const pad = S * 0.2;
    tg.drawImage(img, pad, pad, S - 2 * pad, S - 2 * pad);
    tg.globalCompositeOperation = 'source-in';
    tg.fillStyle = CLUB_CSS[club];
    tg.fillRect(0, 0, S, S);
    g.drawImage(t, 0, 0);
    tex.needsUpdate = true;
  };
  img.src = `${import.meta.env.BASE_URL}clubs/${club}.png`;
}

/** El grito arriba del caddie: el nombre del palo, grande, del color del palo. */
function drawCall(club: ClubId): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.font = '900 86px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 14;
  g.strokeStyle = 'rgba(10,12,16,0.9)';
  g.strokeText(CLUB_CALL[club], 256, 66);
  g.fillStyle = CLUB_CSS[club];
  g.fillText(CLUB_CALL[club], 256, 66);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const sprite = (map: THREE.Texture, size: number) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthTest: false, depthWrite: false }));
  s.scale.setScalar(size);
  s.renderOrder = 13;
  return s;
};

/** Lo que comparten los sellos, los hoyos y los gritos de una pelea, para liberarlo al final. */
export class CaddieFx {
  readonly badge = {} as Record<ClubId, THREE.CanvasTexture>;
  readonly call = {} as Record<ClubId, THREE.CanvasTexture>;
  readonly ringGeo = new THREE.RingGeometry(0.8, 1, 40);
  readonly diskGeo = new THREE.CircleGeometry(1, 28);
  readonly coverGeo = new THREE.CylinderGeometry(0.22, 0.3, 0.55, 8);
  private readonly items: { update(dt: number): boolean; dispose(): void }[] = [];

  constructor(readonly scene: THREE.Scene) {
    for (const club of ['driver', 'iron', 'wedge', 'putter'] as ClubId[]) {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      drawBadge(club, tex, c);
      this.badge[club] = tex;
      this.call[club] = drawCall(club);
    }
  }

  /** Algo que vive solo hasta que `update` devuelve false (los gritos, las fundas que vuelan). */
  add(item: { update(dt: number): boolean; dispose(): void }): void {
    this.items.push(item);
  }

  update(dt: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      if (this.items[i].update(dt)) continue;
      this.items[i].dispose();
      this.items.splice(i, 1);
    }
  }

  dispose(): void {
    for (const it of this.items) it.dispose();
    this.items.length = 0;
    for (const t of Object.values(this.badge)) t.dispose();
    for (const t of Object.values(this.call)) t.dispose();
    this.ringGeo.dispose();
    this.diskGeo.dispose();
    this.coverGeo.dispose();
  }
}

/**
 * El sello de un palo sobre un enemigo: el ícono del palo arriba de la vida y un anillo de su color a los
 * pies. Con `badge` en false, solo el anillo (las formaciones sin sello: el color dice para qué palo es).
 */
export class SealFx {
  private readonly sprite: THREE.Sprite | null;
  private readonly ring: THREE.Mesh;
  private readonly ringMat: THREE.MeshBasicMaterial;
  private age = Math.random() * 3;
  constructor(fx: CaddieFx, private readonly e: Enemy, readonly club: ClubId, badge = true, private readonly size = 1.6) {
    this.sprite = badge ? sprite(fx.badge[club], size) : null;
    if (this.sprite) {
      this.sprite.position.y = e.stats.height + 0.6 + size * 0.55;
      e.group.add(this.sprite);
    }
    this.ringMat = additive(CLUB_TINT[club], badge ? 0.75 : 0.55);
    this.ring = new THREE.Mesh(fx.ringGeo, this.ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.08;
    this.ring.scale.setScalar(e.stats.radius * 1.5 + 0.35);
    this.ring.renderOrder = 3;
    e.group.add(this.ring);
  }
  update(dt: number): void {
    this.age += dt;
    const pulse = 0.5 + 0.5 * Math.sin(this.age * 4);
    this.ringMat.opacity = (this.sprite ? 0.55 : 0.4) + 0.25 * pulse;
    if (this.sprite) {
      // aparece creciendo
      const grow = Math.min(1, this.age / 0.25);
      this.sprite.scale.setScalar(this.size * (0.4 + 0.6 * grow));
    }
  }
  dispose(): void {
    if (this.sprite) {
      this.e.group.remove(this.sprite);
      (this.sprite.material as THREE.Material).dispose();
    }
    this.e.group.remove(this.ring);
    this.ringMat.dispose();
  }
}

/**
 * Un hoyo en el pasto, de donde va a salir uno: un disco de tierra que se abre y un anillo del color del
 * palo que se cierra hacia el centro (cuando llega, sale). `progress` de 0 a 1.
 */
export class HoleFx {
  private readonly group = new THREE.Group();
  private readonly dirtMat = new THREE.MeshBasicMaterial({ color: 0x2a1c10, transparent: true, opacity: 0, depthWrite: false });
  private readonly ringMat: THREE.MeshBasicMaterial;
  private readonly dirt: THREE.Mesh;
  private readonly ring: THREE.Mesh;
  private age = 0;
  constructor(private readonly fx: CaddieFx, x: number, z: number, club: ClubId, private readonly radius = 0.8) {
    this.ringMat = additive(CLUB_TINT[club], 0.8);
    this.dirt = new THREE.Mesh(fx.diskGeo, this.dirtMat);
    this.dirt.rotation.x = -Math.PI / 2;
    this.ring = new THREE.Mesh(fx.ringGeo, this.ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.02;
    this.dirt.renderOrder = this.ring.renderOrder = 3;
    this.group.add(this.dirt, this.ring);
    this.group.position.set(x, heightAt(x, z) + 0.07, z);
    fx.scene.add(this.group);
    this.update(0, 0);
  }
  /** `progress`: de 0 (recién marcado) a 1 (sale); después, `after` de 0 a 1 se va cerrando el pozo. */
  update(dt: number, progress: number, after = 0): void {
    this.age += dt;
    const pulse = 0.5 + 0.5 * Math.sin(this.age * (6 + 10 * progress));
    this.dirt.scale.setScalar(this.radius * Math.min(1, 0.3 + progress) * (1 - 0.6 * after));
    this.dirtMat.opacity = (0.55 + 0.25 * progress) * (1 - after);
    this.ring.scale.setScalar(this.radius * (2.2 - 1.3 * progress));
    this.ringMat.opacity = (0.45 + 0.4 * progress + 0.15 * pulse) * (1 - after);
  }
  dispose(): void {
    this.fx.scene.remove(this.group);
    this.dirtMat.dispose();
    this.ringMat.dispose();
  }
}

/** El grito: el nombre del palo sube arriba de la cabeza del caddie y se apaga. */
export class CallFx {
  private readonly sprite: THREE.Sprite;
  private t = 0;
  constructor(private readonly fx: CaddieFx, private readonly e: Enemy, club: ClubId, private readonly life = 1.8) {
    const mat = new THREE.SpriteMaterial({ map: fx.call[club], transparent: true, depthTest: false, depthWrite: false });
    this.sprite = new THREE.Sprite(mat);
    this.sprite.renderOrder = 14;
    fx.scene.add(this.sprite);
    this.update(0);
  }
  update(dt: number): boolean {
    this.t += dt;
    const u = this.t / this.life;
    const pop = Math.min(1, this.t / 0.18);
    const w = 6.5 * (0.6 + 0.4 * pop) * (1 + 0.08 * Math.sin(this.t * 10) * (1 - u));
    this.sprite.scale.set(w, w / 4, 1);
    this.sprite.position.set(this.e.position.x, this.e.position.y + this.e.height + 3.2 + u * 1.2, this.e.position.z);
    (this.sprite.material as THREE.SpriteMaterial).opacity = u < 0.7 ? 1 : Math.max(0, 1 - (u - 0.7) / 0.3);
    return this.t < this.life;
  }
  dispose(): void {
    this.fx.scene.remove(this.sprite);
    (this.sprite.material as THREE.Material).dispose();
  }
}

/** La funda del palo que tira para sellar: vuela en arco, girando, del color del palo. */
export class CoverFx {
  private readonly mesh: THREE.Mesh;
  private readonly mat: THREE.MeshStandardMaterial;
  private t = 0;
  private readonly at = new THREE.Vector3();
  constructor(private readonly fx: CaddieFx, private readonly from: THREE.Vector3, private readonly to: () => THREE.Vector3, club: ClubId, private readonly time: number, private readonly onLand: () => void) {
    this.mat = new THREE.MeshStandardMaterial({ color: CLUB_TINT[club], emissive: CLUB_TINT[club], emissiveIntensity: 0.6, roughness: 0.7, flatShading: true });
    this.mesh = new THREE.Mesh(fx.coverGeo, this.mat);
    this.mesh.castShadow = true;
    fx.scene.add(this.mesh);
    this.update(0);
  }
  update(dt: number): boolean {
    this.t += dt;
    const u = Math.min(1, this.t / this.time);
    const end = this.to();
    this.at.lerpVectors(this.from, end, u);
    this.at.y += Math.sin(Math.PI * u) * (3 + 0.12 * this.from.distanceTo(end));
    this.mesh.position.copy(this.at);
    this.mesh.rotation.x += dt * 9;
    this.mesh.rotation.z += dt * 5;
    if (u >= 1) {
      this.onLand();
      return false;
    }
    return true;
  }
  dispose(): void {
    this.fx.scene.remove(this.mesh);
    this.mat.dispose();
  }
}
