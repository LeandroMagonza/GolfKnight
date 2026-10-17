# Jefes de ritmo (14/10)

La idea es de Leandro: «un jefe que arranque con blindaje alto y vaya bajando, y suba de golpe cuando le
pegás; podemos tener jefes más de burst, y jefes más de pegarle de a ratos; también podría haber uno que
se empiece a curar si no le pegás cada 3 segundos». Son dos ritmos opuestos, y cada uno pide una cosa:

- **La coraza** (el Caballero de hierro) pide **ráfaga**: esperar la ventana y descargarle todo junto.
- **El pulso** (el Chamán eterno) pide **cadencia**: pegarle seguido, sin pausas, entre los demás.

Ninguno camina a la puerta: se plantan a media cancha y cada tanto se cambian de lugar (hay que volver a
apuntar, y a veces cambiar de palo). Con el correr de la pelea se plantan más cerca (de unos 40 m a unos
25 m de la línea, en 150 s) y todo se pone más apretado: esa es la presión que sube sola.

El código está en `src/game/bosses/ritmo/`: `coraza.ts` y `pulso.ts` son los dos ritmos, `azar.ts` el de la
ruleta (15/10), `cuerpo.ts` el
cuerpo (cómo se planta y se cambia de lugar, y los avisos de cada golpe), `piezas.ts` lo que se ve (el
dial del piso, el número sobre la cabeza, lo que tiran) e `index.ts` las versiones.

## Las versiones

| Id | Qué tiene de distinto |
|---|---|
| `ritmo.coraza` | La de base. Ráfaga: en 0, el primer golpe prende una mecha de 1.9 s; lo que entra en ese rato entra entero, y ahí se cierra al tope. Si se le pasa la ventana, tira la lanza a la puerta. **La pelota que rebota en el blindaje le devuelve una esquirla a tu puesto** (15/10) |
| `ritmo.coraza-escolta` | Igual, pero si se le pasa la ventana **reparte su blindaje**: +1 a los de la escolta que tiene cerca |
| `ritmo.tope` | «De a ratos»: el primer golpe en 0 lo cierra en el acto. Un golpe por ventana, que sea el más fuerte. Baja más rápido |
| `ritmo.suma` | Cada golpe que entra le **suma 2** de blindaje, sin mecha |
| `ritmo.pulso` | La de base del pulso: si pasan 3.4 s sin pegarle se cura y te tira hechizos. Llama goblins cada tanto |
| `ritmo.pulso-escolta` | Igual, pero mientras se cura **cura también a la escolta** que tiene cerca, con vida de más |
| `ritmo.pareja` | Los dos a la vez, en dos cuerpos: el caballero y el chamán. El chamán, al curarse, cura también al caballero |
| `ritmo.doble` | Los dos ritmos en un solo cuerpo (la Paladina caída): cualquier pelota que la toque le corta la cura, aunque el blindaje se la coma (y acá el rebote **no** devuelve esquirla: tocarla es lo que se pide) |
| `ritmo.azar` | **Nueva (15/10).** El Caballero de dos caras: cada tanto gira una ruleta y sale **blindado** (un golpe fuerte) o **fantasma** (tres golpes). Si no cumplís en la ventana, lanza a la puerta |

## 15/10: lo que pidió Leandro

### La coraza, más difícil y con el rebote

«El de ritmo coraza está fácil también» y «el de ritmo podría ser que si le pegás al blindaje y no lográs pasar,
haga el ataque que te tira metales a vos». En su partida le ganó en 159 s, con 2 castigos y 2 esquirlas que le
pegaron de 40.

- **El rebote**: la pelota que toca al caballero cerrado y no pasa el blindaje (todo lo que trae ≤ el número del
  yelmo) le devuelve **una esquirla al puesto donde está el golfista**, con la marca roja en el piso y 1.35 s de
  vuelo: lo justo para cambiarse de puesto. Como mucho una cada 1.2 s (si rebotan varias juntas). Lo que sí
  pasa el blindaje con él cerrado sigue como antes (en la mecha lo cierra: «¡Muy pronto!», con el pisotón). Va
  en todas las corazas (`coraza`, `coraza-escolta`, `tope`, `suma`, y el caballero de la `pareja`), menos en
  el `doble`. El registro lo cuenta: `rebotes` y `rebotesPegaron`.
- **Más difícil**: la mecha dura 1.9 s → 1.4 s (antes 2.2 → 1.6), la ventana sin golpes 3.6 s → 2.3 s (antes
  4.2 → 2.6), y el pisotón tira esquirlas a 2 puestos desde el principio (antes 1). La vida no se tocó: la
  pelea a solas no tiene que alargarse.

### `ritmo.azar`: blindado o fantasma

«Me parecería interesante tener en este jefe u otro que tenga una ventana que no sepas con anterioridad si vas
a tener que meter muchos golpes simples o un golpe fuerte: podría por unos segundos tener blindado o fantasma
aleatoriamente, y en esa ventana tenés que bajarle 1 de vida si está blindado y 3 si está fantasma, o te pega a
la puerta por ejemplo».

