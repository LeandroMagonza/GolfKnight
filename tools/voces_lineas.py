"""Las líneas dichas de la cinemática, compartidas por los dos generadores de voces:
tools/voces.py (Kokoro, local) y tools/voces_openai.py (OpenAI, con actuación).

Cada línea: nombre del archivo, quién la dice, el texto y cómo se actúa (solo lo usa OpenAI). El texto
dicho puede diferir del que se lee en pantalla: los puntos suspensivos se leen mal, así que van comas.

LINES son las españolas (public/voices/) y LINES_EN las inglesas (public/voices/en/, solo OpenAI): mismos
nombres de archivo, y el texto en pantalla de cada una está en src/cine/intro.ts, con L(español, inglés).
Ver docs/localizacion.md.
"""

LINES = [
    ("narra-sabado", "narrator", "Sábado. Feria medieval.", "Arrancá el cuento con calma, como quien abre un libro."),
    ("narra-disfraz", "narrator", "Tu disfraz: impecable. Los de los demás, sospechosamente buenos.",
     "Orgullosa en la primera parte; en «sospechosamente buenos», bajá la voz con ironía, como quien sabe algo."),
    ("narra-salida", "narrator", "A la salida.", "Breve, como un cambio de escena."),
    ("narra-palos", "narrator", "Los palos de golf seguían en el baúl desde el domingo.",
     "Como un detalle al pasar que después va a importar, con una sonrisa en la voz."),
    ("narra-nada", "narrator", "Y después, nada.", "Seco, lento y en voz baja, con una pausa antes de «nada»."),
    ("mago-funciono", "mage", "¡Funcionó! ¡Vino el Gran Guerrero!", "Exaltado, eufórico, casi gritando de alegría: esperó esto toda la vida."),
    ("caballero-perdon", "knight", "¿Perdón?", "Recién despierto, aturdido y desconcertado, bajito."),
    ("mago-profecia", "mage", "La profecía pedía armadura reluciente, y un arma de precisión letal.",
     "Misterioso y lento, recitando una profecía antigua; con énfasis en «arma de precisión letal»."),
    ("caballero-palos", "knight", "¿Los palos de golf?", "Incrédulo, con la entonación subiendo al final: no puede creer lo que escucha."),
    ("mago-hordas", "mage", "¡Las hordas marchan sobre Valdehoyo!", "Alarmado y épico, con urgencia, como dando la voz de alerta."),
    ("caballero-feria", "knight", "Yo vine a una feria.", "Resignado y seco, casi con un suspiro: es el remate cómico."),
]

LINES_EN = [
    ("narra-sabado", "narrator", "Saturday. Medieval fair.", "Start the tale calmly, like someone opening a storybook."),
    ("narra-disfraz", "narrator", "Your costume: flawless. Everyone else's: suspiciously good.",
     "Proud in the first part; on 'suspiciously good', drop your voice with irony, like someone who knows something."),
    ("narra-salida", "narrator", "On the way out.", "Brief, like a scene change."),
    ("narra-palos", "narrator", "The golf clubs were still in the trunk from Sunday.",
     "Like a passing detail that will matter later, with a smile in your voice."),
    ("narra-nada", "narrator", "And then, nothing.", "Dry, slow and quiet, with a pause before 'nothing'."),
    ("mago-funciono", "mage", "It worked! The Great Warrior has come!", "Ecstatic, euphoric, almost shouting with joy: he has waited for this his whole life."),
    ("caballero-perdon", "knight", "Excuse me?", "Just woken up, dazed and bewildered, quietly."),
    ("mago-profecia", "mage", "The prophecy called for shining armor, and a weapon of deadly precision.",
     "Mysterious and slow, reciting an ancient prophecy; stress 'a weapon of deadly precision'."),
    ("caballero-palos", "knight", "The golf clubs?", "Incredulous, pitch rising at the end: he can't believe what he's hearing."),
    ("mago-hordas", "mage", "The hordes march on Valdehoyo!", "Alarmed and epic, urgent, like sounding the alarm."),
    ("caballero-feria", "knight", "I just came for the fair.", "Resigned and deadpan, almost a sigh: this is the comic punchline."),
]
