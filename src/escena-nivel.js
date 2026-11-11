// Escena de un nivel: oleadas de enemigos y jefe, segun src/config-juego.js (niveles[]).
// Sirve para 1 jugador y para el cooperativo online (ver src/red.js):
//  - un jugador / anfitrion: el juego corre aca.
//  - invitado: no simula nada, dibuja lo que le manda el anfitrion ("espejo") y le manda sus teclas.
const COLOR_JUGADOR = { angie: '#ff4fd8', lula: '#ffd34f' };
const ENVIOS_POR_SEG = 20;

// nombre para los carteles (ej. "ANGIE" o "ANGIE Y LULA")
function nombresJugadores(tipos) {
  return tipos.map((t) => (window.JUEGO.config.personajes[t] || {}).nombre || t.toUpperCase()).join(' Y ');
}

class EscenaNivel extends Phaser.Scene {
  constructor() { super('nivel'); }

  // data: { nivel, puntos, jugadores: [{tipo, vidas}] }  (vienen del nivel anterior)
  create(data) {
    const J = window.JUEGO, C = J.config;
    data = data || {};
    this.opc = this.registry.get('opciones') || leerOpciones();
    this.red = RED.rol;                       // null | 'anfitrion' | 'invitado'
    this.esInvitado = this.red === 'invitado';
    this.numNivel = data.nivel || 0;
    this.nivel = C.niveles[this.numNivel];
    this.puntos = data.puntos || 0;
    this.oleada = 0;
    this.fase = 'intro';          // intro | oleada | esperando | boss | fin
    this.enemigos = [];
    this.balas = [];
    this.jugadores = [];
    this.pendientes = 0;
    this.hitStop = 0;
    this.pausado = false;
    this.ultimoAtaqueEnemigo = 0;
    this.enemigoVisto = null;
    this.enemigoVistoT = 0;
    this.boss = null;
    this.idSiguiente = 1;
    // para el puntaje del nivel: cronometro, vida perdida y vidas perdidas
    this.tiempo = 0;
    this.danioRecibido = 0;
    this.vidasPerdidas = 0;
    this.puntosInicio = this.puntos;   // los que venian de niveles anteriores
    this.puntosEnemigos = 0;
    this.puntosCombos = 0;
    this.combosHechos = 0;
    // dificultad: la elige el que juega solo o el que crea la partida online
    this.claveDif = this.opc.dificultad || 'normal';
    this.dif = C.dificultades[this.claveDif] || C.dificultades.normal;

    // la zona caminable depende del fondo de cada nivel
    J.PISO_MIN = this.nivel.pisoMin || 615;
    J.PISO_MAX = this.nivel.pisoMax || 712;

    const fondo = this.textures.exists(this.nivel.fondo) ? this.nivel.fondo : 'fondojugando';
    this.add.image(480, 0, fondo).setOrigin(0.5, 0).setDisplaySize(960, 960 * this.textures.get(fondo).getSourceImage().height / this.textures.get(fondo).getSourceImage().width).setDepth(-1000);

    this.armarControles();
    this.tactil = window.esTactil() ? new ControlesTactiles(this) : null;
    this.cameras.main.fadeIn(400);
    const titulo = 'NIVEL ' + (this.numNivel + 1) + '\n' + this.nivel.nombre.toUpperCase();

    if (this.esInvitado) {
      this.crearHUD(data.tipos || ['angie', 'lula']);
      this.anuncio(titulo, '#ff4fd8', 1600, null, true);
      this.prepararEspejo();
      return;
    }

    // ---- jugadores (1, o 2 en el cooperativo) ----
    const lista = data.jugadores || this.jugadoresIniciales();
    lista.forEach((d, i) => {
      const P = C.personajes[d.tipo];
      const y = (J.PISO_MIN + J.PISO_MAX) / 2 + (lista.length > 1 ? (i === 0 ? -18 : 18) : 0);
      const j = new Luchador(this, d.tipo, 260 - i * 90, y, { alto: P.alto, hp: P.hp, dir: 1 });
      j.esJugador = true;
      j.cfg = P;
      j.vidas = d.vidas > 0 ? d.vidas : 1;   // si quedo afuera en el nivel anterior, vuelve con 1 vida
      j.remoto = !!d.remoto;
      j.control = j.remoto ? this.entradaRemota() : this.entradaLocal();
      j.combo = 0; j.ultimoPunio = -10;
      j.alQuedarSinVida = () => this.jugadorSinVida(j);
      this.jugadores.push(j);
    });

    // fuego amigo: solo tiene sentido de a 2
    this.fuegoAmigo = !!this.opc.fuegoAmigo && this.jugadores.length > 1;
    if (this.red === 'anfitrion') this.prepararAnfitrion();
    this.crearHUD(this.jugadores.map((j) => j.tipo));
    this.anuncio(titulo, '#ff4fd8', 1600, null, true);   // el invitado muestra el suyo
    if (this.nivel.intro) this.time.delayedCall(1900, () => this.anuncio(this.nivel.intro, '#ffffff', 1800, 30));
    this.time.delayedCall(this.nivel.intro ? 4000 : 2100, () => this.siguientePaso());
  }

  jugadoresIniciales() {
    const elegido = this.registry.get('personaje') || 'angie';
    const v = this.opc.vidas;
    if (this.red === 'anfitrion') {
      const otro = elegido === 'angie' ? 'lula' : 'angie';
      return [{ tipo: elegido, vidas: v }, { tipo: otro, vidas: v, remoto: true }];
    }
    return [{ tipo: elegido, vidas: v }];
  }

