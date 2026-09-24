// Bot que juega solo, para chequear el balance y para mirarlo jugar. Se activa con ?bot en la URL
// (http://localhost:5173/?bot) y lo usa tools/botplay.mjs. Maneja el juego como una persona: mueve el
// mouse, aprieta teclas y carga los tiros en tiempo real.
//
// Juega con el reparto nuevo: elige **palo** por la distancia a la que está el blanco (el driver cobra
// de lejos, el putter de cerca, el hierro y el wedge parejo) y tira **habilidades** según la situación
// (vendaval para abrir defensas, hielo cuando lo rodean, granada a un grupo a media distancia). No busca
// filas ni clava el golpe, y suelta apuntando al nivel 2, así que es una cota inferior de lo que hace
// una persona.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Gk = any;

export interface BotStats {
  byClub: Record<string, number>;
  /** Habilidades tiradas, por nombre. */
  casts: Record<string, number>;
  melee: number;
  moves: number;
  dodges: number;
  grabs: number;
  jumps: number;
}

/** Cada palo tiene su tecla: Digit1 a Digit4, en este orden. */
const CLUB_ORDER = ['driver', 'iron', 'wedge', 'putter'];
/** Cada habilidad tiene la suya: Q, W y E. */
const ABILITY_KEYS: Record<string, string> = { grenade: 'KeyQ', ice: 'KeyW', wind: 'KeyE' };

function key(code: string): void {
  dispatchEvent(new KeyboardEvent('keydown', { code }));
  dispatchEvent(new KeyboardEvent('keyup', { code }));
}

