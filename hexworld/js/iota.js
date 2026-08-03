// Iota types — the 9 registered in HexIotaTypes.java.
// All numbers are doubles; equality tolerance 0.0001.

const TOLERANCE = 0.0001;

const Null = () => ({ type: 'null' });
const Num = (v) => ({ type: 'double', value: fixNaN(v) });
const Bool = (v) => ({ type: 'boolean', value: !!v });
const Vec = (x, y, z) => ({ type: 'vec3', x: fixNaN(x), y: fixNaN(y), z: fixNaN(z) });
const List = (v) => ({ type: 'list', value: v });
const Pat = (signature, startDir) => ({ type: 'pattern', signature, startDir });
const Ent = (id) => ({ type: 'entity', id });
const Garbage = (reason) => ({ type: 'garbage', reason: reason || null });
const Cont = (frames) => ({ type: 'continuation', frames });

function fixNaN(v) { return Number.isNaN(v) ? 0 : v; }

function isNum(i) { return i && i.type === 'double'; }
function isVec(i) { return i && i.type === 'vec3'; }
function isList(i) { return i && i.type === 'list'; }
function isPat(i) { return i && i.type === 'pattern'; }

function iotaEquals(a, b) {
  if (!a || !b) return false;
  if (a.type !== b.type) return false;
  switch (a.type) {
    case 'null': return true;
    case 'double': return Math.abs(a.value - b.value) < TOLERANCE;
    case 'boolean': return a.value === b.value;
    case 'vec3': {
      const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
      return dx * dx + dy * dy + dz * dz < TOLERANCE * TOLERANCE;
    }
    case 'entity': return a.id === b.id;
    case 'pattern': return a.signature === b.signature;
    case 'list':
      if (a.value.length !== b.value.length) return false;
      return a.value.every((x, i) => iotaEquals(x, b.value[i]));
    case 'garbage': return true;
    default: return false;
  }
}

// Truthiness: null and garbage are false, 0 is false, empty list is false.
function truthy(i) {
  if (!i) return false;
  switch (i.type) {
    case 'null': case 'garbage': return false;
    case 'double': return i.value !== 0;
    case 'boolean': return i.value;
    case 'list': return i.value.length > 0;
    case 'vec3': return i.x !== 0 || i.y !== 0 || i.z !== 0;
    default: return true;
  }
}

function f2(n) {
  if (!isFinite(n)) return n > 0 ? '∞' : (n < 0 ? '-∞' : 'NaN');
  return n.toFixed(2);
}

// Display forms mirror the mod's toString on each iota class.
function iotaToString(i, world) {
  if (!i) return 'Null';
  switch (i.type) {
    case 'null': return 'Null';
    case 'double': return f2(i.value);
    case 'boolean': return i.value ? 'True' : 'False';
    case 'vec3': return `(${f2(i.x)}, ${f2(i.y)}, ${f2(i.z)})`;
    case 'entity': {
      const e = world && world.getEntity ? world.getEntity(i.id) : null;
      return e ? e.name : 'Entity (gone)';
    }
    case 'pattern': {
      const m = Registry.matchPattern(i.signature, i.startDir);
      if (m.kind === 'unknown') return `HexPattern(${Hex.DIR_NAMES[i.startDir]} ${i.signature})`;
      return m.name;
    }
    case 'garbage': return i.reason ? `Garbage (${i.reason})` : 'arimfexendrapuse';
    case 'continuation': return '[Jump]';
    case 'list': {
      const inner = i.value.map((x) => iotaToString(x, world)).join(', ');
      return `[${inner}]`;
    }
    default: return '?';
  }
}

// Panel colours, keyed by type (Hex Studio's scheme).
const TYPE_COLOR = {
  null: '#354C3F',
  list: '#354C3F',
  pattern: '#354C3F',
  double: '#4C3541',
  vec3: '#4C3541',
  boolean: '#4B4C35',
  entity: '#354B4C',
  garbage: '#4F3737',
  continuation: '#4B4845',
};

function typeName(i) {
  if (!i) return 'null';
  switch (i.type) {
    case 'double': return 'Number';
    case 'vec3': return 'Vector';
    case 'boolean': return 'Boolean';
    case 'list': return 'List';
    case 'pattern': return 'Pattern';
    case 'entity': return 'Entity';
    case 'garbage': return 'Garbage';
    case 'continuation': return 'Jump';
    default: return 'Null';
  }
}

function cloneIota(i) {
  if (!i) return Null();
  if (i.type === 'list') return List(i.value.map(cloneIota));
  return { ...i };
}

window.Iota = {
  TOLERANCE, TYPE_COLOR,
  Null, Num, Bool, Vec, List, Pat, Ent, Garbage, Cont,
  isNum, isVec, isList, isPat,
  iotaEquals, truthy, iotaToString, typeName, cloneIota, f2,
};
