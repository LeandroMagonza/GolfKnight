# El Limo venenoso (14/10, rehecho el 15/10)

**Qué pone a prueba: el área contra muchos chicos, y cuidar la línea.** Ideas de Leandro (14/10): «que si lo
matás se divida y aparezcan dos más chicos, podría ser el slime y que escupa», «que absorba enemigos a los
que les pasa por arriba, y gane su vida».

Código: `src/game/bosses/limo/` (`pelea.ts` la pelea, `charcos.ts` las escupidas y los charcos, `panza.ts`
lo que se come, `index.ts` las versiones). Probar: `?ola=10&jefe=limo.divide` (o el panel B > Pruebas > Jefes).

## Qué hace (desde el 15/10)

- **Se arrastra hacia la línea en diagonal**, despacio y a pulsos (como una oruga), dejando un rastro de
  baba, y **cambia de diagonal de a ratos** (cada 4–7 s el grande). Rebota en los costados del campo. Con
  la pelea se arrastra más rápido (hasta un 50 % más a los 150 s).
- **Su ataque: el salto.** Cada 7–10 s (el grande) **se junta para saltar**: se aplasta, brilla naranja,
  tiembla, y el piso marca **el carril naranja y el anillo de dónde va a caer** (rojo si cae en la línea:
  ahí apunta a tu puesto). Se junta 1.8 s (el mediano 1.4). Si no lo cortás, salta 6.5 m hacia la línea
  (el mediano 5) y, si te cae encima, te saca 2 (el mediano 1).
  - **Se corta con un golpe fuerte** (golpe 2 o 3, o una habilidad) mientras se junta; también con hielo
    o aturdido. Cortado: no salta, **retrocede 2.2 m** y queda mareado 1.1 s. Con el golpe 1 le entra el
    daño, pero no lo corta («¡Más fuerte, para cortarlo!»).
  - Sin cortarle ninguno, el grande llega a la línea en menos de un minuto; cortándole todos, en más de
    tres. **El avance se pelea**, no es solo bajarle la vida.
- **La barra de arriba** dice la vida de todo el limo (contando lo que va a nacer de las divisiones) y,
  abajo, a cuántos metros de la línea está el más cerca, o «Se junta para saltar: ¡golpe fuerte!», o «En
  la línea», o «Va a la puerta».
- **Si un limo llega a la puerta, la rompe entera: perdés.** Cualquiera, del tamaño que sea (`gateDamage:
  Infinity`, el mismo «puerta ☠» del élite). Lo dice el cartel del principio («Si un limo llega a la puerta,
  cae»).
- **En la línea** se para justo antes y espera **4 s el grande, 3.5 el mediano, 3 el chico** (si lo tocás,
  pega): un disco rojo que se va llenando, un anillo grande que late cada vez más rápido, el limo que brilla
  rojo, y el cartel «¡Llegó a la línea! Matalo antes de que cruce». Es la última ventana: después cruza y ya
  no se le puede pegar.

## Las versiones

| Id | Qué cambia |
| --- | --- |
| `limo.divide` | Vida 50. **Se divide**: el grande en 2 medianos (18) y cada mediano en 2 chicos (6). Los hermanos salen para los costados y **se cruzan**: van en diagonales espejadas, se pasan rozándose (un área agarra a los dos), se separan unos metros y vuelven a encararse. Los chicos no saltan: se arrastran a 1 m/s. |
| `limo.come` | Vida 50, no se divide. **Se come a la escolta que toca** (y la chupa: un anillo violeta marca hasta dónde): gana su vida, crece, se los ve adentro y salen vivos al reventarlo. Cuando cambia de diagonal, va hacia el grupo más grande. Escolta más espaciada. |
| `limo.escupe` | Vida 70, no se divide ni salta: **se planta** en una franja de media cancha y **escupe** a tu puesto (la marca te sigue y se traba); el charco deja ese puesto sin pelota 14 s. **La escupida se corta con un golpe fuerte mientras se infla** (violeta). La franja se acerca 0.25 m/s **sin tope** (antes paraba a 28 m): si no lo matás, a los dos minutos y pico llega a la línea y cruza. |
| `limo.gotea` | Vida 60. Cada 10 que le sacás (eran 6) **se le cae un chico** que corre a la línea. Salta como «divide». |
| `limo.completo` | Todo junto: escupe y come (el grande y los medianos), salta, y se divide hasta los chicos (40, 16, 5). |

