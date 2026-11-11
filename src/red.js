// Juego cooperativo por internet: de a 2, cada uno en su dispositivo.
// Usa PeerJS (lib/peerjs.min.js): los dos navegadores se conectan directo entre si. El servidor gratis
// de PeerJS solo sirve para que se "encuentren" con el codigo de la partida.
//  - ANFITRION: el que crea la partida. En su dispositivo corre el juego de verdad (enemigos, golpes, puntos).
//  - INVITADO: manda sus teclas/toques y recibe ~20 veces por segundo donde esta cada cosa para dibujarla.
//
// Mensajes (campo t):
//   anfitrion -> invitado: hola, empezar, e (estado del juego), an (cartel), fx (golpe), sh (temblor),
//                          snd (sonido), res (resultado del nivel), niv (siguiente nivel), fin (pantalla final), lleno,
//                          hist (pantalla de historia que se muestra), jugar (termina la historia, empieza el nivel)
//   invitado -> anfitrion: in (direcciones apretadas), k (piña/patada/salto/pausa recien apretada)
window.RED = {
  PREFIJO: 'revenge-of-the-travas-',
  peer: null,
  conn: null,
  rol: null,            // null (un jugador) | 'anfitrion' | 'invitado'
  oyente: null,         // funcion que recibe los mensajes (la pone cada escena)
  alCortarse: null,     // funcion que se llama si se corta la conexion
  enJuego: false,       // el anfitrion esta en un nivel (para reenviar los sonidos)

  activa() { return !!(this.conn && this.conn.open); },
  enviar(msg) { if (this.activa()) { try { this.conn.send(msg); } catch (e) {} } },

  // Crea la partida: alCodigo(codigo) cuando esta lista, alUnirse() cuando entra el invitado
  crear(alCodigo, alUnirse, alError) {
    this.cerrar();
    this.rol = 'anfitrion';
    const intentar = (n) => {
      const codigo = String(Phaser.Math.Between(1000, 9999));
      const peer = this.peer = new Peer(this.PREFIJO + codigo);
      peer.on('open', () => alCodigo(codigo));
      peer.on('connection', (conn) => {
        if (this.conn) {   // ya hay alguien: se avisa que esta llena
          conn.on('open', () => { conn.send({ t: 'lleno' }); setTimeout(() => conn.close(), 800); });
          return;
        }
        this.prepararConexion(conn, alUnirse);
      });
      peer.on('error', (err) => {
        if (err.type === 'unavailable-id' && n < 6) { peer.destroy(); intentar(n + 1); }
        else if (!this.conn) alError(textoErrorRed(err));
      });
    };
    intentar(0);
  },

  // Se une a la partida con ese codigo: alConectar() cuando se abre la conexion
  unirse(codigo, alConectar, alError) {
    this.cerrar();
    this.rol = 'invitado';
    const peer = this.peer = new Peer();
    let listo = false;
    const espera = setTimeout(() => { if (!listo) alError('No se pudo conectar. Revisá el código\ny que la otra persona siga esperando.'); }, 15000);
    peer.on('open', () => {
      const conn = peer.connect(this.PREFIJO + codigo, { reliable: true });
      this.prepararConexion(conn, () => { listo = true; clearTimeout(espera); alConectar(); });
    });
    peer.on('error', (err) => { clearTimeout(espera); if (!listo) alError(textoErrorRed(err)); });
  },

  prepararConexion(conn, alAbrir) {
    this.conn = conn;
    conn.on('open', () => alAbrir());
    conn.on('data', (d) => { if (this.oyente) this.oyente(d); });
    conn.on('close', () => this.cortado(conn));
    conn.on('error', () => this.cortado(conn));
  },

  cortado(conn) {
    if (this.conn !== conn) return;
    this.conn = null;
    const f = this.alCortarse;
    if (f) f();
  },

  // Corta todo y vuelve al modo de un jugador
  cerrar() {
    const c = this.conn;
    this.conn = null;
    this.oyente = null;
    this.alCortarse = null;
    this.enJuego = false;
    if (c) { try { c.close(); } catch (e) {} }
    if (this.peer) { try { this.peer.destroy(); } catch (e) {} }
    this.peer = null;
    this.rol = null;
  }
};

function textoErrorRed(err) {
  const t = err && err.type;
  if (t === 'peer-unavailable') return 'No hay ninguna partida con ese código.';
  if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed')
    return 'No hay conexión con internet\n(o el servidor de partidas no responde).';
  if (t === 'browser-incompatible') return 'Este navegador no permite jugar online.';
  return 'Error de conexión (' + (t || 'desconocido') + ').';
}

// El anfitrion reenvia al invitado cada sonido que suena durante el nivel
(function () {
  const originales = {};
  for (const k in window.Sonido) {
    if (typeof window.Sonido[k] !== 'function') continue;
    originales[k] = window.Sonido[k];
    window.Sonido[k] = function () {
      if (RED.rol === 'anfitrion' && RED.enJuego) RED.enviar({ t: 'snd', n: k });
      return originales[k].apply(this, arguments);
    };
  }
  // para que el invitado toque el sonido que le llega (sin volver a reenviarlo)
  RED.sonar = (n) => { if (originales[n]) originales[n](); };
})();
