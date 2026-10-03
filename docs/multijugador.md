# Multijugador de a dos (idea, 2/10/2026)

Un segundo jugador que no es otro golfista: mira la cancha desde arriba y ayuda con habilidades de
utilidad (empujar, frenar, juntar). Poco daño, mucho control. La gracia es que tengan que coordinar.

Estado: **hecho el espectador, y Abe con cuatro hechizos** (granizo, fila, maldición y silencio; ver
abajo, «Hecho»).

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

## Hecho: el espectador (2/10/2026)

El primer paso: otro mira tu partida en vivo, desde su navegador, con su propia cámara. Todavía no hace
nada: es la base de red y de dibujo sobre la que se suman después las habilidades del jugador 2.

**Cómo se usa**
- En la intro, **«Invitar a alguien a mirar tu partida»** abre una sala y muestra el enlace para copiar
  (`?mirar=CÓDIGO&campo=N`). El otro lo abre y listo: puede entrar antes de empezar o con la partida
  empezada.
- El que juega ve «👁 1 mirando» arriba a la izquierda.
- El que mira arranca con la cámara alta, mirando toda la cancha: arrastrar gira, la rueda acerca, el
  botón derecho desplaza. El sonido arranca con su primer click (el navegador no deja antes).
- Reiniciar con R no corta nada: la sala y la cancha quedan en la URL del que juega (`?transmitir=CÓDIGO`),
  y el que mira se reengancha solo con la partida nueva.

**Cómo está hecho** (`src/net/`)
- `link.ts`: la conexión. Trystero (WebRTC directo; se encuentran por relays públicos de Nostr) o, con
  `&local` en la URL, un BroadcastChannel entre pestañas, para probar sin red. Trystero se baja recién
  cuando se invita o se mira.
- `host.ts`: el que juega manda 15 fotos por segundo con lo que se ve (enemigos con su animación y sus
  estados, el golfista, las pelotas, las piedras y hechizos, las marcas de las habilidades, los carritos,
  las lomas, el HUD de arriba), solo mientras alguien mira. Los efectos, sonidos y carteles se reenvían
  envolviendo esos métodos (`mirror`): el juego no se entera.
- `spectator.ts`: el que mira no simula nada. Arma los mismos enemigos (con el id del que juega), los pone
  donde dicen las fotos y dibuja 130 ms atrasado, suavizando entre la foto de antes y la de después. Los
  eventos esperan a su hora para salir junto con lo que se ve. Solo acepta los métodos de la lista
  (`MIRRORED`).
- `snapshot.ts`: los tipos y las cuentas (reloj, suavizado, cola de eventos), con tests.
- En el juego: `Enemy`, `Player` y `LayeredAnimator` saben sacarse una foto y ponerse como dice una
  (`snapshot` / `applyRemote` / `applyState`); `Abilities` muestra marcas y carritos sin que hagan nada
  (`remote`).

**Probado**: dos pestañas (`logs/check-mirar.mjs`) y dos navegadores por la red de verdad
(`check-mirar.mjs red`), en golf y en tenis (`tenis`): los mismos enemigos con la misma vida, a menos de
medio metro caminando (es el atraso a propósito), las pelotas, el HUD, la pausa, el reinicio y el que se va.

**Falta** (para más adelante)
- Las pelotas apoyadas en los puestos y los guardias tirándolas (el que mira no ve los puestos), las
  trampas, la pelota que tira el alcanzapelotas del tenis y sus marcas de dónde cae, los números de daño
  que flotan, y qué cartas se ofrecen (se ve que se está eligiendo).
- Algunas redes no dejan la conexión directa: si pasa, hay que sumar un servidor TURN.
- El jugador 2 de verdad: sus habilidades (tanda 1 de «Por tandas»).

## Hecho: Abe y el granizo (3/10/2026)

El jugador 2 es **Abe, el mago que te invocó**. Por ahora es **el primero que entra a mirar**; los demás
solo miran, por balance. Si Abe se va, pasa a ser Abe el que sigue.

