// Escena de un nivel: oleadas de enemigos y jefe, segun src/config-juego.js (niveles[]).
class EscenaNivel extends Phaser.Scene {
  constructor() { super('nivel'); }

  // data: { nivel, vidas, puntos }  (vidas/puntos vienen del nivel anterior)
  create(data) {
    const J = window.JUEGO, C = J.config;
    data = data || {};
    this.opc = this.registry.get('opciones') || leerOpciones();
    this.numNivel = data.nivel || 0;
    this.nivel = C.niveles[this.numNivel];
    this.vidas = data.vidas !== undefined ? data.vidas : this.opc.vidas;
    this.puntos = data.puntos || 0;
    this.oleada = 0;
    this.fase = 'intro';          // intro | oleada | esperando | boss | fin
    this.enemigos = [];
    this.balas = [];
    this.pendientes = 0;
    this.hitStop = 0;
    this.pausado = false;
    this.ultimoAtaqueEnemigo = 0;
    this.enemigoVisto = null;
    this.enemigoVistoT = 0;
    this.boss = null;
    // para el puntaje del nivel: cronometro, vida perdida y vidas perdidas
    this.tiempo = 0;
    this.danioRecibido = 0;
    this.vidasPerdidas = 0;

    // la zona caminable depende del fondo de cada nivel
    J.PISO_MIN = this.nivel.pisoMin || 615;
    J.PISO_MAX = this.nivel.pisoMax || 712;

    const fondo = this.textures.exists(this.nivel.fondo) ? this.nivel.fondo : 'fondojugando';
    this.add.image(480, 0, fondo).setOrigin(0.5, 0).setDisplaySize(960, 960 * this.textures.get(fondo).getSourceImage().height / this.textures.get(fondo).getSourceImage().width).setDepth(-1000);

    const P = C.personajes.angie;
    const a = this.angie = new Luchador(this, 'angie', 260, (J.PISO_MIN + J.PISO_MAX) / 2, { alto: P.alto, hp: P.hp, dir: 1 });
    a.combo = 0; a.ultimoPunio = -10;
    a.alQuedarSinVida = () => this.angieSinVida();

    this.armarControles();
    this.tactil = window.esTactil() ? new ControlesTactiles(this) : null;
    this.crearHUD();
    this.cameras.main.fadeIn(400);
    const titulo = 'NIVEL ' + (this.numNivel + 1) + '\n' + this.nivel.nombre.toUpperCase();
    this.anuncio(titulo, '#ff4fd8', 1600);
    if (this.nivel.intro) this.time.delayedCall(1900, () => this.anuncio(this.nivel.intro, '#ffffff', 1800, 30));
    this.time.delayedCall(this.nivel.intro ? 4000 : 2100, () => this.siguientePaso());
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
    const y = Phaser.Math.Between(J.PISO_MIN + 10, J.PISO_MAX - 10);
    const e = new Luchador(this, tipo, x, y, { alto: cfg.alto, hp: cfg.hp, dir: x < 480 ? 1 : -1 });
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
    if (this.recienApretada('pausa')) this.pausar();
    if (this.pausado) return;

    const dt = Math.min(delta / 1000, 0.05);
    // el cronometro corre desde la primera oleada hasta que termina el nivel (no cuenta la pausa)
    if (this.fase !== 'intro' && this.fase !== 'fin') this.tiempo += delta / 1000;
    if (this.hitStop > 0) { this.hitStop -= dt; return; }

    this.actualizarAngie(dt);
    this.angie.fisica(dt);

    for (const e of this.enemigos) { this.actualizarEnemigo(e, dt); e.fisica(dt); }
    this.separarEnemigos();
    this.actualizarBalas(dt);

    this.angie.sync();
    for (const e of this.enemigos) e.sync();

    this.revisarMuertes();
    this.revisarProgreso();
    this.actualizarHUD(dt);
  }

