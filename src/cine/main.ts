// La intro como cinemática (prueba), en su propia página: cine.html. Carga los modelos, arma el
// reproductor y lo maneja con la barra de abajo (pausa, arrastrar para ir a cualquier segundo).
//
// En la URL: ?t=12.5 arranca pausada en ese segundo (para revisar un cuadro), ?auto la pone sola, y
// ?embed es cuando el juego la muestra adentro (index.html, en un iframe): al terminar o al saltar le
// avisa al juego en vez de navegar.
// Teclas: espacio pausa, ← y → un segundo, , y . un cuadro.
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GameAudio } from '../audio/audio';
import { stripRootMotion } from '../game/models';
import { L, lang } from '../i18n';
import { INTRO } from './intro';
import { CineMusic } from './music';
import { CinePlayer } from './player';

const MODELS = `${import.meta.env.BASE_URL}models/`;
const params = new URLSearchParams(location.search);
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.prepend(renderer.domElement);

// Saltar anda desde el primer momento, también mientras cargan los modelos
$('skipcine').addEventListener('click', () => leave());
addEventListener('keydown', (e) => {
  if (e.code === 'Escape') leave();
});

const loader = new GLTFLoader();
async function load(url: string): Promise<GLTF> {
  const gltf = await loader.loadAsync(url);
  for (const c of gltf.animations) stripRootMotion(c, gltf.scene);
  return gltf;
}

const [dungeon, mage, club] = await Promise.all([
  load(`${MODELS}cine-dungeon.glb`),
  load(`${MODELS}mage.glb`),
  loader.loadAsync(`${MODELS}club.glb`).then((g) => g.scene).catch(() => null),
]);
const player = new CinePlayer(INTRO, { dungeon, mage, club }, $('layer'));
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(player.scene, player.camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.6, 0.4, 1.0);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// Un cuadro de cada plano durante la carga: el primero de cada escenario compila shaders y sube
// texturas, y sin esto la imagen se trababa un segundo en cada cambio mientras la música seguía.
player.shotStarts.forEach((s) => {
  player.evaluate(s + 0.01);
  composer.render();
});

const audio = new GameAudio();
const music = new CineMusic(INTRO, player.shotStarts);
let t = Math.max(0, Number(params.get('t') ?? 0) || 0);
let playing = false;
const scrub = $<HTMLInputElement>('scrub');
const timeEl = $('time');
const toggle = $<HTMLButtonElement>('toggle');
scrub.max = String(player.duration);

