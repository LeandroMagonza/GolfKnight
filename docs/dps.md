# Daño por segundo: cuánto te ocupa cada enemigo

11/10/2026, pedido de Leandro: «habría que hacer un análisis de DPS, cuánto daño por segundo tenés que
hacer, teniendo en cuenta la velocidad de los enemigos y su vida; y lo mismo con los poderes». Lo calcula
`node tools/dps.mjs`, que lee los números del juego: se vuelve a correr cuando cambien.

## Cómo se mide

**La ocupación**: el tiempo que te lleva matarlo tirándole solo a él, sobre el tiempo que tarda en caminar
lo que alcanzan tus palos (55 m) hasta la línea. Un 25 % quiere decir que, mientras viene, le tenés que
dedicar uno de cada cuatro tiros. Al 100 % no llegás aunque no le tires a nadie más. En una oleada se
suman los de todos y se divide por lo que dura la oleada.

Con el ritmo real de Leandro en sus partidas del nivel 10 (hasta el 11/10, con la carga de fábrica):
37.9 tiros por minuto, 82 % que pegan, y de los que pegan, 35 % de golpe 1, 42 % de 2, 16 % de 3 y 7 % de
4 (1.95 de daño promedio). La velocidad, la del nivel 10 por la escalera del medio (×0.91). Todo se puede
cambiar: `--tiros=`, `--pegan=`, `--golpes=35,42,16,7`, `--velocidad=`, `--alcance=`.

**Lo que no cuenta**: los tiros que tocan a varios (en sus partidas, más o menos un 20 % de daño de más),
las habilidades, y que contra un blindado uno carga mejor. Los números absolutos salen pesimistas; lo que
importa es la comparación entre enemigos y entre poderes.

## Los números

Ritmo: 37.9 tiros por minuto (uno cada 1.6 s), 82 % que pegan, 2 de daño promedio por golpe que pega. Velocidad de la dificultad ×0.91; se les tira desde 55 m de la línea.

### Sin poderes: vida, metros por segundo y ocupación

| Enemigo | Normal | Con golpe 4 | Gigante | Gigante con golpe 4 | Propuesta: gigante con vida al doble hasta +3 y 70 % de velocidad, con golpe 4 |
|---|---|---|---|---|---|
| Goblin | 1 · 3.3 m/s · 6 % | 2 · 3.3 m/s · 12 % | 4 · 2.8 m/s · 20 % | 5 · 2.8 m/s · 25 % | 3 · 2.3 m/s · 12 % |
| Goblina | 2 · 3 m/s · 11 % | 3 · 3 m/s · 16 % | 5 · 2.6 m/s · 23 % | 6 · 2.6 m/s · 28 % | 5 · 2.1 m/s · 19 % |
| Orco | 3 · 2.4 m/s · 13 % | 4 · 2.4 m/s · 17 % | 6 · 2 m/s · 22 % | 7 · 2 m/s · 25 % | 7 · 1.7 m/s · 21 % |
| Esqueleto | 4 · 1.9 m/s · 14 % | 5 · 1.9 m/s · 17 % | 7 · 1.6 m/s · 21 % | 8 · 1.6 m/s · 23 % | 8 · 1.3 m/s · 19 % |
| Jefe goblin | 5 · 2.1 m/s · 19 % | 6 · 2.1 m/s · 23 % | 8 · 1.8 m/s · 26 % | 9 · 1.8 m/s · 29 % | 9 · 1.5 m/s · 24 % |
| Caballero esqueleto | 8 · 1.4 m/s · 20 % | 9 · 1.4 m/s · 22 % | 11 · 1.2 m/s · 23 % | 12 · 1.2 m/s · 25 % | 12 · 1 m/s · 21 % |
| Gólem chico | 10 · 1.3 m/s · 23 % | 11 · 1.3 m/s · 25 % | 13 · 1.1 m/s · 25 % | 14 · 1.1 m/s · 27 % | 14 · 0.9 m/s · 23 % |

### La segunda oleada de cada escenario: normal o de gigantes

Lo que te ocupa toda la oleada (la suma de lo que te lleva cada uno) sobre lo que dura (desde que sale el primero hasta que el último llega a la línea).

| Escenario | Normal | De gigantes | Normal con golpe 4 | Gigantes con golpe 4 | Propuesta, con golpe 4 |
|---|---|---|---|---|---|
| 1 | 19 enemigos · 72 % | 13 enemigos · 107 % | 19 enemigos · 101 % | 13 enemigos · 126 % | 13 enemigos · 100 % |
| 2 | 21 enemigos · 85 % | 14 enemigos · 110 % | 21 enemigos · 111 % | 14 enemigos · 127 % | 14 enemigos · 101 % |
| 3 | 19 enemigos · 94 % | 13 enemigos · 119 % | 19 enemigos · 118 % | 13 enemigos · 134 % | 13 enemigos · 110 % |

### Los poderes: cuánto más te ocupa el mismo enemigo

Con el golpe 4 (+1 de vida). El escudo, tirándole de frente (de costado o por arriba, con el globo, no resta). El bendito y el escurridizo: cada golpe que entra pide antes un tiro que le rompa la burbuja o lo haga saltar. El intocable: le entra uno por ciclo. El que se cura: hay que meterle todo adentro de un ciclo.