  // ---------------- Controles ----------------
  armarControles() {
    const ctrl = this.opc.controles || window.JUEGO.CONTROLES_DEFECTO;
    this.teclas = {};
    this.mapaTeclas = {};
    this.buffer = {};
    for (const acc in window.JUEGO.CONTROLES_DEFECTO) {
      const codigos = (ctrl[acc] || window.JUEGO.CONTROLES_DEFECTO[acc]).filter((c) => c);
      this.teclas[acc] = codigos.map((c) => this.input.keyboard.addKey(c));
      codigos.forEach((c) => { this.mapaTeclas[c] = acc; });
    }
    // Se guardan las teclas apretadas en un "buffer" para no perder toques muy rapidos
    const alApretar = (ev) => { const acc = this.mapaTeclas[ev.keyCode]; if (acc) this.buffer[acc] = true; };
    this.input.keyboard.on('keydown', alApretar);
    this.events.once('shutdown', () => this.input.keyboard.off('keydown', alApretar));
  }
  apretada(acc) {
    return this.teclas[acc].some((k) => k.isDown) || (this.tactil ? this.tactil.apretada(acc) : false);
  }
  recienApretada(acc) {
    const t = this.tactil ? this.tactil.recienApretada(acc) : false;
    const r = !!this.buffer[acc] || t;
    this.buffer[acc] = false;
    return r;
  }
  // Control del jugador de este dispositivo (teclado o pantalla tactil)
  entradaLocal() {
    return { apretada: (a) => this.apretada(a), recienApretada: (a) => this.recienApretada(a) };
  }
  // Control del invitado: lo que llega por internet
  // (los botones llegan en una fila, en orden: si llegan varios juntos se usan de a uno por cuadro,
  //  asi no se pierde ninguna piña de un combo)
  entradaRemota() {
    const e = this.remota = { dir: {}, fila: [] };
    return {
      apretada: (a) => !!e.dir[a],
      recienApretada: (a) => {
        if (e.usado || e.fila[0] !== a) return false;   // uno por cuadro (usado se limpia en update)
        e.fila.shift(); e.usado = true; return true;
      }
    };
  }

  // ---------------- Cooperativo: anfitrion ----------------
  prepararAnfitrion() {
    RED.enJuego = true;
    this.envioT = 0;
    RED.oyente = (m) => {
      if (!this.remota) return;
      if (m.t === 'in') {
        ['izquierda', 'derecha', 'arriba', 'abajo'].forEach((a, i) => { this.remota.dir[a] = !!m.h[i]; });
      } else if (m.t === 'k') {
        if (m.a === 'pausa') this.pausar();
        else if (this.remota.fila.length < 6) this.remota.fila.push(m.a);
      }
    };
    RED.alCortarse = () => {
      const j = this.jugadores.find((x) => x.remoto);
      RED.cerrar();
      if (!j || j.fuera) return;
      this.anuncio(j.cfg.nombre + ' SE DESCONECTÓ', '#ff4f6a', 2000);
      j.fuera = true;
      if (j.estado !== 'muerto') j.morir();
      this.revisarGameOver();
    };
    // los temblores de camara tambien se ven en el otro dispositivo
    const cam = this.cameras.main, temblar = cam.shake.bind(cam);
    cam.shake = (d, i) => { RED.enviar({ t: 'sh', d, i }); return temblar(d, i); };
    this.events.once('shutdown', () => { RED.enJuego = false; });
  }

  // Estado del juego que se manda al invitado (numeros redondeados para que pese poco)
  enviarEstado() {
    const r = Math.round;
    const ent = (l) => [r(l.x), r(l.y), r(l.z), l.dir, l.poseActual, r(l.estado === 'caido' ? l.angulo : 0),
      Math.round((l.spr.visible ? l.spr.alpha : 0) * 100) / 100, r(l.hp), l.hpMax, this.time.now < (l.flashHasta || 0) ? 1 : 0];
    RED.enviar({
      t: 'e', f: this.fase, o: this.oleada, ti: r(this.tiempo * 10) / 10, p: this.puntos, pa: this.pausado ? 1 : 0,
      j: this.jugadores.map((j) => [j.tipo].concat(ent(j), [Math.max(0, j.vidas), j.fuera ? 1 : 0])),
      e: this.enemigos.map((e) => [e.id, e.tipo, e.alto, e.esBoss ? 1 : 0].concat(ent(e))),
      b: this.balas.map((b) => [r(b.x), r(b.y), r(b.altura)]),
      ev: this.enemigoVisto && this.enemigoVistoT > 0 ? this.enemigoVisto.id : 0,
      bo: this.boss ? this.boss.id : 0,
      jf: this.boss ? 1 : 0,
      df: this.claveDif
    });
  }

  // ---------------- Cooperativo: invitado ----------------
  prepararEspejo() {
    this.espejo = { j: [], e: {}, balas: [], estado: null };
    this.ultimoDir = '';
    this.dirT = 0;
    // mensajes que llegaron mientras se pasaba de la historia al nivel
    const pendientes = RED.cola || []; RED.cola = null;
    RED.oyente = (m) => this.recibir(m);
    pendientes.forEach((m) => this.recibir(m));
    RED.alCortarse = () => {
      RED.cerrar();
      this.anuncio('SE CORTÓ LA CONEXIÓN', '#ff4f6a', 2500, 40, true);
      this.time.delayedCall(3000, () => this.scene.start('menu'));
    };
  }

  recibir(m) {
    if (m.t === 'e') this.espejo.estado = m;
    else if (m.t === 'snd') RED.sonar(m.n);
    else if (m.t === 'an') this.anuncio(m.x, m.c, m.d, m.s, true);
    else if (m.t === 'fx') this.dibujarGolpe(m.x, m.y, m.f);
    else if (m.t === 'tf') this.textoFlotante(m.x, m.y, m.x2, m.c, true);
    else if (m.t === 'sh') this.cameras.main.shake(m.d, m.i);
    else if (m.t === 'res') this.mostrarResumen(m.r, null);
    else if (m.t === 'niv') {
      // siguiente nivel: primero su historia (si tiene), que la va pasando el anfitrion
      guardarMensajesRed();
      this.cameras.main.fade(500, 0, 0, 0, true);   // true: aunque todavia este apareciendo
      this.cameras.main.once('camerafadeoutcomplete', () =>
        this.scene.start('historia', { nivel: m.n, datosNivel: { nivel: m.n, tipos: m.tipos } }));
    } else if (m.t === 'fin') {
      // ganaron: primero la historia del final del ultimo nivel (la pasa el anfitrion)
      if (m.d.gano) guardarMensajesRed();
      const n = window.JUEGO.config.niveles.length;
      this.cameras.main.fade(500, 0, 0, 0, true);
      this.cameras.main.once('camerafadeoutcomplete', () =>
        m.d.gano ? this.scene.start('historia', { nivel: n, datosFinal: m.d }) : this.scene.start('final', m.d));
    }
  }

