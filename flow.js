// Spielfluss: Schwimmduell, Viertelende, Penaltyschießen
(function () {
  const WP = globalThis.WP, C = WP.C, U = WP.U, P = WP.Game.prototype;
  const A = () => WP.Audio;

  P.swimStep = function (dt) {
    this.pt -= dt;
    if (this.pt > 0) return;
    if (this.pt + dt > 0) { A() && A().whistle(1); this.ev('whistle'); }
    this.updateHuman(dt); this.aiAll(dt);
    for (const p of this.players) { p.cd -= dt; p.dive -= dt; }
    this.separate(); this.updateBall(dt);
    if (this.ball.owner) this.phase = 'play';
    else if (this.pt < -9) { const p = this.nearest(0, this.ball, true); this.setOwner(p); this.phase = 'play'; }
  };

  P.afterGoal = function () {
    const t = this.lastGoalTeam, c = 1 - t;
    this.teams[c].players.filter(p => !p.inPool && p.excl > 0 && !p.perm).forEach(p => this.returnPlayer(p));
    for (const p of this.players) if (p.inPool) {
      const d = this.teams[p.team].dir;
      p.x = d > 0 ? Math.min(p.x, 13.5) : Math.max(p.x, 16.5); p.vx = p.vy = 0;
    }
    const d = this.teams[c].dir;
    this.startRestart('free', c, 15 - d * 0.8, C.H / 2, C.SHOT_CLOCK);
    this.freeNoShot = false;
    this.say('Anwurf ' + this.teams[c].def.short, 1.6); this.ev('whistle'); A() && A().whistle(1);
  };

  P.shotClockOut = function () {
    const b = this.ball, t = 1 - this.poss;
    this.say('Angriffszeit abgelaufen – Ballwechsel', 2);
    const x = U.clamp(b.x, 3, C.W - 3), y = b.y;
    this.signal(t, x, y);
    this.startRestart('free', t, x, y, C.SHOT_CLOCK);
  };

  P.restartTimeout = function () {
    const r = this.rs; if (!r) return;
    const lim = r.team === 1 ? (r.type === 'penalty' ? 1.8 : 1.3) : 9;
    if (r.t > lim + 4 || (r.t > 1 && this.ball.owner !== r.taker)) return this.endRestart();
    if (r.t > lim) this.aiAct(r.taker, true);
  };

  P.endQuarter = function () {
    this.clock = 0; A() && A().horn(); this.ev('horn');
    this.phase = 'break'; this.pt = 3; this.rs = null;
    this.say(this.quarter + '. Viertel beendet  ' + this.teams[0].score + ':' + this.teams[1].score, 3);
  };
  P.afterBreak = function () {
    if (this.quarter < C.QUARTERS) return this.startQuarter(this.quarter + 1);
    if (this.teams[0].score !== this.teams[1].score) return this.finish();
    this.startShootout();
  };
  P.finish = function (so) {
    this.phase = 'over'; this.finished = true;
    const a = this.teams[0].score, b = this.teams[1].score;
    this.winner = so ? (so.goals[0] > so.goals[1] ? 0 : 1) : a > b ? 0 : a < b ? 1 : -1;
    A() && A().horn();
  };

  // ---------- Penaltyschießen ----------
  P.startShootout = function () {
    this.so = { goals: [0, 0], shots: [0, 0], turn: 0, state: 'setup', t: 0, res: null, log: [[], []], shooter: null };
    this.phase = 'shootout'; this.rs = null; this.poss = -1;
    this.say('Penaltyschießen!', 3); A() && A().whistle(2);
  };
  P.soCheck = function () {
    const s = this.so, g = s.goals, n = s.shots, rem = [Math.max(0, 5 - n[0]), Math.max(0, 5 - n[1])];
    if (n[0] <= 5 || n[1] <= 5) {
      if (n[0] <= 5 && n[1] <= 5) { if (g[0] > g[1] + rem[1] || g[1] > g[0] + rem[0]) return true; if (n[0] === 5 && n[1] === 5 && g[0] !== g[1]) return true; return false; }
    }
    return n[0] === n[1] && n[0] >= 5 && g[0] !== g[1];
  };
  P.updateShootout = function (dt) {
    const s = this.so, i = this.input, b = this.ball; s.t += dt;
    if (this.message.t > 0) this.message.t -= 0;
    if (s.state === 'setup') {
      const t = s.turn, d = 1 - t;
      this.teams[t].dir = 1; this.teams[d].dir = -1;
      const list = this.field(t), sh = list[s.shots[t] % list.length], gk = this.gkOf(d), og = this.gkOf(t);
      let k = 0;
      for (const p of this.players) if (p.inPool) { p.vx = p.vy = 0; if (p !== sh && p !== gk) { p.x = 8 + (p.team * 1.5); p.y = 3 + (k++) * 1.1; p.face = 0; } }
      sh.x = C.W - C.L5; sh.y = C.H / 2; sh.face = 0;
      gk.x = C.W - 0.6; gk.y = C.H / 2; gk.face = Math.PI; gk.penTarget = undefined; gk.penChoice = undefined;
      if (og) { og.x = 1; og.y = C.H / 2; }
      s.shooter = sh; this.sel = t === 0 ? sh : null; this.ball.owner = null; this.setOwner(sh); this.poss = t;
      s.state = 'aim'; s.t = 0; s.res = null; this.charge = 0; this.diveSel = 0;
      this.say(this.teams[t].def.short + ': #' + sh.num + ' ' + sh.name, 1.8);
    } else if (s.state === 'aim') {
      const t = s.turn, sh = s.shooter;
      if (i.shootHeld) this.charge = Math.min(1, this.charge + dt * 1.5);
      this.ball.x = sh.x + 0.55; this.ball.y = sh.y;
      if (t === 0 && !this.o.auto) {
        if (i.shootRelease) { this.shoot(sh, C.W, U.clamp(i.aimY, C.H / 2 - 2.3, C.H / 2 + 2.3), 0.15 + 0.7 * this.charge, 0.9); this.charge = 0; }
      } else if (s.t > 1.4) {
        this.shoot(sh, C.W, C.H / 2 + (this.rng() < 0.5 ? -1 : 1) * (0.5 + this.rng() * 0.9), 0.2 + this.rng() * 0.6, 0.9);
      }
    } else if (s.state === 'fly') {
      for (const p of this.players) if (p.gk && p.penTarget !== undefined) { p.y += U.clamp(p.penTarget - p.y, -6 * dt, 6 * dt); p.dive -= dt; }
      this.updateBall(dt);
      if (s.res || s.t > 3.2) {
        const res = s.res || 'miss', t = s.turn;
        s.shots[t]++; if (res === 'goal') s.goals[t]++; s.log[t].push(res === 'goal');
        this.say(res === 'goal' ? 'TOR!' : res === 'save' ? 'GEHALTEN!' : 'Daneben!', 1.6);
        if (res === 'goal') A() && A().cheer(0.15);
        s.state = 'result'; s.t = 0;
      }
    } else if (s.state === 'result') {
      this.updateBall(dt);
      if (s.t > 1.8) {
        if (this.soCheck()) { this.finish(s); return; }
        s.turn = 1 - s.turn; s.state = 'setup';
      }
    }
  };
})();
