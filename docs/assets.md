# Los assets del Asset Store: qué sirve y para qué

13–14/10/2026, pedido de Leandro: bajó al proyecto de Unity un montón de assets de Humble Bundles y del Asset
Store, y la idea es pulir el juego (escenario, efectos, sonidos, que las habilidades se sientan potentes)
**sin que se vuelva pesado ni imposible de trabajar**. Acá está qué trae cada paquete, qué conviene traer, para
qué, y cuánto pesaría. Se va anotando a medida que se usa.

## Dónde están y cómo se miran

- **Los paquetes** no están en el proyecto de Unity: están en la caché del Asset Store,
  `%APPDATA%\Unity\Asset Store-5.x\<Vendedor>\<Categoría>\<Paquete>.unitypackage`. Son 51 bajados (11 GB) y 4
  que se estaban bajando el 13/10 a la noche: *Total Music Collection* (Andrew Sitkov), *Ultimate Sound FX
  Bundle* (Sidearm Studios), *RPG Craft Resources* (íconos, A-ravlik) y *Tropical Forest Pack* (Baldinoboy).
- **Ya importados en Unity** (`S:\unityProyects\GolfKnight\Assets`): PolygonNature, PolygonDungeon,
  LowPolyDungeons, Invector 3rd Person Controller y Used Golf Club.
- **El inventario**: `python tools/inventario-assets.py` lista cada paquete sin abrir Unity y deja en
  `logs/assets-catalogo/` un `.tsv` por paquete (ruta y tamaño de cada archivo) y las miniaturas de los modelos
  en `previews/`. Un `.unitypackage` es un tar.gz con una carpeta por archivo; si trae otro paquete adentro
  (Toon Fantasy Nature), se saca y se inventaría aparte.
- **Sacar archivos sueltos** de un paquete: `python tools/inventario-assets.py --sacar=<paquete> --rutas=<lista>
  --a=<carpeta>` (la lista, una ruta `Assets/...` por línea, como figuran en el `.tsv`). Los fuentes van a
  `assets/` (no se sube a git); al juego solo llega lo convertido, a `public/`.
- **Licencia**: son assets comprados o regalados en el Asset Store (licencia estándar del Asset Store) o de
  Humble Bundle. Antes de vender la versión completa, confirmar que la licencia de cada paquete que se use
  permite publicarlo en un juego que no es de Unity.

## Las reglas para no engordar el juego

La web pesa unos 43 MB. Todo lo que se sugiere abajo, junto, suma alrededor de 2 MB.

- **Un estilo**: Synty POLYGON (low poly, caras planas, paleta en un atlas chico). Lo chibi o "cute" (Meshtint,
  Battle Royale Hero, Quirky), lo pintado y lo PBR chocan al lado de la horda.
- **Pocos atlas**: el de Dungeon (que ya baja con `dungeon.glb`), el de Nature (512 px, 7 KB) y, si hace falta,
  Vikings (11 KB) o Gigel (22 KB). Nada de texturas de 2048–8192.
- **GLB comprimidos**: hoy salen sin comprimir (unos 130 bytes por vértice). Con meshopt y cuantizado
  (gltf-transform y `MeshoptDecoder` en el GLTFLoader) bajan de 4 a 6 veces. Conviene hacerlo antes de sumar
  modelos.
- **Efectos**: los sistemas de partículas, materiales y shaders de Unity no sirven en three.js. Sirven sus
  **texturas** (sprites, flipbooks, máscaras, ruidos), algunas **mallas** chicas y las **ideas** de los shaders.
  Las texturas se bajan a 256–512 en webp, idealmente en un solo atlas, y se dibujan con billboards
  instanciados: una llamada de dibujo por tipo, con pools globales (no un sistema por enemigo).
- **Sonido**: ogg o mp3 mono a ~96 kbps, con la cola de silencio recortada. La música, en streaming con
  `<audio>`, sin decodificarla entera.
- **Niebla**: `world.ts` tiene niebla de 70 a 140 m y la cámara llega a 300. Lo que esté más allá de 140 m
  sale del color de la niebla: el fondo va a menos de 140 m o con `fog: false` y un color ya tirado al celeste.

