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

/**
 * «según la oleada» (el de arranque) va cambiando la hora con la partida: la primera oleada es de mañana
 * y la última al atardecer, pasando por el mediodía y la tarde. Las otras dejan una hora fija.
 */
export const LIGHTS = ['según la oleada', 'mañana', 'mediodía', 'tarde', 'atardecer'] as const; // i18n-ok: id que solo se lee en el panel B
export type LightName = (typeof LIGHTS)[number];
type FixedLight = Exclude<LightName, 'según la oleada'>; // i18n-ok: id que solo se lee en el panel B
/** El recorrido de la partida, de la primera oleada a la última. */
const DAY_PATH: readonly FixedLight[] = ['mañana', 'mediodía', 'tarde', 'atardecer']; // i18n-ok: id que solo se lee en el panel B

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

const DAYLIGHT: Record<FixedLight, Daylight> = {
  // sol bajo y fresco, del otro lado que a la tarde: las sombras van para el otro costado
  mañana: { sun: 0xfff0dc, elevation: 22, azimuth: 120, sunIntensity: 2.6, sky: 0xe4f2ff, ground: 0x4f6e3e, hemiIntensity: 1.25, skyTop: 0x86c3ee, horizon: 0xf7e6cf },
  // la luz de siempre: sol alto y cielo parejo
  mediodía: { sun: 0xfff2d6, elevation: 57, azimuth: -121, sunIntensity: 2.4, sky: 0xdff1ff, ground: 0x4a6b3a, hemiIntensity: 1.5, skyTop: 0x9fd3f0, horizon: 0x9fd3f0 },
  // sol más bajo y cálido, de atrás a la izquierda: las sombras caen hacia el campo y se leen
  tarde: { sun: 0xffe0b0, elevation: 32, azimuth: -125, sunIntensity: 3.0, sky: 0xcfe4ff, ground: 0x55683a, hemiIntensity: 1.0, skyTop: 0x5f9fdc, horizon: 0xf3dcb4 },
  atardecer: { sun: 0xffa870, elevation: 15, azimuth: -110, sunIntensity: 3.2, sky: 0xb8c2f0, ground: 0x4a4a36, hemiIntensity: 0.85, skyTop: 0x3f5f9a, horizon: 0xffb27a },
};

export const SHADOW_SIZES = ['1024', '2048', '4096'] as const;

/** Segundos que tarda la luz en pasar de la hora de una oleada a la de la siguiente. */
const DAY_TRANSITION = 5;

/** Todo lo que la pestaña Visual toca y guarda. */
/**
 * Dónde va el arco de carga, en pantalla: **adelante**, sobre el camino del tiro (el de fábrica), al
 * costado de la **cabeza** del golfista, o al costado de la **pelota**. Siempre del lado del golfista, para no tapar la
 * pelota ni la línea.
 */
export const METER_SPOTS = ['adelante', 'cabeza', 'pelota'] as const;
export type MeterSpot = (typeof METER_SPOTS)[number];

export const VISUAL = {
  meterAt: 'adelante' as MeterSpot,
  /** Versión del lugar del arco: un guardado de antes de que el de fábrica fuera «adelante» no lo pisa. */
  meterVersion: 2,
  shadows: true,
  shadowSize: '2048' as (typeof SHADOW_SIZES)[number],
  tone: 'ACES' as Tone,
  exposure: 1.0,
  light: 'según la oleada' as LightName, // i18n-ok: id que solo se lee en el panel B
  /**
   * Se copian de la hora del día al elegirla, y después se pueden tocar sueltos. Con «según la oleada»
   * no se usan: el sol sale del recorrido del día.
   */
  elevation: DAYLIGHT.tarde.elevation,
  azimuth: DAYLIGHT.tarde.azimuth,
  sunIntensity: DAYLIGHT.tarde.sunIntensity,
  /** Versión de la luz guardada: un guardado de antes de «según la oleada» no pisa la hora nueva. */
  lightVersion: 2,
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
  shadows: false, tone: 'ninguno', exposure: 1, light: 'mediodía', rim: false, bloom: false, // i18n-ok: id que solo se lee en el panel B
  elevation: DAYLIGHT.mediodía.elevation, azimuth: DAYLIGHT.mediodía.azimuth, sunIntensity: DAYLIGHT.mediodía.sunIntensity,
};
const DEFAULTS: VisualConfig = { ...VISUAL };
const DEFAULTS_LIGHT_VERSION = VISUAL.lightVersion;

