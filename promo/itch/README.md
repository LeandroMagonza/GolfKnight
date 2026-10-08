# La página de itch.io

**https://forja-de-almas.itch.io/golf-knight** (se edita en https://itch.io/game/edit/5119564).

Las imágenes se arman con `node tools/promo.mjs crudas` (capturas del juego y de la cinemática, en
`logs/promo/`) y `node tools/promo.mjs armar` (lo de esta carpeta). Las capturas del juego son con la
cámara de siempre y oleadas de verdad: los enemigos vienen caminando (ninguno quieto; quietos se los veía
mirando para el costado), y se juega de verdad. De las ráfagas, el cuadro que se usa está en `ELEGIDOS`.
El caballero es el Caballero (desde el 8/10, el único skin junto con la Caballera). Hay una carpeta por idioma: `es/` y
`en/`. La página de itch va en inglés (la mayoría de los que pasan por itch lo leen), con el texto en
español debajo.

## Qué va en cada lugar

| Dónde, en itch | Archivo | Tamaño que pide itch |
|---|---|---|
| **Cover image** (la miniatura en las búsquedas, el inicio y los perfiles: la que más se ve) | `en/portada-630x500.png` (o la de 1260×1000, más nítida) | 630×500, hasta 3 MB |
| **Screenshots** (la columna de la derecha, en este orden) | `en/1-oleada.png` … `en/7-historia-mago.png`: 1920×1080 con un margen transparente de 40 px y las esquinas redondeadas (8/10: en el celular itch las muestra pegadas, y así se ve dónde termina cada una) | cualquiera; unos 2 MB cada una |
| **Banner** (Edit theme → Banner, arriba de la página) | `en/banner-1920x600.png`: el juego con la cámara de la portada, el caballero cargando el golpe, la horda viniendo y los puestos con sus banderas (8/10; el anterior, de la cinemática, juntaba al mago y al caballero, que se nota que son de modelos distintos) | 960 de ancho; la de 1920 se ve nítida |
| **Embed background** (detrás del botón «Run game» de la demo) | `en/boton-jugar-1280x720.png` | 640×360 |
| **Ícono de la app de escritorio** | `icono-512.png` (y `desktop/icon.ico`, que usa `npm run desktop`): un escudo con el palo y la espada cruzados y el título; dibujado (`icono.svg`), no una captura | — |

Para la demo web: Kind of project **HTML**; Embed options **1280 × 720**, con «Fullscreen button» marcado y
«Mobile friendly» sin marcar (se juega con mouse y teclado). Después de la primera subida con butler,
marcar «This file will be played in the browser».

**Las capturas**, de qué es cada una:
1. `1-oleada`: una oleada llegando, con los poderes arriba de cada enemigo, y el golpe cargando.
2. `2-rayo-y-fuego`: el rayo del driver saltando entre un grupo prendido fuego.
3. `3-jefe`: la última oleada, el gólem de roca con su escolta.
4. `4-cartas`: elegir una carta entre oleadas (habilidades, mejoras, maestrías).
5. `5-de-a-dos`: el caballero y Abe en el mismo momento, cada uno en su pantalla.
6. `6-historia-feria` y 7. `7-historia-mago`: la cinemática del principio.

## El texto de la página

**Título:** Golf Knight

**Nombre:** Golf Knight, a secas. «Isekai» atrae, pero mejor en la frase corta y en las etiquetas (que
es por donde busca itch) que en el nombre: un nombre corto se recuerda, y «Golf Knight - Isekai» suena a
relleno para el buscador.

**Short description (tagline):** An isekai golf roguelite: summoned to a fantasy world with only your golf
clubs, stop the horde with perfect swings. *(es: Un isekai de golf: te invocan a otro mundo con tus palos de
golf, y la horda se frena a golpes perfectos.)*

**Descripción (en inglés):**

> **An isekai golf roguelite.** You went to a medieval fair dressed as a knight. Your golf clubs were still in the trunk. Then a car
> hit you, and a wizard summoned you to another world: the prophecy called for shining armor and a
> weapon of deadly precision. He got the golf clubs.
>
> **Defend the gate of Valdehoyo with your swing.** Hordes march at you from the end of the course: pick
> the club, aim, charge the swing and nail the timing. Driver, iron, wedge and putter each fly
> differently, and every enemy brings a power to answer: shields you have to hit from behind, armor
> that only a perfect swing gets through, ghosts, dodgers, healers, untouchables.
>
> - **Build your knight between waves**: fire, ice, lightning and wind shots, gloves, masteries that mix
>   elements. The fire spreads by exploding, the wind gathers them up, the lightning jumps.
> - **Three scenarios and a boss**, with a different set of enemy powers every run.
> - **A difficulty tree**: every win unlocks a point to make the next run harder, your way.
> - **Play with a friend**: send a link and they join as Abe, the wizard, from their browser, no install
>   needed. Abe marks enemies for your next hit, gathers them with whirlwinds, silences them and sets traps.
> - In **English and Spanish**.
>
> The demo is the base game at difficulty 0. The full game adds the difficulty tree, more enemy powers
> and more cards.

**Descripción (en español):**

> **Un isekai de golf.** Fuiste a una feria medieval disfrazado de caballero. Los palos de golf seguían en el baúl. Te pisó un
> auto, y un mago te invocó a otro mundo: la profecía pedía armadura reluciente y un arma de precisión
> letal. Le tocaron los palos de golf.
>
> **Defendé la puerta de Valdehoyo con tu swing.** Las hordas vienen desde el fondo de la cancha: elegí el
> palo, apuntá, cargá el golpe y clavá el momento justo. El driver, el hierro, el wedge y el putter vuelan
> distinto, y cada enemigo trae un poder que pide otra respuesta: escudos que hay que pegar por detrás,
> blindaje que solo atraviesa el golpe perfecto, fantasmas, escurridizos, los que se curan, intocables.
>
> - **Armá tu caballero entre oleadas**: tiros de fuego, hielo, rayo y viento, guantes, maestrías que
>   mezclan elementos. El fuego explota, el viento los junta, el rayo salta.
> - **Tres escenarios y un jefe**, con otros poderes en cada partida.
> - **Un árbol de dificultad**: cada partida ganada destraba un punto para hacer la próxima más difícil, a
>   tu manera.
> - **De a dos**: pasale un enlace a un amigo y entra como Abe, el mago, desde el navegador, sin
>   instalar nada. Abe marca enemigos para tu próximo golpe, los junta con remolinos, los silencia y pone trampas.
> - En **español e inglés**.
>
> La demo es el juego base en dificultad 0. El completo suma el árbol de dificultad, más poderes de
> enemigos y más cartas.

**Genre:** Action · **Tags (máximo 10):** golf, isekai, roguelite, tower-defense, medieval, co-op,
low-poly, funny, fantasy, 3D ·
**Inputs:** Mouse, Keyboard · **Languages:** English, Spanish.

**Precio** (la completa, como descarga): US$2,99. La demo, gratis (se puede dejar «pagá lo que quieras»).