## Personajes y enemigos

**Lo mejor está en Synty, no en Meshtint.** Los personajes de Vikings y de PolygonGeneric tienen los mismos
huesos que PolygonDungeon, así que entran por `tools/retarget_to_glb.py` casi sin cambios (para Generic hay que
aceptar mallas `SM_Gen_Chr_` además de `Character_`), y si se suman al mismo GLB que Dungeon comparten los
clips: cuestan la malla y el atlas, menos de 1 MB.

| Paquete | Veredicto | Para qué |
|---|---|---|
| **Synty POLYGON Vikings** (personajes) | **Usar** | `Characters.fbx` (1,8 MB), 6 personajes con atlas de 512 px (34 KB): Chief_01 (jarl con pieles y barba), Grunt_01/02 (casco con cuernos), Warrior_01/02, Shieldmaiden. Rey o jarl de la cinemática, guardias, una facción enemiga nueva, o un **gigante élite**. Trae armas `Item_*` (hacha, escudo, espada, cuerno). |
| **Synty PolygonGeneric** (viene en Vikings y en Nature) | **Usar** | `Generic_Characters.fbx`, 22 personajes: campesinos, prisioneros, gente de calle, oficinistas, overol (el cuidacoches), Charred_01 (quemado/zombi), Skeleton_01. Aldeanos y el público moderno de la feria y el estacionamiento. |
| **Synty POLYGON Dungeons** (personajes) | **Usar lo que ya está** | `dungeon.glb` ya carga 5 mallas que el juego no usa: Ghost_01 y Ghost_02 (oscuros y flotantes, buen hechicero), Goblin_Warrior_Female, Skeleton_Slave_01, Skeleton_Soldier_02. No suman peso. |
| **Meshtint Monsters Ultimate Pack 02 Cute Series** | Quizás, aparte | 24 bichos chibi con 11–26 clips cada uno. De acá salieron `assets/models-cute` (dragón, hombre lobo, lobito, caparazón, bomba), que ya se descartaron por el estilo. Rescatables: **Hermit King** (se esconde en el caparazón: un jefe invulnerable por ratos), **Training/Target Dummy** (blancos del tutorial o un campo de práctica), Snake Naga (hechicero de tres cabezas). Texturas de 2048: bajarlas a 512. |
| Meshtint Free Barbarian, Free Knight | No | Chibi, con un solo clip útil. |
| Weskel 3D Wizard | No (quizás para Abe en la cinemática) | PBR con 125 mallas y mapas de 4096; esqueleto de UE4. Mucho trabajo para algo que sigue sin ser POLYGON. |
| Dungeon Mason Battle Royale Hero | Modelos no; animaciones quizás | Chibis con armas de fuego. Las animaciones sin arma sí (ver abajo). |
| polyperfect Low Poly Animated Dinosaurs | Quizás | Lo más cercano a Synty del resto (caras planas). Velociraptor_New recoloreado como bestia rápida. |
| PROTOFACTOR Birds Pack | Quizás | Una bandada de cuervos sobre el castillo o en la cinemática (de lejos no se nota que es realista). Textura a 256–512. |
| Indie Cat Low Poly Cats | Quizás | Un gato negro cruzando el fairway, de guiño. Facetado, pega. |
| Omabuarts Quirky (3), Toon Dinosaurs 2, Red Deer Forest animals, Peasant Nolant, Luiz Melo (2D) | No | Cute, pintado, realista de 4–8K o pixel art. Las gallinas y ovejas de Quirky, solo si se quiere una granja cómica. |

### El gólem: que no se confunda el jefe

Hoy el cuerpo fuerte del tercer escenario (gólem chico, 2,1 m), su élite en la 9 (3 m) y el jefe (4 m) son el
mismo modelo. En estos paquetes no hay otro gólem estilo Synty. Opciones:

1. **Un gigante vikingo** (Chief_01 o Warrior_02 a 3 m) como élite de la 9, o como cuerpo fuerte del tercer
   escenario: silueta humana con pieles, contra la roca del gólem, mismo estilo y los mismos clips.