function resize(): void {
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  player.camera.aspect = innerWidth / innerHeight;
  player.camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

function setPlaying(v: boolean): void {
  playing = v && t < player.duration;
  if (!playing) stopVoices();
  toggle.textContent = playing ? L('Pausa', 'Pause') : L('Seguir', 'Play');
  document.body.classList.toggle('paused', !playing);
}

/** Los sonidos del guion que caen entre `from` y `to` (solo reproduciendo: al saltar no suenan). */
function fireSfx(from: number, to: number): void {
  if (!audio.ready) return;
  INTRO.shots.forEach((shot, i) => {
    const start = player.shotStarts[i];
    for (const s of shot.sfx ?? []) {
      const at = start + s.at;
      if (at > from && at <= to) {
        if (s.name === 'whoosh') audio.whoosh(0.9);
        else if (s.name === 'bocina') music.honk();
        else audio[s.name]();
      }
    }
  });
}

function seek(to: number): void {
  t = Math.max(0, Math.min(player.duration, to));
  stopVoices();
}

// ---- voces: una por línea con `voice`, suenan al pasar por su momento reproduciendo ----
const voices: { at: number; el: HTMLAudioElement }[] = [];
INTRO.shots.forEach((shot, i) => {
  for (const cue of shot.text ?? []) {
    if (!cue.voice) continue;
    // una carpeta por idioma: las españolas en voices/, las inglesas en voices/en/ (tools/voces_openai.py).
    // ?voces=kokoro: las de Kokoro (neutras, solo en español), para comparar con las de OpenAI (actuadas)
    const folder = lang === 'en' ? 'en/' : params.get('voces') === 'kokoro' ? 'kokoro/' : '';
    const el = new Audio(`${import.meta.env.BASE_URL}voices/${folder}${cue.voice}.wav`);
    el.preload = 'auto';
    voices.push({ at: player.shotStarts[i] + cue.at, el });
  }
});
function fireVoices(from: number, to: number): void {
  if (!audio.ready) return;
  for (const v of voices) {
    if (v.at > from && v.at <= to) {
      v.el.currentTime = 0;
      v.el.play().catch(() => {});
    }
  }
}
function stopVoices(): void {
  for (const v of voices) v.el.pause();
}
const talking = () => voices.some((v) => !v.el.paused && !v.el.ended);

scrub.addEventListener('input', () => {
  seek(Number(scrub.value));
  setPlaying(false);
});
toggle.addEventListener('click', () => {
  toggle.blur();
  if (t >= player.duration) seek(0);
  setPlaying(!playing);
});
addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    if (t >= player.duration) seek(0);
    setPlaying(!playing);
  } else if (e.code === 'ArrowRight') seek(t + 1);
  else if (e.code === 'ArrowLeft') seek(t - 1);
  else if (e.code === 'Period') { setPlaying(false); seek(t + 1 / 30); }
  else if (e.code === 'Comma') { setPlaying(false); seek(t - 1 / 30); }
});

const timer = new THREE.Timer();
renderer.setAnimationLoop(() => {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.1);
  if (playing) {
    const next = Math.min(player.duration, t + dt);
    fireSfx(t, next);
    fireVoices(t, next);
    t = next;
    if (t >= player.duration) {
      setPlaying(false);
      // al terminar, al juego (salvo que se la esté revisando con ?t)
      if (!params.has('t')) setTimeout(leave, 600);
    }
  }
  player.evaluate(t);
  music.sync(t, playing);
  music.duck(talking());
  const { index, shot } = player.locate(t);
  scrub.value = String(t);
  timeEl.textContent = L(`${t.toFixed(2)} s · plano ${index + 1}: ${shot.name}`, `${t.toFixed(2)} s · shot ${index + 1}: ${shot.name}`);
  composer.render();
});

/** Al juego: si está adentro del juego le avisa; si no, va a index.html sin volver a pasarla. */
function leave(): void {
  try {
    setPlaying(false);
    music.sync(t, false);
  } catch {
    // todavía cargando: no hay nada sonando que parar
  }
  if (params.has('embed')) {
    parent.postMessage({ type: 'gk-cine-end' }, location.origin);
    return;
  }
  try {
    sessionStorage.setItem('gk.introSeen', '1');
  } catch { /* igual va */ }
  // si el idioma vino en la dirección, que siga en el juego
  location.href = params.has('lang') ? `./index.html?lang=${params.get('lang')}` : './index.html';
}
const start = $('start');
const play = $<HTMLButtonElement>('play');
$('status').textContent = L(`${INTRO.shots.length} planos · ${player.duration.toFixed(0)} s`, `${INTRO.shots.length} shots · ${player.duration.toFixed(0)} s`);
play.disabled = false;
if (params.has('t')) {
  start.hidden = true;
  setPlaying(false);
} else if (params.has('auto')) {
  start.hidden = true;
  setPlaying(true);
}
play.addEventListener('click', async () => {
  start.hidden = true;
  await audio.start().catch(() => {});
  music.build();
  setPlaying(true);
});

// para las capturas automáticas (tools/cine.mjs)
(window as any).__cine = {
  duration: player.duration,
  starts: player.shotStarts,
  seek(v: number) { seek(v); setPlaying(false); },
  get time() { return t; },
  /** Qué tan fuerte suena la música ahora, en dB (para las pruebas). */
  musicLevel: () => music.level(),
  talking,
  play() { play.click(); },
};
