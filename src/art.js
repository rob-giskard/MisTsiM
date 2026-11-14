// Everything drawn by hand-in-code: palette, tiny font, the room, the glass box.
// All coordinates are art pixels on a 384x216 canvas that is scaled up unsmoothed.
'use strict';
window.MT = window.MT || {};
(function (MT) {
  const W = 384, H = 216;
  const BOX = { x: 60, y: 30, w: 264, h: 124 };   // interior of the glass box
  const BAR_TOP = 10, BAR_BOT = 190;              // letterbox bars

  const PAL = {
    black: '#050606',
    wall: '#3b463e', stripe: '#6f7a60', motif: '#56624e',
    cream: '#c8c9a8', pale: '#8b9172', dim: '#4b5749',
    wood0: '#1a1412', wood1: '#241a18', wood2: '#33241f', wood3: '#4a372d',
    navy: '#1c2733', orange: '#c8742f', ember: '#8c3a22', red: '#8c2f25',
    iron0: '#141816', iron1: '#232826', iron2: '#59645a',
  };

  function r(ctx, c, x, y, w, h) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }

  // 3x5 pixel font, one number (3 bits) per row.
  const GLYPHS = {
    A: [2, 5, 7, 5, 5], B: [6, 5, 6, 5, 6], C: [3, 4, 4, 4, 3], D: [6, 5, 5, 5, 6], E: [7, 4, 6, 4, 7],
    F: [7, 4, 6, 4, 4], G: [3, 4, 5, 5, 3], H: [5, 5, 7, 5, 5], I: [7, 2, 2, 2, 7], J: [1, 1, 1, 5, 2],
    K: [5, 5, 6, 5, 5], L: [4, 4, 4, 4, 7], M: [5, 7, 7, 5, 5], N: [6, 5, 5, 5, 5], O: [2, 5, 5, 5, 2],
    P: [6, 5, 6, 4, 4], Q: [2, 5, 5, 7, 3], R: [6, 5, 6, 5, 5], S: [3, 4, 2, 1, 6], T: [7, 2, 2, 2, 2],
    U: [5, 5, 5, 5, 7], V: [5, 5, 5, 5, 2], W: [5, 5, 7, 7, 5], X: [5, 5, 2, 5, 5], Y: [5, 5, 2, 2, 2],
    Z: [7, 1, 2, 4, 7],
    0: [7, 5, 5, 5, 7], 1: [2, 6, 2, 2, 7], 2: [6, 1, 2, 4, 7], 3: [6, 1, 2, 1, 6], 4: [5, 5, 7, 1, 1],
    5: [7, 4, 6, 1, 6], 6: [3, 4, 7, 5, 7], 7: [7, 1, 2, 2, 2], 8: [7, 5, 7, 5, 7], 9: [7, 5, 7, 1, 6],
    '-': [0, 0, 7, 0, 0], '.': [0, 0, 0, 0, 2], '/': [1, 1, 2, 4, 4],
  };
  function text(ctx, str, x, y, color) {
    ctx.fillStyle = color;
    for (const ch of str) {
      const g = GLYPHS[ch];
      if (g) for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) {
        if (g[j] & (4 >> i)) ctx.fillRect(x + i, y + j, 1, 1);
      }
      x += 4;
    }
  }
  const textWidth = (str) => str.length * 4 - 1;

  const FLEUR = ['...#...', '..###..', '#.###.#', '##.#.##', '.#.#.#.', '..###..', '.#####.', '...#...', '..###..'];

  // Room behind the box. Drawn once.
  function drawRoom(ctx) {
    r(ctx, PAL.black, 0, 0, W, H);
    r(ctx, PAL.wall, 0, BAR_TOP, W, BAR_BOT - BAR_TOP);
    // wallpaper: clusters of thin stripes, a motif on the broad band between them
    for (let x = -8; x < W; x += 24) {
      r(ctx, PAL.stripe, x, BAR_TOP, 2, 160);
      r(ctx, PAL.stripe, x + 3, BAR_TOP, 1, 160);
      r(ctx, PAL.stripe, x + 5, BAR_TOP, 2, 160);
      const col = Math.round((x + 8) / 24);
      for (let y = BAR_TOP + (col % 2 ? 6 : 17); y < 166; y += 22) {
        ctx.fillStyle = PAL.motif;
        FLEUR.forEach((row, j) => { for (let i = 0; i < 7; i++) if (row[i] === '#') ctx.fillRect(x + 12 + i, y + j, 1, 1); });
      }
    }
    // cornice, skirting, floor
    r(ctx, PAL.pale, 0, BAR_TOP, W, 3); r(ctx, '#2a332d', 0, BAR_TOP + 3, W, 1);
    r(ctx, '#7d8468', 0, 170, W, 6); r(ctx, '#a0a684', 0, 170, W, 1); r(ctx, '#4f573f', 0, 175, W, 1);
    r(ctx, PAL.wood0, 0, 176, W, 14);
    for (let x = 14; x < W; x += 47) r(ctx, '#231c18', x, 177, 1, 13);
    r(ctx, '#231c18', 0, 182, W, 1);

    // left: shelf with books. right: a small framed picture.
    r(ctx, PAL.wood1, 10, 86, 36, 2); r(ctx, PAL.wood0, 14, 88, 2, 3); r(ctx, PAL.wood0, 40, 88, 2, 3);
    r(ctx, '#2d3a3a', 13, 83, 17, 3); r(ctx, '#46524a', 14, 80, 15, 3); r(ctx, '#232a36', 13, 77, 16, 3);
    r(ctx, PAL.cream, 13, 84, 1, 1); r(ctx, PAL.cream, 14, 81, 1, 1);
    r(ctx, PAL.orange, 35, 79, 6, 7); r(ctx, PAL.wall, 37, 81, 2, 3); r(ctx, PAL.ember, 35, 85, 6, 1);
    r(ctx, PAL.wood1, 340, 60, 32, 23); r(ctx, PAL.wood3, 340, 60, 32, 1);
    r(ctx, '#5d6650', 343, 63, 26, 17); r(ctx, '#39443c', 343, 73, 26, 7);
    r(ctx, '#39443c', 350, 69, 9, 4); r(ctx, '#39443c', 353, 67, 4, 2); r(ctx, '#2a332d', 361, 71, 6, 2);

    // light: a pale screen glow from off-frame left, warm shadow to the right
    let g = ctx.createRadialGradient(-30, 120, 10, -30, 120, 300);
    g.addColorStop(0, 'rgba(205,225,190,0.34)'); g.addColorStop(1, 'rgba(205,225,190,0)');
    ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = g; ctx.fillRect(0, BAR_TOP, W, 180);
    ctx.globalCompositeOperation = 'source-over';
    g = ctx.createLinearGradient(170, 0, W, 0);
    g.addColorStop(0, 'rgba(46,20,8,0)'); g.addColorStop(1, 'rgba(46,20,8,0.58)');
    ctx.fillStyle = g; ctx.fillRect(0, BAR_TOP, W, 180);
    g = ctx.createLinearGradient(0, BAR_TOP, 0, BAR_TOP + 34);
    g.addColorStop(0, 'rgba(0,0,0,0.4)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, BAR_TOP, W, 34);

    // table
    const b = BOX, tb = b.y + b.h + 4;
    r(ctx, 'rgba(0,0,0,0.28)', b.x - 10, tb + 5, b.w + 20, 8);
    r(ctx, PAL.wood2, b.x - 16, tb, b.w + 32, 3); r(ctx, PAL.wood3, b.x - 16, tb, b.w + 32, 1);
    r(ctx, PAL.wood0, b.x - 10, tb + 3, b.w + 20, 2);
    r(ctx, PAL.wood1, b.x - 8, tb + 3, 3, 26); r(ctx, PAL.wood1, b.x + b.w + 5, tb + 3, 3, 26);
    r(ctx, PAL.wood0, b.x - 6, tb + 3, 1, 26); r(ctx, PAL.wood0, b.x + b.w + 7, tb + 3, 1, 26);

    // glass box: darkened air, iron frame, plinth
    r(ctx, 'rgba(6,12,11,0.42)', b.x, b.y, b.w, b.h);
    r(ctx, PAL.iron0, b.x - 2, b.y - 2, b.w + 4, 2); r(ctx, PAL.iron0, b.x - 2, b.y + b.h, b.w + 4, 2);
    r(ctx, PAL.iron0, b.x - 2, b.y - 2, 2, b.h + 4); r(ctx, PAL.iron0, b.x + b.w, b.y - 2, 2, b.h + 4);
    r(ctx, PAL.iron2, b.x - 2, b.y - 2, b.w + 4, 1); r(ctx, PAL.iron2, b.x - 2, b.y - 2, 1, b.h + 4);
    r(ctx, PAL.iron1, b.x - 4, b.y + b.h + 2, b.w + 8, 2);
    r(ctx, PAL.iron1, b.x + b.w / 2 - 8, b.y - 4, 16, 2); r(ctx, PAL.iron2, b.x + b.w / 2 - 8, b.y - 4, 16, 1);
  }

  // Glass reflections, vignette and letterbox: drawn over the mist.
  function drawFront(ctx) {
    ctx.clearRect(0, 0, W, H);
    const b = BOX;
    const band = (x0, w, a) => {
      ctx.fillStyle = 'rgba(205,228,208,' + a + ')';
      for (let j = 0; j < b.h; j++) {
        const x = Math.round(x0 - j * 0.55);
        const l = Math.max(x, b.x), rr = Math.min(x + w, b.x + b.w);
        if (rr > l) ctx.fillRect(l, b.y + j, rr - l, 1);
      }
    };
    band(b.x + 62, 20, 0.05); band(b.x + 90, 5, 0.06); band(b.x + 262, 12, 0.03);
    r(ctx, 'rgba(205,228,208,0.12)', b.x, b.y, 1, b.h);
    r(ctx, 'rgba(205,228,208,0.07)', b.x, b.y, b.w, 1);
    const g = ctx.createRadialGradient(W / 2, H / 2, 110, W / 2, H / 2, 235);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    r(ctx, PAL.black, 0, 0, W, BAR_TOP); r(ctx, PAL.black, 0, BAR_BOT, W, H - BAR_BOT);
  }

  MT.ART = { W, H, BOX, BAR_TOP, BAR_BOT, PAL, r, text, textWidth, drawRoom, drawFront };
})(window.MT);