/** Mezcla dos horas del día: los colores, el sol y el cielo. */
function mixDaylight(a: Daylight, b: Daylight, t: number): Daylight {
  const col = (x: number, y: number) => new THREE.Color(x).lerp(new THREE.Color(y), t).getHex();
  const num = (x: number, y: number) => x + (y - x) * t;
  // la dirección del sol va por el camino corto (de la mañana, del otro lado, a la tarde)
  let dAz = b.azimuth - a.azimuth;
  if (dAz > 180) dAz -= 360;
  if (dAz < -180) dAz += 360;
  return {
    sun: col(a.sun, b.sun), elevation: num(a.elevation, b.elevation), azimuth: a.azimuth + dAz * t,
    sunIntensity: num(a.sunIntensity, b.sunIntensity), sky: col(a.sky, b.sky), ground: col(a.ground, b.ground),
    hemiIntensity: num(a.hemiIntensity, b.hemiIntensity), skyTop: col(a.skyTop, b.skyTop), horizon: col(a.horizon, b.horizon),
  };
}

/** La luz de un punto del recorrido del día: 0 es la mañana (primera oleada), 1 el atardecer (última). */
export function daylightAt(progress: number): Daylight {
  const u = Math.min(1, Math.max(0, progress)) * (DAY_PATH.length - 1);
  const i = Math.min(DAY_PATH.length - 2, Math.floor(u));
  return mixDaylight(DAYLIGHT[DAY_PATH[i]], DAYLIGHT[DAY_PATH[i + 1]], u - i);
}

/** Elige una hora del día y le copia el sol a los números sueltos. */
export function setLight(name: LightName): void {
  VISUAL.light = name;
  if (name === 'según la oleada') return; // i18n-ok: id que solo se lee en el panel B
  const d = DAYLIGHT[name];
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
    // lo guardado antes de que la luz cambiara con la oleada no pisa la hora: si no, nadie la vería
    const oldLight = saved.lightVersion !== DEFAULTS_LIGHT_VERSION;
    const lightKeys = ['light', 'elevation', 'azimuth', 'sunIntensity'];
    const oldMeter = saved.meterVersion !== DEFAULTS.meterVersion;
    for (const key of Object.keys(VISUAL) as (keyof VisualConfig)[]) {
      if (oldLight && lightKeys.includes(key)) continue;
      if (oldMeter && (key === 'meterAt' || key === 'meterVersion')) continue;
      if (typeof saved[key] === typeof VISUAL[key]) (VISUAL as Record<string, unknown>)[key] = saved[key];
    }
    VISUAL.lightVersion = DEFAULTS_LIGHT_VERSION;
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
    // PCFSoftShadowMap ya no existe en three (avisa y usa este)
    renderer.shadowMap.type = THREE.PCFShadowMap;
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

  /** Por dónde va el día, de 0 (mañana, primera oleada) a 1 (atardecer, última), y a dónde va. */
  private day = 0;
  private dayTarget = 0;
  private dayTick = 0;

  /**
   * La partida avanzó: el día va hacia `progress` de a poco (unos segundos), no de golpe. Solo se nota
   * con la luz «según la oleada».
   */
  setDayProgress(progress: number, instant = false): void {
    this.dayTarget = Math.min(1, Math.max(0, progress));
    if (instant) {
      this.day = this.dayTarget;
      this.apply();
    }
  }

  /** Mueve el día hacia donde tiene que ir. Rehace la luz de a saltitos, no en cada cuadro. */
  updateDay(dt: number): void {
    if (this.day === this.dayTarget) return;
    const step = dt / DAY_TRANSITION;
    this.day = Math.abs(this.dayTarget - this.day) <= step ? this.dayTarget : this.day + Math.sign(this.dayTarget - this.day) * step;
    this.dayTick -= dt;
    if (this.dayTick > 0 && this.day !== this.dayTarget) return;
    this.dayTick = 0.2;
    if (VISUAL.light === 'según la oleada') this.apply(); // i18n-ok: id que solo se lee en el panel B
  }

  /** Pasa VISUAL a la escena. Se llama después de cada cambio del panel. */
  apply(): void {
    const v = VISUAL;
    const auto = v.light === 'según la oleada'; // i18n-ok: id que solo se lee en el panel B
    const d = auto ? daylightAt(this.day) : DAYLIGHT[v.light as FixedLight];
    const r = this.renderer;

    r.toneMapping = TONE_MAPPING[v.tone];
    r.toneMappingExposure = v.exposure;

    const el = THREE.MathUtils.degToRad(auto ? d.elevation : v.elevation);
    const az = THREE.MathUtils.degToRad(auto ? d.azimuth : v.azimuth);
    const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    this.sun.position.copy(this.focus).addScaledVector(dir, 120);
    this.sun.color.setHex(d.sun);
    this.sun.intensity = auto ? d.sunIntensity : v.sunIntensity;
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
        // las matas de pasto (game/world) reciben sombra pero no proyectan: el viento no movería la sombra
        mesh.castShadow = !mesh.userData.noCast;
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
