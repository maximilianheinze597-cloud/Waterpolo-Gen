// Zeichnen: Becken, Tore, Spieler mit Kappen, Schiedsrichter, HUD
(function () {
  const WP = globalThis.WP, C = WP.C, U = WP.U;
  const SKIN = ['#e9bd9a', '#cf9873', '#f2cfb0', '#b07a55', '#dba984'];

  class Renderer {
    constructor(canvas) {
      this.cv = canvas; this.ctx = canvas.getContext('2d'); this.ripples = []; this.shake = 0; this.flash = 0; this.resize();
    }
    resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1), w = this.cv.clientWidth, h = this.cv.clientHeight;
      this.cv.width = w * dpr; this.cv.height = h * dpr; this.dpr = dpr; this.cw = w; this.ch = h;
      this.s = Math.min((w - 30) / (C.W + 4), (h - 110) / (C.H + 5));
      this.ox = (w - C.W * this.s) / 2; this.oy = (h - C.H * this.s) / 2 + 22;
    }
    X(x) { return this.ox + x * this.s; } Y(y) { return this.oy + y * this.s; }
    toWorld(px, py) { return { x: (px - this.ox) / this.s, y: (py - this.oy) / this.s }; }

    eat(g) {
      for (const e of g.events) {
        if (e.type === 'wake' && this.ripples.length < 160) this.ripples.push({ x: e.x, y: e.y, r: 0.2, a: 0.35, g: 1.5 });
        else if (e.type === 'splash') this.ripples.push({ x: e.x, y: e.y, r: 0.2, a: 0.7, g: 3 });
        else if (e.type === 'goal') { this.flash = 1; this.shake = 0.5; }
        else if (e.type === 'post' || e.type === 'save') this.shake = 0.25;
      }
      g.events.length = 0;
    }

    draw(g, dt, ui) {
      const c = this.ctx, s = this.s; this.eat(g);
      c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.shake = Math.max(0, this.shake - dt * 1.6); this.flash = Math.max(0, this.flash - dt);
      if (this.shake > 0) c.translate((Math.random() - 0.5) * this.shake * 6, (Math.random() - 0.5) * this.shake * 6);
      this.deck(c, g);
      this.pool(c, g, dt);
      this.goals(c, g);
      for (const r of g.refs) this.person(c, r.x, r.y < C.H / 2 ? -1.35 : C.H + 1.35, '#f4f4f4', '#222', 0, r.flag, r.y < C.H / 2 ? 1 : -1);
      g.refs.forEach((r, i) => { r.y = i === 0 ? 0 : C.H; });
      g.goalJudges.forEach((j, i) => this.person(c, i === 0 ? -0.9 : C.W + 0.9, -1.2, '#f4f4f4', '#222', 0, j.w > 0 ? '#fff' : null, 1));
      const order = g.players.filter(p => p.inPool).sort((a, b) => a.y - b.y);
      for (const p of order) this.player(c, g, p);
      this.ball(c, g);
      if (g.sel && g.sel.inPool) this.selMark(c, g, g.sel);
      if (ui && ui.aim && g.sel && g.ball.owner === g.sel) this.aimLine(c, g, ui);
      this.hud(c, g, ui);
      if (this.flash > 0) { c.fillStyle = 'rgba(255,255,255,' + this.flash * 0.25 + ')'; c.fillRect(0, 0, this.cw, this.ch); }
    }

    deck(c, g) {
      const w = this.cw, h = this.ch;
      const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#10243f'); gr.addColorStop(1, '#0a182b');
      c.fillStyle = gr; c.fillRect(-10, -10, w + 20, h + 20);
      // Tribüne (Zuschauer als Punkte)
      const rows = 3; let n = 0;
      for (let r = 0; r < rows; r++) for (let x = 6; x < w; x += 9) {
        n++; const col = ['#c93a3a', '#e8e8e8', '#2f5bd0', '#e8c43a', '#3aa55f'][(n * 7 + r * 3) % 5];
        c.fillStyle = col; c.globalAlpha = 0.5; c.beginPath(); c.arc(x + (r % 2) * 4, 8 + r * 9, 3, 0, 6.3); c.fill();
        c.beginPath(); c.arc(x + (r % 2) * 4, h - 8 - r * 9, 3, 0, 6.3); c.fill();
      }
      c.globalAlpha = 1;
      // Beckenrand
      const s = this.s; c.fillStyle = '#cdd6df';
      c.fillRect(this.X(-1.9), this.Y(-1.9), (C.W + 3.8) * s, (C.H + 3.8) * s);
      c.fillStyle = '#9fb0c2'; c.fillRect(this.X(-0.4), this.Y(-0.4), (C.W + 0.8) * s, (C.H + 0.8) * s);
    }

    pool(c, g, dt) {
      const s = this.s, x0 = this.X(0), y0 = this.Y(0), w = C.W * s, h = C.H * s, t = g.time;
      const gr = c.createLinearGradient(0, y0, 0, y0 + h); gr.addColorStop(0, '#1b5fb4'); gr.addColorStop(0.5, '#1a52a3'); gr.addColorStop(1, '#144a96');
      c.fillStyle = gr; c.fillRect(x0, y0, w, h);
      c.save(); c.beginPath(); c.rect(x0, y0, w, h); c.clip();
      c.strokeStyle = 'rgba(255,255,255,0.06)'; c.lineWidth = 1;
      for (let i = 0; i < 26; i++) {
        const yy = y0 + (i / 26) * h; c.beginPath();
        for (let x = 0; x <= w; x += 14) { const yv = yy + Math.sin(x * 0.04 + t * 1.3 + i) * 2.2; x ? c.lineTo(x0 + x, yv) : c.moveTo(x0, yv); }
        c.stroke();
      }
      // Linien
      const line = (xm, col, wd, dash) => {
        c.strokeStyle = col; c.lineWidth = wd; c.setLineDash(dash || []);
        for (const x of [xm, C.W - xm]) { if (xm === C.W / 2 && x !== xm) continue; c.beginPath(); c.moveTo(this.X(x), y0); c.lineTo(this.X(x), y0 + h); c.stroke(); }
        c.setLineDash([]);
      };
      line(C.W / 2, 'rgba(255,255,255,0.9)', 3);
      line(C.L2, '#e5383b', 3, [10, 6]); line(C.L5, '#f2cc1e', 3, [10, 6]); line(C.L6, '#37b24d', 3, [10, 6]);
      c.strokeStyle = '#fff'; c.lineWidth = 3;
      for (const x of [0, C.W]) { c.beginPath(); c.moveTo(this.X(x), y0); c.lineTo(this.X(x), y0 + h); c.stroke(); }
      // 5-m-Strafwurfpunkte
      c.fillStyle = '#fff';
      for (const x of [C.L5, C.W - C.L5]) { c.beginPath(); c.arc(this.X(x), this.Y(C.H / 2), 3, 0, 6.3); c.fill(); }
      // Wellen
      for (let i = this.ripples.length - 1; i >= 0; i--) {
        const r = this.ripples[i]; r.r += dt * r.g; r.a -= dt * 0.55;
        if (r.a <= 0) { this.ripples.splice(i, 1); continue; }
        c.strokeStyle = 'rgba(255,255,255,' + r.a + ')'; c.lineWidth = 1.5; c.beginPath(); c.arc(this.X(r.x), this.Y(r.y), r.r * s * 0.5, 0, 6.3); c.stroke();
      }
      c.restore();
      // Leinen mit Schwimmern (rot/weiß wie im Foto)
      for (const yy of [0, C.H]) {
        for (let x = 0.25; x < C.W; x += 0.5) {
          c.fillStyle = Math.floor(x * 2) % 4 < 2 ? '#e5383b' : '#fff';
          c.beginPath(); c.arc(this.X(x), this.Y(yy), s * 0.12, 0, 6.3); c.fill();
        }
      }
    }

    goals(c, g) {
      const s = this.s, hw = C.GOAL_W / 2;
      for (const side of [0, 1]) {
        const x = side ? C.W : 0, dir = side ? 1 : -1, yA = this.Y(C.H / 2 - hw), yB = this.Y(C.H / 2 + hw), d = s * 1.1;
        const nx0 = side ? this.X(x) : this.X(x) - d;
        c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(nx0, yA, d, yB - yA);
        c.strokeStyle = '#ff6a2b'; c.lineWidth = 1.2; c.beginPath();
        for (let i = 0; i <= 10; i++) { const yy = yA + (yB - yA) * i / 10; c.moveTo(nx0, yy); c.lineTo(nx0 + d, yy); }
        for (let i = 0; i <= 4; i++) { const xx = nx0 + d * i / 4; c.moveTo(xx, yA); c.lineTo(xx, yB); }
        c.stroke();
        c.strokeStyle = '#fff'; c.lineWidth = 4; c.beginPath(); c.moveTo(nx0, yA); c.lineTo(nx0 + d, yA); c.lineTo(nx0 + d, yB); c.lineTo(nx0, yB); c.stroke();
        c.fillStyle = '#fff'; c.beginPath(); c.arc(this.X(x), yA, 5, 0, 6.3); c.arc(this.X(x), yB, 5, 0, 6.3); c.fill();
      }
    }

    person(c, x, y, shirt, ink, face, flag, fdir) {
      const s = this.s, X = this.X(x), Y = this.Y(y);
      c.fillStyle = shirt; c.beginPath(); c.ellipse(X, Y, s * 0.5, s * 0.33, 0, 0, 6.3); c.fill();
      c.fillStyle = '#d8a27d'; c.beginPath(); c.arc(X, Y, s * 0.22, 0, 6.3); c.fill();
      if (flag) {
        c.strokeStyle = '#444'; c.lineWidth = 2; c.beginPath(); c.moveTo(X + s * 0.3, Y); c.lineTo(X + s * 0.3, Y + fdir * s * 1.0); c.stroke();
        c.fillStyle = flag; c.fillRect(X + s * 0.3, Y + fdir * s * 1.0 - (fdir > 0 ? 0 : s * 0.35), s * 0.5, s * 0.35); c.strokeStyle = '#222'; c.lineWidth = 1; c.strokeRect(X + s * 0.3, Y + fdir * s * 1.0 - (fdir > 0 ? 0 : s * 0.35), s * 0.5, s * 0.35);
      }
    }

    player(c, g, p) {
      const s = this.s, X = this.X(p.x), Y = this.Y(p.y), T = g.teams[p.team];
      const cap = p.gk ? WP.GK_CAP : T.cap, skin = SKIN[p.id % SKIN.length];
      const sp = Math.hypot(p.vx, p.vy), bob = Math.sin(g.time * 7 + p.id) * sp * 0.015 * s;
      c.save(); c.translate(X, Y + bob); c.rotate(p.face);
      c.fillStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.ellipse(0, 0, s * 0.62, s * 0.5, 0, 0, 6.3); c.fill();
      const reach = (g.ball.owner === p) ? 0.95 : 0.55 + (p.dive > 0 ? 0.55 : 0);
      c.strokeStyle = skin; c.lineWidth = s * 0.17; c.lineCap = 'round';
      const raise = p.gk && (p.dive > 0 || g.ball.flight === 'shot') ? 1.3 : 1;
      c.beginPath(); c.moveTo(s * 0.08, -s * 0.34); c.lineTo(s * reach * 0.6 * raise, -s * (0.45 + 0.35 * (raise - 1) * 3)); c.moveTo(s * 0.08, s * 0.34); c.lineTo(s * reach * 0.6 * raise, s * (0.45 + 0.35 * (raise - 1) * 3)); c.stroke();
      c.fillStyle = skin; c.beginPath(); c.ellipse(0, 0, s * 0.2, s * 0.43, 0, 0, 6.3); c.fill();
      c.restore();
      // Kappe
      const r = s * 0.31;
      c.fillStyle = cap.hex; c.beginPath(); c.arc(X, Y + bob, r, 0, 6.3); c.fill();
      const ink = cap.ink;
      if (!p.gk && T.style === 'stripe') { c.fillStyle = T.cap.id === 'white' ? '#1f46c8' : '#fff'; c.save(); c.beginPath(); c.arc(X, Y + bob, r, 0, 6.3); c.clip(); c.fillRect(X - r * 0.22, Y + bob - r, r * 0.44, r * 2); c.restore(); }
      if (!p.gk && T.style === 'panels') { c.fillStyle = T.cap.id === 'white' ? '#9db8f2' : '#bbb'; c.save(); c.beginPath(); c.arc(X, Y + bob, r, 0, 6.3); c.clip(); c.fillRect(X, Y + bob - r, r, r * 2); c.restore(); }
      c.fillStyle = p.team === 0 ? '#e5383b' : '#fff'; // Ohrenschützer
      const ex = Math.cos(p.face + Math.PI / 2) * r, ey = Math.sin(p.face + Math.PI / 2) * r;
      c.beginPath(); c.arc(X + ex, Y + bob + ey, r * 0.28, 0, 6.3); c.arc(X - ex, Y + bob - ey, r * 0.28, 0, 6.3); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 1; c.beginPath(); c.arc(X, Y + bob, r, 0, 6.3); c.stroke();
      c.fillStyle = (!p.gk && (T.style !== 'classic')) ? '#101830' : ink; c.font = 'bold ' + Math.round(r * 1.1) + 'px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(p.num, X - (T.style === 'stripe' && !p.gk ? r * 0.0 : 0), Y + bob + 1);
    }

    ball(c, g) {
      const b = g.ball, s = this.s, X = this.X(b.x), Y = this.Y(b.y), r = Math.max(4, s * C.BR * 1.35 * (1 + b.z * 0.25));
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(X + b.z * 5, Y + b.z * 7 + 2, r, r * 0.75, 0, 0, 6.3); c.fill();
      const cy = Y - b.z * s * 0.35;
      c.save(); c.beginPath(); c.arc(X, cy, r, 0, 6.3); c.clip();
      c.fillStyle = '#f5c518'; c.fillRect(X - r, cy - r, r * 2, r * 2);
      c.fillStyle = '#d7263d'; c.fillRect(X - r, cy - r, r * 0.9, r * 2);
      c.fillStyle = '#2748b8'; c.fillRect(X + r * 0.1, cy - r, r, r * 0.9);
      c.restore(); c.strokeStyle = '#222'; c.lineWidth = 1; c.beginPath(); c.arc(X, cy, r, 0, 6.3); c.stroke();
    }

    selMark(c, g, p) {
      const s = this.s, X = this.X(p.x), Y = this.Y(p.y);
      c.strokeStyle = '#fff'; c.lineWidth = 2; c.setLineDash([5, 4]); c.beginPath(); c.arc(X, Y, s * 0.62, 0, 6.3); c.stroke(); c.setLineDash([]);
      c.fillStyle = '#ffe14d'; c.beginPath(); c.moveTo(X, Y - s * 0.75); c.lineTo(X - 6, Y - s * 0.75 - 11); c.lineTo(X + 6, Y - s * 0.75 - 11); c.closePath(); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(X - 15, Y + s * 0.72, 30, 4); c.fillStyle = p.st > 0.3 ? '#5be37d' : '#ff6b6b'; c.fillRect(X - 15, Y + s * 0.72, 30 * p.st, 4);
    }
    aimLine(c, g, ui) {
      const p = g.sel, X = this.X(p.x), Y = this.Y(p.y), ax = this.X(g.input.aimX), ay = this.Y(g.input.aimY);
      c.strokeStyle = 'rgba(255,255,255,0.5)'; c.setLineDash([4, 6]); c.beginPath(); c.moveTo(X, Y); c.lineTo(ax, ay); c.stroke(); c.setLineDash([]);
      c.strokeStyle = '#fff'; c.beginPath(); c.arc(ax, ay, 7, 0, 6.3); c.moveTo(ax - 11, ay); c.lineTo(ax + 11, ay); c.moveTo(ax, ay - 11); c.lineTo(ax, ay + 11); c.stroke();
      if (g.charge > 0) {
        c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(X - 28, Y + this.s * 0.95, 56, 7);
        c.fillStyle = g.charge > 0.85 ? '#ff6b6b' : '#ffe14d'; c.fillRect(X - 28, Y + this.s * 0.95, 56 * g.charge, 7);
      }
    }

    hud(c, g, ui) {
      const w = this.cw, t0 = g.teams[0], t1 = g.teams[1];
      c.textBaseline = 'middle'; c.textAlign = 'center';
      c.fillStyle = 'rgba(8,16,32,0.88)'; this.rr(c, w / 2 - 190, 6, 380, 46, 10); c.fill();
      const dot = (x, T) => { c.fillStyle = T.cap.hex; c.beginPath(); c.arc(x, 29, 9, 0, 6.3); c.fill(); c.strokeStyle = '#000'; c.lineWidth = 1; c.stroke(); };
      dot(w / 2 - 170, t0); dot(w / 2 + 170, t1);
      c.fillStyle = '#fff'; c.font = '600 13px system-ui'; c.textAlign = 'left'; c.fillText(t0.def.short, w / 2 - 154, 29); c.textAlign = 'right'; c.fillText(t1.def.short, w / 2 + 154, 29);
      c.textAlign = 'center'; c.font = '800 28px system-ui'; c.fillText(t0.score + ' : ' + t1.score, w / 2, 24);
      c.font = '600 11px system-ui'; c.fillStyle = '#9fb4d3';
      c.fillText(g.phase === 'shootout' ? 'Penaltyschießen' : g.quarter + '. Viertel · ' + U.fmtClock(g.clock), w / 2, 43);
      // Angriffszeit
      if (g.poss >= 0 && g.phase !== 'shootout') {
        const sc = Math.max(0, Math.ceil(g.shotClock)); c.fillStyle = sc <= 5 ? '#ff5d5d' : '#ffd166';
        c.fillStyle = 'rgba(8,16,32,0.88)'; this.rr(c, w / 2 - 28, 56, 56, 24, 8); c.fill();
        c.fillStyle = sc <= 5 ? '#ff5d5d' : '#ffd166'; c.font = '800 16px system-ui'; c.fillText(sc, w / 2, 69);
        c.fillStyle = g.teams[g.poss].cap.hex; c.beginPath(); c.arc(w / 2 - 20, 68, 4, 0, 6.3); c.fill();
      }
      // Hinausstellungen
      for (let t = 0; t < 2; t++) {
        const list = g.teams[t].players.filter(p => !p.inPool && p.excl > 0);
        list.forEach((p, i) => {
          const x = t === 0 ? 14 : w - 14; c.textAlign = t === 0 ? 'left' : 'right';
          c.fillStyle = 'rgba(8,16,32,0.85)'; const bw = 118; this.rr(c, t === 0 ? x : x - bw, 60 + i * 24, bw, 20, 6); c.fill();
          c.fillStyle = '#ff8a8a'; c.font = '600 12px system-ui'; c.fillText((p.perm ? '✖ ' : '⏱ ') + '#' + p.num + ' ' + (p.excl > 99 ? 'Sperre' : Math.ceil(p.excl) + ' s'), t === 0 ? x + 8 : x - 8, 70 + i * 24);
        });
        c.textAlign = t === 0 ? 'left' : 'right'; c.fillStyle = '#9fb4d3'; c.font = '11px system-ui';
        c.fillText('Auszeiten: ' + g.teams[t].timeouts + '  Fouls: ' + g.teams[t].players.reduce((a, p) => a + p.fouls, 0), t === 0 ? 14 : w - 14, 22);
      }
      // Hinweis & Nachricht
      c.textAlign = 'center';
      if (g.message.t > 0) {
        const m = g.message.text; c.font = '700 20px system-ui'; const tw = c.measureText(m).width + 36;
        c.fillStyle = 'rgba(8,16,32,0.9)'; this.rr(c, w / 2 - tw / 2, this.ch - 64, tw, 38, 10); c.fill(); c.fillStyle = '#fff'; c.fillText(m, w / 2, this.ch - 45);
      }
      if (g.phase === 'restart' && g.rs) {
        const tx = { free: 'Freiwurf', corner: 'Eckball', throw: 'Torabwurf', penalty: 'Strafwurf' }[g.rs.type] || '';
        c.fillStyle = '#ffd166'; c.font = '700 14px system-ui';
        c.fillText(tx + ' ' + g.teams[g.rs.team].def.short + (g.rs.team === 0 ? ' – Pass: Rechtsklick/E · Wurf: Klick' : ''), w / 2, this.ch - 84);
        if (g.rs.type === 'penalty' && g.rs.team === 1) c.fillText('Torwart: W/S = oben/unten, Leertaste = Mitte', w / 2, this.ch - 104);
        if (g.rs.team === 0 && g.rs.type === 'free' && g.freeNoShot) { c.fillStyle = '#ff9d9d'; c.fillText('Innerhalb 6 m: nicht direkt aufs Tor – erst passen!', w / 2, this.ch - 104); }
      }
      if (g.phase === 'swim') { c.fillStyle = '#fff'; c.font = '800 26px system-ui'; c.fillText(g.pt > 0 ? 'Bereit…' : 'Sprint zum Ball!', w / 2, this.ch - 84); }
      if (g.phase === 'shootout' && g.so) {
        const so = g.so; c.font = '700 15px system-ui';
        for (let t = 0; t < 2; t++) {
          let x = w / 2 - 80, y = 100 + t * 24; c.textAlign = 'right'; c.fillStyle = '#fff'; c.fillText(g.teams[t].def.short, x - 10, y);
          c.textAlign = 'center';
          for (let i = 0; i < Math.max(5, so.log[t].length); i++) {
            c.beginPath(); c.arc(x + i * 22, y, 8, 0, 6.3);
            c.fillStyle = i < so.log[t].length ? (so.log[t][i] ? '#4cd964' : '#ff5d5d') : 'rgba(255,255,255,0.2)'; c.fill();
          }
        }
        c.fillStyle = '#ffd166'; c.textAlign = 'center';
        if (so.state === 'aim') c.fillText(so.turn === 0 ? 'Du schießt: Maus zielen, Klick halten = höher, loslassen = Wurf' : 'Gegner schießt – Torwart: W/S = oben/unten, Leertaste = Mitte', w / 2, this.ch - 84);
      }
    }
    rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  }
  WP.Renderer = Renderer;
})();
