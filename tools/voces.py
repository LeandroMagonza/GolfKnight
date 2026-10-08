"""Voces de la cinemática con Kokoro (local, gratis, licencia Apache 2.0), el mismo TTS que usa el asistente
de Leandro. Son las del juego desde el 8/10 (pedido de Leandro: para venderlo, voces de software y no las
de OpenAI, que quedaron fuera de public/; ver tools/voces_openai.py).

Genera un .wav por línea en public/voices/es/ y public/voices/en/ e imprime cuánto dura cada uno: las
líneas que se pisan con la siguiente se corrigen con los tiempos de src/cine/intro.ts. Las líneas están en
tools/voces_lineas.py.

uso: E:\\asistente\\.venv\\Scripts\\python.exe tools/voces.py [es|en]   (desde web/; sin nada, los dos)
"""
import os
import sys

import soundfile as sf
from kokoro_onnx import Kokoro

from voces_lineas import LINES, LINES_EN

MODEL = r"E:\asistente\tts\kokoro\kokoro-v1.0.onnx"
VOICES = r"E:\asistente\tts\kokoro\voices-v1.0.bin"

# quién habla con qué voz (voz, velocidad, idioma de Kokoro): el mago, grave y más lento; el golfista, la
# voz neutra; la narradora, voz de mujer para que no se confunda con ninguno de los dos. En inglés, la
# narradora y el mago británicos (cuento y profecía), y el golfista norteamericano, como un turista
CASTS = {
    "es": {
        "narrator": ("ef_dora", 1.0, "es"),
        "mage": ("em_santa", 0.88, "es"),
        "knight": ("em_alex", 1.0, "es"),
    },
    "en": {
        "narrator": ("bf_emma", 1.0, "en-gb"),
        "mage": ("bm_george", 0.9, "en-gb"),
        "knight": ("am_michael", 1.0, "en-us"),
    },
}
SCRIPTS = {"es": LINES, "en": LINES_EN}

k = Kokoro(MODEL, VOICES)
for lang in sys.argv[1:] or ["es", "en"]:
    out = os.path.join("public", "voices", lang)
    os.makedirs(out, exist_ok=True)
    for name, who, text, _mood in SCRIPTS[lang]:
        voice, speed, code = CASTS[lang][who]
        audio, sr = k.create(text, voice=voice, speed=speed, lang=code)
        path = os.path.join(out, f"{name}.wav")
        sf.write(path, audio, sr)
        print(f"{lang} {name:18} {voice:10} {len(audio) / sr:5.2f} s  {os.path.getsize(path) // 1024} KB")
