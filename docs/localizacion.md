# Localización

El juego está en dos idiomas: **español** (el original, rioplatense, con voseo) e **inglés**. Esto
cuenta cómo está armado, qué se tradujo, qué quedó afuera a propósito, y las reglas para que lo que se
agregue de acá en adelante no vuelva a quedar solo en español.

## Qué había (relevamiento del 5/10)

Unos 23 mil renglones de TypeScript con todos los textos escritos en el lugar donde se usan, sin ninguna
capa de idiomas. El buscador de `src/i18n.test.ts` encontró ~430 textos en español en 20 archivos, más
los que no tienen tildes ni palabras delatoras (nombres sueltos como «Pausa» o «Driver»):

| Dónde | Qué textos | Cuántos (aprox.) |
| --- | --- | --- |
| `index.html`, `cine.html` | títulos, botones, rótulos de barras, pausa, cartel final, carteles fijos | 45 |
| `src/main.ts` | avisos del HUD (`feedback`, `float`, `showBanner`), Abe, invitar, cámara, final | 110+ |
| `src/core/abilities.ts`, `cards.ts` | nombres, títulos y descripciones de 24 habilidades, 14 mejoras, elementos, recargas | 100+ |
| `src/core/waves.ts`, `difficulty.ts`, `clubs.ts`, `terrain.ts` | enemigos, poderes, oleadas, talentos de dificultad, palos, campos | 50 |
| `src/tutorial.ts` | los 8 pasos, notas y felicitaciones | 40 |
| `src/hud.ts`, `intro.ts`, `endscreen.ts`, `difficultyMenu.ts` | oleada, cartas, placa de controles, cartel del final | 30 |
| `src/net/`, `src/coop/` | el que mira (Abe), sus hechizos, conexión | 35 |
| `src/tennis/` | modo tenis (prototipo) | 10 |
| `src/cine/` | la cinemática: 11 líneas dichas, títulos de planos, reproductor | 20 + 11 voces |
| `PATCHNOTES.md` | la libreta del juego | todo el archivo |

Formatos: no hay fechas ni monedas; los números van con punto decimal y unidades «m» y «s», que sirven
igual en inglés. Ninguna fuente le falta a un idioma.

## Cómo está armado

**Los dos idiomas juntos, en el lugar donde se usa el texto.** No hay un archivo de claves: cada texto
se escribe con su inglés al lado.

```ts
import { L } from './i18n';

hud.feedback(L('¡Golpe perfecto!', 'Perfect hit!'), 'good');
hud.showBanner(L(`Oleada ${n}`, `Wave ${n}`), '');
const name = L((club: string, el: string) => `${club} ${el}`, (club: string, el: string) => `${el} ${club}`);
```

- `L(es, en)` devuelve el del idioma de la página. Sirve para textos, plantillas y funciones (cuando el
  orden de las palabras o el plural cambian entre idiomas, cada idioma tiene su función).
- **El idioma no cambia con la página abierta**: cambiarlo recarga. Por eso `L` se puede usar también al
  armar datos cuando carga un módulo (`name: L('Hielo', 'Ice')` en `core/abilities.ts`), y el resto del
  código no se entera: sigue leyendo `ABILITIES[id].name`.
- TypeScript obliga a escribir los dos: `L('Hola')` no compila. Agregar un texto en un solo idioma es
  imposible sin que se note.
- Por qué así y no con claves (`t('hud.wave')` + un JSON por idioma): el juego lo escriben sesiones que
  agregan mecánicas todos los días; con el inglés al lado del español es difícil olvidarse de él y fácil
  revisarlo, y los cambios son de una línea (menos choques entre sesiones que tocan el mismo archivo). Si
  algún día hay un tercer idioma, `L` pasa a recibir un objeto `{ es, en, pt }`.

**El idioma lo decide `public/lang.js`**, un script común que index.html y cine.html cargan al final
del `<body>`, antes que los módulos:

1. `?lang=es` o `?lang=en` en la dirección (solo para esa visita);
2. si no, lo elegido con el botón de idioma (`localStorage` `gk.lang`);
3. si no, el navegador: español si **alguno** de sus idiomas preferidos es español (mucha gente de acá
   tiene el navegador en inglés con el español en la lista), inglés si no.

Lo deja en `<html lang>`, que es lo que lee `src/i18n.ts`. En las pruebas de vitest no hay página: es
español, así que las pruebas que miran textos siguen igual.

**El HTML fijo** se traduce con atributos: `data-en="..."` reemplaza el texto del elemento,
`data-en-html="..."` el contenido con etiquetas, y `data-en-title`, `data-en-aria-label`, etc., cada
atributo. Lo hace `lang.js` antes del primer cuadro, así no se ve el español un instante.

