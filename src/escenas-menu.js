// Escenas: carga, menu de inicio (START / OPCIONES / CONTROLES), historia y pantallas finales.
const ESTILO = (tam, color) => ({
  fontFamily: '"Arial Black", Impact, sans-serif', fontSize: tam + 'px', color: color || '#ffffff',
  stroke: '#000000', strokeThickness: Math.max(3, Math.round(tam / 6)), align: 'center'
});

// segundos -> "m:ss"
function formatoTiempo(seg) {
  seg = Math.floor(seg);
  return Math.floor(seg / 60) + ':' + String(seg % 60).padStart(2, '0');
}

function controlesDefecto() { return JSON.parse(JSON.stringify(window.JUEGO.CONTROLES_DEFECTO)); }

function leerOpciones() {
  let o = { vidas: 3, dificultad: 'normal', personaje: 'angie', fuegoAmigo: false, controles: controlesDefecto() };
  try {
    const g = JSON.parse(localStorage.getItem('trav_opciones'));
    if (g) {
      o.vidas = g.vidas || o.vidas;
      if (window.JUEGO.DIFICULTADES.includes(g.dificultad)) o.dificultad = g.dificultad;
      if (window.JUEGO.JUGABLES.includes(g.personaje)) o.personaje = g.personaje;
      o.fuegoAmigo = !!g.fuegoAmigo;
      if (g.controles) for (const acc in o.controles) if (Array.isArray(g.controles[acc])) o.controles[acc] = g.controles[acc];
    }
  } catch (e) {}
  return o;
}
function guardarOpciones(o) {
  try { localStorage.setItem('trav_opciones', JSON.stringify(o)); } catch (e) {}
}

const TEXTO_COMBOS = 'COMBOS (¡dan puntos!)\nPIÑA, PIÑA, PIÑA: combo triple\nPIÑA, PIÑA, PATADA: combo patada';

function textoControles(ctrl) {
  if (window.esTactil()) {
    return 'CONTROLES\n\nJoystick (izquierda): caminar\nPIÑA: piña   ·   PATADA: patada\nSALTO: saltar (¡y patada en el aire!)\nII: pausa\n\n' + TEXTO_COMBOS;
  }
  const t = (acc) => ctrl[acc].filter((c) => c).map(nombreTecla).join(' o ');
  return 'CONTROLES\n\n' +
    t('izquierda') + ' / ' + t('derecha') + ' / ' + t('arriba') + ' / ' + t('abajo') + ': caminar\n' +
    t('pinia') + ': piña   ·   ' + t('patada') + ': patada\n' +
    t('salto') + ': saltar (¡patada en el aire!)\n' +
    t('pausa') + ': pausa\n\n' + TEXTO_COMBOS;
}

function fondoEstrellas(scene) {
  scene.add.rectangle(480, 360, 960, 720, 0x0a0c22);
  for (let i = 0; i < 80; i++) {
    scene.add.rectangle(Phaser.Math.Between(0, 960), Phaser.Math.Between(0, 720), 2, 2, 0xffffff, Math.random() * 0.7 + 0.2);
  }
}

class EscenaCarga extends Phaser.Scene {
  constructor() { super('carga'); }
  // Las imagenes vienen embebidas (assets-data.js y fondos extra de config-juego.js); se cargan con <img>
  // para que el juego funcione tanto en un hosting como abriendo index.html con doble clic.
  create() {
    const txt = this.add.text(480, 360, 'CARGANDO...', ESTILO(28)).setOrigin(0.5);
    const todas = Object.assign({}, window.ASSET_DATA, window.JUEGO.config.fondosExtra || {});
    const claves = Object.keys(todas);
    let listas = 0;
    claves.forEach((k) => {
      const img = new Image();
      img.onload = () => {
        if (!this.textures.exists(k)) this.textures.addImage(k, img);
        listas++;
        txt.setText('CARGANDO... ' + Math.round(listas / claves.length * 100) + '%');
        if (listas === claves.length) this.scene.start('menu');
      };
      img.onerror = () => txt.setText('Error cargando ' + k);
      img.src = todas[k];
    });
  }
}

