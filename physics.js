// Ball-Physik, Schüsse, Pässe, Paraden, Tore, Fouls, Strafwurf
(function () {
  const WP = globalThis.WP, C = WP.C, U = WP.U, G = 9.8, P = WP.Game.prototype;
  const A = () => WP.Audio;

  P.setOwner = function (p) {
    const b = this.ball;
    if (b.owner === p) return;
    const prev = this.poss;
    b.owner = p; b.flight = null; b.vx = b.vy = b.vz = 0; b.z = 0; b.pen = false;
    b.lastTeam = p.team; b.lastPlayer = p; b.tried = {}; p.holdT = 0;
    if (prev !== p.team) { this.poss = p.team; this.shotClock = C.SHOT_CLOCK; this.freeNoShot = false; }
  };
  P.endRestart = function () {
    if (this.phase === 'restart') { this.phase = 'play'; this.rs = null; A() && A().whistle(1); this.ev('whistle'); }
  };
  P.pressure = function (p) {
    let m = 9;
    for (const o of this.pool(1 - p.team)) m = Math.min(m, U.dist(o, p));
    return U.clamp(1 - (m - 0.6) / 2.4, 0, 1);
  };
  P.openness = function (p) {
    let m = 9;
    for (const o of this.pool(1 - p.team)) if (!o.gk) m = Math.min(m, U.dist(o, p));
    return m;
  };

  // ---------- Schuss ----------
  P.shoot = function (p, tx, ty, h, power) {
    const b = this.ball, pen = (this.rs && this.rs.type === 'penalty') || this.phase === 'shootout';
    this.endRestart();
    const dist = Math.max(1, Math.hypot(tx - p.x, ty - p.y));
    const skill = p.attr.shoot * (p.team === 1 ? this.diff.aim : 0.85);
    const err = (1.18 - skill) * 0.95 * (0.5 + this.pressure(p)) + (power > 0.92 ? 0.15 : 0);
    ty += (this.rng() - 0.5) * 2 * err * Math.min(1.6, dist / 5);
    h = U.clamp(h + (this.rng() - 0.5) * err * 0.7, -0.1, 1.3);
    const speed = 9 + 11 * power * p.attr.shoot, T = dist / speed;
    const nx = (tx - p.x) / dist, ny = (ty - p.y) / dist, z0 = 0.5, zT = h * C.GOAL_H;
    b.owner = null; b.flight = 'shot'; b.x = p.x + nx * 0.5; b.y = p.y + ny * 0.5; b.z = z0;
    b.vx = nx * speed; b.vy = ny * speed; b.vz = (zT - z0 + 0.5 * G * T * T) / T;
    b.shotTeam = p.team; b.shotT = 0; b.lastTeam = p.team; b.lastPlayer = p; b.noPick = 0.3; b.tried = {};
    b.pen = pen; b.penSide = ty - C.H / 2 < -0.55 ? -1 : ty - C.H / 2 > 0.55 ? 1 : 0;
    p.cd = 0.5; this.freeNoShot = false;
    this.teams[p.team].stats.shots++;
    if (pen) this.penaltyGk(p, b.penSide);
    this.ev('shot', p.x, p.y, speed); A() && A().ball(speed);
    if (this.so) this.so.state = this.phase === 'shootout' ? 'fly' : this.so.state;
    if (this.so && this.phase === 'shootout') this.so.t = 0;
  };
  P.penaltyGk = function (p, side) {
    const gk = this.gkOf(1 - p.team); if (!gk) return;
    let choice;
    if (gk.team === 0 && !this.o.auto) choice = this.diveSel || 0;
    else {
      const sk = gk.attr.gk * (this.diff.gk / 0.7) * 0.5;
      choice = this.rng() < 0.3 * sk ? side : [-1, 0, 1][Math.floor(this.rng() * 3)];
    }
    gk.penChoice = choice; gk.penTarget = C.H / 2 + choice * 1.15; gk.penT = 1.6; gk.dive = 0.8;
  };
  // ---------- Pass ----------
  P.pass = function (p, q, speed) {
    const b = this.ball; this.endRestart();
    let d = Math.max(0.5, U.dist(p, q)); speed = speed || 11;
    let T = d / speed, tx = q.x + q.vx * T * 0.7, ty = q.y + q.vy * T * 0.7;
    const e = (1.15 - p.attr.pass) * 0.7;
    tx += (this.rng() - 0.5) * e; ty += (this.rng() - 0.5) * e;
    d = Math.max(0.5, Math.hypot(tx - p.x, ty - p.y)); T = d / speed;
    const nx = (tx - p.x) / d, ny = (ty - p.y) / d, z0 = 0.4;
    b.owner = null; b.flight = 'pass'; b.x = p.x + nx * 0.5; b.y = p.y + ny * 0.5; b.z = z0;
    b.vx = nx * speed; b.vy = ny * speed; b.vz = (0.5 * G * T * T - z0) / T;
    b.lastTeam = p.team; b.lastPlayer = p; b.noPick = 0.25; b.tried = {}; b.pen = false;
    p.cd = 0.3; this.freeNoShot = false; this.ev('pass', p.x, p.y); A() && A().ball(5);
  };

  // ---------- Ball-Update ----------
  P.updateBall = function (dt) {
    const b = this.ball;
    if (b.owner) {
      const o = b.owner;
      if (!o.inPool) b.owner = null;
      else { b.x = U.clamp(o.x + Math.cos(o.face) * 0.55, 0.15, C.W - 0.15); b.y = U.clamp(o.y + Math.sin(o.face) * 0.55, 0.15, C.H - 0.15); b.z = 0; return; }
    }
    if (this.phase === 'goal') { b.vx *= Math.pow(0.1, dt); b.vy *= Math.pow(0.1, dt); }
    const px = b.x, py = b.y, pz = b.z;
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.z > 0 || b.vz > 0) {
      b.vz -= G * dt; b.z += b.vz * dt;
      if (b.z <= 0) {
        b.z = 0;
        if (b.vz < -2.5) { this.ev('splash', b.x, b.y, -b.vz); A() && A().splash(-b.vz); b.vz = -b.vz * 0.3; b.vx *= 0.75; b.vy *= 0.75; } else b.vz = 0;
      }
    }
    if (b.z === 0) { const k = Math.exp(-1.7 * dt); b.vx *= k; b.vy *= k; if (Math.hypot(b.vx, b.vy) < 1.5 && b.flight) b.flight = null; }
    if (b.noPick > 0) b.noPick -= dt;
    b.shotT += dt;
    if (b.flight === 'shot' && b.shotT > 2.5) b.flight = null;
    // Tor / Torlinie
    const W = C.W, H = C.H;
    const side = b.x < 0 && px >= 0 ? 0 : b.x > W && px <= W ? W : -1;
    if (side !== -1) {
      const lx = side, t = (lx - px) / (b.x - px || 1e-6);
      const yc = py + (b.y - py) * t, zc = pz + (b.z - pz) * t, off = Math.abs(yc - H / 2), hw = C.GOAL_W / 2;
      if (off <= hw && zc <= C.GOAL_H && zc >= -0.3) { this.scoreGoal(lx, yc); }
      else if ((Math.abs(off - hw) < 0.12 && zc < C.GOAL_H + 0.1) || (off < hw && zc > C.GOAL_H && zc < C.GOAL_H + 0.14)) {
        b.x = lx + (lx === 0 ? 0.3 : -0.3); b.vx = -b.vx * 0.45; b.vy += (this.rng() - 0.5) * 3; b.vz = Math.abs(b.vz) * 0.3; b.flight = null;
        b.noPick = 0.15; this.ev('post', lx, yc); A() && A().post(); b.lastTeam = b.lastTeam;
      } else this.outOverLine(lx, yc);
      return;
    }
    if (b.y < 0.12) { b.y = 0.12; b.vy = Math.abs(b.vy) * 0.6; }
    if (b.y > H - 0.12) { b.y = H - 0.12; b.vy = -Math.abs(b.vy) * 0.6; }
    if (this.phase === 'goal') return;
    this.ballContacts(dt);
  };

  P.ballContacts = function (dt) {
    const b = this.ball;
    if (b.owner || b.z > 1.9) return;
    if (b.flight === 'shot' && b.shotT < 2.4) {
      const dt_ = 1 - b.shotTeam, gk = this.gkOf(dt_);
      if (gk && !b.tried[gk.id] && U.dist(gk, b) < 1.15 + (gk.dive > 0 ? 0.6 : 0)) { b.tried[gk.id] = 1; this.gkSave(gk); return; }
      for (const p of this.pool(dt_)) {
        if (p.gk || b.tried[p.id] || b.z > 1.15 || U.dist(p, b) > 0.58) continue;
        b.tried[p.id] = 1;
        if (this.rng() < 0.26 * p.attr.def) {
          b.vx = -b.vx * 0.3 + (this.rng() - 0.5) * 4; b.vy = (this.rng() - 0.5) * 5; b.vz = 1.5; b.flight = null;
          b.lastTeam = p.team; b.lastPlayer = p; b.noPick = 0.2; this.ev('block', p.x, p.y); A() && A().save(); return;
        }
      }
      return;
    }
    const sp = Math.hypot(b.vx, b.vy);
    let cand = this.players.filter(p => p.inPool && U.dist(p, b) < (p.gk ? 0.95 : 0.62) && !(p === b.lastPlayer && b.noPick > 0));
    cand.sort((a, c) => U.dist(a, b) - U.dist(c, b));
    for (const p of cand) {
      if (p.gk && b.z > 1.7) continue; if (!p.gk && b.z > 1.15) continue;
      if (this.phase === 'goal') return;
      if (p.team !== b.lastTeam && b.flight === 'pass') {
        if (b.tried[p.id]) continue; b.tried[p.id] = 1;
        if (this.rng() > 0.5 * p.attr.def * (p.team === 1 ? this.diff.steal : 0.75)) continue;
        this.ev('steal', p.x, p.y);
      }
      this.setOwner(p); if (sp > 4) A() && A().ball(sp); return;
    }
  };

  P.gkSave = function (gk) {
    const b = this.ball, sp = Math.hypot(b.vx, b.vy), skill = gk.attr.gk * (gk.team === 1 ? this.diff.gk / 0.7 : 0.85);
    let ps;
    if (b.pen) ps = (gk.penChoice === b.penSide ? 0.82 : 0.07) * Math.min(1.1, skill);
    else ps = U.clamp(0.4 * skill + 0.12 - (sp - 14) * 0.012 - (b.z > 0.7 ? 0.06 : 0), 0.12, 0.85);
    gk.dive = 0.5;
    if (this.rng() > ps) return; // Schuss geht durch
    this.teams[gk.team].stats.saves++; this.ev('save', gk.x, gk.y); A() && A().save();
    if (this.phase === 'shootout') { this.so.res = 'save'; this.setOwner(gk); return; }
    if (this.rng() < 0.55) { this.setOwner(gk); this.say('Parade! ' + gk.name + ' (#' + gk.num + ')', 1.6); }
    else if (this.rng() < 0.4) {
      this.say('Abgelenkt – Eckball', 1.6);
      const gx = this.ownGoalX(gk.team);
      this.signal(1 - gk.team, gx, b.y);
      this.startRestart('corner', 1 - gk.team, gx + (gx === 0 ? 2 : -2), b.y < C.H / 2 ? 0.7 : C.H - 0.7, C.SHOT_CLOCK_SHORT);
    } else {
      b.vx = (gk.team === 0 ? 1 : -1) * (this.teams[gk.team].dir > 0 ? 1 : -1) * 0 + (this.ownGoalX(gk.team) === 0 ? 1 : -1) * (2 + this.rng() * 3);
      b.vy = (this.rng() - 0.5) * 6; b.vz = 2; b.flight = null; b.lastTeam = gk.team; b.lastPlayer = gk; b.noPick = 0.3;
    }
  };

  P.scoreGoal = function (lx, yc) {
    const b = this.ball, t = this.atkGoalX(0) === lx ? 0 : 1, T = this.teams[t], who = b.lastPlayer;
    if (this.phase === 'shootout') {
      if (this.so.res !== 'goal') { this.so.res = 'goal'; this.ev('goal', lx, yc); A() && A().goal(); }
      b.vx *= 0.1; b.vy *= 0.1; b.x = lx + (lx === 0 ? 0.4 : -0.4); b.vz = 0; b.z = 0; b.flight = null; return;
    }
    T.score++; this.lastGoalTeam = t; b.flight = null; b.x = lx + (lx === 0 ? 0.5 : -0.5); b.vx = b.vy = 0; b.z = 0;
    let txt = 'TOR ' + T.def.short + '!';
    if (who && who.team === t) { who.goals++; txt += ' ' + who.name + ' (#' + who.num + ')'; } else txt += ' (Eigentor)';
    this.say(txt + '  ' + this.teams[0].score + ':' + this.teams[1].score, 3);
    this.phase = 'goal'; this.pt = 3.2; this.rs = null; this.poss = -1; this.shotClock = C.SHOT_CLOCK;
    this.goalJudges[lx === 0 ? 0 : 1].w = 3; this.ev('goal', lx, yc); A() && A().goal(); A() && A().whistle(2);
  };
  P.outOverLine = function (lx, yc) {
    const b = this.ball, defT = this.ownGoalX(0) === lx ? 0 : 1;
    if (this.phase === 'shootout') { if (!this.so.res) this.so.res = 'miss'; b.vx = b.vy = 0; b.x = U.clamp(b.x, 0.3, C.W - 0.3); return; }
    if (b.lastTeam === defT) {
      this.say('Eckball ' + this.teams[1 - defT].def.short, 1.8); this.signal(1 - defT, lx, yc);
      this.startRestart('corner', 1 - defT, lx + (lx === 0 ? 2 : -2), yc < C.H / 2 ? 0.7 : C.H - 0.7, C.SHOT_CLOCK_SHORT);
    } else {
      this.say('Torabwurf ' + this.teams[defT].def.short, 1.6); this.signal(defT, lx, yc);
      const gk = this.gkOf(defT), d = this.teams[defT].dir;
      this.startRestart('throw', defT, lx + d * 0.8, C.H / 2, C.SHOT_CLOCK, gk);
    }
  };

  // ---------- Neustart ----------
  P.startRestart = function (type, team, x, y, clock, taker) {
    const b = this.ball, d = this.teams[team].dir;
    x = U.clamp(x, 0.6, C.W - 0.6); y = U.clamp(y, 0.6, C.H - 0.6);
    taker = taker || this.nearest(team, { x, y }, true) || this.pool(team)[0];
    taker.x = x; taker.y = y; taker.vx = taker.vy = 0; taker.face = d > 0 ? 0 : Math.PI;
    this.phase = 'restart'; this.rs = { type, team, taker, t: 0 };
    b.owner = null; this.setOwner(taker); this.poss = team;
    this.shotClock = clock || C.SHOT_CLOCK; this.freeNoShot = type === 'free';
    for (const o of this.pool(1 - team)) {
      const dx = o.x - x, dy = o.y - y, dd = Math.hypot(dx, dy);
      if (dd < 2.2) { const nx = dd > 0.01 ? dx / dd : -d, ny = dd > 0.01 ? dy / dd : 0; o.x = U.clamp(x + nx * 2.3, 0.4, C.W - 0.4); o.y = U.clamp(y + ny * 2.3, 0.4, C.H - 0.4); }
    }
  };
  P.startPenalty = function (team, x, y) {
    const d = this.teams[team].dir, gx = this.atkGoalX(team), taker = this.field(team).slice().sort((a, c) => c.attr.shoot - a.attr.shoot)[0];
    const dg = this.gkOf(1 - team);
    taker.x = gx - d * C.L5; taker.y = C.H / 2; taker.vx = taker.vy = 0; taker.face = d > 0 ? 0 : Math.PI;
    if (dg) { dg.x = gx - d * 0.5; dg.y = C.H / 2; dg.vx = dg.vy = 0; dg.penTarget = undefined; }
    let i = 0;
    for (const p of this.pool(0).concat(this.pool(1))) {
      if (p === taker || p === dg || p.gk) continue;
      p.x = gx - d * (7.5 + (i % 3) * 1.2); p.y = 3 + (i++) * 1.1; p.vx = p.vy = 0;
    }
    const og = this.gkOf(team); if (og) { og.x = this.ownGoalX(team) + d * 0.6; og.y = C.H / 2; }
    this.phase = 'restart'; this.rs = { type: 'penalty', team, taker, t: 0 };
    this.ball.owner = null; this.setOwner(taker); this.poss = team; this.shotClock = C.SHOT_CLOCK; this.freeNoShot = false;
    this.teams[team].stats.pens++; this.diveSel = 0;
    this.say('STRAFWURF (5 m) ' + this.teams[team].def.short, 2.6);
  };

  // ---------- Fouls ----------
  P.tackle = function (d, c) {
    const s = 0.3 * d.attr.def * (d.team === 1 ? this.diff.steal : 0.8) / c.attr.str * (c.fakeT > 0 ? 0.55 : 1);
    const f = 0.085 * (d.team === 1 ? this.diff.foul : 1) * (d.press > 0 ? 1.3 : 1);
    const r = this.rng();
    if (r < s) { this.setOwner(d); this.ev('steal', d.x, d.y); A() && A().splash(3); this.say('Ballgewinn ' + d.name, 1.0); return 'steal'; }
    if (r < s + f) { this.foulBy(d, c); return 'foul'; }
    return 'none';
  };
  P.foulBy = function (d, c) {
    const u = this.rng(), nearGoal = Math.abs(c.x - this.ownGoalX(d.team)) < C.L5 && this.ball.owner === c;
    d.fouls++; this.teams[d.team].stats.fouls++;
    const kind = nearGoal && u < 0.5 ? 'pen' : u > 0.985 ? 'brutal' : u < 0.4 ? 'excl' : 'ord';
    const ft = this.teams[d.team], nm = d.name + ' (#' + d.num + ')';
    this.signal(c.team, c.x, c.y);
    if (kind === 'ord' || kind === 'excl' || kind === 'pen') {
      if (kind === 'excl' || (kind === 'pen' && u < 0.2)) this.exclude(d, C.EXCL_S, nm + ' – Hinausstellung (' + d.fouls + '. Fehler)');
      else this.say('Foul ' + nm, 1.5);
    }
    if (kind === 'brutal') { d.fouls = 9; this.exclude(d, C.BRUTAL_S, 'BRUTALITÄT! ' + nm + ' – Rote Karte'); }
    if (d.fouls >= C.MAX_FOULS && d.inPool === false && !d.perm) { d.perm = true; this.say(nm + ' – 3. Fehler, ausgeschlossen', 2.2); }
    if (kind === 'pen' || kind === 'brutal') { if (c.team === 0 || true) this.startPenalty(c.team); return; }
    const gxA = this.atkGoalX(c.team), nearSix = Math.abs(c.x - gxA) < C.L2 ? 0 : 0;
    this.startRestart('free', c.team, c.x, c.y, kind === 'excl' ? C.SHOT_CLOCK_SHORT : C.SHOT_CLOCK, this.nearest(c.team, c, true));
  };
  P.exclude = function (p, secs, text) {
    p.inPool = false; p.excl = secs; if (secs >= C.BRUTAL_S) p.perm = true; this.teams[p.team].stats.excl++;
    this.ev('excl', p.x, p.y); this.say(text, 2.6); A() && A().whistle(2);
    if (this.ball.owner === p) this.ball.owner = null;
    if (p === this.sel) this.sel = null;
  };
  P.returnPlayer = function (p) {
    const T = this.teams[p.team], d = T.dir; p.excl = 0;
    let q = p;
    if (p.perm || p.fouls >= C.MAX_FOULS) {
      q = T.players.find(x => !x.inPool && x !== p && !x.perm && x.excl <= 0 && x.fouls < C.MAX_FOULS && x.gk === p.gk && x.bench) || T.players.find(x => !x.inPool && x !== p && !x.perm && x.excl <= 0 && x.fouls < C.MAX_FOULS && !x.gk && x.bench);
      if (!q) return;
      this.say('Einwechslung #' + q.num + ' ' + q.name, 1.6);
    }
    q.inPool = true; q.bench = false; p !== q && (p.bench = false);
    q.x = this.ownGoalX(p.team) + d * 2.2; q.y = 0.8; q.vx = q.vy = 0;
  };
  P.substitute = function (p) {
    const T = this.teams[p.team], q = T.players.find(x => !x.inPool && !x.gk && x.bench && x.excl <= 0 && !x.perm);
    if (!q) return;
    q.inPool = true; q.x = p.x; q.y = p.y; q.vx = q.vy = 0; q.face = p.face; q.bench = false;
    p.inPool = false; p.bench = true; if (this.ball.owner === p) this.setOwner(q);
    this.sel = q; this.say('Wechsel: #' + q.num + ' für #' + p.num, 1.4);
  };

  // ---------- Regelkontrollen ----------
  P.rulesCheck = function (dt) {
    const b = this.ball;
    if (this.poss < 0 || !b.owner) { this.players.forEach(p => p.twoM = 0); return; }
    for (const p of this.pool(this.poss)) {
      if (p.gk || p === b.owner) { p.twoM = 0; continue; }
      const inTwo = Math.abs(p.x - this.atkGoalX(p.team)) < C.L2 - 0.05;
      p.twoM = inTwo ? p.twoM + dt : 0;
      if (p.twoM > 1.6) {
        p.twoM = 0; this.say('Abseits – 2-m-Regel (#' + p.num + ')', 1.8); this.signal(1 - p.team, p.x, p.y);
        const d = this.teams[1 - p.team].dir, gx = this.ownGoalX(1 - p.team);
        this.startRestart('free', 1 - p.team, gx + d * 4, C.H / 2 + (p.y - C.H / 2) * 0.5, C.SHOT_CLOCK);
        return;
      }
    }
  };
})();
