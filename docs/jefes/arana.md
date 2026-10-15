# Araña reina (14/10)

**Qué pone a prueba: el espacio en la línea.** Los puestos dejan de ser todos iguales: a uno le cae una
telaraña, otro queda tomado, las pelotas quedan del otro lado. Y mientras tanto pone huevos que, si no se
rompen a tiempo, largan arañitas que corren a la puerta.

Código: `src/game/bosses/arana/` (`fight.ts` la pelea, `looks.ts` lo hecho por código, `index.ts` las
versiones). Se prueba con `?ola=10&jefe=arana.costados` (o `.adelante`, `.traba`, `.reina`), o desde el
panel B > Pruebas > Jefes.

## Qué hace (todas las versiones)

- **Entra** caminando desde el fondo hasta unos 42 m y de ahí **anda de costado**: corridas rápidas de 5 a
  12 m (5.5 m/s) con pausas de 1 a 1.6 s. Nunca va a la puerta: se queda en una franja a media cancha que
  se acerca a medida que se enoja (32-44 m, después 27-41, después 22-38). **Cuando frena es cuando más
  fácil se le pega**, y es cuando hace sus cosas.
- **La telaraña.** Frena, mira a tu puesto y brilla blanca: en el piso de tu puesto aparece una marca
  blanca. A los 0.8 s escupe un ovillo atado a un hilo que vuela 1.1 s. **Casi 2 s de aviso**, y correrse
  un puesto lleva 0.4. Si cuando cae seguís ahí (a menos de 1.5 m), **quedás pegado 2.5 s**: no cambiás de
  puesto (podés pegar si tenés pelota a los pies). Se ve un capullo de hilos alrededor del golfista. No
  saca vida: lo que cuesta es el tiempo (las pelotas no caen donde estás), y que te pase por encima una
  arañita. Si te corriste, la telaraña **queda en el puesto** (ver las versiones).
  - En la segunda y tercera fase escupe a más de un puesto a la vez: el tuyo y el de al lado adonde irías
    (el que tiene pelota), o los dos de al lado. Hay que leer adónde ir.
- **Los huevos.** Cada 9 s (8 y 7 en las otras fases) pone 2 o 3 huevos. Laten y brillan amarillo, cada
  vez más rápido, y al final tiemblan. Nacen a los 8 s (7 y 6), y de cada uno salen 2 arañitas (3 en las
  otras fases): 1 de vida, rápidas (4.6 m/s), van derecho a la puerta y te atropellan si pasan por tu
  puesto, como un goblin. Cada huevo tiene 2 de vida. El hielo los demora (con frío nacen a la mitad de
  velocidad, congelados no avanzan).
- **Las fases**: con 2/3 de la vida se enfurece y con 1/3 se desespera. En cada cambio se va corriendo al
  fondo (50 m) y pone una nidada con un huevo más. **La presión sube sola**: cada 40 s de pelea todo lo
  que espera se acorta un 10 % (hasta 4 veces).
- **Silenciada** no escupe ni pone (lo que estaba por hacer se cancela). El hielo la frena. El viento, la
  bandera y el hoyo no le hacen nada (es el jefe).
- **Cuando muere** se rompen sus huevos y se deshacen las telarañas; las arañitas que ya nacieron siguen.

### La telaraña que queda en un puesto

Es un enemigo de verdad, con 2 de vida, un poco adelante de la pelota del puesto. **Se rompe de un
pelotazo de costado** desde el puesto de al lado (apuntando casi de costado: el putter la rompe con
cualquier golpe, el driver y el hierro con el 2), **con fuego** (se quema en el acto), **con el palazo o el
viento** (cualquier empujón fuerte la rompe), o **se deshace sola**. Una marca violeta en el piso dice
qué puesto está tomado, y titila cuando se está por deshacer. **El palazo también te zafa** si estás
pegado.

## Las versiones

| id | Huevos | Telaraña en el puesto | Lo distinto |
|---|---|---|---|
| `arana.costados` | a los costados | trampa | la base: la idea de Leandro tal cual |
| `arana.adelante` | tirados hacia la línea | trampa | los huevos caen cerca: hay que romperlos con el putter |
| `arana.traba` | a los costados | pared | la línea se parte en dos |
| `arana.reina` | los dos | pared | todo junto, y tejedoras |