2. **Distinguir al jefe por material**: grietas de lava que brillan, una corona, más grande; los gólems chicos en
   gris o con musgo.
3. Hermit King como jefe del tercer escenario, si se acepta lo cute.

## Animaciones

No hay swings de golf en ningún paquete: para eso sigue Mixamo.

- **Kevin Iglesias Human Basic Motions: usar.** Unos 250 clips de hombre y de mujer (sirven para la
  Caballera), en el lugar y con desplazamiento. El esqueleto tiene prefijo `B-`: hay que sumarle a
  `retarget_to_glb.py` un mapa del lado de la fuente (`B-hips`→Hips, `B-spine`→Spine, `B-chest`→Spine2,
  `B-upperArm.L`→LeftArm, etc.; no tiene Spine1). Lo útil, en `Assets/Kevin Iglesias/Human Animations/Animations/Male/`:
  - caídas y aturdidos: `Combat/HumanM@Knockdown01 - Fall|Ground|StandUp`, `Combat/HumanM@Stun01`,
    `Social/Emotions/HumanM@Pain01`;
  - festejos y reacciones: `Social/Emotions/HumanM@Cheer01|02`, `Angry01`, `Fear01`, `Laugh01`,
    `Social/Conversation/HumanM@HandClap01`;
  - cinemática: `Reverence01`, `Talk01-03`, `HandWave01`, `HeadNod01`, `HeadShake01`, y en `Misc/` sentarse,
    dormir, comer y beber (la feria).
- **Battle Royale Hero, sin arma: quizás.** `Assets/BattleRoyaleHeroesPBR/Animation/NoWeaponStance/`: Dizzy,
  KnockDown, GetUp, GetHit01/02, Die, Victory, PowerUp (la canalización del chamán). Esqueleto de UE4 (mapa en la
  fuente); animadas para proporciones chibi.

## Efectos

| Paquete | Veredicto | Qué se trae |
|---|---|---|
| **Jean Moreno Cartoon FX Remaster** | **Usar (el núcleo)** | Impactos, explosiones, fuego, rayo y "poofs" cartoon, que pegan con Synty. 58 texturas de 128–512 en `Assets/JMO Assets/Cartoon FX Remaster/CFXR Assets/Graphics/`. Lo útil, 150–250 KB (unos 100 KB en atlas). Su "ubershader" (disolución, segundo color, distorsión de UV) es fácil de portar. |
| **Hovl Studio Character Auras** | **Usar** | Las auras de los guantes. La de fuego es `HSFiles/Textures/Fire13.png` (flipbook 2×2) + `Glow1.png`; hielo `Snow5.png`, rayo `Lightning11.png`, fantasma `Smoke27.png`. Las 5 que pide el juego, 50–80 KB. |
| **StarryMoMo Magic Shield Bubbles** | **Usar** | La burbuja del bendito: fresnel + máscara en mosaico + ruido que corre + tambaleo de gelatina (unas 40 líneas de GLSL). `Art/Textures/ShieldMask02.png` + `ShieldMask03.png` + `T_noise01.png` (Shield 1), o la hexagonal `Shield01.png` con `Art/Meshs/Shield1.fbx` (Shield 5). 30–80 KB. |
| **Hovl Studio RPG VFX Bundle** | Usar, selectivo | Rayos pintados (`HandPaintedLightning2.png`, 40 KB), cadena (`Chain1b.png`, silencio), círculos mágicos (`MagicCircle33.png` sagrado, `MagicCircle77.png` runas), marca quemada (`Crater13.png`), cruces de curación (`Plus1.png`), mallas de cristal (`HOVLCrystalPiese.fbx`) y remolino (`Vortex2.fbx`). 150–250 KB. |
| Kyeoms Stylized Shoot Hit Vol2 | Quizás (el cristal de hielo, sí) | Cartoon plano, encaja, pero todo en un atlas de 2048. La malla `Assets/VFX_Klaus/Meshes/Fbx_fx_Shoot&HitVol2_Ice.fbx` para el congelado. |
| GAPH 100 Special Skills Effects | Solo piezas sueltas | Semirrealista y pesadísimo (flipbooks de 2048–8192). Sirven las chicas: `HolyTexture.png` (destello sagrado), `Mark/Chain.png` (una X: silencio), `Crack.png` (grietas, escarcha), `Mark_5.png` + `LongHand.png` (reloj: el intocable), `Tornado.fbx`. 40–60 KB. |
| Ordoss Magic Slashes FX | Quizás | La estela del palo en el golpe perfecto: `Meshes/SlashMesh5_UV.fbx` + `Textures/Slash1.png` (a 512). |
| Long Bunny Labs Boing Kit | La idea, sin traer nada | Resortes amortiguados (~30 líneas): squash & stretch del enemigo al recibir el golpe y de la puerta, pasto que se aparta con la explosión. Lo que más "potencia" da por byte. |
| Distant Lands Lumen | Solo la idea | Columnas y rayos de luz con color por vértice: aparición de élites, el bendito, la puerta. 0 KB. |
| Dustyroom Quibli (toon/anime) | Reescribir ideas, 0 KB | Ver abajo. |
| Brute Force Snow & Ice | No | Realista y caro (texturas de 1–8 MB, cubemaps). |