  // Manda las teclas del invitado y dibuja lo ultimo que llego del anfitrion
  actualizarEspejo(dt) {
    const dirs = ['izquierda', 'derecha', 'arriba', 'abajo'].map((a) => (this.apretada(a) ? 1 : 0));
    const clave = dirs.join('');
    this.dirT -= dt;
    if (clave !== this.ultimoDir || this.dirT <= 0) { RED.enviar({ t: 'in', h: dirs }); this.ultimoDir = clave; this.dirT = 0.25; }
    ['pinia', 'patada', 'salto', 'pausa'].forEach((a) => { if (this.recienApretada(a)) RED.enviar({ t: 'k', a }); });

    const s = this.espejo.estado;
    if (!s) return;
    const suave = Math.min(1, dt * 18);
    const mover = (l, d) => {
      // d = [x, y, z, dir, pose, angulo, alpha, hp, hpMax, flash]
      const salto = Math.abs(l.x - d[0]) > 150 || Math.abs(l.y - d[1]) > 80;
      l.x = salto ? d[0] : l.x + (d[0] - l.x) * suave;
      l.y = salto ? d[1] : l.y + (d[1] - l.y) * suave;
      l.z = salto ? d[2] : l.z + (d[2] - l.z) * suave;
      l.dir = d[3];
      if (d[4]) l.pose(d[4]);
      l.angulo = d[5];
      l.estado = d[5] ? 'caido' : 'libre';
      l.invul = 0;
      l.hp = d[7]; l.hpMax = d[8];
      l.sync();
      l.spr.alpha = d[6];
      l.spr.visible = d[6] > 0;
      l.sombra.visible = d[6] > 0;
      if (d[9]) l.spr.setTint(0xff7070); else l.spr.clearTint();
    };
    const crear = (tipo, d, alto) => {
      const l = new Luchador(this, tipo, d[0], d[1], { alto, hp: d[8] || 1, dir: d[3] });
      l.z = d[2];
      return l;
    };

    // jugadores
    s.j.forEach((d, i) => {
      let l = this.espejo.j[i];
      if (!l || l.tipo !== d[0]) {
        if (l) l.destruir();
        l = this.espejo.j[i] = crear(d[0], d.slice(1), window.JUEGO.config.personajes[d[0]].alto);
      }
      mover(l, d.slice(1, 11));
      l.vidas = d[11];
      l.fuera = !!d[12];
    });
    // enemigos: se crean los nuevos y se borran los que ya no estan
    const vistos = {};
    s.e.forEach((d) => {
      const id = d[0];
      vistos[id] = true;
      let l = this.espejo.e[id];
      if (!l) { l = this.espejo.e[id] = crear(d[1], d.slice(4), d[2]); l.id = id; l.esBoss = !!d[3]; l.cfg = window.JUEGO.config.personajes[d[1]]; }
      mover(l, d.slice(4, 14));
    });
    for (const id in this.espejo.e) {
      if (!vistos[id]) { this.espejo.e[id].destruir(); delete this.espejo.e[id]; }
    }
    // balas
    this.espejo.balas.forEach((b) => b.destroy());
    this.espejo.balas = s.b.map((b) => this.add.rectangle(b[0], b[1] - b[2], 18, 5, 0xffd34f).setDepth(b[1] + 1));

    // datos para el HUD
    this.puntos = s.p; this.tiempo = s.ti; this.oleada = s.o; this.fase = s.f;
    this.jugadores = this.espejo.j;
    this.boss = s.bo ? this.espejo.e[s.bo] || null : null;
    this.hayJefe = !!s.jf;
    if (s.df) this.dif = window.JUEGO.config.dificultades[s.df] || this.dif;
    if (this.boss && !this.textoBoss.visible) this.textoBoss.setText(this.boss.cfg.nombre).setVisible(true);
    this.enemigoVisto = s.ev ? this.espejo.e[s.ev] : null;
    this.enemigoVistoT = this.enemigoVisto ? 1 : 0;
    this.textoPausa.setVisible(!!s.pa);
    this.actualizarHUD(0);
  }

  // ---------------- Oleadas ----------------
  siguientePaso() {
    if (this.fase === 'fin') return;
    if (this.oleada < this.nivel.oleadas.length) this.lanzarOleada();
    else if (this.nivel.jefe && this.nivel.jefe.tipo) this.lanzarBoss();
    else this.nivelTerminado();
  }

  lanzarOleada() {
    const ol = this.nivel.oleadas[this.oleada];
    this.oleada++;
    this.fase = 'oleada';
    this.anuncio('OLEADA ' + this.oleada + ' / ' + this.nivel.oleadas.length, '#5ff4ff');
    const lista = ol.enemigos || [];
    this.pendientes = lista.length;
    lista.forEach((en) => {
      this.time.delayedCall((en.demora || 0) * 1000, () => {
        this.crearEnemigo(en.tipo, en.lado === 'derecha' ? 1050 : -90, false);
        this.pendientes--;
      });
    });
  }

  lanzarBoss() {
    const jefe = this.nivel.jefe;
    this.fase = 'boss';
    this.anuncio(jefe.anuncio || '¡CUIDADO!', '#ff4f6a', 2200);
    this.cameras.main.shake(400, 0.006);
    this.time.delayedCall(1800, () => {
      this.boss = this.crearEnemigo(jefe.tipo, jefe.lado === 'izquierda' ? -120 : 1080, true);
      this.textoBoss.setText(this.boss.cfg.nombre).setVisible(true);
    });
  }