class EscenaMenu extends Phaser.Scene {
  constructor() { super('menu'); }

  create() {
    RED.cerrar();   // al volver al menu se corta cualquier partida online
    this.opc = leerOpciones();
    fondoEstrellas(this);
    this.titulo = this.add.image(480, 20, 'fondoinicio').setOrigin(0.5, 0);

    this.modo = 'principal';   // principal | opciones | controles
    this.sel = 0;
    this.col = 0;              // columna (tecla 1 o 2) en el menu de controles
    this.esperandoTecla = false;
    this.items = [];
    this.cursor = this.add.text(0, 0, '▶', ESTILO(30, '#ff4fd8')).setOrigin(1, 0.5);
    this.tweens.add({ targets: this.cursor, alpha: 0.3, duration: 400, yoyo: true, repeat: -1 });

    this.ayuda = this.add.text(480, 695, '', ESTILO(16, '#9fb4ff')).setOrigin(0.5);
    if (/[?&]prueba/.test(location.search)) {
      this.add.text(10, 8, 'MODO PRUEBA (cambios del panel admin)', ESTILO(14, '#ffd34f')).setDepth(10);
    }
    this.tactil = window.esTactil();
    // En celular: el primer toque pone el juego en pantalla completa (si el navegador lo permite)
    if (this.tactil) {
      this.input.once('pointerup', () => {
        try { if (!this.scale.isFullscreen) this.scale.startFullscreen(); } catch (e) {}
      });
    }
    this.armarMenu();

    const k = this.input.keyboard;
    const si = (f) => () => { if (!this.esperandoTecla) f(); };
    k.on('keydown-UP', si(() => this.mover(-1)));
    k.on('keydown-DOWN', si(() => this.mover(1)));
    k.on('keydown-LEFT', si(() => this.cambiar(-1)));
    k.on('keydown-RIGHT', si(() => this.cambiar(1)));
    k.on('keydown-ENTER', si(() => this.aceptar()));
    k.on('keydown-SPACE', si(() => this.aceptar()));
    k.on('keydown-ESC', si(() => this.volver()));
  }

