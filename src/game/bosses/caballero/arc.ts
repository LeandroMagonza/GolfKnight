// El arco de carga del Caballero negro, arriba de su cabeza: el mismo dibujo que el tuyo (src/meterArt.ts:
// verde, amarillo y rojo, con lo que le saca a la puerta escrito en cada tramo) y la aguja que sube por
// la izquierda, pasa por arriba y baja por la derecha, como un péndulo. Es lo que hay que leerle.
//
// Va en la página (como el tuyo), no en el mundo: a 30 m un arco del mundo medía 40 píxeles y no se leía.
// Así tiene siempre el mismo tamaño. Para ponerlo sobre su cabeza hace falta la cámara, que el jefe no
// tiene: la agarra un sprite invisible en `onBeforeRender`, que además lo deja justo en el cuadro que se
// dibuja.
import * as THREE from 'three';
import { arcAngle, arcLayout, type ArcLayout, type ChargeTimes } from '../../../core/swing';
import { meterArt } from '../../../meterArt';

/** Ancho del arco en pantalla, en píxeles (el tuyo, 112). */
export const ARC_PX = 96;
/** El dibujo de meterArt: 144 unidades de ancho, el centro a 86 del borde de arriba. */
const ART_W = 144;
const ART_TOP = 86;
/**
 * Arriba de todo está la barra del juego (la oleada, la vida): el campo empieza debajo, pero el arco no
 * puede tapar lo de más arriba del campo, así que el centro se queda por lo menos a esto del borde.
 */
const TOP_MARGIN = 6;

const CSS = `.gk-rival{position:fixed;left:0;top:0;pointer-events:none;z-index:5;opacity:0;transition:opacity .12s;
filter:drop-shadow(0 0 3px rgba(164,92,255,.9))}
.gk-rival.on{opacity:1}
.gk-rival svg{width:100%;height:100%;overflow:visible;display:block}
.gk-rival .zone{stroke:rgba(0,0,0,.75);stroke-width:1.5}
.gk-rival .art{width:100%;height:100%}
.gk-rival.s1{filter:drop-shadow(0 0 4px rgba(255,150,60,.95))}
.gk-rival.s2{filter:drop-shadow(0 0 5px rgba(255,90,40,1))}
.gk-rival.s3{filter:drop-shadow(0 0 6px rgba(255,40,40,1)) drop-shadow(0 0 2px rgba(255,40,40,1))}
.gk-rival.hot{filter:drop-shadow(0 0 7px rgba(255,80,120,1))}
.gk-rival .speed{position:absolute;left:100%;top:30%;margin-left:2px;font:900 20px/1 system-ui,sans-serif;letter-spacing:-3px;
color:#ffb04a;text-shadow:0 0 4px #000,0 0 2px #000;white-space:nowrap}
.gk-rival.s2 .speed{color:#ff7a30}
.gk-rival.s3 .speed{color:#ff4040}
.gk-rival .faster{position:absolute;left:50%;top:-4px;transform:translate(-50%,-100%);font:800 14px/1 system-ui,sans-serif;
color:#ffd36b;text-shadow:0 0 4px #000,0 0 2px #000;white-space:nowrap;opacity:0}
.gk-rival .faster.go{animation:gk-rival-faster 1.8s ease-out}
@keyframes gk-rival-faster{0%{opacity:0;transform:translate(-50%,-60%) scale(.7)}12%{opacity:1;transform:translate(-50%,-100%) scale(1.15)}
75%{opacity:1;transform:translate(-50%,-110%) scale(1)}100%{opacity:0;transform:translate(-50%,-130%) scale(1)}}`;

export class RivalArc {
  private readonly el = document.createElement('div');
  private needle: SVGGElement | null = null;
  private layout: ArcLayout = { weak: 60, mid: 22, strong: 8, span: 90 };
  private edge = 90;
  private key = '';
  private height = ARC_PX;
  /** El que agarra la cámara: invisible, pero se dibuja (si no, no lo llama). */
  private readonly probe: THREE.Sprite;
  /** El punto del mundo donde va el centro del arco (lo pone el jefe en cada cuadro). */
  readonly anchor = new THREE.Vector3();
  private readonly v = new THREE.Vector3();
  private shown = false;
  /** El dibujo del arco, las flechas de la velocidad al costado y el aviso de «más rápido» arriba. */
  private readonly art = document.createElement('div');
  private readonly speed = document.createElement('div');
  private readonly faster = document.createElement('div');
  private tier = 0;

