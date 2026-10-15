// El gólem de las piedras (14/10): pone a prueba repartir la atención, con varios relojes a la vez. Las
// versiones, para que Leandro elija (ver docs/jefes/golem.md):
// - crece: el gólem hace nacer piedras en su línea que crecen y salen rodando; a la puerta le pegan lo que
//   les queda de vida.
// - fijo: lo mismo, pero cada piedra que llega le saca siempre lo mismo a la puerta.
// - ventana: las piedras, más la piedra grande sobre la cabeza que se corta con un golpe fuerte, y fases.
// - trio: tres gólems que tiran piedras a la puerta; un golpe en la ventana los aturde.
import type { Wave } from '../../../core/waves';
import { L } from '../../../i18n';
import type { BossDef } from '../types';
import { startGolem } from './golem';
import { startTrio } from './trio';

/** Lo que le saca a la puerta cada piedra en la versión del daño fijo. */
const FIXED_GATE = 2;
/**
 * La ventana le gustó a Leandro tal como está (15/10: «el poder es interesante y también está bueno que te
 * avisa que está subiendo de nivel, tipo enrage»): sus piedras siguen siempre juntas y crecen como antes
 * (3.2 s por punto). Solo baja la vida (era 140: le ganó a los 140 s, largo para el rato a solas).
 */
const VENTANA_HP = 110;
const VENTANA_GROW = 3.2;

/**
 * La escolta de siempre, sin el chamán ni los apoyos: el aura del chamán o la del invencible volverían
 * inmunes a las piedras que ruedan cerca de la puerta, y la bandera les daría vida de más.
 */
function escort(wave: Wave): void {
  wave.groups = wave.groups.filter((g) => g.kind !== 'shaman');
  delete wave.supports;
}

const NAME = L('El Gólem de las piedras', 'The Stone Golem');

export const BOSSES: BossDef[] = [
  {
    id: 'golem.crece',
    name: NAME,
    blurb: 'Piedras que nacen en su línea (a veces juntas, a veces separadas), crecen hasta 5 y salen rodando: a la puerta le pegan la vida que les queda.', // i18n-ok: el panel de pruebas
    escort,
    start: (ctx) => startGolem(ctx, { gate: 'hp', big: false, mix: true }),
  },
  {
    id: 'golem.fijo',
    name: NAME,
    blurb: `Como «crece», pero cada piedra que llega le saca ${FIXED_GATE} a la puerta, le quede la vida que le quede.`, // i18n-ok: el panel de pruebas
    escort,
    start: (ctx) => startGolem(ctx, { gate: FIXED_GATE, big: false, mix: true }),
  },
  {
    id: 'golem.ventana',
    name: NAME,
    blurb: 'Las piedras, más una piedra grande sobre la cabeza: un golpe fuerte en la ventana se la tira encima. Fases a 2/3 y 1/3.', // i18n-ok: el panel de pruebas
    escort,
    start: (ctx) => startGolem(ctx, { gate: 'hp', big: true, hp: VENTANA_HP, growStep: VENTANA_GROW }),
  },
  {
    id: 'golem.trio',
    name: L('Los tres gólems', 'The Three Golems'),
    blurb: 'Tres gólems que tiran piedras a la puerta, cada uno a su ritmo: cualquier golpe en la ventana los aturde.', // i18n-ok: el panel de pruebas
    escort,
    start: startTrio,
  },
];
