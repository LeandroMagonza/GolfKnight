"""Voces de la cinemática con Kokoro (local, gratis), el mismo TTS que usa el asistente de Leandro.

Genera un .wav por línea en public/voices/ e imprime cuánto dura cada uno, para ajustar los globos del
guion (src/cine/intro.ts). El texto que se dice puede ser distinto del que se muestra: los puntos
suspensivos se leen mal, así que acá van comas.

uso: E:\\asistente\\.venv\\Scripts\\python.exe tools/voces.py   (desde web/)
"""
import os
import soundfile as sf
from kokoro_onnx import Kokoro

MODEL = r"E:\asistente\tts\kokoro\kokoro-v1.0.onnx"
VOICES = r"E:\asistente\tts\kokoro\voices-v1.0.bin"
OUT = os.path.join("public", "voices")

# quién habla con qué voz: el mago, grave y más lento; el golfista, la voz neutra
CAST = {
    "mage": ("em_santa", 0.88),
    "knight": ("em_alex", 1.0),
}

LINES = [
    ("mago-funciono", "mage", "¡Funcionó! ¡Vino el Gran Guerrero!"),
    ("caballero-perdon", "knight", "¿Perdón?"),
    ("mago-profecia", "mage", "La profecía pedía armadura reluciente, y un arma de precisión letal."),
    ("caballero-palos", "knight", "¿Los palos de golf?"),
    ("mago-hordas", "mage", "¡Las hordas marchan sobre Valdehoyo!"),
    ("caballero-feria", "knight", "Yo vine a una feria."),
]

os.makedirs(OUT, exist_ok=True)
k = Kokoro(MODEL, VOICES)
for name, who, text in LINES:
    voice, speed = CAST[who]
    audio, sr = k.create(text, voice=voice, speed=speed, lang="es")
    path = os.path.join(OUT, f"{name}.wav")
    sf.write(path, audio, sr)
    print(f"{name:18} {voice:9} {len(audio) / sr:5.2f} s  {os.path.getsize(path) // 1024} KB")
