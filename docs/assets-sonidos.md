# Sonidos de los paquetes del Asset Store: el mapeo

13/10/2026, complemento de [assets.md](assets.md). Las duraciones son exactas: salen de los encabezados de los
WAV/OGG adentro de los `.unitypackage`; en los de Hovl además se cruzó qué prefab usa cada sonido.

Prefijos de ruta:
- **W** = `Assets/Game Music Stingers and UI SFX Pack 2/` (WOW Sound, 278 WAV estéreo, 75 MB)
- **C** = `Assets/Monster Sounds Pack/` (Cafofo, 680 WAV estéreo, 237 MB; duraciones redondeadas, casi seguro
  con cola de silencio: recortar)
- **H** = `Assets/Hovl Studio/HSFiles/Sounds/` (12 WAV)
- **P** = `Assets/ACC_Multiplayer/Sounds/` (Perfect Games, 23 OGG ya en mono: se copian tal cual)
- **D** = `Assets/polyperfect/Low Poly Animated Dinosaurs/- Sounds/`

## Los sonidos que ya existen (`src/audio/audio.ts`)

| Método | Uso | Candidato | Ruta | Duración |
|---|---|---|---|---|
| `chargeTick` | pasar de zona en el arco | **sintetizado** (va con el arpegio y el timing); alternativa la escala de 13 notas | W `UI_SFX/Misc/FA_Scale_1.wav`, `_3`, `_5` | 0,25–0,36 s |
| `duff` | pifia | | W `UI_SFX/Stinger/CGM3_Funny_Negative_Feedback_02_1.wav` | 0,45 s |
| `whoosh` | swing | potencia baja / media / driver | W `UI_SFX/Misc/PP_Whoosh_1_2.wav`, `PP_Whoosh_1_3.wav`, `FA_Whoosh_1_2.wav` | 0,20 / 0,33 / 0,59 s |
| `thud` | pelota contra enemigo | "bonk" cartoon, dos variantes | W `UI_SFX/Misc/FA_Funny_Impact_1_1.wav`, `_1_3` | 0,64 / 0,66 s |
| `kill` | baja | **la campana sintetizada**, más la voz de muerte del tipo encima | | |
| `bounce` | rebote en el piso | goma | P `Game/RubberCollision.ogg` | 0,37 s |
| | escudo, bendito, rebote | metal | P `Game/MetalCollision.ogg` | 0,73 s |
| `explosion` | chica (cae, marca) | | W `UI_SFX/Misc/PP_Explosion_1_4.wav` | 0,60 s |
| | grande (kamikaze, pólvora, bola de fuego) | | W `UI_SFX/Misc/PP_Explosion_1_3.wav` | 1,58 s |
| `zap` | rayo | electro splash, recortado a ~0,8 s | H `Skill 10.wav` | 1,70 s |
| `frost` | hielo | ice attack, recortado a ~1,2 s | H `Skill 8.wav` | 3,0 s |
| `growl` | ataque genérico | | C `Growl/Growl 2_3.wav` | 1,5 s |
| `gateHit` | puerta | | W `UI_SFX/Misc/PP_Heavy_Impact_1_1.wav` | 0,75 s |
| `hurt` | golpe al golfista | | W `PP_Heavy_Impact_1_2.wav` | 0,60 s |
| | muerte del golfista | | W `PP_Player_Dies_1_1.wav` | 0,46 s |
| `waveHorn` | oleada | **sintetizado** (no hay cuerno); alternativa | W `Stingers_Jingles/Fantasy/LQ_Next_Level_01_1.wav` | 2,11 s |
| `victory` | ganar | | W `Stingers_Jingles/Fantasy/TD_Win_Stinger_01_01.wav` | 4,42 s |
| `defeat` | perder (el nombre tiene un espacio) | | W `Stingers_Jingles/Fantasy/TD_Lose Stinger_01_01.wav` | 4,20 s |
| `unlock` | desbloquear dificultad | **sintetizado** | | |

## Los que faltan

**Impacto por golpe** (no hay un "tock" de golf en ningún paquete: provisorio hasta Sidearm):

| Golpe | Ruta | Duración |
|---|---|---|
| 1 | W `UI_SFX/Misc/PP_Small_Impact_1_1.wav` | 0,18 s |
| 2 | W `PP_Small_Impact_1_3.wav` | 0,31 s |
| 3 | W `PP_Small_Impact_1_4.wav` | 0,50 s |
| perfecto | el del 3 + W `Stingers_Jingles/Fantasy/TD_Collect_Star_01.wav` | 0,64 s |
| putter | W `PP_Cute_Impact_1_1.wav` | 0,08 s |

