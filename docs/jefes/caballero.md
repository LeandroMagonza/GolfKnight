# Caballero negro: el golfista rival

**La habilidad que pide: el timing de la barra, leyéndole la carga al rival.**

Los chamanes goblin hicieron su propio hechizo, pidieron «un gran golfista» y les salió un **reflejo
oscuro del golfista**: el mismo caballero, con la armadura casi negra, la tela violeta y los ojos que
brillan. Aparece en un círculo oscuro a mitad de cancha (cartel: «¡Un reflejo oscuro! — Los chamanes
pidieron "un gran golfista"») y se planta en **su propia fila de cinco puestos, a 28 m de la tuya** (z 37,
la banda media: el driver le pega 1 / 2 / 3). A 35 m quedaba pegado al borde de arriba de la pantalla y su
arco no se veía.

Código: `src/game/bosses/caballero/` (`fight.ts` la pelea, `arc.ts` su arco, `look.ts` el modelo, la fila y
las pelotas, `index.ts` las versiones). Se prueba con `?ola=10&jefe=caballero.<versión>`.

## Qué hace (la base, `caballero.puerta`)

- **Le pega con tu misma barra.** Va a un puesto con pelota, se acomoda (medio segundo: aparece el arco
  arriba de su cabeza con la aguja en el borde, el aviso) y carga. **El arco es el tuyo**: verde, amarillo
  y rojo, con lo que le saca a la puerta escrito en cada tramo (**1, 2 y 3**), y la aguja que sube por la
  izquierda, pasa por arriba y baja por la derecha, como un péndulo. El palo sube y baja con la aguja,
  como el tuyo (el clip Golf Drive posado según la barra), con su palo en la mano y el brillo violeta.
- **El arco va en la página, como el tuyo** (no en el mundo): siempre mide 96 píxeles (el tuyo, 112), con
  un brillo violeta que dice que es el de él, y rojo cuando la aguja está en el rojo. Va sobre su cabeza;
  si queda muy arriba, se queda justo debajo de la barra del juego. A 28 m, un arco del mundo medía 40
  píxeles: no se leía.
- **Su barra es más lenta que la tuya** para que se la pueda leer y llegar a cortarla: el rojo abre a los
  1.57 s (el tuyo a los 0.82). Se apura con las fases y con el tiempo (ver abajo).
- **Cómo suelta** (lo elige al empezar cada carga): en el rojo de la primera pasada (3), en el amarillo
  subiendo (2: el que te agarra si esperabas al rojo), dando la vuelta (pasa el rojo, baja por la derecha
  y suelta en el rojo de la segunda pasada: 3, pero tarda) o, desde la segunda fase, un toquecito en el
  verde (1).
- **Si le llega un pelotazo mientras se acomoda o carga, le cortás el swing**: el palo baja apurado,
  pifia (la pelota rueda dos metros y se deshace), «¡Le cortaste el swing!», queda aturdido 1.1 s y esa
  pelota se pierde. Ese golpe le pega **1 de más**. Una vez que soltó, ya es tarde: no gastes el tiro.
  **El silencio también le corta el swing** (y no puede cargar mientras dura), y **el frío le frena la
  barra** al 60 %: las cartas ayudan, no hacen falta.
- **Su pelota** vuela alta por encima de tu línea y cae en la puerta (el piso lo marca): le saca lo que
  decía el tramo donde soltó.
- **Las pelotas se las traen caddies goblin** corriendo desde el fondo con la pelota arriba de la cabeza,
  hasta un puesto libre de su fila; la dejan y se vuelven. Tiene a lo sumo **3** (en la fila más las que
  vienen). **Matar al caddie antes de que llegue lo deja sin esa pelota**; sin pelotas se queda mirándote
  y a los 4.5 s **conjura una él mismo** (un destello violeta en un puesto): matar caddies lo frena, no lo
  apaga. Empieza con 2.
- **Avisos**: la primera vez que se acomoda, «¡Pegale mientras carga y le cortás el swing!»; la primera
  vez que se queda sin pelotas, «¡Sin pelotas! Los caddies le traen más». No lleva la barra grande de
  jefe (`BossBar`): justo ahí, arriba al medio, es donde está él, y le tapaba el arco. Su vida va en su
  cartelito, como la de cualquiera.

### Cómo se le gana