  crearEnemigo(tipo, x, esJefe) {
    const J = window.JUEGO;
    const base = J.config.personajes[tipo];
    const cfg = Object.assign({}, base);
    if (esJefe) {
      const jefe = this.nivel.jefe;
      if (jefe.vida) cfg.hp = jefe.vida;
      if (jefe.alto) cfg.alto = jefe.alto;
    }
    // de a 2 los enemigos aguantan mas
    if (this.jugadores.length > 1) cfg.hp = Math.round(cfg.hp * (J.config.cooperativo.vidaEnemigos || 1));
    // dificultad: mas o menos vida y daño de los enemigos
    cfg.hp = Math.max(1, Math.round(cfg.hp * (this.dif.vidaEnemigos || 1)));
    const md = this.dif.danioEnemigos || 1;
    cfg.punio = Math.round(cfg.punio * md);
    cfg.patada = Math.round(cfg.patada * md);
    cfg.bala = Math.round(cfg.bala * md);
    const y = Phaser.Math.Between(J.PISO_MIN + 10, J.PISO_MAX - 10);
    const e = new Luchador(this, tipo, x, y, { alto: cfg.alto, hp: cfg.hp, dir: x < 480 ? 1 : -1 });
    e.id = this.idSiguiente++;
    e.cfg = cfg;
    e.esBoss = esJefe;
    e.alcance = cfg.alcance || 100;
    e.limitarX = false;
    e.cool = 1.0;
    e.offY = Phaser.Math.Between(-6, 6);
    this.enemigos.push(e);
    return e;
  }

  // ---------------- Bucle principal ----------------
  update(time, delta) {
    if (this.esInvitado) { this.actualizarEspejo(Math.min(delta / 1000, 0.05)); return; }

    if (this.red === 'anfitrion') {
      this.envioT -= delta / 1000;
      if (this.envioT <= 0) { this.envioT = 1 / ENVIOS_POR_SEG; this.enviarEstado(); }
    }
    if (this.jugadores.some((j) => !j.remoto && j.control.recienApretada('pausa'))) this.pausar();
    if (this.pausado) return;

    const dt = Math.min(delta / 1000, 0.05);
    // el cronometro corre desde la primera oleada hasta que termina el nivel (no cuenta la pausa)
    if (this.fase !== 'intro' && this.fase !== 'fin') this.tiempo += delta / 1000;
    if (this.hitStop > 0) { this.hitStop -= dt; return; }

    if (this.remota) this.remota.usado = false;
    for (const j of this.jugadores) { this.actualizarJugador(j, dt); j.fisica(dt); }

    for (const e of this.enemigos) { this.actualizarEnemigo(e, dt); e.fisica(dt); }
    this.separarEnemigos();
    this.actualizarBalas(dt);

    for (const j of this.jugadores) j.sync();
    for (const e of this.enemigos) e.sync();

    this.revisarMuertes();
    this.revisarProgreso();
    this.actualizarHUD(dt);
  }

  // ---------------- Jugadores ----------------
  actualizarJugador(a, dt) {
    const P = a.cfg, c = a.control;
    const izq = c.apretada('izquierda'), der = c.apretada('derecha');
    const arr = c.apretada('arriba'), aba = c.apretada('abajo');
    let punio = c.recienApretada('pinia');
    let patada = c.recienApretada('patada');
    const salto = c.recienApretada('salto');

    if (a.fuera) return;
    // si aprieta piña/patada mientras todavia esta pegando, se guarda para hacerlo apenas termine
    // (asi los combos salen aunque se apriete un poquito antes)
    // (se guardan hasta 2, en orden, para que no se pierda ninguna si se aprieta rapido)
    a.cola = a.cola || [];
    if (a.estado === 'ataque' && (punio || patada)) {
      if (punio && a.cola.length < 2) a.cola.push('punio');
      if (patada && a.cola.length < 2) a.cola.push('patada');
      punio = patada = false;
    }
    if (a.estado === 'libre' && a.cola.length) {
      if (!punio && !patada) { const sig = a.cola.shift(); punio = sig === 'punio'; patada = sig === 'patada'; }
      else a.cola.length = 0;
    }
    if (a.estado !== 'ataque' && a.estado !== 'libre') a.cola.length = 0;
    if (this.fase === 'fin' && a.estado === 'libre') { a.vx = 0; a.vy = 0; a.animarCaminar(dt, false); return; }
    if (a.actualizarComun(dt)) return;

    const mx = (der ? 1 : 0) - (izq ? 1 : 0);
    const my = (aba ? 1 : 0) - (arr ? 1 : 0);

    if (a.estado === 'libre') {
      a.vx = mx * P.vel;
      a.vy = my * P.velY;
      if (mx) a.dir = mx;
      a.animarCaminar(dt, mx || my);
      if (salto) {
        a.estado = 'aire'; a.vz = P.salto; a.z = 1; a.vy = 0;
        a.pateaAire = false; a.yaPateo = false; a.golpeadosAire = [];
        a.pose('salto'); Sonido.salto();
      } else if (punio) {
        this.ataqueJugador(a, 'punio');
      } else if (patada) {
        this.ataqueJugador(a, 'patada');
      }
    } else if (a.estado === 'aire') {
      a.vx = mx * P.vel * 0.9;
      if (mx) a.dir = mx;
      if ((patada || punio) && !a.yaPateo) {
        a.yaPateo = true; a.pateaAire = true; a.pose('patada'); Sonido.aire();
      }
      if (a.pateaAire) {
        const blancos = this.blancos(a).filter((e) => !a.golpeadosAire.includes(e));
        const pego = this.golpear(a, blancos, 115, P.patadaAire, true, 150);
        pego.forEach((e) => a.golpeadosAire.push(e));
      }
    } else if (a.estado === 'ataque') {
      this.secuencia(a, dt);
    }
  }

  // A quien le puede pegar un jugador: los enemigos y, con FUEGO AMIGO (opcion del que creo la partida),
  // tambien al otro jugador
  blancos(a) {
    if (!this.fuegoAmigo) return this.enemigos;
    return this.enemigos.concat(this.jugadores.filter((j) => j !== a && !j.fuera));
  }