  // ---------- armado de cada pantalla del menu ----------
  armarMenu() {
    this.items.forEach((t) => t.destroy());
    this.items = [];
    this.titulo.setVisible(this.modo !== 'controles');

    if (this.modo === 'principal') {
      this.ayuda.setText(this.tactil ? 'Tocá una opción' : 'Flechas para elegir  ·  ENTER para aceptar');
      this.ids = ['solo', 'dea2', 'opciones'];
      this.crearOpciones(['UN JUGADOR', 'DE A 2 (ONLINE)', 'OPCIONES'], 488, 56, 36);
    } else if (this.modo === 'dea2') {
      this.ayuda.setText(this.tactil ? 'Tocá una opción' : 'Flechas para elegir  ·  ENTER para aceptar  ·  ESC vuelve');
      this.items.push(this.add.text(480, 448, 'DE A 2 · CADA UNO EN SU CELULAR O COMPU', ESTILO(20, '#ffd34f')).setOrigin(0.5));
      this.ids = ['crear', 'unirse', 'volver'];
      this.crearOpciones(['CREAR PARTIDA', 'UNIRME CON CÓDIGO', 'VOLVER'], 500, 54, 32);
    } else if (this.modo === 'opciones') {
      this.ayuda.setText(this.tactil ? 'Tocá una opción para cambiarla' : '◀ ▶ cambian el valor  ·  ESC vuelve');
      this.items.push(this.add.text(480, 442, 'OPCIONES', ESTILO(24, '#ffd34f')).setOrigin(0.5));
      // en celular no se muestra "CONTROLES" (son para teclado)
      this.ids = this.tactil ? ['vidas', 'dificultad', 'fuego', 'volver'] : ['vidas', 'dificultad', 'fuego', 'controles', 'volver'];
      const dif = window.JUEGO.config.dificultades[this.opc.dificultad];
      const textos = {
        vidas: 'VIDAS:  ◀ ' + this.opc.vidas + ' ▶',
        // la dificultad cambia la fuerza de los enemigos y multiplica los puntos de la partida
        dificultad: 'DIFICULTAD:  ◀ ' + dif.nombre + ' ▶  (puntos x' + dif.puntos + ')',
        // fuego amigo: de a 2, las piñas y patadas también lastiman al compañero
        fuego: 'FUEGO AMIGO:  ◀ ' + (this.opc.fuegoAmigo ? 'SÍ' : 'NO') + ' ▶',
        controles: 'CONTROLES',
        volver: 'VOLVER'
      };
      this.crearOpciones(this.ids.map((id) => textos[id]), 480, 44, 26);
    } else {
      this.ayuda.setText(this.esperandoTecla ? 'Presioná la tecla nueva  ·  ESC cancela'
        : '◀ ▶ eligen tecla 1 o 2  ·  ENTER cambia  ·  SUPR borra  ·  ESC vuelve');
      this.items.push(this.add.text(480, 50, 'CONTROLES', ESTILO(34, '#ffd34f')).setOrigin(0.5));
      this.items.push(this.add.text(560, 100, 'TECLA 1', ESTILO(16, '#9fb4ff')).setOrigin(0.5));
      this.items.push(this.add.text(760, 100, 'TECLA 2', ESTILO(16, '#9fb4ff')).setOrigin(0.5));
      const acciones = Object.keys(window.JUEGO.CONTROLES_DEFECTO);
      const filas = acciones.map((acc) => ({ acc }));
      filas.push({ texto: 'RESTAURAR TECLAS' }, { texto: 'VOLVER' });
      filas.forEach((f, i) => {
        const y = 145 + i * 52;
        let txt;
        if (f.acc) {
          txt = this.add.text(380, y, JUEGO.NOMBRES_ACCION[f.acc], ESTILO(24, '#5ff4ff')).setOrigin(1, 0.5);
          const c = this.opc.controles[f.acc];
          txt.teclas = [0, 1].map((n) => {
            const esperando = this.esperandoTecla && this.sel === i && this.col === n;
            return this.add.text(560 + n * 200, y, esperando ? '...' : nombreTecla(c[n]), ESTILO(24, '#ffffff')).setOrigin(0.5)
              .setInteractive({ useHandCursor: true })
              .on('pointerdown', () => { if (!this.esperandoTecla) { this.sel = i; this.col = n; this.aceptar(); } });
          });
          txt.teclas.forEach((t) => this.items.push(t));
        } else {
          txt = this.add.text(480, y + 10, f.texto, ESTILO(24, '#5ff4ff')).setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => { if (!this.esperandoTecla) { this.sel = i; this.aceptar(); } });
        }
        txt.indice = i;
        txt.accion = f.acc;
        this.items.push(txt);
      });
    }
    const n = this.opcionesVisibles().length;
    if (this.sel >= n) this.sel = 0;
    this.marcar();
  }

  crearOpciones(textos, y0, paso, tam) {
    textos.forEach((t, i) => {
      const txt = this.add.text(480, y0 + i * paso, t, ESTILO(tam, '#5ff4ff'))
        .setOrigin(0.5).setInteractive({ useHandCursor: true });
      txt.on('pointerover', () => { if (!this.esperandoTecla) { this.sel = i; this.marcar(); } });
      txt.on('pointerdown', () => { if (!this.esperandoTecla) { this.sel = i; this.aceptar(true); } });
      txt.indice = i;
      this.items.push(txt);
    });
  }

  opcionesVisibles() { return this.items.filter((t) => t.indice !== undefined); }

  marcar() {
    const lista = this.opcionesVisibles();
    lista.forEach((t, i) => {
      t.setColor(i === this.sel ? '#ffffff' : '#5ff4ff');
      if (t.teclas) t.teclas.forEach((tk, n) => tk.setColor(i === this.sel && n === this.col ? '#ff4fd8' : '#ffffff'));
    });
    const t = lista[this.sel];
    if (!t) return;
    const x = t.originX === 1 ? t.x - t.width : t.x - t.width / 2;
    this.cursor.setPosition(x - 14, t.y);
  }

  // ---------- navegacion ----------
  mover(d) {
    const n = this.opcionesVisibles().length;
    this.sel = (this.sel + d + n) % n;
    Sonido.menu();
    this.marcar();
  }

  cambiar(d, circular) {
    if (this.modo === 'opciones') {
      const id = this.ids[this.sel];
      if (id === 'vidas') {
        // con el dedo (circular) da la vuelta: 1, 2, ... 9, 1
        this.opc.vidas = circular ? (this.opc.vidas % 9) + 1 : Phaser.Math.Clamp(this.opc.vidas + d, 1, 9);
      } else if (id === 'dificultad') {
        const L = window.JUEGO.DIFICULTADES, i = L.indexOf(this.opc.dificultad);
        // con el dedo da la vuelta: FÁCIL, NORMAL, DIFÍCIL, FÁCIL...
        this.opc.dificultad = circular ? L[(i + 1) % L.length] : L[Phaser.Math.Clamp(i + d, 0, L.length - 1)];
      } else if (id === 'fuego') this.opc.fuegoAmigo = !this.opc.fuegoAmigo;
      else return;
      guardarOpciones(this.opc);
      Sonido.menu();
      this.armarMenu();
    } else if (this.modo === 'controles') {
      this.col = this.col === 0 ? 1 : 0;
      Sonido.menu();
      this.marcar();
    }
  }

  volver() {
    if (this.modo === 'opciones') { this.modo = 'principal'; this.sel = 2; }
    else if (this.modo === 'dea2') { this.modo = 'principal'; this.sel = 1; }
    else if (this.modo === 'controles') { this.modo = 'opciones'; this.sel = this.ids.indexOf('controles') >= 0 ? 3 : 0; }
    else return;
    Sonido.menu();
    this.armarMenu();
  }

  aceptar(conMouse) {
    Sonido.activar();
    const id = this.ids && this.ids[this.sel];
    if (this.modo === 'principal') {
      if (id === 'solo') this.irA('elegir', { modo: 'solo' });
      else if (id === 'dea2') { this.modo = 'dea2'; this.sel = 0; Sonido.menu(); this.armarMenu(); }
      else { this.modo = 'opciones'; this.sel = 0; Sonido.menu(); this.armarMenu(); }
    } else if (this.modo === 'dea2') {
      if (id === 'crear') this.irA('elegir', { modo: 'anfitrion' });
      else if (id === 'unirse') {
        // el codigo se escribe en una ventanita del navegador (anda igual en compu y en celular)
        const codigo = (window.prompt('Escribí el código de 4 números que te pasaron:') || '').replace(/\D/g, '');
        if (codigo.length === 4) this.irA('sala', { rol: 'invitado', codigo });
        else if (codigo) Sonido.herida();
      } else this.volver();
    } else if (this.modo === 'opciones') {
      const id = this.ids[this.sel];
      if (id === 'controles') { this.modo = 'controles'; this.sel = 0; this.col = 0; Sonido.menu(); this.armarMenu(); }
      else if (id === 'volver') this.volver();
      else this.cambiar(1, conMouse);
    } else {
      const fila = this.opcionesVisibles()[this.sel];
      if (fila.accion) this.esperarTecla(fila.accion);
      else if (this.sel === Object.keys(JUEGO.CONTROLES_DEFECTO).length) {
        this.opc.controles = controlesDefecto(); guardarOpciones(this.opc); Sonido.elegir(); this.armarMenu();
      } else this.volver();
    }
  }

  irA(escena, datos) {
    Sonido.elegir();
    this.registry.set('opciones', this.opc);
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(escena, datos));
  }

  // Espera la proxima tecla y la asigna a la accion (columna this.col)
  esperarTecla(acc) {
    this.esperandoTecla = true;
    Sonido.menu();
    this.armarMenu();
    this.time.delayedCall(120, () => {
      const alApretar = (ev) => {
        const codigo = ev.keyCode;
        if (codigo === 27) { /* ESC cancela */ }
        else if (codigo === 46 || codigo === 8) { this.opc.controles[acc][this.col] = 0; }
        else {
          // si la tecla ya estaba en otra accion, se la saca de ahi
          for (const a in this.opc.controles) {
            this.opc.controles[a] = this.opc.controles[a].map((c) => (c === codigo ? 0 : c));
          }
          this.opc.controles[acc][this.col] = codigo;
        }
        guardarOpciones(this.opc);
        Sonido.elegir();
        this.time.delayedCall(100, () => { this.esperandoTecla = false; this.armarMenu(); });
      };
      this.input.keyboard.once('keydown', alApretar);
    });
  }
}

