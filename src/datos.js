// Constantes del motor del juego. Los personajes, niveles y textos estan en src/config-juego.js
// (se editan con el panel admin.html).
window.JUEGO = {
  ANCHO: 960,
  ALTO: 720,

  // Zona de la calle donde se puede caminar (la cambia cada nivel con pisoMin/pisoMax)
  PISO_MIN: 615,
  PISO_MAX: 712,
  X_MIN: 45,
  X_MAX: 915,
  GRAVEDAD: 1700,

  // Tipos de personaje que existen (cada uno tiene su hoja de sprites)
  TIPOS_ENEMIGO: ['turro1', 'turro2', 'bossfinal', 'chaleco', 'campera', 'doctorazul', 'doctorrojo', 'doctorverde', 'turrosorpresa'],
  // Enemigo que aparece de sorpresa (probabilidad por nivel: "sorpresa" en config-juego.js)
  TIPO_SORPRESA: 'turrosorpresa',
  // Personajes que puede usar el jugador
  JUGABLES: ['angie', 'lula'],
  // Dificultades en orden (los valores de cada una estan en config-juego.js -> "dificultades")
  DIFICULTADES: ['facil', 'normal', 'dificil'],

  // Controles por defecto: dos teclas por accion (codigos de teclado; 0 = sin tecla)
  CONTROLES_DEFECTO: {
    izquierda: [37, 65],  // flecha izq, A
    derecha: [39, 68],    // flecha der, D
    arriba: [38, 87],     // flecha arriba, W
    abajo: [40, 83],      // flecha abajo, S
    pinia: [90, 74],      // Z, J
    patada: [88, 75],     // X, K
    salto: [32, 76],      // ESPACIO, L
    pausa: [80, 27]       // P, ESC
  },
  NOMBRES_ACCION: {
    izquierda: 'IZQUIERDA', derecha: 'DERECHA', arriba: 'ARRIBA', abajo: 'ABAJO',
    pinia: 'PIÑA', patada: 'PATADA', salto: 'SALTO', pausa: 'PAUSA'
  }
};

// Configuracion activa. Con index.html?prueba usa la que dejo el panel admin en este navegador.
window.JUEGO.config = (function () {
  let c = window.CONFIG_JUEGO;
  if (/[?&]prueba/.test(location.search)) {
    try { const p = JSON.parse(localStorage.getItem('trav_config_prueba')); if (p) c = p; } catch (e) {}
  }
  // Configuraciones viejas (sin Lula o sin "cooperativo"): se completan con valores por defecto
  if (!c.personajes.lula) c.personajes.lula = Object.assign({}, c.personajes.angie, { nombre: 'LULA' });
  // Enemigos agregados despues: si faltan, se copian del turro comun
  window.JUEGO.TIPOS_ENEMIGO.forEach((t) => {
    if (!c.personajes[t]) c.personajes[t] = Object.assign({}, c.personajes.turro1, { nombre: t.toUpperCase() });
  });
  // Turro Sorpresa por defecto: triple de velocidad y 5 veces los puntos del turro comun
  const ts = c.personajes.turrosorpresa, t1 = c.personajes.turro1;
  if (ts.nombre === 'TURROSORPRESA') Object.assign(ts, { nombre: 'TURRO SORPRESA', vel: t1.vel * 3, velY: t1.velY * 3, puntos: t1.puntos * 5 });
  c.cooperativo = Object.assign({ vidaEnemigos: 1.5 }, c.cooperativo || {});
  c.combos = Object.assign({ triple: 150, piniaPatada: 250 }, c.combos || {});
  c.dificultades = Object.assign({
    facil: { nombre: 'FÁCIL', puntos: 0.5, vidaEnemigos: 0.75, danioEnemigos: 0.6 },
    normal: { nombre: 'NORMAL', puntos: 1, vidaEnemigos: 1, danioEnemigos: 1 },
    dificil: { nombre: 'DIFÍCIL', puntos: 2, vidaEnemigos: 1.3, danioEnemigos: 1.5 }
  }, c.dificultades || {});
  // historia antes de cada nivel (lista de pantallas)
  c.niveles.forEach((n) => {
    if (!Array.isArray(n.historia)) n.historia = [];
    if (!Array.isArray(n.historiaFinal)) n.historiaFinal = [];   // historia al terminar el nivel
    if (typeof n.sorpresa !== 'number') n.sorpresa = 0;          // % de que aparezca el Turro Sorpresa
  });
  ['angie', 'lula'].forEach((t) => { if (c.personajes[t].comboPatada == null) c.personajes[t].comboPatada = 20; });
  return c;
})();

// Nombre lindo de una tecla a partir de su codigo
window.nombreTecla = function (codigo) {
  if (!codigo) return '—';
  const especiales = { 37: '←', 39: '→', 38: '↑', 40: '↓', 32: 'ESPACIO', 27: 'ESC', 13: 'ENTER', 16: 'SHIFT', 17: 'CTRL', 18: 'ALT', 9: 'TAB' };
  if (especiales[codigo]) return especiales[codigo];
  const KC = Phaser.Input.Keyboard.KeyCodes;
  for (const n in KC) if (KC[n] === codigo) return n.replace('NUMPAD_', 'NUM ');
  return '#' + codigo;
};
