// Hilfsfunktionen: Mathe, Zufall, Geometrie
(function () {
  const WP = (globalThis.WP = globalThis.WP || {});

  // Seed-fähiger Zufallsgenerator (mulberry32)
  function makeRng(seed) {
    let a = seed >>> 0;
    const f = function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return f;
  }

  const U = {
    makeRng,
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
    dist2: (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2),
    angle: (from, to) => Math.atan2(to.y - from.y, to.x - from.x),
    angDiff(a, b) {
      let d = a - b;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      return d;
    },
    // Abstand Punkt p zur Strecke a-b
    distToSegment(px, py, ax, ay, bx, by) {
      const dx = bx - ax, dy = by - ay;
      const l2 = dx * dx + dy * dy;
      let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
      t = Math.max(0, Math.min(1, t));
      return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    },
    pick: (rng, arr) => arr[Math.floor(rng() * arr.length) % arr.length],
    fmtClock(sec) {
      sec = Math.max(0, Math.ceil(sec));
      const m = Math.floor(sec / 60), s = sec % 60;
      return m + ':' + (s < 10 ? '0' : '') + s;
    },
  };
  WP.U = U;
})();
