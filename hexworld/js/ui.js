// Side panel: Patterns / Stack / Casting Context / File, plus the timeline.

(function () {
  const UI = {};
  const $ = (s) => document.querySelector(s);

  // ---------------------------------------------------------------- panels
  UI.activePanel = 'patterns';

  UI.showPanel = function (name) {
    UI.activePanel = name;
    document.querySelectorAll('.panel').forEach((p) => {
      p.hidden = p.dataset.panel !== name;
    });
    document.querySelectorAll('.menu_btn[data-panel]').forEach((b) => {
      b.classList.toggle('active', b.dataset.panel === name);
    });
    $('#panels').classList.remove('collapsed');
    UI.renderAll();
  };

  UI.renderAll = function () {
    if (UI.activePanel === 'patterns') UI.renderPatterns();
    else if (UI.activePanel === 'stack') UI.renderStack();
    else if (UI.activePanel === 'casting') UI.renderCasting();
    else if (UI.activePanel === 'file') UI.renderFile();
    UI.renderTimeline();
  };

  // ------------------------------------------------------- patterns panel
  // The log reads top-to-bottom in execution order, with introspection blocks
  // indented the way Hex Studio's text export does it.
  UI.renderPatterns = function () {
    const host = $('#pattern_list');
    host.innerHTML = '';

    if (!App.patterns.length) {
      host.innerHTML = '<div class="empty_note">No patterns yet. Draw on the grid, or type a name below.</div>';
      return;
    }

    let depth = 0;
    App.patterns.forEach((p, i) => {
      const match = p.match || Registry.matchPattern(p.signature, p.startDir);
      if (match.id === 'close_paren') depth = Math.max(0, depth - 1);

      const row = document.createElement('div');
      row.className = 'pattern_row';
      row.draggable = true;
      row.dataset.index = i;

      if (App.timelineIndex >= 0 && i > App.timelineIndex) row.classList.add('future');
      if (App.resolutions[i] === 'ERRORED') row.classList.add('errored');
      if (match.kind === 'unknown') row.classList.add('unknown');
      if (i === App.selectedPattern) row.classList.add('selected');

      const idx = document.createElement('span');
      idx.className = 'p_idx';
      idx.textContent = i + 1;

      const del = document.createElement('button');
      del.textContent = '×';
      del.title = 'Delete';
      del.onclick = (e) => { e.stopPropagation(); App.removePattern(i); };

      const name = document.createElement('span');
      name.className = 'p_name';
      const pad = document.createElement('span');
      pad.className = 'pattern_indent';
      pad.style.width = (depth * 14) + 'px';
      name.appendChild(pad);
      name.appendChild(document.createTextNode(match.name));
      name.title = `${Hex.DIR_NAMES[p.startDir]} ${p.signature}`;

      const sig = document.createElement('span');
      sig.className = 'p_sig';
      sig.textContent = p.signature.length > 12 ? p.signature.slice(0, 12) + '…' : p.signature;

      const handle = document.createElement('span');
      handle.className = 'p_drag';
      handle.textContent = '≡';

      row.append(idx, del, name, sig, handle);
      row.onclick = () => { App.selectedPattern = App.selectedPattern === i ? -1 : i; UI.renderPatterns(); App.requestRender(); };

      row.addEventListener('dragstart', (e) => {
        App.dragIndex = i;
        row.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      row.addEventListener('dragend', () => row.classList.remove('dragging'));
      row.addEventListener('dragover', (e) => { e.preventDefault(); });
      row.addEventListener('drop', (e) => {
        e.preventDefault();
        if (App.dragIndex != null && App.dragIndex !== i) App.movePattern(App.dragIndex, i);
        App.dragIndex = null;
      });

      host.appendChild(row);
      if (match.id === 'open_paren') depth++;
    });
  };

  // ---------------------------------------------------------- stack panel
  UI.renderStack = function () {
    const host = $('#stack_list');
    host.innerHTML = '';
    const img = App.currentImage();
    const stack = img ? img.stack : [];

    if (App.lastError) {
      const err = document.createElement('div');
      err.className = 'iota_box';
      err.style.background = '#5a2f2f';
      err.innerHTML = `<span class="index_display">!</span><span class="text"><b>${App.lastError.name}</b><br>${App.lastError.message}</span>`;
      host.appendChild(err);
    }

    if (!stack.length) {
      const n = document.createElement('div');
      n.className = 'empty_note';
      n.textContent = 'The stack is empty.';
      host.appendChild(n);
    }

    // Top of the stack first, so index 1 is the top as in Hex Studio.
    for (let i = stack.length - 1; i >= 0; i--) {
      host.appendChild(iotaBox(stack[i], stack.length - i, 0));
    }

    if (img && img.ravenmind) {
      const label = document.createElement('div');
      label.className = 'section_label';
      label.textContent = 'Ravenmind';
      host.appendChild(label);
      host.appendChild(iotaBox(img.ravenmind, '·', 0));
    }
    if (img && img.parenCount > 0) {
      const label = document.createElement('div');
      label.className = 'section_label';
      label.textContent = `Introspection (depth ${img.parenCount})`;
      host.appendChild(label);
      host.appendChild(iotaBox(Iota.List(img.parenthesized.map((x) => x.iota)), '·', 0));
    }
  };

  function iotaBox(iota, index, depth) {
    const box = document.createElement('div');
    box.className = 'iota_box' + (depth ? ' iota_child' : '');
    box.style.background = Iota.TYPE_COLOR[iota.type] || '#4B4845';
    box.style.marginLeft = (depth * 16) + 'px';

    const idx = document.createElement('span');
    idx.className = 'index_display';
    idx.textContent = index;

    const text = document.createElement('span');
    text.className = 'text';

    if (iota.type === 'list' && iota.value.length) {
      text.innerHTML = `<b>List</b> <span style="opacity:.6">(${iota.value.length})</span>`;
      box.append(idx, text);
      const wrap = document.createElement('div');
      wrap.appendChild(box);
      iota.value.forEach((child, i) => wrap.appendChild(iotaBox(child, i, depth + 1)));
      return wrap;
    }

    text.textContent = Iota.iotaToString(iota, App.world);
    box.append(idx, text);
    return box;
  }

  // -------------------------------------------------------- casting panel
  UI.renderCasting = function () {
    const host = $('#casting_panel');
    host.innerHTML = '';
    const w = App.world;
    const c = w.caster;

    host.appendChild(section('The Mind'));
    host.appendChild(kv('Position', `(${c.x.toFixed(1)}, ${c.y.toFixed(1)})`));
    host.appendChild(kv('Facing', `(${c.look.x}, ${c.look.y})`));
    host.appendChild(kv('Ops used', String(App.lastOps || 0)));

    const focusLabel = section('Attuned Focus');
    host.appendChild(focusLabel);
    host.appendChild(iotaBox(c.focus || Iota.Null(), '·', 0));
    const clear = document.createElement('button');
    clear.className = 'generic_button';
    clear.textContent = ' • Clear focus';
    clear.onclick = () => { c.focus = null; UI.renderCasting(); };
    host.appendChild(clear);

    host.appendChild(section('Ravenmind'));
    const img = App.currentImage();
    host.appendChild(iotaBox((img && img.ravenmind) || Iota.Null(), '·', 0));

    host.appendChild(section('Place Block spell uses'));
    const sel = document.createElement('select');
    WorldLib.BLOCKS.forEach((b) => {
      if (!b || b.id === 0) return;
      const o = document.createElement('option');
      o.value = b.id;
      o.textContent = b.name;
      if (b.id === App.placeBlockId) o.selected = true;
      sel.appendChild(o);
    });
    sel.onchange = () => { App.placeBlockId = parseInt(sel.value, 10); };
    const row = document.createElement('div');
    row.className = 'field_row';
    row.appendChild(sel);
    host.appendChild(row);

    host.appendChild(section('World'));
    host.appendChild(kv('Weather', w.raining ? 'Raining' : 'Clear'));
    host.appendChild(kv('Entities', String(w.entities.length)));
    const rainBtn = document.createElement('button');
    rainBtn.className = 'generic_button';
    rainBtn.textContent = w.raining ? ' • Stop the rain' : ' • Start the rain';
    rainBtn.onclick = () => { w.raining = !w.raining; UI.renderCasting(); };
    host.appendChild(rainBtn);

    host.appendChild(section('Entities'));
    for (const e of w.entities) {
      const box = document.createElement('div');
      box.className = 'entity_row';
      const head = document.createElement('div');
      head.className = 'e_head';
      const nm = document.createElement('span');
      nm.className = 'e_name';
      nm.textContent = `${e.name} #${e.id}`;
      head.appendChild(nm);
      if (e.kind !== 'caster') {
        const del = document.createElement('button');
        del.textContent = '🗑';
        del.onclick = () => { w.removeEntity(e.id); UI.renderCasting(); };
        head.appendChild(del);
      }
      const go = document.createElement('button');
      go.textContent = '⌖';
      go.title = 'Centre camera';
      go.onclick = () => { App.camera.x = e.x; App.camera.y = e.y; App.requestRender(); };
      head.appendChild(go);
      box.appendChild(head);
      const meta = document.createElement('div');
      meta.className = 'e_meta';
      const fx = Object.keys(e.effects);
      meta.textContent = `${e.kind} · (${e.x.toFixed(1)}, ${e.y.toFixed(1)}) · ${e.hp.toFixed(0)} hp`
        + (fx.length ? ` · ${fx.join(', ')}` : '');
      box.appendChild(meta);
      host.appendChild(box);
    }

    const spawn = document.createElement('button');
    spawn.className = 'generic_button';
    spawn.textContent = ' • Spawn a critter at the Mind';
    spawn.onclick = () => {
      w.spawn({ name: 'Critter', kind: 'animal', x: c.x, y: c.y, w: 0.8, h: 0.8, hp: 8, wander: 0.05 });
      UI.renderCasting();
    };
    host.appendChild(spawn);
  };

  function section(label) {
    const d = document.createElement('div');
    d.className = 'section_label';
    d.textContent = label;
    return d;
  }

  function kv(k, v) {
    const d = document.createElement('div');
    d.className = 'field_row';
    d.innerHTML = `<label>${k}</label><span>${v}</span>`;
    return d;
  }

  // ------------------------------------------------------------ file panel
  UI.renderFile = function () {
    const host = $('#file_panel');
    host.innerHTML = '';

    host.appendChild(section('Project'));
    const nameRow = document.createElement('div');
    nameRow.className = 'field_row';
    const input = document.createElement('input');
    input.value = App.projectName;
    input.oninput = () => { App.projectName = input.value; };
    nameRow.appendChild(input);
    host.appendChild(nameRow);

    host.appendChild(document.createElement('div')).className = 'spacer';

    const btn = (label, fn) => {
      const b = document.createElement('button');
      b.className = 'generic_button';
      b.textContent = ' • ' + label;
      b.onclick = fn;
      host.appendChild(b);
      return b;
    };

    btn('Import Patterns', () => UI.openOverlay('Import Patterns', '', (text) => App.importPatternText(text)));
    btn('Export Patterns', () => UI.openOverlay('Export Patterns', App.exportPatternText(), null));
    host.appendChild(gap());
    btn('Import Project', () => UI.openOverlay('Import Project (JSON)', '', (text) => App.importProject(text)));
    btn('Export Project', () => UI.openOverlay('Export Project (JSON)', App.exportProject(), null));
    host.appendChild(gap());
    btn('Download Project File', () => App.downloadProject());
    btn('Export Grid Image (PNG)', () => App.exportGridImage());
    host.appendChild(gap());
    btn('Re-pack pattern drawings', () => App.grid.relayout());
    btn('Clear all patterns', () => App.clearPatterns());
    host.appendChild(gap());

    host.appendChild(section('World'));
    btn('Regenerate world (new seed)', () => App.regenerate());
    const seedRow = document.createElement('div');
    seedRow.className = 'field_row';
    seedRow.innerHTML = '<label>Seed</label>';
    const seedIn = document.createElement('input');
    seedIn.value = App.world.seed;
    seedIn.onchange = () => App.regenerate(parseInt(seedIn.value, 10) || 0);
    seedRow.appendChild(seedIn);
    host.appendChild(seedRow);

    host.appendChild(section('Reference'));
    const help = document.createElement('div');
    help.style.color = 'var(--text_dim)';
    help.style.fontSize = '11.5px';
    help.style.lineHeight = '1.6';
    help.innerHTML = `The text format is one pattern display name per line, with
      <code>{</code> / <code>}</code> for Introspection / Retrospection and four
      spaces of indent per nesting level. The add-pattern box also accepts an
      internal id (<code>get_caster</code>), a raw angle signature
      (<code>qaq</code>), a bare number, or a bookkeeper code
      (<code>v-v</code>).`;
    host.appendChild(help);
  };

  function gap() {
    const d = document.createElement('div');
    d.className = 'spacer';
    return d;
  }

  // ------------------------------------------------------------- overlay
  UI.openOverlay = function (title, text, onOk) {
    $('#overlay_title').textContent = title;
    $('#overlay_text').value = text;
    $('#overlay_ok').textContent = onOk ? 'Import' : 'Copy';
    $('#overlay').hidden = false;
    UI._overlayOk = onOk;
    if (!onOk) $('#overlay_text').select();
  };

  UI.closeOverlay = function () { $('#overlay').hidden = true; };

  // ------------------------------------------------------- autocomplete
  UI.acItems = [];
  UI.acIndex = 0;

  UI.updateAutocomplete = function () {
    const input = $('#add_pattern_input');
    const box = $('#autocomplete');
    const q = input.value.trim();
    if (!q) { box.hidden = true; UI.acItems = []; return; }
    const results = Registry.searchPatterns(q).slice(0, 40);
    UI.acItems = results;
    UI.acIndex = Math.min(UI.acIndex, Math.max(0, results.length - 1));
    if (!results.length) { box.hidden = true; return; }
    box.innerHTML = '';
    results.forEach((r, i) => {
      const el = document.createElement('div');
      el.className = 'ac_item' + (i === UI.acIndex ? ' sel' : '');
      el.innerHTML = `<span>${r.name}</span><span class="ac_sub">${r.signature.slice(0, 14)}</span>`;
      el.onmousedown = (e) => { e.preventDefault(); UI.commitAutocomplete(i); };
      box.appendChild(el);
    });
    box.hidden = false;
  };

  UI.commitAutocomplete = function (i) {
    const r = UI.acItems[i != null ? i : UI.acIndex];
    const input = $('#add_pattern_input');
    if (r) {
      App.addPattern(r.signature, r.startDir, null);
      input.value = '';
    } else {
      App.addFromText(input.value);
      input.value = '';
    }
    $('#autocomplete').hidden = true;
    UI.acItems = [];
    UI.acIndex = 0;
  };

  // ---------------------------------------------------------- timeline
  UI.renderTimeline = function () {
    const canvas = $('#timeline_canvas');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const n = App.patterns.length;
    const y = rect.height * 0.62;
    const x0 = 22, x1 = rect.width - 26;

    ctx.strokeStyle = '#BAC5E2';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();

    if (!n) return;
    const step = n > 1 ? (x1 - x0) / (n - 1) : 0;
    UI._timelineNodes = [];

    for (let i = 0; i < n; i++) {
      const x = n > 1 ? x0 + step * i : (x0 + x1) / 2;
      const selected = i === App.timelineIndex;
      const res = App.resolutions[i];
      let color = '#BAC5E2';
      if (res === 'ERRORED') color = '#dd6666';
      else if (res === 'ESCAPED') color = '#E0E3B8';
      else if (res === 'UNRESOLVED') color = '#5c5f66';
      if (selected) color = '#D8B8E0';

      const r = (i === 0 || i === n - 1 || selected) ? 8 : 5.5;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (Math.PI / 3) * k - Math.PI / 2;
        const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = '#292a2b';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = selected ? 3 : 2;
      ctx.stroke();
      if (selected) { ctx.fillStyle = color; ctx.fill(); }

      UI._timelineNodes.push({ x, y, i });
    }

    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '10.5px ui-monospace, monospace';
    ctx.textAlign = 'right';
    const label = App.timelineIndex >= 0
      ? `step ${App.timelineIndex + 1}/${n}`
      : `${n} pattern${n === 1 ? '' : 's'}`;
    ctx.fillText(label, rect.width - 10, 18);
  };

  UI.timelineClick = function (mx, my) {
    if (!UI._timelineNodes) return;
    let best = null, bestD = 18;
    for (const nd of UI._timelineNodes) {
      const d = Math.hypot(nd.x - mx, nd.y - my);
      if (d < bestD) { best = nd; bestD = d; }
    }
    if (best) {
      App.timelineIndex = App.timelineIndex === best.i ? -1 : best.i;
      UI.renderAll();
      App.requestRender();
    }
  };

  window.UI = UI;
})();
