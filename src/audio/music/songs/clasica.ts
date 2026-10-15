// La música de siempre (hasta el 15/10 vivía en audio.ts): progresión modal en re dórico, arpegio de laúd
// en corcheas y un colchón, a 112 por minuto.
import * as Tone from 'tone';
import type { SongDef } from '../types';

const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
/** Una corchea a 112 por minuto. */
const STEP = 60 / 112 / 2;
const CHORDS = [[50, 57, 62, 65], [48, 55, 60, 64], [53, 57, 60, 65], [55, 59, 62, 67]];
const PATTERN = [0, 2, 1, 3, 2, 1, 3, 2];

export const SONGS: SongDef[] = [
  {
    id: 'clasica.dorica',
    name: 'La de siempre', // i18n-ok: el panel de pruebas
    role: 'escenario',
    blurb: 'Re dórico, arpegio de laúd y colchón, 112 por minuto. La que sonó hasta el 15/10.', // i18n-ok: el panel de pruebas
    build(out, transport) {
      const pluck = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.003, decay: 0.3, sustain: 0.05, release: 0.3 }, volume: -20 }).connect(out);
      const pad = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sine' }, envelope: { attack: 0.6, decay: 0.4, sustain: 0.7, release: 1.6 }, volume: -24 }).connect(out);
      let id = -1;
      let step = 0;
      return {
        start(time) {
          step = 0;
          id = transport.scheduleRepeat((t) => {
            const chord = CHORDS[Math.floor(step / 8) % CHORDS.length];
            if (step % 8 === 0) pad.triggerAttackRelease(chord.slice(0, 3).map((m) => midi(m - 12)), STEP * 8, t);
            pluck.triggerAttackRelease(midi(chord[PATTERN[step % 8]] + 12), STEP, t, step % 4 === 0 ? 0.9 : 0.55);
            step++;
          }, STEP, time);
        },
        stop() {
          if (id >= 0) transport.clear(id);
          id = -1;
        },
        dispose() {
          pluck.dispose();
          pad.dispose();
        },
      };
    },
  },
];
