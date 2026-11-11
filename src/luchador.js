// Un personaje que pelea (Angie, turros o el jefe).
// Posicion: x (izq/der), y (profundidad en la calle = donde estan los pies), z (altura del salto).
const FILA2 = ['punio3', 'patada', 'salto', 'golpe1', 'golpe2', 'caida'];

class Luchador {
  constructor(scene, tipo, x, y, opciones) {
    this.scene = scene;
    this.tipo = tipo;
    this.meta = window.SPRITE_META[tipo];
    this.alto = opciones.alto;
    // Escala: la pose "parado" mide "alto" pixeles. La 2da fila de la hoja esta dibujada mas grande,
    // se compensa con la relacion entre el punio de la fila 1 y el de la fila 2.
    // (_refH: hojas con algo arriba de la cabeza, como el paraguas de Lula, que no cuenta para la altura)
    this.escalaBase = this.alto / (this.meta._refH || this.meta.parado.h);
    this.escalaFila2 = this.meta.punio2.h / this.meta.punio3.h;
    // Hojas donde la caida ya esta dibujada acostada (los Doctores): no se gira al caer
    this.caidaAcostada = this.meta.caida.w > this.meta.caida.h * 1.5;

    this.x = x; this.y = y; this.z = 0;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.dir = opciones.dir || 1;
    this.hpMax = opciones.hp; this.hp = opciones.hp;
    this.estado = 'libre';   // libre | ataque | aire | herido | caido | muerto
    this.fase = '';
    this.timer = 0;
    this.invul = 0;
    this.limitarX = true;
    this.angulo = 0;
    this.pasoAnim = 0;

    this.sombra = scene.add.ellipse(x, y, this.alto * 0.5, this.alto * 0.1, 0x000000, 0.45);
    this.spr = scene.add.image(x, y, tipo + '_parado');
    this.poseActual = null;
    this.pose('parado');
    this.sync();
  }

  pose(nombre) {
    if (this.poseActual === nombre) return;
    this.poseActual = nombre;
    const m = this.meta[nombre];
    this.spr.setTexture(this.tipo + '_' + nombre);
    this.spr.setOrigin(m.foot / m.w, 1);
    this.spr.setScale(this.escalaBase * (FILA2.includes(nombre) ? this.escalaFila2 : 1));
  }

  // Animacion de caminar alternando 2 cuadros (y "parado" al estar quieto)
  animarCaminar(dt, moviendo) {
    if (!moviendo) { this.pasoAnim = 0; this.pose('parado'); return; }
    this.pasoAnim += dt;
    const ciclo = Math.floor(this.pasoAnim / 0.16) % 4;
    this.pose(['camina1', 'parado', 'camina2', 'parado'][ciclo]);
  }

  get vivo() { return this.estado !== 'muerto' && this.hp > 0; }
  get golpeable() { return this.estado !== 'muerto' && this.estado !== 'caido' && this.invul <= 0; }

  // Recibe un golpe. desdeDir = hacia donde mira el que pega (1 derecha, -1 izquierda)
  recibirGolpe(danio, desdeDir, fuerte) {
    if (!this.golpeable) return false;
    this.hp = Math.max(0, this.hp - danio);
    this.dir = -desdeDir;
    this.flash();
    if (this.hp <= 0 || fuerte || this.z > 0) {
      this.derribar(desdeDir);
    } else {
      this.estado = 'herido';
      this.timer = 0.35;
      this.pose(Math.random() < 0.5 ? 'golpe1' : 'golpe2');
      this.vx = desdeDir * 140;
    }
    return true;
  }

  derribar(desdeDir) {
    this.estado = 'caido';
    this.fase = 'vuela';
    this.vx = desdeDir * 280;
    this.vz = 430;
    this.z = Math.max(this.z, 1);
    this.pose('caida');
  }

