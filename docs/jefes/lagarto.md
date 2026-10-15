# El Lagarto lancero (`lagarto`)

**Qué pone a prueba: interceptar lo que vuela.** Idea de Leandro (14/10): «el lagarto podría aparecer e ir
haciendo rolls y movimientos laterales, y tirar lanzas rectas por lugares donde no hay enemigos, que podés
interceptar o pegarles con el palo desde frente, no son instantáneas en su vuelo pero tampoco son súper
lentas, deberían ser más rápidas que un goblin, y si te pega a vos te hace daño, y si le pega a la puerta
también».

Código: `src/game/bosses/lagarto/` (`index.ts` las versiones, `pelea.ts` la pelea, `lanza.ts` el modelo de
la lanza). Se prueba con `?ola=10&jefe=lagarto.lanzas` (o el panel B > Pruebas > Jefes).

## Cómo es (lo común a todas las versiones)

- **El cuerpo**: el hombre lagarto del pack (el turquesa con lanza), de 3.4 m, con 52 de vida (+1.5 por nivel
  de dificultad, + la del talento del golpe 4; tenía 80). Entra corriendo desde el fondo y se planta **a media
  cancha** (z entre 30 y 40: a 21-31 m de la línea). Nunca camina a la puerta: va de costado (los clips de ir
  de costado del pack) y rueda (el «Falling To Roll»).
- **Las lanzas**: cada tanto apunta (levanta el brazo) y el **carril se prende en el piso**, desde él hasta la
  muralla, latiendo cada vez más rápido hasta que suelta. **Dos puntas de flecha en la línea de los puestos**
  marcan por dónde va a cruzar y para dónde va (antes era un anillo, y parecía una pelota). El carril queda
  fijo desde que empieza a apuntar (salvo que ruede apuntando: ver la esquiva). La lanza vuela derecho, a la
  altura del pecho, a 12 m/s de entrada (el goblin camina a 3.6), y tarda unos 2.5 s en llegar a la línea.
  - **Naranja**: a la puerta (a algún lugar de la abertura).
  - **Rojo**: a tu puesto (adonde estás parado, o adonde ibas, cuando empezó a apuntar). Si te corrés, la
    lanza **sigue hasta la puerta**: correrse salva tu vida y le cuesta 1 a la puerta. Bajarla salva las dos.
  - Lo que no se para **le pega a lo primero que encuentra**: a vos (1 de vida) si estás en el carril cuando
    cruza la línea, aunque sea una de las naranjas; si no, a la puerta (1). En el respiro de invulnerable te
    pasa de largo.
- **Tira por donde no hay enemigos.** Antes de apuntar busca un carril limpio (nadie de la horda a menos de
  1 m, ni ahora ni en un segundo); si desde donde está no hay, se corre de costado hasta donde sí; si no hay
  en ningún lado, espera. Y si uno de la horda se cruza igual, **la lanza se clava en él** (le saca 2). O sea:
  **tu horda te cubre**, y limpiar el campo le abre carriles.
- **La presión sube sola**: tres fases. La 1 mientras sale la escolta; **la 2 cuando se termina la escolta**
  (un cartel: «¡El lagarto se enfurece!»); la 3, ya a solas, con menos del 40 % de vida. Aparte, cada 40 s se
  apura un 8 % (hasta un 40 %), así esperar no sirve. «Se terminó la escolta» es: pasó lo que tarda en salir
  (la cuenta la hace `escort` en `index.ts`) y no queda nadie de la horda vivo, o 20 s después igual.

  | Fase | Apunta | Descansa | Vuela a | Segundo tiro seguido | A vos (si tira a vos) |
  | --- | --- | --- | --- | --- | --- |
  | 1 (con escolta) | 1 s | 2.5 s | 12 m/s | 10 % | 35 % |
  | 2 (a solas) | 0.85 s | 2.2 s | 13.5 m/s | 30 % | 45 % |
  | 3 (a solas, < 40 %) | 0.75 s | 1.9 s | 15 m/s | 45 % | 50 % |

  El segundo tiro apunta 0.6 s y va al otro lado (si el primero fue a la puerta, a vos, y al revés): ahí no
  se pueden parar las dos siempre, y hay que elegir qué vida cuidar.
- **Soltando no esquiva**: el brazo que baja después de soltar (0.35 s) es la ventana segura para pegarle (el
  ícono de la esquiva se apaga). **Apuntando sí esquiva** (desde el 15/10): rueda y sigue apuntando desde donde
  cae, con el carril trazado de nuevo al mismo puesto (o al mismo lugar de la puerta).

## Las versiones