### Qué efecto para cada cosa

Todo aditivo, sin escribir profundidad, con colores por encima de 1 para que lo levante el bloom que ya existe.

- **Aura de fuego del golfista (guante de fuego)**: Hovl *Fire ayra* (llamas que suben y se estiran, más un
  brillo); en el piso, el anillo de CFXR *Fire Ring*; en la pelota, *Fireball + Fire Trail*. El mismo sistema,
  con otra textura, para los otros guantes. 50–70 KB.
- **Enemigo prendido fuego**: 4–8 llamas por enemigo de un pool instanciado (`cfxr flamme crisp.png` con
  `cfxr uv distortion fire smudge.png`), chispas y humo. Hoy es solo un emisivo que parpadea. 25–40 KB.
- **Congelado**: 3–5 cristales alrededor del cuerpo (el de Kyeoms o el de Hovl, con fresnel), copos
  (`Snow5.png`), escarcha en el piso (`Crack.png`); al romperse, los cristales salen volando.
- **Burbuja del bendito**: StarryMoMo en dorado; al romperse, corte por ruido en 0,3 s, un anillo y el destello
  `HolyTexture.png`.
- **Escudo y blindaje**: chispas de CFXR *Sparks Impact* y un flash hexagonal breve delante del escudo.
- **Impacto de la pelota, por golpe**: golpe 1 *Hit C* (`cfxr hit triangle`), 2 *Impact Contrast*
  (`cfxr spikes impact` + `cfxr stretch trait`), 3 *Impact Glowing* (+ `cfxr flare`), perfecto *Big Impact* +
  *Flash* + estrellas, con un **hit-stop** de 50–80 ms.
- **Explosión del hierro y el wedge**: CFXR *Explosion 1/2* + la marca quemada `Crater13.png` (reemplaza la
  esfera y el anillo de hoy).
- **Rayo**: una cinta mirando a cámara con `cfxr electric arcs x4.png` (una variante por salto), chispa en las
  puntas, y *Electrified* en el electrocutado.
- **Viento**: rayas a lo largo del tiro (*Lines Poof*); el hierro, anillo que se abre; el wedge, remolino en el
  piso (`Vortex2.fbx` + `Trail48.png`).
- **Fantasma**: pelota con fresnel y estela de humo pálido; el enemigo etéreo con fresnel y disolución por
  ruido en vez de transparencia lisa.
- **Silencio**: anillo de cadena girando (`Chain1b.png`) y una X sobre la cabeza.
- **El que se cura y el curandero**: cruces que suben (`Plus1.png`) y un círculo de runas verde
  (`MagicCircle77.png`); al curarse, una ráfaga de cruces.
- **Aura del chamán**: el mismo círculo en violeta, y una burbuja fina sobre los protegidos.
- **Escurridizo**: rayas (*Lines Poof*) y una copia translúcida del enemigo durante 0,2 s.
- **Intocable**: un reloj en el piso (`Mark_5.png` + `LongHand.png`) que marca el ciclo.
- **Aparición y muerte**: *Smoke Poof* al aparecer y una columna de luz para los élites; *Magic Poof* al morir.

