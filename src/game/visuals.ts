// Lo que se ve y no cambia cómo se juega: las sombras del sol, la corrección de color, la luz del día y
// el cielo, el contorno de luz de los personajes y el brillo de lo que emite luz. Todo se prende y se
// apaga desde la pestaña Visual del panel (B), para comparar qué aporta cada cosa y cuánto cuesta.
//
// Con todo apagado y la luz de mediodía queda exactamente como antes de esta capa.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export const TONES = ['ninguno', 'ACES', 'AgX', 'neutro'] as const;
export type Tone = (typeof TONES)[number];
const TONE_MAPPING: Record<Tone, THREE.ToneMapping> = {
  ninguno: THREE.NoToneMapping,
  ACES: THREE.ACESFilmicToneMapping,
  AgX: THREE.AgXToneMapping,
  neutro: THREE.NeutralToneMapping,
};

export const LIGHTS = ['mediodía', 'tarde', 'atardecer'] as const;
export type LightName = (typeof LIGHTS)[number];

/** Una hora del día: el sol, la luz del cielo y del piso, y el degradé del cielo (arriba y horizonte). */
interface Daylight {
  sun: number;
  /** Altura del sol sobre el horizonte, en grados. */
  elevation: number;
  /** De dónde viene el sol, en grados: 0 es desde el fondo del campo, -90 desde la izquierda del golfista. */
  azimuth: number;
  sunIntensity: number;
  sky: number;
  ground: number;
  hemiIntensity: number;
  skyTop: number;
  horizon: number;
}

const DAYLIGHT: Record<LightName, Daylight> = {
  // la luz de siempre: sol alto y cielo parejo
  mediodía: { sun: 0xfff2d6, elevation: 57, azimuth: -121, sunIntensity: 2.4, sky: 0xdff1ff, ground: 0x4a6b3a, hemiIntensity: 1.5, skyTop: 0x9fd3f0, horizon: 0x9fd3f0 },
  // sol más bajo y cálido, de atrás a la izquierda: las sombras caen hacia el campo y se leen
  tarde: { sun: 0xffe0b0, elevation: 32, azimuth: -125, sunIntensity: 3.0, sky: 0xcfe4ff, ground: 0x55683a, hemiIntensity: 1.0, skyTop: 0x5f9fdc, horizon: 0xf3dcb4 },
  atardecer: { sun: 0xffa870, elevation: 15, azimuth: -110, sunIntensity: 3.2, sky: 0xb8c2f0, ground: 0x4a4a36, hemiIntensity: 0.85, skyTop: 0x3f5f9a, horizon: 0xffb27a },
};

export const SHADOW_SIZES = ['1024', '2048', '4096'] as const;

/** Todo lo que la pestaña Visual toca y guarda. */
export const VISUAL = {
  shadows: true,
  shadowSize: '2048' as (typeof SHADOW_SIZES)[number],
  tone: 'ACES' as Tone,
  exposure: 1.0,
  light: 'tarde' as LightName,
  /** Se copian de la hora del día al elegirla, y después se pueden tocar sueltos. */
  elevation: DAYLIGHT.tarde.elevation,
  azimuth: DAYLIGHT.tarde.azimuth,
  sunIntensity: DAYLIGHT.tarde.sunIntensity,
  rim: true,
  rimStrength: 0.22,
  rimPower: 3,
  bloom: true,
  bloomStrength: 0.45,
  bloomRadius: 0.35,
  bloomThreshold: 1.4,
};
export type VisualConfig = typeof VISUAL;

/** Como era antes de esta capa: sin sombras, sin corrección de color, sol de mediodía, sin contorno ni brillo. */
export const VISUAL_OFF: Partial<VisualConfig> = {
  shadows: false, tone: 'ninguno', exposure: 1, light: 'mediodía', rim: false, bloom: false,
  elevation: DAYLIGHT.mediodía.elevation, azimuth: DAYLIGHT.mediodía.azimuth, sunIntensity: DAYLIGHT.mediodía.sunIntensity,
};
const DEFAULTS: VisualConfig = { ...VISUAL };

