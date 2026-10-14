# El crepitar del fuego (14/10): ningún paquete trae uno (ver docs/assets-sonidos.md), así que se arma acá:
# un fondo de ruido grave que respira, y chasquidos cortos y brillantes al azar, como leña. Dos segundos que
# empalman sin corte (el final se funde con el principio), en public/sfx/burn-loop.mp3, y se anota en sfx.json.
#
#   python tools/crepitar.py
import json
import os
import subprocess
import wave

import numpy as np

ROOT = os.path.join(os.path.dirname(__file__), '..')
FFMPEG = os.path.expandvars(r'%LOCALAPPDATA%\Programs\LNV\Stremio-4\ffmpeg.exe')
SR = 44100
SECONDS = 2.0
FADE = 0.25
rng = np.random.default_rng(14)


def lowpass(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc = (1 - a) * v + a * acc
        y[i] = acc
    return y


n = int(SR * (SECONDS + FADE))
t = np.arange(n) / SR
# el fondo: ruido grave que sube y baja despacio
bed = lowpass(rng.standard_normal(n), 900) * (0.55 + 0.45 * np.sin(2 * np.pi * 0.7 * t) * np.sin(2 * np.pi * 1.9 * t))
bed = bed / np.abs(bed).max() * 0.18
# los chasquidos: ~22 por segundo, cortos y agudos, algunos más graves (los "pops" de la leña)
out = bed.copy()
events = rng.poisson(22 * (SECONDS + FADE))
for _ in range(events):
    at = rng.integers(0, n - 2000)
    big = rng.random() < 0.18
    length = int(SR * (rng.uniform(0.006, 0.02) if big else rng.uniform(0.001, 0.006)))
    tau = length / (3 if big else 4)
    env = np.exp(-np.arange(length) / tau)
    burst = rng.standard_normal(length) * env
    if big:
        burst = lowpass(burst, 2500) * 3
    else:
        burst = burst - lowpass(burst, 3000)
    out[at:at + length] += burst * rng.uniform(0.15, 0.7 if big else 0.5)
# que empalme: el final se funde con el principio
k = int(SR * FADE)
body = out[:int(SR * SECONDS)].copy()
ramp = np.linspace(0, 1, k)
body[:k] = body[:k] * ramp + out[int(SR * SECONDS):int(SR * SECONDS) + k] * (1 - ramp)
body = body / np.abs(body).max() * 0.85

wav = os.path.join(ROOT, 'logs', 'crepitar.wav')
with wave.open(wav, 'wb') as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((body * 32767).astype(np.int16).tobytes())
mp3 = os.path.join(ROOT, 'public', 'sfx', 'burn-loop.mp3')
subprocess.run([FFMPEG, '-y', '-loglevel', 'error', '-i', wav, '-ac', '1', '-ar', '44100', '-b:a', '80k', '-map_metadata', '-1', mp3], check=True)
os.remove(wav)
path = os.path.join(ROOT, 'public', 'sfx', 'sfx.json')
data = json.load(open(path, encoding='utf-8'))
data['burn-loop'] = {'files': ['burn-loop.mp3'], 'seconds': SECONDS, 'source': 'tools/crepitar.py', 'note': 'Generado: ningún paquete trae un crepitar de fuego.'}
json.dump(data, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('burn-loop', os.path.getsize(mp3) // 1024, 'KB')
