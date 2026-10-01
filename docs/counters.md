# Counters por enemigo, y un draft más táctico

Análisis del 1/10/2026, pedido por Leandro. Todo sale de leer el código tal como está publicado (versión
1/10 14:24), no de la intención de diseño: donde el código y los comentarios no coinciden, está anotado.
Nada de esto está implementado; las propuestas del final esperan su decisión.

## Lo corto

- Los counters existen, y varios son claros: el **wedge** contra el escudo, el **fuego** contra el
  blindaje, el **eco** contra el divino, la **granada** contra casi todo lo que se puede silenciar.
- Pero **el draft no ayuda a usarlos**: el sorteo de cartas no mira qué enemigos vienen, los poderes de
  apoyo nunca se anuncian, y una habilidad puntual sale entre las tres cartas más o menos 1 de cada 16
  veces. Hoy elegir carta es elegir lo que suena mejor, no lo que te sirve contra lo que viene.
- **Contra los fantasmas, todo lo que suma daño no sirve** (lupa, potencia, herrero, en racha, crítico
  de hielo), porque el tope de 1 por golpe se aplica al final. Lo único que sirve es pegar más veces.

## Cómo se calcula un golpe (y por qué importa para los counters)

`Horde.damage`, en este orden:

1. **Inmune** (aura «invencible» cerca): no pasa nada.
2. **Divino**: se come el golpe entero, sea cual sea, y recarga.
3. **Vulnerable** (granada o lupa): +1, salvo al fuego.
4. **Congelado**: ×2, salvo al fuego (y lo descongela).
5. Redondeo, mínimo 1.
6. **Blindaje**: resta su nivel (al fuego no).
7. **Escudo**: resta su nivel, si el golpe le llegó de frente.
8. **Etéreo**: nada pasa de 1.

Consecuencia: todo lo que suma (vulnerable, crítico, potencia, herrero) sirve contra blindaje y escudo,
porque suma antes de que resten; y no sirve contra el etéreo, porque el tope va después de todo.

## Los poderes, uno por uno

