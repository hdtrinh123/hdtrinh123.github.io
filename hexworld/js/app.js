// Wiring: world rendering, camera, keybinds, evaluation, persistence.

(function () {
  const App = {
    world: null,
    evalWorld: null,
    libraries: {},
    evalLibraries: {},
    patterns: [],          // { signature, startDir, points, match }
    resolutions: [],
    snapshots: [],
    finalImage: null,
    lastError: null,
    lastOps: 0,
    timelineIndex: -1,
    selectedPattern: -1,
    dragIndex: null,
    castingMode: false,
    projectName: 'untitled',
    placeBlockId: WorldLib.B.STONE,
    camera: { x: 0, y: 0, zoom: 1 },
    cursor: { x: 0, y: 0 },   // mouse position in world coords, for Cursor Reflection
    keys: {},
    spaceHeld: false,
    consoleLines: [],
    dirty: true,
  };
  window.App = App;

  const $ = (s) => document.querySelector(s);
  const TILE = 14;

  App.requestRender = () => { App.dirty = true; };

  // ------------------------------------------------------------- patterns
  App.addPattern = function (signature, startDir, points) {
    if (typeof startDir === 'string') startDir = Hex.dirIndex(startDir);
    const p = {
      signature,
      startDir,
      points: points || App.grid.findSlot(signature, startDir),
      match: Registry.matchPattern(signature, startDir),
    };
    App.patterns.push(p);
    App.evaluate();
    UI.renderAll();
    App.requestRender();
  };

  App.addFromText = function (text) {
    const r = Registry.resolveText(text);
    if (!r) { App.log(`Unrecognised pattern: "${text}"`, 'error'); return false; }
    App.addPattern(r.signature, r.startDir, null);
    return true;
  };

  App.removePattern = function (i) {
    App.patterns.splice(i, 1);
    if (App.selectedPattern >= App.patterns.length) App.selectedPattern = -1;
    if (App.timelineIndex >= App.patterns.length) App.timelineIndex = -1;
    App.evaluate();
    UI.renderAll();
    App.requestRender();
  };

  App.movePattern = function (from, to) {
    const [p] = App.patterns.splice(from, 1);
    App.patterns.splice(to, 0, p);
    App.evaluate();
    UI.renderAll();
    App.requestRender();
  };

  App.clearPatterns = function () {
    App.patterns = [];
    App.resolutions = [];
    App.snapshots = [];
    App.timelineIndex = -1;
    App.selectedPattern = -1;
    App.evaluate();
    UI.renderAll();
    App.requestRender();
  };

  // ----------------------------------------------------------- evaluation
  // Preview (apply = false) runs against a clone so the real world is untouched;
  // casting runs for real.
  App.evaluate = function (apply) {
    App.evalWorld = apply ? App.world : App.world.clone();
    App.evalLibraries = apply ? App.libraries : JSON.parse(JSON.stringify(App.libraries));

    const iotas = App.patterns.map((p) => Iota.Pat(p.signature, p.startDir));
    const rng = apply ? Math.random : WorldLib.mulberry32(1337);

    let result;
    try {
      result = VMLib.runHex(iotas, {
        world: App.evalWorld,
        rng,
        log: (msg, kind) => { if (apply) App.log(msg, kind || 'reveal'); },
      });
    } catch (e) {
      App.log('Internal error: ' + e.message, 'error');
      console.error(e);
      return;
    }

    App.snapshots = result.snapshots;
    App.resolutions = result.resolutions;
    App.finalImage = result.image;
    App.lastError = result.error;
    App.lastOps = result.opsConsumed;

    if (apply) {
      if (result.error) {
        App.log(`${result.error.name}: ${result.error.message}`, 'error');
      } else if (iotas.length) {
        App.log(`Cast ${iotas.length} pattern${iotas.length === 1 ? '' : 's'}.`, 'spell');
      }
      App.requestRender();
    }
  };

  App.cast = function () {
    if (!App.patterns.length) { App.log('Nothing to cast.', 'info'); return; }
    App.evaluate(true);
    // Return to preview state so the panel keeps reflecting a clean run.
    App.evaluate(false);
    UI.renderAll();
  };

  App.currentImage = function () {
    if (App.timelineIndex >= 0 && App.snapshots[App.timelineIndex]) {
      return App.snapshots[App.timelineIndex];
    }
    return App.finalImage;
  };

  App.log = function (msg, kind) {
    App.consoleLines.push({ msg, kind: kind || 'info' });
    if (App.consoleLines.length > 60) App.consoleLines.shift();
    const host = $('#console');
    host.innerHTML = App.consoleLines
      .slice(-14)
      .map((l) => `<div class="l_${l.kind}">${escapeHtml(l.msg)}</div>`)
      .join('');
    host.scrollTop = host.scrollHeight;
  };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  // --------------------------------------------------------- import/export
  App.exportPatternText = function () {
    let depth = 0;
    const lines = [];
    for (const p of App.patterns) {
      const m = p.match || Registry.matchPattern(p.signature, p.startDir);
      if (m.id === 'close_paren') depth = Math.max(0, depth - 1);
      const name = m.id === 'open_paren' ? '{' : (m.id === 'close_paren' ? '}' : m.name);
      lines.push('    '.repeat(depth) + name);
      if (m.id === 'open_paren') depth++;
    }
    return lines.join('\n');
  };

  App.importPatternText = function (text) {
    const lines = text.split('\n')
      .map((l) => l.replace(/\/\/.*$/, '').trim())
      .filter((l) => l.length);
    const added = [];
    const failed = [];
    for (const line of lines) {
      const r = Registry.resolveText(line);
      if (r) added.push(r); else failed.push(line);
    }
    App.patterns = [];
    for (const r of added) {
      App.patterns.push({
        signature: r.signature,
        startDir: r.startDir,
        points: [],
        match: Registry.matchPattern(r.signature, r.startDir),
      });
    }
    App.grid.relayout();
    App.timelineIndex = -1;
    App.evaluate();
    UI.renderAll();
    App.log(`Imported ${added.length} pattern${added.length === 1 ? '' : 's'}.`
      + (failed.length ? ` ${failed.length} line(s) unrecognised.` : ''), failed.length ? 'error' : 'info');
  };

  App.exportProject = function () {
    return JSON.stringify({
      version: 1,
      name: App.projectName,
      seed: App.world.seed,
      patterns: App.patterns.map((p) => ({ s: p.signature, d: p.startDir, pts: p.points })),
      libraries: App.libraries,
      placeBlockId: App.placeBlockId,
    }, null, 2);
  };

  App.importProject = function (text) {
    let data;
    try { data = JSON.parse(text); } catch (e) { App.log('Invalid JSON.', 'error'); return; }
    if (data.seed != null && data.seed !== App.world.seed) App.regenerate(data.seed);
    App.projectName = data.name || 'untitled';
    App.libraries = data.libraries || {};
    App.placeBlockId = data.placeBlockId || WorldLib.B.STONE;
    App.patterns = (data.patterns || []).map((p) => ({
      signature: p.s,
      startDir: p.d,
      points: p.pts && p.pts.length ? p.pts : Hex.patternPositions(p.s, p.d),
      match: Registry.matchPattern(p.s, p.d),
    }));
    if (!data.patterns || !data.patterns.some((p) => p.pts && p.pts.length)) App.grid.relayout();
    App.timelineIndex = -1;
    App.evaluate();
    UI.renderAll();
    App.requestRender();
    App.log(`Loaded project "${App.projectName}".`, 'info');
  };

  App.downloadProject = function () {
    const blob = new Blob([App.exportProject()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (App.projectName || 'untitled') + '.hex.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // -------------------------------------------- interop: .hex/.hexpattern/.hexparse
  // Replace the pattern list from a normalised [{signature, startDir(name)}] list.
  App.setPatternsFromImport = function (list, msg, tone) {
    App.patterns = list.map((r) => ({
      signature: r.signature,
      startDir: Hex.dirIndex(r.startDir),
      points: [],
      match: Registry.matchPattern(r.signature, r.startDir),
    }));
    App.grid.relayout();
    App.timelineIndex = -1;
    App.evaluate();
    UI.renderAll();
    App.requestRender();
    App.log(msg, tone || 'info');
  };

  function importNote(count, res) {
    let m = `Imported ${count} pattern${count === 1 ? '' : 's'}.`;
    const extra = [];
    if (res.failed && res.failed.length) extra.push(`${res.failed.length} line(s) unrecognised`);
    if (res.skipped) extra.push(`${res.skipped} literal iota(s) skipped`);
    if (extra.length) m += ' ' + extra.join(', ') + '.';
    return { m, tone: res.failed && res.failed.length ? 'error' : 'info' };
  }

  // Route an imported file to the right parser by its extension.
  App.importByExtension = function (filename, content) {
    const name = (filename || '').toLowerCase();
    const base = filename.replace(/\.[^.]+$/, '');
    try {
      if (name.endsWith('.json')) { App.importProject(content); return; }
      if (name.endsWith('.hexpattern')) {
        const res = Formats.parseHexpattern(content);
        App.projectName = base || App.projectName;
        const n = importNote(res.patterns.length, res);
        App.setPatternsFromImport(res.patterns, n.m, n.tone);
        return;
      }
      if (name.endsWith('.hexparse')) {
        const res = Formats.parseHexparse(content);
        App.projectName = base || App.projectName;
        const n = importNote(res.patterns.length, res);
        App.setPatternsFromImport(res.patterns, n.m, n.tone);
        return;
      }
      if (name.endsWith('.hex')) {
        const res = Formats.readHex(content);
        App.projectName = base || App.projectName;
        App.setPatternsFromImport(res.patterns, `Imported ${res.patterns.length} pattern(s) from Hex Studio .hex.`);
        return;
      }
      App.log(`Don't know how to import "${filename}".`, 'error');
    } catch (e) {
      App.log('Import failed: ' + e.message, 'error');
    }
  };

  App.downloadBlob = function (content, filename, mime) {
    const blob = new Blob([content], { type: mime || 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  App.downloadFormat = function (kind) {
    const stem = App.projectName || 'untitled';
    if (kind === 'hexpattern') App.downloadBlob(Formats.writeHexpattern(App.patterns), stem + '.hexpattern');
    else if (kind === 'hexparse') App.downloadBlob(Formats.writeHexparse(App.patterns), stem + '.hexparse');
    else if (kind === 'hex') App.downloadBlob(Formats.writeHex(App.patterns, stem), stem + '.hex');
  };

  App.exportGridImage = function () {
    const a = document.createElement('a');
    a.href = $('#grid_canvas').toDataURL('image/png');
    a.download = (App.projectName || 'untitled') + '.png';
    a.click();
  };

  App.regenerate = function (seed) {
    const s = seed != null ? seed : Math.floor(Math.random() * 1e9);
    App.world = new WorldLib.World(420, 170, s);
    App.camera.x = App.world.caster.x;
    App.camera.y = App.world.caster.y;
    App.evaluate();
    UI.renderAll();
    App.requestRender();
    App.log(`New world, seed ${s}.`, 'info');
  };

  // ------------------------------------------------------- world rendering
  function renderWorld() {
    const canvas = $('#world_canvas');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = rect.width, H = rect.height;
    const w = App.world;
    const ts = TILE * App.camera.zoom;

    // sky
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    if (w.raining) { grad.addColorStop(0, '#2b3340'); grad.addColorStop(1, '#4a5560'); }
    else { grad.addColorStop(0, '#3a5b8c'); grad.addColorStop(1, '#8fb4d4'); }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // world -> screen
    const ox = W / 2 - App.camera.x * ts;
    const oy = H / 2 + App.camera.y * ts;
    const sx = (wx) => ox + wx * ts;
    const sy = (wy) => oy - wy * ts;

    const x0 = Math.max(0, Math.floor((0 - ox) / ts) - 1);
    const x1 = Math.min(w.w - 1, Math.ceil((W - ox) / ts) + 1);
    const y1 = Math.min(w.h - 1, Math.ceil((oy - 0) / ts) + 1);
    const y0 = Math.max(0, Math.floor((oy - H) / ts) - 1);

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const id = w.get(x, y);
        if (id === WorldLib.B.AIR) continue;
        const b = WorldLib.BLOCKS[id];
        const px = sx(x), py = sy(y + 1);
        const t = w.tint[w.idx(x, w.h - 1 - y)] || 0;
        ctx.fillStyle = shade(b.color, (t - 12) * 0.006);
        if (b.liquid) ctx.globalAlpha = id === WorldLib.B.WATER ? 0.75 : 0.9;
        ctx.fillRect(px, py, ts + 1, ts + 1);
        ctx.globalAlpha = 1;
        if (b.light && ts > 6) {
          ctx.globalAlpha = 0.16;
          ctx.fillStyle = b.color;
          ctx.fillRect(px - ts, py - ts, ts * 3, ts * 3);
          ctx.globalAlpha = 1;
        }
      }
    }

    // rain
    if (w.raining) {
      ctx.strokeStyle = 'rgba(180,200,230,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 90; i++) {
        const rx = (i * 7919 + (w.tickCount * 9) % 1000) % W;
        const ry = (i * 104729 + w.tickCount * 22) % H;
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 3, ry + 10);
      }
      ctx.stroke();
    }

    // entities
    for (const e of w.entities) {
      const ew = e.w * e.scale * ts, eh = e.h * e.scale * ts;
      const px = sx(e.x) - ew / 2, py = sy(e.y + e.h * e.scale);
      if (px < -60 || px > W + 60) continue;
      if (e.kind === 'caster') {
        ctx.save();
        ctx.shadowColor = '#D8B8E0';
        ctx.shadowBlur = 16;
        ctx.fillStyle = '#e6d6f5';
        ctx.beginPath();
        ctx.arc(sx(e.x), sy(e.y + e.h / 2), Math.max(4, ew * 0.55), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = '#D8B8E0';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(sx(e.x), sy(e.y + e.h / 2), Math.max(7, ew * 0.95), 0, Math.PI * 2);
        ctx.stroke();
      } else if (e.kind === 'sentinel') {
        ctx.strokeStyle = '#BAC5E2';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const r = Math.max(5, ew * 0.7);
        const cx = sx(e.x), cy = sy(e.y + e.h / 2);
        for (let k = 0; k < 6; k++) {
          const a = (Math.PI / 3) * k + w.tickCount * 0.02;
          const qx = cx + Math.cos(a) * r, qy = cy + Math.sin(a) * r;
          if (k === 0) ctx.moveTo(qx, qy); else ctx.lineTo(qx, qy);
        }
        ctx.closePath();
        ctx.stroke();
      } else {
        ctx.fillStyle = e.kind === 'monster' ? '#b05a8a' : '#c9a86a';
        ctx.fillRect(px, py, ew, eh);
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        const es = Math.max(1, ts * 0.12);
        ctx.fillRect(px + ew * 0.2, py + eh * 0.2, es, es);
        ctx.fillRect(px + ew * 0.65, py + eh * 0.2, es, es);
      }
      if (Object.keys(e.effects).length) {
        ctx.fillStyle = 'rgba(200,160,230,0.5)';
        ctx.fillRect(px, py - 4, ew, 2);
      }
    }

    // spell particles
    if (w.particles.length) {
      const pr = Math.max(1.2, ts * 0.13);
      for (const p of w.particles) {
        const px = sx(p.x), py = sy(p.y);
        if (px < -10 || px > W + 10 || py < -10 || py > H + 10) continue;
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
        ctx.fillStyle = p.color;
        ctx.fillRect(px - pr / 2, py - pr / 2, pr, pr);
      }
      ctx.globalAlpha = 1;
    }

    // transient effects
    for (const fx of w.effects) {
      const px = sx(fx.x), py = sy(fx.y);
      ctx.globalAlpha = Math.max(0, fx.life);
      if (fx.kind === 'explosion') {
        ctx.strokeStyle = fx.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(px, py, fx.size * ts * (1.4 - fx.life), 0, Math.PI * 2);
        ctx.stroke();
      } else if (fx.kind === 'lightning') {
        ctx.strokeStyle = fx.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(px, 0);
        let yy = 0;
        while (yy < py) {
          yy += 18;
          ctx.lineTo(px + (Math.random() - 0.5) * 16, Math.min(yy, py));
        }
        ctx.stroke();
      } else {
        ctx.fillStyle = fx.color;
        ctx.beginPath();
        ctx.arc(px, py, ts * 0.5 * (1.5 - fx.life), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    $('#hud_pos').textContent =
      `Mind (${w.caster.x.toFixed(1)}, ${w.caster.y.toFixed(1)})`
      + `  ·  cursor (${App.cursor.x.toFixed(2)}, ${App.cursor.y.toFixed(2)})`
      + `  ·  seed ${w.seed}  ·  zoom ${App.camera.zoom.toFixed(2)}`;
  }

  function shade(hex, amt) {
    if (!hex) return '#000';
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.max(0, Math.min(255, Math.round(r * (1 + amt))));
    g = Math.max(0, Math.min(255, Math.round(g * (1 + amt))));
    b = Math.max(0, Math.min(255, Math.round(b * (1 + amt))));
    return `rgb(${r},${g},${b})`;
  }

  // ------------------------------------------------------------- controls
  function setCasting(on) {
    App.castingMode = on;
    $('#grid_canvas').hidden = !on;
    $('#grid_controls').hidden = !on;
    $('#btn_cast').classList.toggle('on', on);
    if (on) UI.showPanel('patterns');
    App.requestRender();
  }

  function bindEvents() {
    document.querySelectorAll('.menu_btn[data-panel]').forEach((b) => {
      b.onclick = () => {
        if (UI.activePanel === b.dataset.panel && !$('#panels').classList.contains('collapsed')) {
          $('#panels').classList.toggle('collapsed');
        } else UI.showPanel(b.dataset.panel);
      };
    });

    $('#btn_cast').onclick = () => setCasting(!App.castingMode);
    $('#btn_cast_now').onclick = () => App.cast();
    $('#btn_clear').onclick = () => App.clearPatterns();
    $('#btn_sort').onclick = () => App.grid.relayout();
    $('#btn_zoom_in').onclick = () => App.grid.setScale(App.grid.scale + 0.1);
    $('#btn_zoom_out').onclick = () => App.grid.setScale(App.grid.scale - 0.1);

    const input = $('#add_pattern_input');
    input.addEventListener('input', () => { UI.acIndex = 0; UI.updateAutocomplete(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { UI.acIndex = Math.min(UI.acItems.length - 1, UI.acIndex + 1); UI.updateAutocomplete(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { UI.acIndex = Math.max(0, UI.acIndex - 1); UI.updateAutocomplete(); e.preventDefault(); }
      else if (e.key === 'Enter' || e.key === 'Tab') { UI.commitAutocomplete(); e.preventDefault(); }
      else if (e.key === 'Escape') { $('#autocomplete').hidden = true; input.blur(); }
      e.stopPropagation();
    });
    input.addEventListener('blur', () => { setTimeout(() => { $('#autocomplete').hidden = true; }, 120); });
    $('#add_pattern_btn').onclick = () => UI.commitAutocomplete();

    $('#overlay_cancel').onclick = () => UI.closeOverlay();
    $('#overlay_ok').onclick = () => {
      const text = $('#overlay_text').value;
      if (UI._overlayOk) UI._overlayOk(text);
      else navigator.clipboard && navigator.clipboard.writeText(text);
      UI.closeOverlay();
    };

    const tl = $('#timeline_canvas');
    tl.addEventListener('click', (e) => {
      const r = tl.getBoundingClientRect();
      UI.timelineClick(e.clientX - r.left, e.clientY - r.top);
    });

    // Track the cursor in world space on the whole stage, not just the world
    // canvas — the grid canvas covers it while casting, but the world is still
    // visible underneath and the mapping is the same.
    $('#stage').addEventListener('mousemove', (e) => {
      const r = $('#world_canvas').getBoundingClientRect();
      const ts = TILE * App.camera.zoom;
      const ox = r.width / 2 - App.camera.x * ts;
      const oy = r.height / 2 + App.camera.y * ts;
      App.cursor.x = ((e.clientX - r.left) - ox) / ts;
      App.cursor.y = (oy - (e.clientY - r.top)) / ts;
    });

    // world camera
    const wc = $('#world_canvas');
    let dragging = false, last = null;
    wc.addEventListener('mousedown', (e) => { dragging = true; last = { x: e.clientX, y: e.clientY }; });
    window.addEventListener('mouseup', () => { dragging = false; });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const ts = TILE * App.camera.zoom;
      App.camera.x -= (e.clientX - last.x) / ts;
      App.camera.y += (e.clientY - last.y) / ts;
      last = { x: e.clientX, y: e.clientY };
      App.requestRender();
    });
    wc.addEventListener('wheel', (e) => {
      e.preventDefault();
      App.camera.zoom = Math.max(0.35, Math.min(4, App.camera.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
      App.requestRender();
    }, { passive: false });

    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      App.keys[e.key.toLowerCase()] = true;
      if (e.code === 'Space') { App.spaceHeld = true; e.preventDefault(); }

      if (e.key === 'Escape') {
        if (!$('#overlay').hidden) UI.closeOverlay();
        else if (App.castingMode) setCasting(false);
      } else if (e.key.toLowerCase() === 'c') {
        setCasting(!App.castingMode);
      } else if (e.key === 'Enter') {
        App.cast();
      } else if (e.altKey && e.key === 'ArrowLeft') {
        App.timelineIndex = Math.max(-1, App.timelineIndex - 1);
        UI.renderAll(); App.requestRender(); e.preventDefault();
      } else if (e.altKey && e.key === 'ArrowRight') {
        App.timelineIndex = Math.min(App.patterns.length - 1, App.timelineIndex + 1);
        UI.renderAll(); App.requestRender(); e.preventDefault();
      } else if (['1', '2', '3', '4'].includes(e.key)) {
        UI.showPanel(['patterns', 'stack', 'casting', 'file'][parseInt(e.key, 10) - 1]);
      }
    });
    window.addEventListener('keyup', (e) => {
      App.keys[e.key.toLowerCase()] = false;
      if (e.code === 'Space') App.spaceHeld = false;
    });

    window.addEventListener('resize', () => { resizeGrid(); App.requestRender(); UI.renderTimeline(); });
  }

  function resizeGrid() {
    const canvas = $('#grid_canvas');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
  }

  function moveMind() {
    const c = App.world.caster;
    const sp = 0.16;
    let moved = false;
    if (App.keys['a'] || App.keys['arrowleft']) { c.vx -= sp; c.look = { x: -1, y: 0 }; moved = true; }
    if (App.keys['d'] || App.keys['arrowright']) { c.vx += sp; c.look = { x: 1, y: 0 }; moved = true; }
    if (App.keys['w'] || App.keys['arrowup']) { c.vy += sp; c.look = { x: 0, y: 1 }; moved = true; }
    if (App.keys['s'] || App.keys['arrowdown']) { c.vy -= sp; c.look = { x: 0, y: -1 }; moved = true; }
    if (moved) {
      App.camera.x += (c.x - App.camera.x) * 0.12;
      App.camera.y += (c.y - App.camera.y) * 0.12;
      App.requestRender();
    }
  }

  // ------------------------------------------------------------------ boot
  function init() {
    App.world = new WorldLib.World(420, 170, Math.floor(Math.random() * 1e9));
    App.camera.x = App.world.caster.x;
    App.camera.y = App.world.caster.y;
    App.grid = new HexGrid($('#grid_canvas'));

    bindEvents();
    resizeGrid();
    UI.showPanel('patterns');
    App.evaluate();
    UI.renderAll();

    App.log('HexWorld ready. Press C to open the casting grid.', 'info');
    App.log('Draw patterns on the hex lattice, or type names in the box.', 'info');

    let lastTick = 0;
    let lastShimmer = 0;
    function loop(t) {
      if (t - lastTick > 50) { lastTick = t; App.world.tick(); moveMind(); App.requestRender(); }
      if (App.castingMode && t - lastShimmer > 100) { lastShimmer = t; App.grid.tickShimmer(); }
      if (App.dirty) {
        App.dirty = false;
        renderWorld();
        if (App.castingMode) App.grid.render();
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
