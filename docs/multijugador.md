# Multijugador de a dos (idea, 2/10/2026)

Un segundo jugador que no es otro golfista: mira la cancha desde arriba y ayuda con habilidades de
utilidad (empujar, frenar, juntar). Poco daño, mucho control. La gracia es que tengan que coordinar.

Estado: **hecho el espectador, y Abe con siete hechizos que va ganando** (ver abajo, «Hecho»).

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

## Hecho: los hechizos de Abe y cómo los gana (3/10/2026)

Abe mira la cancha **desde arriba, como un dios**: no está en el campo. Juega **táctico**, y se puede jugar
desde el celular: abajo tiene **cuatro botones grandes** (o las teclas 1 a 4) para elegir el hechizo, y un
toque en el piso lo pone ahí. Arrastrar gira la cámara; en el celular, dos dedos acercan. La cámara
arranca lo bastante lejos para que entre todo el ancho de la cancha, también con el celular parado.

**Las reglas** (pedido de Leandro): los hechizos **generan jugadas con el caballero** (Abe prepara, el
caballero pega), **duran poco** (para que el timing importe), **llegan a toda la cancha** y agarran
**áreas chicas**. Ninguno hace daño. **Nunca se habla de palos**: cada hechizo es una **zona** (un círculo
donde tocás), una **línea** (del caballero hasta donde tocás) o una **trampa** (queda en el piso).

| Hechizo | Forma | Qué hace (nivel 1 · 2 · 3) | La jugada con el caballero | Recarga |
|---|---|---|---|---|
| ❄ **Granizo** | zona 3 · 3.5 · 4 m | Marca, y a los 1.5 s cae hielo: los frena 3 · 4 · 5 s; en el 3 además los congela | Frenarlos donde querés pegar | 8 s |
| 🌀 **Remolino** | zona 5 · 6 · 7 m (desde el 7/10; antes 2.5 · 3 · 3.5) | Los lleva al centro, hasta que se chocan | Amontonados para un tiro de área | 8 s |
| 💨 **Corriente** | línea de 4 · 5 · 6 m de ancho | **Del caballero hasta donde tocás**: los que están en el pasillo quedan sobre la línea, uno detrás del otro | Una fila servida para el tiro que atraviesa | 10 s |
| ✋ **Empujón** | zona 2.5 · 3 · 3.5 m | Los manda 6 · 8 · 10 m para atrás | Sacarlos de la puerta, o separar uno del grupo | 10 s |
| 🎯 **Maldición** | zona 2.5 · 3 · 3.5 m | Crecen y reciben 1 más por golpe, 3 · 4 · 5 s | Pegarles en esa ventana | 10 s |
| 🔇 **Silencio** | zona 2.5 · 3 · 3.5 m | Se les apagan los poderes 2 · 2.5 · 3 s (al élite, la mitad) | Escudo, blindaje, burbuja y auras apagados: tirá ya | 10 s |
| 🪤 **Trampa** | trampa de 2 · 2.5 · 3 m | Queda en el piso hasta 15 s; el primero que pasa a 1.2 m la dispara y todos los de alrededor quedan atrapados 1.5 · 2 · 2.5 s (los pesados no) | Anticipar por dónde vienen y pegarles quietos | 10 s |

Salen a los 0.5 s de tocar (el granizo a los 1.5): agarran a los que están adentro **en ese momento**, así
que a los que caminan hay que adelantarlos un poco.

**La magia cae de arriba**: a diferencia de las pelotas, no la paran el escudo ni la burbuja. Silenciar al
chamán le apaga el aura a todos los que protegía. El remolino, la corriente y el empujón no mueven al jefe.

**Cómo los gana** (pedido de Leandro):
- Arranca **eligiendo su primer hechizo** entre tres, y gana **otro al terminar cada oleada**, hasta tener 4.
  Los gana aunque todavía no haya entrado: si llega tarde, elige todos los que le deben.
- Con los cuatro lugares llenos le salen **hechizos de un nivel más que el más bajo que tiene** (cualquiera,
  no solo los que ya tiene). Elige uno y **toca el lugar que reemplaza**, o **se queda con los suyos**.
  Cuando todos son de nivel 2, salen de nivel 3.
