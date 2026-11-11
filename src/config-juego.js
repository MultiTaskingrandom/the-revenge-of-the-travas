// CONFIGURACION DEL JUEGO: personajes, niveles y textos.
// Este archivo lo genera el panel admin.html (boton "Guardar archivo"). Tambien se puede editar a mano.
window.CONFIG_JUEGO = {
  "personajes": {
    "angie": {
      "nombre": "ANGIE",
      "alto": 165,
      "hp": 100,
      "vel": 240,
      "velY": 150,
      "salto": 640,
      "punio": 10,
      "remate": 16,
      "patada": 10,
      "patadaAire": 12,
      "comboPatada": 20
    },
    "lula": {
      "nombre": "LULA",
      "alto": 165,
      "hp": 100,
      "vel": 240,
      "velY": 150,
      "salto": 640,
      "punio": 10,
      "remate": 16,
      "patada": 10,
      "patadaAire": 12,
      "comboPatada": 20
    },
    "turro1": {
      "nombre": "BOOS1",
      "alto": 160,
      "hp": 50,
      "vel": 120,
      "velY": 85,
      "punio": 7,
      "patada": 9,
      "esperaMin": 0.9,
      "esperaMax": 1.7,
      "alcance": 100,
      "puntos": 100,
      "dispara": false,
      "bala": 10
    },
    "turro2": {
      "nombre": "BOOS2",
      "alto": 160,
      "hp": 50,
      "vel": 120,
      "velY": 85,
      "punio": 7,
      "patada": 9,
      "esperaMin": 0.9,
      "esperaMax": 1.7,
      "alcance": 100,
      "puntos": 100,
      "dispara": false,
      "bala": 10
    },
    "bossfinal": {
      "nombre": "BOOS3",
      "alto": 215,
      "hp": 100,
      "vel": 100,
      "velY": 75,
      "punio": 10,
      "patada": 13,
      "esperaMin": 0.7,
      "esperaMax": 1.3,
      "alcance": 125,
      "puntos": 1000,
      "dispara": true,
      "bala": 12
    },
    "chaleco": {
      "nombre": "Turro1",
      "alto": 160,
      "hp": 50,
      "vel": 120,
      "velY": 85,
      "punio": 7,
      "patada": 9,
      "esperaMin": 0.9,
      "esperaMax": 1.7,
      "alcance": 100,
      "puntos": 100,
      "dispara": false,
      "bala": 10
    },
    "campera": {
      "nombre": "Turro2",
      "alto": 160,
      "hp": 50,
      "vel": 120,
      "velY": 85,
      "punio": 7,
      "patada": 9,
      "esperaMin": 0.9,
      "esperaMax": 1.7,
      "alcance": 100,
      "puntos": 100,
      "dispara": false,
      "bala": 10
    },
    "doctorazul": {
      "nombre": "Turroazul",
      "alto": 160,
      "hp": 50,
      "vel": 120,
      "velY": 85,
      "punio": 7,
      "patada": 9,
      "esperaMin": 0.9,
      "esperaMax": 1.7,
      "alcance": 100,
      "puntos": 100,
      "dispara": false,
      "bala": 10
    },
    "doctorrojo": {
      "nombre": "Turrorojo",
      "alto": 160,
      "hp": 50,
      "vel": 120,
      "velY": 85,
      "punio": 7,
      "patada": 9,
      "esperaMin": 0.9,
      "esperaMax": 1.7,
      "alcance": 100,
      "puntos": 100,
      "dispara": false,
      "bala": 10
    },
    "doctorverde": {
      "nombre": "Turroverde",
      "alto": 160,
      "hp": 50,
      "vel": 120,
      "velY": 85,
      "punio": 7,
      "patada": 9,
      "esperaMin": 0.9,
      "esperaMax": 1.7,
      "alcance": 100,
      "puntos": 100,
      "dispara": false,
      "bala": 10
    }
  },
  "niveles": [
    {
      "nombre": "El Hipódromo",
      "fondo": "fondohipodromo",
      "pisoMin": 480,
      "pisoMax": 712,
      "intro": "",
      "historia": [
        "Angie una ves en el hipodromo detecta la precencia de turros....",
        "Y comienza el despiole!"
      ],
      "oleadas": [
        {
          "enemigos": [
            {
              "tipo": "campera",
              "lado": "izquierda",
              "demora": 0.7
            },
            {
              "tipo": "doctorrojo",
              "lado": "derecha",
              "demora": 1.5
            }
          ]
        },
        {
          "enemigos": [
            {
              "tipo": "chaleco",
              "lado": "derecha",
              "demora": 0.7
            },
            {
              "tipo": "doctorverde",
              "lado": "izquierda",
              "demora": 1.5
            }
          ]
        },
        {
          "enemigos": [
            {
              "tipo": "campera",
              "lado": "izquierda",
              "demora": 0.7
            },
            {
              "tipo": "doctorazul",
              "lado": "derecha",
              "demora": 1.5
            }
          ]
        },
        {
          "enemigos": [
            {
              "tipo": "doctorverde",
              "lado": "derecha",
              "demora": 0.7
            },
            {
              "tipo": "campera",
              "lado": "izquierda",
              "demora": 1.5
            }
          ]
        }
      ],
      "jefe": {
        "tipo": "turro1",
        "lado": "derecha",
        "anuncio": "¡CUIDADO!",
        "vida": 250,
        "alto": 200
      },
      "historiaFinal": [
        "Anguie gano este round!",
        "pero parece que esto no temrmina aun...",
        "Unos de los turros se le escapo que hay bardo en el planetario",
        "entonces angie pone rumbo para alla!"
      ]
    },
    {
      "nombre": "El Planetario",
      "fondo": "fondoplanetario",
      "pisoMin": 520,
      "pisoMax": 712,
      "intro": "",
      "historia": [
        "Mierda el 22 me dejo mas lejos que la mierda.",
        "vamos a ver que onda aca",
        "uuu turros!!"
      ],
      "oleadas": [
        {
          "enemigos": [
            {
              "tipo": "chaleco",
              "lado": "izquierda",
              "demora": 0.7
            },
            {
              "tipo": "campera",
              "lado": "derecha",
              "demora": 1.5
            }
          ]
        },
        {
          "enemigos": [
            {
              "tipo": "doctorazul",
              "lado": "izquierda",
              "demora": 0.7
            },
            {
              "tipo": "chaleco",
              "lado": "derecha",
              "demora": 1.5
            }
          ]
        },
        {
          "enemigos": [
            {
              "tipo": "doctorrojo",
              "lado": "derecha",
              "demora": 0.7
            },
            {
              "tipo": "campera",
              "lado": "izquierda",
              "demora": 1.5
            }
          ]
        },
        {
          "enemigos": [
            {
              "tipo": "doctorverde",
              "lado": "izquierda",
              "demora": 0.7
            },
            {
              "tipo": "doctorazul",
              "lado": "derecha",
              "demora": 1.5
            }
          ]
        }
      ],
      "jefe": {
        "tipo": "turro2",
        "lado": "derecha",
        "anuncio": "¡CUIDADO!\n",
        "vida": 325,
        "alto": 220
      },
      "historiaFinal": [
        "Bueno parece que se la comieron re doblada giles ajajja",
        "ring! ring! uuu q paso ahora?",
        "el viejo verde: che se pudrio en el obelisco veni que te necesitamos urgente!!!",
        "Bueeenoooo a comerlaaaaaa"
      ]
    },
    {
      "nombre": "La Calle de las Luces",
      "fondo": "fondocalle",
      "pisoMin": 560,
      "pisoMax": 712,
      "intro": "",
      "historia": [
        "uuu me comi el viaje me bajeu nu poco antes del bondo",
        "bue aca ta lleno de turros",
        "vamos a hacer cagar un par fue"
      ],
      "oleadas": [
        {
          "enemigos": [
            {
              "tipo": "doctorazul",
              "lado": "izquierda",
              "demora": 0.7
            },
            {
              "tipo": "doctorrojo",
              "lado": "derecha",
              "demora": 1.5
            },
            {
              "tipo": "doctorazul",
              "lado": "izquierda",
              "demora": 2.3
            }
          ]
        },
        {
          "enemigos": [
            {
              "tipo": "chaleco",
              "lado": "izquierda",
              "demora": 0.7
            },
            {
              "tipo": "campera",
              "lado": "derecha",
              "demora": 1.5
            },
            {
              "tipo": "doctorazul",
              "lado": "izquierda",
              "demora": 2.3
            }
          ]
        },
        {
          "enemigos": [
            {
              "tipo": "doctorverde",
              "lado": "derecha",
              "demora": 0.7
            },
            {
              "tipo": "doctorrojo",
              "lado": "izquierda",
              "demora": 1.5
            },
            {
              "tipo": "doctorverde",
              "lado": "derecha",
              "demora": 2.3
            }
          ]
        },
        {
          "enemigos": [
            {
              "tipo": "doctorrojo",
              "lado": "izquierda",
              "demora": 0.7
            },
            {
              "tipo": "doctorazul",
              "lado": "derecha",
              "demora": 1.5
            },
            {
              "tipo": "doctorrojo",
              "lado": "izquierda",
              "demora": 2.3
            },
            {
              "tipo": "doctorrojo",
              "lado": "derecha",
              "demora": 3.1
            }
          ]
        }
      ],
      "jefe": null,
      "historiaFinal": [
        "jojojo como comierdo ver.... a no ajajaja",
        "viejo verde: che vas a venir ??",
        "uuu ta pesado el hombre... bueno voy"
      ]
    },
    {
      "nombre": "El Obelisco",
      "fondo": "fondojugando",
      "pisoMin": 615,
      "pisoMax": 712,
      "intro": "",
      "historia": [
        "Bue culiau casi que no llegaba mas",
        "jojojo aca se pone fea la cosa",
        "van a comer lindo esta noche!"
      ],
      "oleadas": [
        {
          "enemigos": [
            {
              "tipo": "chaleco",
              "lado": "izquierda",
              "demora": 0.7
            },
            {
              "tipo": "campera",
              "lado": "derecha",
              "demora": 1.5
            }
          ]
        },
        {
          "enemigos": [
            {
              "tipo": "doctorazul",
              "lado": "izquierda",
              "demora": 0.7
            },
            {
              "tipo": "doctorrojo",
              "lado": "derecha",
              "demora": 1.5
            }
          ]
        },
        {
          "enemigos": [
            {
              "tipo": "doctorverde",
              "lado": "izquierda",
              "demora": 0.7
            },
            {
              "tipo": "chaleco",
              "lado": "derecha",
              "demora": 1.5
            },
            {
              "tipo": "doctorverde",
              "lado": "izquierda",
              "demora": 2.3
            },
            {
              "tipo": "doctorazul",
              "lado": "derecha",
              "demora": 3.1
            }
          ]
        },
        {
          "enemigos": [
            {
              "tipo": "turro1",
              "lado": "izquierda",
              "demora": 0.7
            },
            {
              "tipo": "turro2",
              "lado": "derecha",
              "demora": 1.5
            }
          ]
        }
      ],
      "jefe": {
        "tipo": "bossfinal",
        "anuncio": "¡CUIDADO!\nLLEGA EL TURRO FINAL",
        "vida": 400,
        "alto": 300
      },
      "historiaFinal": [
        "Angie se los cojio a todo ejjeje",
        "bueno las calles de Buenos Aires estan limpia por un tiempo ... pero hasta cuando ???",
        "Mientras tanto Agie seguira en la clandestinidad apoyando a los suyos."
      ]
    }
  ],
  "textos": {
    "historia": [
      "Luego de hechos desafortunados en Buenos Aires,",
      "Angie busca redención para ella y su comunidad.\nQuiere poner fin a las normas del patriarcado.",
      "Por eso decide salir a las oscuras noches de Buenos Aires.",
      "Recibe un llamado de un fiel amigo, \"el viejo verde\",\nde inconvenientes en el hipódromo y de un ataque de turros.",
      "Entonces decide ir a poner orden."
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
  "cooperativo": {
    "vidaEnemigos": 1.5
  },
  "combos": {
    "triple": 150,
    "piniaPatada": 250
  },
  "dificultades": {
    "facil": {
      "nombre": "FÁCIL",
      "puntos": 0.5,
      "vidaEnemigos": 0.75,
      "danioEnemigos": 0.6
    },
    "normal": {
      "nombre": "NORMAL",
      "puntos": 1,
      "vidaEnemigos": 1,
      "danioEnemigos": 1
    },
    "dificil": {
      "nombre": "DIFÍCIL",
      "puntos": 2,
      "vidaEnemigos": 1.3,
      "danioEnemigos": 1.5
    }
  },
  "fondosExtra": {}
};
