# Golf Knight: diseño de combate

18/9/2026. Ideas para que el juego premie lo que ya es divertido y para robarle más al golf.
Nada de esto está implementado todavía, salvo donde dice lo contrario.

> **19/9/2026:** después del primer playtest largo cambió bastante el rumbo. La sección
> "Rediseño tras el playtest" manda sobre todo lo anterior donde se contradigan.
>
> **21/9/2026:** la última sección, "Prueba del 21/9", cambia el movimiento, la vida y el daño, y manda
> sobre todo lo anterior.
>
> **20/9/2026:** antes de esa están las "Notas del 20/9", con las ideas pendientes de decidir y lo que se
> hizo ese día.

## Resumen

Lo divertido del juego es alinearse para pegarle a varios enemigos con una sola pelota. Hoy el juego
no premia eso: premia apretar rápido con el driver. Propongo cuatro cambios, en este orden:

1. **Que cargar valga la pena.** El daño y la cantidad de enemigos que atraviesa la pelota suben con
   la potencia. Un toque rápido pega la mitad y a un solo enemigo.
2. **Palos que se cargan solos** (tu idea del cooldown). Cada palo tiene un tiro especial que se
   recarga con el tiempo. Con el especial gastado, el palo sigue sirviendo con un tiro básico. Rotar
   palos te da un especial cada dos o tres segundos.
3. **Par por oleada**, robado del golf. Cada tiro es un golpe y cada oleada tiene un par. Terminar
   bajo el par da premio. Es la forma más directa de premiar la eficiencia sin prohibir nada.
4. **Terreno por zonas**, no por alturas: bunkers, agua y obstáculos sobre piso plano. Dan embudos
   donde los enemigos se ponen en fila, y separan al driver del wedge. Las lomas de verdad quedan
   para más adelante porque cuestan mucho más.

El poder global que afecta al próximo tiro lo descartaría. Las razones están más abajo.

## El problema hoy

Tenés razón en los dos diagnósticos, y los números del juego lo confirman.

**Cargar el driver no rinde.** El daño no depende de la potencia: un toque pega 60, igual que un
tiro cargado a fondo. Lo único que da la carga es distancia, y el swing perfecto (×1.5) solo existe
al tope del medidor.

| Forma de pegar con el driver | Tiempo por tiro | Daño por tiro | Daño por segundo |
| --- | --- | --- | --- |
| Toques sin cargar | ~0.5 s | 60 | ~120 |
| Carga completa, perfecto | ~1.4 s | 90 | ~64 |

Pegar sin cargar hace casi el doble de daño por segundo. Y la distancia no hace falta, por dos
motivos: los enemigos vienen hacia vos, y el driver sale tan rasante que la pelota sigue rodando
mucho más allá de donde cae, así que un toque "de 18 metros" llega a 30.

**El driver es el mejor palo en todo.** Tiene el mayor daño (60), el mayor alcance y además
atraviesa a todos. No paga nada por eso: los otros palos solo ganan en situaciones puntuales. El
putter se salva porque el congelamiento resuelve un problema distinto (bichos fuertes), que es
justo lo que notaste.

**No hay costo por tiro.** Pelotas infinitas y sin penalidad por errar hacen que la mejor estrategia
sea tirar mucho, no tirar bien. Alinear tres enemigos y atravesarlos se siente bien, pero el juego
no te da nada extra por hacerlo.

## Qué le podemos robar al golf

Los juegos de golf son interesantes por pocas cosas, y casi todas sirven acá.

| Idea del golf | Por qué funciona allá | Cómo quedaría acá | Costo | Opinión |
| --- | --- | --- | --- | --- |
| **Par y golpes** | Menos golpes es mejor: cada tiro importa | Par por oleada, premio por terminar abajo | Bajo | La más valiosa. Premia exactamente lo divertido |
| **Cada palo cubre una distancia** | Elegir palo es la primera decisión de cada tiro | Rangos que casi no se pisan, y trayectorias que resuelven obstáculos distintos | Bajo | Hacerlo junto con el terreno |
| **Riesgo al pegar fuerte** | Más potencia, ventana de precisión más chica | La zona perfecta se achica a más potencia; pasarse del tope desvía el tiro | Bajo | Sí, da tensión a la carga |
| **Efecto (draw y fade)** | Curvar la pelota para esquivar o acomodar | Mantener A o D mientras cargás curva el tiro: enhebrás enemigos que no están en línea con vos | Medio | Muy buena para la fantasía de alinear. Segunda etapa |
| **El lie: fairway, rough, bunker** | Dónde está la pelota cambia el tiro | Dónde estás parado cambia tu swing; dónde cae la pelota cambia cuánto rueda | Bajo | Sí, con el terreno por zonas |
| **Viento** | Cambia cada hoyo, afecta más a los tiros altos | Cambia por oleada; mueve al wedge, casi no toca al driver ni al putter | Bajo | Barato y separa palos. Tercera etapa |
| **Pendientes y greens** | Leer la caída es un juego en sí mismo | Lomas donde la pelota rueda cuesta abajo | Alto | Más adelante, ver Terreno |
| **Medidor de tres clicks** | Potencia y después precisión | Un segundo timing para la dirección | Bajo | No. Con hordas encima es demasiado lento |
| **Nombres de golf para las hazañas** | Birdie, eagle, hoyo en uno | Tres o más bajas con una pelota: "¡Hoyo en uno!" | Muy bajo | Sí, es sabor gratis |

Referencias para mirar: Everybody's Golf y Mario Golf por el medidor y el efecto, Cursed to Golf
por los golpes limitados y las cartas de poder, What the Golf por animarse a romper las reglas.

## Que cargar valga la pena

La potencia tiene que dar algo más que distancia. Propuesta:

- **Daño según potencia.** Un toque pega el 50 % del daño del palo y la carga completa el 100 %. El
  perfecto sigue en ×1.5.
- **Efecto según potencia.** Lo que hace especial a cada palo también escala:
  - Driver: atraviesa 1 enemigo con un toque, 3 con carga completa, todos con perfecto.
  - Hierro: la pelota pica y sigue; cuantos más piques vivos, más enemigos toca.
  - Wedge: el radio de la explosión va de 2 m a 3.6 m.
  - Putter: el empuje y los segundos de congelamiento crecen con la carga.
- **Un respiro después de cada tiro.** Hoy se puede volver a cargar 0.22 s después del impacto.
  Subirlo a unos 0.45 s le saca ventaja al spam sin que se sienta pesado.
- **Riesgo al tope.** La zona perfecta hoy es el último 8 % del medidor para todos los palos. Que el
  driver la tenga más chica (5 %) y el putter más grande (12 %).

Con esos números, el driver a toques hace unos 40 de daño por segundo contra un solo enemigo. Una
carga completa contra tres enemigos en fila hace 180 en 1.75 s, unos 100 por segundo. Cargar gana
siempre que haya dos o más en línea, que es justo cuando debería ganar.

Además hacen falta **motivos para tirar lejos**. Hoy no hay ninguno porque todo viene caminando
hacia vos. Los da la lista de enemigos nuevos: un chamán que se queda atrás curando y un gólem que
tira piedras a la puerta desde lejos son blancos que hay que bajar a 40 metros.

## Palos que se cargan solos

Tu idea del cooldown me parece la correcta, y mejor que el poder global. Así la armaría:

- Cada palo tiene su propia carga de encantamiento, que se llena con el tiempo aunque el palo esté
  guardado.
- Con la carga llena, el próximo tiro de ese palo sale encantado y la gasta.
- Sin carga, el palo tira una versión básica: sirve, pero no brilla.
- En la barra de palos cada uno muestra su carga, y el que está listo brilla con su color.
- Un swing perfecto devuelve un tercio de la carga de ese palo. Así la precisión alimenta la rotación.

| Palo | Tiro básico | Tiro encantado | Recarga |
| --- | --- | --- | --- |
| Driver · Rompevientos | Rasante, atraviesa según potencia | Deja una estela de viento: daña todo a 1.5 m de la línea y empuja a los costados | 8 s |
| Hierro 7 · Relámpago | Pica y sigue, pega a los que toca | El rayo salta a 3 enemigos cercanos | 5 s |
| Wedge · Meteoro | Explosión chica al caer | Explosión grande y deja el piso ardiendo 3 s | 7 s |
| Putter · Escarcha | Empuja fuerte y frena un poco | Onda de hielo: congela a todos en un cono adelante | 6 s |

Con cuatro palos y recargas de 5 a 8 segundos, rotando bien tenés un tiro encantado cada dos
segundos. Quedándote con un solo palo, uno cada 5 a 8. El incentivo sale solo, sin obligar a nada.

Una decisión de diseño importante: **atravesar enemigos no debería ser solo del tiro encantado.**
Es lo que hace divertido alinear, y si solo pasa cada 8 segundos el juego pierde su mejor momento.
Por eso lo dejé en el tiro básico del driver, atado a la potencia.

Si más adelante hay niveles y mejoras, este sistema los recibe bien: bajar una recarga, sumar un
salto al rayo o agrandar la estela son mejoras que se entienden solas. Las pelotas especiales que
traerían los guardias también encajan, como un tercer modificador del tiro.

## Par por oleada

Cada oleada muestra un par, por ejemplo "Par 14". Cada swing suma un golpe. Al terminar la oleada:

- Bajo el par: premio. En el juego corto, reparar la puerta o curarte. En uno largo, monedas para mejoras.
- En el par: nada.
- Sobre el par: nada malo. El castigo de tirar de más ya es el tiempo que perdés.

El par se calcula solo a partir de la oleada, como una fracción de la cantidad de enemigos. Si el
par es menor que los enemigos, la única forma de cumplirlo es con tiros que bajen a más de uno. Eso
convierte a "alinearte para ser más eficiente" en el objetivo explícito del juego.

Encima de eso van los carteles de hazaña: dos bajas con una pelota "¡Birdie!", tres "¡Eagle!",
cuatro o más "¡Hoyo en uno!". No cambian nada mecánico y hacen que se sienta golf.

## Terreno

Las lomas son lo que más se parece al golf real, pero son lo más caro de todo el documento. Hoy la
física de la pelota, los enemigos, la puntería y la vista previa asumen piso plano. Con alturas hay
que rehacer los cuatro, y además el tiro se vuelve mucho más difícil de leer desde la cámara de arriba.

Recomiendo empezar por **zonas sobre piso plano**, que dan casi todo el juego por una fracción del costo:

| Zona | Efecto en la pelota | Efecto en los enemigos | Para qué sirve |
| --- | --- | --- | --- |
| Bunker | Cae y se queda: no rueda | Caminan a la mitad | Frena al driver que rueda; buen lugar para un wedge |
| Rough (pasto alto) | Rueda la mitad | Nada | Encuadra el fairway |
| Agua | Se pierde | La rodean | Crea embudos: los enemigos se ponen en fila |
| Rocas y árboles en el campo | Frenan los tiros bajos | Los rodean | El driver no pasa, el wedge sí |
| Camino | Rueda más | Caminan más rápido | Marca por dónde viene la horda |

Lo importante son los **embudos**. Si el agua y las rocas obligan a la horda a pasar por dos o tres
pasos angostos, los enemigos se alinean solos y el juego pasa a ser elegir dónde pararte para
enhebrarlos. Eso es exactamente lo que dijiste que era divertido.

También separa los palos por trayectoria y no solo por daño. El driver necesita línea limpia, el
wedge pasa por arriba de todo, el putter no sirve si hay un bunker en el medio.

El viento entra acá como variación barata entre oleadas. Las lomas de verdad las dejaría para
cuando el juego tenga varios mapas: ahí una cancha con desniveles justifica el costo.

## El poder global, y por qué lo descartaría

