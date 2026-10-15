// Lo que se ve del minotauro además de su cuerpo: la barra de la carga sobre la cabeza, el polvo de las
// patadas, las estrellitas del aturdido, los números de la carga que se le baja y la pelota que rebota en
// él cuando lo desvían. Todo hecho por código, low-poly y sin texturas, como el resto.
import * as THREE from 'three';
import { heightAt } from '../kit';

/** Colores de la carga: naranja mientras junta, rojo cuando sale. */
export const CHARGE_COLOR = '#ff9a2e';
export const RUN_COLOR = '#ff4030';

/** Cuántos metros mide la barra de la carga (el cartel de la vida del jefe mide 4.6). */
const METER_WIDTH = 4.2;
const METER_HEIGHT = 0.84;
const METER_PX_W = 320;
const METER_PX_H = 64;

/**
 * La barra de la carga, arriba de la vida: un cuadradito por punto, con un par de cuernos adelante para que
 * se lea qué es, y abajo la mecha (lo que le falta para salir). Va en la escena, no en el enemigo: así no se
 * inclina con él.
 */
export class ChargeMeter {
  readonly sprite: THREE.Sprite;
  private readonly canvas = document.createElement('canvas');
  private readonly tex: THREE.CanvasTexture;
  private key = '';

  constructor(private readonly scene: THREE.Scene) {
    this.canvas.width = METER_PX_W;
    this.canvas.height = METER_PX_H;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, transparent: true, depthTest: false }));
    this.sprite.scale.set(METER_WIDTH, METER_HEIGHT, 1);
    this.sprite.renderOrder = 13;
    this.sprite.visible = false;
    scene.add(this.sprite);
  }

  /**
   * `left` de `max` puntos; `fuse` lo que le queda a la mecha (0 a 1, o null sin mecha); `running` en rojo;
   * `blink` en blanco (el golpe que le baja la carga).
   */
  draw(left: number, max: number, fuse: number | null, running: boolean, blink: boolean): void {
    const k = `${left}/${max}/${fuse === null ? '-' : Math.round(fuse * 40)}/${running}/${blink}`;
    if (k === this.key) return;
    this.key = k;
    const c = this.canvas.getContext('2d')!;
    c.clearRect(0, 0, METER_PX_W, METER_PX_H);
    const color = running ? RUN_COLOR : CHARGE_COLOR;
    // los cuernos: dos medias lunas gruesas
    c.save();
    c.translate(30, 30);
    c.lineCap = 'round';
    c.strokeStyle = '#0b0f14';
    c.lineWidth = 13;
    for (const s of [-1, 1]) {
      c.beginPath();
      c.arc(s * 7, 6, 16, s < 0 ? Math.PI * 0.95 : Math.PI * 1.55, s < 0 ? Math.PI * 1.45 : Math.PI * 0.05);
      c.stroke();
    }
    c.strokeStyle = blink ? '#ffffff' : '#f2e6c8';
    c.lineWidth = 7;
    for (const s of [-1, 1]) {
      c.beginPath();
      c.arc(s * 7, 6, 16, s < 0 ? Math.PI * 0.95 : Math.PI * 1.55, s < 0 ? Math.PI * 1.45 : Math.PI * 0.05);
      c.stroke();
    }
    c.restore();
    // un cuadradito por punto, en una fila que ocupa siempre lo mismo
    const x0 = 64;
    const w = METER_PX_W - x0 - 6;
    const slot = w / Math.max(1, max);
    const top = 8;
    const h = 30;
    for (let i = 0; i < max; i++) {
      c.fillStyle = i < left ? (blink ? '#ffffff' : color) : 'rgba(10, 14, 20, 0.7)';
      c.strokeStyle = '#0b0f14';
      c.lineWidth = 3;
      c.beginPath();
      c.roundRect(x0 + i * slot + 2, top, slot - 4, h, 5);
      c.fill();
      c.stroke();
    }
    // la mecha: lo que le falta para salir corriendo, que se vacía hacia la izquierda
    if (fuse !== null) {
      const fy = top + h + 8;
      c.fillStyle = 'rgba(10, 14, 20, 0.75)';
      c.beginPath();
      c.roundRect(x0 + 2, fy, w - 4, 12, 4);
      c.fill();
      c.fillStyle = fuse < 0.25 ? RUN_COLOR : '#ffe7a8';
      c.fillRect(x0 + 2, fy, (w - 4) * Math.max(0, Math.min(1, fuse)), 12);
      c.strokeStyle = '#0b0f14';
      c.lineWidth = 2;
      c.beginPath();
      c.roundRect(x0 + 2, fy, w - 4, 12, 4);
      c.stroke();
    }
    this.tex.needsUpdate = true;
  }

  place(x: number, y: number, z: number, shake = 0): void {
    this.sprite.position.set(x + (Math.random() - 0.5) * shake, y + (Math.random() - 0.5) * shake, z);
  }

  show(on: boolean): void {
    this.sprite.visible = on;
  }

  dispose(): void {
    this.scene.remove(this.sprite);
    this.tex.dispose();
    this.sprite.material.dispose();
  }
}

interface Bit {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  age: number;
  life: number;
  grow: number;
  spin: number;
}

const puffGeo = new THREE.IcosahedronGeometry(1, 0);
const starGeo = new THREE.OctahedronGeometry(0.2, 0);
const ballGeo = new THREE.SphereGeometry(0.16, 12, 8);

/**
 * Lo chico que vuela y se apaga: el polvo de las patadas y del arranque, y la pelota que rebota en él.
 * Cada cosa vive unos décimos de segundo y se va sola.
 */
export class Debris {
  private readonly bits: Bit[] = [];
  private readonly dustMat = new THREE.MeshBasicMaterial({ color: 0xa08868, transparent: true, depthWrite: false });