**La muerte de cada enemigo** (C, salvo donde dice):

| Enemigo | Muerte | Además |
|---|---|---|
| goblin | `Humanoid Small 1/Humanoid Small - Short 4.wav` (0,6 s); variante `Short 3` | |
| goblina | `Humanoid Small 3/Humanoid Small 3 - Short 03.wav` (0,8 s); variante `Short 05` | no hay voz femenina |
| orco | `Humanoid Large 2/Humanoid Large 2 - Short 2.wav` (1,0 s); variante `Short 9` | |
| esqueleto | `Zombie 2/Zombie 2_22.wav` (0,8 s) | W `UI_SFX/Misc/PP_Destroy_1_1.wav` (0,89 s) |
| jefe goblin | `Humanoid Large 4/Humanoid Large 4 - Short 4.wav` (1,0 s) | al aparecer, `Humanoid Large 3/Humanoid Large 3 - Laugh.wav` (2,3 s) |
| chamán | `Humanoid Small 4/Humanoid Small 4 - Short 20.wav` (0,6 s) | conjuro (y el de los hechiceros): `Ancient Language/Ancient Language 1_16.wav` (1,0 s) |
| caballero | `Demon 3/Demon 3 - Short 05.wav` (1,2 s) | P `MetalCollision.ogg` |
| gólem chico | `Large Creature 01/Large Creature 1 - Short 1.wav` (1,5 s) | W `PP_Destroy_1_4.wav` (1,23 s) |
| alma en pena | W `UI_SFX/Misc/PP_Monster_Dissipate.wav` (3,45 s, recortar) | al agarrar, `Hissing/Hiss 3_5.wav` (0,9 s) |

**El gólem jefe**: aparece `C Large Creature 09/Large Creature 9 - Long 6.wav` (4,5 s); tira la roca
`Large Creature 9 - Short 1.wav` (2,5 s) o D `SFX_Dino_Roar_Big.ogg` (0,92 s); la roca cae D `SFX_Dino_Stomp.ogg`
(0,95 s); muere `Large Creature 9 - Long 8.wav` (4,5 s).

**Gruñidos al atacar**: caballero C `Demon 3/Demon 3 - Short 03.wav` (1,5 s); gólem chico
`Large Creature 01/Large Creature 1 - Short 2.wav` (1,5 s); jefe goblin `Humanoid Large 4 - Short 4`.

**Élite y puerta**: aparece un élite W `UI_SFX/Misc/PP_Monster_Alert_1_1.wav` (0,31 s) + C
`Demon 1/Demon 1 - Laugh 04.wav` (1,5 s), o W `Stingers_Jingles/Fantasy/TD_Negative_Sting_01.wav` (1,40 s);
puerta caída W `PP_Destroy_1_4`; alerta de la puerta W `TD_Negative_Notification_02.wav` (1,40 s), con límite de
frecuencia.

**Habilidades**:

| Qué | Ruta | Duración |
|---|---|---|
| hielo | H `Skill 8.wav` | 3,0 s |
| fuego | H `Skill 11.wav` o `Skill 6.wav` | 2,76 / 2,2 s |
| rayo grande / en cadena | H `Skill 2.wav` / `Skill 10.wav` | 4,04 / 1,70 s |
| viento / remolino | W `FA_Whoosh_1_3.wav` / `FA_Speed_Up_Riser_1_2.wav` | 0,82 / 1,64 s |
| fantasma (aura) | W `UI_SFX/Misc/PP_Magic_Portal_Loop.wav` | 2,41 s, en loop |
| detonación de la marca de Abe | H `Skill 7.wav` | 2,2 s |
| silencio (flojo) | C `Hissing/Hiss 1_2.wav`, o el sintetizado | 1,4 s |
| carrito andando / atropello | P `Game/Engine1_Idle.ogg` (loop) / `Game/EngineMuscle_Backfire.ogg` + W `FA_Funny_Impact_1_2` | 1,03 / 0,32 s |
| hoyo | W `UI_SFX/Misc/LQ_Comedy_Drop.wav` | 1,22 s |
| bandera enemiga arriba / abajo | W `TD_Negative_Notification_02` / `Stingers_Jingles/Fantasy/TD_Positive_Notification_01_01.wav` | 1,40 / 0,86 s |
| cae el hechizo enemigo | H `Hit Skill9.wav` | 0,60 s |
| tirar una habilidad | W `PP_Summon.wav` | 0,56 s |