class EscenaHistoria extends Phaser.Scene {
  constructor() { super('historia'); }
  create() {
    const C = window.JUEGO.config;
    const opc = this.registry.get('opciones') || leerOpciones();
    // Phaser reutiliza la misma escena en cada partida: hay que reiniciar esta marca
    // (si no, la segunda vez la historia nunca pasaba al nivel)
    this.yendo = false;
    this.add.image(480, 0, 'fondojugando').setOrigin(0.5, 0);
    this.add.rectangle(480, 360, 960, 720, 0x000000, 0.72);
    this.lineas = (C.textos.historia || []).concat([textoControles(opc.controles)]);
    this.i = -1;
    this.texto = this.add.text(480, 330, '', ESTILO(28)).setOrigin(0.5);
    this.texto.setWordWrapWidth(900);
    const tactil = window.esTactil();
    this.add.text(480, 680, tactil ? 'Tocá la pantalla para seguir' : 'ENTER: seguir  ·  ESC: saltar historia', ESTILO(16, '#9fb4ff')).setOrigin(0.5);
    // boton para saltar la historia (sirve con mouse y con el dedo)
    const saltar = this.add.text(940, 24, 'SALTAR ▶▶', ESTILO(22, '#ffd34f')).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    saltar.on('pointerdown', (p, x, y, ev) => { ev.stopPropagation(); this.empezar(); });
    this.cameras.main.fadeIn(400);
    this.siguiente();
    this.input.keyboard.on('keydown-ENTER', () => this.siguiente());
    this.input.keyboard.on('keydown-SPACE', () => this.siguiente());
    this.input.keyboard.on('keydown-ESC', () => this.empezar());
    this.input.on('pointerdown', (p, sobre) => { if (!sobre.includes(saltar)) this.siguiente(); });
  }
  siguiente() {
    this.i++;
    if (this.i >= this.lineas.length) return this.empezar();
    Sonido.menu();
    this.texto.setText(this.lineas[this.i]).setAlpha(0);
    this.texto.setFontSize(this.i === this.lineas.length - 1 ? 24 : 28);
    this.tweens.add({ targets: this.texto, alpha: 1, duration: 350 });
  }
  empezar() {
    if (this.yendo) return; this.yendo = true;
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('nivel', { nivel: 0 }));
  }
}