  constructor(private readonly scene: THREE.Scene) {}

  /** Una nube de polvo en el piso de (x, z): `n` bolitas que suben y se abren. */
  dust(x: number, z: number, n: number, size: number, spread: number): void {
    const y = heightAt(x, z);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const mat = this.dustMat.clone();
      const mesh = new THREE.Mesh(puffGeo, mat);
      mesh.position.set(x + Math.cos(a) * spread * 0.4, y + 0.2, z + Math.sin(a) * spread * 0.4);
      mesh.scale.setScalar(size * 0.3);
      this.scene.add(mesh);
      const out = spread * (0.8 + Math.random() * 0.8);
      this.bits.push({ mesh, vel: new THREE.Vector3(Math.cos(a) * out, 0.6 + Math.random() * 1.2, Math.sin(a) * out), age: 0, life: 0.55 + Math.random() * 0.3, grow: size, spin: 0 });
    }
  }

  /** La pelota que rebotó en él: sale de `from` hacia `dir` (en el piso), en un arco, y se apaga. */
  ricochet(from: THREE.Vector3, dir: THREE.Vector3, speed: number): void {
    const mesh = new THREE.Mesh(ballGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff1b8, emissiveIntensity: 0.9, transparent: true }));
    mesh.position.copy(from);
    this.scene.add(mesh);
    this.bits.push({ mesh, vel: new THREE.Vector3(dir.x * speed, 5, dir.z * speed), age: 0, life: 0.9, grow: 0, spin: 0 });
  }

  update(dt: number): void {
    for (let i = this.bits.length - 1; i >= 0; i--) {
      const b = this.bits[i];
      b.age += dt;
      const u = b.age / b.life;
      const mat = b.mesh.material as THREE.MeshBasicMaterial;
      if (u >= 1) {
        this.scene.remove(b.mesh);
        mat.dispose();
        this.bits.splice(i, 1);
        continue;
      }
      b.mesh.position.addScaledVector(b.vel, dt);
      if (b.grow > 0) {
        // el polvo: se frena, crece y se apaga
        b.vel.multiplyScalar(Math.exp(-4 * dt));
        b.mesh.scale.setScalar(b.grow * (0.3 + 0.7 * Math.sqrt(u)));
        mat.opacity = 0.55 * (1 - u);
      } else {
        // la pelota: cae con la gravedad y se apaga al final
        b.vel.y -= 14 * dt;
        mat.opacity = u < 0.7 ? 1 : (1 - u) / 0.3;
      }
    }
  }

  dispose(): void {
    for (const b of this.bits) {
      this.scene.remove(b.mesh);
      (b.mesh.material as THREE.Material).dispose();
    }
    this.bits.length = 0;
    this.dustMat.dispose();
  }
}

/** Las estrellitas que le giran sobre la cabeza mientras está aturdido: se lee de lejos que es el momento. */
export class DizzyStars {
  readonly group = new THREE.Group();
  private readonly mat = new THREE.MeshBasicMaterial({ color: 0xffe14a, transparent: true, depthWrite: false });
  private spin = 0;

  constructor(private readonly scene: THREE.Scene, count = 5, private readonly radius = 1.1) {
    for (let i = 0; i < count; i++) {
      const s = new THREE.Mesh(starGeo, this.mat);
      const a = (i / count) * Math.PI * 2;
      s.position.set(Math.cos(a) * radius, 0, Math.sin(a) * radius);
      this.group.add(s);
    }
    this.group.visible = false;
    scene.add(this.group);
  }

  update(dt: number, x: number, y: number, z: number, on: boolean): void {
    this.group.visible = on;
    if (!on) return;
    this.spin += dt * 3.2;
    this.group.position.set(x, y, z);
    this.group.rotation.y = this.spin;
    this.group.children.forEach((c, i) => {
      c.position.y = 0.15 * Math.sin(this.spin * 2 + i * 1.3);
      c.rotation.y = this.spin * 3;
    });
    this.mat.opacity = 0.75 + 0.25 * Math.sin(this.spin * 4);
  }

  dispose(): void {
    this.scene.remove(this.group);
    this.mat.dispose();
  }
}

interface Float {
  sprite: THREE.Sprite;
  tex: THREE.CanvasTexture;
  age: number;
}

/**
 * Los números de la carga que se le baja («−3» en naranja): el golpe que solo le baja la carga no saca
 * vida, así que el número de siempre no sale.
 */
export class FloatNumbers {
  private readonly list: Float[] = [];

  constructor(private readonly scene: THREE.Scene) {}

  add(text: string, x: number, y: number, z: number, color: string): void {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const c = canvas.getContext('2d')!;
    c.font = '900 48px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineWidth = 8;
    c.strokeStyle = '#1a0d06';
    c.strokeText(text, 64, 34);
    c.fillStyle = color;
    c.fillText(text, 64, 34);
    const tex = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sprite.scale.set(2.2, 1.1, 1);
    sprite.renderOrder = 14;
    sprite.position.set(x + (Math.random() - 0.5) * 0.8, y, z);
    this.scene.add(sprite);
    this.list.push({ sprite, tex, age: 0 });
  }

  update(dt: number): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const f = this.list[i];
      f.age += dt;
      const u = f.age / 0.9;
      if (u >= 1) {
        this.drop(f);
        this.list.splice(i, 1);
        continue;
      }
      f.sprite.position.y += dt * 1.6;
      f.sprite.material.opacity = u < 0.6 ? 1 : (1 - u) / 0.4;
    }
  }

  private drop(f: Float): void {
    this.scene.remove(f.sprite);
    f.tex.dispose();
    f.sprite.material.dispose();
  }

  dispose(): void {
    for (const f of this.list) this.drop(f);
    this.list.length = 0;
  }
}
