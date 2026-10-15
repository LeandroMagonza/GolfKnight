// Los jefes de ritmo (14/10, idea de Leandro): ponen a prueba la ráfaga contra la presión constante. Ver
// docs/jefes/ritmo.md.
//   coraza  el Caballero de hierro: el blindaje baja solo y sube de golpe cuando le pegás (ráfaga).
//   pulso   el Chamán eterno: si pasan 3 s sin pegarle, se cura (cadencia).
// Cada uno con y sin ayudar a la escolta, variantes de cómo «sube de golpe», los dos juntos (la pareja) y
// los dos ritmos en un solo cuerpo (el doble).
import { L } from '../../../i18n';
import type { EnemyKind, Wave } from '../../../core/waves';
import type { BossCtx, BossDef, BossFight } from '../types';
import { Coraza, type CorazaMode, type CorazaOpts } from './coraza';
import { Cuerpo, type CuerpoOpts, ENTRY_Z, STATIONS } from './cuerpo';
import { Rings, Volley } from './piezas';
import { Pulso, type PulsoOpts } from './pulso';

/**
 * Los cuerpos: un caballero esqueleto bien armado, el chamán, y para el que tiene los dos ritmos la
 * caballera de PolygonDungeon (una paladina: blindaje y cura; el jefe goblin ya es el Rey goblin).
 */
const KNIGHT = { kind: 'knight', height: 4.2, radius: 1.5, speed: 2.6 } as const;
const SHAMAN = { kind: 'shaman', height: 3.6, radius: 1.25, speed: 2.4, behavior: 'shaman' } as const;
const PALADIN = { kind: 'knight', mesh: 'Character_Hero_Knight_Female', height: 4.0, radius: 1.4, speed: 2.4 } as const;

/** La vida de cada versión; se le suma `HP_PER_LEVEL` por nivel de dificultad y la del talento. */
const HP = { mecha: 56, tope: 40, suma: 50, pulso: 64, parejaCaballero: 40, parejaChaman: 30, doble: 60 };
const HP_PER_LEVEL = 2;

/**
 * La escolta larga (la del caballero): más espaciada y con algunos más, para que dure lo que dura la pelea
 * y entre ventana y ventana haya a quién pegarle.
 */
const LONG_ESCORT = { interval: 2.6, more: [['goblin', 4], ['goblina', 3], ['orc', 2], ['skeleton', 1]] as [EnemyKind, number][] };

function longEscort(w: Wave): void {
  w.interval = LONG_ESCORT.interval;
  for (const [kind, count] of LONG_ESCORT.more) w.groups.push({ kind, count });
}

const hpFor = (ctx: BossCtx, base: number) => base + ctx.bonusHp + Math.round(ctx.level * HP_PER_LEVEL);

/** Entra por el fondo y va a su primer lugar, en la banda lejana (del lado `side`, si se pide). */
function spawn(ctx: BossCtx, look: Omit<CuerpoOpts, 'name' | 'hp'>, name: string, hp: number, side = 0): Cuerpo {
  const x = side ? side * (4 + ctx.rng() * 5) : (ctx.rng() * 2 - 1) * 7;
  const z = STATIONS.far[1] - ctx.rng() * 4;
  return new Cuerpo(ctx, { ...look, name, hp }, x, ENTRY_Z, { x, z });
}

/** Una parte del jefe: el cuerpo y sus ritmos. */
interface Parte {
  body: Cuerpo;
  coraza?: Coraza;
  pulso?: Pulso;
  /** Para el registro, cuando son dos (sus números van con esto adelante). */
  key: string;
}

/** Para el bot: el blindado cerrado no vale nada (pegarle lo cierra o rebota); el resto, lo que diga su ritmo. */
function weightOf(p: Parte): number {
  const c = p.coraza?.weight() ?? 1;
  if (c <= 0) return 0;
  const u = p.pulso?.weight() ?? 1;
  return p.coraza && p.pulso ? (c * u) / 2 : c * u;
}

/**
 * La pelea: los ritmos de cada parte, lo que vuela y lo que le sirve al bot. Sin la barra grande de arriba:
 * cada cuerpo lleva su vida sobre la cabeza, y la barra tapaba justo la media cancha, donde se planta (y el
 * número de su ritmo).
 */
