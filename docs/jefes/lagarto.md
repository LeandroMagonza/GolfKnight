# El Lagarto lancero (`lagarto`)

**Qué pone a prueba: interceptar lo que vuela.** Idea de Leandro (14/10): «el lagarto podría aparecer e ir
haciendo rolls y movimientos laterales, y tirar lanzas rectas por lugares donde no hay enemigos, que podés
interceptar o pegarles con el palo desde frente, no son instantáneas en su vuelo pero tampoco son súper
lentas, deberían ser más rápidas que un goblin, y si te pega a vos te hace daño, y si le pega a la puerta
también».

Código: `src/game/bosses/lagarto/` (`index.ts` las versiones, `pelea.ts` la pelea, `lanza.ts` el modelo de
la lanza). Se prueba con `?ola=10&jefe=lagarto.lanzas` (o el panel B > Pruebas > Jefes).

## Cómo es (lo común a todas las versiones)

- **El cuerpo**: el hombre lagarto del pack (el turquesa con lanza), de 3.4 m, con 44 de vida (+1 por nivel
  de dificultad, + la del talento del golpe 4). Entra corriendo desde el fondo y se planta **a media cancha**
  (z entre 33 y 43: a 24-34 m de la línea). Nunca camina a la puerta: va de costado (los clips de ir de
  costado del pack) y rueda (el «Falling To Roll»).
- **Las lanzas**: cada tanto apunta (levanta el brazo) y el **carril se prende en el piso**, desde él hasta la
  muralla, latiendo cada vez más rápido hasta que suelta. Un **anillo en la línea de los puestos** marca por
  dónde va a cruzar. El carril queda fijo desde que empieza a apuntar. La lanza vuela derecho, a la altura
  del pecho, a 10 m/s (el goblin camina a 3.6), y tarda unos 3 s en llegar a la línea.
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
- **La presión sube sola**: tres fases por la vida que le queda (más de 2/3, más de 1/3, el resto) y, aparte,
  cada 40 s se apura un 8 % (hasta un 40 %), así esperar no sirve.

  | Fase | Apunta | Descansa | Vuela a | Segundo tiro seguido | A vos (si tira a vos) |
  | --- | --- | --- | --- | --- | --- |
  | 1 | 1.15 s | 3 s | 10 m/s | — | 35 % |
  | 2 | 1 s | 2.6 s | 11.5 m/s | 30 % | 45 % |
  | 3 | 0.85 s | 2.2 s | 13 m/s | 50 % | 50 % |

  El segundo tiro apunta 0.6 s y va al otro lado (si el primero fue a la puerta, a vos, y al revés): ahí no
  se pueden parar las dos siempre, y hay que elegir qué vida cuidar.
- **Apuntando no esquiva**: mientras levanta el brazo y suelta es la ventana para pegarle (el ícono de la
  esquiva se apaga). Es una decisión: pegarle a él ahora, o ir a ponerse para la lanza que viene.

## Las versiones

| id | Qué tiene de distinto |
| --- | --- |
| `lagarto.lanzas` | La base. Las lanzas se bajan a pelotazos. Tira a la puerta y a vos. Esquiva al apuntarle (rodando). |
| `lagarto.puerta` | Igual, pero **solo tira a la puerta**: interceptar puro, sin la duda de correrse. |
| `lagarto.pasos` | Igual que la base, pero **no esquiva al apuntarle**: se mueve solo, con pasos de costado y rolls al azar cada 1.3-2.8 s. Hay que adelantarse a dónde va a estar (o pegarle cuando apunta, que se queda quieto). |
| `lagarto.atajada` | Las lanzas **no se bajan** (las pelotas las atraviesan): se **devuelven** pegándole a la pelota parado en su carril justo cuando llega. La devuelta vuelve dorada y le saca 3, 4 o 5 según el golpe. |
| `lagarto.doble` | Las dos cosas: de lejos se bajan a pelotazos, y de cerca (a menos de 4 m de la línea) la pelota que la toca, o el golpe en su carril cuando llega, la devuelve. |

### Cómo se le gana

- **Bajar una lanza (lanzas, puerta, pasos, doble)**: cualquier pelota que la toca la rompe (tiene 1 de
  vida, todo golpe la rompe). Lo más seguro es **de frente**: ir al puesto donde está el anillo (correrse
  cargando alinea el último metro), apuntarle a él y tirar el driver: la pelota hace el mismo camino que la
  lanza y se la come. Si encima el lagarto está apuntando (no esquiva), el mismo driver le pega a él después.
  De costado también se puede, pero hay que adelantarse: el driver cruza el carril en un instante y la
  lanza avanza 3 m cada 0.3 s. El wedge sirve para cruzarla: el globo cae en el carril delante de la lanza
  y el área (4-5 m) la agarra si cae a tiempo.
- **La esquiva (todas menos pasos)**: como la de siempre: si le apuntás (a unos 2 m de la línea) salta, acá
  rodando 4 m, y recarga en 4.5 s. **Recibir daño no se la recarga** (la de siempre sí): con 44 de vida
  sería cebarla antes de cada golpe. Se ceba con un tiro barato, o se le pega mientras apunta.
- **Devolver (atajada, doble)**: parado en el carril (el anillo), le pegás a la pelota cuando la lanza está a
  menos de 3 m de la línea, o un poco antes (vale si te llega en los 0.3 s que siguen al golpe). Hace falta
  tener pelota en ese puesto. Pifiar (el wedge 1) no la devuelve.

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
- `PARRY`: hasta dónde se devuelve, cuánto después del golpe vale, cuánto de costado, y lo que saca.

## Cómo le fue al bot

(se completa con las tandas)

## Problemas conocidos y dudas

(se completa)