  // Combos (dan puntos solo si TODOS los golpes le pegan a un enemigo):
  //   PIÑA, PIÑA, PIÑA   -> combo triple (el 3er golpe tira al piso)
  //   PIÑA, PIÑA, PATADA -> combo patada (patada mas fuerte: daño "comboPatada")
  // a.combo = cuantas piñas seguidas lleva QUE LE PEGARON a un enemigo
  //   (se corta si una piña no pega o si pasan mas de 0.6 seg entre golpes)
  ataqueJugador(a, tipo) {
    const P = a.cfg;
    const ahora = this.time.now / 1000;
    const seguido = ahora - a.ultimoPunio < 0.6;
    a.vx = 0; a.vy = 0;
    Sonido.aire();
    if (tipo === 'patada') {
      const esCombo = seguido && a.combo === 2;
      a.combo = 0;
      if (esCombo) {
        this.iniciarSecuencia(a, [
          { p: 'punio1', d: 0.06 },
          { p: 'patada', d: 0.3, golpe: () => this.cerrarCombo(a, 'piniaPatada', this.golpear(a, this.blancos(a), 130, P.comboPatada || P.patada, true)) },
          { p: 'parado', d: 0.06 }
        ]);
      } else {
        this.iniciarSecuencia(a, [
          { p: 'punio1', d: 0.07 },
          { p: 'patada', d: 0.24, golpe: () => this.golpear(a, this.blancos(a), 118, P.patada, true) },
          { p: 'parado', d: 0.06 }
        ]);
      }
      return;
    }
    a.combo = seguido ? a.combo + 1 : 1;
    a.ultimoPunio = ahora;
    if (a.combo >= 3) {
      a.combo = 0;
      this.iniciarSecuencia(a, [
        { p: 'punio1', d: 0.08 },
        { p: 'punio3', d: 0.2, golpe: () => this.cerrarCombo(a, 'triple', this.golpear(a, this.blancos(a), 108, P.remate, true)) },
        { p: 'punio2', d: 0.08 }
      ]);
    } else {
      this.iniciarSecuencia(a, [
        { p: 'punio1', d: 0.04 },
        { p: 'punio2', d: 0.04 },
        { p: 'punio3', d: 0.12, golpe: () => {
          // si esta piña no le pego a ningun enemigo, se corta el combo (la proxima empieza de cero)
          if (!this.golpear(a, this.blancos(a), 100, P.punio, false).some((o) => !o.esJugador)) a.combo = 0;
        } },
        { p: 'punio2', d: 0.05 }
      ]);
    }
  }

  // Si el golpe final del combo le pego a algun enemigo: puntos y cartelito arriba del jugador
  cerrarCombo(a, tipo, golpeados) {
    if (!golpeados.some((o) => !o.esJugador)) return;
    const pts = (window.JUEGO.config.combos || {})[tipo] || 0;
    this.puntos += pts;
    this.puntosCombos += pts;
    this.combosHechos++;
    const nombre = tipo === 'triple' ? '¡COMBO TRIPLE!' : '¡COMBO PATADA!';
    this.textoFlotante(a.x, a.y - a.z - a.alto - 20, nombre + '\n+' + pts, tipo === 'triple' ? '#ffd34f' : '#5ff4ff');
    Sonido.elegir();
  }

  // Texto que sube y se desvanece (tambien se ve en el otro dispositivo)
  textoFlotante(x, y, texto, color, local) {
    if (!local) RED.enviar({ t: 'tf', x: Math.round(x), y: Math.round(y), x2: texto, c: color });
    x = Phaser.Math.Clamp(x, 110, 850);
    const t = this.add.text(x, y, texto, ESTILO(22, color)).setOrigin(0.5).setDepth(9700);
    this.tweens.add({ targets: t, y: y - 60, alpha: 0, delay: 500, duration: 700, onComplete: () => t.destroy() });
  }

  jugadorSinVida(a) {
    a.vidas--;
    this.vidasPerdidas++;
    if (a.vidas > 0) {
      this.anuncio('¡ARRIBA ' + a.cfg.nombre + '!', '#ffd34f');
      a.hp = a.hpMax;
      a.fase = 'levanta'; a.timer = 0.4; a.angulo = 0; a.pose('aterriza');
      this.time.delayedCall(450, () => { a.invul = 2.2; });
    } else {
      a.morir();
      a.fuera = true;
      const termino = this.revisarGameOver();
      if (!termino && this.jugadores.length > 1) this.anuncio(a.cfg.nombre + ' QUEDÓ AFUERA', '#ff4f6a', 1800);
    }
  }

  // Se pierde cuando quedan afuera todos los jugadores. Devuelve true si termino.
  revisarGameOver() {
    if (this.fase === 'fin' || !this.jugadores.every((j) => j.fuera)) return false;
    this.fase = 'fin';
    // al perder no hay premio por tiempo, pero si se descuenta el daño y las vidas
    const r = this.calcularPuntaje(false);
    this.puntos = r.total;
    this.time.delayedCall(1800, () => this.irAFinal(false, r));
    return true;
  }

  // ---------------- Enemigos ----------------
  // el jugador mas cercano que sigue en juego
  objetivo(e) {
    let mejor = null, dmin = Infinity;
    for (const j of this.jugadores) {
      if (j.fuera || !j.vivo) continue;
      const d = Math.abs(j.x - e.x) + Math.abs(j.y - e.y) * 2;
      if (d < dmin) { dmin = d; mejor = j; }
    }
    return mejor;
  }

