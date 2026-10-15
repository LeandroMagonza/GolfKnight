# Jefes con música (15/10)

La idea es de Leandro: «se me ocurrió un boss que tuviera música, y que hiciera que tus tiros tiren pifia si
no los pegás con el beat de la canción del jefe, que tendría que ir aumentando de velocidad», y después: «yo
me estaba esperando algo al ritmo de la música, no que tenga un timer el enemigo, yo decía que tenga una
canción particular, incluso eventualmente podemos poner un guitarrista de metal, que va tocando y tirándote
poderes, y solo podés pegarle si soltás la pelota en un beat».

Pone a prueba el **ritmo**: soltar en el beat. Ningún otro jefe pide eso.

## La regla

- El jefe **pone su propia canción** mientras dura la pelea (con el fundido de siempre) y, cuando muere,
  vuelve la del lugar.
- Desde que sube al escenario y empieza a tocar, **todo tiro soltado fuera del beat sale pifia**: contra él
  y contra la escolta (corrección de Leandro: «todos tus tiros tienen que salir en el beat, no solo los que
  van contra el jefe»). Es la pifia de siempre: el palo pasa, la pelota se queda en el puesto, suena igual,
  se pierden el eco y la racha, y el cartelito dice «¡Fuera de ritmo!». Las habilidades (Q W E R) no tienen
  ritmo: entran igual.
- **El tempo sube solo** (Leandro: «pifiar no acelera el tempo»): tres fases, por la vida que le queda (2/3
  y 1/3) o por el tiempo tocando (55 s y 105 s), lo que llegue antes. El cambio entra al empezar el compás
  siguiente, con un crash y el cartel «¡Más rápido!».
- **La ventana**: ±150 ms los dos primeros compases, y después ±120, ±105 y ±90 ms por fase (el tambor:
  ±140, ±120, ±105).
- Mientras sube al escenario («afinando…») no le entra nada: la pelea es al ritmo.

## Cómo se lee

- **El anillo a tus pies**: un aro dorado fijo y otro blanco que se cierra sobre él y llega justo en el beat
  (como en los juegos de ritmo). Mientras dura la ventana, el aro fijo se prende dorado claro. Con cada beat
  sale una onda; al soltar, un destello dorado (a tiempo) o rojo (pifia). Se lee desde la cámara alta.
- **El sonido**: la canción marca cada negra con algo que no se confunde (la campana del ride en el metal;
  el taiko y el ka en el tambor), y el primer compás es una cuenta (palillos / ka).
- **Él**: rasguea (o le pega al tambor) en cada beat: el brazo sube y baja de golpe justo en el beat. Los
  amplificadores del escenario laten con cada beat.
- **La barra de arriba**: la vida, el tempo (♩ 130) y las pifias que lleva hacia el castigo (●●○).

## Lo que tira (todo al ritmo, todo esquivable o cortable)

- **El acorde** (el pisotón en el tambor): al empezar un compás marca tu puesto con un disco rojo y un aro que
  se cierra de a un beat (4, 3, 2, 1) y cae en el próximo «uno» (un rayo): 1 de vida si seguís ahí. Desde la
  segunda fase marca también uno de al lado. Cada 4 compases.
- **Las notas malditas** (los tamborcitos): enemigos de verdad que salen de él y saltan de a un beat hacia la
  puerta, por una franja en el piso, en 12 saltos (7 s a 100, 4.5 s a 160). Tienen 1 de vida: se les pega
  (en el beat). Si llegan, 1 de puerta. Una por tanda (dos en la última fase), cada 4 compases.
- **El castigo por pifiar** (Leandro: «puede ser que el jefe le pegue a la puerta»): cada 3 pifias le da pie
  al **acople** (al **redoble** en el tambor): al empezar el compás siguiente, una franja ancha hasta la
  puerta y los amplificadores en rojo, 4 beats de aviso, y le saca 2 a la puerta. No es derrota inmediata y
  se ve venir.
- **El contrajuego**: un golpe perfecto (golpe 3), en el beat, le corta lo que esté cargando (los acordes y
  el acople) y lo deja un compás sin tocar («¡Le cortaste el solo!»).
- Cada 8 compases se cambia de lugar en el escenario (a media cancha, z 28: tres lugares), sin dejar de tocar.

## Las versiones

| Id | Qué tiene de distinto |
|---|---|
| `bardo.metal` | La principal. El Bardo del metal: un esqueleto (el soldado 02 de dungeon.glb, que no usa ningún otro enemigo) con una Flying V roja, ojos rojos y dos torres de amplificadores. Metal a 100 → 130 → 160. 50 de vida (+2 por nivel) |
| `bardo.tambor` | El Ogro tamborilero: el ogro con un tambor de guerra a la panza, tambores de guerra a 90 → 115 → 140 (el beat más marcado: taiko y ka en cada negra), ventana más generosa. La versión fácil |

## Las canciones (`src/audio/music/songs/bardo.ts`)

- **`bardo.metal`**: mi menor. Dos guitarras rítmicas distorsionadas (sierras por un pasabajos, la distorsión
  y un «gabinete» de filtros; una a cada lado, apenas desfasadas), acordes de quinta y el chugg de la mano
  apagada; bajo, bombo con parche y mazo, caja con cuerpo y bordonero, la campana del ride en cada negra y una
  sala corta. Fase 0: groove pesado; fase 1: galope y entra la solista; fase 2: thrash con doble bombo (las
  negras siguen marcadas) y la solista a dos voces. Nada de ondas cuadradas.
- **`bardo.tambor`**: re menor. Taiko grande y ka en cada negra, toms y shime que se van llenando por fase,
  un colchón grave, el bajo y el cuerno de guerra cada 4 compases (y al cambiar de fase).