// Imagen "parado" de un personaje jugable, con los pies en (x, y) y el cuerpo de "alto" pixeles
function imagenPersonaje(scene, tipo, x, y, alto) {
  const m = window.SPRITE_META[tipo];
  return scene.add.image(x, y, tipo + '_parado').setOrigin(m.parado.foot / m.parado.w, 1).setScale(alto / (m._refH || m.parado.h));
}

// Cambia "Angie" por el/los personajes que jugaron (ej. "LULA" o "ANGIE Y LULA") en los textos de final
function textoConNombres(texto, tipos) {
  if (tipos.length === 1 && tipos[0] === 'angie') return texto;
  const may = nombresJugadores(tipos);
  const tit = may.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()).replace(' Y ', ' y ');
  texto = texto.replace(/ANGIE/g, may).replace(/Angie/g, tit);
  if (tipos.length > 1) {
    // de a 2: "ganaste" -> "ganaron", "vas a" -> "van a", "no se rinde" -> "no se rinden"
    texto = texto.replace(/GANASTE/g, 'GANARON').replace(/ganaste/g, 'ganaron')
      .replace(/\bVas a\b/g, 'Van a').replace(/\bvas a\b/g, 'van a').replace(/no se rinde\b/g, 'no se rinden');
  }
  return texto;
}

