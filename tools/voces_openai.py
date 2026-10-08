"""Voces de la cinemática con OpenAI (gpt-4o-mini-tts): a diferencia de Kokoro, actúan. Cada personaje
tiene su voz y una indicación general, y cada línea suma cómo se dice (tools/voces_lineas.py).

**Desde el 8/10 el juego no las usa** (Leandro: para venderlo, voces de software; las del juego son las de
Kokoro, tools/voces.py). Este script queda para comparar: escribe en voces-openai/ (fuera de public/, no
se publica), y con --lang en en voces-openai/en/. Las que estuvieron en el juego siguen en el historial de
git (public/voices/, antes del 8/10).

La key sale de OPENAI_API_KEY en el entorno o de E:\\asistente\\.env, y nunca se imprime.
Cuesta menos de un centavo de dólar por pasada (unos 30 s de audio).

uso: E:\\asistente\\.venv\\Scripts\\python.exe tools/voces_openai.py [--lang en] [nombre ...]   (desde web/)
     con --recortar solo recorta los silencios de los que ya están, sin llamar a la API
"""
import io
import json
import os
import sys
import urllib.error
import urllib.request

import numpy as np
import soundfile as sf

from voces_lineas import LINES, LINES_EN

ENV = r"E:\asistente\.env"
ENGLISH = "--lang" in sys.argv and sys.argv[sys.argv.index("--lang") + 1:][:1] == ["en"]
OUT = os.path.join("voces-openai", "en") if ENGLISH else "voces-openai"

RIOPLATENSE = "Hablá en español rioplatense, con acento de Buenos Aires y voseo."
CAST = {
    "narrator": ("coral", RIOPLATENSE + " Sos la narradora de un cuento cómico de fantasía: voz cálida, un poco irónica, "
                 "con ritmo pausado de narradora de cuento."),
    # el mago es del otro mundo: latino neutro lo separa del golfista, que es de acá
    "mage": ("onyx", "Hablá en español latino neutro, con dicción clara. Sos un mago anciano de un reino de fantasía: "
             "voz grave, de viejo, solemne y teatral."),
    "knight": ("verse", RIOPLATENSE + " Sos un tipo común de Buenos Aires, disfrazado de caballero, que no entiende nada "
               "de lo que le pasa. Natural, nada teatral."),
}
# en inglés, las mismas voces: el mago con un dejo de otro mundo, los otros dos de acá
CAST_EN = {
    "narrator": ("coral", "Speak in English with a neutral American accent. You are the narrator of a comic fantasy tale: "
                 "warm voice, a little wry, with the unhurried rhythm of a storyteller."),
    "mage": ("onyx", "Speak in English with clear diction and a faint old-world accent. You are an ancient wizard from a "
             "fantasy kingdom: deep, aged voice, solemn and theatrical."),
    "knight": ("verse", "Speak in English with a neutral American accent. You are an ordinary guy dressed up as a knight "
               "who has no idea what is happening to him. Natural, not theatrical at all."),
}
if ENGLISH:
    LINES, CAST = LINES_EN, CAST_EN


def key() -> str:
    k = os.environ.get("OPENAI_API_KEY", "")
    if not k and os.path.exists(ENV):
        with open(ENV, encoding="utf-8-sig") as f:
            for line in f:
                name, _, value = line.partition("=")
                if name.strip() == "OPENAI_API_KEY":
                    k = value.strip().strip('"').strip("'")
    if not k:
        sys.exit("no encontré OPENAI_API_KEY ni en el entorno ni en " + ENV)
    return k


def speak(k: str, voice: str, text: str, instructions: str):
    body = {"model": "gpt-4o-mini-tts", "voice": voice, "input": text, "instructions": instructions, "response_format": "wav"}
    req = urllib.request.Request(
        "https://api.openai.com/v1/audio/speech",
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={"Authorization": f"Bearer {k}", "Content-Type": "application/json"})
    try:
        raw = urllib.request.urlopen(req, timeout=90).read()
    except urllib.error.HTTPError as e:
        sys.exit(f"OpenAI respondió {e.code}: {e.read()[:300]!r}")
    # se decodifica y se vuelve a escribir: el wav que devuelve puede traer el largo sin completar
    return sf.read(io.BytesIO(raw), dtype="float32")


def trim(audio, sr):
    """Saca el silencio del principio y del final (OpenAI deja hasta 1.5 s), con un margen chico."""
    mono = audio if audio.ndim == 1 else audio.mean(axis=1)
    loud = np.where(np.abs(mono) > 10 ** (-45 / 20))[0]
    if not len(loud):
        return audio
    start = max(0, loud[0] - int(0.05 * sr))
    end = min(len(audio), loud[-1] + int(0.15 * sr))
    return audio[start:end]


only = {a for a in sys.argv[1:] if not a.startswith("--") and a != "en"}
if "--recortar" in sys.argv:
    # solo recorta los que ya están: no llama a la API
    for name, *_ in LINES:
        path = os.path.join(OUT, f"{name}.wav")
        if (only and name not in only) or not os.path.exists(path):
            continue
        audio, sr = sf.read(path, dtype="float32")
        cut = trim(audio, sr)
        sf.write(path, cut, sr)
        print(f"{name:18} {len(audio) / sr:5.2f} s -> {len(cut) / sr:5.2f} s")
    sys.exit(0)
os.makedirs(OUT, exist_ok=True)
k = key()
total = 0.0
for name, who, text, mood in LINES:
    if only and name not in only:
        continue
    voice, base = CAST[who]
    audio, sr = speak(k, voice, text, f"{base} {mood}")
    audio = trim(audio, sr)
    path = os.path.join(OUT, f"{name}.wav")
    sf.write(path, audio, sr)
    total += len(audio) / sr
    print(f"{name:18} {voice:6} {len(audio) / sr:5.2f} s  {os.path.getsize(path) // 1024} KB")
print(f"total {total:.1f} s de audio")
