// Bot que juega solo, para chequear el balance y para mirarlo jugar. Se activa con ?bot en la URL
// (http://localhost:5173/?bot) y lo usa tools/botplay.mjs. Maneja el juego como una persona: mueve el
// mouse, aprieta teclas y carga los tiros en tiempo real.
//
// Juega con el reparto de palos del diseño: el driver cobra, el hierro abre (chamanes, escudos, jefe),
// el wedge se saca enemigos de encima, el palazo pega de cerca y el putter lo libera de un agarre. No
// camina ni busca filas, así que es una cota inferior de lo que hace una persona.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Gk = any;

export interface BotStats {
  byClub: Record<string, number>;
  melee: number;
  grabs: number;
  jumps: number;
}

const KEYS: Record<string, string> = { driver: 'Digit1', iron: 'Digit2', wedge: 'Digit3' };

function key(code: string): void {
  dispatchEvent(new KeyboardEvent('keydown', { code }));
  dispatchEvent(new KeyboardEvent('keyup', { code }));
}

export function startBot(): BotStats {
  const gk: Gk = (window as any).__gk;
  const stats: BotStats = { byClub: {}, melee: 0, grabs: 0, jumps: 0 };
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
  let cardSince = 0;
  let pushedAt = -10;

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

    // agarrado: tira la pelota lejos del alma en pena y salta
    if (pl.grabbedBy) {
      if (escaping || !pl.unlocked.has('putter')) return;
      escaping = true;
      stats.grabs++;
      const g = pl.grabbedBy.position;
      const away = Math.atan2(p.x - g.x, p.z - g.z);
      if (!gk.portal.out) {
        aim(Math.max(-14, Math.min(14, p.x + Math.sin(away) * 10)), Math.max(4, Math.min(40, p.z + Math.cos(away) * 10)));
        setTimeout(() => key('Space'), 80);
      }
      setTimeout(() => {
        key('Space');
        stats.jumps++;
        escaping = false;
      }, 500);
      return;
    }
    if (pl.mode !== 'free') return;

    const alive: any[] = gk.horde.enemies.filter((e: any) => e.alive);
    if (!alive.length) return;

    // palazo a lo que tenga encima, cuando está listo
    if (pl.meleeCooldown <= 0 && alive.some((e) => dist(e) < 2.6)) {
      const nearest = alive.slice().sort((a, b) => dist(a) - dist(b))[0];
      aim(nearest.position.x, nearest.position.z);
      stats.melee++;
      setTimeout(() => key('ShiftLeft'), 60);
      return;
    }

    const ironReady = pl.unlocked.has('iron') && pl.cooldowns.iron <= 0;
    const inIron = (e: any) => dist(e) > 7 && dist(e) < 39;
    let club = 'driver';
    let target: any = null;

    // 1) hielo a quien haga falta abrir: chamán conjurando, escudo sin hielo, jefe sin hielo
    if (ironReady) {
      target = alive.find((e) => e.casting && inIron(e))
        ?? alive.filter((e) => e.stats.shield && !e.chilled && inIron(e)).sort((a, b) => a.position.z - b.position.z)[0]
        ?? alive.find((e) => e.stats.boss && !e.chilled && inIron(e))
        ?? null;
      if (target) club = 'iron';
    }
    // 2) rodeado: el wedge los saca de encima (no daña, pero compra tiempo y los deja lejos)
    const near = alive.filter((e) => dist(e) < 8 && !e.stats.heavy);
    if (!target && near.length >= 3 && pl.unlocked.has('wedge') && gk.clock - pushedAt > 3) {
      club = 'wedge';
      target = near.sort((a, b) => dist(b) - dist(a))[0];
      pushedAt = gk.clock;
    }
    // 3) un alma en pena que se le viene encima va primero: corre derecho hacia él, es un tiro fácil
    if (!target) target = alive.filter((e) => e.stats.behavior === 'grabber' && dist(e) < 32).sort((a, b) => dist(a) - dist(b))[0] ?? null;
    // 4) si no, driver: al que tenga encima o, si no, al más avanzado que se pueda dañar
    if (!target) {
      const hittable = alive.filter((e) => !e.warded && !(e.stats.shield && !e.chilled && dist(e) > 6));
      const pool = hittable.length ? hittable : alive;
      target = pool.filter((e) => dist(e) < 7).sort((a, b) => dist(a) - dist(b))[0] ?? pool.sort((a, b) => a.position.z - b.position.z)[0];
    }
    if (pl.club.id !== club) key(KEYS[club]);

    // anticipación: el enemigo sigue caminando mientras la pelota vuela
    const speed = target.frozen ? 0 : target.stats.speed * target.speedMul * (target.chilled ? 0.4 : 1);
    if (target.stats.behavior === 'grabber' && !target.frozen && dist(target) > 3) {
      // viene hacia el golfista: se apunta un poco más acá sobre esa misma línea
      const k = Math.max(0.2, 1 - (speed * 0.8) / dist(target));
      aim(p.x + (target.position.x - p.x) * k, p.z + (target.position.z - p.z) * k);
    } else {
      const lead = target.target === 'gate' ? speed * (club === 'iron' ? 1.3 : 0.5) : 0;
      aim(target.position.x, Math.max(1, target.position.z - lead));
    }

    setTimeout(() => {
      if (pl.mode !== 'free' || pl.grabbedBy || pl.club.id !== club) return;
      stats.byClub[club] = (stats.byClub[club] ?? 0) + 1;
      // Carga de verdad: mantiene apretado y suelta al llegar a la potencia buscada. El hierro sale
      // con poca carga; un toque de driver alcanza para un goblin y lo demás pide carga.
      const c = pl.club;
      const reach = Math.min(0.99, Math.max(0, (gk.aimDistance + 6 - c.minRange) / (c.maxRange - c.minRange)));
      const want = club === 'iron' ? 0.3 : club === 'wedge' ? 0.5 : Math.max(reach, target.hp > 36 ? 0.85 : 0.08);
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
