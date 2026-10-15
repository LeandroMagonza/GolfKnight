# Monstruos nuevos (14/10)

Leandro pidió seis monstruos que no tuviéramos, con la misma estética y la misma temática que la horda
(fantasía medieval, una horda que ataca la ciudad): tres humanoides, uno de ellos bien ancho y
musculoso, y tres que no lo sean (de cuatro patas, que se deslicen…). Se descartó el cíclope porque se
pisaba con el ogro.

Ya tienen modelo, animaciones y un lugar en `ENEMIES` (`src/core/waves.ts`), pero **no salen en las
oleadas**: no están en `LADDER` ni en `HEAVY`. Cómo y cuándo entran lo decide Leandro.

## Cómo verlos

- **`bestiario.html`** (con las herramientas de prueba): todos los enemigos en fila, al tamaño del juego.
  Botones para verlos quietos, caminando, corriendo, atacando y muriendo, como lo hace el juego. "Nuevos"
  o "Todos" para compararlos con la horda, y "Avanzan" para verlos andar a su velocidad: si los pies
  patinan, la escala del clip no coincide.
- **En una partida**, desde la consola: `__gk.spawn('ogre', x, z)` (también `minotaur`, `lizardman`,
  `warg`, `spider`, `slime`).

## Los seis

| | Tipo | Cómo es | Arma o ataque | Altura (provisoria) |
|---|---|---|---|---|
| Ogro | humanoide | Gris azulado. Hombros y trapecios enormes, panza, piernas cortas y gruesas, cabeza chica hundida con colmillos y rodete. Taparrabo, vendas y collar de dientes | Garrote del pack | 2.8 m |
| Minotauro | humanoide | Pelaje marrón, torso en V, joroba con crin, cuernos de marfil, argolla dorada en la nariz, pezuñas, cola. Falda de tiras con tachas y correa cruzada | Hacha doble del pack | 2.8 m (con los cuernos) |
| Hombre lagarto | humanoide | Flaco y encorvado, verde azulado con panza amarilla en placas, hocico con dientes, cresta naranja y roja hasta la cola, hombrera de hueso | Lanza del pack | 2.0 m (con la cresta) |
| Huargo | cuatro patas | Lobo gigante encorvado, gris y pardo, melena de púas, ojos rojos, collar con pinchos y cincha goblin | Embestida y mordida | 1.4 m |
| Araña gigante | ocho patas | Casi negra, rombos rojos en el abdomen y un reloj de arena en la panza, ocho ojos rojos, patas con bandas | Se para en las patas de atrás y clava los colmillos | 1.1 m (2.5 m de punta a punta) |
| Limo venenoso | se desliza | Cúpula violeta facetada, chorreada, con ojos en antenas, boca con colmillos de baba y tragados una calavera con casco, una espada y un hueso | Se estira para atrás y se estrella para adelante | 1.2 m |

Los números de `ENEMIES` (vida, velocidad, daño) son de partida, para probarlos: ogro y minotauro
pesados (`heavy`), lagarto, huargo y araña corren. Ideas sin decidir para cuando entren: el huargo como
el más rápido de la horda, la araña ancha (que tape tiros), el limo que se divide al morir, el minotauro
que embiste en línea recta.

El limo era verde ácido. Sobre el pasto del juego se perdía (verde contra verde, desde la cámara alta),
así que pasó a violeta, el complementario. El verde sigue disponible: `--goo=verde` al exportarlo.

## Cómo están hechos

Con Blender por scripts (sin abrir la ventana), sobre las piezas comunes de `tools/synty_kit.py`:

- la paleta del atlas de PolygonDungeon: cada cara apunta su UV a un cuadrito, como el pack, así que
  todos comparten el material de la horda;
- figuras low-poly hechas de anillos, con un poco de ruido para que queden facetadas;
- pesos por cercanía a los huesos;
- piezas del pack: armas (`SM_Wep_*`) y pedazos de personajes (la calavera con casco del limo es la
  cabeza del esqueleto soldado).

**Humanoides** (`tools/monster_ogre.py`, `monster_minotaur.py`, `monster_lizardman.py`, con las ayudas de
`monster_body.py`):
- Se arman sobre el esqueleto de 49 huesos que comparten los 16 personajes de Synty, así que caminan,
  corren y mueren con los clips de siempre.
- Atacan como el resto: el brazo derecho arriba y abajo por código, y el arma sigue a la mano.
- Entran en `dungeon.glb` con `--with=monster_...` en `retarget_to_glb.py` (el comando está en el
  README).
- Truco del ogro: el hombro está a 19 cm del centro, así que un cuerpo ancho se tragaba los brazos
  caídos. Cada brazo se modela un poco levantado en la pose T, y al bajar ese corrimiento queda para
  afuera.