**El botón de idioma** está en la pantalla de entrada, junto a la versión y la libreta. Cambia y recarga
(la intro no se repite: ya se vio en la sesión). En plena partida no se cambia.

**La cinemática** usa lo mismo: los subtítulos y globos van con `L`, y las voces tienen una carpeta por
idioma: `public/voices/` (español, las de siempre) y `public/voices/en/`. Las líneas dichas y cómo se
actúan, en los dos idiomas, están en `tools/voces_lineas.py`; `tools/voces_openai.py --lang en` genera
las inglesas (mismas voces de OpenAI, con indicaciones en inglés). Los tiempos de los planos no
cambiaron: las líneas en inglés son más cortas y entran en los mismos huecos.

## Qué quedó en español a propósito

- **El panel de balance (B)** (`src/debug.ts`): es una herramienta para quien balancea, no para el que
  juega. El botón que lo abre sí está traducido.
- **Las patch notes**: se escriben en cada commit (el hook de pre-push las exige) y traducirlas cada vez
  duplicaría ese trabajo. En inglés la libreta avisa arriba que están en español. Si hace falta, el paso
  siguiente es un `PATCHNOTES.en.md` opcional.
- **La telemetría** guarda ids y números, no textos; se le agregó `lang` a cada partida para saber
  cuánta gente juega en cada idioma. El título de la oleada que guarda sale en el idioma del jugador.
- **Nombres propios**: Valdehoyo, Abe y Golf Knight no se traducen.
- **Las voces de Kokoro** (`?voces=kokoro`, para comparar) son solo en español.
- **Las claves internas** que quedaron en español y no se tocan: las luces y lugares del arco de
  `game/visuals.ts` (se guardan en `gk.visual` y el panel B las compara por texto), las formas de los
  hechizos de Abe (`'zona' | 'línea' | 'trampa'`, se muestran traducidas con `spellSize`), las tablas del
  panel B (`'abe granizo'`, `'pólvora'`...: así lo guardado sigue valiendo en los dos idiomas) y la causa
  de la derrota que guarda la telemetría (la de siempre, en español, para comparar partidas).

## Lo que falta o queda raro

- **El que mira (Abe) ve los avisos en el idioma del que juega.** El juego le manda a Abe los carteles,
  los avisos y el cartel final ya escritos (`net/host.ts`, `MIRRORED.hud`). Si juegan uno en cada idioma,
  esos textos le llegan en el del otro; lo demás (sus hechizos, su panel) sale en el suyo. Arreglarlo es
  mandar ids en vez de textos.
- **Las patch notes** (ver arriba).
- Nadie jugó todavía el juego entero en inglés: los textos largos (cartas, tutorial) están medidos para
  no pasar al español, pero conviene mirar que nada se corte.

## La red: `src/i18n.test.ts`

Corre con `npm test`. Busca en todo `src/` (menos el panel B) textos que parecen español —tildes, eñes,
¿¡, o frases con palabras como «de», «la», «que», «oleada»— afuera de un `L(...)`, y en index.html y
cine.html textos o atributos legibles sin su `data-en`. Si algo que no ve el jugador salta (un id, un
registro), se marca la línea con un comentario `// i18n-ok`.

Es una red, no una garantía: un nombre suelto sin tildes («Pausa») no lo ve. La otra mitad de la red es
`src/i18n.en.test.ts`, que carga los datos del juego en inglés (cartas, habilidades, enemigos, oleadas,
dificultad, hechizos) y frena si a alguno le queda un texto en español.

## Reglas para lo que se agregue

1. Todo texto nuevo que vea el jugador va con `L('español', 'english')`, en el mismo commit.
2. En HTML fijo, con `data-en` (o `data-en-html` / `data-en-<atributo>`).
3. Los ids, claves de guardado, registros y mensajes para quien programa no se traducen (y si el buscador
   los marca, `// i18n-ok`).
4. Nunca comparar contra un texto traducido (`if (name === 'Hielo')`): comparar ids.
5. El inglés sigue el glosario de abajo y el tono del juego: informal, con humor, corto (el HUD tiene
   poco lugar: que no quede más largo que el español).

## Glosario

