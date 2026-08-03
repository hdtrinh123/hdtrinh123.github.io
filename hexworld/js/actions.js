// Action implementations. Each is `(vm, def) => resolutionString`.
// Registered into VMLib.ACTIONS by internal id.

(function () {
  const { ACTIONS, Mishaps } = VMLib;
  const I = Iota;
  const B = WorldLib.B;
  const BLOCKS = WorldLib.BLOCKS;

  // --- argument helpers ----------------------------------------------------
  // Args come back bottom-first; mishap indices are depth-from-top.
  function args(vm, n) {
    const a = vm.popArgs(n);
    const depth = (i) => n - 1 - i;
    return {
      raw: a,
      at: (i) => a[i],
      num: (i) => {
        if (!I.isNum(a[i])) throw Mishaps.invalidIota(depth(i), 'a number', a[i]);
        return a[i].value;
      },
      int: (i) => {
        if (!I.isNum(a[i])) throw Mishaps.invalidIota(depth(i), 'a number', a[i]);
        return Math.round(a[i].value);
      },
      vec: (i) => {
        if (!I.isVec(a[i])) throw Mishaps.invalidIota(depth(i), 'a vector', a[i]);
        return a[i];
      },
      list: (i) => {
        if (!I.isList(a[i])) throw Mishaps.invalidIota(depth(i), 'a list', a[i]);
        return a[i].value;
      },
      bool: (i) => {
        if (a[i].type !== 'boolean') throw Mishaps.invalidIota(depth(i), 'a boolean', a[i]);
        return a[i].value;
      },
      pattern: (i) => {
        if (!I.isPat(a[i])) throw Mishaps.invalidIota(depth(i), 'a pattern', a[i]);
        return a[i];
      },
      entity: (i) => {
        if (a[i].type !== 'entity') throw Mishaps.invalidIota(depth(i), 'an entity', a[i]);
        const e = vm.ctx.world.getEntity(a[i].id);
        if (!e) throw Mishaps.badEntity();
        return e;
      },
      numOrVec: (i) => {
        if (I.isNum(a[i]) || I.isVec(a[i])) return a[i];
        throw Mishaps.invalidIota(depth(i), 'a number or vector', a[i]);
      },
      // Integer in 0..max inclusive. Out of range mishaps rather than clamping.
      intUnder: (i, max) => {
        if (!I.isNum(a[i])) throw Mishaps.invalidIota(depth(i), 'a number', a[i]);
        const v = a[i].value, r = Math.round(v);
        if (Math.abs(v - r) > I.TOLERANCE || r < 0 || r > max) {
          throw Mishaps.invalidIota(depth(i), `an integer from 0 to ${max}`, a[i]);
        }
        return r;
      },
    };
  }

  // Shared coercion helper matching ActionUtils.getIntBetween.
  function intBetween(iota, min, max, depth) {
    if (!I.isNum(iota)) throw Mishaps.invalidIota(depth, 'a number', iota);
    const v = iota.value, r = Math.round(v);
    if (Math.abs(v - r) > I.TOLERANCE || r < min || r > max) {
      throw Mishaps.invalidIota(depth, `an integer from ${min} to ${max}`, iota);
    }
    return r;
  }

  // Register a simple action: pops argc, pushes whatever is returned.
  function A(id, argc, fn) {
    ACTIONS[id] = (vm) => {
      const a = args(vm, argc);
      const out = fn(vm, a);
      if (out === undefined || out === null) return 'EVALUATED';
      if (Array.isArray(out)) out.forEach((i) => vm.push(i));
      else vm.push(out);
      return 'EVALUATED';
    };
  }

  // Raw action: full control over the stack and continuation.
  function R(id, fn) { ACTIONS[id] = fn; }

  // Preview runs evaluate against a scratch clone of the world, so editing the
  // pattern list never mutates the real one. Casting points these at the real
  // world instead.
  const world = () => window.App.evalWorld;
  const caster = () => window.App.evalWorld.caster;

  // ====== basics / getters =================================================
  A('get_caster', 0, () => I.Ent(caster().id));
  A('entity_pos/eye', 1, (vm, a) => { const e = a.entity(0); return I.Vec(e.x, e.y + e.h * 0.9, 0); });
  A('entity_pos/foot', 1, (vm, a) => { const e = a.entity(0); return I.Vec(e.x, e.y, 0); });
  A('get_entity_look', 1, (vm, a) => { const e = a.entity(0); return I.Vec(e.look.x, e.look.y, 0); });
  A('get_entity_height', 1, (vm, a) => I.Num(a.entity(0).h * a.entity(0).scale));
  A('get_entity_velocity', 1, (vm, a) => { const e = a.entity(0); return I.Vec(e.vx, e.vy, 0); });

  A('raycast', 2, (vm, a) => {
    const o = a.vec(0), d = a.vec(1);
    const hit = world().raycast(o.x, o.y, d.x, d.y, 48);
    return hit ? I.Vec(hit.x + 0.5, hit.y + 0.5, 0) : I.Null();
  });
  A('raycast/axis', 2, (vm, a) => {
    const o = a.vec(0), d = a.vec(1);
    const hit = world().raycast(o.x, o.y, d.x, d.y, 48);
    return hit ? I.Vec(hit.nx, hit.ny, 0) : I.Null();
  });
  A('raycast/entity', 2, (vm, a) => {
    const o = a.vec(0), d = a.vec(1);
    const e = world().raycastEntity(o.x, o.y, d.x, d.y, 48);
    return e ? I.Ent(e.id) : I.Null();
  });

  // ====== stack manipulation ==============================================
  A('swap', 2, (vm, a) => [a.at(1), a.at(0)]);
  A('rotate', 3, (vm, a) => [a.at(1), a.at(2), a.at(0)]);
  A('rotate_reverse', 3, (vm, a) => [a.at(2), a.at(0), a.at(1)]);
  A('duplicate', 1, (vm, a) => [a.at(0), I.cloneIota(a.at(0))]);
  A('over', 2, (vm, a) => [a.at(0), a.at(1), I.cloneIota(a.at(0))]);
  A('tuck', 2, (vm, a) => [I.cloneIota(a.at(1)), a.at(0), a.at(1)]);
  A('2dup', 2, (vm, a) => [a.at(0), a.at(1), I.cloneIota(a.at(0)), I.cloneIota(a.at(1))]);
  A('stack_len', 0, (vm) => I.Num(vm.image.stack.length));

  A('duplicate_n', 2, (vm, a) => {
    const n = a.int(1);
    if (n < 0) throw Mishaps.invalidIota(0, 'a non-negative number', a.at(1));
    const out = [];
    for (let i = 0; i < n; i++) out.push(I.cloneIota(a.at(0)));
    return out;
  });

  // Fisherman's Gambit: move the iota n-deep to the top. Negative n pushes the
  // top iota down instead. Depth bounds are checked against the stack *after*
  // the number itself is popped.
  R('fisherman', (vm) => {
    const s = vm.image.stack;
    if (s.length < 2) throw Mishaps.notEnoughArgs(2, s.length);
    const arg = s[s.length - 1];
    s.pop();
    const maxIdx = s.length - 1;
    const depth = intBetween(arg, -maxIdx, maxIdx, 0);
    if (depth >= 0) {
      const [fish] = s.splice(s.length - 1 - depth, 1);
      s.push(fish);
    } else {
      const lure = s.pop();
      s.splice(s.length + depth, 0, lure);
    }
    return 'EVALUATED';
  });

  // Same, but copies instead of moving. Note the bounds are computed before the
  // pop, so the legal range is one tighter than Fisherman's Gambit's.
  R('fisherman/copy', (vm) => {
    const s = vm.image.stack;
    if (s.length < 2) throw Mishaps.notEnoughArgs(2, s.length);
    const arg = s[s.length - 1];
    const bound = s.length - 2;
    const depth = intBetween(arg, -bound, bound, 0);
    s.pop();
    if (depth >= 0) {
      s.push(I.cloneIota(s[s.length - 1 - depth]));
    } else {
      const lure = s[s.length - 1];
      s.splice(s.length - 1 + depth, 0, I.cloneIota(lure));
    }
    return 'EVALUATED';
  });

  // Swindler's Gambit: the number is a Lehmer code in the factorial number
  // system. The stride sequence is 1, 1, 2, 6, 24, ... (note the doubled leading
  // 1) and its length decides how many iotas get grabbed, so no explicit count
  // is needed. Factorial-base decoding makes duplicate indices impossible.
  R('swizzle', (vm) => {
    const s = vm.image.stack;
    if (!s.length) throw Mishaps.notEnoughArgs(1, 0);
    const arg = s[s.length - 1];
    if (!I.isNum(arg)) throw Mishaps.invalidIota(0, 'a number', arg);
    const code = Math.round(arg.value);
    if (Math.abs(arg.value - code) > I.TOLERANCE || code < 0) {
      throw Mishaps.invalidIota(0, 'a positive integer', arg);
    }
    s.pop();

    const strides = [];
    let acc = 1, n = 1;
    while (acc <= code) { strides.push(acc); acc *= n; n++; }

    const k = strides.length;
    if (k > s.length) throw Mishaps.notEnoughArgs(k + 1, s.length + 1);

    const editStart = s.length - k;
    const swap = s.slice(editStart);   // bottom-to-top; index 0 is the deepest
    let radix = code, w = editStart;
    for (let i = strides.length - 1; i >= 0; i--) {
      const divisor = strides[i];
      const index = Math.floor(radix / divisor);
      radix = radix % divisor;
      s[w++] = swap.splice(index, 1)[0];
    }
    return 'EVALUATED';
  });

  // ====== math =============================================================
  const isV = I.isVec, isN = I.isNum;

  A('add', 2, (vm, a) => {
    const x = a.at(0), y = a.at(1);
    if (isN(x) && isN(y)) return I.Num(x.value + y.value);
    if (isV(x) && isV(y)) return I.Vec(x.x + y.x, x.y + y.y, x.z + y.z);
    if (isV(x) && isN(y)) return I.Vec(x.x + y.value, x.y + y.value, x.z + y.value);
    if (isN(x) && isV(y)) return I.Vec(x.value + y.x, x.value + y.y, x.value + y.z);
    if (I.isList(x)) return I.List(x.value.concat(I.isList(y) ? y.value : [y]));
    throw Mishaps.invalidIota(1, 'numbers, vectors, or a list', x);
  });

  A('sub', 2, (vm, a) => {
    const x = a.at(0), y = a.at(1);
    if (isN(x) && isN(y)) return I.Num(x.value - y.value);
    if (isV(x) && isV(y)) return I.Vec(x.x - y.x, x.y - y.y, x.z - y.z);
    if (isV(x) && isN(y)) return I.Vec(x.x - y.value, x.y - y.value, x.z - y.value);
    if (isN(x) && isV(y)) return I.Vec(x.value - y.x, x.value - y.y, x.value - y.z);
    throw Mishaps.invalidIota(1, 'numbers or vectors', x);
  });

  A('mul', 2, (vm, a) => {
    const x = a.at(0), y = a.at(1);
    if (isN(x) && isN(y)) return I.Num(x.value * y.value);
    if (isV(x) && isV(y)) return I.Num(x.x * y.x + x.y * y.y + x.z * y.z); // dot
    if (isV(x) && isN(y)) return I.Vec(x.x * y.value, x.y * y.value, x.z * y.value);
    if (isN(x) && isV(y)) return I.Vec(y.x * x.value, y.y * x.value, y.z * x.value);
    throw Mishaps.invalidIota(1, 'numbers or vectors', x);
  });

  A('div', 2, (vm, a) => {
    const x = a.at(0), y = a.at(1);
    if (isN(x) && isN(y)) {
      if (y.value === 0) throw Mishaps.divideByZero();
      return I.Num(x.value / y.value);
    }
    if (isV(x) && isV(y)) { // cross product
      return I.Vec(
        x.y * y.z - x.z * y.y,
        x.z * y.x - x.x * y.z,
        x.x * y.y - x.y * y.x
      );
    }
    if (isV(x) && isN(y)) {
      if (y.value === 0) throw Mishaps.divideByZero();
      return I.Vec(x.x / y.value, x.y / y.value, x.z / y.value);
    }
    if (isN(x) && isV(y)) {
      if (y.x === 0 || y.y === 0 || y.z === 0) throw Mishaps.divideByZero();
      return I.Vec(x.value / y.x, x.value / y.y, x.value / y.z);
    }
    throw Mishaps.invalidIota(1, 'numbers or vectors', x);
  });

  A('abs', 1, (vm, a) => {
    const x = a.at(0);
    if (isN(x)) return I.Num(Math.abs(x.value));
    if (isV(x)) return I.Num(Math.hypot(x.x, x.y, x.z));
    if (I.isList(x)) return I.Num(x.value.length);
    throw Mishaps.invalidIota(0, 'a number, vector, or list', x);
  });

  // Negative base with a fractional exponent is the only error case; 0^0 is
  // allowed and yields 1.
  function powScalar(b, e) {
    if (b < 0 && Math.abs(Math.floor(e) - e) > I.TOLERANCE) throw Mishaps.divideByZero();
    return Math.pow(b, e);
  }
  A('pow', 2, (vm, a) => {
    const x = a.at(0), y = a.at(1);
    if (isN(x) && isN(y)) return I.Num(powScalar(x.value, y.value));
    if (isV(x) && isV(y)) {
      // Projection of x onto y. Normalising the zero vector yields zero rather
      // than mishapping, so projecting onto it is silently (0,0,0).
      const len = Math.hypot(y.x, y.y, y.z);
      if (len === 0) return I.Vec(0, 0, 0);
      const nx = y.x / len, ny = y.y / len, nz = y.z / len;
      const k = x.x * nx + x.y * ny + x.z * nz;
      return I.Vec(nx * k, ny * k, nz * k);
    }
    if (isV(x) && isN(y)) return I.Vec(powScalar(x.x, y.value), powScalar(x.y, y.value), powScalar(x.z, y.value));
    if (isN(x) && isV(y)) return I.Vec(powScalar(x.value, y.x), powScalar(x.value, y.y), powScalar(x.value, y.z));
    throw Mishaps.invalidIota(1, 'numbers or vectors', x);
  });

  const unaryNV = (id, fn) => A(id, 1, (vm, a) => {
    const x = a.at(0);
    if (isN(x)) return I.Num(fn(x.value));
    if (isV(x)) return I.Vec(fn(x.x), fn(x.y), fn(x.z));
    throw Mishaps.invalidIota(0, 'a number or vector', x);
  });
  unaryNV('floor', Math.floor);
  unaryNV('ceil', Math.ceil);

  A('construct_vec', 3, (vm, a) => I.Vec(a.num(0), a.num(1), a.num(2)));
  A('deconstruct_vec', 1, (vm, a) => { const v = a.vec(0); return [I.Num(v.x), I.Num(v.y), I.Num(v.z)]; });

  A('coerce_axial', 1, (vm, a) => {
    const x = a.at(0);
    if (isN(x)) return I.Num(Math.sign(x.value));
    if (isV(x)) {
      const ax = Math.abs(x.x), ay = Math.abs(x.y), az = Math.abs(x.z);
      if (ax === 0 && ay === 0 && az === 0) return I.Vec(0, 0, 0);
      if (ax >= ay && ax >= az) return I.Vec(Math.sign(x.x), 0, 0);
      if (ay >= az) return I.Vec(0, Math.sign(x.y), 0);
      return I.Vec(0, 0, Math.sign(x.z));
    }
    throw Mishaps.invalidIota(0, 'a number or vector', x);
  });

  // Elementwise on vectors, with a scalar arg triplicated to (s,s,s).
  // Sign follows the dividend, as in Kotlin's rem.
  A('modulo', 2, (vm, a) => {
    const x = a.at(0), y = a.at(1);
    const m = (p, q) => { if (q === 0) throw Mishaps.divideByZero(); return p % q; };
    if (isN(x) && isN(y)) return I.Num(m(x.value, y.value));
    const tri = (i) => (isV(i) ? [i.x, i.y, i.z] : [i.value, i.value, i.value]);
    if ((isV(x) || isN(x)) && (isV(y) || isN(y))) {
      const p = tri(x), q = tri(y);
      return I.Vec(m(p[0], q[0]), m(p[1], q[1]), m(p[2], q[2]));
    }
    throw Mishaps.invalidIota(1, 'numbers or vectors', x);
  });

  A('logarithm', 2, (vm, a) => {
    const x = a.num(0), b = a.num(1);
    if (x <= 0 || b <= 0 || b === 1) throw Mishaps.divideByZero();
    return I.Num(Math.log(x) / Math.log(b));
  });

  A('random', 0, (vm) => I.Num(vm.ctx.rng()));

  const trig = (id, fn) => A(id, 1, (vm, a) => I.Num(fn(a.num(0))));
  trig('sin', Math.sin);
  trig('cos', Math.cos);
  trig('tan', Math.tan);
  trig('arcsin', Math.asin);
  trig('arccos', Math.acos);
  trig('arctan', Math.atan);
  A('arctan2', 2, (vm, a) => I.Num(Math.atan2(a.num(0), a.num(1))));

  // ====== logic ============================================================
  function logic(id, boolFn, bitFn, listFn) {
    A(id, 2, (vm, a) => {
      const x = a.at(0), y = a.at(1);
      if (x.type === 'boolean' && y.type === 'boolean') return I.Bool(boolFn(x.value, y.value));
      if (isN(x) && isN(y)) return I.Num(bitFn(Math.round(x.value), Math.round(y.value)));
      if (I.isList(x) && I.isList(y)) return I.List(listFn(x.value, y.value));
      // mixed types fall back to truthiness
      return I.Bool(boolFn(I.truthy(x), I.truthy(y)));
    });
  }
  const has = (l, i) => l.some((x) => I.iotaEquals(x, i));
  logic('and', (p, q) => p && q, (p, q) => p & q, (l, r) => l.filter((x) => has(r, x)));
  logic('or', (p, q) => p || q, (p, q) => p | q,
    (l, r) => l.concat(r.filter((x) => !has(l, x))));
  logic('xor', (p, q) => p !== q, (p, q) => p ^ q,
    (l, r) => l.filter((x) => !has(r, x)).concat(r.filter((x) => !has(l, x))));

  A('not', 1, (vm, a) => {
    const x = a.at(0);
    if (isN(x)) return I.Num(~Math.round(x.value));
    return I.Bool(!I.truthy(x));
  });

  A('greater', 2, (vm, a) => I.Bool(a.num(0) > a.num(1)));
  A('less', 2, (vm, a) => I.Bool(a.num(0) < a.num(1)));
  A('greater_eq', 2, (vm, a) => I.Bool(a.num(0) >= a.num(1)));
  A('less_eq', 2, (vm, a) => I.Bool(a.num(0) <= a.num(1)));
  A('equals', 2, (vm, a) => I.Bool(I.iotaEquals(a.at(0), a.at(1))));
  A('not_equals', 2, (vm, a) => I.Bool(!I.iotaEquals(a.at(0), a.at(1))));
  A('bool_coerce', 1, (vm, a) => I.Bool(I.truthy(a.at(0))));
  A('if', 3, (vm, a) => (a.bool(0) ? a.at(1) : a.at(2)));

  A('unique', 1, (vm, a) => {
    const l = a.list(0);
    const out = [];
    for (const x of l) if (!has(out, x)) out.push(x);
    return I.List(out);
  });

  // ====== lists ============================================================
  A('append', 2, (vm, a) => I.List(a.list(0).concat([a.at(1)])));
  A('unappend', 1, (vm, a) => {
    const l = a.list(0);
    if (!l.length) throw Mishaps.notEnoughArgs(1, 0);
    return [I.List(l.slice(0, -1)), l[l.length - 1]];
  });
  A('index', 2, (vm, a) => {
    const l = a.list(0), i = a.int(1);
    return (i < 0 || i >= l.length) ? I.Null() : l[i];
  });
  A('singleton', 1, (vm, a) => I.List([a.at(0)]));
  A('empty_list', 0, () => I.List([]));
  A('reverse', 1, (vm, a) => I.List(a.list(0).slice().reverse()));

  R('last_n_list', (vm) => {
    const a = args(vm, 1);
    const n = a.int(0);
    if (n < 0) throw Mishaps.invalidIota(0, 'a non-negative number', I.Num(n));
    const s = vm.image.stack;
    if (s.length < n) throw Mishaps.notEnoughArgs(n, s.length);
    const taken = s.splice(s.length - n, n);
    s.push(I.List(taken));
    return 'EVALUATED';
  });

  R('splat', (vm) => {
    const a = args(vm, 1);
    const l = a.list(0);
    for (const x of l) vm.push(x);
    return 'EVALUATED';
  });

  A('index_of', 2, (vm, a) => {
    const l = a.list(0), target = a.at(1);
    const i = l.findIndex((x) => I.iotaEquals(x, target));
    return I.Num(i);
  });
  A('remove_from', 2, (vm, a) => {
    const l = a.list(0).slice(), i = a.int(1);
    if (i >= 0 && i < l.length) l.splice(i, 1);
    return I.List(l);
  });
  // Indices are 0..length inclusive and are NOT clamped — out of range mishaps.
  // The pair is normalised by min/max, so a reversed pair is fine, and equal
  // indices give an empty list.
  A('slice', 3, (vm, a) => {
    const l = a.list(0);
    const i0 = a.intUnder(1, l.length);
    const i1 = a.intUnder(2, l.length);
    if (i0 === i1) return I.List([]);
    return I.List(l.slice(Math.min(i0, i1), Math.max(i0, i1)));
  });
  A('replace', 3, (vm, a) => {
    const l = a.list(0).slice(), i = a.int(1), v = a.at(2);
    if (i >= 0 && i < l.length) l[i] = v;
    return I.List(l);
  });
  A('construct', 2, (vm, a) => I.List([a.at(1)].concat(a.list(0))));
  A('deconstruct', 1, (vm, a) => {
    const l = a.list(0);
    if (!l.length) throw Mishaps.notEnoughArgs(1, 0);
    return [I.List(l.slice(1)), l[0]];
  });

  // ====== entities =========================================================
  function entityFilter(kind) {
    return (e) => {
      switch (kind) {
        case 'animal': return e.kind === 'animal';
        case 'monster': return e.kind === 'monster';
        case 'item': return e.kind === 'item';
        case 'player': return e.kind === 'caster';
        case 'living': return e.kind !== 'item';
        case 'not_animal': return e.kind !== 'animal';
        case 'not_monster': return e.kind !== 'monster';
        case 'not_item': return e.kind !== 'item';
        case 'not_player': return e.kind !== 'caster';
        case 'not_living': return e.kind === 'item';
        default: return true;
      }
    };
  }

  const getEntityIds = ['', 'animal', 'monster', 'item', 'player', 'living'];
  for (const k of getEntityIds) {
    const id = k ? `get_entity/${k}` : 'get_entity';
    A(id, 1, (vm, a) => {
      const v = a.vec(0);
      const e = world().entityAt(v.x, v.y);
      if (e && entityFilter(k)(e)) return I.Ent(e.id);
      return I.Null();
    });
  }

  const zoneIds = ['', 'animal', 'not_animal', 'monster', 'not_monster', 'item',
    'not_item', 'player', 'not_player', 'living', 'not_living'];
  for (const k of zoneIds) {
    const id = k ? `zone_entity/${k}` : 'zone_entity';
    A(id, 2, (vm, a) => {
      const v = a.vec(0), r = a.num(1);
      const es = world().entitiesNear(v.x, v.y, r).filter(entityFilter(k));
      return I.List(es.map((e) => I.Ent(e.id)));
    });
  }

  // ====== read / write =====================================================
  // "The other hand" is the caster's attuned focus slot.
  A('read', 0, () => I.cloneIota(caster().focus || I.Null()));
  A('write', 1, (vm, a) => { caster().focus = I.cloneIota(a.at(0)); return null; });
  A('readable', 0, () => I.Bool(true));
  A('writable', 0, () => I.Bool(true));
  A('read/entity', 1, (vm, a) => { const e = a.entity(0); return I.cloneIota(e.focus || I.Null()); });
  A('write/entity', 2, (vm, a) => { const e = a.entity(0); e.focus = I.cloneIota(a.at(1)); return null; });
  A('readable/entity', 1, (vm, a) => { a.entity(0); return I.Bool(true); });
  A('writable/entity', 1, (vm, a) => { a.entity(0); return I.Bool(true); });

  // Ravenmind: lives outside the stack, so it survives Thoth iterations.
  A('read/local', 0, (vm) => I.cloneIota(vm.image.ravenmind || I.Null()));
  R('write/local', (vm) => {
    const a = args(vm, 1);
    const v = a.at(0);
    vm.image.ravenmind = v.type === 'null' ? null : I.cloneIota(v);
    return 'EVALUATED';
  });

  // Akashic libraries: a map from position -> { signature -> iota }.
  A('akashic/read', 2, (vm, a) => {
    const v = a.vec(0), p = a.pattern(1);
    const lib = window.App.evalLibraries[`${Math.floor(v.x)},${Math.floor(v.y)}`];
    if (!lib) throw Mishaps.badLocation('No akashic record there.');
    return I.cloneIota(lib[p.signature] || I.Null());
  });
  A('akashic/write', 3, (vm, a) => {
    const v = a.vec(0), p = a.pattern(1), val = a.at(2);
    const key = `${Math.floor(v.x)},${Math.floor(v.y)}`;
    if (!window.App.evalLibraries[key]) window.App.evalLibraries[key] = {};
    window.App.evalLibraries[key][p.signature] = I.cloneIota(val);
    return null;
  });

  // ====== meta =============================================================
  function evaluatable(iota) {
    if (I.isList(iota)) return iota.value;
    if (I.isPat(iota)) return [iota];
    return null;
  }

  R('eval', (vm) => {
    const a = args(vm, 1);
    const code = evaluatable(a.at(0));
    if (!code) throw Mishaps.invalidIota(0, 'a pattern or list of patterns', a.at(0));
    // Install a break boundary so Charon has somewhere to stop.
    const top = vm.cont[vm.cont.length - 1];
    if (!(I.isPat(a.at(0)) || (top && top.t === 'finish'))) {
      vm.cont.push(VMLib.Frame.finish());
    }
    vm.cont.push(VMLib.Frame.evaluate(code, 0, false));
    return 'EVALUATED';
  });

  R('eval/cc', (vm) => {
    const a = args(vm, 1);
    const code = evaluatable(a.at(0));
    if (!code) throw Mishaps.invalidIota(0, 'a pattern or list of patterns', a.at(0));
    // Capture the continuation as a Jump iota before descending.
    vm.push(I.Cont(vm.cont.slice()));
    vm.cont.push(VMLib.Frame.finish());
    vm.cont.push(VMLib.Frame.evaluate(code, 0, false));
    return 'EVALUATED';
  });

  R('for_each', (vm) => {
    const a = args(vm, 2);
    const code = a.list(0);
    const data = a.list(1);
    vm.cont.push(VMLib.Frame.forEach(data, 0, code, null, []));
    return 'EVALUATED';
  });

  R('halt', (vm) => { vm.halt(); return 'EVALUATED'; });

  A('thanatos', 0, (vm) => I.Num(Math.max(0, 200000 - vm.image.opsConsumed)));

  // ====== constants ========================================================
  A('const/null', 0, () => I.Null());
  A('const/true', 0, () => I.Bool(true));
  A('const/false', 0, () => I.Bool(false));
  A('const/vec/px', 0, () => I.Vec(1, 0, 0));
  A('const/vec/py', 0, () => I.Vec(0, 1, 0));
  A('const/vec/pz', 0, () => I.Vec(0, 0, 1));
  A('const/vec/nx', 0, () => I.Vec(-1, 0, 0));
  A('const/vec/ny', 0, () => I.Vec(0, -1, 0));
  A('const/vec/nz', 0, () => I.Vec(0, 0, -1));
  A('const/vec/0', 0, () => I.Vec(0, 0, 0));
  A('const/double/pi', 0, () => I.Num(Math.PI));
  A('const/double/tau', 0, () => I.Num(Math.PI * 2));
  A('const/double/e', 0, () => I.Num(Math.E));

  // ====== spells ===========================================================
  A('print', 1, (vm, a) => {
    vm.ctx.log(I.iotaToString(a.at(0), world()), 'reveal');
    return a.at(0);
  });

  A('beep', 3, (vm, a) => {
    const v = a.vec(0), note = a.num(1), instrument = a.num(2);
    world().addEffect('note', v.x, v.y, '#a8d8ff');
    vm.ctx.log(`♪ note ${Math.round(note)} (instrument ${Math.round(instrument)})`, 'spell');
    return null;
  });

  A('explode', 2, (vm, a) => { const v = a.vec(0); world().explode(v.x, v.y, a.num(1), false); return null; });
  A('explode/fire', 2, (vm, a) => { const v = a.vec(0); world().explode(v.x, v.y, a.num(1), true); return null; });

  A('add_motion', 2, (vm, a) => {
    const e = a.entity(0), v = a.vec(1);
    e.vx += v.x; e.vy += v.y;
    return null;
  });

  A('blink', 2, (vm, a) => {
    const e = a.entity(0), dist = a.num(1);
    const w = world();
    let steps = Math.abs(Math.round(dist));
    const dir = Math.sign(dist) || 1;
    for (let i = 0; i < steps; i++) {
      const nx = e.x + e.look.x * dir, ny = e.y + e.look.y * dir;
      if (w.isSolid(nx, ny) || w.isSolid(nx, ny + e.h - 0.01)) break;
      e.x = nx; e.y = ny;
    }
    w.addEffect('blink', e.x, e.y + e.h / 2, '#c3a6e8');
    return null;
  });

  // Succeeds whether or not there is anything to break — empty space and
  // unbreakable blocks are simply a no-op rather than a mishap.
  A('break_block', 1, (vm, a) => {
    const v = a.vec(0);
    world().breakBlock(v.x, v.y);
    return null;
  });

  A('place_block', 1, (vm, a) => {
    const v = a.vec(0);
    const id = window.App.placeBlockId;
    if (!world().placeBlock(v.x, v.y, id)) throw Mishaps.badLocation('That space is occupied.');
    return null;
  });

  A('conjure_block', 1, (vm, a) => {
    const v = a.vec(0);
    if (!world().placeBlock(v.x, v.y, B.CONJURED)) throw Mishaps.badLocation('That space is occupied.');
    return null;
  });
  A('conjure_light', 1, (vm, a) => {
    const v = a.vec(0);
    if (!world().placeBlock(v.x, v.y, B.LIGHT)) throw Mishaps.badLocation('That space is occupied.');
    return null;
  });

  A('create_water', 1, (vm, a) => {
    const v = a.vec(0);
    if (!world().placeBlock(v.x, v.y, B.WATER)) throw Mishaps.badLocation('That space is occupied.');
    return null;
  });
  A('create_lava', 1, (vm, a) => {
    const v = a.vec(0);
    if (!world().placeBlock(v.x, v.y, B.LAVA)) throw Mishaps.badLocation('That space is occupied.');
    return null;
  });

  A('destroy_water', 1, (vm, a) => {
    const v = a.vec(0);
    const w = world();
    const r = 4;
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.hypot(dx, dy) > r) continue;
        const id = w.get(v.x + dx, v.y + dy);
        if (id === B.WATER || id === B.LAVA) w.set(Math.floor(v.x) + dx, Math.floor(v.y) + dy, B.AIR);
      }
    }
    return null;
  });

  A('ignite', 1, (vm, a) => {
    const x = a.at(0);
    const w = world();
    if (x.type === 'entity') {
      const e = a.entity(0);
      e.hp -= 2;
      w.addEffect('fire', e.x, e.y + e.h / 2, '#ff8a2b');
      return null;
    }
    const v = a.vec(0);
    if (!w.placeBlock(v.x, v.y, B.FIRE)) throw Mishaps.badLocation('Nothing to ignite.');
    return null;
  });

  A('extinguish', 1, (vm, a) => {
    const v = a.vec(0);
    const w = world();
    const r = 5;
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (w.get(v.x + dx, v.y + dy) === B.FIRE) w.set(Math.floor(v.x) + dx, Math.floor(v.y) + dy, B.AIR);
      }
    }
    return null;
  });

  A('bonemeal', 1, (vm, a) => {
    const v = a.vec(0);
    const w = world();
    const id = w.get(v.x, v.y);
    if (id === B.SAPLING) { w.set(v.x, v.y, B.AIR); w.growTree(Math.floor(v.x), Math.floor(v.y)); return null; }
    if (id === B.GRASS) {
      for (let dx = -3; dx <= 3; dx++) {
        const tx = Math.floor(v.x) + dx;
        if (w.get(tx, Math.floor(v.y)) === B.GRASS && w.isAir(tx, Math.floor(v.y) + 1) && vm.ctx.rng() < 0.7) {
          w.set(tx, Math.floor(v.y) + 1, B.TUFT);
        }
      }
      return null;
    }
    throw Mishaps.badLocation('Nothing there will grow.');
  });

  A('edify', 1, (vm, a) => {
    const v = a.vec(0);
    const w = world();
    if (w.get(v.x, v.y) !== B.SAPLING && !w.isAir(v.x, v.y)) throw Mishaps.badLocation('Not a sapling.');
    w.set(v.x, v.y, B.AIR);
    w.growTree(Math.floor(v.x), Math.floor(v.y));
    return null;
  });

  // Sentinel — a marker entity, one per caster.
  A('sentinel/create', 1, (vm, a) => {
    const v = a.vec(0);
    const w = world();
    if (w.sentinel) w.removeEntity(w.sentinel.id);
    w.sentinel = w.spawn({ name: 'Sentinel', kind: 'sentinel', x: v.x, y: v.y, w: 0.6, h: 0.6, flying: true, hp: 1e9 });
    return null;
  });
  A('sentinel/create/great', 1, (vm, a) => {
    const v = a.vec(0);
    const w = world();
    if (w.sentinel) w.removeEntity(w.sentinel.id);
    w.sentinel = w.spawn({ name: 'Greater Sentinel', kind: 'sentinel', x: v.x, y: v.y, w: 0.8, h: 0.8, flying: true, hp: 1e9 });
    return null;
  });
  A('sentinel/destroy', 0, () => {
    const w = world();
    if (w.sentinel) { w.removeEntity(w.sentinel.id); w.sentinel = null; }
    return null;
  });
  A('sentinel/get_pos', 0, () => {
    const w = world();
    return w.sentinel ? I.Vec(w.sentinel.x, w.sentinel.y, 0) : I.Null();
  });
  A('sentinel/wayfind', 1, (vm, a) => {
    const v = a.vec(0);
    const w = world();
    if (!w.sentinel) return I.Null();
    const dx = w.sentinel.x - v.x, dy = w.sentinel.y - v.y;
    const d = Math.hypot(dx, dy) || 1;
    return I.Vec(dx / d, dy / d, 0);
  });

  A('flight/range', 2, (vm, a) => { const e = a.entity(0); e.flightTicks = Math.max(e.flightTicks, a.num(1) * 20); return null; });
  A('flight/time', 2, (vm, a) => { const e = a.entity(0); e.flightTicks = Math.max(e.flightTicks, a.num(1) * 20); return null; });
  A('flight', 1, (vm, a) => { const e = a.entity(0); e.flightTicks = Math.max(e.flightTicks, 20 * 60 * 8); return null; });
  A('flight/can_fly', 1, (vm, a) => { const e = a.entity(0); return I.Bool(e.flying || e.flightTicks > 0); });

  A('lightning', 1, (vm, a) => {
    const v = a.vec(0);
    const w = world();
    const x = Math.floor(v.x);
    for (let y = w.h - 1; y >= 0; y--) {
      if (w.isSolid(x, y)) {
        w.addEffect('lightning', x + 0.5, y + 1, '#e8f0ff', 12);
        if (BLOCKS[w.get(x, y)].flammable) w.set(x, y, B.FIRE);
        else if (w.isAir(x, y + 1)) w.set(x, y + 1, B.FIRE);
        break;
      }
    }
    for (const e of w.entitiesNear(v.x, v.y, 3)) if (e.kind !== 'caster') e.hp -= 10;
    return null;
  });

  A('summon_rain', 0, () => { world().raining = true; return null; });
  A('dispel_rain', 0, () => { world().raining = false; return null; });

  A('teleport/great', 2, (vm, a) => {
    const e = a.entity(0), v = a.vec(1);
    e.x += v.x; e.y += v.y;
    e.x = Math.max(1, Math.min(world().w - 1, e.x));
    e.y = Math.max(0, Math.min(world().h - 1, e.y));
    world().addEffect('blink', e.x, e.y + e.h / 2, '#c3a6e8');
    return null;
  });

  A('recharge', 1, (vm, a) => { a.entity(0); return null; });
  A('erase', 0, () => { caster().focus = null; return null; });
  A('colorize', 0, () => null);
  A('cycle_variant', 0, () => null);

  A('interop/pehkui/get', 1, (vm, a) => I.Num(a.entity(0).scale));
  A('interop/pehkui/set', 2, (vm, a) => {
    const e = a.entity(0);
    e.scale = Math.max(0.05, Math.min(8, a.num(1)));
    return null;
  });

  // Potions map onto simple timed effects.
  const potions = {
    'potion/weakness': ['weakness', 3],
    'potion/levitation': ['levitation', 2],
    'potion/wither': ['wither', 3],
    'potion/poison': ['poison', 3],
    'potion/slowness': ['slowness', 3],
    'potion/regeneration': ['regeneration', 3],
    'potion/night_vision': ['night_vision', 2],
    'potion/absorption': ['absorption', 3],
    'potion/haste': ['haste', 3],
    'potion/strength': ['strength', 3],
  };
  for (const [id, [name, argc]] of Object.entries(potions)) {
    A(id, argc, (vm, a) => {
      const e = a.entity(0);
      const secs = a.num(1);
      e.effects[name] = Math.max(e.effects[name] || 0, secs * 20);
      world().addEffect('potion', e.x, e.y + e.h / 2, '#c3a6e8');
      return null;
    });
  }

  // ====== Hexal ============================================================
  // Particles: one particle for a bare vector, or a polyline of particles
  // between successive points for a list. Note the mod draws NOTHING for a
  // one-element list — zipWithNext yields no pairs — and we match that.
  A('particles', 1, (vm, a) => {
    const x = a.at(0);
    const w = world();

    if (I.isVec(x)) { w.spawnParticle(x.x, x.y); return null; }
    if (!I.isList(x)) throw Mishaps.invalidIota(0, 'a vector or a list of vectors', x);

    const pts = x.value;
    for (const p of pts) {
      if (!I.isVec(p)) throw Mishaps.invalidIota(0, 'a vector or a list of vectors', x);
    }
    for (let i = 0; i + 1 < pts.length; i++) {
      const s = pts[i], e = pts[i + 1];
      const dist = Math.hypot(e.x - s.x, e.y - s.y, e.z - s.z);
      // 10 particles per block, as in the mod, but capped so a pathological
      // line can't stall the renderer.
      const steps = Math.min(600, Math.floor(dist * 10));
      for (let k = 0; k <= steps; k++) {
        const t = steps ? k / steps : 0;
        w.spawnParticle(s.x + (e.x - s.x) * t, s.y + (e.y - s.y) * t);
      }
    }
    return null;
  });

  // Running Sum: a scan, not a reduce — [1,2,5] becomes [1,3,8]. The seed is
  // chosen from the first element's type and is not itself emitted, so the
  // output is the same length as the input.
  A('running/sum', 1, (vm, a) => {
    const l = a.list(0);
    if (!l.length) return I.List([]);
    const vectorMode = I.isVec(l[0]);
    const out = [];
    let ax = 0, ay = 0, az = 0, an = 0;
    for (const item of l) {
      if (vectorMode) {
        if (!I.isVec(item)) throw Mishaps.invalidIota(0, 'a list of vectors', a.at(0));
        ax += item.x; ay += item.y; az += item.z;
        out.push(I.Vec(ax, ay, az));
      } else {
        if (!I.isNum(item)) throw Mishaps.invalidIota(0, 'a list of numbers', a.at(0));
        an += item.value;
        out.push(I.Num(an));
      }
    }
    return I.List(out);
  });

  // ====== HexWorld =========================================================
  // Cursor Reflection: the mouse position in world space, unrounded. Invented
  // for this sandbox — it has no counterpart in the mod.
  A('cursor', 0, () => I.Vec(window.App.cursor.x, window.App.cursor.y, 0));

  // No analogue in this world.
  const noAnalogue = {
    'craft/cypher': 'There are no cypher items here.',
    'craft/trinket': 'There are no trinket items here.',
    'craft/artifact': 'There are no artifact items here.',
    'craft/battery': 'There are no phials here.',
    'brainsweep': 'There are no minds here to flay.',
  };
  for (const [id, msg] of Object.entries(noAnalogue)) {
    R(id, () => { throw Mishaps.disallowed(msg); });
  }
})();
