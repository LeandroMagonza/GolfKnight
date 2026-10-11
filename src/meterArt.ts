// El dibujo del arco de carga (el medidor que aparece al cargar): lo usan el HUD del juego (src/hud.ts) y
// el simulador de la carga (arco.html, src/arco.ts), así lo que se prueba ahí es lo mismo que se ve jugando.

import type { ArcLayout } from './core/swing';

/** Hasta cuántos grados de cada lado de arriba llega el arco (sin `widen`). */
export const ARC_MAX = 105;
/** Lo que mide el medidor en pantalla: 100 unidades del dibujo son estos píxeles. */
export const METER_PX = 78;

/**
 * Los tramos del arco: el golpe 1 en los bordes (verde), el 2 entre medio (amarillo) y el 3 en el
 * centro (rojo). `duff`: con este palo el golpe 1 es pifia (el wedge), y el arco cambia: el golpe 1 en
 * gris con un triángulo de peligro, el 2 en verde y el 3 en amarillo. `damage`: lo que pega cada nivel
 * con el palo y la distancia de ahora; va escrito en su tramo.
 *
 * `fourth`: con el golpe 4 (ver FOURTH en core/clubs), qué parte del fuerte es el 4. El rojo se parte:
 * el 4 en el medio, en rojo, y el 3 a los costados, en naranja (con la pifia, todo un color más abajo).
 * El número de arriba es el del 4; el del 3 va solo si su tramo es ancho como para que se lea.
 *
 * `widen`: el arco abierto más de medio círculo (ver `fourthArc` en core/swing), cuánto más que 90° de
 * cada lado. Pasa por debajo del centro: el recuadro crece para abajo y el centro queda donde estaba.
 * `crown`: el 3 y el 4 en corona (ver `fourthArc`). `border`: el ancho del borde oscuro de cada tramo.
 *
 * Devuelve el SVG (con la aguja, de clase `needle`, apuntando arriba), hasta dónde llega el arco de cada
 * lado (`edge`, en grados) y lo que baja por debajo del centro (`below`, en unidades del dibujo).
 */