### El shader toon

Quibli hace: rampa de luz (half-Lambert en una textura de degradé), degradé por altura, borde de luz con corte
duro, brillo plano, sombras con color propio y contorno con casco invertido. Vale la pena, sin costo:

1. **Rampa**: `MeshToonMaterial` con un `gradientMap` de 3–4 px (o un parche al Standard de hoy).
   Ojo: `patchRim` en `visuals.ts` solo toca materiales Standard.
2. **Borde de luz con corte duro y color de sombra**: cambiar el `pow` del borde de luz que ya existe por un
   `smoothstep`.
3. **Degradé por altura en los personajes**: mejora mucho cómo se lee la horda.
4. **Contorno**: solo el golfista y los élites (duplica dibujos y vértices con esqueleto). Synty trae normales
   partidas en las aristas: hay que calcular normales suaves al cargar.

## Entorno

### Las piezas "SM_Terrain" (Synty POLYGON Nature, ya en Unity)

Leandro: «estaba lindo, pero no sé si encaja, porque nuestro terreno es muy plano». Para el campo, no; para lo
que lo rodea, sí. Todas usan el atlas de Nature (512 px, 7 KB), aunque **sus verdes son oliva apagados** y el
juego usa verdes saturados: hay que repintar las casillas del atlas, que sigue pesando 7 KB.

| Piezas | Medidas | Dónde |
|---|---|---|
| **GrassEdge_01..04**, **Roots_01/02** | Escalón de pasto con frente de tierra y roca, 4–10 m de ancho, 2–3,6 m de alto | **Lo que mejor encaja**: un talud del fairway al bosque, o los puestos de salida elevados, como los tees de verdad. Le da relieve al campo sin tocar el juego. |
| **Mountain_01..03** | 49×24, 29×16 y 39×11 m | Lomas a los costados o montañas al fondo, escaladas 2–4 veces, a menos de 140 m. |
| Ground_Mound | Casi planos | En el fairway no (se notaría la costura con el pasto, y ya está `heightAt`); en el rough, bajo los árboles. |
| RiverSide | Orilla de 9 m | Quizás, un arroyo de adorno a un costado. |
| DustPile, Rubble_Pebbles | Manchas de 2 m | El piso pisoteado frente a la puerta. |
| MountainSkybox | Anillo de 594 m | La malla sirve; su textura es de 8192×4096: cambiarla por color o un JPG de 2048 y achicarla a 240 m de radio. |

Además, dentro del paquete de Nature, `PolygonGeneric/Models/SM_Gen_Env_Background_Mountain_01..03` y
`SM_Gen_Env_Hill_01..05`: siluetas de horizonte muy livianas.

