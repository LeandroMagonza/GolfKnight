"""Las líneas dichas de la cinemática, compartidas por los dos generadores de voces:
tools/voces.py (Kokoro, local) y tools/voces_openai.py (OpenAI, con actuación).

Cada línea: nombre del archivo, quién la dice, el texto y cómo se actúa (solo lo usa OpenAI). El texto
dicho puede diferir del que se lee en pantalla: los puntos suspensivos se leen mal, así que van comas.
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
