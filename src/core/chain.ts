// La cadena del rayo, como cuenta pura (sin Three.js), para poder probarla.
//
// Cada enemigo al que le pega la pelota de rayo larga **su propio rayo**. Ese rayo sale para los dos
// lados: una rama al más cercano, y otra al más cercano del lado contrario. Cada rama sigue saltando al
// más cercano que todavía no tocó, `jumps` veces. Un rayo nunca le pega dos veces al mismo ni vuelve al
// que lo largó, pero el rayo de otro enemigo sí le puede pegar: con dos en fila, la pelota le pega a los
// dos y el rayo de cada uno le pega al otro.
//
// Ejemplos (pedidos de Leandro, 1/10): con tres marchando uno al lado del otro y la pelota en el de la
// punta, el rayo va al del medio y de ahí al otro. Con cinco y la pelota en el del medio, sale una rama
// para cada lado y cada una salta dos veces: la pelota le pega al del medio y el rayo a los otros cuatro.

export interface ChainPoint {
  id: number;
  x: number;
  z: number;
}

export interface ChainJump<P extends ChainPoint = ChainPoint> {
  from: P;
  to: P;
}

/**
 * Los saltos del rayo que larga `origin`, en el orden en que pasan: un salto de cada rama por vuelta.
 * `others` son los que se pueden tocar (vivos y en juego); `range`, hasta dónde llega cada salto. Los
 * saltos devuelven los mismos objetos que se pasaron, así quien llama recupera lo suyo.
 */
export function chainJumps<P extends ChainPoint>(origin: P, others: readonly P[], jumps: number, range: number): ChainJump<P>[] {
  const seen = new Set([origin.id]);
  const nearest = (at: P, ok: (p: P) => boolean = () => true): P | null => {
    let best: P | null = null;
    let bestD = range;
    for (const p of others) {
      if (seen.has(p.id) || !ok(p)) continue;
      const d = Math.hypot(p.x - at.x, p.z - at.z);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  };
  const first = nearest(origin);
  if (!first || jumps <= 0) return [];
  seen.add(first.id);
  // la otra rama, hacia el lado contrario de la primera
  const dx = first.x - origin.x;
  const dz = first.z - origin.z;
  const second = nearest(origin, (p) => (p.x - origin.x) * dx + (p.z - origin.z) * dz < 0);
  if (second) seen.add(second.id);
  const branches = [first, second].filter((p): p is P => p !== null).map((head) => ({ at: origin, head, done: false }));
  const out: ChainJump<P>[] = [];
  for (let j = 0; j < jumps; j++) {
    for (const b of branches) {
      if (b.done) continue;
      const to = j === 0 ? b.head : nearest(b.at);
      if (!to) {
        b.done = true;
        continue;
      }
      seen.add(to.id);
      out.push({ from: b.at, to });
      b.at = to;
    }
  }
  return out;
}