La alternativa era un botón que activa un poder y afecta al próximo tiro de cualquier palo.

- Coincido con lo que sentís: hoy los palos no son tan distintos como para que el mismo poder se
  sienta diferente en cada uno. Terminaría siendo "el botón de pegar fuerte".
- Agrega un botón y una cosa más para mirar, sin agregar una decisión nueva.
- No incentiva rotar. Usarías el poder siempre con el mejor palo.

El cooldown por palo resuelve lo mismo y además te empuja a cambiar. Si en algún momento quisieras
un recurso global, que sea algo que se gana jugando bien (por ejemplo con los birdies) y se gasta en
un golpe definitivo. Pero eso es para un juego más largo.

## Enemigos nuevos

Salen de los personajes de PolygonDungeon que ya tenés. Cada uno le pide algo distinto al jugador,
que es lo que termina de separar los palos.

| Enemigo | Cómo se mueve y ataca | Qué le pide al jugador | Estado |
| --- | --- | --- | --- |
| Goblin | Rápido, débil, viene en montón | Putter y hierro; no vale la pena cargar | Hecho (falta el zigzag) |
| Goblin guerrero | Medio; lleva escudo que frena los tiros rasantes de frente | Wedge o hierro por arriba, o congelarlo | Hecho |
| Esqueleto soldado | Marcha en columna de tres | Es el blanco ideal del driver cargado | Hecho |
| Esqueleto caballero | Lento, con mucha vida, no se deja empujar | Escarcha para frenarlo y después todo lo demás | Hecho |
| Chamán goblin | Se queda a 36 m y cura a los que tiene cerca | Tiro largo y preciso: el motivo para cargar a fondo | Hecho |
| Goblin kamikaze | Corre a la puerta y explota | Bajarlo lejos; si explota entre los suyos, mejor | Hecho |
| Gólem de roca | Jefe final; tira piedras a la puerta desde 22 m | Todo lo que tengas | Hecho (las piedras todavía no se pueden bajar de un pelotazo) |
| Jefe goblin | Minijefe; los goblins a su alrededor corren más | Prioridad, o congelar al grupo | Pendiente |

Los ataques están hechos por código (no hay clips de ataque): un golpe de arriba hacia abajo con el
brazo derecho, que el chamán usa con los dos brazos para conjurar y el gólem para tirar. Si bajás de
Mixamo un par de clips de ataque y de muerte, se pueden sumar con el mismo script de retarget.

## Orden que seguiría

1. Enemigos nuevos con sus ataques. **Hecho** el 18/9, junto con el selector de skin.
2. Daño y efecto según potencia, y el respiro entre tiros. Es poco código y arregla lo que más molesta hoy.
3. Palos que se cargan solos, con su indicador en la barra.
4. Par por oleada y carteles de hazaña.
5. Terreno por zonas con embudos.
6. Efecto (curvar el tiro) y viento.
7. Pelotas especiales traídas por guardias, y mejoras entre oleadas si el juego crece.

## Preguntas abiertas

- ¿Atravesar enemigos queda en el tiro básico del driver, atado a la potencia, como propongo? ¿O
  preferís que sea solo del tiro encantado?
- ¿El par da premio dentro de la partida (reparar, curar) o solo puntaje?
- ¿Los bichos cute (lobos, caparazón, dragón) se van del todo o quedan como un segundo bioma?

## Rediseño tras el playtest (19/9/2026)

Feedback de Leandro después de jugar la versión con los enemigos de PolygonDungeon, lo que charlamos
a partir de ahí y lo que quedó implementado. Donde dice **Hecho**, está en el juego y cubierto por
`tools/playtest.mjs`.

### Lo que mostró el playtest

- Los esqueletos en columna empeoraron el juego. Lo divertido era encontrar el ángulo entre
  enemigos sueltos con velocidades distintas. Una formación trae la línea resuelta: te parás en
  su eje y listo. Vale para cualquier formación, también una diagonal.
- El driver era el 80 % del juego. Ni contra enemigos juntos convenía el wedge.
- El escudo era el único freno al driver, pero se resolvía esperando: tres o cuatro wedges lentos
  mientras el resto avanzaba. Difícil sin ser divertido.
- El putter no llegaba a nada: alcanzaba 20 m y el gólem se planta a 22 m de la puerta.
- El jugador casi no se movía de la puerta.
- El palazo es muy fuerte: 30 de daño a hasta cuatro enemigos, con empuje, e ignora el escudo.
- Los kamikazes ayudan más de lo que amenazan.
- El chamán gustaba como concepto (obliga a elegir a quién matar primero), pero no funcionaba:
  caminaba solo, se plantaba lejos y curaba a enemigos que morían de un golpe.
- Que haya enemigos a distancia está bien.

### La idea que ordena todo

El driver es el único palo que hace daño: **es el que cobra**. Los otros tres preparan el cobro.
El hierro abre defensas, el wedge acomoda enemigos y el putter mueve al golfista. Así rotar palos
deja de ser optativo sin que ninguno compita con el driver en su terreno.

### Hecho

**Sin formaciones.** Los enemigos salen sueltos y caminan en línea recta hacia la puerta, cada uno
entre 78 y 122 % de la velocidad de su tipo. Con la diferencia de velocidades alcanza para que las
filas se armen y se deshagan solas. (Hubo una deriva lateral en la primera versión; Leandro prefirió
la línea recta y se sacó.)

**Los palos.** Tres en la barra, el putter en la barra espaciadora y el palazo en Shift:

| Tecla | Palo | Qué hace | Recarga |
| --- | --- | --- | --- |
| 1 | Driver · Rompevientos | Recto, fuerte, atraviesa. Único que daña | no |
| 2 | Hierro 7 · Escarcha | Globo de hielo: congela en un centro chico y enfría alrededor. Después de usarlo vuelve solo el driver | 2 s |
| 3 | Wedge · Vendaval | Globo sin daño que empuja a todos hacia afuera. Perfecto: además los deja expuestos | no |
| Espacio | Putter · Portal | Tira una pelota; Espacio de nuevo salta hasta ella | 8 s el salto |
| Shift | Palazo | Golpe corto alrededor del golfista | 2.5 s |

El rayo en cadena y la explosión con daño desaparecieron. Ya no hay roll.

**Hielo.** Congela siempre en un centro chico (1.3 m) y enfría alrededor (hasta 3 m), con perfecto
o sin él. *Frío* quiere decir: camina al 40 %, no se cubre con el escudo, si es chamán deja de
conjurar, y **recibe 25 % más de daño**. *Congelado* es frío y además no camina ni ataca (pero se lo
puede empujar). Dura entre 3 y 5 s según la carga. El swing perfecto agranda las dos zonas un 30 % y
suma 1.5 s. A los pesados les dura menos. Al jefe nunca lo congela, ni en el centro: lo enfría, y
frío camina y tira piedras al 40 % del ritmo. Una barra celeste debajo de la vida muestra cuánto le
queda; es blanca si está congelado. La marca de caída muestra las dos zonas.

**Wedge que empuja.** Idea de Leandro, y eligió empujar hacia afuera en lugar de atraer: atraer
era demasiado directo (tirar el wedge y después el driver al mismo lugar), mientras que el empujón
obliga a pensar dónde tirarlo para que los enemigos queden en fila. Más fuerte cerca del centro y
con más carga; los pesados casi no se mueven. También sirve para sacar enemigos del aura de un
chamán. El swing perfecto no empuja más (más desplazamiento no servía): deja **expuestos** durante
4 s a los que alcanza, y un expuesto recibe 50 % más de daño. Se ve con una barra naranja sobre la
vida. Frío y expuesto se multiplican entre sí. A futuro abre la puerta a trampas, ríos y puentes:
empujar a alguien a un pozo.

**Putter: portal.** Reemplaza al roll. El primer Espacio tira la pelota hacia el cursor, sin carga;
frena en ese punto (3 a 22 m). Va bastante más rápido que correr: unos 15 m/s de media contra
5.2 m/s del golfista; un putt de 10 m llega en menos de 0.7 s. La pelota queda ahí todo el tiempo que haga falta, marcada con un
faro. El segundo Espacio salta hasta la pelota, aunque siga rodando. Pasarle por arriba la levanta.
El salto no corta la carga ni el swing, da un instante de invulnerabilidad y suelta cualquier agarre.
Solo el salto tiene recarga. Pendiente de pulido: tirar la pelota todavía no tiene animación de putt.

**Chamán.** Camina con el grupo, con las manos en alto, hasta plantarse a 10 m de la puerta. Todo
enemigo a menos de 8 m es inmune: las pelotas del driver le rebotan, y tampoco lo dañan el palazo
ni los kamikazes. El aura se ve como un anillo violeta en el piso y los protegidos laten en violeta.
Un chamán nunca queda protegido, ni por otro chamán. Con hielo encima, el aura se apaga.
Se lo resuelve de tres formas: hielo al chamán y driver a toda la fila, driver directo al chamán si
hay línea limpia, o wedge para sacar a los protegidos del aura.

**Alma en pena.** Enemigo nuevo, el que presenta al putter. Corre más que el golfista y va siempre
por él. Si lo alcanza, lo agarra: no puede caminar ni pegar, y pierde 5 de vida cada medio segundo
hasta que salta por el portal. Al agarrar, la recarga del salto se reinicia, para que siempre haya
salida. Si no se escapa, a los 5 s lo suelta sola y queda aturdida. Congelarla también la suelta.

**Racha del driver.** Tres reglas, las de Leandro:

- **Sube cuando mata.** Cada baja del driver suma +10 % de daño, hasta +50 %. Si el swing fue
  perfecto, cada baja suma tres escalones en lugar de uno.
- **Se mantiene cuando pega sin matar.**
- **Se corta cuando el tiro no le hace daño a nadie:** no le pegó a nada, o solo a escudos e inmunes.

Los otros palos y el palazo no la tocan. Los números caen bien solos: con +50 % un esqueleto o un
goblin guerrero (90 de vida los dos) pasan de dos tiros a uno. El indicador está a la izquierda de
los palos: el multiplicador en grande y cinco marcas; salta cuando sube, se sacude en rojo cuando
se pierde y arde al llegar al tope. El puntaje queda como marcador provisorio.

**Palazo.** Dejó de salir gratis con cada swing: es un botón aparte (Shift o V) con 2.5 s de
recarga. Pega 30 a hasta cuatro enemigos alrededor de un punto un paso adelante del golfista, y
los empuja. Corta la carga de un tiro, pero no un swing que ya está bajando. Sigue ignorando el
escudo. Además les corta el ataque en curso y los deja trastabillando 0.7 s (los pesados no): eso lo
agregué yo al medir con el bot. Sin el palazo gratis en cada swing, un jugador quieto moría en la
oleada 2, porque cada golpe recibido le cancela el tiro y rodeado no pegaba nunca. Como botón de
"sacámelos de encima" el bot volvió a llegar a las oleadas 5 y 6.

**Cargar vale la pena.** El daño del driver va de 55 % (un toque) a 100 % (carga completa). Un toque
mata justo a un goblin (35 de vida) y nada más. Es una sola constante (`DRIVER_MIN_DAMAGE`) si hay
que ajustarlo.

**Números tocados con el bot.** El bot de `tools/botplay.mjs` no camina ni busca filas, así que marca
un piso. Sin roll ni daño en área moría en la oleada 3. Quedó: goblin 35 de vida (era 40), goblin
guerrero 90 (era 120, para que hielo más un driver a fondo con racha lo resuelva), estampida algo
más chica, alma en pena 50 de vida y 2.2 s aturdida cuando se le escapan. Con eso, y con el palazo
que corta ataques, el bot cae en la oleada 5 o en la 6 según la partida; antes del rediseño caía
en la 5. Para mirarlo jugar: `http://localhost:5173/?bot`, o `node tools/botplay.mjs --ver`.