  flash() {
    this.spr.setTint(0xff7070);
    this.flashHasta = this.scene.time.now + 90;   // (el anfitrion se lo avisa al invitado)
    this.scene.time.delayedCall(90, () => { if (this.spr.active) this.spr.clearTint(); });
  }

  // Fisica comun: salto/gravedad, desplazamiento y limites de la calle
  fisica(dt) {
    const J = window.JUEGO;
    if (this.z > 0 || this.vz !== 0) {
      this.vz -= J.GRAVEDAD * dt;
      this.z += this.vz * dt;
      if (this.z <= 0) { this.z = 0; this.vz = 0; this.alAterrizar(); }
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.limitarX) this.x = Phaser.Math.Clamp(this.x, J.X_MIN, J.X_MAX);
    this.y = Phaser.Math.Clamp(this.y, J.PISO_MIN, J.PISO_MAX);
    if (this.invul > 0) this.invul -= dt;
  }

  alAterrizar() {
    if (this.estado === 'caido' && this.fase === 'vuela') {
      this.fase = 'tirado';
      this.timer = 0.9;
      this.vx = 0;
      this.scene.cameras.main.shake(90, 0.004);
    } else if (this.estado === 'aire') {
      this.estado = 'aterriza';
      this.timer = 0.1;
      this.vx = 0;
      this.pose('aterriza');
    }
  }

  // Actualiza estados que comparten todos (herido, caido). Devuelve true si el estado lo maneja esto.
  actualizarComun(dt) {
    if (this.estado === 'herido') {
      this.vx *= 0.85;
      this.timer -= dt;
      if (this.timer <= 0) { this.estado = 'libre'; this.vx = 0; }
      return true;
    }
    if (this.estado === 'aterriza') {
      this.timer -= dt;
      if (this.timer <= 0) this.estado = 'libre';
      return true;
    }
    if (this.estado === 'caido') {
      if (this.fase === 'vuela') {
        this.angulo = Phaser.Math.Linear(this.angulo, -80 * this.dir, 0.12);
      } else if (this.fase === 'tirado') {
        this.angulo = -82 * this.dir;
        this.timer -= dt;
        if (this.timer <= 0) {
          if (this.hp <= 0) {
            if (this.alQuedarSinVida) this.alQuedarSinVida(); else this.morir();
          }
          else { this.fase = 'levanta'; this.timer = 0.35; this.angulo = 0; this.pose('aterriza'); }
        }
      } else if (this.fase === 'levanta') {
        this.timer -= dt;
        if (this.timer <= 0) { this.estado = 'libre'; this.invul = 0.7; }
      }
      return true;
    }
    if (this.estado === 'muerto') return true;
    return false;
  }

  morir() {
    this.estado = 'muerto';
    this.scene.tweens.add({
      targets: [this.spr, this.sombra], alpha: 0, duration: 900, ease: 'Linear',
      onUpdate: (tw) => { this.spr.visible = Math.floor(tw.elapsed / 80) % 2 === 0; },
      onComplete: () => { this.terminado = true; }
    });
  }

  sync() {
    this.spr.x = this.x;
    this.spr.y = this.y - this.z;
    this.spr.setFlipX(this.dir < 0);
    this.spr.angle = this.estado === 'caido' && !(this.caidaAcostada && this.poseActual === 'caida') ? this.angulo : 0;
    this.spr.setDepth(this.y);
    this.sombra.x = this.x;
    this.sombra.y = this.y;
    this.sombra.setDepth(this.y - 1);
    const s = Math.max(0.4, 1 - this.z / 400);
    this.sombra.setScale(s);
    // parpadeo mientras es invulnerable
    if (this.estado !== 'muerto') this.spr.alpha = (this.invul > 0 && Math.floor(this.invul * 12) % 2 === 0) ? 0.35 : 1;
  }

  destruir() {
    this.spr.destroy();
    this.sombra.destroy();
  }
}
window.Luchador = Luchador;
