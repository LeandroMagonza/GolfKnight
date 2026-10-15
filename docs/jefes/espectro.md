# Espectro hechicero (14/10)

**Qué pone a prueba: priorizar dentro de la ola.** La idea es de Leandro: «el alma en pena, que parece medio
un hechicero, y podría ir apareciendo por distintas áreas, pegándose a otro enemigo y buffeándolo mientras más
tardás en pegarle, y vos tenés que ganar la ola, haciéndole, ponele, 3 de daño cada vez que aparece». Y
después: «el huargo podría reemplazar al alma en pena de hoy, para liberar ese cuerpo para el espectro
hechicero que se teletransporta y va buffeando a los enemigos si no lo frenás, les va dando poderes y vida,
los cura».

Código: `src/game/bosses/espectro/` (`index.ts` la pelea, `buffs.ts` lo que da, `visuals.ts` lo que se ve).

## Cómo es

No tiene una vida que bajar. Llega con la última oleada (sin el gólem de siempre) y:

1. **Avisa.** Un anillo violeta se cierra sobre el enemigo que va a ser su **huésped** (1.3 s).
2. **Aparece** (un destello) flotando al lado y un poco detrás del huésped, unido por un **lazo violeta** con
   bolitas de luz que van del espectro al huésped. El huésped brilla violeta y tiene un anillo en el piso; adentro
   del anillo, un disco que se va llenando: **cuando llena el anillo, el huésped sube un escalón** (le sale un
   cartelito arriba: «+2 vida», «+blindaje», «¡bendito!»…) y crece un poco.
3. **El último escalón es el élite**: la calavera, igual que el élite de cada escenario (el que entra tira la
   puerta, el que te pisa te mata). Ahí el espectro se va, contento, y vuelve a los segundos por otro.
4. **Para desterrarlo hay que sacarle 3** (4 con el golpe 4) en esa aparición: tiene sus tres cuadraditos de
   vida arriba, como cualquiera. Lo desterrás: se esfuma, y vuelve a los segundos por otro.

- **Elige huésped** entre los que caminan a la puerta (y el chamán), entre 24 y 62 m de la puerta, sin ser élite:
  **lejos de tu puesto de costado**, **con mucha vida**, y que tarde en llegar a la línea (que le dé el tiempo de
  hacerlo élite). Nada de huargos ni kamikazes ni los que se plantan al fondo.
- **Si matás al huésped**, el espectro salta en el acto a otro (con el daño que ya le hiciste encima, y el
  reloj del escalón donde estaba). Lo que le dio al muerto se pierde con él.
- **Si el huésped llega cerca de la línea** (a menos de 4 s), lo suelta y salta a otro: el élite hecho encima de
  la línea sería una derrota sin salida.
- **Si vuelve a elegir a uno que ya tuvo**, sigue la escalera desde donde la dejó (más cerca del élite).
- **La presión sube sola:** cada aparición vuelve antes (descansa de 6 s a 3.5 s) y sube los escalones más
  rápido; llega a lo más rápido en la quinta. Con dificultad, el reloj corre un 2 % más rápido por punto.
- **Silenciado o congelado no da nada:** el lazo queda gris y quieto y el reloj no corre (las cartas ayudan).
- Nada lo mueve (viento, palazo, empujones): flota donde quiere. El hoyo sí se lo traga (lo destierra).
- **La escolta** es más larga que la de siempre (unos 40 enemigos, uno cada 2.2 s, cerca de 1 min 45 s), con
  cuerpos fuertes para huésped: 10 goblins, 8 goblinas, 6 orcos, 6 esqueletos, 3 jefes goblin, 1 chamán,
  3 caballeros, 2 gólems chicos y 1 huargo. Con los poderes de la partida, como la oleada del gólem.

## Las versiones

| Versión | Qué le da en cada escalón | Cómo se gana |
| --- | --- | --- |
| `espectro.poderes` | un poder al azar que no tenga (blindaje +1, bendito, esquiva, se cura), otro, y el élite. Un escalón cada 4.5 s (3.2 al final) | desterrándolo 5 veces, y limpiando la ola |
| `espectro.vida` | cada 2.3 s (1.6 al final) +1 de vida y lo cura entero, cinco veces, y el élite | desterrándolo 5 veces, y limpiando la ola |
| `espectro.mezcla` | +2 vida y lo cura, un poder, +2 vida y lo cura, el élite. Cada 3.4 s (2.4 al final) | desterrándolo 5 veces, y limpiando la ola |
| `espectro.ola` | como la mezcla | **ganando la oleada**: viene hasta que se termina; desterrarlo solo evita los élites |

En todas, del aviso al élite pasan unos 14 s la primera vez y unos 10 s desde la quinta.

- **De destierro** (las tres primeras): la barra de arriba son los destierros que faltan. Si la horda se
  termina antes, aparece **solo** en el fondo (lejos de tu puesto) y salta de lugar cada 5.5 s hasta que lo
  desterrás. Después del quinto se va para siempre y queda el resto de la horda.
- **`espectro.ola`**: la barra es la vida del espectro de ahora; abajo, cuántas veces lo desterraste y cuántos
  élites hizo.

## `espectro.eterno` (15/10)

