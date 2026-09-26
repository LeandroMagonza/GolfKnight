// La intro como cinemática (prueba), en su propia página: cine.html. Carga los modelos, arma el
// reproductor y lo maneja con la barra de abajo (pausa, arrastrar para ir a cualquier segundo).
//
// En la URL: ?t=12.5 arranca pausada en ese segundo (para revisar un cuadro), ?auto la pone sola.
// Teclas: espacio pausa, ← y → un segundo, , y . un cuadro.
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GameAudio } from '../audio/audio';
import { stripRootMotion } from '../game/models';
import { INTRO } from './intro';
import { CinePlayer } from './player';

const MODELS = `${import.meta.env.BASE_URL}models/`;
const params = new URLSearchParams(location.search);
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.prepend(renderer.domElement);

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

const audio = new GameAudio();
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
  toggle.textContent = playing ? 'Pausa' : 'Seguir';
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
        else audio[s.name]();
      }
    }
  });
}

function seek(to: number): void {
  t = Math.max(0, Math.min(player.duration, to));
}

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
    t = next;
    if (t >= player.duration) {
      setPlaying(false);
      // al terminar, al juego (salvo que se la esté revisando con ?t)
      if (!params.has('t')) setTimeout(() => { location.href = './index.html'; }, 600);
    }
  }
  player.evaluate(t);
  const { index, shot } = player.locate(t);
  scrub.value = String(t);
  timeEl.textContent = `${t.toFixed(2)} s · plano ${index + 1}: ${shot.name}`;
  composer.render();
});

const start = $('start');
const play = $<HTMLButtonElement>('play');
$('status').textContent = `${INTRO.shots.length} planos · ${player.duration.toFixed(0)} s`;
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
  setPlaying(true);
});

// para las capturas automáticas (tools/cine.mjs)
(window as any).__cine = {
  duration: player.duration,
  starts: player.shotStarts,
  seek(v: number) { seek(v); setPlaying(false); },
};
