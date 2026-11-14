# Handoff

Branch: `prototype`. Date: 2026-11-15.

## State

Working:

- All six rules are implemented (see the table in DESIGN.md).
- Nine placeables on the 1–9 bar: mister, heater, cooler, fan, block, shelf, basin, vent, lamp.
- Left click places, right click removes, drag-paint for blocks and shelves, `R` turns the fan.
- Room, glass box, sprites and bar are drawn in code in the style of the reference screenshot.

How it was checked: headless Chrome with a software renderer, driving `MT.debug` and looking at
screenshots after 10–25 simulated seconds (mister alone; mister + heater + cooler; every item at once),
plus scripted mouse and keyboard input.

Not checked yet:

- Frame rate on real GPUs. The software renderer cannot tell us; the workload is about 30 small passes
  per step on a 528x248 grid, which should be light, but nobody has measured it.
- Long runs. Nothing was watched past about 25 simulated seconds, so the steady state (how foggy the
  box ends up after minutes) is predicted from the parameters, not observed. If it ends up too foggy,
  raise `uKg`; too empty, raise `uEmit`.
- Touch input and Firefox / Safari.

## Adding a placeable

1. Append an entry to `MT.TYPES` in `src/items.js`. The header comment there lists every field.
2. That is all for anything built from the existing fields. Example, a candle:

```js
{
  name: 'CANDLE', w: 2, h: 6,
  solid: [[0, 2, 2, 4], [0, 0, 2, 2, 0.8]],        // wax, then a hot flame
  light: { x: 1, y: 1, i: 0.5, kind: 0 },
  draw(c, x, y) { r(c, PAL.cream, x, y + 2, 2, 4); r(c, PAL.orange, x, y, 2, 2); },
}
```

Fields available to a type today:

| Field | Effect |
| --- | --- |
| `solid` rect | blocks air; optional 5th value -1..+1 makes it cold or hot |
| `R.emit(x, y, w, h, rate)` | adds mist in a region |
| `R.wind(x, y, w, h, dx, dy, strength)` | drags air toward a velocity (y up) |
| `R.sink(x, y, w, h, strength)` | removes mist and vapour |
| `light` | glow that also lights nearby mist |

Rules of thumb: keep sprites within 16x12 so they fit a bar slot; sizes of paintable items should divide
264 and 124 on their snap grid; regions may extend outside the sprite.

## The bar is full

Nine slots, nine items. Before adding a tenth, pick one:

- **Pages** (recommended): `Tab` or `0` flips to the next set of nine; draw small page pips beside the bar.
  Needs a `page` variable in `main.js` and an offset in the three places that index `MT.TYPES` by slot
  (`selected`, the bar loop, key handling).
- Replace an existing item.

## Planned placeables

Data only, no engine change:

| Item | Built from |
| --- | --- |
| Candle | small hot solid + lamp light |
| Ice block | 6x6 cold solid, no feet |
| Hot plate | 16x2 hot solid, snaps like a shelf |
| Glass pane | 2x16 vertical solid, paintable, pale sprite |
| Steps / ramp | a few solid rects in a staircase, turnable |
| Pipe | two parallel walls, turnable, to duct fan flow |
| Blower | larger fan, 8x16 |
| Sponge | sink region without a solid body |

Small engine additions:

| Item | What it needs |
| --- | --- |
| Water tray | a vapour source: add `R.humid()` writing a free channel, add to vapour in `update` |
| Mesh / gauze | partial drag: a drag channel, multiply velocity by `1 - drag` in `advectVel` |
| Dripper | spawn droplets on a timer from `main.js`; no shader change |
| Thermostat heater | per-item state plus a 1-pixel read-back of temperature near the item |
| Timed mister | per-item on/off phase; emission rate becomes time-dependent in `rebuild` or a uniform |

Larger changes:

| Item | What it needs |
| --- | --- |
| Open window / hole in the glass | an outflow boundary (fixed pressure) in `jacobi` and `gradient`; today the box is sealed, which is also why the vent removes mist instead of moving air |
| Paddle wheel, moving parts | moving solids with their own velocity in `divergence` / `gradient`, re-rasterised every frame |
| Pooled water | a height field for water on surfaces and in basins, fed by droplets, evaporating back to vapour |

## Other next steps

- Animate sprites (fan blades, heater flicker): the scene texture is static today; either redraw on a
  timer or move items to their own layer.
- Save and load layouts (`localStorage`, then a share string).
- Fog on the glass where cold mist sits against it.
- A pause key and a clear-all key.
- Measure on a low-end laptop; if needed drop `pressureIters` to 12 or `K` to 1.