// Elegir personaje (un jugador, o el anfitrion antes de crear la partida online)
class EscenaElegir extends Phaser.Scene {
  constructor() { super('elegir'); }
  create(data) {
    this.modo = data.modo;                         // 'solo' | 'anfitrion'
    this.opc = this.registry.get('opciones') || leerOpciones();
    this.tipos = window.JUEGO.JUGABLES;
    this.sel = Math.max(0, this.tipos.indexOf(this.opc.personaje));
    this.yendo = false;
    fondoEstrellas(this);
    this.cameras.main.fadeIn(300);
    this.add.text(480, 56, 'ELEGÍ TU PERSONAJE', ESTILO(40, '#ffd34f')).setOrigin(0.5);
    if (this.modo === 'anfitrion') this.add.text(480, 104, 'La otra persona va a jugar con el otro personaje', ESTILO(18, '#9fb4ff')).setOrigin(0.5);
    this.cartas = this.tipos.map((t, i) => {
      const x = 300 + i * 360;
      const marco = this.add.rectangle(x, 380, 300, 440, 0xffffff, 0.06).setInteractive({ useHandCursor: true });
      const img = imagenPersonaje(this, t, x, 560, 250);
      const nombre = this.add.text(x, 615, window.JUEGO.config.personajes[t].nombre, ESTILO(34, COLOR_JUGADOR[t] || '#ffffff')).setOrigin(0.5, 0.5);
      marco.on('pointerover', () => { this.sel = i; this.marcar(); });
      marco.on('pointerdown', () => { this.sel = i; this.marcar(); this.aceptar(); });
      return { marco, img, nombre, escala: img.scale };
    });
    const tactil = window.esTactil();
    this.add.text(480, 690, tactil ? 'Tocá un personaje' : '◀ ▶ elegir  ·  ENTER aceptar  ·  ESC volver', ESTILO(16, '#9fb4ff')).setOrigin(0.5);
    const k = this.input.keyboard;
    k.on('keydown-LEFT', () => this.mover(-1));
    k.on('keydown-RIGHT', () => this.mover(1));
    k.on('keydown-A', () => this.mover(-1));
    k.on('keydown-D', () => this.mover(1));
    k.on('keydown-ENTER', () => this.aceptar());
    k.on('keydown-SPACE', () => this.aceptar());
    k.on('keydown-ESC', () => { if (!this.yendo) this.scene.start('menu'); });
    this.marcar();
  }
  mover(d) {
    this.sel = (this.sel + d + this.tipos.length) % this.tipos.length;
    Sonido.menu();
    this.marcar();
  }
  marcar() {
    this.cartas.forEach((c, i) => {
      const si = i === this.sel;
      c.marco.setStrokeStyle(si ? 5 : 3, si ? 0xff4fd8 : 0x5ff4ff, si ? 1 : 0.35);
      c.img.setScale(c.escala * (si ? 1.06 : 1)).setAlpha(si ? 1 : 0.55);
      c.nombre.setAlpha(si ? 1 : 0.55);
    });
  }
  aceptar() {
    if (this.yendo) return;
    this.yendo = true;
    const tipo = this.tipos[this.sel];
    this.opc.personaje = tipo;
    guardarOpciones(this.opc);
    this.registry.set('opciones', this.opc);
    this.registry.set('personaje', tipo);
    Sonido.elegir();
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () =>
      this.scene.start(this.modo === 'solo' ? 'historia' : 'sala', { rol: 'anfitrion' }));
  }
}

