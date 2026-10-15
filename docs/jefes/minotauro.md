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
Probarlo: `?ola=10&jefe=minotauro.carga` (o `.mixto`, `.billar`, `.brutal`, `.coraza`).

## Cómo es

El cuerpo es el minotauro de dungeon.glb (`Character_Minotaur`, con su hacha doble) agrandado a 4 m, como el
gólem de roca. Llega con la última oleada (sin el gólem de siempre; la escolta es la de siempre).

1. **Entra caminando** desde el fondo y se planta lejos (entre 36 y 46 m de la puerta, hasta 12 m al costado).
2. **Junta la carga.** Se agacha, raspa el piso (nubes de polvo detrás de las patas) y resopla. Sobre la cabeza,
   arriba de la vida, aparece **la barra de la carga**: un par de cuernos y un cuadradito naranja por punto, con
   **la mecha** abajo (lo que le falta para salir). En el piso: **el carril** naranja hasta la puerta, **un anillo
   rojo en la línea de los puestos** (el puesto que va a atropellar) y **un anillo a sus pies que se cierra**.
   La primera vez sale el cartel «¡El minotauro va a embestir! Bajale la carga. Si te pasa, rompe la puerta».
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
8. **Si te pasa, rompe la puerta** (desde el 15/10): al cruzar tu línea sale «¡Te pasó! ¡Va a romper la
   puerta!», y al llegar le saca **media puerta (5 de 10)**, le quede la carga que le quede, con un estallido y
   «¡Rompió la puerta!» (en la versión brutal, la tira abajo entera). Rebota atontado y vuelve corriendo al
   fondo a juntar otra. Antes le sacaba lo que le quedaba de carga.
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
| `minotauro.carga` | **El golpe mientras junta o corre baja solo la carga.** La vida baja en las ventanas: aturdido (+1 por golpe), desviado, moviéndose, entrando. 30 de vida. |
| `minotauro.mixto` | **Cada golpe baja la carga y la vida a la vez.** 55 de vida, sin el +1 del aturdido. |
| `minotauro.billar` | Como «carga», pero **cada golpe de la corrida lo rebota** en ángulo (2.2 m por punto) y sigue corriendo con lo que le queda; el que le vacía la carga lo desvía del todo. Cada golpe gana tiempo. |
| `minotauro.brutal` | Como «mixto», pero **si llega a la puerta, la puerta cae**: se pierde la partida. |
| `minotauro.coraza` | (15/10) Como «carga», pero **la carga es más chica y blindada**: 3 puntos la primera, +1 cada una, hasta 7; cada golpe le baja **uno menos** (el golpe 1 rebota: «0» gris, ruido de armadura, «¡Blindado! Pegale más fuerte») y a la vida, nada. Mientras junta brilla acero, no rojo. 30 de vida. |

En todas menos brutal, si te pasa le saca media puerta.

## Los números (arriba de `fight.ts`; la vida, en `index.ts`)

| Número | Valor | Qué es |
|---|---|---|
| `CHARGE_FIRST`, `CHARGE_STEP`, `CHARGE_MAX` | 5, +1, 11 | puntos de cada carga |
| `WINDUP_FIRST`, `WINDUP_STEP`, `WINDUP_MIN` | 5.2 s, −0.2, 4 s | cuánto junta |
| `TELL` | 0.8 s | el aviso del final (de manos, carril rojo) |
| `RUN_FIRST`, `RUN_STEP`, `RUN_MAX` | 9, +0.4, 12 m/s | velocidad de la corrida |
| `RUN_FLOOR` | 0.5 | a qué parte corre con la carga casi vacía |
| `GATE_SMASH` | 5 | lo que le saca a la puerta si te pasa (la puerta es de 10); brutal: toda |
| `armor`, `charge` (`Variant`) | 1; 3, +1, 7 | la coraza: lo que le resta a cada golpe mientras carga, y sus puntos |
| `FLINCH_SLOW`, `FLINCH_TIME` | 0.35, 0.25 s | el tropezón de cada golpe en la corrida |
| `DAZE` | 3.5 s | aturdido después de romperle la carga |
| `dazeBonus` | 1 en «carga», 0 en «mixto» | daño de más por golpe aturdido |
| `MAX_TILT` | 0.6 rad | cuánto se tuerce el rebote (sale al doble) |
| `BOUNCE_DIST`, `BOUNCE_NEAR` | 13 m, 22 m | cuánto corre para atrás; lo más cerca que puede quedar |
| `PUSH_PER_POINT` | 2.2 m | billar: lo que rebota cada punto de un golpe de la corrida |
| `STANCE_NEAR`, `STANCE_FAR`, `STANCE_SIDE` | 36, 46, 12 m | dónde se planta |
| `TRAMPLE` | 1 | lo que le saca al golfista que atropella |
| vida | 30 («carga», «billar», «coraza»), 55 («mixto», «brutal») | más la del golpe 4 (`bonusHp`); hasta el 15/10, 50 y 90 |

## Lo que cambió el 15/10 (lo que dijo Leandro)

«El minotauro me gustó, pero también me parece que tiene mucha vida, y que debería romper la puerta si logra
pasarte; quizás ya brutal es lo que pedía, porque no le baja la vida pero hace que le baje la vida y la de
carga cuando le pegás mientras carga, lo que básicamente hace que le baje la vida jaja.» Y: «quizás le podría
[poner] carga más chica y blindaje mientras carga, pero no tengo un gran argumento».

- **Menos vida en todas**: 50 → 30 y 90 → 55. Le ganó a «carga» a los 188 s, con 18 cargas y 14 desvíos; con
  30, unos 110 s contando la escolta.
- **Si te pasa, rompe la puerta**: media puerta de una (`GATE_SMASH`), avisado en el cartel de la primera carga
  y al cruzar tu línea. Dos pasadas y se pierde; una con la puerta sana duele pero no termina la partida.
  Elegí eso y no la puerta entera para que dejarlo pasar una vez no sea perder en todas las versiones: para
  eso está brutal.
- **Brutal**: lo que dice Leandro es que en brutal (que es «mixto»: cada golpe baja la carga **y** la vida) la
  pelea es casi pegarle a la vida todo el tiempo, y por eso se siente bien. Queda igual (la puerta entera si
  pasa), con la vida nueva (55). Si es la que le gusta, `mixto` ahora es la misma pelea con la media puerta.
- **`minotauro.coraza`, nueva**, para comparar: la carga chica y blindada que pidió (arriba). Pide golpes
  fuertes, no muchos golpes: un 3 le saca 2, un 4 le saca 3, un 1 nada.

## El bot

15/10, `minotauro.coraza`, 2 partidas desde la oleada 10: ganó una a los 55 s del jefe (4 cargas, 2 rotas, 1
desvío, 5 rebotes en la coraza, **1 vez le pasó: −5 de puerta**). La otra se cortó a los 26 s por un error de
la tanda (`page.evaluate`: «reading 'hit'», no del jefe: había otros agentes cambiando el árbol), con el
minotauro en 10 de vida después de romperle las dos primeras cargas.

## Problemas conocidos

- La barra de la carga no muestra la coraza (los cuernos son los mismos): se lee por el brillo acero mientras
  junta y por el «0» de los golpes que rebotan.
