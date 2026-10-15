# Torre de asedio (`torre`)

**Qué pone a prueba: la distancia exacta.** El globo del wedge tiene que caer justo en la plataforma de
arriba, que es chica, y la torre se mueve.

Código: `src/game/bosses/torre/index.ts`. Probar: `?ola=10&jefe=torre.arqueros` (o el panel B > Pruebas >
Jefes).

## Qué hace

Una torre de madera (3 m de ancho, la plataforma a 5 m) entra rodando desde el fondo, en un carril al azar
entre x = -6 y 6, y **avanza despacio hacia la línea, con paradas**: rueda 4 s a 1 m/s y se para 2.5 s. Con
las ruedas sanas tarda unos 80 s en llegar. Lo peligroso es lo que lleva arriba.

**Los arqueros** (goblins con arco, color arena) están en la plataforma, de a cinco como mucho. Cada uno
tira cada 6 s (4.2 a los dos minutos), pero entre todos **no más de una flecha cada 1.7 s (1 s al final), ni
más de dos marcas a la vez**. La flecha va a tu puesto: **la marca roja aparece cuando tensa el arco**
(0.9 s) y la flecha vuela 1 s más; radio 1.3 m, te saca 1. Corréte un puesto. Si matás al que tensa, no
tira.

**Cómo se los mata: el globo justo arriba.** Las pelotas chocan con la torre como con un cilindro. El globo
que entra por arriba (de 4.7 m para arriba) revienta en la plataforma y su área (4.2 / 5 m) barre a todos
los de arriba («¡Justo arriba!»). El que pega en la pared de adelante revienta ahí, y a los de arriba no
les llega. **Los de arriba solo cobran de lo que les llega a la altura**: el driver que pasa por abajo, el
hierro que revienta contra la pared, el globo que cae al lado en el piso, nada.

El globo cae a 55°, así que **para que caiga arriba hay que apuntar un poco detrás de la torre**: el anillo
entre 2 y 6 m detrás del centro (medido, ver abajo). Apuntando al pie de la torre pega en la pared. Para
enseñarlo, el globo que no cae arriba avisa: **«¡Corto! Más lejos»** (contra la pared, o antes),
**«¡Largo! Más cerca»** (detrás), o «¡Desviado!». La línea del tiro ayuda: el final del arco tiene que
bajar sobre los arqueros.

**Suben más**: uno cada 6 s (3.5 s a los dos minutos) por la escalera de atrás (tarda 2.6 s en subir). Con
menos de dos arriba, el siguiente sube enseguida. El que está abajo de la escalera sí cobra del globo que
cae en el piso detrás de la torre.

**Las ruedas** (en las versiones que las tienen) se rompen con lo que pega abajo (de 1.4 m para abajo: el
driver, el putter, el hierro corto): 10 de vida entre las cuatro. Rotas a medias la frenan (hasta un 30 %
del paso); **rotas del todo, la torre se para** («¡Ruedas rotas!») y las arreglan en 10 s; cada golpe bajo
mientras tanto lo atrasa 1.5 s por punto. Arregladas quedan al 60 %. Las rotas se ven torcidas.

**Si llega a la línea** (z = 16), baja la rampa hacia adelante y **sale un goblin cada 2.2 s**: van
derecho a la puerta (y te atropellan si te pasan por encima). Los arqueros siguen tirando.

## Las versiones

| id | Qué tiene de distinto |
|---|---|
| `torre.arqueros` | La de base. **Se gana matando a toda la guarnición** (18 arqueros más uno por nivel de dificultad): sin arqueros la abandonan y se cae. La torre no tiene vida. Las ruedas se rompen. Los arqueros te tiran al puesto. |
| `torre.muralla` | Igual, pero **tiran flechas de fuego a la puerta**: una por vez, cada 5 s (3.2 al final), tensando 2.6 s con una llama en la punta y **una franja naranja del pie de la torre a la puerta**. No te apuntan a vos: hay que barrerlos antes de que suelten. Cada una le saca 1 a la puerta. |
| `torre.casco` | **La torre tiene vida (55) y se rompe a golpes**: todo lo que le pega le saca lo normal, y **el globo que cae arriba, el triple** (y barre a los arqueros). Los arqueros no se acaban (siguen subiendo). Las ruedas no se rompen; va un 15 % más lenta. |

## Cómo se le gana

- **Globos arriba**, con el golpe 2 o 3 (el 1 pifia): el anillo un poco detrás de la torre. Cada uno que
  entra barre la plataforma entera; mejor cuando hay tres o cuatro arriba.
- **Las flechas: corréte un puesto.** Como después de cada tiro hay que moverse igual, casi siempre
  alcanza con no quedarse a tirar dos veces en el mismo.
- **El driver a las ruedas** para ganar tiempo: tres o cuatro tiros fuertes la paran 10 s, y un tiro cada
  tanto mientras la arreglan la deja parada.
- La escolta sigue llegando: el hierro y el driver para ellos.

## Los números para tocar

Todos arriba de `torre/index.ts`, con su comentario:

- Torre: `TOWER_RADIUS` (1.5), `PLATFORM_Y` (5), `TOP_HIT_Y` (4.7: desde dónde es «arriba»), `WHEEL_Y`,
  `ROLL_SPEED` / `ROLL_TIME` / `PAUSE_TIME`, `START_Z`, `ARRIVE_Z`, `pace` de cada versión.
- Ruedas: `WHEELS_HP` (10), `MIN_PACE` (0.3), `REPAIR_TIME` (10 s), `REPAIR_SETBACK` (1.5 s), `REPAIRED`.
- Arqueros: `GARRISON` (18) + `GARRISON_PER_LEVEL`, `START_ON_TOP`, `CLIMB_EVERY` (6 → 3.5 s), `CLIMB_SOON`,
  `CLIMB_TIME`, `ARCHER_HP` (1), `CREW_REACH`.
- Flechas: `ARROW_DRAW` (0.9), `ARROW_FLIGHT` (1), `ARROW_RADIUS` (1.3), `ARCHER_EVERY`, `VOLLEY_GAP`,
  `MAX_MARKS`; las de fuego: `FIRE_DRAW` (2.6), `FIRE_GAP`, `FIRE_DAMAGE`.
- Rampa: `POUR_EVERY` (2.2 s).
- `casco`: `hp` (55) y `topMul` (3).

## Cómo le fue al bot

(pendiente)

## Lo que falta o no me convence

(pendiente)
