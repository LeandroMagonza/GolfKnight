# Rey goblin ladrón (`rey`)

**Qué pone a prueba: las pelotas.** Cuál usar primero (la que vienen a buscar), cuándo moverse, y el putter
de cerca, que es el que mejor defiende la línea.

Código: `src/game/bosses/rey/index.ts`. Probar: `?ola=10&jefe=rey.lanza` (o el panel B > Pruebas > Jefes).

## Qué hace

El rey se queda al fondo (a 38 m de la puerta, 29 de la línea), **parado en un palanquín que cargan cuatro
goblins**. Entra caminando y después va y viene de costado (2.2 m/s desde el 15/10), y se queda un rato en
cada punta (0.6 a 1.6 s). **Arriba del palanquín es inmune** (en todas las versiones desde el 15/10): hay que
bajarlo. Arenga a los suyos (el clip *Rallying*) con una corona dorada que se ve de lejos.

**Los pícaros** (goblins violetas con una bolsa en la espalda) salen de atrás del palanquín y no van a la
puerta: **corren a tus puestos a robarte las pelotas**.

- Cada uno elige la pelota más cercana que no tenga otro pícaro encima. **Una franja violeta en el piso** va
  del pícaro a esa pelota, y **un anillo violeta late alrededor de la pelota**: se ve cuál viene a buscar.
- **También van por la tuya**, la del puesto donde estás, **aunque la estés cargando** (desde el 15/10): la
  franja y el anillo se ponen fucsia, el anillo crece y late más rápido cuando le faltan menos de 9 m. Si
  llega antes de que sueltes, te la saca del palo («¡Te la sacaron del palo!»): perdés el tiro. Si ya
  soltaste (el palo está bajando), la pelota es del tiro y no te la saca. Si la usás antes, se va a otra.
- Sin pelota que robar, espera a 3.5 m de la línea, delante de un puesto, a que los guardias tiren otra.
  Ahí es un blanco fácil del putter.
- Tienen 1 de vida: cualquier golpe los mata. El costo es la pelota y el tiempo que no le pegás al rey.

**Lo que pasa con la pelota robada depende de la versión** (abajo). En las que tiran a tu puesto: el rey la
levanta con los dos brazos (0.75 s) y te la tira en un arco alto (1.4 s, que bajan a 1 s a los 100
s). **La marca roja ya está en el piso desde que la levanta**: 2.15 s en total para correrte un
puesto (radio 1.4 m, los puestos están a 4 m). Si te agarra, te saca 1 y la pelota se pierde. **Si la
esquivás, queda en el puesto donde cayó y es tuya otra vez** (`RETURN_DODGED`). Tira una por vez, con
0.9 s entre una y otra. Solo tira desde arriba: caído no.

**Los cargadores** (orcos, 3 de vida cada uno) son la llave: **con dos menos el palanquín se cae** (con uno
menos ya se ladea, como aviso; en `palanquin` hacen falta tres). También entrando, antes de llegar a su
lugar. El rey salta al piso, adelante del palanquín, y queda tirado por lo menos 9 s: no tira, y **recién ahí
le entra**. Cada
cargador muerto tiene su recambio a los 2 s, que sale 12 m atrás y corre a su lugar; el rey vuelve arriba
cuando están los cuatro y pasaron los 9 s. Matando a los recambios se lo deja más tiempo en el piso.

**La presión sube sola**, con el reloj (`RAMP`, 100 s): un pícaro cada 5 s al principio y cada 2.4 s al
final; de 3 a 6 a la vez; los tiros vuelan más rápido (1.4 s al principio, 1 s al final). **Con el rey por la mitad de la vida se
enoja**: los pícaros salen de a dos y corren un 15 % más.

La escolta es la de siempre de la última oleada, sin el jefe goblin (se confundía con el rey).

## Las versiones

| id | Qué tiene de distinto |
|---|---|
| `rey.lanza` | La de base. El pícaro se lleva la pelota corriendo hasta el rey (la lleva arriba de la cabeza): **si lo matás en el camino, la pelota vuelve volando a su puesto** («¡Recuperada!»). El rey te tira cada pelota que le llega. Inmune arriba; 38 de vida, le entra caído. |
| `rey.puerta` | Igual, pero **cada pelota que le llega la tira a la puerta** (1 de daño, no se esquiva). Lo que se hace es pararlos antes: al que viene y al que vuelve. |
| `rey.gloton` | **El pícaro se come la pelota en el puesto** y el rey te tira una en el acto. No hay segunda oportunidad: o lo parás antes de que llegue, o usás esa pelota primero. |
| `rey.palanquin` | La más dura: **hay que matar tres cargadores** para bajarlo; en el piso le entra una vez y media; 44 de vida. Los pícaros y los tiros, como en `lanza`. (Hasta el 15/10 era la única inmune arriba; ahora lo son todas.) |

## Cómo se le gana

- **Usá primero la pelota que vienen a buscar.** El anillo violeta dice cuál es. Si estás cerca, andá a esa
  y tirá; el pícaro se va a otra y gana tiempo para vos.
- **El putter defiende la línea**: el pícaro que llega o espera está a 1-4 m de los puestos.
- **Al que vuelve con la pelota, el driver**: va derecho hacia el palanquín, en fila con el rey; si lo matás,
  la pelota vuelve.
- **La marca roja: corréte un puesto.** Como después de cada tiro hay que moverse igual, el que tira y se
  corre casi siempre la esquiva. La pelota esquivada queda ahí: es tuya.
