# Monetización, versiones y juego cruzado

Lo charlado con Leandro el 6 y 7 de octubre. La idea: una **demo gratis** que se juega en el navegador
y sirve de propaganda, y la **versión completa paga** en itch.io y Steam. Abe, el segundo jugador, es la
mejor propaganda que tiene el juego: cualquiera que reciba el enlace entra sin instalar nada.

## Dónde va cada cosa

| Dónde | Qué | Para qué |
|---|---|---|
| **itch.io** | La demo, jugable en el navegador (gratis). La completa, paga, **como descarga**: la app de escritorio, la misma de Steam | Difusión: ahí te encuentran jugadores. Cobrar |
| **Página web propia** (hoy GitHub Pages) | La versión de Abe, una carpeta por versión. La demo también | El enlace de Abe tiene que abrir **la misma versión** que el caballero, fuera de un iframe |
| **Steam** | La completa (app paga) y la demo (app aparte, gratis). Las dos con Abe | Donde están los compradores. Logros, invitar amigos de Steam |

Por qué Abe no juega desde itch: itch tiene **una** versión a la vez y mete el juego en un iframe. Para
Abe hace falta cada versión publicada en su propia dirección (ver «Juego cruzado»), y eso solo se puede
en una página propia. El caballero puede jugar en itch o en Steam: el enlace que comparte apunta a la
página propia.

## Las versiones (armado el 7/10)

`src/edition.ts` dice qué versión es cada compilación; `tools/build.mjs` las compila (`npm run build:all`,
o `build:demo` / `build:abe`). Lo que una versión no tiene **no se compila**: no se puede destrabar desde
la consola del navegador.

- **Completa** (`dist/`): todo. Mientras se desarrolla, trae las herramientas de prueba (panel B, `__gk`,
  `?bot`, `?palos`). Para vender va a hacer falta una completa **sin** ellas (es cambiar `DEV_TOOLS` en
  `vite.config.ts` para esa compilación).
- **Demo** (`dist/demo/`): sin los talentos de dificultad. Se ven en el menú con candado, y al ganar dice
  lo que trae la completa. Sin herramientas de prueba. Con Abe y con la cinemática. Además, sin algunos
  poderes (`DEMO_LOCKS` en `src/edition.ts`, se cambian ahí). Esto no se saca de la compilación: no sale
  en el sorteo.
  - **Enemigos:** escudo, esquiva, fantasma e intocable, y cada partida sortea tres. Es uno de cada par
    de los que se parecen (Leandro): el divino y la esquiva; el blindaje y el fantasma (que también
    comparten con el escudo); el que se cura y el intocable (los dos con su reloj, al revés).
  - **Caballero:** sin los tiros fantasma (pasa todo) ni de viento (hoy casi no sirve), sin los guantes
    (en la completa siguen), sin las mejoras de racha y de matar a dos juntos ni las maestrías mixtas
    (para avanzados): 22 cartas menos. El silencio queda: está bueno que lo conozcan.
- **Abe** (`dist/abe/`): solo para ser Abe. Sin enlace, pide el código de la sala (o el enlace pegado).
  No puede arrancar una partida: el bucle del que juega, el tiro, las oleadas, las cartas, el tutorial y
  la parte de transmitir no se compilan. Sin cinemática (pesa 30 MB en vez de 48).

Las tres se publican con `npm run deploy`: la completa en la raíz, y las otras en
https://leandromagonza.github.io/GolfKnight/demo/ y https://leandromagonza.github.io/GolfKnight/abe/.

**La idea de Leandro (7/10):** la demo se gana en el nivel 0 sin demasiado desafío, y en **menos de dos
horas**, que es lo que da Steam para devolver un juego. El que quiere jugar más, sube la dificultad: eso
es la completa. Hay un solo campo (el liso) porque los de lomas son un talento.

**El modo tenis** es un prototipo: desde el 7/10 no tiene botón en la pantalla de inicio en ninguna
versión. Se entra desde el panel B (pestaña Pruebas) o con `?tenis`.

## Las cartas del caballero en la demo (7/10)

Leandro lo pensó en voz alta; esto fue lo propuesto, y quedó hecho salvo lo del fuego:

| Qué | Propuesta | Por qué |
|---|---|---|
| Silencio | En la demo (hecho) | Está bueno que lo conozcan |
| Fantasma (tiros y guante) | Afuera (hecho) | Pasa todo: con escudo, esquiva, fantasma e intocable en la demo, sería la respuesta a todo |
| Viento | Afuera (hecho) | Hoy casi no sirve: mejor que la primera impresión no sea una carta floja |
| Guantes | Afuera de la demo (hecho); en la completa siguen | Son una segunda versión de los elementos: en la demo alcanza con los tiros |
| Ritmo y En racha (racha); El albañil, El herrero y Perfecto de regalo (matar a dos juntos) | Afuera (hecho) | Son para jugadores avanzados |
| Rayo | Queda | Está medio pasado, pero en la demo eso ayuda a ganar el nivel 0 |
| Putter de fuego | Queda, si se hace lo del fuego compartido | Hoy es flojo: de cerca no les da tiempo a quemarse, y el putter pierde su golpe fuerte porque el tiro de fuego no pega |

**El fuego compartido** (idea de Leandro, para todo el juego): la propuesta con números, para todos los
elementos, está en `diseno-combate.md`, «Propuesta: el elemento compartido».

## Juego cruzado: el amigo que no tiene el juego

La base ya lo permite: el caballero y Abe se encuentran por relays públicos con el código de la sala, sin
importar dónde abrió el juego cada uno. La versión de Steam sería el mismo juego dentro de Electron
(un Chrome), así que se conecta igual. Lo que falta:

1. **El enlace.** Hoy se arma con la dirección de la página del caballero (`watchLink` en `main.ts`). En
   Steam esa dirección es un archivo de su compu, y en itch es la del iframe. Tiene que apuntar siempre a
   la página propia de Abe.
2. **Las versiones.** Hoy, si no coinciden, solo dice «recarguen los dos». Con Steam va a pasar seguido:
   el de Steam puede no haber actualizado. Solución: cada versión publicada queda en su carpeta
   (`/abe/<versión>/`) y el enlace apunta a la del caballero. Los modelos no cambian entre versiones, así
   que ocupa poco más (el código son 1,3 MB).
3. **Que Abe vea todo.** Ya está: la versión de Abe trae todos los enemigos y escenarios, sin poder jugar.
   Sirve también para un **pase de amigo**, como en It Takes Two: el que compró invita gratis a Abe a
   su partida completa.
4. **Que conecte siempre.** Hay redes que no dejan conectarse directo (sale el aviso). Para algo pago
   hace falta un **servidor TURN**: Cloudflare tiene uno con una parte gratis por mes, y lo de Abe gasta
   poco. Además, no depender solo de relays públicos gratis para encontrarse. Y el código de 4 letras se
   puede adivinar: en el enlace, uno largo; las 4 letras solo para dictarlo.

**Para vender desde Abe:** al terminar la partida, a Abe le aparece «Jugá vos: demo gratis o comprarlo en
Steam». Cada Abe es un posible comprador.

## Steam

- **Costo:** US$100 por juego (se devuelven al vender US$1.000). Steam se queda con el 30 %.
- **La página «próximamente»** tiene que estar al menos 2 semanas antes de lanzar; cuanto antes, mejor:
  junta deseados, que es lo que hace que Steam te muestre. Los **Steam Next Fest** son festivales de
  demos, varias veces por año.
- **La versión de escritorio:** el juego web dentro de Electron, sin reescribir nada (Vampire Survivors
  salió así: hecho en JavaScript, a US$3). Steamworks desde JavaScript con `steamworks.js` (logros,
  amigos, invitaciones).
- **Invitar, dos maneras:**
  - **a un amigo de Steam:** la invitación de Steam lleva el código de la sala. El amigo abre su juego
    (completa o demo) y entra como Abe.
  - **un enlace web:** para el que no tiene el juego (ver «Juego cruzado»).
- **Dos con el juego en Steam:** el Abe que entra desde Steam corre la app, así que puede tener **logros
  de Abe** (ideas: detonar 100 marcas, ganar una partida como Abe, salvar la puerta con un hechizo). El
  Abe del navegador no tiene logros.