**Medidor.** Sube hasta el tope y ahí rebota entre 100 % y 70 %, sin volver al principio. Para
un tiro corto que se pasó, se cancela. El perfecto sigue siendo el último 8 %.

**Oleadas que presentan enemigo y palo.** Son seis. Los palos que todavía no llegaron se ven
apagados en la barra. Con `?palos` en la URL arrancan todos habilitados, para probar.

| Oleada | Enemigo nuevo | Palo nuevo |
| --- | --- | --- |
| 1 | Goblins y esqueletos sueltos | Solo driver |
| 2 | Goblin guerrero (escudo) | Hierro 7 |
| 3 | Estampida de goblins con kamikazes | Wedge |
| 4 | Alma en pena | Putter |
| 5 | Chamán | |
| 6 | Gólem de roca | |

### Dónde cae un globo: a probar jugando

Leandro planteó el problema: en un globo, la carga es la distancia, y entonces el swing perfecto
solo sale a distancia máxima. Con el driver no molesta (pegar más lejos no cuesta nada); con un
globo sí, porque el blanco está donde está. Su salida: que lo esencial del hielo (silenciar) no
dependa del perfecto. Eso está hecho. Pero el perfecto seguía atado a la distancia, así que quedaron
las dos formas de apuntar en el juego, para compararlas. Se cambia con `G` o con el botón:

- **Al cursor** (por defecto): el globo cae donde está el mouse, dentro del alcance del palo. La
  carga define solo la fuerza: segundos de hielo, empuje del wedge, y el perfecto. Distancia y
  perfecto quedan separados, y se le puede dar a un chamán en medio de un grupo que camina.
- **Por carga**: como antes, la carga es la distancia.

Cuando Leandro elija, se saca la otra.

### Abierto

- **Palazo.** Ya es un botón con recarga. Falta ver jugando si con el salto ofensivo sigue siendo
  demasiado fuerte; si lo es, que respete el escudo de frente o que empuje más de lo que daña.
- **Kamikazes.** Siguen siendo más ayuda que amenaza, y el wedge los vuelve todavía más útiles
  (empujar enemigos hacia uno). Propuesta pendiente: que salgan detrás del grupo y lo atraviesen
  corriendo, con más daño a la puerta.
- **Jefe.** Sigue plantado a 22 m tirando piedras. Propuesta pendiente: que avance siempre,
  despacio, así ralentizarlo compra tiempo.
- **Recarga del wedge.** Por ahora no tiene.
- **Driver por arriba.** A media distancia un driver bien cargado les pasa por encima a los goblins
  (miden 1.25 m y la pelota sube hasta 1.5 m). Ya era así; con la racha se nota más.
- **Trampas, ríos, puentes.** Le darían un segundo uso al empujón del wedge.

### Orden que seguiría ahora

1. Jugarlo y elegir cómo se apuntan los globos.
2. Ajustar números con esa partida: racha, recargas, duración del hielo, fuerza del empujón.
3. Palazo y kamikazes.
4. Jefe que avanza.
5. Animación de putt para el portal.
6. Terreno con trampas.

## Notas del 20/9/2026: para pensar

Feedback de Leandro después de que lo jugaran él, su novia y un amigo. Nada de esta sección está
implementado, salvo lo que figura en "Hecho el 20/9" al final. Son ideas anotadas para decidir después.
Donde dice *Opinión* es comentario mío, no decisión.

### El problema de fondo

El jugador no tiene motivo para moverse. Se queda donde arranca, pega con el driver nueve de cada
diez veces y usa la escarcha cuando el enemigo la pide. **El wedge, el putter y el palazo hoy son
innecesarios.** Casi todas las ideas de abajo apuntan a lo mismo: darle razones para moverse y para
usar los otros palos, sin obligarlo porque sí.

### Wedge que pone un obstáculo

Que el wedge deje un obstáculo en el camino, por un rato o con un máximo de obstáculos a la vez. Los
enemigos lo rodean, y eso los encauza y los mantiene alineados: el jugador arma la fila que después
atraviesa con el driver, que es la parte divertida.

*Opinión:* es la mejor de la lista, porque alimenta directamente lo que ya divierte. Pide que los
enemigos esquiven (hoy caminan en línea recta sin mirar nada); con el campo abierto alcanza con
desviarse alrededor de un círculo, no hace falta pathfinding. Dos o tres obstáculos ya arman un embudo.

### Driver por niveles

- Hoy se pueden tirar demasiados tiros rápidos; el juego es más divertido cargando un poco más.
- Que la carga suba **por niveles** y no de forma continua, para saber cuánto daño va a hacer.
- Números obvios: por ejemplo el driver hace entre 10 y 50, y el enemigo más débil tiene 20 de vida,
  así que conviene cargar hasta el nivel 2. Cargar de más es tiempo perdido.
- Cada nivel hace un ruidito, para poder timear de oído y pegar con lo justo.

*Opinión:* si el daño va por niveles, la vida de los enemigos se puede mostrar en las mismas
unidades (tantas marcas como niveles hacen falta). Ahí cuánto cargar pasa a ser una decisión y no
una estimación.

### El indicador de carga tiene que estar donde mira el jugador

Hoy la barra está abajo y hay que sacar la vista del blanco para verla; quien juega una vez ni se
entera de que existe el swing perfecto. Tiene que estar cerca del cursor sin taparlo: un cambio de
color, un anillo alrededor, algo así. La barra de abajo se queda por ahora, pero se va a mover.

### Aprender jugando

Sacar los textos del principio. Dejar solo imágenes, tipo novela visual, para el lore, y que todo lo
demás se aprenda jugando. (Primer paso hecho: la placa de controles ya no explica los palos que
llegan después, y cada uno se presenta con su cartel.)

### Mapa

El mapa es demasiado plano y todo viene del mismo lado. Ideas:

- Más mapa hacia los costados: caminos que se abren, enemigos que llegan desde los lados hacia la
  puerta, para no mirar siempre al mismo lugar.
- Obstáculos en el medio que obliguen a correrse para tener tiro.
- Pasillos: se ve al enemigo entrar; si no se lo mata antes, hay que esperar a que salga, y sale
  cerca de la puerta. Errarle tiene costo.
- Todo esto también lo haría sentir más golf. Hoy podría ser golf o tenis.

### Tennis Hero

Una variante o segunda edición: la pelota vuelve cuando le pega a un enemigo y se le puede volver a
pegar, con varias pelotas a la vez. Entre pinball y Brick Breaker (la barrita que se mueve a los
costados y devuelve pelotas).

### Racha del driver

No se está usando ni se la tiene en cuenta al jugar, y es muy fácil perderla. Hay que rehacerla.

**Idea (21/9): la pelota que mata, pega más.** Si el primer golpe de una pelota mata al enemigo, el
daño de esa misma pelota aumenta para los que siguen en la línea. Premia justo lo divertido, pegarle
a varios en fila, y dentro de un solo tiro, sin nada que recordar entre tiro y tiro.

*Opinión:* puede reemplazar a la racha entera en lugar de sumarse. Es el mismo premio (matar en
fila rinde más) pero se entiende solo, se ve en el momento y no se pierde por errar un tiro. Si
cada baja vuelve a subir el daño, un tiro bien alineado barre la fila; habría que ponerle tope.
Hoy la pelota hace lo contrario: pierde 12 % de velocidad con cada enemigo que atraviesa.

### Cómo se dispara

En los juegos de golf el tiro tiene pasos: primero hacia dónde, después la carga, después el punto
justo. Dos variantes a probar:

- Un click inicia el tiro y la barra empieza a subir y bajar (sin mantener apretado); la barra
  espaciadora marca el punto justo para el crítico.
- Mantener apretado como ahora, y tanto soltar como la barra espaciadora disparan.

La diferencia con un juego de golf es que ahí casi siempre se quiere pegar lo más fuerte posible,
y acá no tanto. *Ojo:* la barra espaciadora hoy es el putter; habría que mudarlo.

### Dificultad dinámica

Medir cuánto tarda el jugador en matar y cuántos golpes usa, y con eso decidir qué mandarle:
siempre en aumento, pero a su ritmo. La novia de Leandro lo encontró difícil al principio y después
pasó varios niveles; a un amigo le resultó fácil. La idea es que nadie se frustre en los primeros
minutos.

### Pelotas como recurso, y moverse entre puestos

Volver a pensar si las pelotas aparecen solas o hay que ir a buscarlas. Le daría al jugador una
necesidad de moverse, pero Leandro lo siente artificial: esta versión funciona, y sería obligarlo a
moverse en lugar de darle un motivo. Igual se puede probar, y si divierte más, queda.

La forma que imagina: muchos puestos donde los caballeros caddie van dejando pelotas. El golfista
solo puede pegar donde hay una pelota (o donde están por dejarla; puede hacer el swing igual, pero
sin pelota no pasa nada). El movimiento dejaría de ser libre: un toque o un click lo lleva al puesto
siguiente, con saltito, teletransporte o animación. O movimiento libre con algo de snap a los puestos.

### Enemigos y cámara

- Hacer las peleas más interactivas: revisar enemigos y sus comportamientos.
- Pegarle a los enemigos pegados a la puerta era muy incómodo porque la cámara mira para el otro
  lado. Alternativas que quedaron anotadas: un botón para dar vuelta la cámara, o que se dé vuelta
  sola cerca de la puerta. Por ahora se resolvió con la regla de abajo.

### Hecho el 20/9

- **El alcance se desligó de la potencia.** La línea del tiro crece con la carga y, cuando llega al
  máximo, se queda en el máximo. La barra de abajo sigue rebotando entre 100 y 70 %, y ya solo
  define el daño y el swing perfecto.
- **El que llega a la puerta le pega una sola vez y desaparece adentro.** Ya no hay que volver a
  sacarlos de la muralla. Para compensar, ese golpe único es más fuerte:

  | Enemigo | Daño a la puerta antes (por golpe, repetido) | Ahora (una vez) |
  | --- | --- | --- |
  | Goblin | 4 | 10 |
  | Esqueleto | 9 | 20 |
  | Goblin guerrero | 10 | 25 |
  | Caballero esqueleto | 16 | 50 |

  El kamikaze (35) y las piedras del gólem (30) quedan igual. La puerta tiene 300 y se arregla 30
  entre oleadas.
- **Los palos que todavía no llegaron no se muestran.** Aparecen en la barra cuando se desbloquean.
  El botón de cómo se apuntan los globos también aparece recién con el primer globo.
- **Recargas a la vista.** Cada habilidad con recarga dice cuánto tarda; mientras recarga muestra el
  número grande bajando, y hace un saltito cuando vuelve a estar lista.
- **Cartel de palo nuevo.** Al despejar la oleada anterior aparece el cartel del palo que viene, y el
  juego queda frenado hasta que se lo cierra con un click (o Espacio). El descanso entre oleadas
  sigue corriendo mientras tanto: si se leyó con calma, la oleada arranca apenas se cierra.
- **El escudo desaparece con hielo (21/9).** Mientras el goblin guerrero está frío o congelado el
  escudo no se ve, y vuelve cuando se le pasa. Antes el escudo seguía ahí aunque ya no frenara nada.
- **Publicado** en GitHub Pages: https://leandromagonza.github.io/GolfKnight/ (ver el README).

## Prueba del 21/9/2026: puestos, números chicos y carga por niveles

Leandro pidió probar varias de las ideas anotadas el 20/9. Todo lo de esta sección está implementado
y publicado. Es una prueba: si no divierte, se vuelve atrás.

### Movimiento por puestos

- El golfista **no avanza ni retrocede**. Se mueve de costado entre nueve puestos marcados con un
  banderín, separados 4 m, con A y D. Un toque es un puesto; dos toques, dos; con la tecla apretada
  sigue de largo. Corre a 24 m/s: un puesto en menos de dos décimas.