| id | Qué tiene de distinto |
| --- | --- |
| `lagarto.lanzas` | La base. Las lanzas se bajan a pelotazos. Tira a la puerta y a vos. Esquiva al apuntarle (rodando). |
| `lagarto.puerta` | Igual, pero **solo tira a la puerta**: interceptar puro, sin la duda de correrse. |
| `lagarto.pasos` | Igual que la base, pero **no esquiva al apuntarle**: se mueve solo, con pasos de costado y rolls al azar cada 1.3-2.8 s. Hay que adelantarse a dónde va a estar (o pegarle cuando apunta, que se queda quieto). |
| `lagarto.atajada` | Las lanzas **no se bajan** (las pelotas las atraviesan): se **devuelven** pegándole a la pelota parado en la flecha cuando la lanza entra en la franja dorada. Cada carril cruza por un puesto, y ahí deja pelota. La devuelta vuelve dorada y le saca 3, 4 o 5 según el golpe. |
| `lagarto.doble` | Las dos cosas: antes de la franja dorada se bajan a pelotazos; en la franja dorada (los últimos 4 m), lo que la toca la devuelve (una pelota de cualquier puesto, o el golpe parado en la flecha). |

### Cómo se le gana

- **Bajar una lanza (lanzas, puerta, pasos, doble)**: cualquier pelota que la toca la rompe (tiene 1 de
  vida, todo golpe la rompe). Lo más seguro es **de frente**: ir al puesto donde está el anillo (correrse
  cargando alinea el último metro), apuntarle a él y tirar el driver: la pelota hace el mismo camino que la
  lanza y se la come. Si encima el lagarto está apuntando (no esquiva), el mismo driver le pega a él después.
  De costado también se puede, pero hay que adelantarse: el driver cruza el carril en un instante y la
  lanza avanza 3 m cada 0.3 s. El wedge sirve para cruzarla: el globo cae en el carril delante de la lanza
  y el área (4-5 m) la agarra si cae a tiempo.
- **La esquiva (todas menos pasos)**: como la de siempre: si le apuntás (a unos 2 m de la línea) salta, acá
  rodando 6.5 m, y recarga en 3 s. También apuntando. **Recibir daño no se la recarga** (la de siempre sí):
  sería cebarla antes de cada golpe. Se ceba con un tiro barato, o se le pega justo cuando suelta.
- **Devolver (atajada, doble): la franja dorada.** Los últimos 4 m del carril antes de la línea están
  pintados de dorado, y la flecha de la línea se pone dorada (y más grande) mientras la lanza está ahí.
  **Lanza en lo dorado + cualquier cosa que la toque = devuelta**: una pelota (de cualquier puesto, también
  de lejos y de costado), o tu golpe parado en la flecha (vale si la lanza entra en lo dorado hasta 0.35 s
  después de pegarle). Antes de lo dorado, en `doble`, la pelota la rompe. Pifiar (el wedge 1) no la devuelve.
  En `atajada` cada carril cruza la línea **justo en un puesto**, y el lagarto **deja una pelota ahí** si no
  hay (al apuntar y al soltar): siempre hay con qué devolverla.

## Números para tocar (arriba de `pelea.ts`)

- `BODY`: alto, radio, vida (`hp`) y vida por nivel.
- `BAND`: entre qué z se planta y hasta qué x.
- `PHASES`: por fase, cuánto apunta, cuánto descansa, la velocidad de la lanza, la chance del segundo tiro
  y la de tirarte a vos. `QUICK_WINDUP` (el segundo tiro), `HURRY` (cuánto se apura con el tiempo),
  `PER_LEVEL` (la dificultad).
- `SPEAR`: altura del vuelo, radio para las pelotas, a cuánto te pega, lo que saca (a vos, a la puerta, al
  aliado que se cruza), lo limpio que tiene que estar el carril.
- `DODGE_EVERY`, `ROLL` (la esquiva y el roll), `STEPS` (los pasos al azar de `pasos`), `RELOCATE` (la
  chance de cambiar de lugar después de cada tiro).
- `PARRY`: el largo de la franja dorada, cuánto después del golpe vale, cuánto de costado, y lo que saca.
- `SHAFT`: lo que toca la pelota de la lanza (de la cola a la punta, y el radio).
- `ESCORT`: cuándo se da por terminada la escolta (la fase 2).

## Lo que cambió el 15/10 (lo que dijo Leandro)

Leandro jugó las cinco (logs/partidas-jefes-leandro.txt: `lanzas` 155 s, `pasos` 122 s, `doble` 123 y 145 s).