| Paquete | Veredicto | Para qué |
|---|---|---|
| **Synty POLYGON Nature** | **Usar** | Árboles Round, TallRound y PolyPine (100–560 vértices), arbustos, flores, piedras, tocones, cercas, carteles, antorchas, las piezas de terreno. Todo con el atlas de 7 KB, instanciado como hoy. Evitar los árboles con hojas en planos transparentes (Birch, Pine, Willow) y los gigantes de 6.000 vértices. ~130 KB comprimido. |
| **Synty POLYGON Dungeons** (ya en Unity) | **Usar** | **La puerta y la muralla con el atlas que ya está cargado**: `SM_Env_Door_Large_Frame_01` (5,9×5,6 m), `SM_Env_Door_Large_Wood_01`, `SM_Env_Portcullis_01`, `SM_Env_Wall_01..07` (5,2 m, como `WALL_HEIGHT`), `SM_Env_Wall_Trim_Top_01`, `SM_Env_Wall_Pillar_Large_01`. ~120 KB comprimido. Estandartes (`SM_Prop_Wall_Banner_01..06`, `SM_Wep_Banner_01..05`), trono, pilares de runas, espadas, armería, antorchas. |
| **Synty POLYGON Vikings** (entorno) | **Usar** | El pueblo de Valdehoyo y los bordes: torre de guardia, entrada de aldea, cercas de madera, banderas, banco, carretilla (el carrito de palos medieval), carro, puesto de mercado. Sus montañas son nevadas (hay una textura `Snow_To_Grass` a confirmar). |
| **Gigel3d RPG Poly Pack Lite** | **Usar** | Casas para los techos del pueblo detrás de la muralla, toldos de la feria, cercas, bancos. Atlas de 22 KB. |
| Pure Poly Mining/Blacksmith | Quizás | Flat y compatible: carpas, carro de caballos, cartel, faroles. Lo demás es minería. |
| JustCreate Low Poly Dungeons (ya en Unity) | Quizás | Trono, fuente, guillotina; más "cute" que Synty. |
| Innerverse Ultimate Nature Starter | Quizás | Acantilados y una montaña rocosa de fondo. |
| David Aldy Animated Chest | Quizás | Un cofre animado para un botín o la cinemática. |
| Perfect Games Arcade Car | Quizás | El auto del estacionamiento (`MuscleCar1969.FBX`) en vez del "auto de cajas". Trae sonidos útiles (ver Sonido). |
| Broken Vector Low Poly Tree Pack | Quizás | Árboles flat livianísimos, pero en `.dae` (Blender 5 ya no lo abre). |
| PaperDuck Simple Shields | Quizás | Ya hay `shields.glb` de Dungeon. |
| Used Golf Club | **Ya se usa** | Es `public/models/club.glb` (`tools/club_to_glb.py`). No hay nada más de golf en ningún paquete: banderas de hoyo, carritos y bolsas siguen procedurales. |
| SICS Stone Age, SICS Toon Fantasy Nature, Inguz Medieval Props, N-hance Weapons, Andrey Low Poly Pack, Evgenia Piece of Nature, Frut Chest, Invector | No | Pintado, PBR, toon con contorno o texturas de 5–20 MB. |

## Sonido

Hoy todo es sintetizado (`src/audio/audio.ts`) y la música sale de Tone.js. Los tiempos de abajo son exactos
(leídos de los encabezados de los WAV/OGG).

| Paquete | Veredicto | Qué trae |
|---|---|---|
| **Cafofo Monster Sounds Pack** | **Usar, pocos** (~22 de 680) | Humanoides chicos (goblins) y grandes (orcos, jefes), criaturas grandes (gólems), demonios, zombis, fantasmas, gruñidos, siseos, lengua antigua (conjuros). No hay huesos ni voces humanas. |
| **WOW Sound Music Stingers and UI SFX 2** | **Usar** | Los stingers de la serie `TD_` (tower defense): ganar, perder, notificaciones. UI: clicks, selección, error, cartas. Impactos, explosiones, whoosh. Su única música no va. |
| Hovl RPG VFX Bundle | Usar 5–6 de 12 | Rayo, rayo en cadena, hielo, meteoro (fuego), impacto mágico, explosión de energía. |
| Perfect Games Arcade Car | Usar 3–4 | Motor (el carrito), choque de metal (escudo, bendito), choque de goma (rebote), en ogg mono. |
| polyperfect Dinosaurs | Quizás, 2 | Pisotón y rugido para el gólem. |

**Lo que se trae**, en dos tandas. El mapeo completo, sonido por sonido, está en
[assets-sonidos.md](assets-sonidos.md). Prefijos:
W = `Assets/Game Music Stingers and UI SFX Pack 2/`, C = `Assets/Monster Sounds Pack/`, H =
`Assets/Hovl Studio/HSFiles/Sounds/`, P = `Assets/ACC_Multiplayer/Sounds/`.

