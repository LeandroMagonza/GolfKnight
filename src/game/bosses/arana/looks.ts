// Lo que la araña reina arma por código (14/10): los huevos, las telarañas (en el piso, o paradas como
// una puerta), el ovillo que escupe y el capullo que agarra al golfista. Facetado y de material plano,
// como el pack (ver kit.ts). Las partes que son enemigos (huevo, telaraña) van con MeshStandardMaterial:
// el enemigo les toca el brillo (`emissive`) en cada cuadro.
import * as THREE from 'three';
import { facet, flatMat } from '../kit';

/** Ancho de los hilos (m): más finos no se ven desde la cámara alta. */
const THREAD = 0.06;
/** El color de la seda. */
export const SILK = 0xf3f0ff;

/** Una tira finita de a a b en el plano XY, de ancho w: dos triángulos, siempre en el mismo sentido. */
function strip(out: number[], ax: number, ay: number, bx: number, by: number, w: number): void {
  const len = Math.hypot(bx - ax, by - ay) || 1;
  const nx = (-(by - ay) / len) * w * 0.5;
  const ny = ((bx - ax) / len) * w * 0.5;
  out.push(ax + nx, ay + ny, 0, ax - nx, ay - ny, 0, bx + nx, by + ny, 0, bx + nx, by + ny, 0, ax - nx, ay - ny, 0, bx - nx, by - ny, 0);
}

/**
 * El dibujo de una telaraña en el plano XY, de radio r: rayos y vueltas que se comban un poco hacia el
 * centro. Con tiras y no con líneas: las líneas de WebGL miden un píxel.
 */
export function webGeometry(r: number, spokes = 8, turns = 4, w = THREAD, seed = 1): THREE.BufferGeometry {
  let s = seed * 7919 + 13;
  const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  const out: number[] = [];
  const ang = Array.from({ length: spokes }, (_, i) => (i / spokes) * Math.PI * 2 + (rnd() - 0.5) * 0.3);
  const len = ang.map(() => r * (0.86 + 0.14 * rnd()));
  for (let i = 0; i < spokes; i++) strip(out, 0, 0, Math.cos(ang[i]) * len[i], Math.sin(ang[i]) * len[i], w);
  for (let t = 1; t <= turns; t++) {
    const f = t / (turns + 0.35);
    for (let i = 0; i < spokes; i++) {
      const j = (i + 1) % spokes;
      const ax = Math.cos(ang[i]) * len[i] * f;
      const ay = Math.sin(ang[i]) * len[i] * f;
      const bx = Math.cos(ang[j]) * len[j] * f;
      const by = Math.sin(ang[j]) * len[j] * f;
      const mx = ((ax + bx) / 2) * 0.88;
      const my = ((ay + by) / 2) * 0.88;
      strip(out, ax, ay, mx, my, w * 0.8);
      strip(out, mx, my, bx, by, w * 0.8);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  // planas, todas para el mismo lado (con DoubleSide se dan vuelta solas del otro)
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(out.map((_, i) => (i % 3 === 2 ? 1 : 0)), 3));
  return geo;
}

/** Un palo invisible de alto `h`: para que la parte mida eso para las pelotas sin cambiar cómo se ve. */
function reach(h: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, h, 0.05), flatMat(0xffffff));
  m.position.y = h / 2;
  m.visible = false;
  return m;
}

/** El huevo, sobre un colchoncito de seda: 1.1 m de alto. La cáscara se llama `shell` (para el brillo). */
export function eggLook(seed = 1): THREE.Object3D {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(facet(new THREE.IcosahedronGeometry(0.5, 1), 0.07, seed + 3), flatMat(0xe9dcbc));
  shell.name = 'shell';
  shell.scale.set(0.82, 1.1, 0.82);
  shell.position.y = 0.55;
  shell.castShadow = true;
  g.add(shell);
  // manchas verdosas: que se lea como huevo de bicho, no como piedra
  const spotMat = flatMat(0x7a8a4c);
  for (let i = 0; i < 6; i++) {
    const a = i * 2.39 + seed;
    const lat = -0.3 + (i % 3) * 0.32;
    const dot = new THREE.Mesh(new THREE.IcosahedronGeometry(0.085, 0), spotMat);
    dot.position.set(Math.cos(a) * Math.cos(lat) * 0.4, 0.55 + Math.sin(lat) * 0.54, Math.sin(a) * Math.cos(lat) * 0.4);
    dot.scale.set(1, 0.6, 1);
    g.add(dot);
  }
  const nest = new THREE.Mesh(webGeometry(0.8, 7, 2, 0.05, seed), flatMat(SILK, { side: THREE.DoubleSide }));
  nest.rotation.x = -Math.PI / 2;
  nest.position.y = 0.04;
  g.add(nest);
  return g;
}