export function meterArt(layout: ArcLayout, opts: { duff?: boolean; damage?: readonly (number | string)[]; fourth?: number; widen?: number; crown?: boolean; border?: number } = {}): { svg: string; edge: number; below: number } {
  const { duff = false, damage = [], fourth = 0, widen = 1, crown = false } = opts;
  const R = 66;
  const r = 44;
  const at = (rad: number, a: number) => `${(rad * Math.sin((a * Math.PI) / 180)).toFixed(2)} ${(-rad * Math.cos((a * Math.PI) / 180)).toFixed(2)}`;
  // pasando de media vuelta, el arco de SVG va por el lado largo
  const big = (a1: number, a2: number) => (a2 - a1 > 180 ? 1 : 0);
  const stroke = opts.border === undefined ? '' : ` style="stroke-width:${opts.border}"`;
  const band = (a1: number, a2: number, color: string, outer: number, inner: number, cls: string) =>
    `<path class="${cls}" fill="${color}"${cls === 'zone' ? stroke : ''} d="M ${at(outer, a1)} A ${outer} ${outer} 0 ${big(a1, a2)} 1 ${at(outer, a2)} L ${at(inner, a2)} A ${inner} ${inner} 0 ${big(a1, a2)} 0 ${at(inner, a1)} Z" />`;
  const sector = (a1: number, a2: number, color: string) => band(a1, a2, color, R, r, 'zone');
  // de dónde a dónde va cada tramo, en grados desde arriba: cada uno ocupa lo que dura (ver `arcLayout`)
  const edge = Math.min(ARC_MAX * widen, layout.span);
  const g = Math.min(edge, layout.mid + layout.strong);
  const y = Math.min(g, layout.strong);
  // con el golpe 4, dónde termina el 3 y empieza el 4 (desde arriba)
  const f = fourth > 0 ? Math.min(y, layout.strong * fourth) : 0;
  const low = duff ? '#4d535c' : '#5be07a';
  const mid = duff ? '#5be07a' : '#ffd66b';
  const top = duff ? (f ? '#ff9a2e' : '#ffd21f') : '#ff2d3c';
  const third = duff ? '#ffd21f' : '#ff9a2e';
  // el triángulo de peligro, en el medio de cada tramo de la pifia
  const warn = (a: number) => {
    const [x, yy] = at((R + r) / 2, a).split(' ').map(Number);
    return `<g transform="translate(${x.toFixed(2)} ${yy.toFixed(2)})"><path d="M 0 -8 L 8.5 6.5 L -8.5 6.5 Z" fill="#ffb020" stroke="#1a1204" stroke-width="1.6" stroke-linejoin="round" />`
      + `<rect x="-1.1" y="-3.6" width="2.2" height="5.6" rx="1" fill="#1a1204" /><circle cy="4.1" r="1.2" fill="#1a1204" /></g>`;
  };
  // el daño de cada nivel, en el medio de su tramo (en los dos lados); en el rojo va en blanco
  const label = (a: number, n: number | string | undefined, fill: string) => {
    if (n === undefined) return '';
    const [x, yy] = at((R + r) / 2, a).split(' ').map(Number);
    return `<text x="${x.toFixed(2)}" y="${yy.toFixed(2)}" text-anchor="middle" dominant-baseline="central" font-size="14" font-weight="800" fill="${fill}">${n}</text>`;
  };
  const dark = '#10151c';
  // el fuerte suele ser angosto: su número va encima del tramo aunque sobresalga a los costados, con
  // borde oscuro para que se lea sobre los tramos de al lado
  const topN = f ? damage[3] : damage[2];
  // la corona (ver fourthArc): el 3 y el 4 sin borde, más altos que el arco, y una rayita en cada borde
  const crowned = crown && f > 0 && !duff;
  const topLabel = () => {
    if (topN === undefined) return '';
    if (duff && !f) return label(0, topN, dark);
    // con la corona, el número va adentro del arco: encima tapaba el 4 y el 3
    return `<text x="0" y="${crowned ? -(r - 9) : -(R + r) / 2}" text-anchor="middle" dominant-baseline="central" font-size="14" font-weight="800" fill="#ffffff" stroke="#0b0f14" stroke-width="3" paint-order="stroke">${topN}</text>`;
  };
  // el 3 con el golpe 4: solo si su tramo da para un número sin pisar los de al lado
  const thirdLabel = f && y - f >= 9 ? label(-(y + f) / 2, damage[2], dark) + label((y + f) / 2, damage[2], dark) : '';
  const numbers = (duff ? '' : label(-(edge + g) / 2, damage[0], dark) + label((edge + g) / 2, damage[0], dark))
    + label(-(g + y) / 2, damage[1], dark) + label((g + y) / 2, damage[1], dark)
    + thirdLabel + topLabel();
  // un fondo oscuro un poco más grande, como tenía la barra: sobre el pasto el verde se perdía
  const b = edge + 2;
  const back = `<path fill="rgba(0,0,0,0.6)" d="M ${at(R + 4, -b)} A ${R + 4} ${R + 4} 0 ${big(-b, b)} 1 ${at(R + 4, b)} L ${at(r - 4, b)} A ${r - 4} ${r - 4} 0 ${big(-b, b)} 0 ${at(r - 4, -b)} Z" />`;
  // lo de abajo del centro: el punto de la aguja, o el arco si pasa de 90°
  const below = Math.max(14, Math.ceil(-(R + 4) * Math.cos((b * Math.PI) / 180)) + 6);
  const strong = crowned
    ? band(-y, -f, third, R + 8, r, 'crown') + band(-f, f, top, R + 12, r, 'crown') + band(f, y, third, R + 8, r, 'crown')
      + [-y, -f, f, y].map((a) => { const [x1, y1] = at(r - 3, a).split(' '); const [x2, y2] = at(R + 14, a).split(' '); return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#ffffff" stroke-width="0.9" />`; }).join('')
    : f ? sector(-y, -f, third) + sector(-f, f, top) + sector(f, y, third) : sector(-y, y, top);
  const svg = `<svg viewBox="-72 -86 144 ${86 + below}">` + back
    + sector(-edge, -g, low) + sector(-g, -y, mid)
    + sector(y, g, mid) + sector(g, edge, low)
    + strong
    + (duff ? warn(-(edge + g) / 2) + warn((edge + g) / 2) : '') + numbers
    + `<g class="needle"><line x1="0" y1="-30" x2="0" y2="-72" stroke="#0b0f14" stroke-width="6" stroke-linecap="round" />`
    + `<line x1="0" y1="-30" x2="0" y2="-72" stroke="#ffffff" stroke-width="3" stroke-linecap="round" /></g>`
    + `<circle r="5" fill="#ffffff" stroke="#0b0f14" stroke-width="2" /></svg>`;
  return { svg, edge, below };
}
