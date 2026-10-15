# La música (15/10)

Hasta el 15/10 sonaba siempre lo mismo: un arpegio de laúd en re dórico a 112 por minuto, sintetizado con
Tone.js. Desde ahí la música cambia con la partida: una canción por escenario, otra mientras hay un élite en
la cancha y otra para el jefe, con un fundido de 2,5 s entre una y otra. Todo sigue sintetizado: pesa nada,
puede reaccionar al juego (la tensión, el tempo) y suena al resto del juego. El pack de Andrew Sitkov
(Total Music Collection) no terminó de bajar: cuando esté, se lo puede probar al lado.

## Cómo se escuchan y se eligen

- **musica.html** (con las herramientas de prueba; también desde el panel B, pestaña Sonido): cada canción
  con su ▶, el mismo fundido del juego al pasar de una a otra, una perilla de **tensión** para oír cómo
  cambia, y un botón para bajar 40 s en WAV. Arriba se elige qué canción va en cada escenario, con el élite
  y con el jefe; se guarda en este navegador y es lo que suena al jugar.
- **npm run local**: una copia quieta del juego en http://localhost:4180 (no se recarga cuando alguien guarda
  un archivo), con musica.html adentro.

## Cómo se arma una canción (para quien programa)

Cada archivo de `src/audio/music/songs/` exporta `SONGS: SongDef[]` (ver `src/audio/music/types.ts`; la de
siempre está en `songs/clasica.ts`, de ejemplo). Se cargan solo cuando hacen falta.

- **`SongDef`**: `id` (`archivo.nombre`), `name` y `blurb` (para el panel, en español, con `// i18n-ok`),
  `role` (para dónde se pensó: `escenario`, `escenario1..3`, `elite`, `jefe`) y `build(out, transport)`.
- **`build`** crea sus instrumentos conectados a `out` y devuelve `start(time)`, `stop(time)`, `dispose()` y,
  si quiere, `intensity(0..1)`: la tensión de la partida (enemigos cerca de la línea, la puerta baja).
- **Todo en segundos**, agendado en `transport` (`scheduleRepeat(cb, paso, desde)`): el transporte lo
  comparten dos canciones durante el fundido, así que nadie le cambia el tempo ni usa '8n'. El tempo de
  cada canción es suyo: su paso en segundos.
- **El nivel**: la de siempre anda por un pico de -13 dB y un RMS de -25 dB (con la reverb y el limitador
  del juego). Una canción nueva tiene que andar parecido: la música va debajo de los golpes.
- **El gusto de Leandro**: nada que suene a 8 bits (ondas cuadradas peladas, arpegios de chiptune). Le gustó
  el arpegio de las bajas y la risa del élite. Sonidos cálidos: cuerdas pulsadas, colchones filtrados, FM
  suave, tambores graves, reverb.

**Para revisarla sin escucharla:** `node tools/lock.mjs navegador -- node tools/musica-render.mjs <id> [segundos]
[--tension=x|sube]` la renderiza (Tone.Offline) y deja `logs/musica/<id>.wav` y `<id>.png`, el
espectrograma (frecuencia contra tiempo, con el nivel abajo), más el pico, el RMS por segundo y si recorta.
