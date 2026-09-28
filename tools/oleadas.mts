// Mide qué tan difícil es cada oleada, para que la curva suba pareja.
// uso: node --experimental-transform-types tools/oleadas.mts
//
// La cuenta: la **vida efectiva** de cada enemigo (lo que de verdad hay que sacarle, contando lo que sus
// poderes le agregan) dividida por el tiempo que hay para sacársela: lo que dura la aparición de la
// oleada más lo que tarda uno en cruzar el campo. Da «vida por segundo que hay que sacar». Es una
// cuenta a ojo, no una simulación: sirve para comparar oleadas entre sí, no para saber si se gana.
//
// Referencia: un tiro sale cada 1.5 s más o menos y saca entre 2 y 3 de un golpe bueno, algo más con
// filas y áreas. O sea que un buen jugador sostiene unos 2 por segundo.
import { behaviorOf, ENEMIES, spawnOrder, WAVES, type EnemyMods, type EnemyKind } from '../src/core/waves.ts';

/** Segundos que tarda uno de velocidad media en llegar desde el fondo hasta los puestos. */
const TRAVEL = 24;
const RUNS = 400;

/** Lo que de verdad hay que sacarle a uno, con sus poderes. */
function effective(kind: EnemyKind, mods: EnemyMods = {}): number {
  const s = ENEMIES[kind];
  const hp = s.hp + (mods.hp ?? 0);
  if (s.boss) return hp;
  let e = hp;
  const armor = mods.armor ?? s.armor ?? 0;
  // cada golpe pierde `armor`: con golpes de 2 a 3, cada punto de blindaje es como un 40 % más de vida
  e += hp * armor * 0.4;
  const shield = mods.shield ?? s.shield;
  // el escudo se esquiva (de costado, por detrás, con la granada): cuesta tiempo, no tanto como la vida
  if (shield) e += shield >= 10 ? 4 : shield * 0.5;
  if (mods.divine ?? s.divine) e += 2.5;
  if (mods.ethereal ?? s.ethereal) e += hp * 1.2;
  const b = behaviorOf(s, mods);
  if (b === 'kamikaze') e += 1;
  if (b === 'geomancer') e += 3;
  if (b === 'banner') e += 4;
  if (b === 'ranged') e += 3;
  const aura = mods.aura ?? s.aura;
  if (aura === 'ward') e += 5;
  if (aura === 'heal') e += 4;
  if (b === 'grabber') e += 2;
  return e;
}

let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

console.log('ola | título | enemigos | vida | vida efectiva | aparición (s) | por segundo | salto');
let prev = 0;
WAVES.forEach((w, i) => {
  let eff = 0;
  let hp = 0;
  let n = 0;
  for (let r = 0; r < RUNS; r++) {
    const order = spawnOrder(w, rand);
    n = order.length;
    for (const sp of order) {
      eff += effective(sp.kind, sp.mods) / RUNS;
      hp += (ENEMIES[sp.kind].hp + (sp.mods?.hp ?? 0)) / RUNS;
    }
  }
  const t = n * w.interval;
  const rate = eff / (t + TRAVEL);
  const jump = prev ? `${rate >= prev ? '+' : ''}${Math.round((rate / prev - 1) * 100)} %` : '';
  prev = rate;
  console.log(`${String(i + 1).padStart(2)} | ${w.title.padEnd(22)} | ${String(n).padStart(2)} | ${hp.toFixed(0).padStart(3)} | ${eff.toFixed(0).padStart(3)} | ${t.toFixed(0).padStart(3)} | ${rate.toFixed(2)} | ${jump}`);
});