- Puede tener **el mismo hechizo dos veces, de distinto nivel**: cada lugar recarga por su lado.
- **La oleada que viene espera a que elijan los dos**: el caballero su carta y Abe su hechizo. El caballero
  ve «Esperando a que Abe elija su hechizo…», y a Abe le salen las cartas solas. Sin Abe, no espera a nadie.

**La sala** (en la intro y en la pausa, debajo del enlace):
- **Echar a Abe**: al echado le avisa y se desconecta; el que sigue mirando pasa a ser Abe.
- **Privada**: no entra nadie más (al que intenta le avisa); los que ya miran siguen. Queda en la URL, así
  que sigue privada al reiniciar. Para que el echado no vuelva con otra pestaña, hacé la partida privada.

**Las del caballero que no se adaptaron, y por qué**: el carrito, el hoyo, el fuego y el rayo hacen daño o
matan (eso es del caballero); la bandera y el palazo mueven a muchos por mucho tiempo (el empujón de Abe
es chico); la lluvia de pelotas, el caddie, el clon, el eco y la potencia son de los tiros del golfista. La
pólvora quedaría bien como hechizo más adelante.

**Cómo está hecho**: `src/coop/spells.ts` (lo puro, con tests: los números por nivel, cómo se explican y
las ofertas), `src/coop/abe.ts` (en la partida: los lugares, las recargas, la oferta y cada hechizo, y cómo
se ven). Abe manda `{ k: 'cast', i, x, z }` y `{ k: 'pick', c, s }`; el que juega decide y manda en cada
foto los lugares, la oferta y si la oleada lo espera. Los números están en el panel de balance, pestaña del
tiro, «Abe», por nivel; ahí también está «Darle un hechizo a Abe». Probado con `logs/check-abe.mjs` (los
siete hechizos, la oferta, reemplazar, el mismo hechizo dos veces) y `logs/check-abe-sala.mjs` (la oleada
que espera, la privada y echar a Abe).


## Hecho: la chispa, la cámara nueva y Abe que no pierde su lugar (5/10/2026)

Lo que Leandro vio jugando de a dos, con Abe desde el celular:

- **La chispa, el ataque básico.** Tocar el piso sin hechizo elegido tira la chispa: recarga 1.2 s, cae a
  los 0.25 s en un círculo de 1.1 m de radio (unos dos enemigos de ancho) y los que agarra quedan
  **clavados** 0.5 s: no caminan, pero atacan y se cubren como siempre (no es aturdir: si lo fuera, cada
  1.2 s bajaría escudos). Al jefe no. Así Abe siempre tiene algo para hacer.
- **Elegir el hechizo es para el próximo toque.** Tocar un hechizo lo elige; el próximo toque en el piso lo
  tira y Abe vuelve a la chispa. Tocar otra vez el elegido, o la chispa, lo suelta. Con teclado: 1 a 4
  eligen, y **Q W E R lo tiran ya donde está el mouse**, sin cambiar lo elegido.
- **Abe ve adónde apunta el caballero**: la línea punteada desde su pelota y el anillo donde cae (más
  fuertes mientras carga). Viaja en la foto (`am`).
- **La cámara**: antes era una órbita libre y uno se perdía. Ahora (`src/net/fieldcam.ts`) mira siempre la
  cancha de frente, desde atrás de la puerta: arrastrar va **para adelante y para atrás**, el botón derecho
  o dos dedos para arriba o abajo cambian **el ángulo** (de casi de costado a desde arriba), y la rueda o
  pellizcar acercan. No gira ni se corre para el costado. Las flechas también la mueven.
- **El tutorial**: si Abe entra mientras el caballero hace el tutorial, ve «El caballero está haciendo el
  tutorial…» y **elige sus hechizos**, pero no tira (un empujón le desarmaba el paso). Cuando empieza la
  partida ya juega.
- **Abe no pierde su lugar.** Lo que le pasó a Leandro (entraba y no podía hacer nada) era la reconexión:
  Abe era «el primero que entró» por el id de la conexión, y al cortarse y volver entraba con otro id,
  como uno que solo mira, mientras la conexión vieja seguía ocupando el lugar. Ahora cada pestaña tiene su
  id (`me`, en sessionStorage, que sobrevive a recargar): el que vuelve recupera su lugar, y si Abe se va,
  el lugar lo espera 30 s antes de pasar al que sigue. El echado tampoco vuelve desde esa pestaña.
