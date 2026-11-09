// Controles en pantalla para celulares y tablets: joystick a la izquierda y botones a la derecha.
// Funciona con varios dedos a la vez (caminar y pegar al mismo tiempo).
window.esTactil = function () {
  return (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window;
};

class ControlesTactiles {
  constructor(scene) {
    this.scene = scene;
    this.dir = { izquierda: false, derecha: false, arriba: false, abajo: false };
    this.buffer = {};
    this.dedoJoystick = null;
    this.dedosBoton = {};          // id de dedo -> boton apretado
    const D = 9600;

    // Joystick
    this.base = { x: 140, y: 590, r: 100 };
    this.gBase = scene.add.circle(this.base.x, this.base.y, this.base.r, 0xffffff, 0.12).setStrokeStyle(4, 0xffffff, 0.35).setDepth(D);
    this.gPerilla = scene.add.circle(this.base.x, this.base.y, 46, 0xff4fd8, 0.45).setStrokeStyle(3, 0xffffff, 0.6).setDepth(D + 1);

    // Botones (accion, x, y, radio, texto, color)
    this.botones = [
      { acc: 'pinia', x: 870, y: 640, r: 62, txt: 'PIÑA', color: 0xff4fd8 },
      { acc: 'patada', x: 735, y: 655, r: 58, txt: 'PATADA', color: 0x5ff4ff },
      { acc: 'salto', x: 865, y: 500, r: 56, txt: 'SALTO', color: 0xffd34f },
      { acc: 'pausa', x: 480, y: 92, r: 30, txt: 'II', color: 0xffffff }
    ];
    this.botones.forEach((b) => {
      b.g = scene.add.circle(b.x, b.y, b.r, b.color, 0.28).setStrokeStyle(4, b.color, 0.7).setDepth(D);
      b.t = scene.add.text(b.x, b.y, b.txt, ESTILO(b.r > 40 ? 20 : 22, '#ffffff')).setOrigin(0.5).setDepth(D + 1).setAlpha(0.85);
    });

    this.alBajar = (p) => this.bajar(p);
    this.alMover = (p) => this.mover(p);
    this.alSubir = (p) => this.subir(p);
    scene.input.on('pointerdown', this.alBajar);
    scene.input.on('pointermove', this.alMover);
    scene.input.on('pointerup', this.alSubir);
    scene.input.on('pointerupoutside', this.alSubir);
    scene.events.once('shutdown', () => {
      scene.input.off('pointerdown', this.alBajar);
      scene.input.off('pointermove', this.alMover);
      scene.input.off('pointerup', this.alSubir);
      scene.input.off('pointerupoutside', this.alSubir);
    });
  }

  bajar(p) {
    for (const b of this.botones) {
      if (Phaser.Math.Distance.Between(p.x, p.y, b.x, b.y) <= b.r + 14) {
        this.buffer[b.acc] = true;
        this.dedosBoton[p.id] = b;
        b.g.setFillStyle(b.color, 0.6);
        return;
      }
    }
    // Toda la mitad izquierda de la pantalla sirve para el joystick
    if (p.x < 480 && this.dedoJoystick === null) {
      this.dedoJoystick = p.id;
      this.mover(p);
    }
  }

  mover(p) {
    if (p.id !== this.dedoJoystick) return;
    let dx = p.x - this.base.x, dy = p.y - this.base.y;
    const dist = Math.hypot(dx, dy);
    if (dist > this.base.r) { dx = dx / dist * this.base.r; dy = dy / dist * this.base.r; }
    this.gPerilla.setPosition(this.base.x + dx, this.base.y + dy);
    const zona = 22;
    this.dir.izquierda = dx < -zona;
    this.dir.derecha = dx > zona;
    this.dir.arriba = dy < -zona;
    this.dir.abajo = dy > zona;
  }

  subir(p) {
    if (p.id === this.dedoJoystick) {
      this.dedoJoystick = null;
      this.gPerilla.setPosition(this.base.x, this.base.y);
      for (const k in this.dir) this.dir[k] = false;
    }
    const b = this.dedosBoton[p.id];
    if (b) { b.g.setFillStyle(b.color, 0.28); delete this.dedosBoton[p.id]; }
  }

  apretada(acc) { return !!this.dir[acc]; }

  recienApretada(acc) {
    const r = !!this.buffer[acc];
    this.buffer[acc] = false;
    return r;
  }
}
window.ControlesTactiles = ControlesTactiles;
