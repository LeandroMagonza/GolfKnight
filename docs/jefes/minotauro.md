# Minotauro embestidor (14/10)

**Qué pone a prueba: cortar una carga a tiempo.** La idea es de Leandro: «el torero en realidad no lo podés
esquivar, porque le pega a la puerta, tendrías que debilitarle la carga y pegarle mientras ya inició la
corrida, para desviarlo; me imagino que cuando le pegás la pelota rebota en ángulo y el minotauro rebota en el
mismo ángulo y corre para atrás. Y va haciéndose más fuerte la carga. […] cuando está embistiendo tenés que
terminar de bajarle todo el daño de la carga, si no pasa contra la puerta y perdés. […] si le rompés la carga
antes de que salga, se queda en el lugar un toque, o sea que dejarlo salir es muy peligroso porque avanza más
rápido si llega a embestir, y te puede quedar ahí cerca, que te da menos tiempo durante la embestida para
bajarlo.»

Código: `src/game/bosses/minotauro/` (`index.ts` las versiones, `fight.ts` la pelea, `props.ts` lo que se ve).
Probarlo: `?ola=10&jefe=minotauro.carga` (o `.mixto`, `.billar`, `.brutal`).

## Cómo es

El cuerpo es el minotauro de dungeon.glb (`Character_Minotaur`, con su hacha doble) agrandado a 4 m, como el
gólem de roca. Llega con la última oleada (sin el gólem de siempre; la escolta es la de siempre).

1. **Entra caminando** desde el fondo y se planta lejos (entre 36 y 46 m de la puerta, hasta 12 m al costado).
2. **Junta la carga.** Se agacha, raspa el piso (nubes de polvo detrás de las patas) y resopla. Sobre la cabeza,
   arriba de la vida, aparece **la barra de la carga**: un par de cuernos y un cuadradito naranja por punto, con
   **la mecha** abajo (lo que le falta para salir). En el piso: **el carril** naranja hasta la puerta, **un anillo
   rojo en la línea de los puestos** (el puesto que va a atropellar) y **un anillo a sus pies que se cierra**.
   La primera vez sale el cartel «¡El minotauro va a embestir! Bajale la carga antes de que salga».
3. **Cada golpe le baja la carga** (sale el número en naranja, «−3», y la barra parpadea). Según la versión, le
   baja también la vida.
4. **Si le vaciás la carga antes de que salga**, la carga se rompe (estallido naranja, «¡Carga rota!») y queda
   **aturdido** 3.5 s en el lugar, con estrellitas girando sobre la cabeza: la ventana para pegarle a la vida.
   Después se mueve al trote a otro lugar (7 a 12 m al costado) y vuelve a juntar.
5. **El aviso:** en los últimos 0.8 s se para de manos con el hacha arriba y el carril se pone rojo.
6. **Si sale, embiste**: polvo, rugido, «¡Embiste!», brilla rojo, y corre derecho por el carril, mucho más
   rápido (9 m/s la primera). **Lo que le bajaste antes lo frena**: con la carga llena corre a toda velocidad,
   con un punto, a la mitad. Cada golpe de la corrida le baja la carga y lo hace tropezar un cuarto de segundo.
7. **El golpe que le vacía la carga en la corrida lo desvía:** como dos bolas de billar, la pelota rebota en
   ángulo (se ve salir volando) y él sale en el ángulo espejo, para atrás y para el lado contrario al golpe.
   Pegarle en el medio lo manda derecho para atrás; en el borde, hasta 70° de costado. Corre 13 m para ese
   lado, se sacude la cabeza y **vuelve a juntar desde ahí**: si lo desviaste tarde, queda cerca (hasta 22 m
   de la puerta), y la próxima corrida es corta. «¡Desviado!»
8. **Si llega a la puerta**, le pega **lo que le quedaba de carga** (en la versión brutal, la tira abajo),
   rebota atontado y vuelve corriendo al fondo a juntar otra.
9. **Si te encuentra en el carril**, te atropella (1 de vida) y sigue.
10. **Cada carga nueva es más fuerte:** un punto más (de 5 a 11), junta un poco menos (de 5.2 s a 4 s) y corre
    más rápido (de 9 a 12 m/s). Con la dificultad, un punto más cada 4 niveles.