// Sala de espera del juego online: el anfitrion muestra el codigo, el invitado se conecta con ese codigo
class EscenaSala extends Phaser.Scene {
  constructor() { super('sala'); }
  create(data) {
    this.yendo = false;
    this.fuego = false;
    const C = window.JUEGO.config;
    const nombre = (t) => C.personajes[t].nombre;
    fondoEstrellas(this);
    this.cameras.main.fadeIn(300);
    this.add.text(480, 70, 'DE A 2 (ONLINE)', ESTILO(40, '#ffd34f')).setOrigin(0.5);
    this.titCodigo = this.add.text(480, 165, '', ESTILO(24, '#9fb4ff')).setOrigin(0.5);
    this.codigoTxt = this.add.text(480, 240, '', ESTILO(96, '#5ff4ff')).setOrigin(0.5);
    this.texto = this.add.text(480, 440, '', ESTILO(24)).setOrigin(0.5).setWordWrapWidth(880);
    const volver = this.add.text(480, 650, 'VOLVER', ESTILO(30, '#5ff4ff')).setOrigin(0.5).setInteractive({ useHandCursor: true });
    volver.on('pointerdown', () => this.salir());
    this.input.keyboard.on('keydown-ESC', () => this.salir());

    const error = (msg) => {
      if (this.yendo) return;
      RED.cerrar();
      Sonido.herida();
      this.titCodigo.setText(''); this.codigoTxt.setText('');
      this.texto.setColor('#ff4f6a').setText(msg + '\n\nTocá VOLVER para ir al menú.');
    };

    if (data.rol === 'anfitrion') {
      const mio = this.registry.get('personaje') || 'angie';
      const otro = mio === 'angie' ? 'lula' : 'angie';
      this.texto.setText('Creando partida...');
      RED.crear((codigo) => {
        this.titCodigo.setText('TU CÓDIGO');
        this.codigoTxt.setText(codigo);
        this.texto.setText('Pasale este código a la otra persona: tiene que entrar a\nDE A 2 (ONLINE) → UNIRME CON CÓDIGO\n\nVos: ' + nombre(mio) + '   ·   La otra persona: ' + nombre(otro) + '\n\nEsperando que se una...');
        this.tweens.add({ targets: this.codigoTxt, scale: 1.08, duration: 500, yoyo: true, repeat: -1 });
      }, () => {
        this.texto.setText('¡Se unió alguien! Conectando...');
        RED.enviar({ t: 'hola', anfitrion: mio, invitado: otro, fuego: !!this.opc().fuegoAmigo, dif: this.opc().dificultad });
      }, error);
      RED.oyente = (m) => { if (m.t === 'listo') this.conectados(mio, otro, true); };
    } else {
      this.texto.setText('Conectando a la partida ' + data.codigo + '...');
      RED.unirse(data.codigo, () => { this.texto.setText('Conectado. Esperando...'); }, error);
      RED.oyente = (m) => {
        if (m.t === 'lleno') error('Esa partida ya tiene 2 jugadores.');
        else if (m.t === 'hola') {
          this.registry.set('personaje', m.invitado);
          this.fuego = !!m.fuego;
          this.dif = m.dif;
          this.conectados(m.anfitrion, m.invitado, false);
          RED.enviar({ t: 'listo' });
        } else if (m.t === 'empezar') this.irAlNivel(m.tipos);
      };
    }
    RED.alCortarse = () => error('Se cortó la conexión.');
  }

  // tipos = [anfitrion, invitado]
  conectados(anf, inv, soyAnfitrion) {
    const C = window.JUEGO.config;
    Sonido.victoria();
    this.titCodigo.setText(''); this.codigoTxt.setText('¡CONECTADOS!').setFontSize(64);
    this.tweens.killTweensOf(this.codigoTxt); this.codigoTxt.setScale(1);
    const yo = soyAnfitrion ? anf : inv;
    const fuego = soyAnfitrion ? !!this.opc().fuegoAmigo : this.fuego;
    const dif = C.dificultades[(soyAnfitrion ? this.opc().dificultad : this.dif) || 'normal'] || C.dificultades.normal;
    this.texto.setText('Vas a jugar con ' + C.personajes[yo].nombre +
      '\nDificultad: ' + dif.nombre + '   ·   Fuego amigo: ' + (fuego ? 'SÍ' : 'NO') + '\n\n¡Prepárense!');
    imagenPersonaje(this, anf, 140, 620, 200);
    imagenPersonaje(this, inv, 820, 620, 200).setFlipX(true);
    if (soyAnfitrion) {
      this.time.delayedCall(2500, () => {
        if (!RED.activa()) return;
        RED.enviar({ t: 'empezar', tipos: [anf, inv] });
        this.irAlNivel([anf, inv]);
      });
    }
  }