| Poder | Qué hace | Lo rompe | Ayuda | No sirve |
|---|---|---|---|---|
| **Escudo 1–3** | Bloquea la pelota que le llega de frente más rasante que 45° y le resta su nivel al daño. También tapa el área que explota delante suyo, y a los que tiene atrás | **Wedge**: cae a más de 45°, nunca lo bloquea; y si revienta detrás del escudo, pasa entero. **Granada** (lo baja). **Fuego**: prende aunque el escudo pare la pelota. **Rayo**: los saltos no miran el escudo. **Carrito**. Hoyo | Hierro que le pega arriba (más del 62 % de su altura). Golpe de nivel 2+ o empujón (palazo, viento): lo aturde y baja el escudo un rato, salvo a los pesados. Lupa, potencia, herrero, crítico de hielo (suman antes de que reste). Bandera: los da vuelta | Driver y putter de frente |
| **Muro** (solo élite) | Escudo total: de frente no pasa nada, ni pelota ni área, y cubre a los de atrás | Granada, wedge reventando detrás, fuego, rayo, carrito | — | Todo de frente. El hoyo no traga élites |
| **Blindaje 1–3** | Le resta su nivel a cada golpe | **Fuego** (no le resta: es la respuesta pensada). **Granada**: se lo saca y además lo deja vulnerable | Golpes de 4. Lupa, potencia, herrero, en racha, crítico de hielo. Carrito (3–4). Hoyo | Rayo sin maestría (pega 1). Wedge (pega hasta 2: contra blindaje 2 o 3, nada). Pólvora a blindaje 2+ |
| **Etéreo** (fantasma) | Nada le saca más de 1 por golpe | Pegarle muchas veces: **fuego** (cada mordisco es 1), **rayo** (1 por salto), **eco**, **clon**, **lluvia de pelotas** y **caddie** (más tiros), el driver que atraviesa una fila, las áreas. Hoyo (no a élites) | — | **Lupa, potencia, herrero, en racha, crítico de hielo, maestría del rayo ×2**. La **granada no lo apaga** |
| **Divino** | Se come el primer golpe de lo que sea (hasta un mordisco de fuego o un salto de rayo) y recarga en 5 s (élite: 3 s) | **Eco** (pensado para eso). **Fuego**: el primer mordisco se lo come, el resto pega. **Rayo**. El hierro o el wedge, que pegan impacto y área en el mismo tiro. Clon. Hoyo (lo traga sin pasar por el divino; no a élites) | — | La **granada no lo saca**. Un golpe grande solo |
| **Esquiva** | Cuando tu carga pasa del nivel 1 al 2, los que están cerca de la línea del tiro saltan 3.2 m de costado. Recarga 5 s | **Todo lo que no es tu carga**: los tiros de habilidad (salen al instante), granada, hielo, pólvora, hoyo, carrito, rayo, fuego. **Silenciado, congelado o aturdido no esquiva**. **Fintar**: cargar hasta el 2 para que salte, cancelar, y tirar antes de los 5 s | Áreas grandes del wedge (radio 3.5–5: casi siempre alcanzan el salto). Perfecto de regalo (arranca clavado arriba y no pasa por el 1→2; accidental) | Eco y clon: siguen la línea vieja, el que esquivó ya no está ahí |
| **Invencible** (apoyo) | Todos los que están a 8 m del que la lleva son inmunes a todo | **Granada**: silencia al que la lleva y los silenciados no pueden quedar protegidos. **Matar al que la lleva** (a él no lo protege nadie). Sacarlos del radio: palazo, viento del hierro, bandera | — | Fuego, rayo y pólvora mientras dura |
| **Cura** (apoyo) | +1 de vida cada 3 s a los que están a 6 m | Granada. Matar de un golpe. Separarlos | — | Daño de a poco (fuego, rayo) |
| **Bandera** (apoyo) | Mientras vive, todos tienen +1 de vida. Se queda al fondo, a 51 m | Granada. Driver largo (la banda lejana pega 2/3/4) | — | — |
| **Hechicero** (apoyo) | Se planta a 34 m y te tira a tu puesto cada 4.5 s | Cambiarte de puesto. Granada. Bandera: el atraído no conjura (accidental) | — | — |
| **Kamikaze** (estampida) | Explota (4 de daño, 3.6 m) al morir, al tocarte o en la puerta, y lastima también a los otros enemigos | **Hoyo**: lo desactiva. Matarlo en medio del grupo: el área gratis es tuya | — | La granada no lo desactiva |

### Los cuerpos

- **Alma en pena**: 2 de vida, rápida, va por vos (no a la puerta). Te agarra: −1 y 1.5 s sin poder
  hacer nada. **No tiene counter salvo matarla en el camino**: la bandera no la engaña y agarrado no
  podés usar nada.
- **Gólem** (jefe): 80 de vida, se planta a 22 m y le tira piedras a la puerta cada 4 s. Sin poderes,
  el hoyo no lo traga y el viento no lo mueve. Es una carrera de daño sostenido.
- **Élites**: el cuerpo fuerte con la versión dura del poder, y +2 a +4 de vida. Los pesados (caballero,
  gólem chico) no se aturden, y **el hoyo no traga élites**. El élite etéreo tiene 11–12 de vida, así
  que hay que pegarle 11–12 veces.

## La pregunta puntual: ¿qué le sube el daño a los fantasmas?

Hoy, **nada le sube el daño por golpe**: el tope de 1 va último. Lo que funciona es multiplicar los
golpes: fuego, rayo, eco, clon, lluvia de pelotas y caddie, y el hoyo para los que no son élite.

Tu idea de la lupa encaja bien: **el agrandado recibe hasta 2 por golpe en vez de 1**. Le da a la lupa un
rol que hoy no tiene (hoy es un +1 que compite con la granada, y la granada además silencia), y no
rompe la regla del fantasma: sigue siendo un enemigo de muchos golpes, nada más que la mitad.

