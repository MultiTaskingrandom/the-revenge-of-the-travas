// CONFIGURACION DEL JUEGO: personajes, niveles y textos.
// Este archivo lo genera el panel admin.html (boton "Guardar archivo"). Tambien se puede editar a mano.
window.CONFIG_JUEGO = {
  "personajes": {
    "angie": { "nombre": "ANGIE", "alto": 165, "hp": 100, "vel": 240, "velY": 150, "salto": 640,
               "punio": 10, "remate": 16, "patada": 14, "patadaAire": 18 },
    "turro1": { "nombre": "TURRO", "alto": 160, "hp": 50, "vel": 120, "velY": 85, "punio": 7, "patada": 9,
                "esperaMin": 0.9, "esperaMax": 1.7, "alcance": 100, "puntos": 100, "dispara": false, "bala": 10 },
    "turro2": { "nombre": "TURRO", "alto": 160, "hp": 50, "vel": 120, "velY": 85, "punio": 7, "patada": 9,
                "esperaMin": 0.9, "esperaMax": 1.7, "alcance": 100, "puntos": 100, "dispara": false, "bala": 10 },
    "bossfinal": { "nombre": "TURRO FINAL", "alto": 215, "hp": 100, "vel": 100, "velY": 75, "punio": 10, "patada": 13,
                   "esperaMin": 0.7, "esperaMax": 1.3, "alcance": 125, "puntos": 1000, "dispara": true, "bala": 12 }
  },
  "niveles": [
    {
      "nombre": "El Obelisco",
      "fondo": "fondojugando",
      "pisoMin": 615,
      "pisoMax": 712,
      "intro": "",
      "oleadas": [
        { "enemigos": [ { "tipo": "turro1", "lado": "izquierda", "demora": 0.7 }, { "tipo": "turro2", "lado": "derecha", "demora": 1.5 } ] },
        { "enemigos": [ { "tipo": "turro1", "lado": "izquierda", "demora": 0.7 }, { "tipo": "turro2", "lado": "derecha", "demora": 1.5 } ] },
        { "enemigos": [ { "tipo": "turro1", "lado": "izquierda", "demora": 0.7 }, { "tipo": "turro2", "lado": "derecha", "demora": 1.5 } ] },
        { "enemigos": [ { "tipo": "turro1", "lado": "izquierda", "demora": 0.7 }, { "tipo": "turro2", "lado": "derecha", "demora": 1.5 } ] }
      ],
      "jefe": { "tipo": "bossfinal", "anuncio": "¡CUIDADO!\nLLEGA EL TURRO FINAL" }
    }
  ],
  "textos": {
    "historia": [
      "Buenos Aires. Tres de la mañana.",
      "Angie siempre supo quién era: una mujer.\nY las calles de la ciudad eran su escenario.",
      "Pero EL TURRO FINAL y su banda\ntomaron el Obelisco y decidieron que en SU ciudad\nnadie es libre de ser quien es.",
      "Le cerraron los boliches, le cortaron la gira\ny le quitaron la libertad.",
      "Esta noche Angie se calza las botas.\nVa a recuperar lo que es suyo."
    ],
    "victoria": "¡MUY BIEN ANGIE, GANASTE!\nVas a poder volver a las calles de gira",
    "derrota": "Los turros ganaron esta noche...\npero Angie no se rinde.",
    "nivelSuperado": "¡NIVEL SUPERADO!"
  },
  "puntaje": {
    "bonoTiempo": 5000,
    "puntosPorSegundo": 25,
    "porDanio": 10,
    "porVida": 1000
  },
  "fondosExtra": {}
};