- **Solo se pega donde hay una pelota.** Las tiran los guardias, que ahora están parados detrás de la
  línea de puestos. Se puede hacer el swing igual, pero sin pelota sale al aire.
- **Siempre hay pelotas, y nunca se acumulan.** Como mucho tres esperando. La siguiente tarda 0.2 s
  si no queda ninguna, 0.7 s si queda una y 1.5 s si quedan dos: quien tira rápido recarga rápido.
- Nunca caen en el puesto donde está parado el golfista (y caen, si pueden, a tres puestos o menos):
  después de cada tiro hay que moverse.
- Se puede salir corriendo apenas pasó el impacto, sin esperar a que termine el gesto del swing.
- **Putter:** Espacio teletransporta al puesto más cercano al cursor, con 8 s de recarga. Se fue el
  putter de dos pasos (tirar la pelota y saltar a ella).

### Vida y daño en números chicos

| | Vida |
| --- | --- |
| Golfista | 3 |
| Puerta | 10 |
| Goblin, kamikaze | 2 |
| Chamán, alma en pena | 3 |
| Esqueleto, goblin guerrero | 4 |
| Caballero esqueleto | 5 |
| Gólem | 80 |

- Cada golpe enemigo saca 1. A la puerta, el caballero y el kamikaze le sacan 2.
- **Driver:** el daño es el nivel de carga. 1 sin cargar, hasta 5; la barra rebota entre 5 y 3. El
  swing perfecto (el "headshot") pega el doble: 10.
- Palazo: 2. Explosión de kamikaze a la horda: 4, menos hacia el borde.
- Frío (+25 %) y expuesto (+50 %) se redondean; todo golpe que entra saca al menos 1.
- La vida de cada enemigo se ve en cuadraditos arriba suyo, siempre, para decidir cuánto cargar.
- Entre oleadas se recupera 1 de vida y 2 de puerta.

### Indicador de carga donde se mira

- Un anillo de cinco tramos junto al cursor, con el número del nivel al lado; dorado y con el daño
  duplicado en el punto del swing perfecto.
- La línea de tiro cambia de color y de grosor con cada nivel. Sin pelota en el puesto queda gris.
- Una nota por nivel: do, mi, sol, si y la octava en el 5. Al rebotar suena entre las tres más
  agudas (sol, si, do). Elegí el acorde con séptima para que el si pida resolver en la octava.
- La barra de abajo sigue estando, ahora con una raya por nivel.

### Lo que cambié por mi cuenta para que cierre

Medido con el bot, que ahora corre entre puestos, esquiva y carga según la vida del blanco.

- **El driver sale casi rasante** (3.5° en lugar de 7°). Con 7°, un tiro cargado a fondo subía hasta
  1.8 m y les pasaba por arriba a los goblins en todo el tramo medio: cargar más era pegar peor. Era
  un defecto viejo (estaba anotado como "driver por arriba") que el alcance fijo en el máximo volvió grave.
- **Respiro de 1.2 s después de un golpe**, y el golpe dirigido al golfista se anuncia más (0.75 s en
  lugar de 0.45 s): con 3 de vida tiene que dar tiempo a correrse de puesto.
- **Los enemigos solo se le van encima si le pasan a menos de 4 m, y lo sueltan a los 7 m.** Antes
  eran 7 y 11. Con el golfista fijo en una línea, lo perseguían de punta a punta; ahora correrse dos
  puestos es una esquiva de verdad, y el que lo pierde sigue viaje a la puerta.
- El golpe recibido ya no lo empuja fuera del puesto, y los enemigos no lo desplazan.
- **El hierro también es más rápido** (carga 0.5 s, vuela con más gravedad), igual que el wedge: es la
  mitad del combo contra escudos y con el ritmo nuevo llegaba tarde.
- **Oleadas más espaciadas** (de 2.2 s entre apariciones en la primera a 1.5 s en la última) y un
  goblin guerrero menos en la oleada 2. Con la puerta en 10, cada enemigo que se escapa duele diez
  veces más que antes.
- Con estos números el bot pasa las oleadas 1 a 3 y cae en la 4 por la puerta, no por la vida.
  **Es la parte que más necesita que la juegue una persona.**

### Queda flojo

- **La racha** casi no se nota con daño entero: +10 % sobre 3 sigue siendo 3. Refuerza la idea de
  reemplazarla por "la pelota que mata pega más", que con números chicos sería +1 por baja.
- Tirar la pelota no tiene animación de los guardias: la pelota sale volando desde donde están parados.
- El wedge sigue sin mucho uso. La idea de los obstáculos sigue anotada.

### Ajustes del 22/9 (después de jugar la prueba)

Pedidos por Leandro, todos hechos y publicados:

- **Un toque, un puesto.** Mantener apretado ya no repite: era difícil de controlar.
- **Nadie persigue al golfista.** Todos van derecho a la puerta. El que le pasa por encima lo
  atropella: le saca 1 y muere en el choque, así que un mismo enemigo nunca le pega a él y a la puerta.
  El kamikaze explota al tocarlo. Durante el respiro de invulnerabilidad pasan de largo. La única que
  sigue yendo por él es el alma en pena, porque existe para eso; lo dejé así y lo aviso.
  Como todos convergen hacia la puerta, en la práctica solo atropellan en los tres puestos del medio.
- **El indicador de carga es la línea**, y nada más: color y grosor por nivel. Se fue el anillo del
  cursor, que además tenía un bug (aparecía corrido y se deslizaba a su lugar, porque la animación de
  escala multiplicaba también su posición). **La punta de la línea lleva el color y el ícono del
  palo.** Con el driver la punta va a la altura del cursor, porque el final real de la línea queda
  fuera de pantalla.
- **El putter deja una pelota** en el puesto al que llega.
- **El palazo manda a los enemigos unos 15 m hacia atrás.**
- **Curva de carga:** lenta al principio y rápida al final (la potencia es el cuadrado del tiempo), y
  el rebote entre 5 y 3 corre 2.6 veces más rápido que antes. La ventana del swing perfecto en el
  rebote dura unas 6 centésimas.
- **Daño por segundo:** tiene que rendir más el crítico, después la carga completa, y spamear toques
  tiene que ser lo peor, para que contra enemigos grandes convenga cargar. Con la curva nueva da así,
  contando medio segundo fijo por tiro (bajar el palo, recuperarse y correr al otro puesto):

  | Tiro | Daño | Segundos de carga | Daño por segundo |
  | --- | --- | --- | --- |
  | Nivel 1 (toque) | 1 | 0 | 2.0 |
  | Nivel 2 | 2 | 0.45 | 2.1 |
  | Nivel 3 | 3 | 0.63 | 2.7 |
  | Nivel 4 | 4 | 0.77 | 3.1 |
  | Nivel 5 | 5 | 0.89 | 3.6 |
  | Perfecto | 10 | 0.96 | 6.8 |

  Hay un test que lo fija (`swing.test.ts`): si alguien toca la curva y el orden se rompe, falla.
- **"Críticos de la cabeza":** no había nada que desactivar. El juego nunca detectó golpes a la
  cabeza; el "headshot ×2" del pedido anterior lo había puesto en el swing perfecto, que es el único
  crítico que existe y sigue pegando el doble. Si la idea era sacarle el ×2 al perfecto, es una
  constante (`PERFECT_BONUS`).
- Por mi cuenta: el alma en pena bajó a 2 de vida y queda 3 s aturdida cuando se le escapan. El bot
  la sufría muchísimo (21 agarres en una oleada) y con 3 de vida cada agarre cuesta caro.

### Ajustes del 23/9

"Sigue estando fácil hacer daño." Pedidos por Leandro, hechos y publicados:

- **Tres niveles de daño y el crítico.** La carga da 1, 2 o 3 (un tercio de barra cada nivel) y el
  crítico, soltando justo al tope, pega **8**. Antes eran cinco niveles y el perfecto duplicaba (10).
  Con la vida como estaba (goblin 2, esqueleto y guerrero 4, caballero 5), sin crítico un esqueleto
  ya no cae de un tiro: son dos, o un crítico.
- **La barra rebota por todo el rango**, de 100 % a 0 y vuelta, en lugar de quedarse entre 5 y 3.
  Pasarse del tope ahora cuesta: hay que esperar toda la vuelta o conformarse con menos.
- **Después del wedge también vuelve solo el driver**, como ya pasaba con el hierro.
- **El driver no lleva ícono en la punta.** El hierro y el wedge sí.
- La línea de tiro: blanca, amarilla y naranja para los niveles, roja en el crítico. Las notas: do,
  mi, sol, y la octava en el crítico.

Daño por segundo con estos números, contando 0.7 s fijos por tiro:

| Tiro | Daño | Segundos de carga | Daño por segundo |
| --- | --- | --- | --- |
| Nivel 1 (toque) | 1 | 0 | 1.4 |
| Nivel 2 | 2 | 0.58 | 1.6 |
| Nivel 3 | 3 | 0.82 | 2.0 |
| Crítico | 8 | 0.96 | 4.8 |

El orden que pidió Leandro se mantiene (crítico, carga completa, y el toque último). Ojo con un
detalle: si el fijo por tiro fuera de medio segundo o menos, el nivel 2 rendiría apenas menos que el
toque (1.9 contra 2.0). El test lo contempla: exige el orden completo con un fijo realista, y con uno
optimista solo exige crítico, carga completa, toque.

### Solo daño base: se fueron todos los modificadores

Pedido por Leandro: sacar todas las modificaciones de daño menos el daño base. La idea es que el
crítico mate a casi todos de un golpe, con la excepción de la armadura grande y del jefe.

Lo que quedó: el driver pega **1, 2 o 3** según la carga, o **8** con el crítico. El palazo pega 2.

Lo que se fue:

- **La racha del driver** (+10 % por baja, hasta +50 %), con su indicador en pantalla.
- **La pérdida de daño después de picar** (la pelota que ya había picado o venía rodando pegaba entre
  35 % y 100 %). Ahora pega lo mismo de aire que rodando.
- **El +25 % a los enemigos fríos.** El hielo sigue frenando, sacando el escudo y apagando el aura.
- **El estado *expuesto*** (+50 % durante 4 s), que era el premio del wedge perfecto. El wedge
  perfecto hoy no da nada extra: queda pendiente decidir si lleva otro premio.

Lo que NO se tocó, porque no son multiplicadores sino bloqueos: el escudo del guerrero (rebota el tiro
rasante de frente) y el amparo del chamán (inmunes a 8 m). Tampoco la explosión del kamikaze, que les
saca 4 a los otros enemigos en el centro y pierde fuerza hacia el borde: es daño entre enemigos.

Vida de los enemigos:

| Enemigo | Vida | Cómo cae |
| --- | --- | --- |
| Goblin | 2 | un nivel 2 |
| Goblin kamikaze | 2 | un nivel 2 |
| Alma en pena | 2 | un nivel 2 |
| Chamán | 3 | un nivel 3 |
| Esqueleto | 4 | crítico, o dos tiros |
| Goblin guerrero (escudo) | 4 | crítico, o dos tiros (con el escudo abierto) |
| Caballero esqueleto | **10** (antes 5) | crítico más un nivel 2, o cuatro cargas completas |
| Gólem (jefe) | 80 | diez críticos |

El caballero subió de 5 a 10 por mi cuenta, para que sea la excepción que aguanta un crítico. Es un
número solo (`ENEMIES.knight.hp` en `waves.ts`). Hay un caballero en la oleada 4, uno en la 5 y tres
en la del jefe.

### Ajustes después de "solo daño base"

Pedidos por Leandro, hechos:

- **El palazo no hace daño**: solo empuja (unos 15 m hacia atrás) y corta el ataque. Radio de 2.4 a
  4 m, y sin el tope de cuatro enemigos. El driver queda como la única fuente de daño del jugador.
- **Sin pelota no se puede ni empezar a cargar.** Antes se cargaba y el swing salía al aire, y solo
  frustraba.
- **Movimiento entre puestos más lento y con easing** (resorte amortiguado): un puesto pasó de 0.17 s
  a unos 0.4 s, arrancando y frenando suave.
- **El que ya pasó la línea del golfista queda fuera de juego**: a 1.6 m detrás de los puestos se
  desvanece, no se le puede pegar más (ni pelota, ni palazo, ni hielo, ni explosión) y corre hasta la
  puerta a 9 m/s. Antes quedaba varios segundos caminando a la vista, todavía golpeable.
- **No se puede tirar para atrás**: la puntería nunca baja de 2.5 m por delante de la línea de puestos.
- **El palo en la mano**: fuera del swing el palo sigue a la mano derecha (rota con el personaje y con
  su animación) en lugar de ser una aguja rígida hacia donde se apunta. Ojo: no estoy seguro de que
  esto sea lo que Leandro quiso decir con "que el palo no siga al mouse"; está preguntado.

### El conflicto: timear el daño contra esperar la fila

Planteado por Leandro: controlar el daño depende de soltar en el momento justo de la barra, pero la
otra parte divertida (esperar a que los enemigos se alineen para atravesar a varios) también pide
soltar en un momento justo, y los dos momentos no coinciden. Si pegás cuando se alinean, hacés el daño
que tenga la barra en ese instante. Opciones, sin decidir:

1. **La barra se planta arriba.** Sube hasta el nivel 3 y se queda ahí todo lo que quieras; el crítico
   es solo la ventana del momento en que llega al tope. Esperar la fila siempre da 3; el 8 queda como
   el tiro de reflejos contra un enemigo gordo. Es la más simple y la que recomiendo.
2. **Congelar la carga con un botón** (la idea de Leandro): con click derecho o Espacio mientras
   cargás, la barra se clava en el nivel que tenga, y soltás cuando quieras. Permite guardarse un
   crítico para la fila, que es muy potente; habría que ponerle un costo (dura 2 s, o mientras está
   clavada no te podés mover).
3. **Tiro en dos tiempos**: un click fija el daño (timing), y un segundo click dispara (alineación).
   Separa del todo las dos habilidades, pero cada tiro pasa a ser dos clicks.
4. **Rebote solo arriba**: volver a que la barra rebote entre el nivel 3 y el crítico. Nunca baja de
   3, y el crítico vuelve cada medio segundo. Es lo que había antes y a Leandro le pareció fácil.
5. **Que la fila pague sola**: el daño sube por cada enemigo que la pelota atraviesa (+1 por cada uno
   ya atravesado). Así alinear rinde aunque salga un nivel bajo, y el timing pasa a ser lo de los
   enemigos sueltos. Contradice el "solo daño base" recién pedido.

### Idea: el wedge deja trampas en lugar de empujar

De Leandro, porque el empujón no está funcionando. Sin implementar. Propuesta para discutir: el wedge
tira un globo que deja una trampa en el piso (dura unos 8 s, máximo dos a la vez). El primer enemigo que
la pisa la dispara: empuja a los de alrededor hacia atrás, o los frena un par de segundos. La gracia
sería que se usa ANTES de que lleguen, para armar la fila que después cobra el driver: una trampa que
frena al primero hace que los de atrás lo alcancen y queden alineados.

### Tiro en dos tiempos, hierro por escalones y wedge en rectángulo

Pedidos por Leandro, hechos:

- **Arco de 180 grados**: se puede tirar de costado, perpendicular a la línea de puestos. Para atrás no.
- **Carga apenas se puede**: si el botón de cargar ya está apretado al llegar a un puesto con pelota,
  la carga arranca sola. Sacar el swing al aire había dejado el arranque menos responsivo.
- **Tiro en dos tiempos** (la opción 3 del conflicto, en su versión): soltar el click pega con lo que
  marque la barra, como siempre; pero `S` mientras se carga *clava* el daño, y el tiro sale con ese
  nivel cuando se suelta. El alcance sigue subiendo con la barra clavada. `Espacio` queda para el
  putter. Ojo de balance: se puede clavar un crítico y esperar la fila, que son 8 a cada uno.
- **El hierro 7 carga igual que el driver** (1 s, antes 0.5) y **cada escalón es mejor**: el nivel 1
  es el hielo base de antes (3 s), el nivel 2 es nuevo (4.5 s, 15 % más de área), el nivel 3 es el
  crítico de antes (6.5 s, 30 % más) y el crítico es más grande todavía (8 s, 70 % más).
- **El wedge barre un rectángulo hacia los costados** (idea de Leandro). Empuja solo en X, alejando
  del punto donde cae, y más fuerte cuanto más cerca. La cuenta cierra sola: si el desplazamiento es
  lo que le falta a cada uno para llegar al borde (medio ancho menos su distancia), todos los de un
  mismo lado terminan en la misma columna, sin cambiar de profundidad. Tres enemigos uno al lado del
  otro quedan en fila. Medio ancho 4, 5, 6 y 8 m según el escalón; medio fondo 3.5 m. A los pesados
  apenas los mueve. En la prueba, tres esqueletos en x = 0.8, 2.4 y 4.2 terminaron en 6.5, 6.4 y 6.2.

Ideas anotadas, sin implementar:

- **Llevar pelotas encima** (tipo carcaj, como mejora): levantar pelotas de los puestos, tener un par
  guardadas, y con pelota encima poder tirar desde cualquier puesto, o soltarla con un botón.
- **El putter pone trampas cerca** en lugar de (o además de) teletransportar, ya que el salto hoy
  sirve de poco. Se cruza con la idea anterior de que las trampas fueran del wedge.
- **Más palos**: ver la lista de palos clásicos más abajo.

Palos de golf que existen además de los cuatro que usamos (driver, hierro 7, wedge, putter): maderas
de calle (madera 3, madera 5), híbridos, hierros largos (2 a 4), medios (5 a 7) y cortos (8 y 9), y
cuatro wedges distintos: pitching, gap, sand (para el búnker) y lob (el globo más alto y corto). Una
bolsa reglamentaria lleva hasta 14. Los nombres antiguos dan juego para un mundo de fantasía: brassie
(madera 2), spoon (madera 3), cleek (hierro largo), mashie (hierro medio), niblick (wedge).

### Wedge orientado, cambio de palo cargando, y más ideas

Pedidos por Leandro, hechos:

- **Cambiar de palo mientras se carga cambia en el acto** y la carga arranca de nuevo con el palo
  nuevo. Si ese palo está recargando, no cambia y la carga sigue. La cola de palos quedó solo para
  cuando el swing ya está bajando.
- **El rectángulo del wedge sale de la línea del tiro.** Apuntando derecho queda igual que antes; a
  45 grados, el rectángulo va a 45, y empuja hacia los costados de esa línea. Así se arman filas
  para tiros cruzados, no solo para tiros derechos.
- **El empujón mueve a todos lo mismo**, pesen lo que pesen (wedge y palazo). Antes los pesados se
  movían un 12 %, y era difícil calcular a cuáles alineaba y a cuáles no. El retroceso por el golpe
  del driver sí sigue dependiendo del peso.
- De paso: el empujón ahora se integra exacto, así recorre lo mismo a cualquier cantidad de cuadros
  por segundo. Antes, a pocos cuadros se pasaba un 8 % y desarmaba la fila.

Ideas anotadas, sin implementar:

- **Palo escopeta**: tira varias pelotas. Variantes: que vaya con el carcaj (gasta las pelotas que se
  llevan encima); o un palo aparte que pega menos por pelota pero en área; o que solo tenga recarga.
  Control: cuanto más cerca el mouse, más juntas salen; cuanto más se carga, más pelotas salen.
- **Habilidades sobre los palos que ya hay**, sin sumar palos: por ejemplo apretar `Q` y que el
  próximo ataque salga con varias pelotas.
- **Enemigos a distancia que le tiren al golfista** proyectiles que haya que esquivar moviéndose de
  puesto. Candidata a reconvertirse: el alma en pena (la que corre rápido), porque la idea es sacar el
  teletransporte del putter y sin salto su agarre no tiene salida.
- **Enemigo de 1 de vida, más rápido**, quizás con esquive: corre, y cada unos segundos hace un roll
  más rápido en diagonal.

### Evaluación: campo con relieve, como una cancha de golf

Pedido por Leandro: evaluar que el campo no sea un plano. Sin implementar.

**Qué cambia de verdad.** El driver sale casi rasante (3.5 grados: a 60 m no sube más de 0.9 m). Con
relieve, cualquier loma de más de medio metro entre el golfista y el enemigo le frena el tiro. O sea
que el relieve no es decorado: es **cobertura**. Eso puede ser lo mejor de la idea (los globos pasan
por arriba, así que el hierro y el wedge ganan otro uso; una fila que viene por el fondo de un valle
queda servida) o lo peor (atravesar filas ya es difícil, y con ondulaciones al azar falla más seguido).
Por eso tiene que ser relieve **diseñado**, no ruido.

**Qué formas sirven.**

- *Tee elevado*: los puestos sobre una terraza de 1.5 m, como un tee de salida. El driver tira apenas
  hacia abajo y tolera mucho más relieve adelante. Es lo que hace viable todo lo demás.
- *Valles que apuntan a los puestos*: los enemigos que bajan por un valle se alinean solos, y el tiro a
  lo largo del valle queda limpio. Es la versión con relieve de los pasillos que ya estaban anotados.
- *Lomas como cobertura*: los que vienen detrás de una loma no se pueden cobrar con el driver hasta que
  asoman; el globo sí les llega.
- *Subidas que frenan*: si caminan más lento cuesta arriba, se amontonan al pie de cada subida, y eso
  también arma filas.
- Más adelante: búnker (arena que frena a los enemigos y mata el pique) y agua (hay que rodearla).

**Qué hay que tocar en el código.**

| Parte | Hoy | Con relieve | Tamaño |
| --- | --- | --- | --- |
| Altura del terreno | no existe | una función h(x, z) (suma de lomas y valles) y una malla subdividida | chico |
| Enemigos | caminan en y = 0 | y = h(x, z); opcional, velocidad según la pendiente | chico |
| Puntería | rayo del mouse contra un plano | rayo contra el terreno (marchando el rayo) | chico |
| Pelota | pica contra y = 0 (`core/ballistics.ts`, con tests) | choca contra el terreno, pica según la pendiente y rueda cuesta abajo | mediano |
| Línea de tiro | parábola hasta el alcance | tiene que cortarse donde toca el terreno, si no miente | chico a mediano |
| Marcas en el piso | anillos y el rectángulo del wedge, planos a 5 cm | tienen que copiar el terreno (el rectángulo mide hasta 16 x 7 m) | mediano |
| Cámara | fija, detrás del golfista | una loma puede tapar a los de atrás: hay que subirla o limitar las alturas | a probar |

**Riesgos.** Que el driver falle demasiado seguido y frustre; que desde la cámara no se lea qué está
tapado y qué no (hay que ayudar con la línea de tiro cortándose en la loma); y que el wedge, que
alinea en el plano, quede raro sobre pendientes.

**Cómo lo haría.** En dos pasos. Primero un prototipo detrás de un parámetro en la URL (`?relieve`):
función de altura con un tee elevado, un valle central y dos lomas; malla; enemigos y pelota siguiendo
la altura; puntería contra el terreno; línea de tiro que se corta. Sin tocar las marcas del piso. Con
eso ya se puede jugar y decidir si suma. Recién si convence, el segundo paso: marcas que copian el
terreno, pendiente que frena, búnker y agua.

