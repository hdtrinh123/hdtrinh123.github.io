// The hex drawing surface: snapping, in-progress rubber band, shimmering lines.

(function () {
  const COLORS = {
    dot: '#BAC5E2',
    line: '#BAC5E2',
    active: '#D8B8E0',
    unknown: '#e0b8b8',
    failed: '#dd6666',
    considered: '#E0E3B8',
    future: '#5c5f66',
  };

  class HexGrid {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.scale = 1;
      this.size = 34;           // px between lattice rings
      this.pan = { x: 0, y: 0 };
      this.mouse = { x: -1e6, y: -1e6, inside: false };
      this.drawing = false;
      this.activePath = [];
      this.shimmer = new Map();
      this.onPatternDrawn = null;
      this.bind();
    }

    get spacing() { return this.size * this.scale * Math.sqrt(3); }

    bind() {
      const c = this.canvas;
      c.addEventListener('mousedown', (e) => this.onDown(e));
      c.addEventListener('mousemove', (e) => this.onMove(e));
      window.addEventListener('mouseup', () => this.onUp());
      c.addEventListener('mouseleave', () => { this.mouse.inside = false; });
      c.addEventListener('mouseenter', () => { this.mouse.inside = true; });
      c.addEventListener('touchstart', (e) => { this.onDown(this.touch(e)); e.preventDefault(); }, { passive: false });
      c.addEventListener('touchmove', (e) => { this.onMove(this.touch(e)); e.preventDefault(); }, { passive: false });
      c.addEventListener('touchend', () => this.onUp());
      c.addEventListener('wheel', (e) => {
        e.preventDefault();
        this.setScale(this.scale * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
      }, { passive: false });
    }

    touch(e) {
      const t = e.touches[0] || e.changedTouches[0];
      return { clientX: t.clientX, clientY: t.clientY, button: 0 };
    }

    setScale(s) {
      this.scale = Math.max(0.35, Math.min(3, s));
      App.requestRender();
    }

    localPos(e) {
      const r = this.canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    origin() {
      return {
        x: this.canvas.width / (window.devicePixelRatio || 1) / 2 + this.pan.x,
        y: this.canvas.height / (window.devicePixelRatio || 1) / 2 + this.pan.y,
      };
    }

    toPx(c) {
      const o = this.origin();
      return Hex.coordToPx(c, this.size * this.scale, o.x, o.y);
    }

    toCoord(x, y) {
      const o = this.origin();
      return Hex.pxToCoord(x, y, this.size * this.scale, o.x, o.y);
    }

    // Every lattice point occupied by an already-committed pattern.
    usedPoints() {
      const set = new Set();
      for (const p of App.patterns) {
        for (const pt of p.points) set.add(Hex.coordKey(pt.q, pt.r));
      }
      return set;
    }

    onDown(e) {
      if (e.button === 1 || (e.button === 0 && App.spaceHeld)) { this.panning = true; return; }
      if (e.button !== 0) return;
      const p = this.localPos(e);
      const c = this.toCoord(p.x, p.y);
      const px = this.toPx(c);
      if (Math.hypot(px.x - p.x, px.y - p.y) > this.spacing / 2) return;
      if (this.usedPoints().has(Hex.coordKey(c.q, c.r))) return;
      this.drawing = true;
      this.activePath = [c];
      App.requestRender();
    }

    onMove(e) {
      const p = this.localPos(e);
      if (this.panning) {
        this.pan.x += p.x - this.mouse.x;
        this.pan.y += p.y - this.mouse.y;
      }
      this.mouse.x = p.x;
      this.mouse.y = p.y;
      this.mouse.inside = true;
      if (this.drawing) this.tryExtend(p);
      App.requestRender();
    }

    onUp() {
      this.panning = false;
      if (!this.drawing) return;
      this.drawing = false;
      const path = this.activePath;
      this.activePath = [];
      if (path.length < 2) { App.requestRender(); return; }
      const pat = Hex.pointsToPattern(path);
      if (!pat) { App.requestRender(); return; }
      App.addPattern(pat.signature, pat.startDir, path);
    }

    tryExtend(p) {
      const path = this.activePath;
      const prev = path[path.length - 1];
      const c = this.toCoord(p.x, p.y);
      if (c.q === prev.q && c.r === prev.r) return;

      // Retracing onto the point before last erases — the only in-canvas undo.
      if (path.length >= 2) {
        const before = path[path.length - 2];
        if (before.q === c.q && before.r === c.r) { path.pop(); return; }
      }

      // Must be an immediate neighbour of the head.
      const dq = c.q - prev.q, dr = c.r - prev.r;
      const dir = Hex.DIR_DELTA.findIndex((v) => v[0] === dq && v[1] === dr);
      if (dir < 0) return;

      const px = this.toPx(c);
      if (Math.hypot(px.x - p.x, px.y - p.y) > this.spacing * 0.62) return;
      if (this.usedPoints().has(Hex.coordKey(c.q, c.r))) return;

      // Enforce the mod's two rules: no re-traversing an edge, no backtracking.
      const sofar = Hex.pointsToPattern(path);
      if (path.length === 1) {
        path.push(c);
        return;
      }
      if (!sofar) return;
      if (!Hex.canAppendDir(sofar.signature, sofar.startDir, dir)) return;
      path.push(c);
    }

    // --- layout ------------------------------------------------------------
    // Auto-place a pattern that wasn't hand-drawn. Scans in reading order from
    // the top-left of the visible field, keeping a one-cell gap between
    // patterns so adjacent drawings stay legible.
    findSlot(signature, startDir, used) {
      used = used || this.usedPoints();
      const bounds = Hex.patternBounds(signature, startDir);
      const free = (pt) => {
        if (used.has(Hex.coordKey(pt.q, pt.r))) return false;
        for (let d = 0; d < 6; d++) {
          const n = Hex.coordAdd(pt, d);
          if (used.has(Hex.coordKey(n.q, n.r))) return false;
        }
        return true;
      };
      // Scan the rows actually on screen, so drawings land where they can be
      // seen regardless of canvas size or zoom.
      const rect = this.canvas.getBoundingClientRect();
      const W = rect.width || 800, H = rect.height || 600;
      const pad = 2;
      const topLeft = this.toCoord(60, 50);
      const botRight = this.toCoord(W - 60, H - 60);
      const o = this.origin();
      const s = this.size * this.scale;
      const qAt = (x, r) => Math.round(((x - o.x) / s - (Hex.SQRT_3 / 2) * r) / Hex.SQRT_3);

      for (let r = topLeft.r + pad; r <= botRight.r + 40; r++) {
        const qMin = qAt(70, r), qMax = qAt(W - 70, r);
        for (let q = qMin; q <= qMax; q++) {
          const origin = { q: q - bounds.minQ, r: r - bounds.minR };
          const pts = Hex.patternPositions(signature, startDir, origin);
          if (pts.every(free)) return pts;
        }
      }
      return Hex.patternPositions(signature, startDir, { q: topLeft.q + 2, r: topLeft.r + 2 });
    }

    // Re-pack every pattern, hand-drawn ones included (the "sort" button).
    relayout() {
      const used = new Set();
      for (const p of App.patterns) {
        p.points = this.findSlot(p.signature, p.startDir, used);
        p.points.forEach((pt) => used.add(Hex.coordKey(pt.q, pt.r)));
      }
      App.requestRender();
    }

    // --- rendering ---------------------------------------------------------
    tickShimmer() {
      this.shimmer.clear();
      App.requestRender();
    }

    segOffsets(key, i) {
      const k = key + ':' + i;
      let v = this.shimmer.get(k);
      if (!v) {
        v = [Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5,
             Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5];
        this.shimmer.set(k, v);
      }
      return v;
    }

    render() {
      const dpr = window.devicePixelRatio || 1;
      const ctx = this.ctx;
      // The canvas is hidden at boot, so its backing size has to be settled
      // here rather than once up front — otherwise CSS stretches a 300x150
      // buffer across the whole stage.
      const rect = this.canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      if (this.canvas.width !== Math.round(rect.width * dpr)
        || this.canvas.height !== Math.round(rect.height * dpr)) {
        this.canvas.width = Math.round(rect.width * dpr);
        this.canvas.height = Math.round(rect.height * dpr);
      }
      const W = this.canvas.width / dpr, H = this.canvas.height / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      const used = new Map();
      for (const p of App.patterns) {
        for (const pt of p.points) used.set(Hex.coordKey(pt.q, pt.r), true);
      }
      for (const pt of this.activePath) used.set(Hex.coordKey(pt.q, pt.r), true);

      this.renderDots(ctx, W, H, used);

      // committed patterns
      App.patterns.forEach((p, i) => {
        const color = this.patternColor(p, i);
        this.renderPattern(ctx, p.points, color, 'p' + i, i === App.selectedPattern);
      });

      // in-progress
      if (this.activePath.length) {
        this.renderPattern(ctx, this.activePath, COLORS.active, 'active', false);
        const head = this.toPx(this.activePath[this.activePath.length - 1]);
        ctx.strokeStyle = COLORS.active;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 4 * this.scale;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(head.x, head.y);
        ctx.lineTo(this.mouse.x, this.mouse.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    patternColor(p, i) {
      if (App.timelineIndex >= 0 && i > App.timelineIndex) return COLORS.future;
      const res = App.resolutions[i];
      if (res === 'ERRORED' || res === 'INVALID') return COLORS.failed;
      if (res === 'ESCAPED') return COLORS.considered;
      if (p.match && p.match.kind === 'unknown') return COLORS.unknown;
      return COLORS.line;
    }

    renderDots(ctx, W, H, used) {
      const c0 = this.toCoord(0, 0);
      const c1 = this.toCoord(W, H);
      const minR = Math.min(c0.r, c1.r) - 2, maxR = Math.max(c0.r, c1.r) + 2;
      const minQ = Math.min(c0.q, c1.q) - Math.abs(maxR) - 2;
      const maxQ = Math.max(c0.q, c1.q) + Math.abs(maxR) + 2;
      const r = 4.5 * this.scale;

      for (let rr = minR; rr <= maxR; rr++) {
        for (let qq = minQ; qq <= maxQ; qq++) {
          if (used.has(Hex.coordKey(qq, rr))) continue;
          const p = this.toPx({ q: qq, r: rr });
          if (p.x < -20 || p.y < -20 || p.x > W + 20 || p.y > H + 20) continue;
          // Dots fade in near the cursor, as in Hex Studio.
          const d = this.mouse.inside ? Math.hypot(p.x - this.mouse.x, p.y - this.mouse.y) : 1e9;
          let alpha = this.mouse.inside ? Math.min(1, 90 / Math.max(1, d)) : 0.16;
          alpha = Math.max(alpha, 0.13);
          if (alpha < 0.05) continue;
          ctx.globalAlpha = alpha;
          ctx.fillStyle = COLORS.dot;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }

    // Each segment is drawn as a 5-point jittered path that re-randomises on a
    // 10 Hz tick, giving the in-game shimmer.
    renderPattern(ctx, points, color, key, selected) {
      if (points.length < 2) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = (selected ? 6 : 4.5) * this.scale;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (selected) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
      }
      ctx.beginPath();
      for (let i = 0; i + 1 < points.length; i++) {
        const a = this.toPx(points[i]);
        const b = this.toPx(points[i + 1]);
        const o = this.segOffsets(key, i);
        const dx = b.x - a.x, dy = b.y - a.y;
        const amp = 0.06 * this.spacing;
        ctx.moveTo(a.x, a.y);
        for (let t = 1; t <= 3; t++) {
          const f = t / 4;
          const mx = a.x + dx * f + o[(t - 1) * 2] * amp;
          const my = a.y + dy * f + o[(t - 1) * 2 + 1] * amp;
          ctx.lineTo(mx, my);
        }
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // node caps
      ctx.fillStyle = color;
      for (const pt of points) {
        const p = this.toPx(pt);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.2 * this.scale, 0, Math.PI * 2);
        ctx.fill();
      }
      // start marker
      const s = this.toPx(points[0]);
      ctx.beginPath();
      ctx.arc(s.x, s.y, 6 * this.scale, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5 * this.scale;
      ctx.stroke();
    }
  }

  window.HexGrid = HexGrid;
  window.GRID_COLORS = COLORS;
})();
