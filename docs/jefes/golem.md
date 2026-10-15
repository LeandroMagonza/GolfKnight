# Gólem de las piedras (14/10)

**Qué pone a prueba: repartir la atención, varios relojes a la vez.** La idea es de Leandro: «que el jefe se
agachara y empezara a spawnear piedras sobre la línea donde está, y las piedras vayan girando en su lugar y
agrandándose, hasta que cuando llegan a X tamaño salen rodando hacia la puerta y le pegan. La piedra arranca
con 1 de vida, y va ganando tamaño hasta 5; si le bajás toda la vida desaparece, si no se sigue agrandando
[…] y ahí se lanza; mientras se lanza también la podrías destruir». Y la otra: «que sean 3 jefes de piedra,
y que si les pegás mientras cargan la tirada de piedra en una ventana de tiempo logres stunearlos».

Código: `src/game/bosses/golem/` (`index.ts` las versiones, `golem.ts` el gólem solo, `rocks.ts` las
piedras que crecen, `overhead.ts` la piedra grande sobre la cabeza, `trio.ts` los tres gólems, `looks.ts`
lo que se ve hecho por código).

Probarlo: `?ola=10&jefe=golem.crece` (o `.fijo`, `.ventana`, `.trio`).

## Las versiones

| Versión | Qué tiene |
|---|---|
| `golem.crece` | Golpea el piso y en su línea nacen piedras con 1 de vida que crecen hasta 5 y salen rodando; a la puerta le pegan la vida que les queda. **Desde el 15/10, a veces juntas y a veces separadas.** 75 de vida. |
| `golem.fijo` | Como «crece», pero cada piedra que llega le saca 2 a la puerta, le quede la vida que le quede. |
| `golem.ventana` | Las piedras (siempre juntas, como antes), más la piedra grande sobre la cabeza: un golpe fuerte en la ventana se la tira encima y lo aturde. Fases a 2/3 y 1/3: ruge y todo va más rápido. 110 de vida. |
| `golem.trio` | Tres gólems más chicos (40 cada uno) que levantan piedras y las tiran a la puerta; cualquier golpe en la ventana los aturde. **Desde el 15/10: cuando cae uno, los otros tiran sin pausa; el último no se aturde.** |

## Lo que cambió el 15/10 (lo que dijo Leandro)

**`golem.crece`, la vida.** «Fijate en las partidas de recién que perdí cuánta vida llegué a sacarle, porque me
parece que tiene demasiada, no digo que debería haberlo matado, pero me parece que estaba bastante lejos, y
hacía tiempo que se había terminado la wave. Me parece que está bien tener un tiempo a solas con el boss al
final, pero no debería ser muy largo.» Perdió dos veces dejándolo en 116 y 87 (de 140), a los 83 y 88 s. Le
sacó entre 24 y 53 en unos 85 s: con **75** (`HP` en `golem.ts`), la segunda partida la ganaba con lo justo,
y con las piedras más lentas le queda más tiempo para pegarle a él.

**`golem.crece`, las piedras juntas y separadas.** «Al final tenía que timear bastante perfecto el tema de
pegarle a las 3 pelotas cuando spawneaban o se hacía una bola muy difícil de remontar [...] tendrían que
aparecer a veces juntas y otras separadas, para que no estés solo con el hierro todo el tiempo, y crecer menos
rápido para compensar.» (Y él tenía el poder del albañil, que lo curaba al matar cosas juntas: con las piedras
juntas, era un gran poder para esta pelea.)

- Cada tanda sale **junta** (una tira de lugares seguidos, un golpe al piso, como antes) o **separada**, mitad
  y mitad (`TOGETHER_CHANCE` 0.5). Separadas: lugares a dos o más lugares de distancia entre sí (6.4 m, fuera
  del área del hierro), en orden salteado, y **un golpe al piso por piedra**, con 0.9 s entre golpe y golpe
  (`SPLIT_GAP`): cada una nace a su tiempo y sale rodando a su tiempo. Mientras sale una tanda separada, el
  reloj de la próxima espera: separadas salen algo menos seguido.
- **Crecen más lento**: 4.2 s por punto (era 3.2): de 1 a 5, 17 s en vez de 13.
- En el registro: `juntas` y `separadas` (cuántas tandas de cada una).
- `golem.fijo` tiene lo mismo. `golem.ventana` no (le gustó como estaba: «el poder es interesante y también
  está bueno que te avisa que está subiendo de nivel, tipo enrage»): solo le bajé la vida de 140 a **110** (le
  ganó a los 140 s, largo para el rato a solas). Sus piedras siguen juntas y a 3.2 s.

**`golem.trio`.** «No está mal, me gusta más con las piedras, pero podemos guardar la mecánica para otro jefe,
y cuando muere uno los otros tienen que estar pegando constantemente, y cuando queda uno solo no puede
stunearse.»

- Cuando cae uno, los que quedan rugen y desde ahí **tiran sin pausa**: 1.1 s entre tiro y tiro
  (`ANGRY_GAP`; antes seguían su ciclo, de 4.5 a 9 s).
- **El último no se aturde**: levanta la piedra con el anillo rojo (no dorado), sin ventana, y la tira
  derecho; 1.6 s entre tiro y tiro (`LAST_GAP`). Cartel: «¡El último no se deja aturdir! Tira sin parar:
  bajalo rápido». Si estaba aturdido justo cuando cae el otro, termina su aturdido.
- `Overhead.uncuttable` es lo que lo hace (sirve para otro jefe que tire sin ventana).

## El bot (15/10)

`golem.crece`, 2 partidas desde la oleada 10 (bot «humano»): ganó una a los 91 s del jefe (28 piedras, 8
tandas juntas y 3 separadas, 1 de puerta por piedras) y perdió otra a los 51 s, dejándolo en 32 (3 piedras
grandes en la puerta, 12). En la primera tanda (14/10, con 140 de vida) le había ganado 0 de 3 a las versiones
de piedras. `trio` y `ventana` no se volvieron a probar.

## Problemas conocidos

- Los números nuevos (75 de vida, 4.2 s, mitad y mitad) salen de las dos partidas de Leandro y dos del bot:
  hay que jugarlo para afinarlos.
