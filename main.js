// Menü, Eingabe, Hauptschleife
(function () {
  const WP = globalThis.WP, C = WP.C;
  const $ = (id) => document.getElementById(id);
  const cv = $('cv'), R = new WP.Renderer(cv);
  let game = null, paused = false, running = false, last = 0, acc = 0;
  const keys = {};

  // ---------- Menü ----------
  const fill = (el, items, fn, sel) => { el.innerHTML = ''; items.forEach((it, i) => { const o = document.createElement('option'); o.value = fn.v(it, i); o.textContent = fn.t(it); el.appendChild(o); }); if (sel !== undefined) el.value = sel; };
  fill($('selHome'), WP.TEAMS, { v: (t, i) => i, t: t => t.name }, 0);
  fill($('selAway'), WP.TEAMS, { v: (t, i) => i, t: t => t.name }, 1);
  fill($('selCap'), WP.CAPS.slice(0, 6), { v: c => c.id, t: c => c.name }, 'white');
  fill($('selStyle'), WP.CAP_STYLES, { v: s => s.id, t: s => s.name }, 'classic');
  fill($('selDiff'), Object.keys(WP.DIFFICULTY), { v: k => k, t: k => WP.DIFFICULTY[k].name }, 'normal');
  fill($('selLen'), WP.QUARTER_REAL, { v: q => q.id, t: q => q.name }, 180);

  function capEl(hex, ink, style, num, label) {
    const d = document.createElement('div'); d.className = 'pv';
    const c = document.createElement('div'); c.className = 'cap'; c.style.background = hex; c.style.color = ink; c.textContent = num;
    if (style === 'stripe') c.style.background = 'linear-gradient(90deg,' + hex + ' 40%,#1f46c8 40%,#1f46c8 60%,' + hex + ' 60%)';
    if (style === 'panels') c.style.background = 'linear-gradient(90deg,' + hex + ' 50%,#9db8f2 50%)';
    if (style !== 'classic' && num !== 1) c.style.color = '#101830';
    d.appendChild(c); d.appendChild(document.createTextNode(label)); return d;
  }
  function preview() {
    const p = $('preview'); p.innerHTML = '';
    const cap = WP.CAPS.find(c => c.id === $('selCap').value), st = $('selStyle').value;
    p.appendChild(capEl(cap.hex, cap.ink, st, 7, 'Feldspieler'));
    p.appendChild(capEl(WP.GK_CAP.hex, WP.GK_CAP.ink, 'classic', 1, 'Torwart'));
    const blue = cap.id === 'blue' || cap.id === 'navy' ? WP.CAPS[0] : WP.CAPS[1];
    p.appendChild(capEl(blue.hex, blue.ink, 'classic', 5, 'Gegner'));
  }
  ['selCap', 'selStyle'].forEach(i => $(i).addEventListener('change', preview)); preview();

  function info(title, rows) {
    $('infoTitle').textContent = title;
    $('infoBody').innerHTML = '<table>' + rows.map(r => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>').join('') + '</table>';
    $('info').classList.remove('hidden');
  }
  $('btnRules').onclick = () => info('Wasserball-Regeln im Spiel', WP.RULES_TEXT);
  $('btnControls').onclick = () => info('Steuerung', WP.CONTROLS_TEXT);
  $('btnInfoClose').onclick = () => $('info').classList.add('hidden');

  function start() {
    let h = +$('selHome').value, a = +$('selAway').value;
    if (h === a) a = (h + 1) % WP.TEAMS.length;
    WP.Audio.init(); WP.Audio.resume();
    game = new WP.Game({ home: h, away: a, cap: $('selCap').value, style: $('selStyle').value, diff: $('selDiff').value, quarterReal: +$('selLen').value });
    ['menu', 'result', 'pause'].forEach(i => $(i).classList.add('hidden'));
    paused = false; running = true; last = performance.now(); R.resize();
  }
  $('btnStart').onclick = start; $('btnAgain').onclick = start;
  const toMenu = () => { running = false; game = null; ['pause', 'result'].forEach(i => $(i).classList.add('hidden')); $('menu').classList.remove('hidden'); };
  $('btnMenu').onclick = toMenu; $('btnQuit').onclick = toMenu;
  $('btnResume').onclick = () => setPause(false);
  $('btnSound').onclick = () => { WP.Audio.setEnabled(!WP.Audio.isEnabled()); $('btnSound').textContent = WP.Audio.isEnabled() ? '🔊 Ton an' : '🔇 Ton aus'; };
  function setPause(v) { if (!game || game.finished) return; paused = v; $('pause').classList.toggle('hidden', !v); last = performance.now(); }

  // ---------- Eingabe ----------
  const I = () => game && game.input;
  function updMove() {
    const i = I(); if (!i) return;
    i.mx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    i.my = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
    i.sprint = !!(keys.ShiftLeft || keys.ShiftRight);
  }
  addEventListener('keydown', (e) => {
    if (!game) return;
    if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (e.repeat) { keys[e.code] = true; updMove(); return; }
    keys[e.code] = true; const i = I();
    if (e.code === 'Escape' || e.code === 'KeyP') return setPause(!paused);
    if (e.code === 'Space') { i.tackle = true; game.diveSel = 0; }
    if (e.code === 'KeyE') i.pass = true;
    if (e.code === 'KeyF') i.fake = true;
    if (e.code === 'KeyQ' || e.code === 'Tab') i.switchP = true;
    if (e.code === 'KeyX') i.sub = true;
    if (e.code === 'KeyT') i.timeout = true;
    if (e.code === 'KeyW' || e.code === 'ArrowUp') game.diveSel = -1;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') game.diveSel = 1;
    updMove();
  });
  addEventListener('keyup', (e) => { keys[e.code] = false; updMove(); });
  cv.addEventListener('mousemove', (e) => {
    if (!game) return; const r = cv.getBoundingClientRect(), w = R.toWorld(e.clientX - r.left, e.clientY - r.top);
    game.input.aimX = w.x; game.input.aimY = w.y;
  });
  cv.addEventListener('mousedown', (e) => {
    if (!game || paused) return; WP.Audio.resume();
    if (e.button === 0) game.input.shootHeld = true;
    if (e.button === 2) game.input.pass = true;
  });
  addEventListener('mouseup', (e) => { if (game && e.button === 0 && game.input.shootHeld) { game.input.shootHeld = false; game.input.shootRelease = true; } });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  addEventListener('resize', () => R.resize());
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (game) updMove(); setPause(true); });

  // ---------- Schleife ----------
  function showResult() {
    const g = game, a = g.teams[0], b = g.teams[1];
    $('resTitle').textContent = g.winner === 0 ? '🏆 Sieg für ' + a.def.name + '!' : g.winner === 1 ? 'Niederlage gegen ' + b.def.name : 'Unentschieden';
    $('resScore').textContent = a.score + ' : ' + b.score + (g.so ? '  (' + g.so.goals[0] + ':' + g.so.goals[1] + ' n.E.)' : '');
    const rows = [['Schüsse', a.stats.shots, b.stats.shots], ['Paraden', a.stats.saves, b.stats.saves], ['Fouls', a.stats.fouls, b.stats.fouls],
      ['Hinausstellungen', a.stats.excl, b.stats.excl], ['Strafwürfe', a.stats.pens, b.stats.pens], ['Ballbesitz (s)', Math.round(a.stats.poss), Math.round(b.stats.poss)]];
    const scorers = (T) => T.players.filter(p => p.goals).map(p => '#' + p.num + ' ' + p.name + ' ' + p.goals).join(', ') || '–';
    rows.push(['Torschützen', scorers(a), scorers(b)]);
    $('resStats').innerHTML = '<div class="stat"><b>' + a.def.short + '</b><span></span><b>' + b.def.short + '</b></div>' + rows.map(r => '<div class="stat"><span>' + r[1] + '</span><span style="color:#9fb4d3">' + r[0] + '</span><span>' + r[2] + '</span></div>').join('');
    $('result').classList.remove('hidden');
  }
  function loop(now) {
    requestAnimationFrame(loop);
    if (!game) { R.draw(WP.idle || (WP.idle = new WP.Game({ home: 0, away: 1, auto: true, quarterReal: 90 })), 0.016, null); WP.idle.update(0.016); return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (running && !paused && !game.finished) { acc += dt; let n = 0; while (acc >= 1 / 60 && n++ < 4) { game.update(1 / 60); acc -= 1 / 60; } if (game.finished && $('result').classList.contains('hidden')) setTimeout(showResult, 1200); }
    R.draw(game, paused ? 0 : dt, { aim: true });
  }
  requestAnimationFrame(loop);
  WP.debug = { get game() { return game; } };
})();