function fight(ctx: BossCtx, parts: Parte[], volley: Volley, rings: Rings, rule: [string, string]): BossFight {
  let told = false;
  for (const p of parts) p.body.onArrive(() => {
    if (told) return;
    told = true;
    ctx.banner(rule[0], rule[1], 4);
  });
  return {
    get done() {
      return parts.every((p) => !p.body.alive);
    },
    update(dt) {
      volley.update(dt);
      rings.update(dt);
      for (const p of parts) {
        p.coraza?.update(dt);
        p.pulso?.update(dt);
      }
    },
    bot: {
      danger: (x, within) => volley.danger(x, within),
      weight(e) {
        const p = parts.find((q) => q.body.e === e);
        return p ? weightOf(p) : 1;
      },
    },
    log() {
      const out: Record<string, number | string> = { vida: parts.reduce((n, p) => n + Math.max(0, p.body.e.hp), 0), seg: Math.round(ctx.clock()) };
      for (const p of parts) {
        const pre = parts.length > 1 ? `${p.key}.` : '';
        for (const [k, v] of Object.entries({ ...p.coraza?.log, ...p.pulso?.log })) out[pre + k] = Math.round(v * 10) / 10;
      }
      return out;
    },
    dispose() {
      volley.dispose();
      rings.dispose();
      for (const p of parts) {
        p.coraza?.dispose();
        p.pulso?.dispose();
      }
    },
  };
}

const KNIGHT_NAME = L('Caballero de hierro', 'Iron Knight');
const SHAMAN_NAME = L('Chamán eterno', 'Undying Shaman');

/** El cartel de la regla, cuando llega a su lugar. */
const RULES: Record<CorazaMode | 'pulso' | 'pulsoEscolta' | 'pareja' | 'doble', [string, string]> = {
  mecha: [L('¡Esperá que se abra!', 'Wait for it to open!'), L('El blindaje baja solo. En 0, descargale todo antes de que se cierre', 'Its armor drops by itself. At 0, unload everything before it closes')],
  tope: [L('¡Esperá que se abra!', 'Wait for it to open!'), L('En 0, el primer golpe lo cierra: que sea el más fuerte', 'At 0, the first hit closes it: make it your strongest')],
  suma: [L('¡Esperá que se abra!', 'Wait for it to open!'), L('Cada golpe le sube 2 el blindaje: pegale en 0, y fuerte', 'Each hit raises its armor by 2: hit it at 0, and hard')],
  pulso: [L('¡No lo dejes respirar!', "Don't let it breathe!"), L('Si pasan 3 segundos sin pegarle, se cura', 'If 3 seconds pass without a hit, it heals')],
  pulsoEscolta: [L('¡No lo dejes respirar!', "Don't let it breathe!"), L('Si pasan 3 segundos sin pegarle, se cura él y cura a los de al lado', 'If 3 seconds pass without a hit, it heals itself and those around it')],
  pareja: [L('Uno seguido, el otro de golpe', 'One steadily, the other all at once'), L('Al chamán pegale seguido; al caballero, cuando se abre', 'Keep hitting the shaman; hit the knight when it opens')],
  doble: [L('¡Tocalo seguido, descargale en 0!', 'Keep tagging it, unload at 0!'), L('Aunque rebote, cada toque le corta la cura', 'Even if it bounces, every touch stops the healing')],
};

function corazaBoss(id: string, blurb: string, o: CorazaOpts, hp: number): BossDef {
  return {
    id, name: KNIGHT_NAME, blurb, escort: longEscort,
    start(ctx) {
      const volley = new Volley(ctx.scene);
      const rings = new Rings(ctx.scene);
      const body = spawn(ctx, KNIGHT, KNIGHT_NAME, hpFor(ctx, hp));
      const coraza = new Coraza(ctx, body, o, volley, rings);
      return fight(ctx, [{ body, coraza, key: 'caballero' }], volley, rings, RULES[o.mode]);
    },
  };
}

function pulsoBoss(id: string, blurb: string, o: PulsoOpts, rule: [string, string]): BossDef {
  return {
    id, name: SHAMAN_NAME, blurb,
    start(ctx) {
      const volley = new Volley(ctx.scene);
      const rings = new Rings(ctx.scene);
      const body = spawn(ctx, SHAMAN, SHAMAN_NAME, hpFor(ctx, HP.pulso));
      const pulso = new Pulso(ctx, body, o, volley, rings);
      return fight(ctx, [{ body, pulso, key: 'chaman' }], volley, rings, rule);
    },
  };
}