### Prototipo de relieve, hecho (`?relieve`)

Leandro pidió el prototipo. Está detrás de `?relieve` en la dirección; sin eso el juego no cambia.

Qué tiene: dos lomas (2 m a la izquierda a 34 m; 2.2 m a la derecha a 47 m) y un valle central de 0.9 m
de hondo y unos 8 m de ancho, entre los 22 y los 60 m, que apunta a los puestos del medio. Todo plano
hasta los 14 m. Enemigos y pelota siguen el terreno; la puntería del mouse va contra el terreno; la
línea de tiro se corta donde el tiro lo toca.

**Cambio respecto de la evaluación: sin tee elevado.** Lo había propuesto como lo que hacía viable el
resto, y haciendo las cuentas es al revés. Desde una terraza de 1.5 m el driver, que sale rasante, les
pasa por arriba a los goblins del llano: hay que tirar hacia abajo, y una fila parada sobre el piso
deja de estar sobre la línea del tiro, que es justo lo que el driver necesita. Con los puestos al
nivel del llano, todo lo que pasa en piso plano se juega igual que hoy, y el relieve suma encima.

**Sobre el control de altura** (la duda de Leandro: más golf, pero quizás más lento). No hace falta un
control aparte: con relieve, el mouse ya apunta a un punto del terreno que tiene altura. El prototipo
inclina el tiro lo que sube o baja el terreno entre la pelota y el cursor (hasta 12 grados) y calcula
los globos para caer en el punto. Se apunta igual de rápido que ahora. Un control manual de altura
(subir y bajar la mira) sumaría una tercera cosa para timear, encima del daño y de la alineación, que
ya chocaban entre sí. Si en algún momento se quiere más golf, mejor que venga por el lado de elegir
palo (más loft, menos loft) que por una mira vertical.

Verificado con `tools/relieve.mjs`: los enemigos pisan el terreno; el driver atraviesa una fila de tres
por el fondo del valle; a un esqueleto detrás de la loma el driver no le pega y el hierro sí le llega
por arriba; al que está en la cima el driver le pega. La prueba general y los tests siguen pasando en
el modo plano.

Para mirar al jugar: si el driver falla demasiado seguido, si desde la cámara se entiende qué está
tapado, y si el valle ayuda de verdad a cobrar filas. Un detalle que ya se ve: no se puede apuntar al
piso que una loma tapa desde la cámara; el cursor cae sobre la cara de la loma.

### Altura del tiro, tótems del putter, y el hielo que ya no congela

Pedidos por Leandro, hechos:

- **Altura del tiro con `W` y `S`**, por escalones (rasante, normal, globo, bombeado), no analógica, y
  se mantiene de un tiro al siguiente. El escalón se suma al loft del palo.
- **El putter pasó a la `F`** y **clavar la carga pasó a `Espacio`**.
- **El wedge acerca en vez de alejar**: cada uno recorre lo que lo separa de la línea del tiro, así que
  terminan parados sobre ella. Los que quedan a la misma profundidad no se enciman: se frenan hombro
  con hombro, porque los enemigos ya se empujaban entre sí.
- **El putter siembra tótems.** La pelota rueda lento (fricción propia, 3 en vez de 9) y donde para deja
  un tótem con el daño de la carga escrito encima: 2, 3, 4 y 10 con el crítico. Explota cuando le pega
  una pelota de driver: daño en 5 m con caída hacia el borde, y a todos hacia afuera. Hasta tres a la
  vez, 25 s de vida. **Se fue el teletransporte**, así que la salida de un agarre ahora es el palazo.
- **El hierro ya no congela**: deja el frío (camina al 40 %, sin escudo, sin aura del chamán) y nada
  más. Desapareció el estado "congelado" y el círculo del centro.

**Sobre el control de altura, y la duda de que "muy alto y muy fuerte se va".** No pasa, porque la
altura **no cambia dónde cae la pelota**: la velocidad se recalcula para llegar al mismo punto. Subir
la mira cambia el arco, no el alcance. O sea que sí se puede pegarle con un driver cargado a fondo a
algo que está detrás de una loma: se sube a globo y llega igual, con el mismo daño. Lo que se paga es
que tarda más en llegar y que **deja de atravesar la fila**, porque pasa por encima de los del medio.
Ese es el canje, y me parece el correcto: el driver rasante sigue siendo el tiro de las filas.

**Sobre subir y bajar la altura con el mouse** (acercándolo o alejándolo del personaje): no lo haría.
La distancia del cursor ya *es* dónde cae la pelota con los globos. Si además fuera la altura, no se
podría tirar un globo alto lejos ni uno rasante cerca: se acoplan justo las dos cosas que conviene
tener separadas. Y apuntar movería la altura sin querer. `W`/`S` no tiene ese problema.

### La idea grande: el palo es la entrega, el encantamiento es el efecto

Propuesta de Leandro, sin implementar. **Me parece la mejor idea de diseño que apareció hasta ahora**,
porque resuelve de un saque varias cosas que venían trabadas:

- Contesta "¿para qué uso el hierro si el driver llega más lejos?": porque *entrega* distinto, no
  porque tenga un efecto exclusivo.
- Contesta "¿y si quiero un vendaval al fondo?": lo tirás con un palo que llegue al fondo.
- Da profundidad combinatoria sin sumar botones: 3 palos × 3 encantamientos son 9 tiros distintos.
- Encaja con la fantasía: un golfista con la bolsa encantada.

**La regla que lo hace entendible.** Lo que diferencia a los palos en golf no es la distancia sino la
trayectoria, y acá eso ya significa algo mecánico: qué tan rasante viene el tiro decide a quién toca.
Entonces, una sola regla explica las nueve combinaciones: **cuanto más rasante, más lineal y preciso;
cuanto más alto, más zonal y amplio.**

| Palo | Cómo entrega | Con hielo | Con vendaval | Con explosión |
| --- | --- | --- | --- | --- |
| Driver (rasante, 18-60 m) | a cada uno que atraviesa | congela a los de la línea, uno por uno | los junta sobre la línea del tiro | daño extra a cada uno que toca |
| Hierro (arco medio, 6-40 m) | donde pica | hielo en área mediana | junta en un rectángulo mediano | explota donde pica |
| Wedge (globo alto, 5-28 m) | donde cae, en picada | hielo en área grande | junta en un rectángulo grande | explosión grande |
| Putter (rueda, 4-24 m) | **diferido**: deja un tótem | tótem de escarcha | tótem que los atrae | tótem que explota (lo de hoy) |