  opc() { return this.registry.get('opciones') || leerOpciones(); }

  irAlNivel(tipos) {
    if (this.yendo) return;
    this.yendo = true;
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('nivel', { nivel: 0, tipos }));
  }

  salir() {
    if (this.yendo) return;
    RED.cerrar();
    this.scene.start('menu');
  }
}

class EscenaFinal extends Phaser.Scene {
  constructor() { super('final'); }
  create(data) {
    const T = window.JUEGO.config.textos;
    const gano = data.gano;
    const tipos = data.tipos || [this.registry.get('personaje') || 'angie'];
    const coop = !!data.coop;
    // la partida online termina aca: si el otro se va, no pasa nada
    RED.oyente = null;
    RED.alCortarse = null;
    this.add.image(480, 0, 'fondojugando').setOrigin(0.5, 0);
    this.add.rectangle(480, 360, 960, 720, 0x000000, gano ? 0.45 : 0.7);
    if (gano) {
      Sonido.victoria();
      tipos.forEach((t, i) => {
        const x = tipos.length > 1 ? 380 + i * 200 : 480;
        const img = imagenPersonaje(this, t, x, 640, 190);
        if (i === 1) img.setFlipX(true);
        this.tweens.add({ targets: img, y: 620, duration: 350, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: i * 175 });
      });
      const t = this.add.text(480, 170, textoConNombres(T.victoria, tipos), ESTILO(38, '#ffd34f')).setOrigin(0.5);
      t.setWordWrapWidth(900);
      this.tweens.add({ targets: t, scale: 1.05, duration: 600, yoyo: true, repeat: -1 });
      for (let i = 0; i < 70; i++) {
        const c = this.add.rectangle(Phaser.Math.Between(0, 960), Phaser.Math.Between(-700, 0), 6, 10,
          Phaser.Utils.Array.GetRandom([0xff4fd8, 0x5ff4ff, 0xffd34f, 0xffffff]));
        this.tweens.add({ targets: c, y: 760, angle: 360, duration: Phaser.Math.Between(2500, 5000), repeat: -1, delay: Phaser.Math.Between(0, 2000) });
      }
    } else {
      Sonido.derrota();
      this.add.text(480, 280, 'GAME OVER', ESTILO(72, '#ff4f6a')).setOrigin(0.5);
      this.add.text(480, 370, textoConNombres(T.derrota, tipos), ESTILO(24)).setOrigin(0.5).setWordWrapWidth(900);
    }
    this.add.text(480, 270 + (gano ? 0 : 160), 'PUNTOS: ' + (data.puntos || 0), ESTILO(26, '#5ff4ff')).setOrigin(0.5);
    // al perder, se muestra lo que se descontó por daño y vidas
    const r = data.resumen;
    if (!gano && r && (r.restaDanio || r.restaVidas)) {
      this.add.text(480, 470, 'Daño recibido -' + r.restaDanio + '   ·   Vidas perdidas -' + r.restaVidas,
        ESTILO(18, '#ff4f6a')).setOrigin(0.5);
    }
    // de a 2 no se puede reintentar directo (hay que volver a armar la partida)
    const reintentar = !gano && !coop;
    const ayuda = window.esTactil() ? 'Tocá la pantalla para volver al menú'
      : (reintentar ? 'ENTER: reintentar  ·  ESC: menú' : 'ENTER: volver al menú');
    this.add.text(480, 690, ayuda, ESTILO(18, '#9fb4ff')).setOrigin(0.5);
    this.time.delayedCall(800, () => {
      this.input.keyboard.on('keydown-ENTER', () => this.scene.start(reintentar ? 'nivel' : 'menu', { nivel: 0 }));
      this.input.keyboard.on('keydown-ESC', () => this.scene.start('menu'));
      this.input.on('pointerdown', () => this.scene.start('menu'));
    });
  }
}