  constructor(private readonly scene: THREE.Scene, private readonly marks: readonly [number, number]) {
    if (!document.getElementById('gk-rival-css')) {
      const style = document.createElement('style');
      style.id = 'gk-rival-css';
      style.textContent = CSS;
      document.head.append(style);
    }
    this.el.className = 'gk-rival';
    this.art.className = 'art';
    this.speed.className = 'speed';
    this.faster.className = 'faster';
    this.el.append(this.art, this.speed, this.faster);
    document.body.append(this.el);
    this.probe = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, opacity: 0, depthTest: false, depthWrite: false }));
    this.probe.frustumCulled = false;
    this.probe.scale.setScalar(0.001);
    this.probe.onBeforeRender = (renderer, _scene, camera) => this.place(renderer, camera);
    scene.add(this.probe);
  }

  /** Los tiempos de su barra (cambian con las fases): el arco reparte cada tramo según lo que dura. */
  setTimes(times: ChargeTimes): void {
    const layout = arcLayout(times, times);
    const key = `${layout.weak.toFixed(1)}/${layout.mid.toFixed(1)}/${layout.strong.toFixed(1)}`;
    if (key === this.key) return;
    this.key = key;
    this.layout = layout;
    const art = meterArt(layout, { damage: [1, 2, 3] });
    this.edge = art.edge;
    this.height = (ARC_PX * (ART_TOP + art.below)) / ART_W;
    this.el.style.width = `${ARC_PX}px`;
    this.el.style.height = `${this.height.toFixed(0)}px`;
    this.art.innerHTML = art.svg;
    this.needle = this.art.querySelector('.needle');
  }

  /**
   * Lo rápida que va su barra (15/10: Leandro no se daba cuenta de que se apuraba): de 0 (la de arriba)
   * a 3. Se ve en las flechas al costado del arco (», »», »»») y en el color del brillo (violeta, naranja,
   * rojo). Al subir, con `text`, el aviso arriba del arco.
   */
  setSpeed(tier: number, text = ''): void {
    if (tier === this.tier) return;
    const up = tier > this.tier;
    this.el.classList.remove(`s${this.tier}`);
    this.tier = tier;
    if (tier > 0) this.el.classList.add(`s${tier}`);
    this.speed.textContent = '»'.repeat(tier); // i18n-ok: flechas, no texto
    if (up && text) {
      this.faster.textContent = text;
      this.faster.classList.remove('go');
      void this.faster.offsetWidth;
      this.faster.classList.add('go');
    }
  }

  show(on: boolean): void {
    if (on === this.shown) return;
    this.shown = on;
    this.el.classList.toggle('on', on);
  }

  /** La aguja: la potencia de su barra y de qué lado va (ver SwingMeter.side). `hot`: está en el rojo. */
  set(power: number, side: number, hot: boolean): void {
    const angle = side * Math.max(0, this.edge - arcAngle(power, this.marks, this.layout));
    this.needle?.setAttribute('transform', `rotate(${angle.toFixed(1)})`);
    this.el.classList.toggle('hot', hot);
  }

  /** En pantalla, el centro del arco sobre `anchor`; sin taparse con la barra de arriba. */
  private place(renderer: THREE.WebGLRenderer, camera: THREE.Camera): void {
    if (!this.shown) return;
    const rect = renderer.domElement.getBoundingClientRect();
    this.v.copy(this.anchor).project(camera);
    if (this.v.z > 1) return;
    const x = rect.left + ((this.v.x + 1) / 2) * rect.width;
    const above = (ARC_PX * ART_TOP) / ART_W;
    const y = Math.max(rect.top + above + TOP_MARGIN, rect.top + ((1 - this.v.y) / 2) * rect.height);
    this.el.style.transform = `translate(${(x - ARC_PX / 2).toFixed(1)}px, ${(y - above).toFixed(1)}px)`;
  }

  dispose(): void {
    this.el.remove();
    this.scene.remove(this.probe);
    this.probe.material.dispose();
  }
}
