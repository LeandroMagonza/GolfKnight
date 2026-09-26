// Guion de la intro (prueba): la feria medieval, el estacionamiento, el atropello, el círculo de runas.
// El golfista iba disfrazado de caballero, así que el mismo modelo sirve para antes y después; y el
// hechizo tomó los palos de golf del baúl por su arma.
//
// Coordenadas: y para arriba; `face` 0 mira hacia +z y 90 hacia +x. Tiempos en segundos del plano.
import type { Script } from './types';

export const INTRO: Script = {
  cast: {
    knight: { kind: 'character', model: 'dungeon', mesh: 'Character_Hero_Knight_Male', height: 1.8 },
    mage: { kind: 'character', model: 'mage', height: 1.68 },
    goblinFair: { kind: 'character', model: 'dungeon', mesh: 'Character_Goblin_Male', height: 1.25 },
    skelFair: { kind: 'character', model: 'dungeon', mesh: 'Character_Skeleton_Soldier_01', height: 1.8 },
    g1: { kind: 'character', model: 'dungeon', mesh: 'Character_Goblin_Male', height: 1.25 },
    g2: { kind: 'character', model: 'dungeon', mesh: 'Character_Goblin_Warrior_Male', height: 1.5 },
    g3: { kind: 'character', model: 'dungeon', mesh: 'Character_Goblin_Male', height: 1.25 },
    g4: { kind: 'character', model: 'dungeon', mesh: 'Character_Skeleton_Soldier_01', height: 1.8 },
    g5: { kind: 'character', model: 'dungeon', mesh: 'Character_Goblin_Shaman', height: 1.45 },
    car: { kind: 'prop', build: 'car' },
    carBlue: { kind: 'prop', build: 'carBlue' },
    bag: { kind: 'prop', build: 'golfBag' },
    driver: { kind: 'prop', build: 'club' },
  },
  shots: [
    {
      name: 'La feria',
      set: 'feria',
      dur: 6.5,
      camera: [
        { at: 0, pos: [-7.5, 1.6, 2.3], look: { actor: 'knight', y: 1.3 } },
        { at: 6.5, pos: [0.8, 1.6, 2.3], look: { actor: 'knight', y: 1.3 } },
      ],
      actors: {
        knight: { path: [{ at: 0, x: -12, z: 0.3, face: 90 }, { at: 6.5, x: -3, z: 0.3 }], anim: [{ at: 0, clip: 'Walking', loop: true }] },
        goblinFair: { path: [{ at: 0, x: -4.5, z: -3.2, face: 30 }], anim: [{ at: 0, clip: 'Talking', loop: true }] },
        skelFair: { path: [{ at: 0, x: -3, z: -3.6, face: -60 }], anim: [{ at: 0, clip: 'Idle', loop: true, from: 1.3 }] },
      },
      text: [
        { at: 0.6, until: 3.1, kind: 'caption', text: 'Sábado. Feria medieval.' },
        { at: 3.3, until: 6.4, kind: 'caption', text: 'Tu disfraz: impecable. Los de los demás, sospechosamente buenos.' },
      ],
      ramps: [{ at: 0, dur: 1.2, param: 'fade', from: 1, to: 0 }],
    },
    {
      name: 'El estacionamiento',
      set: 'estacionamiento',
      dur: 6,
      camera: [
        { at: 0, pos: [-9, 1.8, 9.5], look: { actor: 'knight', y: 1.2 } },
        { at: 3, pos: [-2.5, 1.5, 8.5], look: [-0.4, 1.1, 2.6] },
        { at: 6, pos: [-1.5, 1.4, 8], look: [0, 1.1, 3] },
      ],
      actors: {
        car: { path: [{ at: 0, x: 0, z: 0, face: 180 }] },
        carBlue: { path: [{ at: 3, x: -40, z: 3.7, face: 90 }, { at: 8.2, x: 44, z: 3.7 }] },
        bag: { path: [{ at: 0, x: 0.3, y: 0.45, z: 1.55, face: 0 }] },
        knight: {
          path: [
            { at: 0, x: -7, z: 3.3, face: 90 },
            { at: 3.0, x: -0.3, z: 3.2 },
            { at: 3.1, x: -0.3, z: 3.2, face: 180 },
            { at: 4.4, x: -0.3, z: 3.2, face: -90 },
            { at: 5.25, x: -0.3, z: 3.2 },
            { at: 5.9, x: 3.2, z: 3.6, ease: 'smooth' },
          ],
          anim: [
            { at: 0, clip: 'Walking', loop: true },
            { at: 3.0, clip: 'Looking Around', fade: 0.3 },
            { at: 4.4, clip: 'Reacting', fade: 0.2, from: 0.2 },
            { at: 5.25, clip: 'Hit By Car', fade: 0.08, from: 0.3 },
          ],
        },
      },
      text: [{ at: 0.6, until: 2.9, kind: 'caption', text: 'Los palos de golf seguían en el baúl desde el domingo.' }],
      ramps: [
        { at: 0, dur: 0, param: 'car.trunk', from: 1, to: 1 },
        { at: 0, dur: 0, param: 'carBlue.headlights', from: 1, to: 1 },
        { at: 5.3, dur: 0.7, param: 'shake', from: 1.2, to: 0 },
        { at: 5.42, dur: 0.22, param: 'flash', from: 0, to: 1 },
      ],
      sfx: [{ at: 4.7, name: 'whoosh' }, { at: 5.3, name: 'gateHit' }, { at: 5.32, name: 'hurt' }],
    },
    {
      name: 'Nada',
      set: 'negro',
      dur: 2.8,
      camera: [{ at: 0, pos: [0, 1, 0], look: [0, 1, 1] }],
      text: [{ at: 0.4, until: 2.5, kind: 'card', text: 'Y después, nada.' }],
    },
    {
      name: 'El círculo',
      set: 'circulo',
      dur: 8,
      camera: [
        { at: 0, pos: [0.5, 9, 2.5], look: [0, 0, 0] },
        { at: 3, pos: [4.2, 2.1, 5.2], look: { actor: 'knight', y: 0.9 } },
        { at: 8, pos: [3.6, 1.8, 4.6], look: { actor: 'knight', y: 1.3, dx: 0.8 } },
      ],
      actors: {
        knight: {
          path: [{ at: 0, x: 0, z: 0, face: 0 }],
          anim: [
            { at: 0, clip: 'Getting Up', speed: 0 },
            { at: 1.8, clip: 'Getting Up' },
            { at: 4.6, clip: 'Looking Around', fade: 0.4, loop: true },
          ],
        },
        mage: {
          path: [{ at: 0, x: 2.4, z: 1.9, face: -125 }],
          anim: [
            { at: 0, clip: 'Idle', loop: true },
            { at: 2.2, clip: 'Rallying', fade: 0.3 },
            { at: 5.6, clip: 'Talking', fade: 0.4, loop: true },
          ],
        },
        bag: { path: [{ at: 0, x: -1.4, y: 0.47, z: 1.0, face: 30, roll: 90 }] },
      },
      text: [
        { at: 2.4, until: 5.3, kind: 'say', who: 'mage', text: '¡Funcionó! ¡Vino el Gran Guerrero!' },
        { at: 5.6, until: 7.8, kind: 'say', who: 'knight', text: '¿...Perdón?' },
      ],
      ramps: [
        { at: 0, dur: 1.4, param: 'flash', from: 1, to: 0 },
        { at: 0, dur: 3, param: 'runes', from: 0.9, to: 0.35 },
      ],
      sfx: [{ at: 0.1, name: 'frost' }, { at: 0.3, name: 'zap' }],
    },
    {
      name: 'El arma',
      set: 'circulo',
      dur: 8.5,
      camera: [
        { at: 0, pos: [-1.3, 1.95, -1.9], look: { actor: 'mage', y: 1.45 } },
        { at: 3.5, pos: [-1.2, 1.95, -1.7], look: { actor: 'mage', y: 1.45 } },
        { at: 3.51, pos: [-2.6, 0.9, 2.6], look: [-1.4, 0.45, 1.0] },
        { at: 5.8, pos: [-2.3, 0.8, 2.3], look: [-1.4, 0.45, 1.0] },
        { at: 5.81, pos: [-0.8, 1.6, 5.4], look: [1.0, 1.1, 1.0] },
        { at: 8.5, pos: [-0.6, 1.5, 5.0], look: [1.0, 1.1, 1.0] },
      ],
      actors: {
        knight: {
          path: [{ at: 0, x: 0, z: 0, face: 40 }, { at: 5.8, x: 0, z: 0, face: -30 }],
          anim: [{ at: 0, clip: 'Idle', loop: true }, { at: 5.8, clip: 'Reacting', fade: 0.3 }],
        },
        mage: { path: [{ at: 0, x: 2.4, z: 1.9, face: -125 }], anim: [{ at: 0, clip: 'Talking 2', loop: true }] },
        bag: { path: [{ at: 0, x: -1.4, y: 0.47, z: 1.0, face: 30, roll: 90 }] },
      },
      text: [
        { at: 0.3, until: 3.4, kind: 'say', who: 'mage', text: 'La profecía pedía armadura reluciente… y un arma de precisión letal.' },
        { at: 6.0, until: 8.3, kind: 'say', who: 'knight', text: '¿Los palos de golf?' },
      ],
      ramps: [
        { at: 0, dur: 0, param: 'runes', from: 0.35, to: 0.35 },
        { at: 3.8, dur: 1.2, param: 'clubGlow', from: 0, to: 1 },
      ],
      sfx: [{ at: 3.9, name: 'frost' }],
    },
    {
      name: 'La horda',
      set: 'circulo',
      dur: 8.5,
      camera: [
        { at: 0, pos: [-0.5, 1.75, -3.4], look: [-3, 3.4, 25], fov: 34 },
        { at: 8.5, pos: [-0.3, 1.7, -2.8], look: [-3.5, 3.4, 25], fov: 31 },
      ],
      actors: {
        knight: { path: [{ at: 0, x: 0, z: 0, face: 0 }], anim: [{ at: 0, clip: 'Idle', loop: true }] },
        driver: { path: [{ at: 0, x: 0, z: 0 }], hold: 'knight' },
        mage: {
          path: [{ at: 0, x: 0.95, z: 0.2, face: 5 }],
          anim: [{ at: 0, clip: 'Idle', loop: true }, { at: 0.8, clip: 'Pointing', fade: 0.3 }, { at: 3.6, clip: 'Talking', fade: 0.4, loop: true }],
        },
        g1: { path: [{ at: 0, x: -10, y: 3.9, z: 25, face: 90 }, { at: 8.5, x: 6, y: 3.9, z: 25 }], anim: [{ at: 0, clip: 'Walking', loop: true }] },
        g2: { path: [{ at: 0, x: -13, y: 3.9, z: 25, face: 90 }, { at: 8.5, x: 3, y: 3.9, z: 25 }], anim: [{ at: 0, clip: 'Walking', loop: true, from: 0.3 }] },
        g3: { path: [{ at: 0, x: -16, y: 3.9, z: 25, face: 90 }, { at: 8.5, x: 0, y: 3.9, z: 25 }], anim: [{ at: 0, clip: 'Walking', loop: true, from: 0.6 }] },
        g4: { path: [{ at: 0, x: -19, y: 3.9, z: 25, face: 90 }, { at: 8.5, x: -3, y: 3.9, z: 25 }], anim: [{ at: 0, clip: 'Walking', loop: true, from: 0.2 }] },
        g5: { path: [{ at: 0, x: -22, y: 3.9, z: 25, face: 90 }, { at: 8.5, x: -6, y: 3.9, z: 25 }], anim: [{ at: 0, clip: 'Walking', loop: true, from: 0.5 }] },
      },
      text: [
        { at: 1.0, until: 4.0, kind: 'say', who: 'mage', text: '¡Las hordas marchan sobre Valdehoyo!' },
        { at: 4.3, until: 6.3, kind: 'say', who: 'knight', text: 'Yo vine a una feria.' },
        { at: 6.5, until: 8.5, kind: 'title', text: 'GOLF KNIGHT' },
      ],
      ramps: [
        { at: 0, dur: 0, param: 'runes', from: 0.35, to: 0.35 },
        { at: 0, dur: 0, param: 'clubGlow', from: 1, to: 1 },
      ],
      sfx: [{ at: 0.8, name: 'waveHorn' }, { at: 2.2, name: 'growl' }, { at: 6.5, name: 'victory' }],
    },
  ],
};