| Poder | Goblina | Orco | Esqueleto | Caballero esqueleto |
|---|---|---|---|---|
| Sin poder | 16 % · ×1 | 17 % · ×1 | 17 % · ×1 | 22 % · ×1 |
| Escudo 1 (de frente) | 33 % · ×2.1 | 35 % · ×2.1 | 35 % · ×2.1 | 45 % · ×2.1 |
| Escudo 2 (de frente) | 106 % · ×6.5 | 111 % · ×6.5 | 112 % · ×6.5 | 144 % · ×6.5 |
| Escudo 3 (de frente) | 453 % · ×27.9 | 476 % · ×27.9 | 480 % · ×27.9 | 617 % · ×27.9 |
| Blindaje 1 | 33 % · ×2.1 | 35 % · ×2.1 | 35 % · ×2.1 | 45 % · ×2.1 |
| Blindaje 2 | 106 % · ×6.5 | 111 % · ×6.5 | 112 % · ×6.5 | 144 % · ×6.5 |
| Blindaje 2, con el driver de lejos o el putter de cerca (pegan 1 más) | 33 % · ×2.1 | 35 % · ×2.1 | 35 % · ×2.1 | 45 % · ×2.1 |
| Fantasma | 42 % · ×2.6 | 42 % · ×2.4 | 40 % · ×2.3 | 48 % · ×2.2 |
| Bendito | 33 % · ×2 | 34 % · ×2 | 34 % · ×2 | 44 % · ×2 |
| Escurridizo | 33 % · ×2 | 34 % · ×2 | 34 % · ×2 | 44 % · ×2 |
| Intocable (3 tiempos) | 25 % · ×1.5 | 26 % · ×1.5 | 26 % · ×1.5 | 34 % · ×1.5 |
| Intocable (2 tiempos, sin el punto) | 25 % · ×1.5 | 26 % · ×1.5 | 26 % · ×1.5 | 34 % · ×1.5 |
| Se cura | 5 de vida, ciclo de 4.2 s (3 tiros): lo matás en el **55 %** de los ciclos | 6 de vida, ciclo de 4.2 s (3 tiros): lo matás en el **35 %** de los ciclos | 7 de vida, ciclo de 5.7 s (4 tiros): lo matás en el **47 %** de los ciclos | 11 de vida, ciclo de 8.7 s (6 tiros): lo matás en el **36 %** de los ciclos |

## Qué dicen

**El golpe 4 pesa sobre todo en los chicos**: el goblin pasa de 1 a 2 de vida, el doble de tiros; al
gólem chico, de 10 a 11, casi nada.

**Los gigantes sí están fuertes**:
- Cada uno: el goblin gigante con el golpe 4 (5 de vida) te ocupa lo mismo que un jefe goblin (25 % contra
  23 %) y camina un 33 % más rápido (2.8 m/s contra 2.1).
- La oleada entera: la de gigantes te ocupa un **25 a 45 % más que la normal que reemplaza** (107 a 119 %
  contra 72 a 94 %; con el golpe 4, 126 a 134 % contra 101 a 118 %). El +3 parejo castiga a los chicos: a
  una oleada de goblins le multiplica la vida total por 2.4.
- La propuesta (vida al doble pero sin pasar de +3, y a 70 % de su velocidad) la deja **como la normal**
  (100 a 110 % con el golpe 4). Al doble sin tope no sirve: los pesados del final (el caballero, el gólem
  chico) se iban a 17 y 21 de vida y la del tercer escenario quedaba peor (141 %).

**Los poderes, de lo que más pesa a lo que menos** (cuántas veces más te ocupa el mismo enemigo):
- **Escudo 2 o 3 de frente, y blindaje 2 con el hierro o el wedge**: ×6.5 y ×28. Con tu mezcla de golpes casi
  nada le entra. Es a propósito: el escudo se resuelve de costado o por arriba, y el blindaje 2 con el driver
  de lejos o el putter de cerca, que pegan 1 más (así queda en ×2.1). Si no se sabe eso, es un muro.
- **Fantasma**: ×2.2 a ×2.6. Cada golpe le saca 1, y trae 1 de vida de más con «Poderes más duros». Es el más
  caro de los que no tienen vuelta (solo el golpe fantasma y el silencio).
- **Bendito y escurridizo**: ×2. Cada golpe que entra pide antes otro tiro que le rompa la burbuja o lo haga
  saltar.
- **Escudo 1 y blindaje 1**: ×2.1.
- **Intocable**: ×1.5. Le entra uno por ciclo (2.4 s) en vez de uno cada 1.6 s. Con dos tiempos, lo mismo:
  la ventana es más larga pero igual entra uno.
- **El que se cura**: con tu mezcla **lo matás en un 35 a 55 % de los ciclos**; el resto se cura y vuelve a
  empezar. El ciclo está hecho para «golpes medios que entran todos» (2 de daño cada 1.5 s), pero de verdad
  pegan el 82 %: tu daño real por segundo es 1.0, no 1.33. Por eso se siente injusto: depende de la suerte.

**Coincide con lo que sentías**: los fantasmas y los que se curan son los dos más caros de los que no se
resuelven eligiendo bien el palo o el ángulo.
