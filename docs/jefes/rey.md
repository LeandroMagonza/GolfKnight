# Rey goblin ladrón (`rey`)

**Qué pone a prueba: las pelotas.** Cuál usar primero (la que vienen a buscar), cuándo moverse, y el putter
de cerca, que es el que mejor defiende la línea.

Código: `src/game/bosses/rey/index.ts`. Probar: `?ola=10&jefe=rey.lanza` (o el panel B > Pruebas > Jefes).

## Qué hace

El rey se queda al fondo (a 50 m de la puerta, 41 de la línea: la banda larga del driver), **parado en un
palanquín que cargan cuatro goblins**. Entra caminando y después va y viene de costado, despacio, y se
queda un rato en cada punta. Arenga a los suyos (el clip *Rallying*) con una corona dorada que se ve de lejos.

**Los pícaros** (goblins violetas con una bolsa en la espalda) salen de atrás del palanquín y no van a la
puerta: **corren a tus puestos a robarte las pelotas**.

- Cada uno elige la pelota más cercana que no tenga otro pícaro encima. **Una franja violeta en el piso** va
  del pícaro a esa pelota, y **un anillo violeta late alrededor de la pelota**: se ve cuál viene a buscar.
- **Parado en una pelota no te la roban** (como los guardias, que nunca tiran donde estás): si te parás en
  la que viene a buscar, o la usás antes, se va a otra.
- Sin pelota que robar, espera a 3.5 m de la línea, delante de un puesto, a que los guardias tiren otra.
  Ahí es un blanco fácil del putter.
- Tienen 1 de vida: cualquier golpe los mata. El costo es la pelota y el tiempo que no le pegás al rey.

**Lo que pasa con la pelota robada depende de la versión** (abajo). En las que tiran a tu puesto: el rey la
levanta con los dos brazos (0.75 s) y te la tira en un arco alto (1.6 s, que bajan a 1.15 s a los dos
minutos). **La marca roja ya está en el piso desde que la levanta**: 2.35 s en total para correrte un
puesto (radio 1.4 m, los puestos están a 4 m). Si te agarra, te saca 1 y la pelota se pierde. **Si la
esquivás, queda en el puesto donde cayó y es tuya otra vez** (`RETURN_DODGED`). Tira una por vez, con
1.1 s entre una y otra.

**Los cargadores** (orcos, 3 de vida cada uno) también se pueden matar: **con dos menos el palanquín se
cae** (con uno menos ya se ladea, como aviso). El rey salta al piso, adelante del palanquín, y queda tirado
por lo menos 9 s: no tira, y le entra el doble (o recién ahí le entra, en la versión del palanquín). Cada
cargador muerto tiene su recambio a los 2 s, que sale 12 m atrás y corre a su lugar; el rey vuelve arriba
cuando están los cuatro y pasaron los 9 s. Matando a los recambios se lo deja más tiempo en el piso.

**La presión sube sola**, con el reloj (`RAMP`, 120 s): un pícaro cada 6.5 s al principio y cada 2.8 s a
los dos minutos; de 2 a 5 a la vez; los tiros vuelan más rápido. **Con el rey por la mitad de la vida se
enoja**: los pícaros salen de a dos y corren un 15 % más.

La escolta es la de siempre de la última oleada, sin el jefe goblin (se confundía con el rey).

## Las versiones

| id | Qué tiene de distinto |
|---|---|
| `rey.lanza` | La de base. El pícaro se lleva la pelota corriendo hasta el rey (la lleva arriba de la cabeza): **si lo matás en el camino, la pelota vuelve volando a su puesto** («¡Recuperada!»). El rey te tira cada pelota que le llega. Le entra siempre (60 de vida), el doble caído. |
| `rey.puerta` | Igual, pero **cada pelota que le llega la tira a la puerta** (1 de daño, no se esquiva). Lo que se hace es pararlos antes: al que viene y al que vuelve. |
| `rey.gloton` | **El pícaro se come la pelota en el puesto** y el rey te tira una en el acto. No hay segunda oportunidad: o lo parás antes de que llegue, o usás esa pelota primero. |
| `rey.palanquin` | **Arriba del palanquín es inmune** («inmune»): hay que matar dos cargadores para bajarlo. En el piso le entra lo normal; 36 de vida. Los pícaros y los tiros, como en `lanza`. |

## Cómo se le gana

- **Usá primero la pelota que vienen a buscar.** El anillo violeta dice cuál es. Si estás cerca, andá a esa
  y tirá; el pícaro se va a otra y gana tiempo para vos.
- **El putter defiende la línea**: el pícaro que llega o espera está a 1-4 m de los puestos.
- **Al que vuelve con la pelota, el driver**: va derecho hacia el palanquín, en fila con el rey; si lo matás,
  la pelota vuelve.
- **La marca roja: corréte un puesto.** Como después de cada tiro hay que moverse igual, el que tira y se
  corre casi siempre la esquiva. La pelota esquivada queda ahí: es tuya.
- **Al rey, el driver de lejos** (2 / 3 / 4 a +40 m). Con tiempo, los cargadores de adelante: dos tiros
  fuertes por cargador, y el rey queda 9 s en el piso recibiendo el doble.

## Los números para tocar

Todos arriba de `rey/index.ts`, con su comentario:

- Pelea: `RAMP` (120 s hasta la presión más alta), `ANGRY_AT` (0.5), `ANGRY_SPEED`.
- Rey: `hp` de cada versión (60, 36 en `palanquin`) más la vida de la dificultad, `downMul` (2), `HOLD_Z` (50).
- Pícaros: `THIEF_EVERY` (6.5 → 2.8 s), `THIEF_MAX` (2 → 5), `THIEF_SPEED` (5.2 m/s), `CARRY_SPEED` (4.2),
  `WAIT_Z`, `GRAB_Z`.
- Tiro: `THROW_WINDUP` (0.75 s), `THROW_FLIGHT` (1.6 → 1.15 s), `THROW_GAP` (1.1 s), `THROW_RADIUS` (1.4 m),
  `RETURN_DODGED`, `GATE_DAMAGE`.
- Palanquín: `PORTER_HP` (3), `FALL_AT` (2), `DOWN_TIME` (9 s), `REPLACE_DELAY` (2 s), `REPLACE_FROM` (12 m).

## Cómo le fue al bot

(pendiente)

## Lo que falta o no me convence

(pendiente)