## Los números para tocar (arriba de `pelea.ts`)

- `TIERS`: por tamaño, `glide` (lo que avanza por segundo) y `slant` (la diagonal: cuánto se abre de
  costado por metro), `turn` (cada cuánto cambia de diagonal), `leapEvery`, `gather`, `leap`, `air`,
  `lift` (el salto), `trample` (lo que te saca), `lineWait` (cuánto espera en la línea antes de cruzar),
  `speed` (caminando después de cruzar).
- `SPEED_UP` (la presión), `CRAWL` (los pulsos), `CUT_QUALITY` 2, `CUT_PUSH` 2.2 m, `CUT_STUN` 1.1 s,
  `FIRST_LEAP` 3.5 s (el primer salto sale enseguida, para que se vea qué hace).
- `SPLIT_SIDE`, `SPLIT_STAGGER` y `CROSS_GAP` (cómo se cruzan los hermanos).

## Lo que dijo Leandro (15/10) y qué se hizo

Jugó «divide» (ganó en 78 s; cruzaron 2 medianos) y «completo» (ganó en 97 s; cruzaron 3).

- **«Logré que se divida en 2 pero no matarlo antes de que baje, y gané igual jaj, llegaron a la puerta
  pero no me hicieron perder».** Los que cruzaban sí le pegaban a la puerta, pero poco: el mediano sacaba
  2 (dos medianos, 4 de 10). Primero lo subí (el grande 8, el mediano 4, el chico 2), y Leandro: «si el
  limo te hace solo 8 de daño, y vos mataste al resto de la ola con por lo menos 9, podés ignorarlo y ganar
  igual. Para mí los jefes tienen que tener potencial de romperte toda la puerta mientras están vivos». Se
  propuso que se quedara pegado a la puerta comiéndosela, y Leandro: «no, pegar desde la línea es incómodo.
  Si llega cualquier parte del limo, perdés, y balanceémoslo para eso». Así quedó: cualquier limo que llega
  rompe la puerta, y para que sea justo se queda 3–4 s en la línea avisando, los chicos van más despacio
  (1 m/s, eran 1.4), y «gotea» suelta menos chicos.
- **«Estuvo medio aburrido, el boss estuvo saltando por ahí en la suya y ni me di cuenta que estaba
  avanzando realmente»**, **«para una pelea de jefe le falta, y quizás haría que en vez de saltar, vaya
  moviéndose lento en diagonal poco angulada, y cambiando de dirección de a ratos, en especial cuando son
  más de uno, así a veces podés pegarle a los dos y otras te conviene pegarle a uno»**, **«la mecánica que
  estamos usando bastante es la de cortarle el ataque con un golpe fuerte»**. Antes saltaba todo el
  tiempo en zigzag, en manada, y avanzaba parejo. Ahora se arrastra en diagonal y cambia de diagonal; los
  hermanos se cruzan; el salto pasó a ser **el ataque**, con aviso, que se corta con un golpe fuerte y lo
  hace retroceder; y la barra dice a cuántos metros de la línea está.
- **«Lo de las pelotas que se rompen me pareció interesante».** (Los charcos de «escupe» y «completo»
  que se comen la pelota del puesto.) Quedan igual; la escupida ahora también se corta.

## Cómo le fue al bot

- 15/10, dos partidas de «divide» con el movimiento nuevo: ganó las dos (52 y 76 s de pelea), saltó 9 y
  14 veces y le cortó 2 y 5; no cruzó ninguno. Perdió 0 y 2 de puerta (de la escolta).
- 15/10, con «si llega, perdés» (una de cada): ganó `divide` (64 s, 13 saltos, 3 cortados), `completo`
  (63 s, 4 escupidas cortadas) y `gotea` (66 s, 5 goteados, 5 cortados) sin que ningún limo llegara a la
  línea. Perdió `escupe` a los 53 s por la escolta (la puerta, con el limo a media cancha).
- Después, con la franja de «escupe» sin tope: ganó `escupe` y `divide` (69 s, 11 saltos, 5 cortados),
  otra vez sin que ninguno llegara a la línea. Para el bot está justa o fácil; falta verla jugada.

## Lo que se sabe que falta

- Probar las otras versiones con el cambio (sobre todo «escupe», que no salta, y «come», que va hacia la
  comida al cambiar de diagonal).
- El bot no busca cortar el salto a propósito con un golpe fuerte: solo le da más peso al que se junta.