| Español | English | Nota |
| --- | --- | --- |
| Valdehoyo / la puerta de Valdehoyo | Valdehoyo / the Valdehoyo gate | nombre propio |
| vos (barra de vida) | you | |
| oleada | wave | |
| escenario | stage | la partida: 3 escenarios + el jefe |
| poder (de escenario) | power | |
| apoyo | support | |
| el jefe / el élite | the boss / the elite | |
| palo | club | |
| driver / hierro 7 / wedge / putter | driver / 7 iron / wedge / putter | |
| rasante / arco bajo / globo / rodado | line drive / low arc / lob / roll | títulos de los palos |
| banda corta / media / larga | short / mid / long range | |
| tiro | shot | lo que sale del palo |
| golpe (1, 2, 3; la calidad) | hit (1, 2, 3) | «golpe 3» = «hit 3» |
| golpe perfecto | perfect hit | |
| pifia | whiff | |
| cargar / la carga / el arco de carga | charge / the charge / the charge arc | |
| clavar (la carga) | lock (the hit) | Espacio |
| puesto | tee | los 9 lugares de tiro |
| pelota | ball | |
| guardias / caddies | guards / caddies | |
| habilidad / mejora / maestría | ability / perk / mastery | |
| carta | card | |
| nivel (nv) | level (lv) | |
| recarga | cooldown | |
| racha | streak | |
| bajas / puntos | kills / points | |
| hielo / fuego / rayo / viento / fantasma / silencio | ice / fire / lightning / wind / ghost / silence | elementos |
| «Driver de hielo», «Guante de fuego» | «Ice Driver», «Fire Glove» | el elemento va adelante |
| frío / congelado | chilled / frozen | |
| escudo / blindaje / etéreo (fantasma) | shield / armor / ethereal (ghost) | |
| escudo divino / bendito / burbuja | divine shield / blessed / bubble | |
| esquiva / escurridizo | dodge / slippery | |
| se cura / intocable | regenerates / untouchable | |
| inmune / amparo (del chamán) | immune / ward | |
| hechicero / curandero / abanderado | sorcerer / healer / standard-bearer | apoyos |
| goblin / goblina / orco / esqueleto | goblin / goblin lass / orc / skeleton | |
| jefe goblin / chamán goblin | goblin chief / goblin shaman | |
| caballero esqueleto / gólem chico / gólem de roca | skeleton knight / small golem / rock golem | |
| alma en pena / kamikaze | wraith / kamikaze | |
| estampida / gigantes / todos con poder | stampede / giants / all powered up | modificadores |
| carrito / hoyo / bandera / pólvora | golf cart / hole / flag / gunpowder | habilidades |
| lluvia de pelotas / caddie dorado / lupa / clon | ball shower / golden caddie / magnifier / clone | |
| palazo / eco / potencia / fuerza / guante | whack / echo / boost / might / glove | |
| muñeca rápida / punto dulce / ritmo / en racha | quick wrists / sweet spot / rhythm / hot streak | mejoras |
| el albañil / el herrero / botiquín | the mason / the smith / first-aid kit | |
| perfecto de regalo / carcaj / pelota extra / segundo aire | free perfect / quiver / extra ball / second wind | |
| Abe, el mago / hechizo | Abe the wizard / spell | |
| el caballero (el que juega, visto por Abe) | the knight | |
| chispa / granizo / remolino / corriente / empujón / maldición / trampa | spark / hail / whirlwind / current / shove / curse / trap | hechizos de Abe |
| dificultad / punto (de dificultad) | difficulty / point | |
| modo tenis / bolsillo / alcanzapelotas | tennis mode / pocket / ball kids | |
| la cinemática / la intro | the intro | |
| vida (los números) | HP | «+1 HP», «Elites have 2 more HP» |
| a pleno | at full HP | |
| partida | run (dificultad) / game (Abe, invitar) | |
| el que juega (visto por Abe) | the knight | |
| sala / foto (de la red) / intento | room / frame / try | |
| loma | hill (cartas) / mound (tutorial) | |
| acierto | hit | «Each hit in a row...» |
| doblete, triplete, cuádruple | double, triple, quadruple | |
| tramo débil / medio / fuerte (del arco) | weak / mid / strong | |
| geomante | geomancer | |
| curanderos, inmunes, abanderados, hechiceros (apoyos) | healers, warders, standard-bearers, sorcerers | |
| Escudos al frente, Acorazados, Fantasmas, Los benditos, Los escurridizos, Los que se curan, Los intocables | Shields Up, Armored Up, Ghosts, The Blessed, The Slippery Ones, The Regenerators, The Untouchables | títulos de oleada |
| Albañiles / Respiro / CURARSE | Masons / Breather / HEAL | cartas de curarse |
| Valle del medio, La meseta, La loma sola | Middle Valley, The Mesa, Lone Hill | campos |
| guardia del castillo, guardia veterano, caballero, caballera | castle guard, veteran guard, knight, lady knight | skins |
| plano / globo (tenis) | drive / lob | «Ice Drive», «Fire Lob» |
| ¡Golpe perfecto! / ¡Pifia! / ¡Sin pelota! | Perfect hit! / Whiff! / No ball! | |
| ¡Oleada despejada! / ¡Llega el élite! / ¡Valdehoyo resiste! | Wave cleared! / Here comes the elite! / Valdehoyo stands! | |