- **Tercera versión (14/10).**
  - Leandro pidió "más polys, más detalle, para que peguen con los de Meshy", pero quería decir Synty:
    confunde los nombres.
  - La segunda versión había ido a 6000–7000 vértices con sombreado suave, y quedaba demasiado blanda al
    lado del pack.
  - La tercera vuelve a facetada, con el tamaño de cara de Synty, de 4 a 5 cm de mediana. Tiene entre
    3100 y 3300 vértices cada una; la primera tenía de 1700 a 2900.
  - El detalle sale de piezas separadas: dedos con nudillos, ojos bajo la ceja, colmillos, correas,
    tachas, flecos, crin, escamas y lo que cuelga del cinturón.
  - Color plano por zona: la luz hace el sombreado.
  - Pedido de Leandro sobre las cabezas, que se veían hundidas:
    - Las tres cabezas suben entre 5 y 6.5 cm.
    - El lagarto tiene cuello propio y la mandíbula ya no se mete en el pecho.
    - El minotauro muestra el cuello de toro de perfil.
    - Al ogro los trapecios le suben hasta la nuca, sin el plano liso que se le veía atrás.
  - Las anteriores quedaron en `assets/monsters/scratch/`. `SMOOTH_ANGLE` y `paint=True` en
    `monster_body.py` vuelven al estilo de la segunda.

**Bichos** (`tools/beast_warg.py`, `beast_spider.py`, `beast_slime.py`):
- Cada uno tiene su propio esqueleto. El huargo y la araña comparten `beast_rig.py`: patas con IK
  calculada en cada cuadro y guardada como rotaciones, y las pisadas no patinan.
- Clips: `Idle`, `Walking`, `Running`, `Attack` (el golpe cae al 45 %) y `Hard Landing` (la muerte,
  quieta desde el 33 %, porque el juego la congela al 42 %).
- La zancada está calculada para la escala con que el juego pasa los clips de Mixamo. A escala 1, los
  pies van hacia atrás a 1.5·H/1.8 m/s caminando y 4·H/1.8 corriendo, con H la altura del modelo.
- Cada uno es su propio GLB (`public/models/warg.glb`, `spider.glb`, `slime.glb`, de 0.4 a 0.5 MB):
  `blender -b --python tools/beast_warg.py -- public/models/warg.glb`.

**Vista previa** sin abrir Blender: `blender -b --python tools/kit_preview.py -- <módulo> <salida.png>`
arma una hoja con el modelo de frente, de tres cuartos, de costado y de atrás. A los humanoides les suma
poses de prueba (paso, golpe, agachado) y a los bichos, cuadros de cada clip. La carta de colores de la
paleta: `python tools/synty_kit.py carta <salida.png>`.

## Lo que cambió en el juego

- `EnemyStats.model`: los que no usan el esqueleto de PolygonDungeon traen su propio GLB. `main.ts` lo
  carga y, si falta el modelo de un monstruo nuevo, ese tipo no se registra y el juego sigue.
- `startAttack` (`enemies.ts`): si el modelo trae un clip `Attack`, lo pasa a la velocidad justa para que
  su golpe caiga en el impacto. Los humanoides no lo traen y siguen con el gesto por código.
- `dungeon.glb` pasó de 9.05 a 9.32 MB con los tres humanoides. Ayudó sacar del armado las
  capas de UV que el material no usa (`map11`, `lightmapUV` de Synty), que pesaban 1.6 MB (también
  bajó `cine-dungeon.glb` de 9.7 a 8.1 MB).

## A tener en cuenta

- **Altura en el juego:** se mide con todo el modelo en reposo, así que cuenta los cuernos del minotauro,
  la cresta del lagarto y el rodete del ogro.
- **Huargo y araña sin columna:** no tienen hueso "Spine", así que no hay mitad de arriba aparte. Lo que
  se pase por la capa superior (el festejo, por ejemplo) no les aplica.
- **Muertes corridas:** el huargo termina tirado unos 30 cm a un costado y la araña, 12 cm. El limo
  deja la espada y el hueso clavados, un poco bajo el piso.
- **Ancho de la araña:** es mucho más ancha que alta (2.5 m de patas para 1.1 m de alto). Su radio de
  choque (0.9) cubre el cuerpo, no las patas.
- **Bichos con menos detalle:** huargo, araña y limo están facetados como el pack, pero tienen menos
  detalle que los humanoides de la tercera versión.
- **Armas que rozan el piso:** las largas tocan el piso un instante al caminar.
- **Taparrabos atravesados:** el muslo puede atravesar el taparrabo en el paso más largo.
