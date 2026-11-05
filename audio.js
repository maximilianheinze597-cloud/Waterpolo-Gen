// Synthetische Sounds (WebAudio) – keine Dateien nötig
(function () {
  const WP = (globalThis.WP = globalThis.WP || {});
  let ctx = null, master = null, crowdGain = null, enabled = true;

  function init() {
    if (ctx || typeof AudioContext === 'undefined') return;
    try {
      ctx = new AudioContext();
      master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
      // Publikum: gefiltertes Rauschen
      const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.5;
      crowdGain = ctx.createGain(); crowdGain.gain.value = 0.05;
      src.connect(f); f.connect(crowdGain); crowdGain.connect(master); src.start();
    } catch (e) { ctx = null; }
  }
  function noise(dur, freq, vol, type) {
    if (!ctx || !enabled) return;
    const len = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = ctx.createBufferSource(); s.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(master); s.start();
  }
  function tone(freq, dur, vol, type, vib) {
    if (!ctx || !enabled) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    if (vib) {
      const l = ctx.createOscillator(), lg = ctx.createGain();
      l.frequency.value = vib; lg.gain.value = freq * 0.03; l.connect(lg); lg.connect(o.frequency); l.start(); l.stop(ctx.currentTime + dur);
    }
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + dur);
  }

  WP.Audio = {
    init, resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); },
    setEnabled(v) { enabled = v; if (master) master.gain.value = v ? 0.5 : 0; },
    isEnabled: () => enabled,
    whistle(n) {
      n = n || 1;
      for (let i = 0; i < n; i++) setTimeout(() => tone(2750, 0.32, 0.25, 'sine', 38), i * 380);
    },
    splash(v) { noise(0.25, 1800, Math.min(0.35, 0.05 + (v || 1) * 0.04)); },
    ball(v) { tone(180, 0.09, Math.min(0.4, 0.1 + (v || 1) * 0.02), 'triangle'); noise(0.06, 900, 0.12); },
    post() { tone(620, 0.35, 0.3, 'square'); tone(930, 0.25, 0.12, 'sine'); },
    save() { noise(0.12, 600, 0.3); tone(140, 0.12, 0.25, 'triangle'); },
    horn() { tone(220, 1.1, 0.35, 'sawtooth'); tone(330, 1.1, 0.2, 'sawtooth'); },
    goal() {
      if (crowdGain) { crowdGain.gain.setTargetAtTime(0.22, ctx.currentTime, 0.05); crowdGain.gain.setTargetAtTime(0.05, ctx.currentTime + 2.2, 0.6); }
      tone(440, 0.5, 0.2, 'square'); setTimeout(() => tone(660, 0.6, 0.2, 'square'), 180);
    },
    cheer(a) { if (crowdGain) { crowdGain.gain.setTargetAtTime(0.05 + (a || 0.08), ctx.currentTime, 0.1); crowdGain.gain.setTargetAtTime(0.05, ctx.currentTime + 1, 0.5); } },
  };
})();
