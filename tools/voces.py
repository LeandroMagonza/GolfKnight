"""Voces de la cinemática con Kokoro (local, gratis), el mismo TTS que usa el asistente de Leandro.

Genera un .wav por línea en public/voices/kokoro/ e imprime cuánto dura cada uno. La cinemática usa
las de OpenAI (public/voices/, tools/voces_openai.py), que actúan; estas se oyen con ?voces=kokoro.
Las líneas están en tools/voces_lineas.py.

uso: E:\\asistente\\.venv\\Scripts\\python.exe tools/voces.py   (desde web/)
"""
import os
import soundfile as sf
from kokoro_onnx import Kokoro

from voces_lineas import LINES

MODEL = r"E:\asistente\tts\kokoro\kokoro-v1.0.onnx"
VOICES = r"E:\asistente\tts\kokoro\voices-v1.0.bin"
OUT = os.path.join("public", "voices", "kokoro")

# quién habla con qué voz: el mago, grave y más lento; el golfista, la voz neutra; la narradora,
# voz de mujer para que no se confunda con ninguno de los dos
CAST = {
    "narrator": ("ef_dora", 1.0),
    "mage": ("em_santa", 0.88),
    "knight": ("em_alex", 1.0),
}

os.makedirs(OUT, exist_ok=True)
k = Kokoro(MODEL, VOICES)
for name, who, text, _mood in LINES:
    voice, speed = CAST[who]
    audio, sr = k.create(text, voice=voice, speed=speed, lang="es")
    path = os.path.join(OUT, f"{name}.wav")
    sf.write(path, audio, sr)
    print(f"{name:18} {voice:9} {len(audio) / sr:5.2f} s  {os.path.getsize(path) // 1024} KB")