El putter así tiene un rol propio, que es la otra pregunta de Leandro ("¿para qué lo uso si puedo
tirar más lejos?"): no entrega ahora, entrega **cuando vos querés**. Sembrás y detonás. Eso no es una
versión peor del driver, es otra cosa. Y el "pega más de base pero poco rango" también sirve como
segunda ventaja.

**Cómo lo armaría.** El palo se sigue eligiendo con 1-3 y F. El encantamiento sería un modificador con
recarga que se activa aparte (`Q`/`E`/`R`, o 4/5/6) y vale para **el próximo tiro**: "apretás Q y el
próximo tiro sale con hielo". El daño del driver y el encantamiento se suman, y el balance lo pone la
recarga: un tiro encantado siempre es mejor, pero solo lo tenés cada tantos segundos. Así no hay
elecciones tontas, pero sí decisiones de cuándo. Las oleadas pasarían a desbloquear encantamientos en
lugar de palos (o los dos: palos al principio, encantamientos después).

**Lo que hay que resolver antes.**

- *El alcance de los efectos "al caer".* Hoy el vendaval y el hielo caen en un punto. Si el driver los
  puede llevar, hay que decidir si con el driver el efecto es lineal (mi propuesta) o si igual cae en
  un punto lejano. Lineal es más interesante y más fácil de leer.
- *Que el tiro más fuerte no sobre.* Leandro tiene razón: el driver a fondo tiene que morir dentro del
  campo. Hoy llega a 60 m y el campo empieza a los 68, así que entra justo; conviene revisarlo si se
  agrandan los alcances.
- *Cuántos palos.* Con la regla de arriba, tres de tiro más el putter alcanzan y cada uno tiene una
  identidad clara. Bajar a tres en total dejaría un hueco entre el rasante y el globo.
- *Cuánto es refactor.* Es la quinta vez que se rehace el reparto de roles. Lo haría por partes y
  detrás de un parámetro en la URL (como `?relieve`), para no romper lo que ya funciona.

Antes de meterse con esto conviene jugar lo que hay: el relieve y los tótems todavía no los probó una
persona, y varias de estas dudas se contestan en cinco minutos de partida.

### Por qué la altura manual no sirvió, y qué poner en su lugar

Leandro la probó: quería levantar un globo por encima de una colina para pegarle a alguien que está
detrás, y con el driver no se puede ni subiéndole la altura. Tenía razón, y los números lo explican.

Altura de la trayectoria de cada palo a su alcance máximo, en metros:

| Palo | Escalón | Loft | A 20 m | A 35 m | A 45 m | Vuelo |
| --- | --- | --- | --- | --- | --- | --- |
| Driver (60 m) | rasante | 2.5° | 0.6 | 0.6 | 0.5 | 0.49 s |
| Driver | normal | 3.5° | 0.8 | 0.9 | 0.7 | 0.58 s |
| Driver | globo | 17.5° | 4.2 | 4.6 | 3.5 | 1.31 s |
| Driver | bombeado | 31.5° | 8.2 | 8.9 | 6.9 | 1.83 s |
| Hierro (40 m) | normal | 40° | 8.4 | 3.7 | ya cayó | 1.16 s |
| Wedge (28 m) | normal | 45° | 5.7 | ya cayó | ya cayó | 0.86 s |

El driver bombeado pasa a 7-9 metros de altura: le pasa por arriba a todo, incluido el enemigo al que
se le quería pegar. Para que baje justo ahí hay que **acortar el alcance**, y el alcance lo da la
carga, que es lo mismo que da el daño. O sea que el driver a media distancia pega poco por definición.

**Y hay algo peor, que apareció midiendo.** El crítico pide soltar con la barra arriba del 92 %, y la
barra solo llega ahí después de haber subido casi todo: el alcance ya quedó en 56-60 m. **Con el
driver, hoy es imposible hacer un crítico a un enemigo cercano.** No es un bug, es la consecuencia de
que alcance y daño salgan de la misma barra.

**Conclusión: sacar la altura manual.** No agrega una decisión nueva, duplica la de elegir palo, y el
propio ejemplo de Leandro lo dice: "le puedo pegar con el wedge esperando a que caiga, o con el hierro
7 con una trayectoria menos alta". Eso ya es elegir la trayectoria, y es más golf que una mira vertical.

### La propuesta que sí lo resuelve: el daño sale de la distancia, no de la carga

Idea de Leandro. Tres niveles de calidad de golpe (el timing), y cuánto vale cada nivel depende de a
qué distancia pega y con qué palo:

| Palo | Corta | Media | Larga |
| --- | --- | --- | --- |
| Driver | 1 / 2 / 3 | 1 / 3 / 5 | 2 / 4 / 8 |
| Hierro | 1 / 3 / 7 | 1 / 3 / 7 | 1 / 3 / 7 |
| Wedge | 1 / 3 / 7 | 1 / 3 / 7 | 1 / 3 / 7 |
| Putter | 2 / 4 / 8 | 1 / 3 / 5 | 1 / 2 / 3 |

**Esto arregla de raíz el conflicto que venimos arrastrando**, y contesta la pregunta de Leandro ("¿el
timing define la fuerza, o se puede pegar flojo y hacer daño igual?"): la fuerza deja de existir como
concepto. Queda así:

- **El mouse dice dónde cae**, para todos los palos (hoy ya es así para los globos).
- **La barra dice qué tan bien le pegaste**, y nada más: tres niveles de calidad, puro timing.
- **El palo dice cómo llega** (rasante, arco medio, globo, rodando) **y cómo escala su daño** con la
  distancia.
- **El encantamiento dice qué efecto hace**, aparte y con recarga.

Cada control tiene un solo significado. Se puede hacer un crítico cerca (con el putter) o lejos (con
el driver), y esperar a que los enemigos se alineen ya no cuesta daño: alinear y timear dejan de
pelearse, porque la barra no tiene que llegar a ningún lado para alcanzar lejos.

**Lo que cambia de fondo, y hay que confirmar:** con esta tabla **todos los palos hacen daño**. Se cae
la regla "el driver es el único que cobra", que venía desde el primer rediseño. A cambio, lo que
distingue a cada palo pasa a ser la trayectoria y la curva de daño, que es más golf y combina mejor
con los encantamientos.

**Detalles a definir:**

- Qué son corta, media y larga: yo las pondría en metros absolutos del campo (por ejemplo hasta 20,
  de 20 a 40, más de 40), no en fracciones del rango de cada palo, porque el jugador piensa "está
  lejos", no "está al 70 % de mi hierro".
- Los rangos se ensanchan: si el mouse elige la distancia, el driver tiene que poder tirar corto
  también (pegando poco). Algo como driver 6-66, hierro 6-50, wedge 5-40, putter 3-20.
- El wedge y el hierro quedan iguales en daño: se diferencian por trayectoria, y con encantamientos
  por el tamaño del efecto (más alto = más zonal).
- Qué queda de la barra: tres niveles de calidad con la franja buena angosta. Es el medidor clásico de
  golf, y se puede quedar el "clavar" de Espacio.

### Hecho: el palo es la entrega y el encantamiento es el efecto

Leandro lo eligió y reemplaza lo anterior. Lo que cambió:

- **El mouse da la distancia para todos los palos** (antes solo para los globos). Se fue el modo de
  puntería de globos y la tecla `G`.
- **La barra dice solo la calidad del golpe**: tres niveles, puro timing. Ya no define el alcance.
  Con eso se muere el problema que arrastrábamos: antes, para hacer un crítico había que tirar sí o sí
  a 56-60 m, porque la barra tenía que subir entera. Ahora se puede clavar un golpe perfecto a
  cualquier distancia.
- **Se fue la altura manual (W/S).** El palo define la trayectoria.
- **El daño sale del palo y de la distancia**, con la tabla de Leandro. Los cuatro palos hacen daño:
  se cayó la regla "el driver es el único que cobra".
- **Los encantamientos van aparte**, en 1, 2 y 3, y valen para cualquier palo. El golpe seco no tiene
  recarga; escarcha 4 s y vendaval 3 s. Al gastar uno, vuelve solo el golpe.
- **Los palos se recorren con Q y E**, en círculo, y ya no tienen recarga propia.
- **El tótem del putter quedó en pausa** (el módulo sigue en `src/game/traps.ts`). El putter ahora es
  el palo de distancia corta, el que más cobra de cerca.
- **El pasto amortigua.** Una pelota que entra de frente contra la cara de una loma se clava en vez de
  salir rebotada; de costado sigue de largo casi sin perder nada. Vale igual en piso plano: un globo
  que cae de punta ya no pica como una pelotita.

Cómo se reparte el efecto según el palo, que es la regla que hace entendibles las doce combinaciones:
**cuanto más rasante, más lineal; cuanto más alto, más zonal.** El driver le aplica el efecto a cada
uno que atraviesa, y los demás en un área donde caen, más grande cuanto más alto vuela el palo. El
vendaval con el driver es el caso especial: como no tiene punto de caída, el viento pasa como un
pasillo angosto a lo largo de todo el tiro.

**Lo que falta decidir, para cuando se juegue:**

- ~~Si las oleadas tienen que desbloquear encantamientos en vez de palos.~~ **Resuelto**: sí. Ver
  "Los palos desde el principio, y los poderes como premio", al final.
- ~~Si el golpe seco tiene que competir de verdad con los otros dos.~~ **Resuelto**: no. Es el estado
  de reposo y no tiene recarga.
- Si el putter, sin tótem, alcanza con ser "el que cobra de cerca".

## Hecho: teclas directas, el hierro con arco propio, y el campo que cambia

Ronda de ajuste sobre el rediseño, ya con el juego en la mano.

### Los controles dejaron de ser una rueda

- **Cada palo tiene su tecla: 1, 2, 3 y 4.** Recorrer con Q y E obligaba a contar pasos para llegar al
  palo que se quería; con cuatro palos y una pelea encima, eso es fricción pura. La rueda del mouse
  sigue recorriéndolos en círculo, para quien la prefiera.
- **Los poderes pasaron a Q, W y E**, que es donde la mano ya está.
- **Los tres poderes tienen recarga.** Antes el golpe seco era gratis, así que los otros dos eran un
  extra y no una elección. Ahora el golpe recarga 1.2 s (menos de lo que tarda un swing, para que no
  frene el juego), el vendaval 3 s y la escarcha 4 s. El poder elegido queda en la mano; si cuando vas
  a pegar todavía recarga, entra solo el que esté listo.
- **El palo perdió su ícono en la punta de la línea.** Tapaba justo el punto al que se apunta. Ahora
  ahí va el símbolo del poder, más chico y levantado 2.3 m, con el punto de caída libre.
- **La barra de abajo se reacomodó**: palos a la izquierda, poderes a la derecha, en una sola fila.
  Las etiquetas de fila armaban una columna en el medio que empujaba todo para arriba.
- **Un solo número de daño por golpe.** Aparecían dos porque lo emitían dos lugares a la vez: el
  evento de la pelota y el de la horda. Quedó el de la horda, que vale para todas las formas de pegar.

### El hierro 7 es ahora el palo del medio, no un globo más

Era un globo con gravedad propia (50) que caía en picada y moría donde caía: hacía casi lo mismo que
el wedge. Ahora tiene forma propia:

| | Driver | Hierro 7 | Wedge | Putter |
| --- | --- | --- | --- | --- |
| Trayectoria | rasante | arco bajo (27°, gravedad normal) | globo alto (55°) | rueda |
| Atraviesa en el aire | sí, a toda la fila | sí, hasta a tres | no | no |
| Área donde toca el piso | no | 1.8 m | 4.2 m | 1.6 m donde para |
| Después de caer | pica y sigue | **sigue rodando** | se queda ahí | se queda |

El hierro es el único que hace las dos cosas: le aplica el efecto a cada uno que atraviesa, como el
driver, y además abre un área chica donde cae, como el wedge. Un tiro sigue siendo **un efecto por
enemigo**: al que ya atravesó, el área no lo vuelve a tocar (`blast`, `chillAround` y `sweep` reciben
la lista de los ya golpeados). Sin eso, el hierro le sacaba exactamente el doble a quien estuviera
parado en el punto de caída.

Así quedan los tres roles separados de verdad: el driver es la línea, el wedge es la zona, y el hierro
es el que hace un poco de las dos y encima pasa por arriba de las lomas.

### El campo ya no es un plano, y cambia en cada partida

El relieve dejó de ser un prototipo detrás de `?relieve`: **está siempre**. Y hay **cuatro campos
diseñados**, uno por partida:

1. *Valle del medio*: dos lomas cruzadas y un carril limpio por el medio (el de siempre).
2. *La meseta*: una meseta ancha parte el campo en dos, con un carril por cada costado.
3. *Los dos carriles*: una loma cerca obliga a salir del puesto del medio.
4. *La loma sola*: el campo más limpio, para tirar rasante de punta a punta.

Se sortea al cargar. `?campo=1` a `?campo=4` fuerza uno y `?plano` deja el campo liso, que es sobre el
que corre la prueba general (mide trayectorias: necesita el mismo piso siempre).

**Por qué campos diseñados y no ruido:** el driver sale rasante, así que una loma es cobertura y una
zanja es un carril. Con relieve al azar, atravesar una fila sería una lotería y el palo más
característico del juego dependería de la suerte. Un test comprueba que en los cuatro campos las
pendientes son suaves (por debajo de fricción sobre gravedad, para que la pelota siempre termine
parando) y que cerca de los puestos y de la muralla el piso es plano.

Queda para más adelante, si hace falta más variedad: que las lomas se muevan durante la partida, o
mapas con agua y búnkers.

### Las distancias ahora se ven

- Las marcas del piso se cuentan **desde la línea de los puestos**, no desde la puerta: la raya donde
  está parado el golfista dice 0. Antes decía 10 m, que era la distancia a la puerta y no le servía a
  nadie.
- Las rayas de **20 y 40 m están resaltadas**, porque ahí cambia la banda de daño, y cada tramo lleva
  su nombre al costado: corta, media, larga. La razón por la que un palo pega más o menos es ahora
  algo que se ve en el campo, no un número escondido.

### Panel de balance (tecla B)

Un panel al costado que toca los números del juego en vivo, sin recargar: daño de cada palo por banda
y por calidad, alcance y área, dónde cortan las bandas, recarga de cada poder, y vida, velocidad y
daño de cada enemigo. Más los botones de prueba que hacían falta para poder probar sin jugar una
partida entera: **oleada infinita** (repite la composición de la oleada en curso), **vida infinita**,
**puerta infinita** y **saltar a la oleada 1 a 6**.

Y un botón de **copiar configuración**, que deja todo el balance como texto en el portapapeles. La idea
es que ajustar el balance no requiera tocar código: se juega, se mueve, se copia y se pasa.

Los cambios no se guardan: al recargar vuelve el balance del código. Es a propósito, para que un
experimento no quede pegado sin que nadie se entere.

## Hecho: la pelota quieta, el escudo que sí frena, y el área que pega menos

Segunda tanda de correcciones sobre lo anterior, todas reportadas jugando.

### El golfista se mueve alrededor de la pelota, no al revés

Antes la pelota salía de un offset girado respecto del cuerpo: apuntabas y **la pelota orbitaba al
personaje**, que es justo lo que nadie hace en el golf. Se dio vuelta la relación: ahora el **ancla es
el puesto** (`Player.anchor`, donde está la pelota) y el cuerpo se calcula alrededor
(`stancePosition`). `position` sigue siendo el cuerpo, así que la cámara y los enemigos no se enteran;
lo que cambió es quién manda.

De yapa, la puntería se simplificó: la línea del tiro es de la pelota al cursor, sin iterar. Antes
había que iterar dos veces porque el tee dependía de la dirección, que dependía del tee.

### Se podía pegar demasiado lejos y nada cerca

`minRange` era 6 m en driver y hierro: apuntando más cerca el tiro salía igual de largo. Bajó a 4 / 4 /
3 / 2. Y el guardia de la puntería pedía 1.2 m de separación para actualizar la dirección; ahora 0.3.

### El escudo dejaba pasar al hierro

El escudo solo frenaba pelotas **casi horizontales** (pedía caída vertical < mitad de la horizontal).
El driver entraba; el hierro, que baja a unos 27°, quedaba apenas afuera y le pasaba por el medio.
Ahora frena lo que le llega **de frente, venga rasante o en arco**: solo lo pasa lo que cae casi a
plomo. Como el wedge y el putter no atraviesan (abren el área al lado del escudo, no contra él), la
regla queda como la quería Leandro: al del escudo se lo resuelve con un globo, con hielo, o pegándole
de costado.

### El marcador del piso volvía para adelante

Apuntando **detrás** de una loma, el driver se inclinaba hacia la altura del cursor, que es más baja, y
entonces se clavaba más abajo en la misma loma: la marca, en vez de quedarse en la cima, bajaba. Ahora
el tiro rasante se inclina hacia **lo más alto que se cruza en el camino** (el máximo de `atan2(h, s)`
a lo largo de la línea), no hacia la altura del cursor. Apuntar más lejos ya no lo hace bajar.

### El área pega menos que el impacto

Regla nueva de Leandro: **un golpe en área tiene que pegar menos**, porque agarra a varios y no hay que
apuntarle a nadie. El wedge y el putter solo hacen área, así que su tabla ya *es* la del área y
alcanzaba con bajarle los números al wedge (1/3/7 → 1/2/5, que abre la más grande de todas). El hierro
era el caso dudoso porque hace las dos cosas, y la respuesta fue **dos tablas**: `damage` es lo que saca
la pelota al pegarle a alguien (1/3/7) y `areaDamage` lo que reparte donde cae (1/2/4). El driver no
tiene área y no necesita la segunda.

En el medidor, con el hierro en la mano, se ven los dos números: «3 al pegarle · 2 en área».

### Lo demás de esta tanda

- **El golpe no tiene recarga.** Con recarga, al ir a pegar el juego te metía otro poder listo, y eso se
  sentía como que se activaban poderes solos. Ahora el golpe es el estado de reposo y nunca se cambia
  solo a *otro* poder: después de gastar escarcha o vendaval, la mano vuelve al golpe.
- **La carga es la misma para los cuatro palos** (0.85 s; estaba en 1.0 / 0.85 / 0.7 / 0.6). La barra
  mide timing: si cada palo tuviera su ritmo, elegir palo sería también elegir qué tan difícil es
  clavar el golpe, que es otra cosa.
- **Buffer de movimiento, no cola.** Apretar A o D durante un tiro guardaba *todos* los toques y al
  terminar te movías dos o tres puestos de golpe. Ahora se guarda uno solo, el último, y vence a los
  0.4 s.
- **Cámara ajustable**: la rueda del mouse inclina y las flechas arriba y abajo la suben y bajan sin
  girarla. Los valores salen en «copiar configuración», que es para lo que están.
- **Panel**: cambiar de campo (recarga la partida), prender y apagar cada tipo de enemigo, velocidad de
  ataque del gólem, y el panel por encima de la pausa para poder tocarlo con el juego frenado.

## Hecho: la postura que no pisa el campo, y el balance que se guarda

### El golfista corría de un lado y del otro de la línea

Se veía "a veces corre por detrás de la línea y a veces por adelante": al apuntar, el cuerpo rotaba
alrededor de la pelota y para ciertos ángulos terminaba **adentro del campo**, delante de la línea de
los puestos. Ahora la pose se clampea, y el límite **sale de la geometría, no de un número a ojo**: el
cuerpo queda detrás de la pelota cuando `-tee.x·sin(y) + tee.z·cos(y) >= STANCE_BEHIND`, que es
`R·sin(y + φ) >= d`, y de ahí salen los dos extremos del arco permitido (`Player.stanceYaw`).

Ojo con un detalle que costó: **en la postura de golf el cuerpo queda al costado de la pelota, no
atrás**. El primer intento pedía 25 cm por detrás y dejaba al golfista girado siempre para el mismo
lado, sin rodear nunca la pelota. `STANCE_BEHIND` es casi cero a propósito: solo impide meterse
adelante. Para un lado el cuerpo rodea la pelota de verdad; para el otro, la pose se clava. Eso es el
clamp que se pidió.

### La pelota estaba 0.7 m adelante de la línea

La pelota y su anillo se dibujaban en `TEE_Z + 0.7`, pero el tiro sale del puesto. Al empezar a cargar,
la pelota saltaba para atrás y el anillo se quedaba donde estaba. Ahora las tres cosas —pelota, anillo y
ancla— están en el mismo punto, y las distancias se miden desde ahí.

### El putter era lentísimo

`rollFriction` 3 hacía que saliera flojo y tardara casi 4 s en cruzar 20 m (la velocidad de salida se
calcula para que pare justo en el punto apuntado, así que **más fricción = sale más fuerte y llega
antes**). Subió a 10, y es un número del panel: «putter: rapidez».

### El balance se guarda

Cambiar de campo recarga la página, así que perder todo lo ajustado en el panel hacía imposible probar
un balance en varios campos. Ahora se guarda en el navegador y vuelve al recargar, con un botón
«Restaurar» que lo borra. No se guarda en el código: para eso está «copiar configuración».

### Lo que rompió y por qué

Dos regresiones que encontraron las pruebas, y que valen como nota:

- **Mover el cuerpo rompió media prueba.** Muchas comprobaciones leían `player.position.x` como si
  fuera el puesto. Ahora el puesto es `player.anchor` y el cuerpo está al costado; el palazo, en
  cambio, sale del cuerpo, así que sus blancos se ponen respecto de `position`.
- **Inclinar el tiro hacia lo más alto del camino rompió los valles.** Apuntando al fondo de una
  hondonada, el punto plano de adelante "ganaba" y levantaba el driver, que les pasaba por encima a los
  que estaban abajo. Se arregló con `RISE_BLOCKS`: solo cuentan los desniveles de más de 60 cm. Una
  loma tapa; un montículo, no.

## Hecho: buscándole identidad al hierro

### El bug que destapó todo

Leandro lo vio jugando: si la pelota del hierro **picaba justo antes** de un guerrero con escudo, la
explosión lo dañaba y después el pelotazo lo dañaba otra vez; pegándole directo, en cambio, decía
"bloqueado". Dos cosas mal a la vez:

1. **El mismo enemigo cobraba dos veces por un tiro.** El área y el pelotazo eran caminos separados.
   Ahora `blast`, `chillAround` y `sweep` **anotan en `skip` a quién alcanzaron**, así que una pelota
   nunca le cobra dos veces al mismo, en ningún orden.
2. **El escudo solo frenaba la pelota que atraviesa.** Por eso el hierro reventaba contra el escudo y
   lo mataba igual. Ahora frena **cualquiera** que le llegue de frente; lo único que lo pasa es lo que
   cae a más de 45°, que es el globo del wedge. Con eso vuelve a valer la regla: al del escudo se lo
   resuelve con un globo, con hielo, o de costado.

### Los dos modos del hierro

«Me está costando encontrarle identidad al palo, más allá de las colinas», y tenía razón: el hierro era
*driver con salpicadura*, hacía un poco de todo y no era el mejor en nada. Hay un toggle en el panel:

- **revienta** (el nuevo, por defecto): no atraviesa. Explota al ras del piso, **abajo del primero que
  toca**. Si cae al piso sin tocar a nadie, **no pasa nada**.
- **atraviesa** (el anterior): pasa de largo hasta a tres y abre su área donde cae, conecte o no.

La identidad que propone *revienta*: **es el único palo que exige acertarle a alguien.** El driver
perdona (atraviesa la fila entera), el wedge perdona (cae adonde apuntaste). El hierro no: fallás y no
pasa nada; conectás y salpica. Es el palo de la puntería. Y como el escudo ahora lo frena, dejó de ser
la respuesta cómoda a los escudos, que era lo que le borroneaba el rol.

Sobre ese palo, **el que recibe el pelotazo cobra el impacto** (1/3/7) y los de alrededor el área
(1/2/4) — los dos números que pidió Leandro. Nadie cobra los dos.

### El putter

Se simplificó: llega **hasta la línea de 20 m** y nada más, no explota ni abre área, le pega al primero
que toca y listo. Velocidad media (`rollFriction` 10 → 7) y **carga rápida (0.5 s)**, que ahora se puede
porque el tiempo de carga volvió a ser de cada palo. Es el palo de cerca, sin vueltas.

### Detalles del panel

- El **radio del área son tres números por palo**, uno por nivel de golpe, en vez de un radio único
  multiplicado por una tabla global.
- El **tiempo de carga es de cada palo** otra vez, en su propia tabla.

### Notas para la próxima

- El globo detona **donde cae**, no sobre el enemigo que toca. Reventarlo sobre el enemigo descentraba
  el rectángulo del vendaval respecto de la línea del tiro. La explosión sobre el enemigo es regla del
  hierro, no del wedge.
- Las pruebas del hielo pasaron a tirar con el **wedge**: es el único que abre su área por caer al
  piso, así que es el único con el que se puede enfriar un punto del campo sin conectar con nadie.

## Hecho: los palos desde el principio, y los poderes como premio

Queda resuelta la pregunta que estaba abierta desde el rediseño («¿las oleadas tienen que desbloquear
encantamientos en vez de palos?»). La respuesta de Leandro fue sí, y tiene sentido: **elegir palo es
una decisión táctica, no un premio**. Que el juego arranque con un solo palo obligaba a jugar la
primera oleada sin la mecánica central, que es elegir la entrega según la distancia.

- **Los cuatro palos están desde la oleada 1.**
- **Lo que se gana jugando son los poderes**: el golpe está desde el principio, la escarcha llega en la
  oleada 2 («Escudos al frente», que es justo lo que abre) y el vendaval en la 3 («La estampida», que es
  justo lo que junta). `Wave.unlock` pasó de `ClubId` a `EnchantId`, y `Player` ganó un `powers` aparte
  del `unlocked` de palos, que ahora arranca completo.
- El cartel entre oleadas muestra el **poder** nuevo, con su tecla y su recarga.

### Los palos comparten color

Cada palo tenía el suyo, y el del hierro era **celeste, el mismo de la escarcha**: parecía que el palo
traía el poder, cuando son cosas independientes. Ahora los cuatro usan `CLUB_COLOR`, un hueso neutro.
Los colores quedaron para los poderes, que es donde significan algo.

### Cada palo tiene su ícono

Leandro pasó una imagen por palo (venían al revés y con fondo blanco opaco). Se rotan 180° y se
convierten en siluetas blancas con transparencia, para que se puedan teñir y no se vean como stickers
sobre la barra oscura. Viven en `web/public/clubs/`. Lo que distingue a un palo de otro en el HUD es
ahora el ícono y la tecla, no el color.

## Hecho: las habilidades aparte (24/9/2026)

Rediseño dictado por Leandro: **los palos dejan de llevar poder** y lo que antes era combinar un palo
con un elemento pasa a ser tres habilidades directas, con su tecla, su recarga y **su propia pelota**.
Usarlas no toca la pelota del puesto ni gasta ninguna otra, y salen en el acto hacia el mouse, aun con
un tiro cargando.

- **Q · Granada** (nueva, oleada 4): tiro rápido que cae donde apuntás. No hace daño: corre a los que
  agarra hacia los costados de la línea del tiro hasta dejarlos a «fuerza» metros de ella. Quedan en
  dos filas que apuntan al golfista, servidas para el driver. Así se interpretó «empujarlos hacia los
  costados para alinearlos», y Leandro lo confirmó.
- **W · Hielo** (oleada 3): reemplaza a la combinación más usada, wedge + escarcha. Cae y deja una
  zona fría varios segundos; el que está adentro, o entra después, camina lento, y al salir se le pasa
  a los 0.5 s. **Ya no baja escudos ni apaga al chamán.**
- **E · Vendaval** (oleada 2, la de los escudos): es el driver + vendaval de antes. Los junta sobre la
  línea y los **silencia**: sin escudo, sin aura, sin inmunidad. Y vulnerables: +1 de daño por
  pelotazo mientras dura, para que siga sirviendo contra el jefe.

Todos los números están en `src/core/abilities.ts` y en la sección «Habilidades» del panel de balance.
Arranque: hielo 4 m, 5 s, recarga 10 s; vendaval 5 s de silencio, recarga 8 s; granada 4 m, filas a
5 m, recarga 6 s.

Pendiente: las pruebas de navegador (`tools/playtest.mjs`, `tools/relieve.mjs`) todavía usan la API de
poderes y hay que pasarlas a las habilidades.
