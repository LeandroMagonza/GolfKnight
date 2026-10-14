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
