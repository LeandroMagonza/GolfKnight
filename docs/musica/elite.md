# La música del élite (15/10)

Lo que suena mientras hay un élite en la cancha (`role: 'elite'`). Está en `src/audio/music/songs/elite.ts`:
tres versiones bien distintas para elegir en **musica.html** (o en el panel B, pestaña Sonido), en el lugar
«Con un élite en la cancha».

## Qué tienen en común

- **Un compás de arranque que crece y un golpe al final**: la canción entra con el fundido de 2,5 s del
  juego, así que un golpe en el segundo cero no se oiría. Cada versión arranca con algo que sube (redoble,
  escalera de cuerdas, anuncio de metales) y el golpe fuerte cae a los 1,6–1,9 s, cuando el fundido ya
  está en dos tercios: ahí se entiende que llegó algo peligroso. Ese golpe tiene una disonancia a propósito
  (la novena menor: mi con fa, re con mi bemol, la con si bemol).
- **Vueltas cortas**: 8 compases (12 a 15 s), para que en una pelea de 20 a 90 s se repitan sin cansar.
- **La tensión** (`intensity`, de 0 a 1: enemigos cerca de la línea, la puerta baja) suma capas, pero
  recién al empezar cada compás, así nada entra a mitad de frase. Además abre el filtro de las cuerdas y
  sube el volumen un 20 %.
- **Tonalidades** que no chocan con el arpegio de las bajas (do mayor: do, mi, sol están en las tres).
- Nada de ondas cuadradas: sierras desafinadas filtradas, tambores de membrana con el golpe del palo,
  coros con formantes de vocal, ruido filtrado para platillos y caja.

## Las tres versiones

### `elite.tambores` — Tambores de guerra

- **Carácter**: la horda en marcha. Pesada y ritual.
- **Mi frigio, 144 por minuto.** Raíces: mi mi fa mi | mi mi sol fa (el fa a medio tono del mi es la
  amenaza, y vuelve al mi en cada vuelta).
- **Instrumentos**: odaiko (el tambor grande, afinado en si), dos taikos medianos (el «ka-don»), cuerdas
  graves en corcheas que caen sol-fa-mi al final de cada compás, metales que llaman en cuartas paralelas
  (como el organum medieval), un coro «oh» oscuro.
- **Arranque**: el timbal redobla cada vez más rápido, se suman los taikos, un soplido sube y los metales
  suben de un tirón (la-si-do-re) al golpe: mi con fa encima y el platillo.
- **Con tensión**: desde 0,35 el «ka» del taiko y remates de taikos al final de cada cuatro compases;
  desde 0,5 el soplido lleva a cada vuelta; desde 0,6 las cuerdas pasan a semicorcheas, los metales doblan
  una octava abajo y el coro suma la novena menor (un racimo); desde 0,85 golpes extra del odaiko,
  «ka» en semicorcheas y golpes de metales en los compases sin llamado. La segunda vuelta contesta el
  llamado más arriba (cada 27 s se repite entero).

### `elite.galope` — Al galope

- **Carácter**: thriller. El élite viene cargando y no para.
- **Re menor, 152 por minuto.** Raíces: re re mi♭ re | si♭ do la la (el mi♭ frigio, y el la mayor que
  empuja de vuelta al re).
- **Instrumentos**: cuerdas graves al galope (corchea y dos semicorcheas, en octavas), violas en
  semicorcheas (una nota pedal alternada con una línea que sube y baja), un tic de reloj en corcheas,
  bombo en el 1 y el 3, golpes de metales en cada cambio de acorde y, en el último compás, tres golpes de
  la con si♭ que empujan a la vuelta.
- **Arranque**: las cuerdas suben una escalera de dos octavas (re menor armónica) con la caja redoblando
  debajo, al golpe: re con mi♭ encima.
- **Variación**: una vuelta sí y otra no, la línea de las violas salta una octava (más nerviosa), así en
  una pelea larga no se repite igual.
- **Con tensión**: desde 0,4 redoble de caja hacia la vuelta; desde 0,45 violines agudos en trémolo; desde
  0,5 el bombo en los cuatro tiempos y un corno con la melodía; desde 0,6 el soplido; desde 0,7 el reloj
  en semicorcheas y un coro «ah»; desde 0,8 el corno y los violines doblan una octava abajo.

### `elite.marcha` — Marcha macabra

- **Carácter**: el costado cómico del juego. Siniestra pero con algo de dibujo animado de terror: una
  marcha de puntillas que se pone nerviosa.
- **La menor armónica, de 126 a 152 por minuto**: la tensión la apura de a poco (en unos 4 s), como «En la
  gruta del rey de la montaña».
- **Instrumentos**: tuba en el 1 y el 3 y cornos cortos en el 2 y el 4 (el «um-pa»), bombo, caja de
  marcha, un fagot de puntillas con el pizzicato una octava arriba (la melodía se arrastra con el re♯), y
  al final de cada vuelta **el coro se ríe**: «¡ja! ¡ja! ¡ja! ¡jaaa!», cada sílaba cayendo un poco de
  tono y la última cayéndose del todo (pensado para hacer juego con la risa del élite).
- **Arranque**: la caja redobla y los cornos anuncian «ta, ta, ta, TAA», al golpe: la menor con si♭.
- **Con tensión**: desde 0,35 la caja de marcha completa; desde 0,4 el xilofón de huesos (dos octavas
  arriba de la melodía, como la danza macabra); desde 0,6 los cornos doblan la melodía y los platillos de
  banda en el «pa»; desde 0,75 los huesos castañetean en los silencios; desde 0,85 platillo en la mitad
  de la vuelta. Y el tempo sube todo el tiempo con la tensión.

## Qué revisé

PENDIENTE

## Dudas

PENDIENTE