Otras reglas:

- **Detrás de la línea de los puestos está fuera de juego**, como todos: no se le pega.
- **Silenciado no junta**: la mecha se para mientras dura (las cartas ayudan).
- **El frío lo frena** también corriendo (como a todos: al 40 %, ver `chilledSpeed`). No se congela (es jefe).
- **El aura del chamán no lo cubre**: si quedaba inmune justo en la corrida, el golpe a la puerta no se podía
  evitar. El hoyo, la bandera y el viento no lo mueven (es jefe, como siempre).
- El fuego, el rayo, el carrito: todo lo que le saca vida también le baja la carga.

## Cómo se le gana

- **Mientras junta, pegarle todo lo que se pueda**, desde lejos: el driver de lejos (más de 40 m) pega 2/3/4.
  La primera carga (5 puntos en 5.2 s) se rompe con dos o tres golpes buenos.
- **Si no llegás a romperla, bajale lo más que puedas igual**: sale más lento y te queda poco para la corrida.
- **En la corrida**, cuando se acerca a 20 m, entra el putter (2/3/4): el golpe de cerca la termina.
- **No pararse en el anillo rojo** de la línea: te atropella. Tirarle de costado, desde el puesto de al lado.
- **Aturdido, a la vida**: es la ventana grande (en «carga», cada golpe le entra 1 más).
- Dejarlo salir es caro: si lo desviás tarde, vuelve a cargar de cerca.

## Las versiones

| Versión | Qué tiene de distinto |
|---|---|
| `minotauro.carga` | **El golpe mientras junta o corre baja solo la carga.** La vida baja en las ventanas: aturdido (+1 por golpe), desviado, moviéndose, entrando. 50 de vida. Llega: la puerta pierde lo que le quedaba de carga. |
| `minotauro.mixto` | **Cada golpe baja la carga y la vida a la vez.** 90 de vida, sin el +1 del aturdido. Llega: la puerta pierde lo que le quedaba. |
| `minotauro.billar` | Como «carga», pero **cada golpe de la corrida lo rebota** en ángulo (2.2 m por punto) y sigue corriendo con lo que le queda; el que le vacía la carga lo desvía del todo. Cada golpe gana tiempo. |
| `minotauro.brutal` | Como «mixto», pero **si llega a la puerta con carga, la puerta cae**: se pierde la partida. |

## Los números (arriba de `fight.ts`; la vida, en `index.ts`)

| Número | Valor | Qué es |
|---|---|---|
| `CHARGE_FIRST`, `CHARGE_STEP`, `CHARGE_MAX` | 5, +1, 11 | puntos de cada carga |
| `WINDUP_FIRST`, `WINDUP_STEP`, `WINDUP_MIN` | 5.2 s, −0.2, 4 s | cuánto junta |
| `TELL` | 0.8 s | el aviso del final (de manos, carril rojo) |
| `RUN_FIRST`, `RUN_STEP`, `RUN_MAX` | 9, +0.4, 12 m/s | velocidad de la corrida |
| `RUN_FLOOR` | 0.5 | a qué parte corre con la carga casi vacía |
| `FLINCH_SLOW`, `FLINCH_TIME` | 0.35, 0.25 s | el tropezón de cada golpe en la corrida |
| `DAZE` | 3.5 s | aturdido después de romperle la carga |
| `dazeBonus` | 1 en «carga», 0 en «mixto» | daño de más por golpe aturdido |
| `MAX_TILT` | 0.6 rad | cuánto se tuerce el rebote (sale al doble) |
| `BOUNCE_DIST`, `BOUNCE_NEAR` | 13 m, 22 m | cuánto corre para atrás; lo más cerca que puede quedar |
| `PUSH_PER_POINT` | 2.2 m | billar: lo que rebota cada punto de un golpe de la corrida |
| `STANCE_NEAR`, `STANCE_FAR`, `STANCE_SIDE` | 36, 46, 12 m | dónde se planta |
| `TRAMPLE` | 1 | lo que le saca al golfista que atropella |
| vida | 50 («carga», «billar»), 90 («mixto», «brutal») | más la del golpe 4 (`bonusHp`) |

## El bot

<!-- se completa con las tandas -->

## Problemas conocidos

<!-- se completa -->
