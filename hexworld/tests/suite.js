// Shared test suite. Loaded by logic-tests.html after the app scripts.
(function () {
const LOG = [];
const console = { log: (s) => LOG.push(s == null ? '' : String(s)) };

let pass = 0, fail = 0;
function eq(label, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; }
  else { fail++; console.log(`  FAIL ${label}\n       got  ${g}\n       want ${w}`); }
}
function group(n) { console.log('\n== ' + n); }

// ---------------------------------------------------------------- geometry
group('geometry');
eq('signature length n -> n+2 points', Hex.patternPositions('qaq', 0).length, 5);
eq('empty signature -> 2 points', Hex.patternPositions('', 1).length, 2);
eq('EAST delta', Hex.DIR_DELTA[Hex.dirIndex('EAST')], [1, 0]);
eq('rotate EAST by RIGHT = SOUTH_EAST', Hex.DIR_NAMES[Hex.rotate(Hex.dirIndex('EAST'), Hex.RIGHT)], 'SOUTH_EAST');
eq('rotate EAST by LEFT = NORTH_EAST', Hex.DIR_NAMES[Hex.rotate(Hex.dirIndex('EAST'), Hex.LEFT)], 'NORTH_EAST');

// round-trip: signature -> points -> signature
for (const [sig, dir] of [['qaq', 'NORTH_EAST'], ['aawdd', 'EAST'], ['wqaawdd', 'EAST'], ['', 'WEST']]) {
  const pts = Hex.patternPositions(sig, Hex.dirIndex(dir));
  const back = Hex.pointsToPattern(pts);
  eq(`round-trip ${dir} ${sig || '(empty)'}`, [back.signature, Hex.DIR_NAMES[back.startDir]], [sig, dir]);
}

group('validity');
eq('backtracking rejected', Hex.canAppendDir('', 1, Hex.rotate(1, Hex.BACK)), false);
eq('forward ok', Hex.canAppendDir('', 1, 1), true);
// 'eeeee' closes a hexagon — 6 distinct edges, legal.
eq('closed hexagon is legal', Hex.isValidPattern('eeeee', 1), true);
// one more turn retraces the first edge, which is not.
eq('re-traversing an edge rejected', Hex.isValidPattern('eeeeee', 1), false);
eq('vertex revisit allowed (figure eight)', Hex.isValidPattern('qqqqqewwwww', Hex.dirIndex('NORTH_WEST')), true);
// every registry pattern must be geometrically legal
let bad = [];
for (const p of Registry.PATTERNS) {
  if (!Hex.isValidPattern(p.s, Hex.dirIndex(p.d))) bad.push(p.n + ' (' + p.s + ')');
}
eq('all registry patterns are drawable', bad, []);

// ------------------------------------------------------------ number lit
group('numerical reflection');
eq('aqaae = 10', Registry.matchNumber('aqaae'), 10);
eq('aqaaqww = 7', Registry.matchNumber('aqaaqww'), 7);
eq('deddwqea = -32', Registry.matchNumber('deddwqea'), -32);
eq('aqaaqdww = 4.5', Registry.matchNumber('aqaaqdww'), 4.5);
eq('not a number', Registry.matchNumber('qaq'), null);
// generator round-trips
for (const v of [0, 1, 5, 7, 10, 12, 32, 64, 100, -3, -32, 0.5, 4.5, 1000]) {
  const r = Registry.numberToSig(v);
  eq(`numberToSig(${v}) round-trips`, r ? Registry.matchNumber(r.signature) : null, v);
}

// ------------------------------------------------------------- bookkeeper
group("bookkeeper's gambit");
const mk = (sig, dir) => Registry.maskToString(Registry.matchMask(sig, Hex.dirIndex(dir)));
eq('eada/EAST = -vv', mk('eada', 'EAST'), '-vv');
eq('aeea/SOUTH_EAST = v-v', mk('aeea', 'SOUTH_EAST'), 'v-v');
eq('ae/SOUTH_EAST = v-', mk('ae', 'SOUTH_EAST'), 'v-');
for (const code of ['-', 'v', '--', 'v-', '-v', 'v-v', '-vv', 'vv-', '---', 'v--v', '-v-v']) {
  const r = Registry.maskToPattern(code);
  eq(`maskToPattern("${code}") round-trips`,
    r ? Registry.maskToString(Registry.matchMask(r.signature, Hex.dirIndex(r.startDir))) : null, code);
}

// -------------------------------------------------------------- matching
group('matching');
eq('qaq is Mind\'s Reflection', Registry.matchPattern('qaq', 0).name, "Mind's Reflection");
eq('registry beats number handler', Registry.matchPattern('aqaa', 0).kind, 'number');
eq('qqq is a special form', Registry.matchPattern('qqq', 4).id, 'open_paren');
eq('gibberish is unknown', Registry.matchPattern('qeqeqeqeqe', 0).kind, 'unknown');
// signature alone is the key: same sig, different start dir, same action
eq('rotation invariant', Registry.matchPattern('qaq', 3).name, "Mind's Reflection");
// no duplicate signatures in the registry
const seen = new Map(); const dupes = [];
for (const p of Registry.PATTERNS) {
  if (seen.has(p.s)) dupes.push(`${p.n} collides with ${seen.get(p.s)} on "${p.s}"`);
  seen.set(p.s, p.n);
}
eq('no duplicate signatures', dupes, []);

// ------------------------------------------------------------------- VM
group('vm');
const W = new WorldLib.World(80, 60, 12345);
window.App = { evalWorld: W, evalLibraries: {}, placeBlockId: WorldLib.B.STONE, world: W };

function cast(text) {
  const iotas = [];
  for (const line of text.trim().split('\n')) {
    const t = line.trim();
    if (!t) continue;
    const r = Registry.resolveText(t);
    if (!r) throw new Error('unresolved: ' + t);
    iotas.push(Iota.Pat(r.signature, r.startDir));
  }
  window.App.evalWorld = W;
  return VMLib.runHex(iotas, { world: W, rng: () => 0.5, log: () => {} });
}
const show = (r) => r.image.stack.map((i) => Iota.iotaToString(i, W));

eq('number pushes', show(cast('5')), ['5.00']);
eq('addition', show(cast('5\n3\nAdditive Distillation')), ['8.00']);
eq('subtraction order', show(cast('5\n3\nSubtractive Distillation')), ['2.00']);
eq('division by zero mishaps', cast('5\n0\nDivision Distillation').error.name, 'Mathematical Error');
eq('not enough args', cast('Additive Distillation').error.name, 'Not Enough Iotas');
eq('swap', show(cast("1\n2\nJester's Gambit")), ['2.00', '1.00']);
eq('duplicate', show(cast('7\nGemini Decomposition')), ['7.00', '7.00']);
eq('over', show(cast("1\n2\nProspector's Gambit")), ['1.00', '2.00', '1.00']);
eq('tuck', show(cast("1\n2\nUndertaker's Gambit")), ['2.00', '1.00', '2.00']);
eq('rotate', show(cast('1\n2\n3\nRotation Gambit')), ['2.00', '3.00', '1.00']);
eq('rotate reverse', show(cast('1\n2\n3\nRotation Gambit II')), ['3.00', '1.00', '2.00']);
eq('stack_len', show(cast("1\n2\nFlock's Reflection")), ['1.00', '2.00', '2.00']);

group('swizzle (lehmer)');
eq('code 0 is identity', show(cast("1\n2\n3\n0\nSwindler's Gambit")), ['1.00', '2.00', '3.00']);
eq('code 1 swaps top two', show(cast("1\n2\n3\n1\nSwindler's Gambit")), ['1.00', '3.00', '2.00']);
eq('code 2', show(cast("1\n2\n3\n2\nSwindler's Gambit")), ['2.00', '1.00', '3.00']);

group('fisherman');
eq('depth 0 is a no-op', show(cast("1\n2\n3\n0\nFisherman's Gambit")), ['1.00', '2.00', '3.00']);
eq('depth 1 == swap', show(cast("1\n2\n3\n1\nFisherman's Gambit")), ['1.00', '3.00', '2.00']);
eq('depth 2 lifts the deepest', show(cast("1\n2\n3\n2\nFisherman's Gambit")), ['2.00', '3.00', '1.00']);
eq('negative pushes top down', show(cast("1\n2\n3\n-2\nFisherman's Gambit")), ['3.00', '1.00', '2.00']);
eq('out of range mishaps', cast("1\n2\n9\nFisherman's Gambit").error.name, 'Incorrect Iota');
eq('copy keeps original', show(cast("1\n2\n3\n1\nFisherman's Gambit II")), ['1.00', '2.00', '3.00', '2.00']);

group('introspection');
// Patterns inside {} are buffered as pattern iotas, NOT executed — so this is a
// list of two Numerical Reflection *patterns*, not the numbers 1 and 2.
eq('introspection buffers patterns, not values', show(cast('{\n1\n2\n}')),
  ['[Numerical Reflection: 1, Numerical Reflection: 2]']);
// Nested Intro/Retro are themselves buffered, leaving the list flat. The nesting
// only materialises when the list is later evaluated.
eq('nested introspection stays flat until evaluated', show(cast('{\n1\n{\n2\n}\n}')),
  ['[Numerical Reflection: 1, Introspection, Numerical Reflection: 2, Retrospection]']);
eq('...and nests once evaluated', show(cast("{\n1\n{\n2\n}\n}\nHermes' Gambit")),
  ['1.00', '[Numerical Reflection: 2]']);
eq('empty list', show(cast('{\n}')), ['[]']);
eq('consideration escapes', show(cast("Consideration\nMind's Reflection")), ["Mind's Reflection"]);
eq('double consideration', show(cast('Consideration\nConsideration')), ['Consideration']);
eq('retrospection alone mishaps', cast('}').error.name, 'Too Many Closing Parens');
eq('evanition undoes', show(cast('{\n1\n2\nEvanition\n}')), ['[Numerical Reflection: 1]']);

group('lists');
// Build lists of *values* with Flock's Gambit rather than introspection.
const L = (...vals) => vals.join('\n') + `\n${vals.length}\nFlock's Gambit`;
eq('flock builds a value list', show(cast(L(1, 2))), ['[1.00, 2.00]']);
eq('append', show(cast(L(1) + '\n2\nIntegration Distillation')), ['[1.00, 2.00]']);
eq('unappend', show(cast(L(1, 2) + '\nDerivation Decomposition')), ['[1.00]', '2.00']);
eq('index', show(cast(L(7, 8, 9) + '\n1\nSelection Distillation')), ['8.00']);
eq('index out of bounds -> Null', show(cast(L(7) + '\n5\nSelection Distillation')), ['Null']);
eq('index negative -> Null', show(cast(L(7) + '\n-1\nSelection Distillation')), ['Null']);
eq('index_of finds', show(cast(L(7, 8) + "\n8\nLocator's Distillation")), ['1.00']);
eq('index_of absent -> -1', show(cast(L(7) + "\n9\nLocator's Distillation")), ['-1.00']);
eq('slice end-exclusive', show(cast(L(1, 2, 3, 4) + '\n0\n2\nSelection Exaltation')), ['[1.00, 2.00]']);
eq('slice reversed pair normalises', show(cast(L(1, 2, 3, 4) + '\n2\n0\nSelection Exaltation')), ['[1.00, 2.00]']);
eq('slice equal indices -> empty', show(cast(L(1, 2) + '\n1\n1\nSelection Exaltation')), ['[]']);
eq('slice out of range mishaps', cast(L(1) + '\n0\n9\nSelection Exaltation').error.name, 'Incorrect Iota');
eq('splat', show(cast(L(1, 2) + "\nFlock's Disintegration")), ['1.00', '2.00']);
eq('last_n_list', show(cast("1\n2\n3\n2\nFlock's Gambit")), ['1.00', '[2.00, 3.00]']);
eq('reverse', show(cast(L(1, 2, 3) + '\nRetrograde Purification')), ['[3.00, 2.00, 1.00]']);
eq('construct prepends', show(cast(L(2, 3) + "\n1\nSpeaker's Distillation")), ['[1.00, 2.00, 3.00]']);
eq('deconstruct', show(cast(L(1, 2) + "\nSpeaker's Decomposition")), ['[2.00]', '1.00']);
eq('replace', show(cast(L(1, 2, 3) + "\n1\n9\nSurgeon's Exaltation")), ['[1.00, 9.00, 3.00]']);
eq('remove_from', show(cast(L(1, 2, 3) + "\n1\nExcisor's Distillation")), ['[1.00, 3.00]']);
eq('unique', show(cast(L(1, 2, 2, 1) + '\nUniqueness Purification')), ['[1.00, 2.00]']);
eq('list length via abs', show(cast(L(1, 2, 3) + '\nLength Purification')), ['3.00']);
eq('concat via add', show(cast(L(1) + '\n' + L(2) + '\nAdditive Distillation')), ['[1.00, 2.00]']);

group('meta');
eq('hermes evaluates a list', show(cast('{\n2\n3\nAdditive Distillation\n}\nHermes\' Gambit')), ['5.00']);
eq('hermes on a bare pattern', show(cast("2\n3\nConsideration\nAdditive Distillation\nHermes' Gambit")), ['5.00']);
// Thoth: each iteration restarts from the entry stack with the element on top,
// and everything left over is flattened into one accumulator.
// The code list is patterns (so introspection is right for it); the data list
// must hold values, so it is built with Flock's Gambit.
eq('thoth doubles each element',
  show(cast("{\n2\nMultiplicative Distillation\n}\n" + L(1, 2, 3) + "\nThoth's Gambit")),
  ['[2.00, 4.00, 6.00]']);
eq('thoth flattens multi-iota iterations',
  show(cast("{\nGemini Decomposition\n}\n" + L(1, 2) + "\nThoth's Gambit")),
  ['[1.00, 1.00, 2.00, 2.00]']);
eq('thoth over an empty list', show(cast("{\n}\n{\n}\nThoth's Gambit")), ['[]']);
// Each iteration restarts from the entry stack, so a value already there is
// visible to every iteration.
eq('thoth iterations start from the entry stack',
  show(cast("100\n{\nAdditive Distillation\n}\n" + L(1, 2) + "\nThoth's Gambit")),
  ['100.00', '[101.00, 102.00]']);
// Ravenmind survives iterations because it lives outside the stack.
eq('ravenmind accumulates across thoth',
  show(cast(`0
Huginn's Gambit
{
Muninn's Reflection
Additive Distillation
Huginn's Gambit
}
` + L(1, 2, 3) + `
Thoth's Gambit
Muninn's Reflection`)),
  ['[]', '6.00']);
eq('charon halts inside thoth',
  show(cast("{\nCharon's Gambit\n}\n" + L(1, 2) + "\nThoth's Gambit")).length > 0, true);

group('logic');
eq('greater', show(cast('5\n3\nMaximus Distillation')), ['True']);
eq('equality tolerance', show(cast('5\n5\nEquality Distillation')), ['True']);
eq('bool coerce of empty list', show(cast("{\n}\nAugur's Purification")), ['False']);
eq('if', show(cast("True\n1\n2\nAugur's Exaltation")), ['1.00']);
eq('bitwise and', show(cast('12\n10\nConjunction Distillation')), ['8.00']);
eq('list intersection', show(cast(L(1, 2) + '\n' + L(2, 3) + '\nConjunction Distillation')), ['[2.00]']);

group('math edge cases');
eq('0^0 = 1', show(cast('0\n0\nPower Distillation')), ['1.00']);
eq('negative base fractional exp mishaps', cast('-2\n0.5\nPower Distillation').error.name, 'Mathematical Error');
eq('vector projection onto zero vector', show(cast('Vector Reflection +X\nVector Reflection Zero\nPower Distillation')), ['(0.00, 0.00, 0.00)']);
eq('coerce_axial of zero vector', show(cast('Vector Reflection Zero\nAxial Purification')), ['(0.00, 0.00, 0.00)']);
eq('coerce_axial of a number', show(cast('-7\nAxial Purification')), ['-1.00']);
eq('modulo sign follows dividend', show(cast('-5\n3\nModulus Distillation')), ['-2.00']);
eq('log base 1 mishaps', cast('5\n1\nLogarithmic Distillation').error.name, 'Mathematical Error');
eq('dot product', show(cast('Vector Reflection +X\nVector Reflection +X\nMultiplicative Distillation')), ['1.00']);
eq('cross product', show(cast('Vector Reflection +X\nVector Reflection +Y\nDivision Distillation')), ['(0.00, 0.00, 1.00)']);
eq('vector construct/deconstruct', show(cast('1\n2\n3\nVector Exaltation\nVector Disintegration')), ['1.00', '2.00', '3.00']);

group('duplicate_n');
eq('n=0 consumes both', show(cast('7\n0\nGemini Gambit')), []);
eq('n=1 identity', show(cast('7\n1\nGemini Gambit')), ['7.00']);
eq('n=3', show(cast('7\n3\nGemini Gambit')), ['7.00', '7.00', '7.00']);

group('mask execution');
eq('v- drops the deeper of two', show(cast('1\n2\nv-')), ['2.00']);
eq('-v drops the top', show(cast('1\n2\n-v')), ['1.00']);
eq('-- keeps both', show(cast('1\n2\n--')), ['1.00', '2.00']);
eq('vv clears two', show(cast('1\n2\nvv')), []);

group('mishaps');
eq('invalid pattern pushes garbage', show(cast('qeqeqeqeqe')), ['Garbage (Invalid Pattern)']);
eq('valid hex reports no error', !cast("{\n1\n}\nHermes' Gambit").error, true);
eq('unescaped value mishaps', cast("5\nHermes' Gambit").error.name, 'Incorrect Iota');
eq('error aborts the rest', show(cast("Additive Distillation\n1\n2")).length, 2);

group('world spells');
// Break Block succeeds regardless of what is (or isn't) there.
eq('break block on solid ground', !cast(`Mind's Reflection
Compass' Purification II
Vector Reflection -Y
Additive Distillation
Break Block`).error, true);
eq('break block on empty air does not mishap', !cast(`Mind's Reflection
Compass' Purification II
Numerical Reflection: 40
Vector Reflection +Y
Multiplicative Distillation
Additive Distillation
Break Block`).error, true);
eq('break block on bedrock does not mishap',
  !cast('0\n0\n0\nVector Exaltation\nBreak Block').error, true);
const before = W.get(W.caster.x, W.caster.y - 3);
const r = cast(`Mind's Reflection
Compass' Purification II
Conjure Block`);
eq('conjure block has no mishap', !r.error, true);
eq('raycast returns something sane',
  (() => { const rr = cast("Mind's Reflection\nCompass' Purification II\nVector Reflection -Y\nArcher's Distillation"); return rr.error ? rr.error.name : Iota.typeName(rr.image.stack[0]); })(),
  'Vector');

group('hexal + hexworld additions');
// Running Sum is a SCAN, not a reduce — the book's own example.
eq('running sum of [1,2,5] = [1,3,8]',
  show(cast(L(1, 2, 5) + '\nRunning Sum Purification')), ['[1.00, 3.00, 8.00]']);
eq('running sum output length matches input',
  cast(L(1, 2, 5) + '\nRunning Sum Purification').image.stack[0].value.length, 3);
eq('running sum of an empty list', show(cast("{\n}\nRunning Sum Purification")), ['[]']);
eq('running sum over vectors',
  show(cast("Vector Reflection +X\nVector Reflection +X\n2\nFlock's Gambit\nRunning Sum Purification")),
  ['[(1.00, 0.00, 0.00), (2.00, 0.00, 0.00)]']);
eq('running sum rejects a mixed list',
  cast("1\nVector Reflection +X\n2\nFlock's Gambit\nRunning Sum Purification").error.name, 'Incorrect Iota');
eq('running sum by internal id', Registry.resolveText('hexal:running/sum').signature, 'aea');

// Particles consumes its argument and pushes nothing.
W.particles = [];
eq('particles on a vector leaves nothing on the stack',
  show(cast('1\n1\n0\nVector Exaltation\nParticles')), []);
eq('particles on a vector spawns one', W.particles.length, 1);
W.particles = [];
eq('particles rejects a non-vector', cast('5\nParticles').error.name, 'Incorrect Iota');
eq('particles rejects a list of non-vectors', cast(L(1, 2) + '\nParticles').error.name, 'Incorrect Iota');
// Faithful to the mod: zipWithNext gives no pairs, so a 1-element list draws nothing.
W.particles = [];
cast("Vector Reflection +X\n1\nFlock's Gambit\nParticles");
eq('one-element list draws nothing (as in Hexal)', W.particles.length, 0);
// A line between two points 2 blocks apart -> floor(2*10)+1 particles.
W.particles = [];
cast("Vector Reflection Zero\n2\nVector Reflection +X\nMultiplicative Distillation\n2\nFlock's Gambit\nParticles");
eq('a 2-block line emits 21 particles', W.particles.length, 21);
W.particles = [];

// Cursor Reflection is invented for this sandbox.
window.App.cursor = { x: 12.25, y: -3.5 };
eq('cursor reflection pushes the cursor, decimals intact',
  show(cast('Cursor Reflection')), ['(12.25, -3.50, 0.00)']);

group('snapshots');
const snap = cast('1\n2\nAdditive Distillation');
eq('one snapshot per top-level pattern', snap.snapshots.length, 3);
eq('snapshot 0 after first push', snap.snapshots[0].stack.length, 1);
eq('snapshot 2 after the add', snap.snapshots[2].stack.length, 1);
eq('resolutions recorded', snap.resolutions.length, 3);

group('interop formats');
{
  // Build App.patterns-shaped entries from resolvable text; startDir is an index.
  const pats = (lines) => lines.map((l) => {
    const r = Registry.resolveText(l);
    return { signature: r.signature, startDir: r.startDir };
  });
  const norm = (list) => list.map((p) => [p.signature, typeof p.startDir === 'number' ? Hex.DIR_NAMES[p.startDir] : p.startDir]);

  const set = ["Mind's Reflection", 'Numerical Reflection: 4', "Bookkeeper's Gambit: v-v",
    'Introspection', 'Consideration', "Jester's Gambit", 'Retrospection'];

  // --- .hexparse
  eq('hexparse intro/retro/name', Formats.writeHexparse(pats(['Introspection', "Mind's Reflection", 'Retrospection'])), '(,get_caster,)');
  eq('hexparse number token', Formats.writeHexparse(pats(['Numerical Reflection: 4'])), 'num_4');
  eq('hexparse mask token', Formats.writeHexparse(pats(["Bookkeeper's Gambit: v-v"])), 'mask_v-v');
  const hpp = Formats.parseHexparse('get_caster, num_4 ; mask_-v- \\ ( get_caster )');
  eq('hexparse parses mixed separators', hpp.patterns.length, 7);
  const hppd = Formats.parseHexparse('get_caster true 5 vec_1_2_3');
  eq('hexparse skips data literals', [hppd.patterns.length, hppd.skipped], [1, 3]);
  eq('hexparse round-trip', norm(Formats.parseHexparse(Formats.writeHexparse(pats(set))).patterns), norm(pats(set)));

  // --- .hexpattern
  eq('hexpattern unknown iota <DIR sig>', norm(Formats.parseHexpattern('<NORTH_WEST aqwed>').patterns), [['aqwed', 'NORTH_WEST']]);
  const hpat = Formats.parseHexpattern("Mind's Reflection\n<-6.9>\n[\n]\n// comment\n/* block */ Retrospection");
  eq('hexpattern comments + skips', [hpat.patterns.length, hpat.skipped], [2, 3]);
  eq('hexpattern round-trip', norm(Formats.parseHexpattern(Formats.writeHexpattern(pats(set))).patterns), norm(pats(set)));

  // --- .hex (Hex Studio elm-serialize)
  const hexStr = Formats.writeHex(pats(set), 'demo');
  eq('hex has V1_ prefix', hexStr.slice(0, 3), 'V1_');
  eq('hex round-trip', norm(Formats.readHex(hexStr).patterns), norm(pats(set)));
  // Byte-exact empty project locks the elm-serialize 1.3.0 layout:
  // version, u32 count=0, ravenmind Nothing (u16 0), 3 empty dicts (u32 0),
  // then projectName string "A" (u32 len 1 + 0x41).
  eq('hex empty-project bytes', Array.from(Formats.b64urlToBytes(Formats.writeHex([], 'A').slice(3))),
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 65]);
  // Layout for one pattern: version[0] count[1..4] sigLen[5..8] active[9] dir[10..11].
  eq('hex direction tags', [
    Array.from(Formats.b64urlToBytes(Formats.writeHex([{ signature: '', startDir: 'NORTH_EAST' }], '').slice(3))).slice(10, 12),
    Array.from(Formats.b64urlToBytes(Formats.writeHex([{ signature: '', startDir: 'SOUTH_WEST' }], '').slice(3))).slice(10, 12),
  ], [[0, 0], [0, 5]]);
}

console.log(`\n${pass} passed, ${fail} failed`);
const html = LOG.join('\n')
  .replace(/[&<>]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))
  .replace(/^(== .*)$/gm, '<span class="grp">$1</span>')
  .replace(/^(  FAIL.*)$/gm, '<span class="bad">$1</span>')
  .replace(/(\d+) passed, (\d+) failed/, (m, p, f) =>
    `<span class="${f === '0' ? 'ok' : 'bad'}">${p} passed, ${f} failed</span>`);
document.getElementById('out').innerHTML = html;
window.__results = { pass, fail, text: LOG.join('\n') };
window.console.log(`RESULT ${pass} passed ${fail} failed`);
})();