1. «Me gustó, me parece que tiene mucha vida, podría hacerse rápido antes y tener menos vida, quizás el
   primer enrage es cuando termina la wave, y haría que el salto lo tenga más seguido, que salte más lejos, y
   quizás incluso que pueda hacer roll mientras carga la lanza». → Vida 80 → 52. Fase 1 más rápida (apunta 1 s,
   descansa 2.5, 12 m/s). **La fase 2 es cuando se termina la escolta**, no por vida. Esquiva cada 3 s (era
   4.5), rueda 6.5 m (era 4.2), y **rueda también apuntando** (sigue apuntando desde donde cae). En `pasos`,
   pasos y rolls cada 0.9-2 s (eran 1.3-2.8) y más largos.
2. «El indicador de adónde va la lanza es medio confuso porque la línea está bien pero el círculo te hace
   pensar que hay pelota y no hay». → El anillo de la línea ahora son **dos puntas de flecha** del color del
   carril, apuntando para donde va la lanza (`CrossMark`, en `lanza.ts`).
3. «Haría que la lanza vaya un poco más rápido». → 12 / 13.5 / 15 m/s (eran 10 / 11.5 / 13).
4. Bug: «si le pegás mientras está corriendo para adelante al principio, hace el roll, pero no desde donde
   está, sino desde hacia donde iba a pararse». → Era el encierro en su franja (z de 30 a 40), que se aplicaba
   rodando aunque todavía estuviera entrando desde el fondo: lo traía de golpe a z 41.5. Ahora el encierro
   empieza recién cuando llega, y el roll sale desde donde está.
5. «Está raro a veces pegarle a la lanza, no estoy seguro si apunté mal o si el driver le pasa por abajo
   cuando es de cerca y le pego de costado, pegarle de frente es mucho más consistente». → Por abajo no pasaba
   (la parte que tocan las pelotas va del piso a 1.75 m, y el driver vuela a menos de 1 m). Lo que fallaba era
   el largo: era un círculo de 0.9 m en el medio de una lanza de 4 m, así que de costado había que pegarle al
   medio justo, y la punta y la cola no se tocaban (de frente la pelota sigue el carril y siempre da). Ahora
   el círculo se corre por el asta hasta el punto más cerca de la pelota que viene (`SHAFT`): **toca toda la
   lanza que se ve**, de la cola a la punta, con 0.6 m de radio (más los 0.12 de la pelota).
6. `atajada`: «me parece bastante complicado porque no siempre hay pelota donde tira, me costó entender cómo
   hacer para reflejar». → Cada carril cruza la línea justo en un puesto, y **deja pelota ahí** (de regalo, no
   cuenta para el tope de los guardias). La franja dorada dice cuándo: «parate en la flecha y pegale a la
   pelota cuando la lanza entra en lo dorado» (es el cartelito del primer tiro). La franja es de 4 m (era 3).
7. La pregunta: «probé el doble y vi que puedo pegarle a la lanza con una pelota pero cuando está cerca de la
   línea y cuenta como devolver, pensé que devolver era solo si el caballero estaba cerca, ¿cuál es el
   criterio?». → El criterio **nunca fue la distancia al caballero**, sino la de la lanza a la línea, y había
   dos reglas parecidas sin marca: el golpe desde su carril con la lanza a menos de 3 m, y cualquier pelota
   que la tocara a menos de 4 m (de cualquier puesto: por eso la de lejos contaba). Ahora es **una sola regla,
   a la vista**: la lanza en la franja dorada (4 m) se devuelve con lo que la toque, sea tu pelota de lejos o
   tu golpe parado en la flecha; antes de lo dorado, la pelota la rompe.

## Cómo le fue al bot

- Primera tanda (15/10, antes de los cambios): ganó solo `doble`; las lanzas a la puerta le ganaban.
- Después de los cambios (`doble`, 2 partidas): perdió las dos por la puerta a los 51 y 54 s, con el lagarto
  en 14 y 13 de 52 (ya en fase 3: la escolta se terminó a los ~40 s). Derribó 11 y 7 de ~20 lanzas, devolvió
  1 y 2, y 8-9 llegaron a la puerta. El bot no se para para devolver: para él es más difícil que antes. Después
  de esto bajé un poco el segundo tiro de las fases 2 y 3 (40 → 30 %, 55 → 45 %) y el descanso (2.1 → 2.2,
  1.8 → 1.9 s).

## Problemas conocidos y dudas

- La fase 2 depende de cuándo se termina la escolta: si a Leandro lo mata antes, la pelea entera es la fase 1.
  Si queda corto, se puede sumar la fase 3 por vida también con escolta.
- Rodar apuntando le saca la ventana de pegarle mientras apunta: la segura ahora es justo cuando suelta, o
  después de cebarle la esquiva (recarga en 3 s). Si queda muy esquivo, subir `DODGE_EVERY`.