- **Huevos a los costados** (`costados`, `traba`): se planta, la panza late verde y los huevos salen
  deslizándose a sus flancos, de a pares (a 2.8 m de cada lado, y el tercero a 6). Quedan en fila, a su
  altura: **un wedge entre los dos agarra a los dos** (y a ella). Nacen lejos: las arañitas tardan unos
  6 s en llegar a la línea.
- **Huevos adelante** (`adelante`): se para de manos y los tira en globo; donde van a caer se marca
  amarillo antes de que salgan. Caen entre 15 y 24 m (6 a 15 m de la línea): **al alcance del putter**,
  pero hay que estar en el puesto justo. Tardan más en nacer (9.5 s, 8.5 y 7.5) porque de ahí las
  arañitas llegan enseguida.
- **Telaraña trampa** (`costados`, `adelante`): la que cae en un puesto vacío queda 14 s. **Si pasás por
  ese puesto quedás pegado 1.5 s** y la trampa se gasta. Se puede pasar igual (a buscar una pelota, por
  ejemplo), pagando el pegote.
- **Telaraña pared** (`traba`, `reina`): la que cae en un puesto vacío (o la que te agarró, cuando te vas)
  queda 10 s y **no se cruza**: la línea queda partida, y las pelotas que caigan del otro lado no las
  alcanzás. La pared se traga la pelota que le cae encima. Para que nunca te deje sin pelotas: **como
  mucho 2 paredes a la vez, y nunca una que te deje con menos de 2 puestos con pelota de tu lado** (esa
  se deshace al caer).
- **Tejedoras** (`reina`): una de cada 3 arañitas es más grande y clarita (2 de vida). Corre como las
  otras, pero al llegar a los 21 m frena, se prepara 0.7 s y te escupe una telaraña a tu puesto (vuela
  0.9 s). Si la matás antes de que escupa, no sale.

## Cómo se le gana

1. **Moverse con la marca blanca.** Ni bien aparece, terminar el tiro rápido (o cancelarlo) y correrse.
   Mejor: no quedarse cargando en el puesto al que mira.
2. **Pegarle cuando frena.** Corriendo de costado es difícil; parada (escupiendo o poniendo) es un blanco
   de 4 m. El driver de lejos le saca 3 o 4.
3. **Romper los huevos antes de que nazcan**, mejor de a dos con un globo. Los de adelante, con el putter.
4. **Elegir dónde dejar que caiga la telaraña.** Si te corrés hacia el medio, la trampa (o la pared) queda
   en la punta; si te corrés hacia la punta, te parte la línea al medio.
5. Romper la telaraña que molesta con un putter de costado, quemarla, o esperarla.

## Los números para tocar (arriba de `fight.ts`)

- La reina: `QUEEN_HP` (70, más la vida del talento), `SKITTER_SPEED`, `SKITTER`, `PAUSE`, `BAND`,
  `RETREAT_Z`, `PHASE_AT`, `RAGE_EVERY` / `RAGE_STEP` / `RAGE_MAX`.
- La telaraña: `WEB_EVERY` (6.5 / 5.5 / 4.5 s), `WEB_COUNT` (cuántos puestos por escupida), `WEB_WINDUP`
  y `WEB_FLIGHT` (el aviso), `WEB_CATCH`, `PIN_HIT` (2.5 s), `PIN_TRAP` (1.5 s), `WEB_LIFE` (14 la trampa,
  10 la pared), `WEB_HP` (2), `MAX_WALLS`, `MIN_BALL_SPOTS`.
- Los huevos: `EGG_EVERY` (9 / 8 / 7 s), `EGG_COUNT` (2 / 3 / 3), `HATCH`, `EGG_HP` (2), `BROOD` (arañitas
  por huevo: 2 / 3 / 3), `SIDE_REACH`, `LOB_Z`, `MAX_EGGS` (9 a la vez).
- Las arañitas: `BABY` y `WEAVER`.

## Cómo le fue al bot

(pendiente)

## Lo que falta o no anda del todo

(pendiente)
