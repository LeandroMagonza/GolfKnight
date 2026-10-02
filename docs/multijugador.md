# Multijugador de a dos (idea, 2/10/2026)

Un segundo jugador que no es otro golfista: mira la cancha desde arriba y ayuda con habilidades de
utilidad (empujar, frenar, juntar). Poco daño, mucho control. La gracia es que tengan que coordinar.

Estado: **idea, nada implementado.**

## El jugador 2: "el de la torre"

- Cámara desde arriba (cenital o casi), ve toda la cancha.
- Apunta con el mouse o con el dedo y suelta habilidades en un punto. No tira pelotas.
- Poder con recarga por habilidad, o una barra de energía compartida.

### Habilidades posibles

| Habilidad | Qué hace | Para qué sirve en equipo |
|---|---|---|
| **Empujón** | Golpe de área que tira a los enemigos para atrás o de costado | Sacarlos de la puerta, separar un grupo |
| **Zona lenta** | Charco o niebla que los frena unos segundos | Darle tiempo al 1 para cargar un tiro fuerte |
| **Imán / embudo** | Junta enemigos en fila o en un montón | En tenis la pelota atraviesa al que mata: una fila rinde. En golf, un montón es ideal para un tiro de área |
| **Muro temporal** | Cierra un carril | Obligarlos a pasar por donde apunta el 1 |
| **Marcar** | El marcado recibe más daño del 1 | Concentrar el fuego en un élite |
| **Levantar** | Los deja en el aire un momento, quietos | Blancos fáciles para el 1 |

### Atar a los dos jugadores

Para que coordinar valga la pena, y no sean dos juegos que pasan a la vez:

- El jugador 2 **carga energía cuando el 1 pega** (o mata).
- Los golpes del 1 sobre enemigos **frenados o marcados hacen más daño**.
- Podrían existir cartas de pareja, que solo aparecen jugando de a dos (por ejemplo, "el empujón deja a
  los enemigos marcados").

### El jugador 2 desde el celular

Apuntar y tocar anda bien en una pantalla táctil: el 1 juega en la compu y el 2 se suma desde el
celular o una tablet, escaneando un QR. Vale la pena diseñar el HUD del 2 pensando en el celular desde
el principio.

## Tecnología

### Arquitectura: el navegador del jugador 1 manda

El juego del 1 corre como hoy: enemigos, pelotas, oleadas, cartas, todo. El 2 es un cliente liviano:

- **Manda acciones**, del tipo "empujón en (x, z)". El juego del 1 las aplica con el mismo código de
  habilidades que ya existe ([src/game/abilities.ts](../src/game/abilities.ts)).
- **Recibe fotos del estado**, unas 15 a 20 por segundo: posición, vida y animación de cada enemigo;
  las pelotas; los eventos (explosiones, golpes, sonidos). Las dibuja suavizando entre foto y foto.

Como el 2 no necesita precisión de milisegundos, el lag le afecta poco: una habilidad que llega 80 ms
tarde no se nota.

**Lo que descarté: la simulación igual en las dos máquinas** (lockstep: cada uno corre todo y solo se
mandan los controles). Exige que el juego dé exactamente lo mismo en las dos, y hoy no es así:

- el paso de tiempo varía con cada cuadro ([src/main.ts](../src/main.ts), en `frame`);
- hay `Math.random()` repartido en 8 archivos;
- [src/game/enemies.ts](../src/game/enemies.ts) tiene mucha lógica (99 KB).

Volverlo exacto sería mucho trabajo y muy frágil: cualquier cambio futuro podría romperlo sin aviso.

### Conexión: WebRTC de navegador a navegador

- Va directo entre los dos navegadores, sin servidor de juego. Encaja con GitHub Pages: el juego sigue
  siendo una página estática y no cuesta nada.
- WebRTC necesita un "presentador" para que los dos navegadores se encuentren:
  - **[Trystero](https://github.com/dmotz/trystero)** (la que elegiría): lo hace por servidores públicos
    gratis (Nostr, BitTorrent, MQTT), sin cuenta ni backend propio.
  - **[PeerJS](https://peerjs.com/)**: más conocida, pero depende de su servidor público.
- El 1 crea una sala y comparte un enlace (`?sala=K7QF`) o un QR.
- Algunas redes (de empresas, ciertos datos móviles) no dejan la conexión directa. Para eso hace falta
  un **servidor TURN**, que reenvía el tráfico. Cloudflare y Metered tienen planes gratis. Lo
  agregaríamos solo si aparece el problema.

### Para desarrollarlo: dos pestañas, sin red

La comunicación va en una capa intercambiable (`send` / `onMessage`):

1. Primero con **`BroadcastChannel`**, que comunica dos pestañas del mismo navegador. Se prueban los
   dos roles en una sola máquina, y con Playwright, sin pelear con la red.
2. Después se cambia esa capa por WebRTC, sin tocar el juego.

### Lo que dejé para más adelante

Un **servidor que lo maneje todo** (Colyseus, PartyKit, Cloudflare Durable Objects). Es más robusto y
evita trampas, pero obliga a sacar la simulación del navegador (hoy está atada a Three.js) y a mantener
un backend. Para un cooperativo de a dos no hace falta.

### Los mensajes

- Del 2 al 1: `{ t: 'cast', id: 'push', x, z }`, más saludos y pings.
- Del 1 al 2, en cada foto: enemigos `[id, tipo, x, z, rot, vida, animación]`, pelotas `[id, x, y, z]`,
  energía del 2, oleada.
- Del 1 al 2, como eventos sueltos: `{ t: 'fx', kind: 'explosion', x, z }`, sonidos, carta elegida,
  fin de partida.

Primero en JSON. Si las fotos pesan mucho (oleadas grandes), se pasan a binario con arreglos tipados.

## Qué cambia en el código

1. **Identificadores estables** para enemigos y pelotas, para que el 2 sepa qué modelo mover.
2. **Un modo "solo mirar"** en enemigos y pelotas: crea y mueve los modelos según lo que llega, sin
   inteligencia ni física.
3. **Eventos** para explosiones, golpes y sonidos: se mandan como "pasó esto acá", no como estado.
4. **El rol del jugador 2**: la cámara desde arriba, su HUD y las habilidades nuevas. Las habilidades
   corren en el juego del 1.
5. **La sala y la conexión**: el botón en la intro, el enlace y el QR.

## Por tandas

1. **Probar el diseño, sin red.** Las habilidades del 2 y la cámara desde arriba en la misma compu
   (por ejemplo, el 2 con el mouse en una vista chica, o con un toggle). La pregunta es si es divertido
   coordinar así.
2. **Dos pestañas** con `BroadcastChannel`: el 2 mira las fotos del estado y manda acciones.
3. **Red de verdad**: WebRTC con Trystero, la sala, el enlace y el QR.
4. **Pulido**: reconexión, qué pasa si alguien se va, ajustar la frecuencia de las fotos, el TURN si
   hace falta.

Lo más incierto es el diseño, no la red: por eso se arranca por la tanda 1.