  // ---------------- Angie ----------------
  actualizarAngie(dt) {
    const P = window.JUEGO.config.personajes.angie, a = this.angie;
    const izq = this.apretada('izquierda'), der = this.apretada('derecha');
    const arr = this.apretada('arriba'), aba = this.apretada('abajo');
    const punio = this.recienApretada('pinia');
    const patada = this.recienApretada('patada');
    const salto = this.recienApretada('salto');

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
        this.ataqueAngie('punio');
      } else if (patada) {
        this.ataqueAngie('patada');
      }
    } else if (a.estado === 'aire') {
      a.vx = mx * P.vel * 0.9;
      if (mx) a.dir = mx;
      if ((patada || punio) && !a.yaPateo) {
        a.yaPateo = true; a.pateaAire = true; a.pose('patada'); Sonido.aire();
      }
      if (a.pateaAire) {
        const blancos = this.enemigos.filter((e) => !a.golpeadosAire.includes(e));
        const pego = this.golpear(a, blancos, 115, P.patadaAire, true, 150);
        pego.forEach((e) => a.golpeadosAire.push(e));
      }
    } else if (a.estado === 'ataque') {
      this.secuencia(a, dt);
    }
  }

  ataqueAngie(tipo) {
    const P = window.JUEGO.config.personajes.angie, a = this.angie;
    const ahora = this.time.now / 1000;
    a.vx = 0; a.vy = 0;
    Sonido.aire();
    if (tipo === 'patada') {
      a.combo = 0;
      this.iniciarSecuencia(a, [
        { p: 'punio1', d: 0.07 },
        { p: 'patada', d: 0.24, golpe: () => this.golpear(a, this.enemigos, 118, P.patada, true) },
        { p: 'parado', d: 0.06 }
      ]);
      return;
    }
    a.combo = (ahora - a.ultimoPunio < 0.6) ? a.combo + 1 : 1;
    a.ultimoPunio = ahora;
    if (a.combo >= 3) {
      a.combo = 0;
      this.iniciarSecuencia(a, [
        { p: 'punio1', d: 0.08 },
        { p: 'punio3', d: 0.2, golpe: () => this.golpear(a, this.enemigos, 108, P.remate, true) },
        { p: 'punio2', d: 0.08 }
      ]);
    } else {
      this.iniciarSecuencia(a, [
        { p: 'punio1', d: 0.04 },
        { p: 'punio2', d: 0.04 },
        { p: 'punio3', d: 0.12, golpe: () => this.golpear(a, this.enemigos, 100, P.punio, false) },
        { p: 'punio2', d: 0.05 }
      ]);
    }
  }

  angieSinVida() {
    const a = this.angie;
    this.vidas--;
    this.vidasPerdidas++;
    if (this.vidas > 0) {
      this.anuncio('¡ARRIBA ANGIE!', '#ffd34f');
      a.hp = a.hpMax;
      a.fase = 'levanta'; a.timer = 0.4; a.angulo = 0; a.pose('aterriza');
      this.time.delayedCall(450, () => { a.invul = 2.2; });
    } else {
      a.morir();
      this.fase = 'fin';
      // al perder no hay premio por tiempo, pero si se descuenta el daño y las vidas
      const r = this.calcularPuntaje(false);
      this.puntos = r.total;
      this.time.delayedCall(1800, () => this.irAFinal(false, r));
    }
  }

  // ---------------- Enemigos ----------------
  actualizarEnemigo(e, dt) {
    const J = window.JUEGO, a = this.angie;
    if (e.actualizarComun(dt)) return;
    if (e.estado === 'ataque') { this.secuencia(e, dt); return; }

    if (!e.limitarX && e.x > J.X_MIN && e.x < J.X_MAX) e.limitarX = true;
    e.cool -= dt;
    e.dir = a.x >= e.x ? 1 : -1;

    if (!a.vivo || this.fase === 'fin') { e.vx = 0; e.vy = 0; e.animarCaminar(dt, false); return; }

    const distX = Math.abs(a.x - e.x), distY = Math.abs(a.y - e.y);
    const cfg = e.cfg;
    const espera = () => Phaser.Math.FloatBetween(cfg.esperaMin, Math.max(cfg.esperaMin, cfg.esperaMax));
    const turnoLibre = this.time.now - this.ultimoAtaqueEnemigo > 450;

    // Los que tienen arma disparan si Angie esta lejos y en la misma linea
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
          ? { p: 'patada', d: 0.25, golpe: () => this.golpear(e, [a], e.alcance + 15, cfg.patada, e.esBoss) }
          : { p: 'punio3', d: 0.22, golpe: () => this.golpear(e, [a], e.alcance, cfg.punio, false) },
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
    const a = this.angie;
    this.balas = this.balas.filter((b) => {
      b.x += b.dir * 600 * dt;
      b.spr.x = b.x;
      if (Math.abs(a.y - b.y) < 22 && Math.abs(a.x - b.x) < 28 && a.z < 60 && a.golpeable) {
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
      if (!o.golpeable) continue;
      const dx = (o.x - at.x) * at.dir;
      const dy = Math.abs(o.y - at.y);
      if (dx > -20 && dx < alcance && dy < 32 && Math.abs(o.z - at.z) < (alturaMax || 70)) {
        const hpAntes = o.hp;
        if (o.recibirGolpe(danio, at.dir, fuerte)) {
          golpeados.push(o);
          this.efectoGolpe(o, fuerte || o.estado === 'caido');
          if (o === this.angie) { o.invul = Math.max(o.invul, 0.3); this.danioRecibido += hpAntes - o.hp; Sonido.herida(); }
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
    const estrella = this.add.star(x, y, 7, 8, fuerte ? 34 : 24, fuerte ? 0xffe27a : 0xffffff).setDepth(9000);
    this.tweens.add({ targets: estrella, scale: 1.6, alpha: 0, angle: 60, duration: 220, onComplete: () => estrella.destroy() });
  }

  revisarMuertes() {
    for (const e of this.enemigos) {
      if (e.estado === 'muerto' && !e.contado) {
        e.contado = true;
        this.puntos += e.cfg.puntos || 0;
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
    const C = window.JUEGO.config;
    this.fase = 'fin';
    this.balas.forEach((b) => b.spr.destroy()); this.balas = [];
    const hayMas = this.numNivel + 1 < C.niveles.length;
    const r = this.calcularPuntaje(true);
    this.anuncio(this.boss ? '¡K.O.!' : (C.textos.nivelSuperado || '¡NIVEL SUPERADO!'), '#ffd34f', 1400);
    this.time.delayedCall(1800, () => this.mostrarResumen(r, () => {
      this.puntos = r.total;
      if (hayMas) {
        this.cameras.main.fadeOut(500, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () =>
          this.scene.start('nivel', { nivel: this.numNivel + 1, vidas: this.vidas, puntos: this.puntos }));
      } else this.irAFinal(true);
    }));
  }

  // Puntaje del nivel: premio por terminar rapido, menos el daño recibido y las vidas perdidas.
  // Los valores se cambian en config-juego.js -> "puntaje" (o en el panel admin).
  calcularPuntaje(gano) {
    const P = Object.assign({ bonoTiempo: 5000, puntosPorSegundo: 25, porDanio: 10, porVida: 1000 },
      window.JUEGO.config.puntaje || {});
    const seg = Math.floor(this.tiempo);
    const bono = gano ? Math.max(0, Math.round(P.bonoTiempo - seg * P.puntosPorSegundo)) : 0;
    const restaDanio = Math.round(this.danioRecibido * P.porDanio);
    const restaVidas = this.vidasPerdidas * P.porVida;
    const total = Math.max(0, this.puntos + bono - restaDanio - restaVidas);
    return { seg, base: this.puntos, bono, danio: Math.round(this.danioRecibido), restaDanio,
             vidas: this.vidasPerdidas, restaVidas, total };
  }

  // Cartel con la cuenta de puntos del nivel. Sigue solo, o antes con cualquier tecla / toque.
  mostrarResumen(r, alTerminar) {
    const D = 9900, cont = this.add.container(0, 0).setDepth(D);
    cont.add(this.add.rectangle(480, 360, 640, 430, 0x000000, 0.82).setStrokeStyle(4, 0xff4fd8));
    cont.add(this.add.text(480, 180, 'RESULTADO DEL NIVEL', ESTILO(32, '#ffd34f')).setOrigin(0.5));
    const filas = [
      ['Puntos por enemigos', '' + r.base, '#ffffff'],
      ['Tiempo ' + formatoTiempo(r.seg), '+' + r.bono, '#5ff4ff'],
      ['Daño recibido (' + r.danio + ')', '-' + r.restaDanio, '#ff4f6a'],
      ['Vidas perdidas (' + r.vidas + ')', '-' + r.restaVidas, '#ff4f6a'],
      ['TOTAL', '' + r.total, '#ffd34f']
    ];
    filas.forEach((f, i) => {
      const y = 245 + i * 56 + (i === filas.length - 1 ? 14 : 0);
      const izq = this.add.text(200, y, f[0], ESTILO(i === filas.length - 1 ? 30 : 24, f[2])).setOrigin(0, 0.5).setAlpha(0);
      const der = this.add.text(760, y, f[1], ESTILO(i === filas.length - 1 ? 30 : 24, f[2])).setOrigin(1, 0.5).setAlpha(0);
      cont.add([izq, der]);
      this.time.delayedCall(300 + i * 380, () => { izq.setAlpha(1); der.setAlpha(1); (i === filas.length - 1 ? Sonido.elegir : Sonido.menu)(); });
    });
    const sigue = this.add.text(480, 545, this.tactil ? 'Tocá para seguir' : 'Apretá una tecla para seguir', ESTILO(18, '#9fb4ff'))
      .setOrigin(0.5).setAlpha(0);
    cont.add(sigue);

    let listo = false;
    const seguir = () => {
      if (listo) return;
      listo = true;
      this.input.keyboard.off('keydown', seguir);
      this.input.off('pointerdown', seguir);
      alTerminar();
    };
    const tEspera = 300 + filas.length * 380 + 400;
    this.time.delayedCall(tEspera, () => {
      sigue.setAlpha(1);
      this.input.keyboard.on('keydown', seguir);
      this.input.on('pointerdown', seguir);
    });
    this.time.delayedCall(tEspera + 5000, seguir);
  }

  irAFinal(gano, resumen) {
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('final', { gano, puntos: this.puntos, resumen }));
  }

  // ---------------- Pantalla (HUD) ----------------
  crearHUD() {
    const D = 9500;
    this.hud = this.add.graphics().setDepth(D);
    this.add.text(20, 14, window.JUEGO.config.personajes.angie.nombre, ESTILO(22, '#ff4fd8')).setDepth(D + 1);
    this.textoVidas = this.add.text(20, 66, '', ESTILO(18, '#ffffff')).setDepth(D + 1);
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
    const a = this.angie;
    this.hud.clear();
    this.barra(20, 42, 260, 16, a.hp / a.hpMax, a.hp / a.hpMax > 0.3 ? 0xff4fd8 : 0xff4f4f);
    this.textoVidas.setText('♥ x ' + Math.max(0, this.vidas));
    this.textoPuntos.setText('PUNTOS ' + this.puntos);
    this.textoTiempo.setText('TIEMPO ' + formatoTiempo(this.tiempo));
    const nv = 'NIVEL ' + (this.numNivel + 1) + '  ·  ';
    this.textoOleada.setText(nv + (this.boss ? 'JEFE FINAL' : (this.oleada ? 'OLEADA ' + this.oleada + ' / ' + this.nivel.oleadas.length : '')));

    this.enemigoVistoT -= dt;
    const ev = this.enemigoVisto;
    if (ev && !ev.esBoss && this.enemigoVistoT > 0) {
      this.textoEnemigo.setText(ev.cfg.nombre);
      this.barra(760, 74, 180, 10, ev.hp / ev.hpMax, 0xffd34f);
    } else this.textoEnemigo.setText('');

    if (this.boss) this.barra(230, 662, 500, 18, this.boss.hp / this.boss.hpMax, 0xff4f6a);
  }

  anuncio(texto, color, dur, tam) {
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
