# Design

## Goals

Minimal, physically plausible, calm to watch, cheap to run. The picture is free to cheat as long as the
behaviour underneath is real.

## Layout of the code

| File | Role |
| --- | --- |
| `index.html` | two stacked canvases (WebGL picture, 2D overlay), classic script tags so it runs from `file://` |
| `src/gl.js` | WebGL2 helpers: programs, render targets, fullscreen passes |
| `src/shaders.js` | all GLSL: the solver passes and the final composite |
| `src/sim.js` | `MT.Sim` (runs the passes) and `MT.PARAMS` (every tunable number) |
| `src/art.js` | palette, 3x5 pixel font, the room and the glass box, drawn in code |
| `src/items.js` | the placeables (`MT.TYPES`) and the rasteriser that turns them into simulation inputs |
| `src/main.js` | input, the 1–9 bar, droplets, frame loop |

Everything hangs off one global, `MT`. `MT.debug` exposes `place(type, x, y, rot)`, `clear()` and `run(steps)`
for the console.

## Resolutions

- Art: 384x216, scaled up by a whole number with no smoothing.
- Box interior: 264x124 art pixels at (60, 30).
- Simulation: 2 cells per art pixel, so 528x248. `K` in `main.js`.
- Time: fixed 60 steps per second regardless of display refresh rate.

## Simulation

A 2D grid fluid solver on the GPU ("stable fluids"), one texel per cell, y up, `dt = 1`.

State textures:

| Texture | Channels |
| --- | --- |
| velocity (RG16F) | air velocity in cells per step |
| scalars (RGBA16F) | R mist, G temperature (0 = room), B vapour, A precipitation produced this step |
| pressure (R16F) | kept between frames as a warm start |

Inputs rasterised from the placeables whenever they change (`MT.rasterize`):

| Texture | Channels |
| --- | --- |
| `uObjA` | R solid, G surface temperature (0..1 maps to -1..+1), B mist emission, A "this solid is thermal" |
| `uObjB` | RG wind direction x speed (signed bytes, 128 = 0), B sink, A wind strength |

One step, in order (`Sim.step`):

1. `advectVel` — move velocity along itself; add buoyancy and fan forces.
2. `curl`, `vorticity` — vorticity confinement, restores small swirls.
3. `divergence`, `jacobi` x20, `gradient` — pressure projection. Solids and the glass are no-flow boundaries.
4. `advectSca` — carry mist, temperature and vapour with the air; mist also settles slowly.
5. `update` — diffusion, heat exchange with surfaces, phase change, precipitation, sources and sinks.

How the six rules map:

| Rule | Where |
| --- | --- |
| 1 Diffusion | `update`: Laplacian on mist, heat and vapour (`uDm`, `uDt`, `uDv`), no flux through solids |
| 2 Buoyancy | `advectVel`: `+uBuoyT * temperature - uBuoyM * mist` on vertical velocity |
| 3 Air currents | semi-Lagrangian advection in `advectVel` / `advectSca`; fans via `uObjB` |
| 4 Obstacles | pressure projection with solid cells; solid cells mirror neighbouring air so mist does not leak |
| 5 Temperature | thermal solids hold a surface temperature and conduct into adjacent air (`uSurfK`); glass conducts to room temperature |
| 6 Condensation | `update`: saturation `uS0 + uS1*T`. Vapour above it becomes mist, mist below it evaporates. Dense mist (`uMcrit`) and mist touching surfaces, cold ones most, turns into precipitation |

Precipitation is written to the alpha channel, shrunk 8x into a byte texture and read back every 4 steps.
`main.js` turns it into falling droplets (CPU particles on the art grid) that land on solids or the floor and
leave a wet pixel that fades.

## Picture

`composite` shader, one pass at art resolution:

1. Room and placeables (a 2D canvas uploaded as a texture when items change).
2. Mist: opacity `1 - exp(-density * uDens)`, shaded by five density samples toward a light at upper left,
   tinted slightly by temperature and by the room's left-cool / right-warm light, then banded to `uLevels`
   steps with a 4x4 Bayer dither so it sits with the pixel art.
3. Lights: lamps, heaters and coolers glow and light the mist near them.
4. Glass reflections, vignette and letterbox bars (second static texture).

The 2D overlay canvas draws droplets, wet pixels, the placement ghost, the bar and the cursor.

## Tuning

All numbers are in `MT.PARAMS` (`src/sim.js`) with comments, and can be changed live from the console,
for example `MT.PARAMS.uEmit = 0.4`.