- **La demo en Steam** es una app aparte, gratis, y viene con Abe: se juega de a dos con la demo. Si trae
  adentro la versión de Abe, un amigo con la completa puede invitar al de la demo a su partida completa:
  la prueba entera, como Abe.
- La conexión puede seguir siendo la misma (WebRTC con TURN). Más adelante se podría usar la red de
  Steam entre dos que lo tienen en Steam.

## itch.io

- **Subir:** con `butler`, el programa oficial de itch, sumado a `npm run deploy` (sube solo lo que
  cambió, los modelos no se vuelven a subir). Una vez, Leandro: crea la página del juego (tipo HTML),
  corre `butler login` en su compu, y después de la primera subida marca «This file will be played in
  the browser».
- **itch no cobra juegos que se juegan en el navegador** (lo confirmé el 8/10 en sus foros): un juego
  HTML es gratis, a lo sumo con donación. Así que la completa paga va como **descarga**: el juego dentro
  de Electron (Windows primero; Mac pide firmar y notarizar con Apple), que es lo mismo que hace falta
  para Steam. Lo más simple: dos páginas, la demo web gratis y la completa paga para bajar.
- **Cobrar:** itch se queda con lo que uno elija (por defecto el 10 %). Se puede poner un mínimo y dejar
  pagar más.
- **Precio (propuesta del 8/10):** US$4,99, como Brotato y Vampire Survivors (que salió a US$2,99 en
  acceso anticipado). Deja lugar para descuentos (Steam vive de las ofertas) y se puede subir con más
  contenido. El mismo en itch y en Steam: Steam pide que las claves de Steam vendidas afuera no salgan más
  baratas, y aunque itch venda sin claves, conviene no ser más barato que Steam.

## El código, privado

Cuando esté lo de itch. Hoy el repo es público porque GitHub Pages gratis solo sirve repos públicos.

- **Plan:** el repo del código pasa a privado (por ejemplo `GolfKnight-codigo`) y un repo público
  `GolfKnight` guarda solo lo compilado (lo que hoy va a `gh-pages`). El enlace y la landing no cambian;
  hay que sacar de la landing el link al código. La otra sesión trabaja en esta misma carpeta: con
  cambiar el remoto una vez, quedan las dos apuntando al repo nuevo.
- **Cuando se venda:** en la página pública van solo la demo y la de Abe. La completa, gratis en un link,
  no la compra nadie.
- Lo compilado igual se puede bajar (es JavaScript minificado, sin mapas al código original): lo privado
  es el código fuente, los docs, las herramientas y el historial.

## Hosting

GitHub Pages, itch.io y Cloudflare Pages son gratis y no cobran tráfico (ninguno pide tarjeta). S3 con
CloudFront es barato con poco tráfico, pero no tiene techo: si el juego pega, se paga por visita (cada
visita nueva baja unos 30 MB). Si GitHub Pages se queda corto (unos 100 GB por mes), mudarse a Cloudflare
Pages es cambiar el deploy.

## Otras fuentes

- **Portales web** (CrazyGames, Poki): comparten lo que ganan con la publicidad. Piden que cargue rápido:
  habría que comprimir los modelos (hoy 30 MB por visita), que igual conviene.
- **Donaciones** en itch: poco, pero cero trabajo.

## Pendiente

- [ ] Leandro: crear la página en itch.io y correr `butler login`. Después: butler en el deploy.
- [x] Qué deja afuera la demo (7/10): talentos, cuatro poderes de enemigos y dos elementos.
- [ ] Que el nivel 0 se gane en menos de dos horas (probarlo jugando).
- [ ] El enlace de Abe a la página propia, y una carpeta por versión.
- [ ] TURN y código largo en el enlace.
- [ ] Repo privado + repo público con lo compilado.
- [ ] Una completa sin herramientas de prueba, para vender.
- [ ] La completa como app de escritorio (Electron), para itch (descarga paga) y Steam.
- [ ] Al abrir la venta, sacar la completa de GitHub Pages (queda la demo y la de Abe).
- [ ] Steam: Electron, steamworks.js, invitaciones, logros, página «próximamente».