- **El nivel** (render de 30 s, antes del último ajuste): el metal, pico −11.5 dB y RMS −27.5 dB; el tambor,
  pico −7.9 y RMS −25.8. Después se subieron las guitarras 1.5 dB y se bajaron el bombo y la caja (metal), y
  el tambor bajó 3 dB entero y subió el ka (que casi no se oía arriba de 2 kHz). No se volvió a medir.
- Se escuchan en musica.html (o el panel B, pestaña Sonido); solas suben de fase cada 8 compases.

## Cómo está hecho (para quien programa)

- **Los enganches en el juego** (chicos y aditivos): `BossFight.onRelease(info) → { pifia, text }` (types.ts):
  main lo consulta al soltar (en `onRelease` del golfista) y, si dice pifia, `duffs` devuelve true y sale la
  pifia de siempre con el cartelito del jefe. `BossBot.releaseWait()`: cuántos segundos esperar para soltar; el
  bot clava el golpe (la barra espaciadora) y suelta en el beat. `MusicPlayer.force(id)` pone la canción del
  jefe por encima de lo elegido para el lugar, y `beatOf(id)` da su grilla.
- **La grilla** (`src/audio/music/beat.ts`, con su test): la canción marca cada negra que agenda (en la hora
  del audio, la misma con la que agenda las notas) y toma el tempo y la fase pedidos al empezar el compás.
  `offset(t)` dice cuánto le erró `t` al beat más cercano; `prev`/`next` estiman los que no se marcaron todavía.
- **La sincronización** (`bardo/pulso.ts`): con audio, «ahora» es la hora del audio menos la latencia de
  salida (`outputLatency + baseLatency`): la ventana se mide contra lo que se escucha, aunque el juego se trabe
  o esté en la congelada del golpe perfecto. En pausa el transporte se pausa con el juego. Sin audio (no
  arrancó), con `?liviano` (el bot a x8: el audio iría a otro ritmo que el juego) o mientras carga la canción,
  usa una grilla propia con el reloj del juego, al mismo tempo pedido. Al cambiar de reloj sigue desde el beat
  de ahora, sin repetir.
- **Archivos**: `fight.ts` (la pelea y los dos estilos, `ESTILOS`), `pulso.ts` (los dos relojes y el anillo),
  `look.ts` (la Flying V, el tambor de guerra, los amplificadores, las notas, los ojos), `index.ts`.
- **El registro** (`log`): `fuente` (audio o juego), `vida` (%), `fase`, `bpm`, `compases`, `enBeat`,
  `pifias` (`tempranas`, `tardias`), `offMedioMs` (cuánto le erra en promedio a los que entran), `acordes`,
  `acordesPegaron`, `cortes`, `notas`, `notasBajadas`, `notasPuerta`, `acoples`, `tocando` (s).

## Cómo le fue al bot (15/10)

El bot suelta siempre en el beat (`releaseWait`), así que nunca pifia: sirve para ver el resto de la pelea,
no la dificultad del ritmo, que es lo que le va a costar a una persona.

- **Primera tanda** (`bardo.metal`, 2 partidas): perdió las dos por la puerta a los ~70 s. Las notas le
  ganaban: 2 por tanda y dos tandas cada 4 compases en la última fase, saltando muy alto (la pelota no les
  pegaba). Además le pegaba al jefe mientras subía al escenario, sin la regla, y lo pasaba de fase enseguida.
  Ahora: una nota por tanda (dos en la última fase), una tanda cada 4 compases, saltos bajos (0.8 m) y en 12
  saltos; y no le entra nada hasta que empieza a tocar.
- **Segunda tanda** (compilada, 2 partidas por versión): ganó las 4. `bardo.metal`: peleas de 62 y 79 s
  (50 y 65 s tocando), 0 y 4 de puerta perdida (3 notas llegaron en una), 23 y 32 tiros en el beat, ningún
  acorde le pegó (esquiva con `danger`), 1 corte por partida. `bardo.tambor`: 63 y 78 s, sin perder puerta.
  Llegó a la última fase (160 / 140) en todas.
- **Con audio** (las fotos del tambor, con el audio prendido a mano): la pelea usó el reloj de la canción
  (`fuente: audio`, 71 beats) y el bot soltó 16 de 16 en el beat (a 50 ms en promedio): la grilla y el reloj
  del audio andan juntos.
- Ojo: en esas tandas el corte usaba `stunFor`, y a las partes de jefe el juego no les descuenta el aturdido
  (ver `docs/jefes/ritmo.md`): después del primer corte quedaba «aturdido» para siempre (no se veía rasguear;
  si alguna carta le pega más al aturdido, le entraba más). Se sacó; no se volvió a correr.

## Para probar

- Panel B > Pruebas > Jefes: «El Bardo del metal» y «El Ogro tamborilero» (salen solos del registro).
- `?ola=10&jefe=bardo.metal` o `?ola=10&jefe=bardo.tambor` (con `&bot=humano`, lo juega el bot).
- Las canciones solas: musica.html.
- Fotos: `logs/jefe-bardo.metal-*.png` y `logs/jefe-bardo.tambor-*.png`.

## Pendiente / ideas

- Medir de nuevo el nivel de las dos canciones después del ajuste.
- Probarlo con una persona: cuánto pifia, si el castigo (3 pifias → 2 de puerta) es mucho o poco, y si la
  ventana de ±90 ms a 160 es justa con el retraso de cada compu (los parlantes Bluetooth suman latencia que el
  navegador no siempre informa: si hace falta, un ajuste de latencia en el panel).
- Una variante donde el beat **suma** en vez de restar (el tiro en el beat pega +1) para los escenarios
  anteriores.
