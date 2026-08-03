# HexWorld — plan

A browser app: a 2D block world (no player, just a world) plus a faithful Hex Casting
pattern-drawing panel modelled on Hex Studio.

## Research summary (sources: FallingColors/HexMod @ v0.11.3, Master-Bw3/Hex-Studio)

### Grid geometry
- `HexDir` ordinals are **clockwise from NORTH_EAST**: NE, E, SE, SW, W, NW.
- Axial deltas: NE(1,-1) E(1,0) SE(0,1) SW(-1,1) W(-1,0) NW(0,-1).
- `coordToPx`: `x = size*√3*(q + r/2)`, `y = size*1.5*r` (pointy-top, +y down).
- `HexAngle`: w=FORWARD(0) e=RIGHT(1) d=RIGHT_BACK(2) s=BACK(3) a=LEFT_BACK(4) q=LEFT(5).
  Both enums are CW-increasing, so `rotate = (dir + angle) % 6`.
- A signature of length n yields **n+1 segments and n+2 points**. Empty signature is legal.

### Validity
- An edge may not be traversed twice (blocked in *both* directions once drawn).
- Vertices **may** be revisited — crossings and figure-eights are legal.
- Immediate backtracking (`s`/BACK) is rejected.
- Minimum pattern is one segment (two points).

### Matching
Angle signature alone is the key — `startDir` is render-only, so patterns are
rotation-invariant (but *not* reflection-invariant). Match order matters:
1. exact signature in the action registry
2. number literal: `aqaa` (+) / `dedd` (−) prefix, then fold `w`+1 `q`+5 `e`+10 `a`*2 `d`/2
3. bookkeeper's mask: flat segment = keep(`-`), right-then-left dip = drop(`v`)
4. otherwise → Invalid Pattern mishap (pushes Garbage)

Great Spells are per-world scrungled in the real mod; we use canonical signatures.

### Iotas (9)
`null`, `double`, `boolean`, `entity`, `list`, `pattern`, `garbage`, `vec3`, `continuation`.
All numbers are doubles; equality tolerance 0.0001. Display: `%.2f`, `(%.2f, %.2f, %.2f)`,
`True`/`False`, `Null`, garbage as `arimfexendrapuse`.

### VM
`CastingImage = { stack, parenCount, parenthesized, escapeNext, opsConsumed, userData }`.
Stack index 0 is the **bottom**, `last()` is the top. Ravenmind lives in userData, not the
stack, so it survives Thoth iterations; writing Null deletes it.

Evaluation is a CEK machine over a continuation of frames — `FrameEvaluate`,
`FrameForEach`, `FrameFinishEval` — *not* a recursive interpreter. This is what makes
Hermes / Iris / Thoth / Charon fall out for free, so we implement it that way.

Parenthesis/escape handling runs *before* dispatch (`handleParentheses`), with
Introspection `qqq`, Retrospection `eee`, Consideration `qqqaw`, Evanition `eeedw`
compared by angle list.

Thoth: each iteration restarts from a **copy of the entry stack** with the element pushed
on top; everything left on the stack at iteration end is flattened into one accumulator;
the accumulator is pushed as a single list at the end.

Mishaps abort the whole hex and each mutates the stack its own way (Garbage insertion,
etc.).

### Media
Internal unit = 1/10000 dust. Costs are per-action and immediate; stack/math ops are free.

**Not implemented** — per the brief this is a spell tester rather than a survival
mod, so media cost and ambit limits are deliberately not enforced.

## World adaptation (2D, no player)

The mod is 3D and player-centric; this world is 2D and has no player. Adaptations:
- Vectors stay 3D iotas; world ops use x,y and ignore z.
- "The caster" is a free-floating **Mind** sigil in the world (WASD/arrows to move it).
  `Mind's Reflection` returns it. It holds the media pool and an attuned focus slot.
- Raycasts are 2D DDA. `raycast/axis` returns the 2D face normal.
- Crafting / brainsweep have no analogue → Disallowed Action.
- Editing the pattern list re-evaluates constantly, so preview runs against a
  throwaway **clone** of the world; only the Cast button touches the real one.

## Architecture (no build step, plain scripts + globals so `file://` works)

| file | contents |
|---|---|
| `js/hex.js` | HexDir/HexAngle/HexCoord math, pattern positions, validity, signature↔points |
| `js/registry.js` | ~160-entry pattern table + number/mask special handlers + matcher |
| `js/iota.js` | iota constructors, equality, truthiness, display strings |
| `js/world.js` | tile world, terrain gen, physics tick, entities, rendering |
| `js/actions.js` | action implementations (math, stack, list, meta, spells) |
| `js/vm.js` | CastingImage, continuation frames, mishaps, evaluator |
| `js/grid.js` | hex drawing canvas — snapping, in-progress line, shimmer |
| `js/ui.js` | side panel: Patterns / Stack / Casting / File tabs, timeline |
| `js/app.js` | wiring, keybinds, persistence |

## UI

Left icon rail + 300px panel + main area. Main area is the world canvas; pressing the
casting key (`C`, or the on-screen button) overlays the hex grid.

Panels:
- **Patterns** — the drawn-pattern log: display names, delete, drag-reorder, text entry
  with autocomplete (accepts display name, internal name, raw signature, bare number,
  bookkeeper code).
- **Stack** — current stack at the scrub position, type-coloured, lists indented.
- **Casting** — Mind state, media, ravenmind, focus contents, entity list, ambit.
- **File** — project name, import/export JSON, import/export pattern text (newline list
  with `{`/`}` and 4-space indents, per Hex Studio), export image.

Timeline bar under the grid: one node per pattern, click to scrub the stack view.