  actualizarEnemigo(e, dt) {
    const J = window.JUEGO;
    if (e.actualizarComun(dt)) return;
    if (e.estado === 'ataque') { this.secuencia(e, dt); return; }

    if (!e.limitarX && e.x > J.X_MIN && e.x < J.X_MAX) e.limitarX = true;
    e.cool -= dt;
    const a = this.objetivo(e);
    if (!a || this.fase === 'fin') { e.vx = 0; e.vy = 0; e.animarCaminar(dt, false); return; }
    e.dir = a.x >= e.x ? 1 : -1;

    const distX = Math.abs(a.x - e.x), distY = Math.abs(a.y - e.y);
    const cfg = e.cfg;
    const espera = () => Phaser.Math.FloatBetween(cfg.esperaMin, Math.max(cfg.esperaMin, cfg.esperaMax));
    const turnoLibre = this.time.now - this.ultimoAtaqueEnemigo > 450;

    // Los que tienen arma disparan si el jugador esta lejos y en la misma linea
    if (cfg.dispara && e.limitarX && distX > 260 && distY < 40 && e.cool <= 0) {
      e.cool = espera() + 1.0;
      this.iniciarSecuencia(e, [
        { p: 'punio1', d: 0.4 },
        { p: 'punio2', d: 0.3, golpe: () => this.disparar(e) },
        { p: 'parado', d: 0.25 }
      ]);
      return;
    }

    if (e.limitarX && distX <= e.alcance && distX >= 25 && distY < 18 && e.cool <= 0 && a.golpeable && (turnoLibre || e.esBoss)) {
      e.cool = espera();
      this.ultimoAtaqueEnemigo = this.time.now;
      const conPatada = Math.random() < 0.4;
      this.iniciarSecuencia(e, [
        { p: 'punio1', d: e.esBoss ? 0.3 : 0.38 },
        conPatada
          ? { p: 'patada', d: 0.25, golpe: () => this.golpear(e, this.jugadores, e.alcance + 15, cfg.patada, e.esBoss) }
          : { p: 'punio3', d: 0.22, golpe: () => this.golpear(e, this.jugadores, e.alcance, cfg.punio, false) },
        { p: 'parado', d: 0.3 }
      ]);
      return;
    }

    const lado = e.x < a.x ? -1 : 1;
    const tx = a.x + lado * e.alcance * 0.75;
    const ty = a.y + e.offY;
    const dx = tx - e.x, dy = ty - e.y;
    e.vx = Math.abs(dx) > 8 ? Math.sign(dx) * cfg.vel : 0;
    e.vy = Math.abs(dy) > 4 ? Math.sign(dy) * cfg.velY : 0;
    e.animarCaminar(dt, e.vx || e.vy);
  }

  separarEnemigos() {
    const vivos = this.enemigos.filter((e) => e.vivo);
    for (let i = 0; i < vivos.length; i++) {
      for (let j = i + 1; j < vivos.length; j++) {
        const p = vivos[i], q = vivos[j];
        if (Math.abs(p.x - q.x) < 45 && Math.abs(p.y - q.y) < 14) {
          const s = p.y <= q.y ? -1 : 1;
          p.y += s * 1.5; q.y -= s * 1.5;
        }
      }
    }
  }

  disparar(e) {
    Sonido.disparo();
    const x = e.x + e.dir * e.alto * 0.3;
    const altura = e.alto * 0.45;
    const fogonazo = this.add.circle(x, e.y - altura, 14, 0xffe27a).setDepth(e.y + 1);
    this.tweens.add({ targets: fogonazo, scale: 0, alpha: 0, duration: 150, onComplete: () => fogonazo.destroy() });
    const spr = this.add.rectangle(x, e.y - altura, 18, 5, 0xffd34f).setDepth(e.y + 1);
    this.balas.push({ x, y: e.y, altura, dir: e.dir, spr, danio: e.cfg.bala });
  }

  actualizarBalas(dt) {
    this.balas = this.balas.filter((b) => {
      b.x += b.dir * 600 * dt;
      b.spr.x = b.x;
      const a = this.jugadores.find((j) => !j.fuera && Math.abs(j.y - b.y) < 22 && Math.abs(j.x - b.x) < 28 && j.z < 60 && j.golpeable);
      if (a) {
        const hpAntes = a.hp;
        a.recibirGolpe(b.danio, b.dir, false);
        a.invul = Math.max(a.invul, 0.3);
        this.danioRecibido += hpAntes - a.hp;
        Sonido.herida();
        b.spr.destroy();
        return false;
      }
      if (b.x < -50 || b.x > 1010) { b.spr.destroy(); return false; }
      return true;
    });
  }

  // ---------------- Combate ----------------
  iniciarSecuencia(l, seq) {
    l.estado = 'ataque';
    l.seq = seq; l.seqI = -1; l.seqT = 0;
    l.vx = 0; l.vy = 0;
    this.secuencia(l, 0);
  }

  secuencia(l, dt) {
    l.vx = 0; l.vy = 0;
    l.seqT -= dt;
    if (l.seqT > 0) return;
    l.seqI++;
    if (!l.seq || l.seqI >= l.seq.length) { l.estado = 'libre'; l.seq = null; return; }
    const paso = l.seq[l.seqI];
    l.pose(paso.p);
    l.seqT = paso.d;
    if (paso.golpe) paso.golpe();
  }

  golpear(at, objetivos, alcance, danio, fuerte, alturaMax) {
    const golpeados = [];
    for (const o of objetivos) {
      if (!o.golpeable || o.fuera) continue;
      const dx = (o.x - at.x) * at.dir;
      const dy = Math.abs(o.y - at.y);
      if (dx > -20 && dx < alcance && dy < 32 && Math.abs(o.z - at.z) < (alturaMax || 70)) {
        const hpAntes = o.hp;
        if (o.recibirGolpe(danio, at.dir, fuerte)) {
          golpeados.push(o);
          this.efectoGolpe(o, fuerte || o.estado === 'caido');
          if (o.esJugador) { o.invul = Math.max(o.invul, 0.3); this.danioRecibido += hpAntes - o.hp; Sonido.herida(); }
          else { this.enemigoVisto = o; this.enemigoVistoT = 2.5; }
        }
      }
    }
    return golpeados;
  }

  efectoGolpe(o, fuerte) {
    (fuerte ? Sonido.fuerte : Sonido.golpe)();
    this.hitStop = fuerte ? 0.09 : 0.05;
    if (fuerte) this.cameras.main.shake(120, 0.006);
    const x = o.x + Phaser.Math.Between(-10, 10);
    const y = o.y - o.z - o.alto * 0.62;
    this.dibujarGolpe(x, y, fuerte);
    RED.enviar({ t: 'fx', x: Math.round(x), y: Math.round(y), f: fuerte ? 1 : 0 });
  }

  dibujarGolpe(x, y, fuerte) {
    const estrella = this.add.star(x, y, 7, 8, fuerte ? 34 : 24, fuerte ? 0xffe27a : 0xffffff).setDepth(9000);
    this.tweens.add({ targets: estrella, scale: 1.6, alpha: 0, angle: 60, duration: 220, onComplete: () => estrella.destroy() });
  }