export const BOSSES: BossDef[] = [
  corazaBoss('ritmo.coraza', 'Ráfaga. Blindaje 5 que baja solo; en 0, el primer golpe prende una mecha de 2 s (todo entra) y se cierra al tope. Ventana perdida: lanza a la puerta.', { mode: 'mecha', punish: 'lanza' }, HP.mecha), // i18n-ok: el panel de pruebas
  corazaBoss('ritmo.coraza-escolta', 'Como la coraza, pero si se le pasa la ventana reparte su blindaje: +1 a los de la escolta que tiene cerca (hasta 2).', { mode: 'mecha', punish: 'placas' }, HP.mecha), // i18n-ok: el panel de pruebas
  corazaBoss('ritmo.tope', 'De a ratos. El primer golpe en 0 lo cierra al tope en el acto: un golpe por ventana, que sea el más fuerte. Baja más rápido (3.5 s).', { mode: 'tope', punish: 'lanza' }, HP.tope), // i18n-ok: el panel de pruebas
  corazaBoss('ritmo.suma', 'Cada golpe que entra le suma 2 de blindaje (sin mecha): pegarle en 0 y con golpes grandes. Ventana perdida: lanza.', { mode: 'suma', punish: 'lanza' }, HP.suma), // i18n-ok: el panel de pruebas
  pulsoBoss('ritmo.pulso', 'Cadencia. Si pasan 3.4 s sin pegarle se cura (+2 por segundo) y te tira hechizos al puesto; llama goblins cada 15 s.', { reset: 'golpe', escort: false, summons: true }, RULES.pulso), // i18n-ok: el panel de pruebas
  pulsoBoss('ritmo.pulso-escolta', 'Como el pulso, pero mientras se cura también cura a la escolta que tiene cerca, con hasta 2 de vida de más.', { reset: 'golpe', escort: true, summons: true }, RULES.pulsoEscolta), // i18n-ok: el panel de pruebas
  {
    id: 'ritmo.pareja',
    name: L('El caballero y el chamán', 'The Knight and the Shaman'),
    blurb: 'Los dos ritmos a la vez, en dos cuerpos: el caballero de la coraza (mecha) y el chamán del pulso, que al curarse cura también al caballero.', // i18n-ok: el panel de pruebas
    start(ctx) {
      const volley = new Volley(ctx.scene);
      const rings = new Rings(ctx.scene);
      const side = ctx.rng() < 0.5 ? -1 : 1;
      const knight = spawn(ctx, KNIGHT, KNIGHT_NAME, hpFor(ctx, HP.parejaCaballero), side);
      const shaman = spawn(ctx, SHAMAN, SHAMAN_NAME, hpFor(ctx, HP.parejaChaman), -side);
      const coraza = new Coraza(ctx, knight, { mode: 'mecha', punish: 'lanza', side }, volley, rings);
      const pulso = new Pulso(ctx, shaman, { reset: 'golpe', escort: false, summons: false, allies: () => [knight.e], side: -side }, volley, rings);
      return fight(ctx, [
        { body: knight, coraza, key: 'caballero' },
        { body: shaman, pulso, key: 'chaman' },
      ], volley, rings, RULES.pareja);
    },
  },
  {
    id: 'ritmo.doble',
    name: L('Paladina caída', 'Fallen Paladin'),
    blurb: 'Los dos ritmos en un cuerpo: la coraza (mecha) y el pulso, pero el reloj de la cura lo corta cualquier pelota que lo toque, aunque el blindaje se la coma.', // i18n-ok: el panel de pruebas
    escort: longEscort,
    start(ctx) {
      const volley = new Volley(ctx.scene);
      const rings = new Rings(ctx.scene);
      const name = L('Paladina caída', 'Fallen Paladin');
      const body = spawn(ctx, PALADIN, name, hpFor(ctx, HP.doble));
      const coraza = new Coraza(ctx, body, { mode: 'mecha', punish: 'lanza' }, volley, rings);
      const pulso = new Pulso(ctx, body, { reset: 'toque', escort: false, summons: false, moves: false, ring: 4.3, lift: 3.2 }, volley, rings);
      return fight(ctx, [{ body, coraza, pulso, key: 'paladina' }], volley, rings, RULES.doble);
    },
  },
];
