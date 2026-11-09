// Efectos de sonido sintetizados (no necesitan archivos de audio).
window.Sonido = (function () {
  let ctx = null;
  function ac() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function ruido(dur, vol, frec, tipoFiltro) {
    const a = ac(); if (!a) return;
    const n = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, n, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = a.createBufferSource(); src.buffer = buf;
    const f = a.createBiquadFilter(); f.type = tipoFiltro || 'lowpass'; f.frequency.value = frec;
    const g = a.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(a.destination);
    src.start();
  }

  function tono(frec, frecFin, dur, vol, forma) {
    const a = ac(); if (!a) return;
    const o = a.createOscillator(); o.type = forma || 'square';
    const g = a.createGain();
    const t = a.currentTime;
    o.frequency.setValueAtTime(frec, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, frecFin), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t); o.stop(t + dur);
  }

  return {
    activar: ac,
    aire: () => ruido(0.12, 0.25, 1800, 'bandpass'),
    golpe: () => { ruido(0.12, 0.6, 900); tono(160, 50, 0.15, 0.35, 'sine'); },
    fuerte: () => { ruido(0.25, 0.8, 600); tono(120, 35, 0.3, 0.5, 'sine'); },
    salto: () => tono(250, 600, 0.15, 0.12, 'square'),
    disparo: () => { ruido(0.2, 0.7, 3000, 'highpass'); tono(300, 60, 0.12, 0.2, 'sawtooth'); },
    menu: () => tono(660, 880, 0.08, 0.12, 'square'),
    elegir: () => { tono(523, 1046, 0.15, 0.15, 'square'); },
    herida: () => tono(400, 120, 0.25, 0.2, 'sawtooth'),
    victoria: () => {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tono(f, f, 0.25, 0.15, 'square'), i * 160));
    },
    derrota: () => {
      [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tono(f, f * 0.98, 0.35, 0.15, 'triangle'), i * 260));
    }
  };
})();
