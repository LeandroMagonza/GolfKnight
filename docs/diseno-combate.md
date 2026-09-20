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