Para decidir:

| Opción | Qué pasa | Mi opinión |
|---|---|---|
| **Solo la lupa** sube el tope a 2 | La lupa pasa a ser *el* counter del fantasma; la granada sigue siendo el de escudo, blindaje y auras | **Recomendada**: cada habilidad con su enemigo |
| Todo lo vulnerable (lupa y granada) | La granada se vuelve counter de casi todo | No: le quita sentido a la lupa y le suma a la granada, que ya es la mejor carta |
| La lupa le saca el etéreo del todo | El fantasma agrandado recibe el golpe entero | Demasiado: con un crítico de 4 se va de un golpe y el élite deja de ser un problema |

Ojo, de paso: el **herrero** nuevo tampoco sirve contra fantasmas. Está bien así (sirve contra
blindaje y escudo), pero que se sepa.

## Lo accidental y lo que no coincide

Counters que existen sin que nadie los haya pensado:

- El rayo pasa el muro del élite.
- Un golpe de nivel 2+ aturde y eso baja el escudo un rato.
- La bandera da vuelta a los de escudo y no deja conjurar al hechicero.
- El perfecto de regalo no dispara la esquiva.

Código y comentarios que dicen otra cosa (para corregir uno de los dos):

- `core/shield.ts` dice que **congelar baja el escudo**; el código no lo hace.
- `core/waves.ts` dice que **al jefe no se lo congela**; el código sí lo congela.
- Bandera + granada: si silenciás la bandera y se termina el silencio, **los que quedaron en 1 vuelven
  a 2**.

Huecos:

- Nada saca el divino directamente: la respuesta es siempre "pegarle más veces".
- Contra el élite etéreo y el élite divino solo sirve lo de muchos golpes (el hoyo no los traga).
- El alma en pena no tiene counter (ver arriba).

## Por qué el draft hoy no es táctico

- Al empezar se ven arriba los **3 íconos de los escenarios y la calavera**; el nombre del poder, solo
  al pasar el mouse.
- Los **2 poderes de apoyo** de la partida (invencible, cura, bandera, hechicero) **no se anuncian
  nunca**.
- La primera carta llega después de la primera oleada, así que **el primer escenario se juega con lo
  básico**.
- En la pantalla de cartas dice «Próxima oleada: …», que nombra el poder solo en la primera oleada de
  cada escenario; las demás dicen «Refuerzos» o «Élite».
- **El sorteo no mira el recorrido**: pesa 3 subir una habilidad que tenés, 1 una nueva (de 28), 2 una
  mejora y 4 una maestría. Una habilidad puntual (la granada, por ejemplo) sale entre las tres cartas
  más o menos un 6 % de las veces.

## Propuesta: que el draft mire lo que viene

De menor a mayor esfuerzo; las tres primeras van juntas.

1. **Ver el recorrido entero**, apoyos incluidos, con nombre (no solo en el tooltip). Y en la pantalla
   de cartas, grande: «Se viene: **Fantasmas**», con el ícono que llevan los enemigos.
2. **Cada carta dice contra qué sirve**, con los mismos íconos que llevan los enemigos encima: «Sirve
   contra: 🛡 ⛨». La tabla de arriba se pasa a datos (`COUNTERS` en `core/cards.ts`) y de ahí salen
   las etiquetas. Es lo que hace que una carta se lea como una respuesta y no como un número.
3. **Una de las tres cartas siempre sirve contra el próximo escenario**, igual que hoy el botiquín sale
   sí o sí cuando la partida viene mal. Las otras dos, como siempre. Así hay decisión: ¿tomo el
   counter de lo que viene, o subo lo que ya tengo y me las arreglo?
4. (Más grande, opcional) **Una carta antes de la primera oleada**, mirando el recorrido, para que el
   primer escenario también se elija.

Mi recomendación: **1 + 2 + 3**, y la lupa contra fantasmas en la misma tanda, porque sin la etiqueta
«sirve contra fantasmas» nadie va a descubrir que la lupa ahora sirve para eso.
