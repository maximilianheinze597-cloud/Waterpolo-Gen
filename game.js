// Spiel-Kern: Zustand, Physik, Regeln, Schiedsrichter
(function () {
  const WP = globalThis.WP, C = WP.C, U = WP.U, G9 = 9.8;

  class Game {
    constructor(o) {
      this.o = o;
      this.rng = U.makeRng(o.seed || (Date.now() & 0xffffff));
      this.diff = WP.DIFFICULTY[o.diff || 'normal'];
      this.rate = C.QUARTER_S / (o.quarterReal || 180);
      const A = WP.TEAMS[o.home], B = WP.TEAMS[o.away];
      const capA = WP.CAPS.find(c => c.id === (o.cap || 'white')) || WP.CAPS[0];
      let capB = WP.CAPS.find(c => c.id === 'blue');
      if (capA.id === 'blue' || capA.id === 'navy') capB = WP.CAPS[0];
      this.teams = [this.mkTeam(0, A, capA, o.style || 'classic'), this.mkTeam(1, B, capB, B.style)];
      this.teams[0].dir = 1; this.teams[1].dir = -1;
      this.players = this.teams[0].players.concat(this.teams[1].players);
      this.ball = { x: 15, y: 10, z: 0, vx: 0, vy: 0, vz: 0, owner: null, flight: null, target: null, lastTeam: -1, lastPlayer: null, noPick: 0, shotTeam: -1, shotT: 99, tried: {} };
      this.input = { mx: 0, my: 0, sprint: false, aimX: 15, aimY: 10, shootHeld: false, shootRelease: false, pass: false, tackle: false, fake: false, switchP: false, sub: false, timeout: false, dive: 0 };
      this.charge = 0;
      this.quarter = 0; this.clock = C.QUARTER_S; this.shotClock = C.SHOT_CLOCK; this.poss = -1;
      this.phase = 'init'; this.pt = 0; this.rs = null; this.so = null; this.freeNoShot = false;
      this.events = []; this.log = []; this.message = { text: '', t: 0 }; this.time = 0;
      this.refs = [{ x: 15, y: -1.4, flag: null, ft: 0, point: null }, { x: 15, y: C.H + 1.4, flag: null, ft: 0, point: null }];
      this.goalJudges = [{ w: 0 }, { w: 0 }];
      this.winner = null; this.finished = false; this.lastGoalTeam = -1;
      this.sel = null;
      this.startQuarter(1);
    }

    mkTeam(idx, def, cap, style) {
      const r = this.rng, base = def.rating / 100;
      const players = WP.LINEUP.map((l, i) => {
        const q = (v) => U.clamp(v * (0.88 + 0.2 * base) + (r() - 0.5) * 0.12, 0.6, 1.15);
        return {
          id: idx * 20 + i, team: idx, num: l.num, role: l.role, name: def.names[i % def.names.length],
          gk: l.role === 'GK', x: 15, y: 10, vx: 0, vy: 0, face: 0, inPool: i < 7, excl: 0, perm: false, fouls: 0, st: 1,
          attr: { spd: q(1), shoot: q(1), pass: q(1), def: q(1), str: q(1), gk: q(1) },
          cd: 0, holdT: 0, aiT: 0, fakeT: 0, bite: 0, dive: 0, twoM: 0, press: 0, goals: 0, bench: i >= 7,
        };
      });
      return { idx, def, cap, style, players, score: 0, timeouts: C.TIMEOUTS, dir: 1,
        stats: { shots: 0, saves: 0, fouls: 0, excl: 0, pens: 0, poss: 0 } };
    }

    // ---------- Hilfen ----------
    ownGoalX(t) { return this.teams[t].dir > 0 ? 0 : C.W; }
    atkGoalX(t) { return this.teams[t].dir > 0 ? C.W : 0; }
    pool(t) { return this.teams[t].players.filter(p => p.inPool); }
    field(t) { return this.teams[t].players.filter(p => p.inPool && !p.gk); }
    gkOf(t) { return this.teams[t].players.find(p => p.inPool && p.gk); }
    ev(type, x, y, v) { if (this.events.length < 300) this.events.push({ type, x, y, v: v || 0 }); }
    say(text, secs) { this.message = { text, t: secs || 2.2 }; this.log.unshift(text); if (this.log.length > 8) this.log.pop(); }

    // ---------- Viertel / Anstoß ----------
    startQuarter(q) {
      this.quarter = q; this.clock = C.QUARTER_S;
      if (q === 3) { this.teams[0].dir *= -1; this.teams[1].dir *= -1; }
      for (let t = 0; t < 2; t++) {
        const T = this.teams[t], gx = this.ownGoalX(t), d = T.dir;
        const act = T.players.filter(p => p.inPool);
        let k = 0; act.forEach(p => { p.x = gx + d * (p.gk ? 0.6 : 2.0); p.y = p.gk ? C.H / 2 : 3 + (k++) * 2.8; p.vx = p.vy = 0; p.face = d > 0 ? 0 : Math.PI; p.fakeT = 0; });
        T.players.forEach(p => { if (p.excl > 0 && !p.perm) p.excl = Math.min(p.excl, C.EXCL_S); });
      }
      const b = this.ball; Object.assign(b, { x: 15, y: 10, z: 0, vx: 0, vy: 0, vz: 0, owner: null, flight: null, target: null, lastTeam: -1, lastPlayer: null });
      this.poss = -1; this.shotClock = C.SHOT_CLOCK; this.freeNoShot = false; this.rs = null;
      this.phase = 'swim'; this.pt = 2.6;
      this.say(q === 1 ? 'Anwurf – Schwimmduell!' : q + '. Viertel – Schwimmduell!', 2.4);
      this.sel = this.field(0).find(p => p.role === 'CF') || this.field(0)[0];
    }

    // ---------- Hauptupdate ----------
    update(dt) {
      this.time += dt;
      if (this.message.t > 0) this.message.t -= dt;
      this.updateRefs(dt);
      const inp = this.input;
      if (this.phase === 'shootout') { this.updateShootout(dt); this.clearInput(); return; }
      if (this.phase === 'swim') { this.swimStep(dt); this.clearInput(); return; }
      if (this.phase === 'goal') { this.pt -= dt; this.updateBall(dt); if (this.pt <= 0) this.afterGoal(); this.clearInput(); return; }
      if (this.phase === 'break') { this.pt -= dt; if (this.pt <= 0) this.afterBreak(); this.clearInput(); return; }
      if (this.phase === 'timeout') { this.pt -= dt; if (this.pt <= 0) { this.phase = 'restart'; this.rs.t = 0; } this.clearInput(); return; }
      if (this.phase === 'over') return;

      this.handleHumanSystem();
      const play = this.phase === 'play';
      if (this.rs) this.rs.t += dt;
      if (play) {
        this.clock -= dt * this.rate;
        if (this.poss >= 0) { this.shotClock -= dt * this.rate; this.teams[this.poss].stats.poss += dt; }
        this.ballTimers(dt);
        for (const p of this.players) if (p.excl > 0) { p.excl -= dt * this.rate; if (p.excl <= 0) this.returnPlayer(p); }
      }
      this.updateHuman(dt);
      this.aiAll(dt);
      for (const p of this.players) { p.cd -= dt; p.fakeT -= dt; p.bite -= dt; p.press -= dt; p.dive -= dt; }
      this.separate();
      this.updateBall(dt);
      if (play) this.rulesCheck(dt);
      if (this.phase === 'restart' && this.rs) this.restartTimeout();
      if (play && this.clock <= 0) this.endQuarter();
      else if (play && this.poss >= 0 && this.shotClock <= 0) this.shotClockOut();
      this.clearInput();
    }
    clearInput() { const i = this.input; i.shootRelease = i.pass = i.tackle = i.fake = i.switchP = i.sub = i.timeout = false; }
    ballTimers(dt) { this.ball.shotT += dt; }

    // ---------- Schiedsrichter ----------
    updateRefs(dt) {
      this.refs.forEach((r, i) => {
        const bx = U.clamp(this.ball.x, 2, C.W - 2), pe = r.point ? r.point.x : bx;
        const tx = this.phase === 'restart' || this.phase === 'goal' ? pe : bx;
        r.x += (tx - r.x) * Math.min(1, dt * 1.6);
        if (r.ft > 0) { r.ft -= dt; if (r.ft <= 0) { r.flag = null; r.point = null; } }
      });
      this.goalJudges.forEach(g => { if (g.w > 0) g.w -= dt; });
    }
    signal(awardTeam, x, y) {
      const r = this.refs[y < C.H / 2 ? 0 : 1];
      r.flag = this.teams[awardTeam].cap.hex; r.ft = 2.4; r.point = { x, y };
      WP.Audio && WP.Audio.whistle(1); this.ev('whistle');
    }

    // ---------- Spielerbewegung ----------
    moveP(p, dt, dx, dy, sprint) {
      const len = Math.hypot(dx, dy);
      let sp = p.gk ? 2.7 : C.SWIM;
      if (sprint && !p.gk && p.st > 0.05) { sp = C.SPRINT; p.st -= dt * 0.16; } else p.st = Math.min(1, p.st + dt * 0.05);
      sp *= p.attr.spd * (0.78 + 0.22 * p.st);
      if (this.ball.owner === p) sp *= 0.88;
      if (p.team === 1) sp *= this.diff.speed;
      if (p.gk && p.dive > 0) sp *= 2.4;
      const lm = Math.min(1, len);
      const tvx = len > 0.01 ? (dx / len) * sp * lm : 0, tvy = len > 0.01 ? (dy / len) * sp * lm : 0;
      const k = Math.min(1, dt * 6);
      p.vx += (tvx - p.vx) * k; p.vy += (tvy - p.vy) * k;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.x = U.clamp(p.x, 0.3, C.W - 0.3); p.y = U.clamp(p.y, 0.3, C.H - 0.3);
      if (p.gk) {
        const g = this.ownGoalX(p.team), d = this.teams[p.team].dir;
        const lo = Math.min(g, g + d * 5), hi = Math.max(g, g + d * 5);
        p.x = U.clamp(p.x, lo + 0.25, hi - 0.25) ;
      }
      const spd = Math.hypot(p.vx, p.vy);
      if (spd > 0.4) { const a = Math.atan2(p.vy, p.vx); p.face += U.angDiff(a, p.face) * Math.min(1, dt * 9); }
      else if (!this.ball.owner || this.ball.owner !== p) { const a = U.angle(p, this.ball); p.face += U.angDiff(a, p.face) * Math.min(1, dt * 5); }
      if (spd > 1.5 && this.rng() < dt * spd * 1.3) this.ev('wake', p.x, p.y, spd);
    }
    separate() {
      const ps = this.players.filter(p => p.inPool), m = C.PR * 2;
      for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i], b = ps[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
        if (d < m && d > 0.001) { const push = (m - d) * 0.5, nx = dx / d, ny = dy / d; a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push; }
      }
    }

    // ---------- Mensch ----------
    handleHumanSystem() {
      const i = this.input, b = this.ball;
      if (i.timeout && this.phase === 'play' && b.owner && b.owner.team === 0 && this.teams[0].timeouts > 0) {
        this.teams[0].timeouts--; this.phase = 'timeout'; this.pt = 3.5; this.rs = { type: 'free', team: 0, taker: b.owner, t: 0 };
        this.pool(0).forEach(p => p.st = Math.min(1, p.st + 0.5)); this.shotClock = Math.max(this.shotClock, C.SHOT_CLOCK_SHORT);
        this.say('Auszeit ' + this.teams[0].def.name + ' (' + (C.TIMEOUTS - this.teams[0].timeouts) + '/' + C.TIMEOUTS + ')', 3.2); WP.Audio && WP.Audio.whistle(2);
      }
      if (i.sub && this.phase === 'restart' && this.sel && !this.sel.gk) this.substitute(this.sel);
    }
    updateHuman(dt) {
      if (this.o.auto) { this.sel = null; return; }
      const i = this.input, b = this.ball;
      if (this.sel && (!this.sel.inPool || this.sel.team !== 0)) this.sel = null;
      if (b.owner && b.owner.team === 0 && !b.owner.gk) this.sel = b.owner;
      else if (!this.sel || i.switchP || this.phase === 'restart' && this.rs && this.rs.team === 0) {
        if (this.phase === 'restart' && this.rs && this.rs.team === 0 && !this.rs.taker.gk) this.sel = this.rs.taker;
        else this.sel = this.nearest(0, b, true) || this.sel;
      } else if (!b.owner || b.owner.team === 1) {
        const n = this.nearest(0, b, true);
        if (n && U.dist(n, b) < U.dist(this.sel, b) - 1.8) this.sel = n;
      }
      const p = this.sel; if (!p) return;
      this.humanMove = true;
      const aim = { x: i.aimX, y: i.aimY };
      if (this.phase === 'restart' && this.rs.type === 'penalty' && this.rs.taker !== p) return;
      this.moveP(p, dt, i.mx, i.my, i.sprint);
      if (i.mx === 0 && i.my === 0 && b.owner === p) p.face += U.angDiff(U.angle(p, aim), p.face) * Math.min(1, dt * 8);
      if (b.owner === p) {
        if (i.shootHeld) this.charge = Math.min(1, this.charge + dt * 1.5); else if (!i.shootRelease) this.charge = 0;
        if (i.shootRelease) {
          if (this.freeNoShot && Math.abs(p.x - this.atkGoalX(0)) < C.L6 && this.phase !== 'restart') { this.say('Innerhalb 6 m – erst passen!', 1.4); }
          else if (this.freeNoShot && Math.abs(p.x - this.atkGoalX(0)) < C.L6) { this.say('Innerhalb 6 m – erst passen!', 1.4); }
          else this.humanShoot(p, aim, 0.55 + 0.45 * this.charge);
          this.charge = 0;
        } else if (i.pass) {
          const t = this.bestPassTarget(p, aim);
          if (t) this.pass(p, t);
        } else if (i.fake) { p.fakeT = 0.5; this.teams[1].players.forEach(o => { if (o.inPool && U.dist(o, p) < 2.6) o.bite = 1.2; }); }
      } else if (i.tackle && p.cd <= 0) {
        p.cd = 0.8; p.press = 0.4;
        const c = b.owner && b.owner.team === 1 ? b.owner : null;
        if (c && U.dist(c, p) < 1.5) this.tackle(p, c);
      }
    }
    nearest(t, pt, noGk) {
      let best = null, bd = 1e9;
      for (const p of this.teams[t].players) { if (!p.inPool || (noGk && p.gk)) continue; const d = U.dist(p, pt); if (d < bd) { bd = d; best = p; } }
      return best;
    }
    bestPassTarget(p, aim) {
      const ang = U.angle(p, aim); let best = null, bs = 1e9;
      for (const q of this.teams[p.team].players) {
        if (!q.inPool || q === p) continue;
        const d = U.dist(p, q); if (d < 1.5) continue;
        const s = Math.abs(U.angDiff(U.angle(p, q), ang)) + d * 0.01;
        if (s < bs) { bs = s; best = q; }
      }
      return bs < 0.9 ? best : null;
    }
    humanShoot(p, aim, power) {
      const gx = this.atkGoalX(0), dir = this.teams[0].dir;
      let tx = aim.x, ty = aim.y;
      const nearGoal = Math.abs(aim.x - gx) < 2.5 && Math.abs(aim.y - C.H / 2) < 2.6;
      if (!nearGoal && (aim.x - p.x) * dir > 0.5) { const t = (gx - p.x) / (aim.x - p.x); ty = p.y + (aim.y - p.y) * t; tx = gx; }
      this.shoot(p, tx, ty, 0.35 + this.rng() * 0.45, power);
    }
  }

  WP.Game = Game;
})();
