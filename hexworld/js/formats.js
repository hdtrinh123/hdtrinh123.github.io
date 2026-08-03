// Interop with the file formats that other Hex Casting tools use.
//
//   .hexpattern  — HexDebug / vscode-hex-casting. Plain text, one pattern per
//                  display name per line, `{`/`}` for intro/retro,
//                  `Consideration`, `<DIR sig>` for unknown patterns.
//   .hexparse    — HexParseMod (YukkuriC). A flat token stream: whitespace,
//                  commas and semicolons are all separators; `(`/`)` are
//                  intro/retro, `\` is Consideration, `num_`/`mask_`/`_sig`
//                  encode the special patterns, `[ ]` wrap literal list iotas.
//   .hex         — Hex Studio (master-bw3). NOT json: a MartinSStewart
//                  elm-serialize 1.3.0 binary blob, base64url-encoded (no `=`
//                  padding), with a literal `V1_` prefix. Reimplemented here
//                  byte-for-byte so files round-trip with the real app.
//
// Everything is done against the same Registry the rest of the app uses, so a
// pattern that this app knows survives a round trip through any of the three.

(function () {
  const H = window.Hex;
  const R = window.Registry;

  // ---- direction helpers ----------------------------------------------------
  function dirName(d) { return typeof d === 'number' ? H.DIR_NAMES[d] : d; }

  // Hex Studio's `directionCodec` variant order -> elm-serialize tag (0-indexed).
  //   Northeast=0 Northwest=1 East=2 West=3 Southeast=4 Southwest=5 Error=6
  const HS_DIR_TAG = { NORTH_EAST: 0, NORTH_WEST: 1, EAST: 2, WEST: 3, SOUTH_EAST: 4, SOUTH_WEST: 5 };
  const HS_DIR_NAME = ['NORTH_EAST', 'NORTH_WEST', 'EAST', 'WEST', 'SOUTH_EAST', 'SOUTH_WEST', 'EAST'];

  // Text direction spellings the mods tolerate: SNAKE_CASE, one word, or abbrev.
  function parseDirWord(tok) {
    const t = String(tok).toUpperCase().replace(/[\s_\-]/g, '');
    const map = {
      EAST: 'EAST', E: 'EAST', WEST: 'WEST', W: 'WEST',
      NORTHEAST: 'NORTH_EAST', NE: 'NORTH_EAST',
      NORTHWEST: 'NORTH_WEST', NW: 'NORTH_WEST',
      SOUTHEAST: 'SOUTH_EAST', SE: 'SOUTH_EAST',
      SOUTHWEST: 'SOUTH_WEST', SW: 'SOUTH_WEST',
    };
    return map[t] || null;
  }

  // A pattern that this app's registry keys off `num_`/`mask_` names uses HexParse
  // registry keys; keep the mod namespace for anything that isn't base hexcasting.
  function nsKey(def) { return def.mod ? def.mod + ':' + def.id : def.id; }

  // ==========================================================================
  // .hexpattern  (HexDebug / vscode-hex-casting)
  // ==========================================================================
  function writeHexpattern(patterns) {
    let depth = 0;
    const lines = [];
    for (const p of patterns) {
      const m = R.matchPattern(p.signature, p.startDir);
      if (m.id === 'close_paren') depth = Math.max(0, depth - 1);
      let tok;
      if (m.id === 'open_paren') tok = '{';
      else if (m.id === 'close_paren') tok = '}';
      else if (m.id === 'escape') tok = 'Consideration';
      else if (m.kind === 'unknown') tok = '<' + dirName(p.startDir) + (p.signature ? ' ' + p.signature : '') + '>';
      else tok = m.name; // display name, incl. "Numerical Reflection: 4" / "Bookkeeper's Gambit: v-v"
      lines.push('    '.repeat(depth) + tok);
      if (m.id === 'open_paren') depth++;
    }
    return lines.join('\n');
  }

  function stripComments(text) {
    // Block comments first (may span lines), then line comments.
    return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, '');
  }

  function parseHexpattern(text) {
    const out = { patterns: [], failed: [], skipped: 0 };
    const rawLines = stripComments(text).split('\n');
    for (let raw of rawLines) {
      let line = raw.trim();
      if (!line) continue;
      if (line[0] === '#') continue; // #include / #define directives — not patterns

      // `Consideration:` escapes the pattern that follows it on the same line.
      const consid = line.match(/^Consideration\s*:\s*(.*)$/i);
      if (consid) {
        out.patterns.push({ signature: 'qqqaw', startDir: 'WEST' });
        line = consid[1].trim();
        if (!line) continue;
      }

      addHexpatternToken(line, out);
    }
    return out;
  }

  function addHexpatternToken(line, out) {
    if (line === '{' || line === 'Introspection') { out.patterns.push({ signature: 'qqq', startDir: 'WEST' }); return; }
    if (line === '}' || line === 'Retrospection') { out.patterns.push({ signature: 'eee', startDir: 'EAST' }); return; }
    if (line === '[' || line === ']') { out.skipped++; return; } // literal-list framing, not a pattern
    if (line === 'Consideration') { out.patterns.push({ signature: 'qqqaw', startDir: 'WEST' }); return; }

    // `<DIR sig>` unknown-pattern iota, or `<value>` data literal.
    if (line[0] === '<' && line[line.length - 1] === '>') {
      const inner = line.slice(1, -1).trim();
      const mm = inner.match(/^([A-Za-z_]+)\s*([wedsaq]*)$/i);
      const dir = mm && parseDirWord(mm[1]);
      if (dir) { out.patterns.push({ signature: (mm[2] || '').toLowerCase(), startDir: dir }); return; }
      out.skipped++; // <-6.9>, <(4,2,0)>, <{}>, ... are data, not patterns
      return;
    }

    const r = R.resolveText(line);
    if (r) out.patterns.push({ signature: r.signature, startDir: H.DIR_NAMES[r.startDir] });
    else out.failed.push(line);
  }

  // ==========================================================================
  // .hexparse  (HexParseMod)
  // ==========================================================================
  function writeHexparse(patterns) {
    const toks = [];
    for (const p of patterns) {
      const m = R.matchPattern(p.signature, p.startDir);
      if (m.id === 'open_paren') toks.push('(');
      else if (m.id === 'close_paren') toks.push(')');
      else if (m.id === 'escape') toks.push('\\');
      else if (m.id === 'undo') toks.push('undo');
      else if (m.kind === 'number') toks.push('num_' + R.fmtNum(m.value));
      else if (m.kind === 'mask') toks.push('mask_' + R.maskToString(m.mask));
      else if (m.kind === 'action') toks.push(nsKey(m.def));
      else toks.push('_' + p.signature); // unknown -> raw angle signature (start dir is lost; HexParse assumes EAST)
    }
    return toks.join(',');
  }

  // CodeCutter's lexer: bracket/paren/backslash chars are their own token; word
  // tokens are runs of [A-Za-z0-9 _ . / - : #] plus unicode; separators
  // (space, tab, comma, semicolon, newline) fall between matches and are dropped.
  const HEXPARSE_TOKEN = /\\|\(|\)|\{|\}|\[|\]|[\w./\-:#Ā-￿]+/g;

  function parseHexparse(text) {
    const out = { patterns: [], failed: [], skipped: 0 };
    const src = stripComments(text);
    const toks = src.match(HEXPARSE_TOKEN) || [];
    for (const tok of toks) {
      if (tok === '\\') { out.patterns.push({ signature: 'qqqaw', startDir: 'WEST' }); continue; }
      if (tok === '(' || tok === '{') { out.patterns.push({ signature: 'qqq', startDir: 'WEST' }); continue; }
      if (tok === ')' || tok === '}') { out.patterns.push({ signature: 'eee', startDir: 'EAST' }); continue; }
      if (tok === '[' || tok === ']') { continue; } // structural list framing — flatten through it

      const low = tok.toLowerCase();
      if (low === 'del' || low === 'undo') { out.patterns.push({ signature: 'eeedw', startDir: 'EAST' }); continue; }

      let mm;
      if ((mm = low.match(/^num_(-?[\d.]+(?:e-?\d+)?)$/))) {
        const r = R.numberToSig(parseFloat(mm[1]));
        if (r) out.patterns.push({ signature: r.signature, startDir: r.startDir });
        else out.failed.push(tok);
        continue;
      }
      if ((mm = low.match(/^mask_([-v]+)$/))) {
        const r = R.maskToPattern(mm[1]);
        if (r) out.patterns.push({ signature: r.signature, startDir: r.startDir });
        else out.failed.push(tok);
        continue;
      }
      if ((mm = low.match(/^_([wedsaq]+)$/))) { out.patterns.push({ signature: mm[1], startDir: 'EAST' }); continue; }

      // Bare data literals: numbers, vectors, entities, strings, constants. Not patterns.
      if (/^-?[\d.]+(e-?\d+)?$/i.test(tok) || /^(vec|str_|mat_|entity_|mote_|type|gate|str)/i.test(tok)
        || low === 'true' || low === 'false' || low === 'null' || low === 'garbage' || low === 'self' || low === 'myself') {
        out.skipped++;
        continue;
      }

      const r = R.resolveText(tok);
      if (r) out.patterns.push({ signature: r.signature, startDir: H.DIR_NAMES[r.startDir] });
      else out.failed.push(tok);
    }
    return out;
  }

  // ==========================================================================
  // .hex  (Hex Studio — elm-serialize 1.3.0, big-endian)
  // ==========================================================================
  function ByteWriter() { this.bytes = []; }
  ByteWriter.prototype.u8 = function (v) { this.bytes.push(v & 0xff); };
  ByteWriter.prototype.u16 = function (v) { this.bytes.push((v >>> 8) & 0xff, v & 0xff); };
  ByteWriter.prototype.u32 = function (v) { this.bytes.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff); };
  ByteWriter.prototype.f64 = function (v) {
    const b = new Uint8Array(8);
    new DataView(b.buffer).setFloat64(0, v, false);
    for (let i = 0; i < 8; i++) this.bytes.push(b[i]);
  };
  ByteWriter.prototype.bool = function (v) { this.u8(v ? 1 : 0); };
  ByteWriter.prototype.str = function (s) {
    const enc = new TextEncoder().encode(s);
    this.u32(enc.length);
    for (let i = 0; i < enc.length; i++) this.bytes.push(enc[i]);
  };
  ByteWriter.prototype.finish = function () { return Uint8Array.from(this.bytes); };

  function ByteReader(bytes) {
    this.b = bytes;
    this.p = 0;
    this.dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  ByteReader.prototype.u8 = function () { return this.b[this.p++]; };
  ByteReader.prototype.u16 = function () { const v = this.dv.getUint16(this.p, false); this.p += 2; return v; };
  ByteReader.prototype.u32 = function () { const v = this.dv.getUint32(this.p, false); this.p += 4; return v; };
  ByteReader.prototype.f64 = function () { const v = this.dv.getFloat64(this.p, false); this.p += 8; return v; };
  ByteReader.prototype.bool = function () { return this.u8() !== 0; };
  ByteReader.prototype.str = function () {
    const n = this.u32();
    const slice = this.b.subarray(this.p, this.p + n);
    this.p += n;
    return new TextDecoder().decode(slice);
  };

  function bytesToB64url(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlToBytes(s) {
    let b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  // ProjectData = { patternArray, castingContext, projectName }. We write a valid
  // but empty casting context; patternArray comes first so import only needs it.
  function writeHex(patterns, projectName) {
    const w = new ByteWriter();
    w.u8(1);                       // elm-serialize version byte
    w.u32(patterns.length);        // patternArray : Array SimplifiedPattern
    for (const p of patterns) {
      w.str(p.signature);          // .signature : String
      w.bool(true);                // .active : Bool
      w.u16(HS_DIR_TAG[dirName(p.startDir)] != null ? HS_DIR_TAG[dirName(p.startDir)] : 2); // .startDirection
    }
    // castingContext : { ravenmind, libraries, entities, macros }
    w.u16(0);                      // ravenmind = Nothing (maybe tag 0)
    w.u32(0);                      // libraries : empty dict
    w.u32(0);                      // entities : empty dict
    w.u32(0);                      // macros : empty dict
    w.str(projectName || 'untitled'); // projectName : String
    return 'V1_' + bytesToB64url(w.finish());
  }

  function readHex(text) {
    let s = text.trim();
    if (s.startsWith('V1_')) s = s.slice(3);
    else throw new Error('Not a Hex Studio .hex file (missing V1_ prefix).');
    const r = new ByteReader(b64urlToBytes(s));
    const version = r.u8();
    if (version !== 1) throw new Error('Unsupported .hex version byte ' + version + '.');
    const n = r.u32();
    if (n > 100000) throw new Error('.hex pattern count looks corrupt (' + n + ').');
    const patterns = [];
    for (let i = 0; i < n; i++) {
      const signature = r.str();
      r.bool();                    // active — ignored on import
      const tag = r.u16();
      patterns.push({ signature, startDir: HS_DIR_NAME[tag] || 'EAST' });
    }
    // The rest of the record (casting context, project name) is intentionally
    // not decoded — patterns are the first field, so we already have them.
    return { patterns };
  }

  window.Formats = {
    writeHexpattern, parseHexpattern,
    writeHexparse, parseHexparse,
    writeHex, readHex,
    bytesToB64url, b64urlToBytes,
  };
})();