/**
 * La trampa pegajosa: una telaraña tendida en el piso del puesto, con un bollo de seda en el medio. Mide
 * 1.2 m para las pelotas (el driver de cerca le pega), aunque se vea chata.
 */
export function trapLook(): THREE.Object3D {
  const g = new THREE.Group();
  const mat = flatMat(SILK, { side: THREE.DoubleSide });
  const web = new THREE.Mesh(webGeometry(1.45, 9, 4, THREAD, 2), mat);
  web.rotation.x = -Math.PI / 2;
  web.position.y = 0.05;
  const lump = new THREE.Mesh(facet(new THREE.IcosahedronGeometry(0.42, 1), 0.15, 5), mat);
  lump.scale.set(1, 0.55, 1);
  lump.position.y = 0.12;
  g.add(web, lump, reach(1.2));
  return g;
}

/**
 * La pared: una telaraña parada en el puesto, de frente a la cámara, atada al piso por dos hilos. No se
 * cruza (ver `BossFight.blocks`). 2.7 m de alto.
 */
export function wallLook(): THREE.Object3D {
  const g = new THREE.Group();
  const mat = flatMat(SILK, { side: THREE.DoubleSide });
  const web = new THREE.Mesh(webGeometry(1.35, 10, 5, 0.07, 3), mat);
  web.position.y = 1.35;
  const anchors: number[] = [];
  strip(anchors, -1.1, 0.55, -1.7, 0, 0.07);
  strip(anchors, 1.1, 0.55, 1.7, 0, 0.07);
  strip(anchors, -0.9, 2.3, -1.3, 2.7, 0.06);
  strip(anchors, 0.9, 2.3, 1.3, 2.7, 0.06);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(anchors, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(anchors.map((_, i) => (i % 3 === 2 ? 1 : 0)), 3));
  g.add(web, new THREE.Mesh(geo, mat));
  // un poco de seda en el piso: que se vea que el puesto está tomado
  const floor = new THREE.Mesh(webGeometry(1.2, 7, 2, 0.05, 4), mat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.04;
  g.add(floor);
  return g;
}

/** El ovillo que escupe la reina (no es un enemigo: no se le pega). */
export function silkBall(): THREE.Mesh {
  const m = new THREE.Mesh(facet(new THREE.IcosahedronGeometry(0.34, 1), 0.12, 7), new THREE.MeshBasicMaterial({ color: SILK }));
  m.castShadow = true;
  return m;
}

/** El hilo que sale de la boca detrás del ovillo: un tubo finito de largo 1 en +z (se estira con la escala). */
export function threadMesh(): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(0.045, 0.045, 1, 5, 1, true);
  geo.rotateX(Math.PI / 2);
  geo.translate(0, 0, 0.5);
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: SILK, transparent: true, opacity: 0.8, depthWrite: false }));
}

/** El capullo que agarra al golfista: hilos cruzados alrededor de las piernas y una telaraña bajo los pies. */
export function cocoonLook(): THREE.Object3D {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: SILK, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
  const strand = new THREE.BoxGeometry(0.06, 1.5, 0.06);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const s = new THREE.Mesh(strand, mat);
    s.position.set(Math.cos(a) * 0.5, 0.7, Math.sin(a) * 0.5);
    // cruzados, para un lado y para el otro
    s.rotation.set(Math.sin(a) * 0.45 * (i % 2 ? 1 : -1), 0, Math.cos(a) * 0.45 * (i % 2 ? -1 : 1));
    g.add(s);
  }
  for (const y of [0.35, 0.75, 1.1]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.52 - y * 0.08, 0.035, 4, 14), mat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    g.add(ring);
  }
  const floor = new THREE.Mesh(webGeometry(1.25, 8, 3, THREAD, 6), mat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.05;
  g.add(floor);
  return g;
}

/** Libera las geometrías y materiales de un objeto hecho acá que no está en la escena. */
export function disposeLook(o: THREE.Object3D): void {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (!m.isMesh) return;
    m.geometry?.dispose();
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) mat?.dispose();
  });
}
