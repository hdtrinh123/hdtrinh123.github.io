// The casting VM. Modelled on HexMod's CastingVM / CastingImage: a CEK-style
// machine over a continuation of frames, not a recursive interpreter. That's what
// makes Hermes / Iris / Thoth / Charon fall out for free.

const ACTIONS = {};   // populated by actions.js, keyed by internal id

// --- mishaps ---------------------------------------------------------------
// Each mishap aborts the whole hex and mutates the stack its own way.

function mishap(name, message, apply) {
  return { mishap: true, name, message: message || name, apply: apply || ((s) => s) };
}

const Mishaps = {
  invalidPattern: () => mishap('Invalid Pattern', 'That pattern has no meaning.',
    (s) => { s.push(Iota.Garbage('Invalid Pattern')); return s; }),

  notEnoughArgs: (expected, got) => mishap('Not Enough Iotas',
    `Expected ${expected} iota${expected === 1 ? '' : 's'}, but the stack held ${got}.`,
    (s) => { for (let i = 0; i < expected - got; i++) s.push(Iota.Garbage('Not Enough Iotas')); return s; }),

  invalidIota: (idx, expected, got) => mishap('Incorrect Iota',
    `Expected ${expected} but found ${Iota.typeName(got)}.`,
    (s) => {
      const i = s.length - 1 - idx;
      if (i >= 0 && i < s.length) s[i] = Iota.Garbage('Incorrect Iota');
      return s;
    }),

  divideByZero: () => mishap('Mathematical Error', 'Division by zero.',
    (s) => { s.push(Iota.Garbage('Mathematical Error')); return s; }),

  tooManyCloseParens: () => mishap('Too Many Closing Parens',
    'Retrospection with no matching Introspection.',
    (s) => { s.push(Iota.Pat('eee', Hex.dirIndex('EAST'))); return s; }),

  unescapedValue: (i) => mishap('Unescaped Value',
    `Expected a pattern to execute, but found ${Iota.typeName(i)}.`,
    (s) => { s.push(Iota.Garbage('Unescaped Value')); return s; }),

  badEntity: (what) => mishap('Entity Not Found', what || 'That entity is gone.',
    (s) => { s.push(Iota.Garbage('Entity Not Found')); return s; }),

  badLocation: (what) => mishap('Incorrect Block', what || 'Nothing usable there.',
    (s) => { s.push(Iota.Garbage('Incorrect Block')); return s; }),

  disallowed: (what) => mishap('Disallowed Action',
    what || 'That action has no meaning in this world.',
    (s) => { s.push(Iota.Garbage('Disallowed Action')); return s; }),

  evalTooMuch: () => mishap('Lost In Thought', 'The hex evaluated too much.',
    (s) => { s.push(Iota.Garbage('Delve Too Deep')); return s; }),

  stackSize: () => mishap('Stack Overflow', 'The stack grew beyond reason.',
    () => [Iota.Garbage('Catastrophic Failure')]),

  emptyUndo: () => mishap('Nothing To Undo', 'Evanition with an empty buffer.',
    (s) => s),
};

const MAX_OPS = 200000;
const MAX_STACK = 1024;

// --- image -----------------------------------------------------------------

function freshImage() {
  return {
    stack: [],
    parenCount: 0,
    parenthesized: [],   // { iota, escaped }
    escapeNext: false,
    opsConsumed: 0,
    ravenmind: null,
  };
}

function cloneImage(img) {
  return {
    stack: img.stack.map(Iota.cloneIota),
    parenCount: img.parenCount,
    parenthesized: img.parenthesized.map((p) => ({ iota: Iota.cloneIota(p.iota), escaped: p.escaped })),
    escapeNext: img.escapeNext,
    opsConsumed: img.opsConsumed,
    ravenmind: img.ravenmind ? Iota.cloneIota(img.ravenmind) : null,
  };
}

// --- special forms ---------------------------------------------------------

const SIG_INTROSPECTION = 'qqq';
const SIG_RETROSPECTION = 'eee';
const SIG_CONSIDERATION = 'qqqaw';
const SIG_EVANITION = 'eeedw';