- **Primera tanda** (31 archivos, ~38 s, **~0,6 MB** en ogg):
  - ganar `W Stingers_Jingles/Fantasy/TD_Win_Stinger_01_01` y perder `TD_Lose Stinger_01_01`;
  - la muerte de cada tipo de enemigo:
    - goblin `C Humanoid Small 1/... Short 4`;
    - orco `C Humanoid Large 2/... Short 2`;
    - esqueleto `C Zombie 2/Zombie 2_22` + `W PP_Destroy_1_1`;
    - jefe goblin `C Humanoid Large 4/... Short 4`;
    - chamán `C Humanoid Small 4/... Short 20`;
    - caballero `C Demon 3/... Short 05` + metal;
    - gólem `C Large Creature 01/... Short 1`;
    - alma en pena `W PP_Monster_Dissipate`;
    - el jefe: aparece `C Large Creature 9 - Long 6`, muere `Long 8`;
  - un élite que aparece: `W PP_Monster_Alert_1_1` + la risa `C Demon 1/... Laugh 04`;
  - la pelota contra el enemigo, `W FA_Funny_Impact_1_1`;
  - el impacto por golpe (provisorio, no hay un "tock" de golf): `W PP_Small_Impact_1_1/_3/_4`, y en el perfecto
    además `TD_Collect_Star_01`;
  - la pifia `W CGM3_Funny_Negative_Feedback_02_1`;
  - explosiones `W PP_Explosion_1_4` (chica) y `_1_3` (grande);
  - la puerta y el golpe al golfista `W PP_Heavy_Impact_1_1/_1_2`;
  - UI: click, atrás, cartas que aparecen (`LQ_Swipe`) y se eligen, oleada superada (`LQ_Stage Clear`).
- **Segunda tanda** (~0,3 MB):
  - hielo `H Skill 8`, fuego `H Skill 11`, rayo `H Skill 2` y en cadena `H Skill 10`;
  - el hoyo `W LQ_Comedy_Drop`, el conjuro del chamán `C Ancient Language 1_16`;
  - el gólem tirando la roca y la roca cayendo;
  - el alma en pena que agarra, whooshes del swing, puerta caída;
  - el carrito `P Engine1_Idle` y el atropello `P EngineMuscle_Backfire`.
- **Se quedan sintetizados**: el tic del arco de carga, el arpegio de las bajas, el desbloqueo y el cuerno de
  la oleada (no hay cuerno en ningún paquete).
- **Esperar a Sidearm** (Ultimate Sound FX Bundle) para el tock de golf, un cuerno de guerra, hielo y fuego más
  claros, huesos y una puerta de madera. **La música**, de Andrew Sitkov (Total Music Collection): dos temas de
  2 min son unos 3 MB.
- **De paso**: las voces (`public/voices`) están en WAV, 2,3 MB; en ogg o mp3 a 48 kbps quedan en 0,3 MB. Ahorra
  más de lo que cuesta todo lo de arriba. Si importa el iPhone viejo, mp3 en vez de ogg.

## Por dónde empezar

**Hecho el 14/10** (los puntos 1 a 3, con la curación y los sonidos que pidió Leandro): el atlas de efectos
(`public/fx/atlas.webp`, 52 KB, armado con `tools/vfx_atlas.py`), las partículas (`src/game/particles.ts`,
`src/game/fx.ts`), la burbuja (`src/game/bubble.ts`, `public/fx/bubble.webp`), 53 sonidos en `public/sfx/`
(~0,6 MB; el crepitar del fuego lo arma `tools/crepitar.py`), todo con llaves para prender y apagar (POLISH en
`src/core/polish.ts`) y pruebas con `?prueba=` (ver [pruebas.md](pruebas.md)).

Lo que más se siente por cada KB:

1. **Los golpes**: impactos de CFXR por golpe, hit-stop en el perfecto, squash & stretch del enemigo al recibir
   el golpe. Y los sonidos de la primera tanda.
2. **Los guantes y los estados**: aura de fuego (y las otras) en el golfista, enemigo prendido fuego y
   congelado.
3. **La burbuja del bendito** con el shader de StarryMoMo.
4. **El gólem jefe que se distinga** (material o gigante vikingo, ver arriba).
5. **El escenario**: puerta y muralla de Synty Dungeon, árboles y arbustos de Nature con el atlas repintado,
   taludes en los bordes, un fondo de montañas a menos de 140 m. Antes, comprimir los GLB.
6. **El toon liviano**: rampa, borde de luz con corte y degradé por altura.
7. **La música**, cuando termine de bajar.