Leandro jugó `espectro.ola` y pidió esto: «que el espectro que buffea no muera, pero arranque a aparecer con 1
de vida, después 2, y así vaya subiendo hasta quizás 5 para cuando termina la ola. Que no tenga vida propia así
como la barra esa, solo tiene vida cuando aparece y siempre vuelve a aparecer mientras haya enemigos para que
aparezca. De la forma que digo yo es visual cómo escala porque va teniendo más vida. Y también le pondría una
barra de casteo para saber cuánto falta para que termine de hacerle el buff al enemigo». Dijo que `ola` «es
similar, pero no estoy seguro si escala»: quedó como estaba y esta es aparte.

- **Sin barra de jefe arriba.** La vida es la de cada aparición, y se ve en su **placa** sobre la cabeza: un
  rombo violeta por punto (llenos los que le quedan) y, abajo, la **barra de casteo** que se va llenando, con lo
  que va a darle escrito encima («+2 vida», «+poder», «¡ÉLITE!»). Silenciado o congelado, la barra se pone gris
  y no avanza. En el piso, el disco del huésped se llena al mismo ritmo.
- **Cada aparición trae más vida**: 1 la primera, y sube con el reloj de la escolta (40 enemigos × 2.2 s, unos
  88 s) hasta 5, pero nunca más de uno por aparición: 1, 2, 3, 4, 5. Con el golpe 4, uno más.
- **Matarlo corta el hechizo** que tenía a medio llenar («¡Hechizo cortado!»): lo que iba a dar no sale. Se
  esfuma y a los 5 s (3.5 s al final) avisa sobre **otro** huésped (no el mismo, si hay otro) y vuelve a aparecer.
- Si no lo matás, sigue sobre el mismo huésped: +2 vida, un poder, +2 vida y el élite (3.6 s cada hechizo al
  principio, 2.6 s al final). Ahí se va solo y vuelve por otro.
- **Se gana la oleada**: viene mientras haya horda a la que pegarse; cuando no queda nadie, termina.

Los números, arriba de `index.ts`: `ETERNO` (`hp` 1 a 5, `ramp` 88 s, `rest` 5 a 3.5 s, `plate` la altura de la
placa) y `VERSIONS.eterno` (la escalera y los segundos de cada hechizo). La placa es `CastPlate` en `visuals.ts`.

## Cómo se le gana

- **Un buen driver de lejos lo destierra de una** (a más de 40 m, el golpe 2 ya pega 3). El wedge cae encima
  del espectro y de su huésped a la vez (el área agarra a los dos); el hierro que le da al huésped revienta y el
  área le llega al espectro si está cerca.
- **Flota detrás del huésped**, del lado del medio de la cancha: el putter y el hierro de frente se los come el
  huésped (o lo que haya adelante); al de escudo, el driver le rebota. El globo es el palo para eso.
- **Priorizar**: cada tiro al espectro es un tiro menos a la horda. Dejarlo un escalón no es grave; dejarlo
  llegar al élite sí. Y en las que curan (vida, mezcla, ola), pegarle al huésped mientras está atado es tirar
  tiros: el escalón lo deja entero.
- **Matar al huésped** también sirve si es uno flojo: el espectro salta a otro, pero pierde lo que le había dado.

## Los números (arriba de `index.ts` y `buffs.ts`)

- `BANISH_HP` 3: lo que hay que sacarle cada vez (uno más con el golpe 4). `BANISH_GOAL` 5: los destierros.
- `FIRST_AT` 7 s: la primera aparición. `REST` 6 → 3.5 s: el descanso entre apariciones. `RAMP` 5: en cuántas
  apariciones llega a lo más rápido. `WARN` 1.3 s: el aviso.
- Cada versión: `ladder` (los escalones) y `step` (los segundos entre escalones, al principio y al final).
- `HOST_Z` 24–62: dónde busca huésped. `LET_GO_ETA` 4 s: cuándo suelta al que llega a la línea. `PICK`: cuánto
  pesa estar lejos de tu puesto, la vida y el azar al elegir.
- `PERCH`: dónde flota (1.4 m detrás, 1.3 al costado). `GROW` 0.08: cuánto crece el huésped por escalón.
- `ELITE_HP` 2: la vida de más del élite que hace (además de curarse entero). `POWERS`: los poderes que da.
- `ESCORT`: la escolta. `BOT`: cuánto le importa al bot.

## El bot

- **Primera tanda (15/10, una partida por versión):** ganó las cuatro; `poderes`, `vida` y `mezcla` sin perder
  puerta (los cinco destierros en unos 90 s), `ola` perdiendo 6 de puerta con 13 apariciones. Fácil.
- **`espectro.eterno` (15/10):** la primera prueba, con 3 → 2 s entre apariciones, la perdió por la puerta
  (129 s, 15 apariciones, 14 hechizos cortados, 1 élite): de tanto ir por el espectro se le pasaba la horda. Con
  5 → 3.5 s, ganó 2 de 2 perdiendo 5 y 2 de puerta (110–118 s de pelea): 12 apariciones, las 12 muertas con el
  hechizo a medio hacer, la vida llegó a 5, ningún élite. El bot lo prioriza mucho (`BOT.specter`); un jugador
  que deje pasar algún hechizo cambia vida del huésped por tiros a la horda.

## Lo que falta o no anda

PENDIENTE