- **Cargando, mirá el anillo de tu pelota**: si se pone fucsia, soltá antes de que llegue el pícaro (o
  bajalo con el putter).
- **Arriba no le entra: los cargadores primero.** Se mueven con el palanquín, de costado: hay que apuntarles
  adelante, o esperar a que pare en una punta. Dos tiros fuertes por cargador, y el rey queda 9 s en el piso:
  ahí, todo lo fuerte al rey.

## Los números para tocar

Todos arriba de `rey/index.ts`, con su comentario:

- Pelea: `RAMP` (100 s hasta la presión más alta), `ANGRY_AT` (0.5), `ANGRY_SPEED`.
- Rey: `hp` de cada versión (38, 44 en `palanquin`) más la vida de la dificultad, `guarded` (inmune arriba),
  `downMul` (1, 1.5 en `palanquin`), `HOLD_Z` (38), `PATROL_SPEED` (2.2 m/s), `PATROL_PAUSE`.
- Pícaros: `THIEF_EVERY` (5 → 2.4 s), `THIEF_MAX` (3 → 6), `THIEF_SPEED` (5.6 m/s), `CARRY_SPEED` (4.2),
  `WAIT_Z`, `GRAB_Z`, `MINE_COLOR` (el aviso de que vienen por la tuya).
- Tiro: `THROW_WINDUP` (0.75 s), `THROW_FLIGHT` (1.4 → 1 s), `THROW_GAP` (0.9 s), `THROW_RADIUS` (1.4 m),
  `RETURN_DODGED`, `GATE_DAMAGE`.
- Palanquín: `PORTER_HP` (3), `fallAt` de la versión (`FALL_AT` 2, 1 en `palanquin`), `DOWN_TIME` (9 s),
  `REPLACE_DELAY` (2 s), `REPLACE_FROM` (12 m).

## Cambios del 15/10 (lo que jugó Leandro)

Leandro jugó `lanza` (ganó en 72 s), `puerta` (ganó en 73 s) y `gloton` (perdió a los 50 s). «El rey goblin
lanza fue divertido y gracioso, pero no me pareció muy desafiante.»

- **El bug del palanquín flotando.** «Si matás a los que levantan el carro antes de que el carro llegue a su
  primer destino, los bichos mueren pero el carro avanza flotando sin ellos.» Solo se miraba si se caía
  mientras patrullaba; entrando, no. Ahora se cae también entrando, y cuando vuelve a subir termina de entrar.
- **Inmune arriba, en todas.** «La mecánica de tener un carrito levantado y matar a los que lo levantan no
  tiene un gran sentido si no te hace mucha diferencia que el enemigo se mueva… pero sí le da como fases,
  aunque me parece que al jefe le hago daño aunque esté levantado.» Y: «lo del palanquín suena más
  balanceado». Todas las versiones son ahora como era `palanquin`: arriba no le entra nada («inmune»), bajarlo
  matando a dos cargadores abre la ventana (9 s por lo menos). 38 de vida (60 antes, con el doble caído). Y el
  palanquín va y viene al doble de rápido (2.2 m/s, pausas más cortas), así que a los cargadores hay que
  apuntarles: ahí es donde importa que se mueva. `palanquin` pasó a ser la dura: tres cargadores, una vez y
  media caído, 44 de vida.
- **Los pícaros van por la tuya.** «No sé por qué no intentaban robarme la pelota donde estaba yo; estaría
  bueno que puedan robarla mientras estoy cargando, si no suelto a tiempo.» Ahora sí: la pelota de tu puesto
  es una más, y si llega mientras cargás te la saca del palo y perdés el tiro. Se ve venir: franja y anillo
  fucsia (en vez de violeta), y el anillo late más rápido cuando está cerca. Las dos primeras veces avisa
  con letras. Una vez que soltaste, ya no te la saca.
- **Más exigente en general**: un pícaro cada 5 s (era 6.5) a 2.4 s (era 2.8), de 3 a 6 a la vez (era 2 a 5),
  un 8 % más rápidos, la rampa en 100 s (era 120), los tiros del rey vuelan 1.4 → 1 s (era 1.6 → 1.15) y con
  0.9 s entre uno y otro (era 1.1).

## Cómo le fue al bot

Corridas del 15/10, después de los cambios (una partida cada una, el bot «humano» desde la oleada 10,
`logs/tandas/ogro-rey-15-10.jsonl` y `-b.jsonl`):

| Versión | Resultado | Lo que se ve |
|---|---|---|
| `lanza` | ganó en 85 s, perdiendo 5 de puerta y 2 de vida | 4 caídas, 25 cargadores muertos, 40 pícaros; le sacaron una del palo una vez |
| `palanquin` | a los 103 s le quedaban 14 de 44 (la corrida se cortó por una recarga de la página: otro agente cambió código) | 2 caídas |
| `palanquin` | ganó en 47 s, perdiendo 1 de puerta | 1 sola caída, pero larga: mató 12 cargadores (a los recambios), así que estuvo mucho en el piso |

Antes de los cambios, el bot le ganaba a las cuatro en 50–70 s. Ahora `lanza` tarda más y cuesta puerta.

## Lo que falta o no me convence

- `puerta` y `gloton` no los probé con el bot después de los cambios (mismas reglas que `lanza`, cambia
  adónde va la pelota).
- `palanquin` puede quedar muy corta si se matan los recambios a medida que llegan (el rey sigue en el piso).
  Si pasa, que el recambio llegue antes o que el rey suba con tres cargadores.
- El bot no sabe soltar antes de que llegue el pícaro: lo ayuda que le da más peso al que va por su pelota.