Atendés la escolta y lo mirás de reojo. Cuando se acomoda frente a una pelota, empezás a cargar; el
driver le llega en menos de medio segundo. Tu pelota tiene que llegar **antes de que suelte**: si
reaccionás al aviso, un golpe 2 llega siempre antes del rojo, y un golpe 3 justo (en la primera fase). El
que suelta en el amarillo te gana si esperaste al 3. Y entre carga y carga, a los caddies: un driver que
pasa por la fila de un caddie que llega le saca la pelota.

### Lo que sube solo

| Fase | Vida | Su barra (el rojo abre a) | Caddie cada | Caddies a la vez | Cómo suelta |
| --- | --- | --- | --- | --- | --- |
| 1 | 100-66 % | 1.57 s | 5.5 s | 2 | rojo 60 %, amarillo 30 %, vuelta 10 % |
| 2 | 66-33 % | 1.35 s | 4.6 s | 2 | rojo 45, amarillo 30, vuelta 10, verde 15 |
| 3 | 33-0 % | 1.16 s | 3.8 s | 3 | rojo 40, amarillo 30, vuelta 10, verde 20 |

Además la barra se apura un 0.15 % por segundo de pelea (hasta un 18 %) y un 1.2 % por nivel de
dificultad.

## Las versiones

| Id | Qué cambia |
| --- | --- |
| `caballero.puerta` | La base (arriba). |
| `caballero.puesto` | **Te tira a vos, no a la puerta.** Mientras carga, una mira roja en tu puesto; al soltar queda quieta y su pelota cae ahí: 1 de daño si seguís adentro (radio 1.7 m: correrse un puesto alcanza; correrse con la pelota no). El flojo es un globo que tarda 1.45 s, el 2 tarda 1.1 y **el rojo, una línea de 0.8 s**: no da para ver y moverse, hay que leerle la aguja y salir justo cuando suelta (si te vas antes, te vuelve a apuntar). O cortarlo. |
| `caballero.fuerte` | Solo le corta el swing un **golpe 2 o 3** («¡Aguantó! Hace falta un golpe 2»): no alcanza con un toquecito apurado, hay que ganarle el duelo de barras. |
| `caballero.atajable` | Su pelota va **rasante y lenta** a la puerta (9 / 11.5 / 14 m/s, 3 a 5 s), con su carril marcado en el piso: es un enemigo de 1 de vida y se la puede bajar de un pelotazo. Si te pasa por encima te saca 1 (y se pierde: tapar con el cuerpo cuesta una vida y salva la puerta). |
| `caballero.devuelve` | **En guardia te devuelve la pelota**: si le pegás cuando no está cargando (y tiene pelota a mano), no le entra y te la manda a tu puesto (marca roja, 1.25 s, 1 de daño). Un anillo violeta a sus pies avisa cuándo está en guardia. Sin pelotas o silenciado no devuelve: dejarlo sin pelotas lo abre. |

## Los números (todos arriba de `fight.ts`)

- Fila: `ROW_Z` 37 (28 m de la tuya), `ROW_XS` cinco puestos de -8 a 8, `MAX_BALLS` 3, `START_BALLS` 2,
  `CONJURE` 4.5 s.
- Su arco: `ARC_PX` 96 píxeles (`arc.ts`), `ARC_ABOVE` 1 m sobre la cabeza.
- Él: `KNIGHT_HEIGHT` 2.1 m, vida `HP_BASE` 50 + `HP_PER_LEVEL` 2 por nivel + la del talento.
- Su barra: `BAR` 1.15 / 0.42 / 0.24 s; `ADDRESS` 0.5 s de aviso; `PHASES` (ritmo, caddies, cómo suelta);
  `TIME_PRESS`, `PACE_PER_LEVEL`.
- Cortarlo: `CUT_BONUS` 1, `STAGGER` 1.1 s, `CHILL_PACE` 0.6.
- Sus tiros: `FLIGHT_GATE` 1.9 / 1.6 / 1.3 s; `FLIGHT_PLAYER` 1.45 / 1.1 / 0.8 s, `HIT_RADIUS` 1.7 m;
  `ROLL_SPEED` 9 / 11.5 / 14 m/s; `PARRY` 1.25 s.
- Caddies: `CADDIE.speed` 4.3 m/s (de 68 a 38 m, unos 7 s; a tiro del driver los últimos 5).
- La escolta (`index.ts`): la de siempre sin el gólem, con 1.5 veces los goblins y goblinas y una cada
  2.6 s (unos 60 s de escolta).

## El bot

(Pendiente: las tandas.)

## Lo que falta o no anda

(Pendiente.)
