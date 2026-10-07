// La marca de la dificultad (7/10, pedido de Leandro): una llama con el nivel adentro. Va en el botón de la
// pantalla de entrada, en el menú de dificultad, al lado del título de la oleada y en el cartel del final.
// Cuanto más alto el nivel, más roja, más brillo y más nerviosa; con todos los puntos puestos, infernal.
//
// Acá solo se arma el HTML: los colores y las animaciones están en index.html (`.flame`, `.threat`).

import { L } from './i18n';

/**
 * Una gota de fuego: la punta en (x, tip), la panza redonda de radio `r` centrada en (x, cy), girada
 * `rot` grados alrededor de la panza. La llama son tres capas de gotas encimadas.
 */
function drop(x: number, tip: number, cy: number, r: number, rot = 0): string {
  const k = (cy - tip) * 0.45;
  const d = `M${x} ${tip}C${x + r * 0.2} ${tip + k} ${x + r} ${cy - r * 0.9} ${x + r} ${cy}`
    + `A${r} ${r} 0 0 1 ${x - r} ${cy}C${x - r} ${cy - r * 0.9} ${x - r * 0.2} ${tip + k} ${x} ${tip}Z`;
  return `<path d="${d}"${rot ? ` transform="rotate(${rot} ${x} ${cy})"` : ''}/>`;
}

/** Afuera, el medio y el centro (de 48 × 60): cada capa, más chica y más clara. */
const FLAME_SVG = '<svg viewBox="0 0 48 60" aria-hidden="true">'
  + `<g class="f0">${drop(24, 1, 41, 17)}${drop(24, 13, 43, 13.5, -30)}${drop(24, 16, 43, 13, 31)}</g>`
  + `<g class="f1">${drop(24, 15, 45, 12.5)}${drop(24, 25, 46, 9.5, -30)}${drop(24, 27, 46, 9, 33)}</g>`
  + `<g class="f2">${drop(24, 28, 48, 8.5)}</g>`
  + '</svg>';

/** El tramo de color: t0 ámbar, t1 naranja, t2 rojo, t3 carmesí, y `max` con todos los puntos. */
export function heatTier(level: number, max: number): string {
  if (max > 0 && level >= max) return 'max';
  const t = max > 0 ? level / max : 0;
  return `t${Math.min(3, Math.floor(t * 4))}`;
}

/** Cuántas chispas suben de la llama en cada tramo. */
const SPARKS: Record<string, number> = { t0: 0, t1: 2, t2: 3, t3: 4, max: 7, locked: 0 };

/**
 * La llama con el número adentro. `locked`: la demo, gris y con candado. Las chispas tienen su desvío y
 * su demora fijos, así la misma llama se ve igual cada vez que se vuelve a dibujar.
 */
export function flameHtml(level: number, max: number, locked = false): string {
  const tier = locked ? 'locked' : heatTier(level, max);
  const heat = locked || max <= 0 ? 0 : Math.min(1, level / max);
  const sparks = Array.from({ length: SPARKS[tier] }, (_, i) =>
    `<i class="spark" style="--dx:${((i * 37) % 23) - 11}px;--d:${((i * 0.29) % 1.1).toFixed(2)}s"></i>`).join('');
  // dos cifras no entran en la panza de la llama con la letra de una
  const wide = !locked && level >= 10 ? ' wide' : '';
  return `<span class="flame ${tier}${wide}" style="--heat:${heat.toFixed(2)}">${FLAME_SVG}<b>${locked ? '🔒' : level}</b>${sparks}</span>`;
}

/** Lo que dice el botón de la dificultad. */
export interface ThreatState {
  /** Los puntos puestos: el nivel de la partida. */
  level: number;
  /** Los puntos ganados. */
  points: number;
  /** Todos los que hay (MAX_POINTS). */
  max: number;
  /** La demo: se ve, con candado. */
  locked: boolean;
}

/**
 * El botón de la dificultad (entrada y cartel del final): la llama, el nivel, una rayita por punto
 * (puesta, ganada sin poner, o todavía no ganada) y una línea que dice qué falta.
 */
export function paintThreat(button: HTMLElement, s: ThreatState): void {
  const free = Math.max(0, s.points - s.level);
  const atMax = !s.locked && s.max > 0 && s.level >= s.max;
  const big = s.locked ? L('Versión completa', 'Full game') : atMax ? L('Máxima', 'Maximum') : L(`Nivel ${s.level}`, `Level ${s.level}`);
  const segs = Array.from({ length: s.max }, (_, i) => `<i class="${i < s.level ? 'on' : i < s.points ? 'free' : ''}"></i>`).join('');
  const note = s.locked
    ? L('Cada partida ganada desbloquea un nivel', 'Every win unlocks a level')
    : free > 0
    ? L(`¡${free === 1 ? 'Te queda 1 punto' : `Te quedan ${free} puntos`} para poner!`, `${free} point${free === 1 ? '' : 's'} left to spend!`)
    : atMax
    ? L('Todo puesto. Que los dioses te amparen', 'Everything on. May the gods have mercy')
    : L(`Ganá así y desbloqueás el nivel ${s.points + 1}`, `Win like this to unlock level ${s.points + 1}`);
  button.className = `threat ${s.locked ? 'locked' : heatTier(s.level, s.max)}${free > 0 ? ' due' : ''}`;
  button.innerHTML = `${flameHtml(s.level, s.max, s.locked)}<span class="txt">`
    + `<span class="top">${L('Dificultad', 'Difficulty')}</span><span class="big">${big}</span>`
    + `<span class="segs">${segs}</span><span class="note">${note}</span></span>`;
  button.setAttribute('aria-label', `${L('Dificultad', 'Difficulty')}: ${big}. ${note}`);
}