/** Elige una hora del día y le copia el sol a los números sueltos. */
export function setLight(name: LightName): void {
  const d = DAYLIGHT[name];
  VISUAL.light = name;
  VISUAL.elevation = d.elevation;
  VISUAL.azimuth = d.azimuth;
  VISUAL.sunIntensity = d.sunIntensity;
}

const STORE_KEY = 'gk.visual';

/**
 * Lo guardado vuelve al recargar. En las pruebas automáticas (Playwright) arranca todo apagado, salvo
 * `?visual` en la URL: el render por software ya va a 15 cuadros sin sombras ni brillo.
 */
export function loadVisual(params: URLSearchParams): void {
  if (navigator.webdriver && !params.has('visual')) {
    Object.assign(VISUAL, VISUAL_OFF);
    return;
  }
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') as Partial<VisualConfig>;
    for (const key of Object.keys(VISUAL) as (keyof VisualConfig)[]) {
      if (typeof saved[key] === typeof VISUAL[key]) (VISUAL as Record<string, unknown>)[key] = saved[key];
    }
  } catch { /* sin localStorage: quedan los de fábrica */ }
  if (!TONES.includes(VISUAL.tone)) VISUAL.tone = DEFAULTS.tone;
  if (!LIGHTS.includes(VISUAL.light)) VISUAL.light = DEFAULTS.light;
  if (!SHADOW_SIZES.includes(VISUAL.shadowSize)) VISUAL.shadowSize = DEFAULTS.shadowSize;
}

export function saveVisual(): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(VISUAL));
  } catch { /* no recuerda, nada más */ }
}

/** Vuelve a los valores del código. */
export function resetVisual(): void {
  Object.assign(VISUAL, DEFAULTS);
  try {
    localStorage.removeItem(STORE_KEY);
  } catch { /* nada que borrar */ }
}

/**
 * El contorno de luz: cuanto más de canto se ve una cara, más se aclara. Despega a los personajes del
 * pasto. Los uniforms son los mismos para todos los materiales, así que prenderlo o cambiarle la
 * fuerza no recompila nada.
 */
const rimUniforms = {
  uRimColor: { value: new THREE.Color(0xfff4e0) },
  uRimStrength: { value: 0 },
  uRimPower: { value: 2.5 },
};
/** Por referencia y no por userData: `Material.clone()` copia el userData pero no el onBeforeCompile. */
const rimPatched = new WeakSet<THREE.Material>();

