// Escenas: carga, menu de inicio (START / OPCIONES / CONTROLES), historia y pantallas finales.
const ESTILO = (tam, color) => ({
  fontFamily: '"Arial Black", Impact, sans-serif', fontSize: tam + 'px', color: color || '#ffffff',
  stroke: '#000000', strokeThickness: Math.max(3, Math.round(tam / 6)), align: 'center'
});

function controlesDefecto() { return JSON.parse(JSON.stringify(window.JUEGO.CONTROLES_DEFECTO)); }

function leerOpciones() {
  let o = { vidas: 3, modoDios: false, controles: controlesDefecto() };
  try {
    const g = JSON.parse(localStorage.getItem('trav_opciones'));
    if (g) {
      o.vidas = g.vidas || o.vidas;
      o.modoDios = !!g.modoDios;
      if (g.controles) for (const acc in o.controles) if (Array.isArray(g.controles[acc])) o.controles[acc] = g.controles[acc];
    }
  } catch (e) {}
  return o;
}
function guardarOpciones(o) {
  try { localStorage.setItem('trav_opciones', JSON.stringify(o)); } catch (e) {}
}

function textoControles(ctrl) {
  if (window.esTactil()) {
    return 'CONTROLES\n\nJoystick (izquierda): caminar\nPIÑA: piña (3 seguidas = combo)\nPATADA: patada\nSALTO: saltar (¡y patada en el aire!)\nII: pausa';
  }
  const t = (acc) => ctrl[acc].filter((c) => c).map(nombreTecla).join(' o ');
  return 'CONTROLES\n\n' +
    t('izquierda') + ' / ' + t('derecha') + ' / ' + t('arriba') + ' / ' + t('abajo') + ': caminar\n' +
    t('pinia') + ': piña (3 seguidas = combo)\n' +
    t('patada') + ': patada\n' +
    t('salto') + ': saltar (¡patada en el aire!)\n' +
    t('pausa') + ': pausa';
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
      this.ids = ['start', 'opciones'];
      this.crearOpciones(['START', 'OPCIONES'], 500, 58, 40);
    } else if (this.modo === 'opciones') {
      this.ayuda.setText(this.tactil ? 'Tocá una opción para cambiarla' : '◀ ▶ cambian el valor  ·  ESC vuelve');
      this.items.push(this.add.text(480, 448, 'OPCIONES', ESTILO(26, '#ffd34f')).setOrigin(0.5));
      // en celular no se muestra "CONTROLES" (son para teclado)
      this.ids = this.tactil ? ['vidas', 'dios', 'volver'] : ['vidas', 'dios', 'controles', 'volver'];
      const textos = {
        vidas: 'VIDAS:  ◀ ' + this.opc.vidas + ' ▶',
        dios: 'MODO DIOS:  ◀ ' + (this.opc.modoDios ? 'SÍ' : 'NO') + ' ▶',
        controles: 'CONTROLES',
        volver: 'VOLVER'
      };
      this.crearOpciones(this.ids.map((id) => textos[id]), 498, 50, 28);
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
      } else if (id === 'dios') this.opc.modoDios = !this.opc.modoDios;
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
    if (this.modo === 'opciones') { this.modo = 'principal'; this.sel = 1; }
    else if (this.modo === 'controles') { this.modo = 'opciones'; this.sel = 2; }
    else return;
    Sonido.menu();
    this.armarMenu();
  }

  aceptar(conMouse) {
    Sonido.activar();
    if (this.modo === 'principal') {
      if (this.sel === 0) {
        Sonido.elegir();
        this.registry.set('opciones', this.opc);
        this.cameras.main.fadeOut(400, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('historia'));
      } else {
        this.modo = 'opciones'; this.sel = 0; Sonido.menu(); this.armarMenu();
      }
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

class EscenaFinal extends Phaser.Scene {
  constructor() { super('final'); }
  create(data) {
    const T = window.JUEGO.config.textos;
    const gano = data.gano;
    this.add.image(480, 0, 'fondojugando').setOrigin(0.5, 0);
    this.add.rectangle(480, 360, 960, 720, 0x000000, gano ? 0.45 : 0.7);
    if (gano) {
      Sonido.victoria();
      const angie = this.add.image(480, 640, 'angie_parado').setOrigin(0.5, 1).setScale(0.75);
      this.tweens.add({ targets: angie, y: 620, duration: 350, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const t = this.add.text(480, 170, T.victoria, ESTILO(38, '#ffd34f')).setOrigin(0.5);
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
      this.add.text(480, 370, T.derrota, ESTILO(24)).setOrigin(0.5).setWordWrapWidth(900);
    }
    this.add.text(480, 270 + (gano ? 0 : 160), 'PUNTOS: ' + (data.puntos || 0), ESTILO(26, '#5ff4ff')).setOrigin(0.5);
    const ayuda = window.esTactil() ? 'Tocá la pantalla para volver al menú'
      : (gano ? 'ENTER: volver al menú' : 'ENTER: reintentar  ·  ESC: menú');
    this.add.text(480, 690, ayuda, ESTILO(18, '#9fb4ff')).setOrigin(0.5);
    this.time.delayedCall(800, () => {
      this.input.keyboard.on('keydown-ENTER', () => this.scene.start(gano ? 'menu' : 'nivel', { nivel: 0 }));
      this.input.keyboard.on('keydown-ESC', () => this.scene.start('menu'));
      this.input.on('pointerdown', () => this.scene.start('menu'));
    });
  }
}
