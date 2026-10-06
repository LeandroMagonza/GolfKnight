// La conexión entre el que juega y el que mira (ver docs/multijugador.md). Dos con la misma cara:
//
// - **Trystero**: WebRTC de navegador a navegador. Para encontrarse usan relays públicos de Nostr, gratis
//   y sin cuenta; después los datos van directo entre los dos. Sin servidor propio: el juego sigue siendo
//   una página estática.
// - **Local** (`&local` en la URL): un BroadcastChannel entre pestañas del mismo navegador. Para probar
//   los dos lados en una sola máquina, y en las pruebas automáticas, sin red.
//
// Trystero se carga recién cuando hace falta: el que juega solo no lo baja.

export type NetMsg = { k: string } & Record<string, unknown>;

export interface Link {
  /** A todos, o a uno solo (`to`). */
  send(msg: NetMsg, to?: string): void;
  onMessage: ((msg: NetMsg, from: string) => void) | null;
  /** Alguien entró a la sala o se fue. */
  onPeer: ((id: string, joined: boolean) => void) | null;
  /**
   * Se encontraron por los relays, pero la conexión directa no salió: la red de alguno de los dos no la
   * deja (algunos routers, el celular con datos). Hace falta un servidor TURN (ver `TURN`). Trystero lo
   * sigue intentando.
   */
  onTrouble: ((peer: string) => void) | null;
  close(): void;
}

/**
 * Cuántos relays de Nostr se usan para encontrarse (Trystero trae 5). Los elige de su lista según el
 * appId, así que los dos lados usan los mismos. Con 5, a nuestra sala le tocaban 2 caídos (probado el
 * 6/10): con 8 quedan 6 que andan.
 */
const RELAYS = 8;

/**
 * El servidor TURN, para cuando las redes no dejan conectar directo: los datos pasan por él. Es la
 * dirección que da las credenciales; con Metered (metered.ca, la cuenta gratis da 20 GB por mes) es
 * `https://<app>.metered.live/api/v1/turn/credentials?apiKey=<clave>`. Vacía = sin TURN, solo conexión
 * directa. Los gratis sin cuenta ya no andan (probado el 6/10: openrelay.metered.ca rechaza las
 * credenciales públicas de siempre). `?soloturn` en la URL obliga a pasar por el TURN, para probarlo.
 */
export const TURN = { credentialsUrl: '' };

async function turnServers(): Promise<{ urls: string | string[]; username?: string; credential?: string }[] | undefined> {
  if (!TURN.credentialsUrl) return undefined;
  try {
    const r = await fetch(TURN.credentialsUrl, { signal: AbortSignal.timeout(5000) });
    const list: unknown = await r.json();
    return Array.isArray(list) ? list : undefined;
  } catch (e) {
    console.warn('TURN: no pude pedir las credenciales', e);
    return undefined;
  }
}

/** El nombre de la app en los relays: separa nuestras salas de las de otros juegos. */
const APP_ID = 'golfknight-mirar';

export async function connect(code: string, local: boolean): Promise<Link> {
  return local ? new LocalLink(code) : trysteroLink(code);
}

/** Un código de sala de 4 letras, sin las que se confunden (I, O). */
export function roomCode(): string {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let s = '';
  for (let i = 0; i < 4; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
}

async function trysteroLink(code: string): Promise<Link> {
  const [{ joinRoom }, turn] = await Promise.all([import('trystero'), turnServers()]);
  const relayOnly = new URLSearchParams(location.search).has('soloturn');
  let trouble: ((peer: string) => void) | null = null;
  const room = joinRoom(
    {
      appId: APP_ID,
      // de la lista de relays, algunos siempre están caídos: que no llenen la consola de avisos
      relayConfig: { warnOnRelayFailure: false, redundancy: RELAYS },
      ...(turn ? { turnConfig: turn } : {}),
      ...(relayOnly ? { rtcConfig: { iceTransportPolicy: 'relay' as const } } : {}),
    },
    code,
    {
      // se encontraron pero no se pudieron conectar: es la red (ver `Link.onTrouble`)
      onJoinError: (e) => {
        console.warn('Trystero:', e.error);
        trouble?.(e.peerId);
      },
    },
  );
  const action = room.makeAction('m');
  const link: Link = {
    send(msg, to) {
      void action.send(msg as never, to ? { target: to } : undefined);
    },
    onMessage: null,
    onPeer: null,
    onTrouble: null,
    close() {
      void room.leave();
    },
  };
  trouble = (peer) => link.onTrouble?.(peer);
  action.onMessage = (data, ctx) => link.onMessage?.(data as unknown as NetMsg, ctx.peerId);
  room.onPeerJoin = (id) => link.onPeer?.(id, true);
  room.onPeerLeave = (id) => link.onPeer?.(id, false);
  return link;
}

/** Entre pestañas: cada una se presenta al entrar y se despide al irse. */
class LocalLink implements Link {
  private readonly id = Math.random().toString(36).slice(2, 10);
  private readonly ch: BroadcastChannel;
  private readonly known = new Set<string>();
  onMessage: Link['onMessage'] = null;
  onPeer: Link['onPeer'] = null;
  onTrouble: Link['onTrouble'] = null;

  constructor(code: string) {
    this.ch = new BroadcastChannel(`gk-mirar-${code}`);
    this.ch.onmessage = (e) => this.receive(e.data);
    this.post({ k: '_hi' });
    addEventListener('pagehide', () => this.close());
  }

  send(msg: NetMsg, to?: string): void {
    this.post({ k: '_m', msg, to });
  }

  close(): void {
    this.post({ k: '_bye' });
    this.ch.close();
  }

  private post(m: Record<string, unknown>): void {
    try {
      this.ch.postMessage({ ...m, from: this.id });
    } catch {
      /* ya cerrado */
    }
  }

  private receive(d: { k: string; from: string; to?: string; msg?: NetMsg }): void {
    if (d.to && d.to !== this.id) return;
    if (d.k === '_bye') {
      if (this.known.delete(d.from)) this.onPeer?.(d.from, false);
      return;
    }
    if (!this.known.has(d.from)) {
      this.known.add(d.from);
      // el que llegó recién no sabe que estamos: le contestamos el saludo solo a él
      if (d.k === '_hi') this.post({ k: '_hi', to: d.from });
      this.onPeer?.(d.from, true);
    }
    if (d.k === '_m' && d.msg) this.onMessage?.(d.msg, d.from);
  }
}