**El granizo**: Abe hace click en el piso (arrastrar sigue girando la cámara) y ahí aparece un círculo
celeste, para los dos. El círculo se va llenando y al final caen trozos de hielo: a todos los que agarra
los enfría (caminan lento). No hace daño: Abe ayuda, el que mata sos vos. Recarga cada 8 s. Antes de
tirar, Abe ve un círculo que sigue al mouse (gris mientras recarga) y abajo su panel con la recarga.

**Números** (panel de balance, pestaña del tiro, «Abe»): recarga 8 s, demora 1.5 s, radio 3.5 m, frío
4 s, y si además congela (apagado). Cuentan los del que juega.

**Cómo está hecho**: `src/coop/abe.ts` (el granizo: marca, espera, cae y enfría, en el juego del que
juega; el que mira lo dibuja desde la foto). Abe manda `{ k: 'cast', x, z }`; el que juega decide (que
sea Abe, que haya recargado, que la partida esté andando) y avisa quién es Abe con `{ k: 'role' }`.
Probado con `logs/check-abe.mjs`: un host y dos que miran.

**Ideas para seguir**: más poderes de Abe (empujón, muro, imán) en teclas, energía que se carga cuando
vos pegás, y que el que juega vea a Abe en algún lado (en la muralla, con su báculo).

## Hecho: los cuatro hechizos de Abe (3/10/2026)

Abe juega **táctico**, y se puede jugar desde el celular: abajo tiene **cuatro botones grandes** (o las
teclas 1 a 4) para elegir el hechizo, y un toque en el piso lo pone ahí. Arrastrar sigue girando la
cámara; en el celular, dos dedos acercan. La cámara arranca lo bastante lejos para que entre todo el
ancho de la cancha, también con el celular parado.

**Las reglas que pidió Leandro**: los hechizos **generan jugadas con el caballero** (Abe prepara, el
caballero pega), **duran poco** (para que el timing importe), **llegan a toda la cancha** y agarran
**áreas chicas**. Ninguno hace daño. Cada uno tiene su recarga.

| Hechizo | Sale de | Qué hace | La jugada con el caballero | Números |
|---|---|---|---|---|
| ❄ **Granizo** | el hielo | Marca, y a los 1.5 s cae hielo: los frena 4 s | Frenarlos donde querés pegar, o lejos de la puerta | recarga 8 s, radio 3.5 m |
| 🌬 **Fila** | el driver de viento | Los pone en fila **sobre la línea de tu puesto al centro del círculo** | Uno detrás del otro: el driver los atraviesa a todos | recarga 8 s, radio 3.5 m, sale a los 0.6 s |
| 🎯 **Maldición** | la lupa | Crecen y reciben 1 más por golpe, 3 s | Pegarles en esa ventana: más fáciles de acertar y pegan más | recarga 10 s, radio 3 m |
| 🔇 **Silencio** | el wedge silenciador | Se les apagan los poderes 2.5 s (al élite, la mitad) | Escudo, blindaje, burbuja, esquiva y auras apagados: tirá ya | recarga 10 s, radio 3 m |

**La magia cae de arriba**: a diferencia de las pelotas, no la paran el escudo ni la burbuja. Silenciar al
chamán le apaga el aura a todos los que protegía. La fila no mueve al jefe.

**Las que no se adaptaron, y por qué**:
- El **carrito**, el **hoyo** y el **fuego** o el **rayo** hacen daño o matan: eso es del caballero.
- La **bandera** y el **palazo** mueven a muchos y por mucho tiempo: rompen el balance (la fila es el
  empujón de Abe, chico y con dirección).
- La **lluvia de pelotas**, el **caddie**, el **clon**, el **eco** y la **potencia** son del golfista y de
  sus tiros.
- La **pólvora** quedaría bien como quinto hechizo más adelante (marca, y el que muere marcado explota).

**Cómo está hecho**: `src/coop/abe.ts` tiene los cuatro (`ABE_SPELLS` con los números, `SPELL_INFO` con
nombre, ícono y color). Abe manda `{ k: 'cast', s, x, z }`; el que juega decide y manda las recargas de
los cuatro en cada foto. Los números están en el panel de balance, pestaña del tiro, «Abe». Probado con
`logs/check-abe.mjs`: cada hechizo hace lo suyo (la fila deja a los de 2.5 m a 2 cm de la línea), las
recargas son de cada uno, y el que no es Abe no puede tirar.