// Runs *before* dispatch. Returns a resolution string if the iota was swallowed
// by paren/escape logic, or null to fall through to execution.
function handleParentheses(img, iota) {
  const sig = iota.type === 'pattern' ? iota.signature : null;

  if (img.parenCount > 0) {
    if (img.escapeNext) {
      img.parenthesized.push({ iota, escaped: true });
      img.escapeNext = false;
      return 'ESCAPED';
    }
    if (sig === SIG_CONSIDERATION) { img.escapeNext = true; return 'EVALUATED'; }
    if (sig === SIG_EVANITION) {
      const last = img.parenthesized.pop();
      if (!last) throw Mishaps.emptyUndo();
      if (!last.escaped && last.iota.type === 'pattern') {
        if (last.iota.signature === SIG_INTROSPECTION) img.parenCount -= 1;
        else if (last.iota.signature === SIG_RETROSPECTION) img.parenCount += 1;
      }
      return 'UNDONE';
    }
    if (sig === SIG_INTROSPECTION) {
      img.parenthesized.push({ iota, escaped: false });
      img.parenCount += 1;
      return 'ESCAPED';
    }
    if (sig === SIG_RETROSPECTION) {
      img.parenCount -= 1;
      if (img.parenCount === 0) {
        img.stack.push(Iota.List(img.parenthesized.map((p) => p.iota)));
        img.parenthesized = [];
      } else if (img.parenCount < 0) {
        throw Mishaps.tooManyCloseParens();
      } else {
        img.parenthesized.push({ iota, escaped: false });
      }
      return 'ESCAPED';
    }
    img.parenthesized.push({ iota, escaped: false });
    return 'ESCAPED';
  }

  if (img.escapeNext) {
    img.stack.push(iota);
    img.escapeNext = false;
    return 'ESCAPED';
  }
  if (sig === SIG_CONSIDERATION) { img.escapeNext = true; return 'EVALUATED'; }
  if (sig === SIG_INTROSPECTION) { img.parenCount = 1; return 'ESCAPED'; }
  if (sig === SIG_RETROSPECTION) throw Mishaps.tooManyCloseParens();
  if (sig === SIG_EVANITION) throw Mishaps.emptyUndo();
  return null;
}

// --- frames ----------------------------------------------------------------
// A continuation is a JS array used as a stack: the last element is the head.

const Frame = {
  evaluate: (list, i, root) => ({ t: 'eval', list, i: i || 0, root: !!root }),
  forEach: (data, di, code, baseStack, acc) => ({ t: 'foreach', data, di, code, baseStack, acc }),
  finish: () => ({ t: 'finish' }),
};

// breakDownwards: Charon unwinds frames until one returns handled = true.
function breakFrame(frame, stack) {
  if (frame.t === 'finish') return { handled: true, stack };
  if (frame.t === 'foreach') {
    const newStack = frame.baseStack ? frame.baseStack.slice() : [];
    const acc = frame.acc.concat(stack);
    newStack.push(Iota.List(acc));
    return { handled: true, stack: newStack };
  }
  return { handled: false, stack };
}

// --- the evaluator ---------------------------------------------------------

class VM {
  constructor(ctx) {
    this.ctx = ctx;               // { world, log(msg), rng }
    this.image = freshImage();
    this.cont = [];
    this.earlyExit = false;
    this.error = null;
  }

  useOp() {
    this.image.opsConsumed++;
    if (this.image.opsConsumed > MAX_OPS) throw Mishaps.evalTooMuch();
  }

  // Execute a single iota that has already passed paren handling.
  executeIota(iota) {
    if (iota.type !== 'pattern') throw Mishaps.unescapedValue(iota);
    const match = Registry.matchPattern(iota.signature, iota.startDir);

    if (match.kind === 'number') {
      this.image.stack.push(Iota.Num(match.value));
      return 'EVALUATED';
    }
    if (match.kind === 'mask') {
      const mask = match.mask;
      const n = mask.length;
      const stack = this.image.stack;
      if (stack.length < n) throw Mishaps.notEnoughArgs(n, stack.length);
      const args = stack.splice(stack.length - n, n);
      // mask index 0 is the deepest argument
      for (let i = 0; i < n; i++) if (mask[i]) stack.push(args[i]);
      return 'EVALUATED';
    }
    if (match.kind === 'action') {
      const fn = ACTIONS[match.id];
      if (!fn) throw Mishaps.disallowed(`${match.name} is not implemented here.`);
      this.useOp();
      return fn(this, match.def) || 'EVALUATED';
    }
    throw Mishaps.invalidPattern();
  }

  // Pop n args, checking depth. Returns them bottom-first (as in the mod).
  popArgs(n) {
    const stack = this.image.stack;
    if (stack.length < n) throw Mishaps.notEnoughArgs(n, stack.length);
    return stack.splice(stack.length - n, n);
  }

