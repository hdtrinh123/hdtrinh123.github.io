// Hex grid math — ported from HexMod v0.11.3
// api/casting/math/{HexDir,HexAngle,HexCoord}.kt and api/utils/HexUtils.kt

// HexDir ordinals are clockwise starting at NORTH_EAST. This order is load-bearing:
// rotation is modular addition on the ordinal, and it's the byte written to NBT.
const DIR_NAMES = ['NORTH_EAST', 'EAST', 'SOUTH_EAST', 'SOUTH_WEST', 'WEST', 'NORTH_WEST'];
const DIR_DELTA = [[1, -1], [1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1]];

// HexAngle: same clockwise convention, so rotate = (dir + angle) % 6
const ANGLE_FROM_CHAR = { w: 0, e: 1, d: 2, s: 3, a: 4, q: 5 };
const CHAR_FROM_ANGLE = ['w', 'e', 'd', 's', 'a', 'q'];
const FORWARD = 0, RIGHT = 1, RIGHT_BACK = 2, BACK = 3, LEFT_BACK = 4, LEFT = 5;

const SQRT_3 = Math.sqrt(3);

function dirIndex(name) {
  const i = DIR_NAMES.indexOf(name);
  return i < 0 ? 1 : i;
}

function rotate(dir, angle) {
  return (((dir + angle) % 6) + 6) % 6;
}

function angleBetween(dir, from) {
  return (((dir - from) % 6) + 6) % 6;
}

function coordKey(q, r) { return q + ',' + r; }

function coordAdd(c, dir) {
  const d = DIR_DELTA[dir];
  return { q: c.q + d[0], r: c.r + d[1] };
}

// Pointy-top axial -> pixel, +y down (Minecraft GUI convention)
function coordToPx(c, size, ox, oy) {
  return {
    x: size * (SQRT_3 * c.q + (SQRT_3 / 2) * c.r) + ox,
    y: size * 1.5 * c.r + oy,
  };
}

// Inverse. HexMod uses this cube-rounding shortcut rather than full cube rounding;
// we replicate it as-is so snapping feels identical.
function pxToCoord(px, py, size, ox, oy) {
  const x = px - ox, y = py - oy;
  let qf = ((SQRT_3 / 3) * x - (1 / 3) * y) / size;
  let rf = ((2 / 3) * y) / size;
  const q = Math.round(qf), r = Math.round(rf);
  qf -= q; rf -= r;
  if (Math.abs(q) >= Math.abs(r)) {
    return { q: q + Math.round(qf + 0.5 * rf), r: r };
  }
  return { q: q, r: r + Math.round(rf + 0.5 * qf) };
}

// A signature of length n describes the turns *between* segments, so it yields
// n+1 segments and n+2 points: the first segment is startDir itself and the last
// is emitted after the loop.
function patternPositions(sig, startDir, start) {
  const out = [];
  let cursor = start ? { q: start.q, r: start.r } : { q: 0, r: 0 };
  let compass = startDir;
  out.push({ q: cursor.q, r: cursor.r });
  for (const ch of sig) {
    const a = ANGLE_FROM_CHAR[ch];
    if (a === undefined) return null;
    cursor = coordAdd(cursor, compass);
    out.push({ q: cursor.q, r: cursor.r });
    compass = rotate(compass, a);
  }
  const last = coordAdd(cursor, compass);
  out.push(last);
  return out;
}

// The absolute direction of each of the n+1 segments.
function patternDirections(sig, startDir) {
  const dirs = [startDir];
  let compass = startDir;
  for (const ch of sig) {
    compass = rotate(compass, ANGLE_FROM_CHAR[ch]);
    dirs.push(compass);
  }
  return dirs;
}

// Turn a drawn sequence of lattice points into (startDir, signature).
function pointsToPattern(points) {
  if (points.length < 2) return null;
  const dirs = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const dq = points[i + 1].q - points[i].q;
    const dr = points[i + 1].r - points[i].r;
    const d = DIR_DELTA.findIndex((v) => v[0] === dq && v[1] === dr);
    if (d < 0) return null;
    dirs.push(d);
  }
  let sig = '';
  for (let i = 1; i < dirs.length; i++) {
    sig += CHAR_FROM_ANGLE[angleBetween(dirs[i], dirs[i - 1])];
  }
  return { startDir: dirs[0], signature: sig };
}

// HexPattern.tryAppendDir. Two restrictions, and only two:
//  - no re-traversing an edge (recorded as both directed half-edges)
//  - no immediate backtracking
// Revisiting a *vertex* is explicitly fine — that's why great-spell scrungling can
// use an Euler path.
function canAppendDir(sig, startDir, newDir) {
  const seen = new Set();
  let compass = startDir;
  let cursor = { q: 0, r: 0 };
  for (const ch of sig) {
    seen.add(coordKey(cursor.q, cursor.r) + '|' + compass);
    const nxt = coordAdd(cursor, compass);
    seen.add(coordKey(nxt.q, nxt.r) + '|' + rotate(compass, BACK));
    cursor = nxt;
    compass = rotate(compass, ANGLE_FROM_CHAR[ch]);
  }
  cursor = coordAdd(cursor, compass);
  if (seen.has(coordKey(cursor.q, cursor.r) + '|' + newDir)) return false;
  if (angleBetween(newDir, compass) === BACK) return false;
  return true;
}

// Validate a whole signature by replaying the same rule.
function isValidPattern(sig, startDir) {
  let acc = '';
  let compass = startDir;
  for (const ch of sig) {
    const a = ANGLE_FROM_CHAR[ch];
    if (a === undefined) return false;
    const newDir = rotate(compass, a);
    if (!canAppendDir(acc, startDir, newDir)) return false;
    acc += ch;
    compass = newDir;
  }
  return true;
}

// The set of edges a pattern occupies, normalised so each edge has one key
// regardless of traversal direction.
function patternEdges(sig, startDir, start) {
  const pts = patternPositions(sig, startDir, start);
  const edges = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1];
    const key = (a.q < b.q || (a.q === b.q && a.r <= b.r))
      ? `${a.q},${a.r}:${b.q},${b.r}`
      : `${b.q},${b.r}:${a.q},${a.r}`;
    edges.push({ a, b, key });
  }
  return edges;
}

function patternBounds(sig, startDir) {
  const pts = patternPositions(sig, startDir);
  let minQ = Infinity, maxQ = -Infinity, minR = Infinity, maxR = -Infinity;
  for (const p of pts) {
    minQ = Math.min(minQ, p.q); maxQ = Math.max(maxQ, p.q);
    minR = Math.min(minR, p.r); maxR = Math.max(maxR, p.r);
  }
  return { minQ, maxQ, minR, maxR, w: maxQ - minQ, h: maxR - minR };
}

window.Hex = {
  DIR_NAMES, DIR_DELTA, ANGLE_FROM_CHAR, CHAR_FROM_ANGLE, SQRT_3,
  FORWARD, RIGHT, RIGHT_BACK, BACK, LEFT_BACK, LEFT,
  dirIndex, rotate, angleBetween, coordKey, coordAdd, coordToPx, pxToCoord,
  patternPositions, patternDirections, pointsToPattern,
  canAppendDir, isValidPattern, patternEdges, patternBounds,
};
