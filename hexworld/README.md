# HexWorld

A 2D block world plus a faithful reimplementation of [Hex Casting](https://hexcasting.hexxy.media/v/0.11.3/1.0/en_us/)'s
pattern-drawing and spell system, with a side panel modelled on
[Hex Studio](https://master-bw3.github.io/Hex-Studio/).

There is no player — just a world, and a floating **Mind** that acts as the caster.

## Running it

The app is plain HTML/CSS/JS with no build step, but browsers block `file://`
scripts, so it needs to be served over HTTP. There's no Node or Python on this
machine, so a small PowerShell server is included:

```powershell
.\serve.ps1              # serves this folder on http://localhost:8777/
```

Then open <http://localhost:8777/>. Test suite: <http://localhost:8777/tests/logic-tests.html>.

## Controls

| | |
|---|---|
| `C` | toggle the casting grid |
| `Enter` | cast the current pattern list |
| `Esc` | close the grid / an overlay |
| `1`–`4` | switch side panel |
| `WASD` / arrows | move the Mind |
| drag / wheel | pan and zoom (world and grid both) |
| `Alt`+`←`/`→` | step the timeline |

Draw patterns by dragging across the hex lattice, or type them into the
**Add a pattern** box — it accepts a display name (`Mind's Reflection`), an
internal id (`get_caster`), a raw angle signature (`qaq`), a bare number (`4.5`),
or a bookkeeper code (`v-v`).

## Panels

- **Patterns** — the drawn-pattern log. Delete with `×`, reorder by dragging the
  handle, introspection blocks are indented.
- **Stack** — the stack at the current timeline position, colour-coded by iota
  type, with lists expanded inline. Also shows the ravenmind and any
  in-progress introspection buffer.
- **Casting Context** — the Mind's state, its attuned focus, the block that
  Place Block uses, weather, and every entity in the world.
- **File** — import/export patterns as text or the whole project as JSON,
  re-pack the drawings, regenerate the world.

The timeline strip under the grid has one node per pattern; click one to scrub
the stack view back to that step.

## Preview vs. casting

Editing the pattern list re-evaluates it constantly, which would be a problem
for spells that change the world. So evaluation runs against a **throwaway clone
of the world**, and only pressing **Cast** runs it against the real one. The
stack panel therefore always shows a clean run from an empty stack.

## What's faithful, and what isn't

Ported from HexMod v0.11.3 (`FallingColors/HexMod`) rather than guessed at:

- **Grid maths** — `HexDir` ordinals clockwise from `NORTH_EAST`, axial coords,
  the exact `coordToPx`/`pxToCoord` used in-game.
- **Validity** — an edge may never be re-traversed (blocked in both directions),
  immediate backtracking is refused, but revisiting a *vertex* is legal, so
  crossings and figure-eights work.
- **Matching** — the angle signature alone is the key, so patterns are
  rotation-invariant but not reflection-invariant. Match order is registry →
  number literal → bookkeeper mask, so a registered pattern can never be
  shadowed.
- **Number literals** — `aqaa`/`dedd` prefix then a left-to-right fold with no
  precedence (`w`+1, `q`+5, `e`+10, `a`×2, `d`÷2).
- **Bookkeeper's Gambit** — decoded from absolute segment directions; `-` keeps
  and `v` drops.
- **The VM** — a CEK machine over a continuation of frames, not a recursive
  interpreter, which is what makes Hermes / Iris / Thoth / Charon behave
  correctly. The stack, paren depth, escape flag and ravenmind live in a
  `CastingImage` exactly as in the mod; the ravenmind sits outside the stack so
  it survives Thoth iterations.
- **Introspection** — patterns inside `{}` are buffered as *pattern iotas*, not
  executed, and nested `{}` stay flat until the list is evaluated. This surprises
  people, but it is what the mod does.
- **Thoth's Gambit** — each iteration restarts from a copy of the entry stack
  with the element pushed on top, and everything left over is flattened into one
  accumulator.
- **Swindler's Gambit** — a Lehmer code in the factorial number system, with the
  doubled leading `1` in the stride sequence.
- **Mishaps** — typed, each with its own stack effect, and any mishap aborts the
  rest of the hex.

Deliberately dropped, since this is a sandbox spell tester rather than a
survival mod: **media cost** and **ambit** limits are not enforced.

## Patterns beyond base Hex Casting

Two from **Hexal 0.3.1** (`FallingColors/Hexal`), with signatures taken from
`HexalActions.kt`:

| pattern | signature | stack |
|---|---|---|
| Particles (`hexal:particles`) | `eqqqqa` / NORTH_EAST | `vec \| [vec] -> ()` |
| Running Sum Purification (`hexal:running/sum`) | `aea` / WEST | `[num\|vec] -> [num\|vec]` |

**Particles** draws one particle at a bare vector, or a trail between successive
points of a list — 10 particles per block, as the mod does. Two faithful quirks
worth knowing: a *one-element* list draws nothing (the mod zips successive
pairs, and one point has no pairs), and a list of lists is rejected.

**Running Sum** is a **scan, not a reduce** — `[1, 2, 5]` gives `[1, 3, 8]`, the
same length as the input. It takes all-numbers or all-vectors, picking the
accumulator type from the first element; a mixed list mishaps. Hexal also has
`running/mul` (`qaawaaq`, numbers only) and `factorial` (`wawdedwaw`) in the same
family — not added, but they're one line each if wanted.

One invented for this sandbox, with no counterpart in any mod:

| pattern | signature | stack |
|---|---|---|
| Cursor Reflection (`hexworld:cursor`) | `qwq` / EAST | `() -> vec` |

Pushes the mouse pointer's position in world space, unrounded — so
`(191.71, 95.68, 0)`, not a block coordinate. Feed it to `Archer's Distillation`
or `Particles` to aim spells with the mouse. The live value is shown in the HUD.
Since it is invented, its signature could in principle collide with a real
pattern in a future Hex Casting version.

Adapted for a 2D, player-free world:

- Vectors are still 3D iotas; world operations use x and y and ignore z.
- The caster is the Mind sigil. `Mind's Reflection` returns it; it holds the
  attuned focus that `Scribe's Reflection`/`Gambit` read and write.
- Raycasts are 2D DDA; `raycast/axis` returns the 2D face normal.
- Great Spells use their canonical book signatures — no per-world scrungling.
- Crafting and Flay Mind have no analogue here and raise Disallowed Action.

## Layout

| file | contents |
|---|---|
| `js/hex.js` | hex grid maths, pattern positions, validity, signature ↔ points |
| `js/registry.js` | the pattern table, number/mask special handlers, the matcher |
| `js/iota.js` | the nine iota types, equality, truthiness, display |
| `js/world.js` | tiles, terrain generation, physics, entities |
| `js/vm.js` | `CastingImage`, continuation frames, mishaps, the evaluator |
| `js/actions.js` | every action implementation |
| `js/grid.js` | the drawing surface — snapping, rubber band, shimmer |
| `js/ui.js` | side panels and the timeline |
| `js/app.js` | world rendering, camera, keybinds, import/export |

`tests/logic-tests.html` runs 146 assertions over the geometry, the encoders,
the matcher and the VM, including the book's own worked examples.