**UI**: botón W `UI_SFX/UI/LQ_Click_Button.wav` (0,10 s); atrás `LQ_Back_Button.wav`; hover
`PP_UI_Select_1_1.wav`; error `CGM3_Error_Button_02_1.wav`; aparece una carta W `UI_SFX/Misc/LQ_Swipe.wav`
(0,20 s, una por carta); elegir carta W `UI_SFX/UI/FA_Select_Button_1_4.wav`; carta especial W
`UI_SFX/Collect Item/FA_Special_Item_2_1.wav`; oleada superada W `UI_SFX/Stinger/LQ_Stage Clear.wav` (1,32 s);
varias bajas de un tiro `FA_Scale_End.wav`; regalo `FA_Power_Up_1_1.wav`.

## Peso

A ~96 kbps mono, unos 12 KB por segundo. La primera tanda (31 archivos, 38 s) ~0,6 MB; la segunda ~0,3 MB.
Recortando las colas de silencio, todo junto 0,6–0,75 MB. Para variedad: dos variantes al azar y la velocidad
±5 % (`playbackRate`), con el límite de frecuencia que ya tiene `ok()`.

## Lo que se trajo (14/10)

53 eventos en `public/sfx/` (mp3 mono a 80 kbps, ~0,6 MB), con la lista en `public/sfx/sfx.json` (archivo, fuente
y por qué). Sonoridad pareja: golpes e impactos a -14 LUFS, voces a -16, la partida a -18, la curación a -21 y
el tic de la esquiva a -24. Los suena `src/audio/audio.ts` a través de `src/audio/samples.ts`; si falta uno, o
su llave de POLISH está apagada, suena lo sintetizado de siempre. Los que se eligieron por aproximación y
conviene escuchar: `bubble-pop` (no hay vidrio: un "bloop" con brillo), `ricochet` (el metal una quinta más
agudo), `burn-tick` (un siseo), `card-pick` (dos notas que suben). `burn-loop` no estaba en ningún paquete: lo
genera `tools/crepitar.py`. Los scripts de la conversión quedaron en `logs/sfx-work/` (no se suben).

## La segunda tanda (14/10)

Leandro, después de probar la primera: el golpe y la muerte del enemigo «parecen salidos de Atari», suenan
saturados, y el golpe a la pelota «sale a destiempo». También le parecieron feos la puerta y el golpe al
caballero.

### Por qué sonaba así

- **A destiempo.** Todo se agendaba con `Tone.now()`, que le suma el adelanto con que Tone agenda la música:
  0,1 s. Los grabados y los sintetizados sonaban una décima tarde. Ahora los efectos van con
  `Tone.immediate()` y la música sigue con su adelanto.
- **Saturado.** El final de la mezcla era el `Limiter` de Tone: un compresor con rodilla de 30 dB y suelta de
  10 ms. Casi no frenaba y, con varios grabados juntos, la suma pasaba de 0 dB y recortaba a la salida.
  Medido en el navegador con `logs/check-sonido.mjs`, tirando con los cuatro palos contra la fila:
  - antes, pico 1,56 (+3,9 dB) y 11 cuadros recortados;
  - ahora, pico 0,93 y ninguno.

  El limitador nuevo es de rodilla dura y suelta en 150 ms, y los grabados entran más bajos (0,6 en vez de 0,9).
- **«Atari».** Todo lo `PP_` de WOW es de estilo pixel (8 bits): el golpe del palo, la puerta, el daño, la
  muerte del golfista y los derrumbes del esqueleto y del gólem chico.

### Lo nuevo

