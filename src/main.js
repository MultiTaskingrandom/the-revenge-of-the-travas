// Arranque del juego
window.juego = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'juego',
  width: window.JUEGO.ANCHO,
  height: window.JUEGO.ALTO,
  backgroundColor: '#0a0c22',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 4 },   // varios dedos a la vez en celulares
  scene: [EscenaCarga, EscenaMenu, EscenaElegir, EscenaSala, EscenaHistoria, EscenaNivel, EscenaFinal]
});