- **Entre ventanas** tiene blindaje 2 (lo flojo no le entra, lo fuerte entra a medias) y se cambia de lugar
  como los otros. Con blindaje 1, en la primera prueba el bot lo mató en 70 s habiendo visto una sola ruleta:
  la pelea tiene que pasar por las ventanas.
- **La ruleta** (el aviso, 1.3 s): se planta, un anillo blanco en el piso, y sobre la cabeza un «¿?» grande
  que alterna entre azul acero («blindado») y celeste pálido («fantasma»), cada vez más lento. No se sabe cuál
  sale hasta el final.
- **La ventana**: sale una de las dos, al 50 %. Arriba, la palabra grande y los cuadraditos de lo que pide;
  en el piso, un reloj que se vacía (rojo el último segundo) y tres placas que se llenan de dorado.
  - **Blindado**: blindaje 3 (el ícono del juego también lo muestra): solo el golpe 4 le saca 1. Hay que meter
    **un golpe fuerte**. 4.6 s → 3.6 s.
  - **Fantasma**: etéreo, traslúcido: cada golpe le saca 1 como mucho. Hay que meter **tres golpes**, rápido
    (cualquiera sirve). 6.2 s → 4.8 s.
  - Con cada nivel de dificultad, la ventana dura 0.05 s menos.
- **Si cumplís**: se tambalea 2.5 s sin blindaje («¡Bien! Descargale», el cartel dice «¡YA!»): el premio.
- **Si no**: tira la lanza a la puerta (1), como la coraza.
- Entre una ventana y la próxima ruleta, 4.5 s → 3 s (más lo que tarda en cambiarse de lugar). 54 de vida
  (+2 por nivel).
- Silenciado, el blindaje y el etéreo no corren (le entra todo): la ventana se cumple más fácil.
- Los números están en `AZAR`, arriba de `azar.ts`; el registro cuenta `ventanas`, `blindadas`, `fantasmas`,
  `cumplidas`, `falladas` y `lanzas`.

## Cómo le fue al bot (15/10)

- **`ritmo.coraza` con el rebote y lo más difícil** (una partida): ganó, pero en 159 s y perdiendo 7 de puerta
  (en la primera tanda: 94 s sin perder puerta). 17 ventanas, 18 rebotes devueltos y ninguno le pegó (el bot
  esquiva lo que va a caer en su puesto: `danger`), 41 esquirlas de pisotón y ninguna le pegó.
- **`ritmo.azar`**: en las dos primeras pruebas vio una sola ventana por pelea. Era un error: al premio lo
  aturdía con `stunFor`, y a las partes de jefe el juego no les descuenta el aturdido (las mueve su guion), así
  que quedaba aturdido para siempre y no se cambiaba más de lugar (y sin cambiarse no gira la ruleta). Ahora
  el premio solo lo deja plantado. Además el blindaje entre ventanas pasó de 1 a 2 y el descanso de 6.5 → 4.2 s
  a 4.5 → 3 s (con blindaje 1 lo mataba en 70 s con una ventana). Así, 2 de 2: 159 s con 13 ventanas (8
  blindadas, 5 fantasmas; cumplió 7, falló 6: 6 lanzas, −6 de puerta), y 95 s con 6 (cumplió 5). El blindado
  es el que más le cuesta: pide el golpe 4 justo en la ventana.

## La regla de la puerta (15/10)

`ritmo.coraza-escolta` castigaba la ventana perdida repartiendo blindaje a la escolta; sin escolta cerca no
hacía nada, y a solas se lo podía dejar para el final sin que la puerta corriera peligro. Ahora, si no hay a
quién darle placas, **tira la lanza a la puerta** como la coraza (`coraza.ts`, `missed`). Ver la regla en
`docs/jefes.md`.

## El golpe apurado ya no castiga (17/10)

Leandro: «el ritmo coraza tiene que hacer el ataque si está con blindaje, pero me parece que debería entrarle
daño igual si el blindaje no es suficiente para bloquearlo todo, es más, no sé si el ataque solo debería pasar
cuando el blindaje bloquea todo».

Lo que pasa del blindaje ya entraba (el juego resta el blindaje y entra lo que sobra). Pero en `mecha` y `tope`
ese golpe apurado, además de cerrarlo al tope («¡Muy pronto!»), hacía el pisotón con esquirlas a los puestos:
se sentía como que no entraba y encima castigaba. Ahora:

- **El blindaje se come todo:** rebota y te devuelve la esquirla a tu puesto (el único ataque por pegarle cerrado).
- **Lo pasa:** entra lo que sobra y se cierra al tope («¡Muy pronto!»), sin pisotón. Perdés la espera, nada más.
- **Después de una ventana** (la mecha que se apaga, o el golpe en 0 de `tope`) sigue el pisotón de siempre.

`suma` no cambia (cada golpe le sube el blindaje, y el pisotón es al cerrarse después de abrirse).