  push(i) { this.image.stack.push(i); }

  // Step one frame. Returns false when the continuation is exhausted.
  step() {
    if (!this.cont.length) return false;
    const frame = this.cont.pop();

    if (frame.t === 'finish') return true;

    if (frame.t === 'eval') {
      if (frame.i >= frame.list.length) return true;
      const iota = frame.list[frame.i];
      this.cont.push(Frame.evaluate(frame.list, frame.i + 1, frame.root));
      const res = handleParentheses(this.image, iota);
      this.lastResolution = res !== null ? res : this.executeIota(iota);
      return true;
    }

    if (frame.t === 'foreach') {
      let stack;
      if (frame.baseStack === null) {
        // First entry: capture the stack as it was when Thoth began.
        stack = this.image.stack.slice();
      } else {
        // Everything left on the stack from the last iteration is flattened in.
        frame.acc = frame.acc.concat(this.image.stack);
        stack = frame.baseStack;
      }

      if (frame.di < frame.data.length) {
        const element = frame.data[frame.di];
        this.cont.push(Frame.forEach(frame.data, frame.di + 1, frame.code, stack, frame.acc));
        this.cont.push(Frame.evaluate(frame.code, 0, false));
        const tStack = stack.slice();
        tStack.push(element);
        this.image.stack = tStack;
        this.useOp();
      } else {
        const tStack = stack.slice();
        tStack.push(Iota.List(frame.acc));
        this.image.stack = tStack;
      }
      // Escape/paren state never leaks between iterations or out of Thoth.
      this.image.escapeNext = false;
      this.image.parenCount = 0;
      this.image.parenthesized = [];
      return true;
    }

    return true;
  }

  halt() {
    // Charon: unwind frames until one handles the break.
    let stack = this.image.stack;
    let handled = false;
    while (this.cont.length) {
      const frame = this.cont.pop();
      const r = breakFrame(frame, stack);
      stack = r.stack;
      if (r.handled) { handled = true; break; }
    }
    this.image.stack = handled ? stack : [];
    if (!handled) this.earlyExit = true;
  }
}

// Run a list of top-level pattern iotas. Returns per-pattern snapshots so the
// timeline can scrub, plus the final image.
function runHex(patternIotas, ctx) {
  const vm = new VM(ctx);
  vm.cont.push(Frame.evaluate(patternIotas, 0, true));

  const snapshots = [];       // one per top-level pattern
  const resolutions = new Array(patternIotas.length).fill('UNRESOLVED');
  let recordedUpTo = 0;
  let guard = 0;

  const recordThrough = (upTo) => {
    while (recordedUpTo < upTo) {
      snapshots[recordedUpTo] = cloneImage(vm.image);
      recordedUpTo++;
    }
  };

  while (vm.cont.length && !vm.earlyExit) {
    if (++guard > MAX_OPS) { vm.error = Mishaps.evalTooMuch(); break; }

    // All nested work for the previous root pattern is done when only the root
    // frame remains — snapshot there.
    const bottom = vm.cont[0];
    if (vm.cont.length === 1 && bottom && bottom.root && bottom.i > recordedUpTo) {
      recordThrough(bottom.i);
    }

    const rootIdx = (vm.cont.length === 1 && bottom && bottom.root) ? bottom.i : -1;

    try {
      if (!vm.step()) break;
      if (rootIdx >= 0 && rootIdx < resolutions.length) {
        resolutions[rootIdx] = vm.lastResolution || 'EVALUATED';
      }
      if (vm.image.stack.length > MAX_STACK) throw Mishaps.stackSize();
    } catch (err) {
      if (!err || !err.mishap) throw err;
      vm.image.stack = err.apply(vm.image.stack);
      vm.error = err;
      if (rootIdx >= 0 && rootIdx < resolutions.length) resolutions[rootIdx] = 'ERRORED';
      vm.errorIndex = rootIdx >= 0 ? rootIdx : recordedUpTo;
      break;
    }
  }

  const finalBottom = vm.cont[0];
  if (finalBottom && finalBottom.root) recordThrough(Math.min(finalBottom.i, patternIotas.length));
  recordThrough(patternIotas.length);

  return {
    image: vm.image,
    snapshots,
    resolutions,
    error: vm.error,
    errorIndex: vm.errorIndex,
    opsConsumed: vm.image.opsConsumed,
  };
}

window.VMLib = {
  ACTIONS, Mishaps, mishap, VM, Frame, runHex, freshImage, cloneImage,
  handleParentheses, breakFrame,
};