- **Reconectar solo.** Sin noticias del que juega por 12 s, el que mira vuelve a entrar a la sala de cero
  («Reconectando… (intento N)»), y sigue buscando si al principio no la encuentra. Con mal wifi la
  conexión se moría y no volvía sola.

Probado con `logs/check-abe-chispa.mjs` (la chispa clava a los de adentro y no al de al lado; elegir, tirar
y volver a la chispa; Q; ver la puntería; la cámara; recargar la pestaña y seguir siendo Abe) y
`logs/check-abe-tutorial.mjs`.

## Hecho: cuando no se pueden conectar (6/10/2026)

Leandro probó con un amigo, los dos en PC y en casas distintas, él de Abe: a Abe le decía
«Reconectando…» y al que jugaba nunca le apareció que había entrado. Lo que encontré:

- **Un error mío**: la reconexión sola del 5/10 corría desde que se abría la página. Si la primera
  conexión tardaba más de 12 s, la cortaba y volvía a entrar, una y otra vez. Y Trystero, del lado del que
  juega, espera 23 s la respuesta de un intento: volver a entrar antes chocaba con el anterior. Ahora solo
  se reconecta si ya había estado conectado, y recién a los 30 s sin noticias. El lugar de Abe lo espera
  60 s (antes 30).
- **Relays**: Trystero usa 5 relays de Nostr, elegidos de su lista según el appId (los dos lados, los
  mismos). A nuestra sala le tocaban 2 caídos, los de los errores de la consola (relay.mostr.pub y
  koru.bitcointxoko.org). Ahora usa 8, que deja 6 andando (`RELAYS` en net/link.ts).
- **La conexión directa**: después de encontrarse por los relays, los datos van directo entre los dos
  navegadores (WebRTC). Algunas redes no lo dejan: ciertos routers, y el celular con datos (CGNAT). Para
  eso hace falta un **servidor TURN**, que pasa los datos de uno al otro. Trystero avisa cuando pasa
  («could not connect to peer … after exchanging SDP»): ahora lo escuchamos, y lo ven los dos. El que
  mira lee «Encontré la partida, pero sus redes no dejan conectarse directo…», y al que juega le sale
  «Alguien quiso entrar, pero sus redes no dejan conectarse directo».
- **No hay TURN gratis sin cuenta**: probado el 6/10, openrelay.metered.ca rechaza las credenciales
  públicas de siempre («400 allocate error») y staticauth.openrelay.metered.ca ya no existe. Queda todo
  listo para enchufar uno (hecho el 9/10: ver «El TURN», más abajo).
- `?soloturn` en la URL obliga a pasar por el TURN: sirve para probarlo (sin TURN, no conecta nunca).
- La prueba es `logs/check-conexion.mjs`: dos navegadores, relays de verdad. Se encuentran en unos 2 s,
  y con `?soloturn` sin TURN salen los dos avisos y no entra en el bucle de reconexión.

## Hecho: la marca, nadie espera a Abe, el que llega tarde y otra partida juntos (6/10/2026)

Pedidos de Leandro después de jugar con un amigo, él de Abe:

- **La chispa ahora marca** (en pantalla se llama «Marca»). Ya no clava medio segundo: marca a los que
  agarra durante 1 s, con un anillo lila que late a sus pies y se achica a medida que se acaba. El próximo
  golpe del caballero que le entra a un marcado (cualquier pelota, también las de habilidad; el fuego y el
  rayo no) **detona la marca**: pega 1 más, estalla en lila y la marca se gasta. Al jefe también. Cae a los
  0.15 s (antes 0.25). Los números están en `ABE_BOLT` (coop/spells), panel B, tabla «abe marca».
  - **Frenético o táctico**: Leandro dudaba. Quedó frenético, con 1 s: Abe mira la línea del caballero y
    marca justo antes de que llegue la pelota. Con el driver, mientras el caballero carga (Abe ve la
    puntería); con los globos, donde va a caer mientras la pelota vuela. Las cuentas: Abe ve todo unos
    0.2 s tarde y su toque tarda otro tanto en llegar, más la caída. Si marca apenas ve al caballero cargar,
    la marca está viva de los 0.35 s a los 1.35 s, y un driver soltado en el rojo (0.8 s) llega a los 1.05
    s. Para algo más tranquilo, de ir marcando y que el caballero elija, alcanza con alargar `seconds`.