export function startBot(): BotStats {
  const gk: Gk = (window as any).__gk;
  const stats: BotStats = { byClub: {}, casts: {}, melee: 0, moves: 0, dodges: 0, grabs: 0, jumps: 0 };
  (window as any).__bot = stats;

  // El bot apunta moviendo el mouse. Para que el mouse de quien mira no le corra la puntería, repite
  // su última posición en cada cuadro.
  let aimX = innerWidth / 2;
  let aimY = innerHeight / 3;
  const aim = (x: number, z: number) => {
    const s = gk.screenOf(x, z);
    aimX = s.x;
    aimY = s.y;
  };
  const holdAim = () => {
    dispatchEvent(new MouseEvent('mousemove', { clientX: aimX, clientY: aimY }));
    requestAnimationFrame(holdAim);
  };
  holdAim();

  let escaping = false;
  let dodgedAt = 0;
  let cardSince = 0;
  let castAt = -10;

  setInterval(() => {
    const pl = gk.player;
    // cartel de palo nuevo: lo deja un par de segundos, para que quien mira lo pueda leer, y lo cierra
    if (gk.cardOpen) {
      if (!cardSince) cardSince = performance.now();
      if (performance.now() - cardSince > 2500) {
        cardSince = 0;
        gk.dismissCard();
      }
      return;
    }
    if (!pl || gk.ended || gk.paused || !pl.alive || gk.director.index < 0) return;
    const p = pl.position;
    const dist = (e: any) => Math.hypot(e.position.x - p.x, e.position.z - p.z);

    // agarrado: la única salida es el palazo, que la suelta y la deja aturdida
    if (pl.grabbedBy) {
      if (escaping || pl.meleeCooldown > 0) return;
      escaping = true;
      stats.grabs++;
      key('ShiftLeft');
      stats.melee++;
      setTimeout(() => { escaping = false; }, 200);
      return;
    }
    // Nadie lo persigue, pero el que le pasa por encima lo atropella. Si uno viene derecho hacia su puesto:
    // palazo si está listo (lo manda 15 m atrás); si no, suelta lo que esté cargando y se corre dos puestos.
    const threat = gk.horde.enemies.find((e: any) => e.alive && !e.passed && e.state === 'walk' && (e.stats.behavior === 'melee' || e.stats.behavior === 'kamikaze')
      && e.position.z > p.z - 0.5 && e.position.z - p.z < 4.5 && Math.abs(e.position.x - p.x) < 1.8);
    if (threat && pl.atSpot && performance.now() - dodgedAt > 500) {
      dodgedAt = performance.now();
      if (pl.meleeCooldown <= 0 && pl.mode !== 'swinging' && threat.stats.behavior === 'melee' && dist(threat) < 3.2) {
        aim(threat.position.x, threat.position.z);
        stats.melee++;
        setTimeout(() => key('ShiftLeft'), 40);
        return;
      }
      stats.dodges++;
      if (pl.mode === 'charging') key('KeyX');
      const i = gk.tees.nearest(p.x);
      const up = i + 2 < gk.tees.spots.length && (i - 2 < 0 || threat.position.x < p.x);
      for (let n = 0; n < 2; n++) key(up ? 'KeyA' : 'KeyD');
      return;
    }
    if (pl.mode !== 'free' || !pl.atSpot) return;

    // sin pelota en este puesto: corre hasta la más cercana (A sube de puesto, D baja)
    const here = gk.tees.nearest(p.x);
    if (!gk.tees.hasBall(here)) {
      const to = gk.tees.nearestBall(here);
      if (to >= 0) {
        stats.moves++;
        for (let i = 0; i < Math.abs(to - here); i++) key(to > here ? 'KeyA' : 'KeyD');
      }
      return;
    }

    const alive: any[] = gk.horde.enemies.filter((e: any) => e.alive && !e.passed);
    if (!alive.length) return;

    // Las habilidades salen en el acto y no gastan la pelota del puesto, así que van antes del tiro:
    // apunta, espera a que la puntería llegue al juego y aprieta la tecla. Una por vuelta.
    if (gk.clock - castAt > 1) {
      const ab = gk.abilities;
      const cast = (id: string, x: number, z: number) => {
        castAt = gk.clock;
        aim(x, z);
        stats.casts[id] = (stats.casts[id] ?? 0) + 1;
        setTimeout(() => key(ABILITY_KEYS[id]), 80);
      };
      // 1) vendaval a quien haya que abrir: chamán conjurando, escudo en alto, jefe sin silenciar
      const open = ab.ready('wind') && (alive.find((e) => e.casting && dist(e) < 50)
        ?? alive.filter((e) => e.shieldUp && dist(e) < 50).sort((a, b) => a.position.z - b.position.z)[0]
        ?? alive.find((e) => e.stats.boss && !e.silenced && dist(e) < 50));
      if (open) return cast('wind', open.position.x, open.position.z);
      // 2) varios cerca: el hielo los frena ahí mismo
      const near = alive.filter((e) => dist(e) < 14);
      if (near.length >= 3 && ab.ready('ice')) {
        const cx = near.reduce((s, e) => s + e.position.x, 0) / near.length;
        const cz = near.reduce((s, e) => s + e.position.z, 0) / near.length;
        return cast('ice', cx, cz);
      }
      // 3) un grupo a media distancia: la granada los ordena en dos filas para el driver
      const mid = alive.filter((e) => dist(e) > 18 && dist(e) < 40);
      if (mid.length >= 3 && ab.ready('grenade')) {
        const cx = mid.reduce((s, e) => s + e.position.x, 0) / mid.length;
        const cz = mid.reduce((s, e) => s + e.position.z, 0) / mid.length;
        return cast('grenade', cx, cz);
      }
    }

    // 1) un alma en pena que se le viene encima va primero: corre derecho hacia él, es un tiro fácil
    let target: any = alive.filter((e) => e.stats.behavior === 'grabber' && dist(e) < 32).sort((a, b) => dist(a) - dist(b))[0] ?? null;
    // 2) si no, al que tenga encima o al más avanzado que se pueda dañar
    if (!target) {
      const hittable = alive.filter((e) => !e.warded && !(e.shieldUp && dist(e) > 6));
      const pool = hittable.length ? hittable : alive;
      target = pool.filter((e) => dist(e) < 7).sort((a, b) => dist(a) - dist(b))[0] ?? pool.sort((a, b) => a.position.z - b.position.z)[0];
    }

    // El palo lo decide la distancia, que es de donde sale el daño. Los cuatro palos están desde la
    // primera oleada, así que la elección es solo táctica.
    const d = dist(target);
    let club = 'driver';
    if (d <= 12) club = 'putter';
    else if (d <= 40) club = 'iron';
    // cada palo tiene su tecla: un toque y ya
    if (pl.club.id !== club) key(`Digit${CLUB_ORDER.indexOf(club) + 1}`);

    // La barra ya no tiene nada que ver con la distancia: apunta a soltar en el nivel 2, que es lo que
    // haría alguien sin clavarla. El alcance lo da el mouse.
    const want = 0.78;
    const chargeTime = gk.player.club.chargeTime;

    // Anticipación: mientras carga, pega y la pelota vuela, el enemigo sigue caminando hacia la puerta
    // (en diagonal, no derecho). Se apunta a donde va a estar.
    const speed = target.stats.speed * target.speedMul * (target.chilled ? gk.iceSlow : 1);
    if (target.stats.behavior === 'grabber' && d > 3) {
      // viene hacia el golfista: se apunta un poco más acá sobre esa misma línea
      const k = Math.max(0.2, 1 - (speed * (0.6 + want)) / d);
      aim(p.x + (target.position.x - p.x) * k, p.z + (target.position.z - p.z) * k);
    } else if (target.target === 'gate' && speed > 0) {
      const lead = 0.12 + want * chargeTime + 0.4 + (club === 'driver' ? d / 90 : Math.sqrt((2 * d * 0.84) / 50));
      const gx = Math.max(-2.3, Math.min(2.3, target.position.x)) - target.position.x;
      const gz = 0.8 - target.position.z;
      const gl = Math.hypot(gx, gz) || 1;
      aim(target.position.x + (gx / gl) * speed * lead, Math.max(1, target.position.z + (gz / gl) * speed * lead));
    } else {
      aim(target.position.x, target.position.z);
    }

    setTimeout(() => {
      if (pl.mode !== 'free' || pl.grabbedBy) return;
      stats.byClub[club] = (stats.byClub[club] ?? 0) + 1;
      // Carga de verdad: mantiene apretado y suelta al llegar a la calidad buscada.
      pl.startSwing();
      const poll = () => {
        if (pl.mode !== 'charging') return;
        if (pl.meter.power >= want) pl.releaseSwing();
        else requestAnimationFrame(poll);
      };
      requestAnimationFrame(poll);
    }, 120);
  }, 250);
  return stats;
}