  revisarMuertes() {
    for (const e of this.enemigos) {
      if (e.estado === 'muerto' && !e.contado) {
        e.contado = true;
        this.puntos += e.cfg.puntos || 0;
        this.puntosEnemigos += e.cfg.puntos || 0;
        if (e.esBoss) this.nivelTerminado();
      }
    }
    this.enemigos = this.enemigos.filter((e) => {
      if (e.terminado) { e.destruir(); return false; }
      return true;
    });
  }

  revisarProgreso() {
    if (this.fase === 'oleada' && this.pendientes === 0 && this.enemigos.every((e) => !e.vivo)) {
      this.fase = 'esperando';
      this.time.delayedCall(1300, () => this.siguientePaso());
    }
  }

  nivelTerminado() {
    if (this.fase === 'fin') return;
    const C = window.JUEGO.config;
    this.fase = 'fin';
    this.balas.forEach((b) => b.spr.destroy()); this.balas = [];
    const hayMas = this.numNivel + 1 < C.niveles.length;
    const r = this.calcularPuntaje(true);
    this.anuncio(this.boss ? '¡K.O.!' : (C.textos.nivelSuperado || '¡NIVEL SUPERADO!'), '#ffd34f', 1400);
    this.time.delayedCall(1800, () => this.mostrarResumen(r, () => {
      this.puntos = r.total;
      if (hayMas) {
        // si el invitado se fue, se sigue solo con el de este dispositivo
        const siguen = this.jugadores.filter((j) => !j.remoto || RED.activa())
          .map((j) => ({ tipo: j.tipo, vidas: j.vidas, remoto: j.remoto }));
        RED.enviar({ t: 'niv', n: this.numNivel + 1, tipos: siguen.map((j) => j.tipo) });
        this.cameras.main.fadeOut(500, 0, 0, 0);
        const n = this.numNivel + 1;
        this.cameras.main.once('camerafadeoutcomplete', () =>
          this.scene.start('historia', { nivel: n, datosNivel: { nivel: n, puntos: this.puntos, jugadores: siguen } }));
      } else this.irAFinal(true);
    }));
  }

  // Puntaje del nivel: enemigos + combos + premio por terminar rapido − daño recibido − vidas perdidas,
  // todo multiplicado por la dificultad (FÁCIL x0.5, NORMAL x1, DIFÍCIL x2). Nunca baja de 0.
  // Los valores se cambian en config-juego.js -> "puntaje", "combos" y "dificultades" (o en el panel admin).
  calcularPuntaje(gano) {
    const P = Object.assign({ bonoTiempo: 5000, puntosPorSegundo: 25, porDanio: 10, porVida: 1000 },
      window.JUEGO.config.puntaje || {});
    const seg = Math.floor(this.tiempo);
    const bono = gano ? Math.max(0, Math.round(P.bonoTiempo - seg * P.puntosPorSegundo)) : 0;
    const restaDanio = Math.round(this.danioRecibido * P.porDanio);
    const restaVidas = this.vidasPerdidas * P.porVida;
    const mult = this.dif.puntos || 1;
    const nivel = Math.max(0, Math.round((this.puntosEnemigos + this.puntosCombos + bono - restaDanio - restaVidas) * mult));
    return { seg, anteriores: this.puntosInicio, base: this.puntosEnemigos, combos: this.puntosCombos, nCombos: this.combosHechos,
             bono, danio: Math.round(this.danioRecibido), restaDanio, vidas: this.vidasPerdidas, restaVidas,
             dif: this.dif.nombre, mult, nivel, total: this.puntosInicio + nivel };
  }

  // Cartel con la cuenta de puntos del nivel. Sigue solo, o antes con cualquier tecla / toque.
  // alTerminar = null: solo se muestra (invitado, espera a que siga el anfitrion).
  mostrarResumen(r, alTerminar) {
    if (alTerminar) RED.enviar({ t: 'res', r });
    const D = 9900, cont = this.add.container(0, 0).setDepth(D);
    cont.add(this.add.rectangle(480, 360, 660, 500, 0x000000, 0.85).setStrokeStyle(4, 0xff4fd8));
    cont.add(this.add.text(480, 145, 'RESULTADO DEL NIVEL', ESTILO(32, '#ffd34f')).setOrigin(0.5));
    const filas = [
      ['Puntos por enemigos', '' + r.base, '#ffffff'],
      ['Combos (' + (r.nCombos || 0) + ')', '+' + (r.combos || 0), '#ffd34f'],
      ['Tiempo ' + formatoTiempo(r.seg), '+' + r.bono, '#5ff4ff'],
      ['Daño recibido (' + r.danio + ')', '-' + r.restaDanio, '#ff4f6a'],
      ['Vidas perdidas (' + r.vidas + ')', '-' + r.restaVidas, '#ff4f6a'],
      ['Dificultad ' + r.dif, 'x' + r.mult, '#ff4fd8']
    ];
    if (r.anteriores) filas.push(['Puntos de antes', '+' + r.anteriores, '#9fb4ff']);
    filas.push(['TOTAL', '' + r.total, '#ffd34f']);
    filas.forEach((f, i) => {
      const y = 200 + i * 44 + (i === filas.length - 1 ? 12 : 0);
      const izq = this.add.text(200, y, f[0], ESTILO(i === filas.length - 1 ? 30 : 24, f[2])).setOrigin(0, 0.5).setAlpha(0);
      const der = this.add.text(760, y, f[1], ESTILO(i === filas.length - 1 ? 30 : 24, f[2])).setOrigin(1, 0.5).setAlpha(0);
      cont.add([izq, der]);
      this.time.delayedCall(300 + i * 300, () => {
        izq.setAlpha(1); der.setAlpha(1);
        if (alTerminar) (i === filas.length - 1 ? Sonido.elegir : Sonido.menu)();
      });
    });
    const textoSigue = !alTerminar ? 'Esperando que siga el otro jugador...'
      : (this.tactil ? 'Tocá para seguir' : 'Apretá una tecla para seguir');
    const sigue = this.add.text(480, 585, textoSigue, ESTILO(18, '#9fb4ff')).setOrigin(0.5).setAlpha(0);
    cont.add(sigue);

    const tEspera = 300 + filas.length * 300 + 400;
    this.time.delayedCall(tEspera, () => sigue.setAlpha(1));
    if (!alTerminar) return;

    let listo = false;
    const seguir = () => {
      if (listo) return;
      listo = true;
      this.input.keyboard.off('keydown', seguir);
      this.input.off('pointerdown', seguir);
      alTerminar();
    };
    this.time.delayedCall(tEspera, () => {
      this.input.keyboard.on('keydown', seguir);
      this.input.on('pointerdown', seguir);
    });
    this.time.delayedCall(tEspera + 5000, seguir);
  }