- **Nadie espera a Abe.** Ni el arranque de la partida ni las oleadas esperan a que elija su hechizo:
  lo que no elige le queda guardado (el botón «✨ N hechizos nuevos») para cuando quiera.
- **El que llega tarde arma sus hechizos de una.** Antes repasaba todos desde el nivel 1, uno por oleada.
  Ahora, si todavía no eligió ninguno, le ofrecen directamente los niveles que tendría si hubiera estado
  desde el principio (`catchUpLevels`): al final de la partida, dos de nivel 3 y dos de nivel 2. Son
  cuatro elecciones como mucho, de mayor a menor nivel, sin repetir hechizo. Lo que gane después sigue
  como siempre.
- **Otra partida, juntos.** Al reiniciar con R con alguien mirando, a Abe se le avisa («El caballero
  empieza otra partida…»), la partida nueva arranca sola (sin la pantalla de inicio: nadie se queda
  esperando un click) y Abe sigue siendo Abe aunque otro vuelva a entrar primero (queda guardado quién era
  mientras se recarga). El sonido del caballero se prende con su primer click o tecla: el navegador no deja
  antes. Abe arranca de cero en la partida nueva, eligiendo su primer hechizo.

Probado con `logs/check-marca.mjs` (marca a los de adentro y no al de al lado; el golpe la detona y pega 2
en vez de 1; el fuego no; se va sola al segundo; el que llega al final arma 3, 3, 2, 2) y
`logs/check-abe-otra.mjs` (dos pestañas: la oleada arranca sin que Abe elija; R, el aviso, la partida que
arranca sola y Abe que vuelve como Abe).

## Hecho: la versión de Abe (7/10/2026)

Para el amigo que no tiene el juego (ver [monetizacion.md](monetizacion.md), «Juego cruzado»): una
compilación aparte (`GK_EDITION=abe`, en `/GolfKnight/abe/`; desde el 8/10 en `/GolfKnight/abe/p<N>/`, una
por protocolo: ver `NET_PROTOCOL` en `src/net/snapshot.ts`) que es siempre el que mira. Con
`?mirar=CÓDIGO` entra directo; sin código, pide el código de la sala o el enlace pegado entero. No puede
arrancar una partida: en `main.ts`, lo del que juega (`playFrame`, los ganchos del tiro en `makePlayer`,
`startGame`, transmitir, las cartas) queda detrás de `ABE_ONLY` y no se compila. El teclado es el de
Abe (`abeKeys`: 1 a 4 y Q W E R para los hechizos, las flechas para la cámara).

Probado con `logs/check-versiones.mjs`: un caballero con la completa y un Abe con la de Abe, en dos
pestañas; entra como Abe, ve la misma oleada, y su marca sale en la partida del caballero.

## Hecho: el TURN (9/10/2026)

Leandro pasó la consola de un intento de entrar como Abe: se encontraron por los relays, pero la conexión directa no
salió («could not connect to peer … after exchanging SDP»; ver «Cuando no se pueden conectar», del 6/10).
Ahora hay un **servidor TURN**: el de Metered, con la cuenta gratis de Leandro (metered.ca, 20 GB por
mes, sin tarjeta: si se acaba, deja de andar, no cobra). Cuando la conexión directa no sale, los datos pasan
por él; cuando sale, no lo usa.

- Las credenciales son fijas y van en `TURN`, en net/link.ts: quedan a la vista en la página, y Leandro
  eligió tenerlas en el código. En el peor caso alguien gasta la cuota del mes; se cambian desde el panel
  de Metered (TURN Server → la credencial).
- Por el puerto 80 y el 443, por UDP y por TCP (y TLS por el 443), para las redes que solo dejan la web.
  En general alcanza con que uno de los dos lo tenga: una app de Windows vieja, sin TURN, debería
  conectar con un Abe nuevo.
- Las fotos son unos KB, 15 por segundo: una partida por el TURN gastaría del orden de 100 a 250 MB por
  hora (estimado, sin medir). Los 20 GB darían para unas 100 horas por mes de partidas que no puedan ir directo.
- Probado con `logs/check-conexion.mjs`: con `?soloturn` (sin conexión directa, todo por el TURN) se
  encuentran en 3 s y las fotos siguen llegando.
