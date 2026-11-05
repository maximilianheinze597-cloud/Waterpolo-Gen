// KI: Formationen, Manndeckung, Ballführung, Torwart
(function () {
  const WP = globalThis.WP, C = WP.C, U = WP.U, P = WP.Game.prototype;

  P.aiAll = function (dt) {
    const b = this.ball, play = this.phase === 'play', swim = this.phase === 'swim', rest = this.phase === 'restart';
    const live = play || swim;
    const chasers = [null, null];
    if (live && !b.owner && b.flight !== 'shot') {
      for (let t = 0; t < 2; t++) {
        let best = null, bd = 1e9;
        for (const p of this.field(t)) { if (p === this.sel && !this.o.auto) continue; const d = U.dist(p, b); if (d < bd) { bd = d; best = p; } }
        chasers[t] = best;
      }
    }
    for (let t = 0; t < 2; t++) {
      const T = this.teams[t], dir = T.dir, mine = this.pool(t), opp = this.pool(1 - t);
      const att = b.owner ? b.owner.team === t : this.poss === t;
      const carrier = b.owner && b.owner.team !== t ? b.owner : null;
      const marks = new Map();
      if (!att || carrier) {
        const free = opp.filter(o => !o.gk);
        const defs = this.field(t).filter(p => p !== b.owner).sort((a, c) => Math.abs(a.x - this.ownGoalX(t)) - Math.abs(c.x - this.ownGoalX(t)));
        for (const d of defs) {
          let best = null, bd = 1e9;
          for (const a of free) { const dd = U.dist(d, a) + Math.abs(a.x - this.ownGoalX(t)) * 0.15; if (dd < bd) { bd = dd; best = a; } }
          if (best) { marks.set(d, best); free.splice(free.indexOf(best), 1); }
        }
      }
      for (const p of mine) {
        if (p === this.sel && !this.o.auto && t === 0) continue;
        if (p.gk) { this.aiGk(p, dt); continue; }
        if (b.owner === p) { if (play) this.aiCarrier(p, dt); continue; }
        if (chasers[t] === p) { this.moveP(p, dt, b.x - p.x, b.y - p.y, true); continue; }
        if (att) {
          const R = WP.ROLES[p.role], gx = this.atkGoalX(t), ballD = Math.abs(b.x - gx);
          const depth = R.depth + Math.max(0, ballD - 12) * 0.5;
          const tx = gx - dir * depth + Math.sin(this.time * 0.7 + p.id) * 0.6;
          const ty = C.H / 2 + R.side * 7.5 + Math.cos(this.time * 0.6 + p.id * 1.7) * 0.9;
          this.moveP(p, dt, tx - p.x, ty - p.y, Math.hypot(tx - p.x, ty - p.y) > 4);
        } else {
          const m = marks.get(p); let tx, ty;
          if (carrier && m && m === carrier || (carrier && this.isPresser(p, carrier, t))) {
            tx = carrier.x; ty = carrier.y;
            const d = U.dist(p, carrier);
            if (play && d < 1.25 && p.cd <= 0) { p.cd = 0.9 + this.rng() * 0.5; p.press = 0.4; this.tackle(p, carrier); }
            this.moveP(p, dt, tx - p.x, ty - p.y, true); continue;
          }
          if (m) {
            const gx = this.ownGoalX(t), vx = gx - m.x, vy = C.H / 2 - m.y, l = Math.hypot(vx, vy) || 1;
            tx = m.x + vx / l * 0.95; ty = m.y + vy / l * 0.95;
          } else { tx = this.ownGoalX(t) + dir * 5; ty = C.H / 2; }
          this.moveP(p, dt, tx - p.x, ty - p.y, Math.hypot(tx - p.x, ty - p.y) > 3);
        }
      }
    }
  };
  P.isPresser = function (p, carrier, t) {
    let best = null, bd = 1e9;
    for (const q of this.field(t)) { if (q === this.sel && !this.o.auto && t === 0) continue; const d = U.dist(q, carrier); if (d < bd) { bd = d; best = q; } }
    return best === p;
  };

  P.aiGk = function (p, dt) {
    const b = this.ball, t = p.team, d = this.teams[t].dir, gx = this.ownGoalX(t);
    if (p.penTarget !== undefined) { p.y += U.clamp(p.penTarget - p.y, -6 * dt, 6 * dt); p.penT -= dt; if (p.penT <= 0) p.penTarget = undefined; return; }
    if (b.owner === p) { if (this.phase === 'play') this.aiCarrier(p, dt); return; }
    let tx = gx + d * 0.9, ty = U.clamp(C.H / 2 + (b.y - C.H / 2) * 0.28, C.H / 2 - 1.3, C.H / 2 + 1.3);
    if (b.flight === 'shot' && b.shotTeam !== t) ty = U.clamp(b.y, C.H / 2 - 1.6, C.H / 2 + 1.6);
    else if (!b.owner && b.flight !== 'shot' && Math.abs(b.x - gx) < 4.2) {
      const o = this.pool(1 - t).some(q => !q.gk && U.dist(q, b) < U.dist(p, b) - 0.3);
      if (!o) { tx = b.x; ty = b.y; }
    }
    this.moveP(p, dt, tx - p.x, ty - p.y, false);
  };

  P.bestTeammate = function (p) {
    let best = null, bs = -1e9;
    const gx = this.atkGoalX(p.team);
    for (const q of this.pool(p.team)) {
      if (q === p || (q.gk && !p.gk && Math.abs(p.x - this.ownGoalX(p.team)) > 6)) continue;
      let blocked = false;
      for (const o of this.pool(1 - p.team)) if (!o.gk && U.distToSegment(o.x, o.y, p.x, p.y, q.x, q.y) < 0.65) { blocked = true; break; }
      if (blocked) continue;
      const d = U.dist(p, q); if (d < 1.5) continue;
      let s = Math.min(this.openness(q), 4) * 0.7 - Math.abs(q.x - gx) * 0.18 - d * 0.04 + (q.role === 'CF' && Math.abs(q.x - gx) < 4 ? 1.5 : 0) - (q.gk ? 4 : 0);
      s += this.rng() * 0.8;
      if (s > bs) { bs = s; best = q; }
    }
    return best;
  };

  P.aiAct = function (p, forced) {
    const b = this.ball, t = p.team, gx = this.atkGoalX(t), dg = Math.abs(p.x - gx);
    if (this.rs && this.rs.type === 'penalty') { return this.shoot(p, gx, C.H / 2 + (this.rng() < 0.5 ? -1 : 1) * (0.5 + this.rng() * 0.9), 0.2 + this.rng() * 0.6, 0.95); }
    const can = !(this.freeNoShot && dg < C.L6);
    if (!p.gk && can && dg < 10 && (forced === 'shoot')) {
      return this.shoot(p, gx, C.H / 2 + (this.rng() < 0.5 ? -1 : 1) * (0.7 + this.rng() * 0.7), 0.15 + this.rng() * 0.7, 0.7 + 0.3 * this.rng());
    }
    const q = this.bestTeammate(p);
    if (q) this.pass(p, q); else if (forced === true && !can) { const f = this.pool(t).filter(x => x !== p).sort((a, c) => U.dist(a, p) - U.dist(c, p))[0]; if (f) this.pass(p, f); else this.endRestart(); } else if (forced === true && can) this.shoot(p, gx, C.H / 2 + (this.rng() - 0.5) * 2.4, 0.4, 0.8);
  };

  P.aiCarrier = function (p, dt) {
    const t = p.team, dir = this.teams[t].dir, gx = this.atkGoalX(t), dg = Math.abs(p.x - gx);
    p.holdT += dt;
    const k = t === 1 ? this.diff.react : 0.8;
    if (p.gk) { if (p.holdT > 0.9) this.aiAct(p); return; }
    const open = this.openness(p), can = !(this.freeNoShot && dg < C.L6), forced = this.shotClock < 4.5;
    const rate = (open > 1.3 ? 1 : 0.35) * (dg < 7 ? 1 : 0.4) * (p.role === 'CF' ? 1.4 : 1);
    if (can && dg < 10.5 && p.holdT > 0.5 && (forced || (dg < 9 && this.rng() < dt * 1.6 * rate * k))) return this.aiAct(p, 'shoot');
    if (p.holdT > 0.9 + (1.2 - k) * 0.8 && (this.pressure(p) > 0.5 || p.holdT > 2.2 || dg > 9)) {
      const q = this.bestTeammate(p); if (q) return this.pass(p, q);
    }
    if (this.freeNoShot && dg < C.L6 && p.holdT > 0.8) { const q = this.bestTeammate(p); if (q) return this.pass(p, q); }
    const R = WP.ROLES[p.role], tx = gx - dir * (p.role === 'CF' ? 2.6 : Math.max(R.depth * 0.85, 6.2)), ty = C.H / 2 + R.side * 5;
    this.moveP(p, dt, tx - p.x, ty - p.y, dg > 11);
  };
})();
