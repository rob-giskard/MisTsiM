// Placeables. To add one, append an entry to MT.TYPES (see docs/HANDOFF.md).
//
// A type is data plus a sprite:
//   name          label shown beside the bar
//   w, h          size in art pixels (keep within 16x16 so the sprite fits a bar slot)
//   snapX, snapY  placement grid (default 1)
//   paint         true = keeps placing while the left button is dragged
//   turns         true = R rotates it (rot 0..3 = right, up, left, down)
//   solid         [[x,y,w,h, temp?], ...] solid rects; temp in -1..+1 makes the surface hot or cold
//   body          occupancy rects for items that are not solid (defaults to `solid`)
//   fields(R,rot) optional: R.emit / R.wind / R.sink regions, in local art pixels
//   light         optional {x, y, i, kind}: kind 0 lamp, 1 heater glow, 2 cooler glow
//   draw(ctx,x,y,rot)  the sprite
'use strict';
window.MT = window.MT || {};
(function (MT) {
  const { r, PAL } = MT.ART;
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];   // physical, y up

  MT.TYPES = [
    {
      name: 'MISTER', w: 12, h: 6,
      solid: [[0, 3, 12, 3], [4, 1, 4, 2]],
      fields(R) { R.emit(3, -3, 6, 3, 1); R.wind(4, -10, 4, 10, 0, 0.5, 0.5); },
      draw(c, x, y) {
        r(c, PAL.wood1, x, y + 3, 12, 3); r(c, PAL.wood3, x, y + 3, 12, 1); r(c, PAL.wood0, x, y + 5, 12, 1);
        r(c, PAL.pale, x + 4, y + 1, 4, 2); r(c, PAL.cream, x + 5, y, 2, 1); r(c, PAL.dim, x + 7, y + 1, 1, 2);
        r(c, PAL.orange, x + 10, y + 4, 1, 1);
      },
    },
    {
      name: 'HEATER', w: 16, h: 8,
      solid: [[0, 0, 16, 6, 1], [1, 6, 2, 2], [13, 6, 2, 2]],
      light: { x: 8, y: 3, i: 0.55, kind: 1 },
      draw(c, x, y) {
        r(c, '#2a211e', x, y, 16, 6);
        for (let i = 0; i < 8; i++) r(c, '#3b2d27', x + i * 2, y, 1, 6);
        r(c, '#54403a', x, y, 16, 1);
        r(c, PAL.orange, x + 1, y + 2, 14, 1); r(c, PAL.ember, x + 1, y + 3, 14, 1);
        r(c, '#e9a35a', x + 3, y + 2, 2, 1); r(c, '#e9a35a', x + 9, y + 2, 3, 1);
        r(c, PAL.wood0, x + 1, y + 6, 2, 2); r(c, PAL.wood0, x + 13, y + 6, 2, 2);
      },
    },
    {
      name: 'COOLER', w: 16, h: 8,
      solid: [[0, 0, 16, 6, -1], [1, 6, 2, 2], [13, 6, 2, 2]],
      light: { x: 8, y: 3, i: 0.25, kind: 2 },
      draw(c, x, y) {
        r(c, '#566669', x, y, 16, 6);
        for (let i = 0; i < 7; i++) r(c, '#7f9596', x + 1 + i * 2, y + 1, 1, 4);
        r(c, '#cfe0dc', x, y, 16, 1); r(c, '#a9c2c0', x + 2, y + 1, 3, 1); r(c, '#a9c2c0', x + 10, y + 1, 2, 1);
        r(c, '#36444a', x, y + 5, 16, 1);
        r(c, '#1f2a2e', x + 1, y + 6, 2, 2); r(c, '#1f2a2e', x + 13, y + 6, 2, 2);
        r(c, '#cfe0dc', x + 6, y + 6, 1, 1);
      },
    },
    {
      name: 'FAN', w: 8, h: 8, turns: true,
      solid: [], body: [[0, 0, 8, 8]],
      fields(R, rot) {
        const [dx, dy] = DIRS[rot];
        R.wind(0, 0, 8, 8, dx, dy, 0.45);
        // art y runs down, so "up" is a negative offset
        if (rot === 0) R.wind(8, 0, 10, 8, dx, dy, 0.25);
        if (rot === 1) R.wind(0, -10, 8, 10, dx, dy, 0.25);
        if (rot === 2) R.wind(-10, 0, 10, 8, dx, dy, 0.25);
        if (rot === 3) R.wind(0, 8, 8, 10, dx, dy, 0.25);
      },
      draw(c, x, y, rot) {
        r(c, PAL.iron1, x, y, 8, 8); r(c, PAL.iron0, x + 1, y + 1, 6, 6);
        r(c, PAL.dim, x + 3, y + 1, 2, 6); r(c, PAL.dim, x + 1, y + 3, 6, 2);
        r(c, PAL.cream, x + 3, y + 3, 2, 2);
        if (rot === 0) r(c, PAL.orange, x + 7, y + 1, 1, 6);
        if (rot === 1) r(c, PAL.orange, x + 1, y, 6, 1);
        if (rot === 2) r(c, PAL.orange, x, y + 1, 1, 6);
        if (rot === 3) r(c, PAL.orange, x + 1, y + 7, 6, 1);
      },
    },
    {
      name: 'BLOCK', w: 4, h: 4, snapX: 4, snapY: 4, paint: true,
      solid: [[0, 0, 4, 4]],
      draw(c, x, y) {
        r(c, '#2c2623', x, y, 4, 4); r(c, '#40372f', x, y, 4, 1); r(c, '#40372f', x, y, 1, 4);
        r(c, '#1b1715', x, y + 3, 4, 1); r(c, '#1b1715', x + 3, y, 1, 4);
      },
    },
    {
      name: 'SHELF', w: 16, h: 2, snapX: 4, snapY: 2, paint: true,
      solid: [[0, 0, 16, 2]],
      draw(c, x, y) { r(c, PAL.wood3, x, y, 16, 1); r(c, PAL.wood1, x, y + 1, 16, 1); r(c, PAL.wood2, x + 15, y, 1, 1); },
    },
    {
      name: 'BASIN', w: 16, h: 9,
      solid: [[0, 0, 2, 9], [14, 0, 2, 9], [0, 7, 16, 2]],
      draw(c, x, y) {
        r(c, '#5f6c63', x, y, 2, 9); r(c, '#5f6c63', x + 14, y, 2, 9); r(c, '#5f6c63', x, y + 7, 16, 2);
        r(c, '#a4b19c', x, y, 2, 1); r(c, '#a4b19c', x + 14, y, 2, 1); r(c, '#7e8b7c', x, y + 1, 1, 6);
        r(c, '#414c46', x + 1, y + 8, 14, 1); r(c, '#414c46', x + 15, y + 1, 1, 8);
      },
    },
    {
      name: 'VENT', w: 10, h: 6,
      solid: [[0, 0, 10, 6]],
      fields(R) { R.sink(-3, -3, 16, 12, 1); },
      draw(c, x, y) {
        r(c, PAL.iron1, x, y, 10, 6); r(c, PAL.iron2, x, y, 10, 1);
        r(c, PAL.black, x + 1, y + 2, 8, 1); r(c, PAL.black, x + 1, y + 4, 8, 1);
        r(c, PAL.dim, x + 1, y + 1, 8, 1); r(c, PAL.dim, x + 1, y + 3, 8, 1);
      },
    },
    {
      name: 'LAMP', w: 6, h: 10,
      solid: [[0, 0, 6, 4, 0.3], [2, 4, 2, 5], [1, 9, 4, 1]],
      light: { x: 3, y: 2, i: 0.9, kind: 0 },
      draw(c, x, y) {
        r(c, '#e3dfae', x + 1, y, 4, 1); r(c, '#e3dfae', x, y + 1, 6, 2); r(c, '#b9ad78', x, y + 3, 6, 1);
        r(c, '#fff6cf', x + 2, y + 1, 2, 2);
        r(c, PAL.wood1, x + 2, y + 4, 2, 5); r(c, PAL.wood0, x + 1, y + 9, 4, 1);
      },
    },
  ];

  const bodyOf = (t) => t.body || t.solid;

  // Turns the item list into the textures the simulation reads, plus CPU-side masks.
  // bw, bh: box size in art pixels. k: sim cells per art pixel.
  MT.rasterize = function (items, bw, bh, k) {
    const sw = bw * k, sh = bh * k;
    const A = new Uint8Array(sw * sh * 4), B = new Uint8Array(sw * sh * 4);
    const occ = new Int16Array(bw * bh);        // item index + 1 per art pixel
    const solidArt = new Uint8Array(bw * bh);
    for (let i = 0; i < sw * sh; i++) { A[i * 4 + 1] = 128; B[i * 4] = 128; B[i * 4 + 1] = 128; }

    function fill(x, y, w, h, fn) {
      const x0 = Math.max(0, x), x1 = Math.min(bw, x + w), y0 = Math.max(0, y), y1 = Math.min(bh, y + h);
      for (let py = y0; py < y1; py++) for (let pxx = x0; pxx < x1; pxx++) {
        fn(pxx, py);
      }
    }
    function cells(pxx, py, fn) {
      for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) {
        fn(((bh - 1 - py) * k + j) * sw + pxx * k + i);
      }
    }
    const byte = (v) => Math.max(0, Math.min(255, Math.round(v)));

    items.forEach((it, idx) => {
      const t = MT.TYPES[it.type];
      const R = {
        emit(x, y, w, h, rate) { fill(it.x + x, it.y + y, w, h, (a, b) => cells(a, b, (c) => { A[c * 4 + 2] = byte(rate * 255); })); },
        wind(x, y, w, h, dx, dy, s) {
          fill(it.x + x, it.y + y, w, h, (a, b) => cells(a, b, (c) => {
            B[c * 4] = byte(dx * 127 + 128); B[c * 4 + 1] = byte(dy * 127 + 128); B[c * 4 + 3] = byte(s * 255);
          }));
        },
        sink(x, y, w, h, s) { fill(it.x + x, it.y + y, w, h, (a, b) => cells(a, b, (c) => { B[c * 4 + 2] = byte(s * 255); })); },
      };
      if (t.fields) t.fields(R, it.rot || 0);
      bodyOf(t).forEach((q) => fill(it.x + q[0], it.y + q[1], q[2], q[3], (a, b) => { occ[b * bw + a] = idx + 1; }));
    });
    // solids last so they always win over field regions
    items.forEach((it) => {
      MT.TYPES[it.type].solid.forEach((q) => fill(it.x + q[0], it.y + q[1], q[2], q[3], (a, b) => {
        solidArt[b * bw + a] = 1;
        cells(a, b, (c) => {
          A[c * 4] = 255; A[c * 4 + 2] = 0;
          if (q[4] !== undefined) { A[c * 4 + 1] = byte((q[4] * 0.5 + 0.5) * 255); A[c * 4 + 3] = 255; }
        });
      }));
    });
    return { A, B, occ, solidArt };
  };

  // Can `type` go at (x, y)? Its body must be inside the box and on free pixels.
  MT.canPlace = function (type, x, y, occ, bw, bh) {
    const t = MT.TYPES[type];
    if (x < 0 || y < 0 || x + t.w > bw || y + t.h > bh) return false;
    for (const q of bodyOf(t)) {
      for (let j = 0; j < q[3]; j++) for (let i = 0; i < q[2]; i++) {
        if (occ[(y + q[1] + j) * bw + x + q[0] + i]) return false;
      }
    }
    return true;
  };

  // Topmost item whose bounding box contains the point, or -1.
  MT.itemAt = function (items, x, y) {
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i], t = MT.TYPES[it.type];
      if (x >= it.x && x < it.x + t.w && y >= it.y && y < it.y + t.h) return i;
    }
    return -1;
  };
})(window.MT);