**Fuentes.** Las dos son CC0 (dominio público): se pueden vender sin dar crédito. Están anotadas por archivo
en `public/sfx/sfx.json`.
- **Kenney "Impact Sounds"** ([kenney.nl/assets/impact-sounds](https://kenney.nl/assets/impact-sounds)):
  puñetazos, madera, chapa, golpes blandos.
- **Freesound**, grabaciones de palos de golf de verdad:
  - [408260](https://freesound.org/s/408260/) "putt.wav";
  - [622414](https://freesound.org/s/622414/) "golf ball hits";
  - [21877](https://freesound.org/s/21877/) "golf_hitting_ball";
  - [593483](https://freesound.org/s/593483/) "Driver hitting golf ball".

**El palo contra la pelota.** Hay uno por palo: el putter hace un tic, el hierro un click seco, el wedge
suena con más cuerpo y el driver da el ping de la cabeza de titanio. El nivel del golpe lo da el volumen,
y el arpegio de la carga y de las bajas sigue igual. Los golpes están cortados en el ataque: no hay
silencio adelante.

**La pelota contra el enemigo**, según de qué está hecho:

| Enemigo | Sonido | Fuente |
|---|---|---|
| goblins, orcos, chamán | golpe seco en el cuerpo (con el golpe 3, uno más pesado) | Kenney impactPunch |
| esqueleto | toc de hueso | Kenney impactPlank |
| caballero | chapa | Kenney impactPlate |
| gólems | golpe macizo | impactPunch_heavy cuatro semitonos abajo, más impactWood_heavy |
| alma en pena | golpe blando | Kenney impactSoft |
| blindado | metal, como antes | |

**Quejidos.** Al recibir sin morir, cada tipo se queja con su voz de Cafofo. Son voces cortas, distintas de
las de muerte, y el fuego no las dispara. El élite gruñe grave cada vez que le pegan: es la voz de su risa
(Demon 1), dos semitonos abajo. El gólem jefe se queja con la suya.

**Muertes.** Son otras: las "Long" de cada voz, que caen de tono. El esqueleto se desarma con toc de madera
y al caballero se le cae la armadura (chapa). El gólem chico cae con un golpe sordo y el alma en pena se va
con un lamento. Ya no hay derrumbes PP.

**La puerta y el golfista.**
- **La puerta:** madera pesada y la tabla que cruje.
- **Al caballero le pegan:** golpe pesado y la armadura.
- **Cae:** chapa, el cuerpo contra el piso y la armadura que rebota.
- **Al perder,** la horda que sigue detrás del cartel ya no suena (`audio.hush`).

**Los poderes, por tipo:**

| Poder | Sonido |
|---|---|
| Disparos | el golpe de su palo más su elemento (fuego, hielo, rayo, viento, fantasma, silencio) |
| Driver en cruz | el del driver y el viento |
| Guantes | un brillo y su elemento bajito |
| Carrito | arranca |
| Hoyo | se clava en la tierra; el que cae, la caída cómica |
| Bandera | vuela y se clava |
| Pólvora | la mecha |
| Lluvia | una subida |
| Caddie | brillo dorado |
| Lupa | algo que crece |
| Clon | energía que sube |
| Eco | pulsos |
| Potencia | power-up corto |
| Fuerza | power-up largo |
| Palazo | golpe pesado al conectar |

Los que mira Abe (en red) ahora también oyen todo esto.

**Llaves nuevas.** `groans`, `abilitySounds`, `mix` y `onTime` (ver [pruebas.md](pruebas.md)).

**Peso.** `public/sfx` pasa de 0,66 a 1,2 MB, con 87 eventos en 118 archivos.

**Quedan de PP, por ahora.** El brillo de `bubble-pop` y la alerta del élite (`elite-alert`, que gustó). Si
alguno suena a 8 bits, se cambia igual.

## Las explosiones y los volúmenes (14/10, tercera tanda)

**Explosiones.** A Leandro la del hierro y el wedge le «sonó un poco rara». Eran `PP_Explosion`, de 8 bits:
la chica con la onda cuadrada y la grande con un peine de frecuencias. Ahora salen de Freesound, CC0:
- **La chica:** [535592](https://freesound.org/s/535592/) "BOOM IMPACT 2", a 0,8 s.
- **La grande:** la misma, tres semitonos más grave, con el golpe sordo de
  [431174](https://freesound.org/s/431174/) "Fireball Explosion" abajo, a 1,3 s.
- **Volumen:** las dos suenan más bajas que antes (0,55 y 0,7).
- **Descartada:** [182429](https://freesound.org/s/182429/), de qubodup, porque trae el arranque recortado.
- **Descartadas también** las "explosionCrunch" de Kenney Sci-fi, que son ruido comprimido.

**Volúmenes** (`src/audio/volumes.ts`). Hay dos tablas que se multiplican con lo que pide el código:
- **por grupo:** todo, música, carga, bajas, palo, golpes, explosiones, voces, poderes, poderes de los
  enemigos, puerta y golfista, partida;
- **por sonido grabado:** los 83 de `public/sfx`.

Se tocan en el panel B, en la pestaña **Sonido**, con un ▶ para escuchar cada uno. Se guardan con el balance
y salen en «Copiar configuración» (de cada sonido, solo los que no están en 1). También se pueden pasar por
la URL: `?ajuste=volumen.musica:0.5` o `?ajuste=sonidos.explosion-big:0.6`. Un test compara la lista con
`sfx.json`.

**Fuera.** Salieron cuatro grabados que no usaba nada: `fire`, `lightning`, `cart` y `ui-back`. Los
disparos usan los `cast-*`.