  irAFinal(gano, resumen) {
    const d = { gano, puntos: this.puntos, resumen, tipos: this.jugadores.map((j) => j.tipo), coop: this.jugadores.length > 1 };
    RED.enviar({ t: 'fin', d });
    this.cameras.main.fadeOut(500, 0, 0, 0);
    // si gano el ultimo nivel, antes de la victoria va su "historia al terminar" (si tiene)
    const n = window.JUEGO.config.niveles.length;
    this.cameras.main.once('camerafadeoutcomplete', () =>
      gano ? this.scene.start('historia', { nivel: n, datosFinal: d }) : this.scene.start('final', d));
  }

  // ---------------- Pantalla (HUD) ----------------
  crearHUD(tipos) {
    const D = 9500;
    this.hud = this.add.graphics().setDepth(D);
    // cada jugador: nombre, barra de vida y vidas (P1 arriba, P2 abajo)
    this.hudJug = tipos.map((t, i) => {
      const y0 = i * 82;
      const nombre = (tipos.length > 1 ? 'P' + (i + 1) + ' ' : '') + window.JUEGO.config.personajes[t].nombre;
      this.add.text(20, 14 + y0, nombre, ESTILO(22, COLOR_JUGADOR[t] || '#ff4fd8')).setDepth(D + 1);
      return { y0, vidas: this.add.text(20, 66 + y0, '', ESTILO(18, '#ffffff')).setDepth(D + 1) };
    });
    this.textoPuntos = this.add.text(940, 14, '', ESTILO(22, '#5ff4ff')).setOrigin(1, 0).setDepth(D + 1);
    this.textoOleada = this.add.text(480, 16, '', ESTILO(20, '#ffd34f')).setOrigin(0.5, 0).setDepth(D + 1);
    this.textoTiempo = this.add.text(480, 46, '', ESTILO(18, '#ffffff')).setOrigin(0.5, 0).setDepth(D + 1);
    this.textoEnemigo = this.add.text(940, 48, '', ESTILO(16, '#ffffff')).setOrigin(1, 0).setDepth(D + 1);
    this.textoBoss = this.add.text(480, 655, '', ESTILO(20, '#ff4f6a')).setOrigin(0.5, 1).setDepth(D + 1).setVisible(false);
    const comoSeguir = this.tactil ? 'Tocá II para seguir' : nombreTecla((this.opc.controles || JUEGO.CONTROLES_DEFECTO).pausa[0]) + ' para seguir';
    this.textoPausa = this.add.text(480, 330, 'PAUSA\n\n' + comoSeguir, ESTILO(40)).setOrigin(0.5).setDepth(D + 2).setVisible(false);
  }

  barra(x, y, w, h, frac, color) {
    this.hud.fillStyle(0x000000, 0.75).fillRect(x - 3, y - 3, w + 6, h + 6);
    this.hud.fillStyle(0x3a0d1a, 1).fillRect(x, y, w, h);
    this.hud.fillStyle(color, 1).fillRect(x, y, Math.max(0, w * frac), h);
  }

  actualizarHUD(dt) {
    this.hud.clear();
    this.hudJug.forEach((h, i) => {
      const j = this.jugadores[i];
      if (!j) return;
      const frac = j.hp / j.hpMax;
      this.barra(20, 42 + h.y0, 260, 16, frac, frac > 0.3 ? 0xff4fd8 : 0xff4f4f);
      h.vidas.setText(j.fuera ? 'AFUERA' : '♥ x ' + Math.max(0, j.vidas));
    });
    this.textoPuntos.setText('PUNTOS ' + this.puntos);
    this.textoTiempo.setText('TIEMPO ' + formatoTiempo(this.tiempo) + '   ·   ' + this.dif.nombre);
    const nv = 'NIVEL ' + (this.numNivel + 1) + '  ·  ';
    this.textoOleada.setText(nv + (this.boss || this.hayJefe ? 'JEFE FINAL' : (this.oleada ? 'OLEADA ' + this.oleada + ' / ' + this.nivel.oleadas.length : '')));

    this.enemigoVistoT -= dt;
    const ev = this.enemigoVisto;
    if (ev && !ev.esBoss && this.enemigoVistoT > 0) {
      this.textoEnemigo.setText(ev.cfg.nombre);
      this.barra(760, 74, 180, 10, ev.hp / ev.hpMax, 0xffd34f);
    } else this.textoEnemigo.setText('');

    if (this.boss) this.barra(230, 662, 500, 18, this.boss.hp / this.boss.hpMax, 0xff4f6a);
  }

  // local = true: no se reenvia al otro jugador
  anuncio(texto, color, dur, tam, local) {
    if (!local) RED.enviar({ t: 'an', x: texto, c: color, d: dur, s: tam });
    const t = this.add.text(480, 300, texto, ESTILO(tam || 54, color)).setOrigin(0.5).setDepth(9800).setScale(0.3);
    t.setWordWrapWidth(900);
    this.tweens.add({ targets: t, scale: 1, duration: 250, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, delay: dur || 1300, duration: 300, onComplete: () => t.destroy() });
  }

  pausar() {
    if (this.fase === 'fin') return;
    this.pausado = !this.pausado;
    this.textoPausa.setVisible(this.pausado);
    if (this.pausado) { this.tweens.pauseAll(); this.time.paused = true; }
    else { this.tweens.resumeAll(); this.time.paused = false; }
  }
}