function patchRim(mat: THREE.Material): void {
  if (rimPatched.has(mat) || !(mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) return;
  rimPatched.add(mat);
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, rimUniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRimColor;\nuniform float uRimStrength;\nuniform float uRimPower;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          float rimFacing = 1.0 - saturate(dot(normal, normalize(vViewPosition)));
          totalEmissiveRadiance += uRimColor * uRimStrength * pow(rimFacing, uRimPower);
        }`);
  };
  mat.customProgramCacheKey = () => 'gk-rim';
  mat.needsUpdate = true;
}

/** Lo que no proyecta sombra: marcas, anillos, carteles y todo lo transparente. */
function castsShadow(mat: THREE.Material | THREE.Material[]): boolean {
  const m = Array.isArray(mat) ? mat[0] : mat;
  return !!m && !(m as THREE.MeshBasicMaterial).isMeshBasicMaterial && !m.transparent && m.depthWrite;
}

export class Visuals {
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private readonly seen = new WeakSet<THREE.Object3D>();
  private skyTexture: THREE.CanvasTexture | null = null;
  private shadowsWere: boolean | null = null;
  /** Hacia dónde apunta el sol, y alrededor de qué punto se calcula la sombra. */
  private readonly focus = new THREE.Vector3(0, 0, 30);

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera,
    private readonly sun: THREE.DirectionalLight,
    private readonly hemi: THREE.HemisphereLight,
    /** Las sombras de mentira (el círculo negro bajo cada enemigo): con sombras de verdad se apagan. */
    private readonly blobShadow: THREE.Material,
  ) {
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    sun.target.position.copy(this.focus);
    scene.add(sun.target);
    const cam = sun.shadow.camera;
    cam.left = -55;
    cam.right = 55;
    cam.top = 55;
    cam.bottom = -55;
    cam.near = 1;
    cam.far = 300;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.04;
    this.apply();
  }

  /** Pasa VISUAL a la escena. Se llama después de cada cambio del panel. */
  apply(): void {
    const v = VISUAL;
    const d = DAYLIGHT[v.light];
    const r = this.renderer;

    r.toneMapping = TONE_MAPPING[v.tone];
    r.toneMappingExposure = v.exposure;

    const el = THREE.MathUtils.degToRad(v.elevation);
    const az = THREE.MathUtils.degToRad(v.azimuth);
    const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    this.sun.position.copy(this.focus).addScaledVector(dir, 120);
    this.sun.color.setHex(d.sun);
    this.sun.intensity = v.sunIntensity;
    this.hemi.color.setHex(d.sky);
    this.hemi.groundColor.setHex(d.ground);
    this.hemi.intensity = d.hemiIntensity;

    // el cielo es un degradé de pantalla: con la cámara casi fija alcanza, y no cuesta nada
    this.skyTexture?.dispose();
    this.skyTexture = skyGradient(d.skyTop, d.horizon);
    this.scene.background = d.skyTop === d.horizon ? new THREE.Color(d.horizon) : this.skyTexture;
    if (this.scene.fog) (this.scene.fog as THREE.Fog).color.setHex(d.horizon);

    this.sun.castShadow = v.shadows;
    r.shadowMap.enabled = v.shadows;
    const size = Number(v.shadowSize);
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    // prender o apagar las sombras cambia el shader de todo lo que las recibe
    if (this.shadowsWere !== null && this.shadowsWere !== v.shadows) {
      this.scene.traverse((o) => {
        const mat = (o as THREE.Mesh).material;
        if (mat) for (const m of Array.isArray(mat) ? mat : [mat]) m.needsUpdate = true;
      });
    }
    this.shadowsWere = v.shadows;
    this.blobShadow.visible = !v.shadows;

    rimUniforms.uRimStrength.value = v.rim ? v.rimStrength : 0;
    rimUniforms.uRimPower.value = v.rimPower;
    rimUniforms.uRimColor.value.setHex(d.sun).lerp(new THREE.Color(0xffffff), 0.5);

    if (v.bloom && !this.composer) this.makeComposer();
    if (this.bloomPass) {
      this.bloomPass.strength = v.bloomStrength;
      this.bloomPass.radius = v.bloomRadius;
      this.bloomPass.threshold = v.bloomThreshold;
    }
  }

  /**
   * Revisa lo que apareció desde el cuadro anterior (enemigos, pelotas, efectos): les marca si
   * proyectan y reciben sombra, y a los personajes les pone el contorno. Cada objeto se mira una vez.
   */
  private scan(): void {
    this.scene.traverse((o) => {
      if (this.seen.has(o)) return;
      this.seen.add(o);
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (castsShadow(mesh.material)) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
      if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) patchRim(m);
    });
  }

  render(): void {
    this.scan();
    if (VISUAL.bloom && this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  resize(width: number, height: number): void {
    this.composer?.setPixelRatio(this.renderer.getPixelRatio());
    this.composer?.setSize(width, height);
  }

  private makeComposer(): void {
    const size = this.renderer.getSize(new THREE.Vector2());
    const composer = new EffectComposer(this.renderer);
    composer.setPixelRatio(this.renderer.getPixelRatio());
    composer.setSize(size.x, size.y);
    composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(size, VISUAL.bloomStrength, VISUAL.bloomRadius, VISUAL.bloomThreshold);
    composer.addPass(this.bloomPass);
    // la corrección de color y el paso a sRGB van al final: el brillo trabaja sobre la luz sin recortar
    composer.addPass(new OutputPass());
    this.composer = composer;
  }
}

/** Degradé vertical: el color de arriba hasta un tercio, y de ahí baja al horizonte. */
function skyGradient(top: number, horizon: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
  g.addColorStop(0, hex(top));
  g.addColorStop(0.3, hex(top));
  g.addColorStop(0.75, hex(horizon));
  g.addColorStop(1, hex(horizon));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
