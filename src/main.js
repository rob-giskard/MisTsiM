// Glue: input, the 1-9 bar, droplets, and the frame loop.
'use strict';
(function (MT) {
  const { W, H, BOX, BAR_BOT, PAL, r, text, textWidth } = MT.ART;
  const K = 2;                               // sim cells per art pixel
  const bw = BOX.w, bh = BOX.h;

  const stage = document.getElementById('stage');
  const glCanvas = document.getElementById('gl');
  const uiCanvas = document.getElementById('ui');
  glCanvas.width = uiCanvas.width = W;
  glCanvas.height = uiCanvas.height = H;
  const ui = uiCanvas.getContext('2d');

  const gl = MT.createGL(glCanvas);
  if (!gl) {
    stage.style.display = 'none';
    document.getElementById('err').style.display = 'flex';
    return;
  }

  const sim = new MT.Sim(gl, bw * K, bh * K);
  const composite = MT.program(gl, MT.SHADERS.composite);
  const sceneTex = MT.texture(gl, W, H, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, gl.NEAREST);
  const frontTex = MT.texture(gl, W, H, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, gl.NEAREST);

  function canvas2d() {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    return c.getContext('2d');
  }
  function upload(tex, ctx) {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ctx.canvas);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }
  const room = canvas2d(), scene = canvas2d(), front = canvas2d();
  MT.ART.drawRoom(room);
  MT.ART.drawFront(front);
  upload(frontTex, front);

  // ---- state ---------------------------------------------------------------
  const items = [{ type: 0, x: 126, y: bh - 6, rot: 0 }];   // the box comes with one mister
  let masks = null;
  let selected = 1, rot = 0;
  const mouse = { x: -1, y: -1, down: 0 };
  const lights = new Float32Array(64);
  let numLights = 0;
  const drops = [];
  const wet = new Float32Array(bw * bh);

  function rebuild() {
    masks = MT.rasterize(items, bw, bh, K);
    sim.setObjects(masks.A, masks.B);
    scene.drawImage(room.canvas, 0, 0);
    numLights = 0;
    for (const it of items) {
      const t = MT.TYPES[it.type];
      t.draw(scene, BOX.x + it.x, BOX.y + it.y, it.rot || 0);
      if (t.light && numLights < 16) {
        lights.set([BOX.x + it.x + t.light.x + 0.5, H - (BOX.y + it.y + t.light.y + 0.5), t.light.i, t.light.kind], numLights * 4);
        numLights++;
      }
    }
    upload(sceneTex, scene);
    // water that was resting on something that is gone
    for (let y = 0; y < bh - 1; y++) for (let x = 0; x < bw; x++) {
      if (!masks.solidArt[(y + 1) * bw + x]) wet[y * bw + x] = 0;
    }
  }

  // ---- placing and removing -----------------------------------------------
  const BAR = { x: 86, y: 192, w: 20, h: 22, gap: 4 };
  const inBox = () => mouse.x >= BOX.x && mouse.x < BOX.x + bw && mouse.y >= BOX.y && mouse.y < BOX.y + bh;
  function slotAt(x, y) {
    if (y < BAR.y || y >= BAR.y + BAR.h) return -1;
    const i = Math.floor((x - BAR.x) / (BAR.w + BAR.gap));
    return i >= 0 && i < 9 && x - BAR.x - i * (BAR.w + BAR.gap) < BAR.w ? i : -1;
  }
  function placePos() {
    const t = MT.TYPES[selected], sx = t.snapX || 1, sy = t.snapY || 1;
    let x = Math.round((mouse.x - BOX.x - t.w / 2) / sx) * sx;
    let y = Math.round((mouse.y - BOX.y - t.h / 2) / sy) * sy;
    x = Math.max(0, Math.min(bw - t.w, x));
    y = Math.max(0, Math.min(bh - t.h, y));
    return { x, y, ok: MT.canPlace(selected, x, y, masks.occ, bw, bh) };
  }
  function tryPlace() {
    if (!inBox()) return;
    const p = placePos();
    if (!p.ok) return;
    items.push({ type: selected, x: p.x, y: p.y, rot: MT.TYPES[selected].turns ? rot : 0 });
    rebuild();
  }
  function tryRemove() {
    if (!inBox()) return false;
    const i = MT.itemAt(items, mouse.x - BOX.x, mouse.y - BOX.y);
    if (i < 0) return false;
    items.splice(i, 1);
    rebuild();
    return true;
  }

  function setMouse(e) {
    const q = stage.getBoundingClientRect();
    mouse.x = Math.floor((e.clientX - q.left) / q.width * W);
    mouse.y = Math.floor((e.clientY - q.top) / q.height * H);
  }
  stage.addEventListener('pointerdown', (e) => {
    setMouse(e);
    stage.setPointerCapture(e.pointerId);
    const s = slotAt(mouse.x, mouse.y);
    if (s >= 0) { selected = s; return; }
    if (e.pointerType === 'touch') { if (!tryRemove()) tryPlace(); return; }   // tap toggles
    if (e.button === 0) { mouse.down = 1; tryPlace(); }
    if (e.button === 2) { mouse.down = 2; tryRemove(); }
  });
  stage.addEventListener('pointermove', (e) => {
    setMouse(e);
    if (mouse.down === 1 && MT.TYPES[selected].paint) tryPlace();
    if (mouse.down === 2) tryRemove();
  });
  const release = () => { mouse.down = 0; };
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);
  stage.addEventListener('pointerleave', () => { if (!mouse.down) mouse.x = mouse.y = -1; });
  stage.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('keydown', (e) => {
    if (e.key >= '1' && e.key <= '9') selected = +e.key - 1;
    if (e.key === 'r' || e.key === 'R') rot = (rot + 1) % 4;
  });
  window.addEventListener('wheel', (e) => { selected = (selected + (e.deltaY > 0 ? 1 : 8)) % 9; }, { passive: true });

  function resize() {
    let s = Math.min(window.innerWidth / W, window.innerHeight / H);
    if (s >= 1) s = Math.floor(s);            // whole-number scale keeps pixels square
    stage.style.width = W * s + 'px';
    stage.style.height = H * s + 'px';
  }
  window.addEventListener('resize', resize);
  resize();

  // ---- droplets (rule 6, the visible half) ----------------------------------
  const SPAWN = 0.06;
  function spawnDrops() {
    const buf = sim.readPrecip(), pw = sim.pw, ph = sim.ph, cell = 8 / K;
    for (let j = 0; j < ph; j++) for (let i = 0; i < pw; i++) {
      const b = buf[(j * pw + i) * 4];
      if (!b || Math.random() > b / 255 * SPAWN || drops.length > 400) continue;
      const x = Math.floor((i + Math.random()) * cell);
      const y = bh - 1 - Math.floor((j + Math.random()) * cell);
      if (x < 0 || x >= bw || y < 0 || y >= bh || masks.solidArt[y * bw + x]) continue;
      drops.push({ x, y, vy: 0.2 });
    }
  }
  function moveDrops() {
    for (let n = drops.length - 1; n >= 0; n--) {
      const d = drops[n];
      d.vy = Math.min(d.vy + 0.05, 1.6);
      const to = d.y + d.vy;
      let landed = false;
      for (let row = Math.floor(d.y) + 1; row <= Math.floor(to); row++) {
        if (row >= bh || masks.solidArt[row * bw + d.x]) {
          const k = (row - 1) * bw + d.x;
          wet[k] = Math.min(1, wet[k] + 0.7);
          landed = true;
          break;
        }
      }
      if (landed) drops.splice(n, 1); else d.y = to;
    }
    for (let i = 0; i < wet.length; i++) if (wet[i] > 0) wet[i] = wet[i] < 0.02 ? 0 : wet[i] * 0.997;
  }

  // ---- drawing -------------------------------------------------------------
  function drawUI() {
    ui.clearRect(0, 0, W, H);
    for (let i = 0; i < wet.length; i++) {
      if (wet[i] > 0) r(ui, 'rgba(175,205,195,' + (wet[i] * 0.55).toFixed(2) + ')', BOX.x + i % bw, BOX.y + (i / bw | 0), 1, 1);
    }
    ui.fillStyle = 'rgba(205,228,218,0.75)';
    for (const d of drops) ui.fillRect(BOX.x + d.x, BOX.y + Math.floor(d.y) - 1, 1, 2);

    const t = MT.TYPES[selected];
    if (inBox() && slotAt(mouse.x, mouse.y) < 0) {
      const p = placePos();
      ui.globalAlpha = p.ok ? 0.6 : 0.22;
      t.draw(ui, BOX.x + p.x, BOX.y + p.y, t.turns ? rot : 0);
      ui.globalAlpha = 1;
      if (!p.ok) {
        const x0 = BOX.x + p.x - 1, y0 = BOX.y + p.y - 1, x1 = x0 + t.w + 1, y1 = y0 + t.h + 1;
        for (const [cx, cy] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) r(ui, PAL.red, cx, cy, 1, 1);
      }
    }

    for (let i = 0; i < 9; i++) {
      const x = BAR.x + i * (BAR.w + BAR.gap), y = BAR.y, on = i === selected, ty = MT.TYPES[i];
      r(ui, on ? PAL.cream : '#2a332d', x, y, BAR.w, BAR.h);
      r(ui, '#0b0e0d', x + 1, y + 1, BAR.w - 2, BAR.h - 2);
      text(ui, String(i + 1), x + 2, y + 2, on ? PAL.cream : PAL.stripe);
      ui.globalAlpha = on ? 1 : 0.7;
      ty.draw(ui, x + ((BAR.w - ty.w) >> 1), y + 8 + ((12 - ty.h) >> 1), i === 3 ? rot : 0);
      ui.globalAlpha = 1;
    }
    text(ui, t.name, BAR.x - 6 - textWidth(t.name), BAR.y + 5, PAL.pale);
    if (t.turns) text(ui, 'R TURNS', BAR.x - 6 - textWidth('R TURNS'), BAR.y + 13, PAL.dim);
    const hx = BAR.x + 9 * (BAR.w + BAR.gap) + 2;
    text(ui, 'LMB PLACE', hx, BAR.y + 5, PAL.dim);
    text(ui, 'RMB REMOVE', hx, BAR.y + 13, PAL.dim);

    if (mouse.x >= 0) {
      ui.fillStyle = PAL.cream;
      ui.fillRect(mouse.x - 2, mouse.y, 2, 1); ui.fillRect(mouse.x + 1, mouse.y, 2, 1);
      ui.fillRect(mouse.x, mouse.y - 2, 1, 2); ui.fillRect(mouse.x, mouse.y + 1, 1, 2);
    }
  }

  function render() {
    MT.pass(gl, composite, null, {
      uScene: sceneTex, uFront: frontTex, uSca: sim.scalarTex(), uObjA: sim.objATex(),
      uRes: [W, H], uBox: [BOX.x, H - (BOX.y + bh), bw, bh],
      uLights: lights, uNumLights: numLights,
      uDens: 2.2, uShadow: 0.35, uLevels: 7,
    });
    drawUI();
  }

  let frame = 0;
  function step() {
    sim.step();
    if (++frame % 4 === 0) spawnDrops();
    moveDrops();
  }

  rebuild();
  let last = performance.now(), acc = 0;
  function tick(now) {
    acc += Math.min(now - last, 50);
    last = now;
    let n = 0;
    while (acc >= 16.6 && n < 2) { step(); acc -= 16.6; n++; }   // 60 steps/s on any display
    if (acc >= 16.6) acc = 0;
    render();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // For the console and for tests.
  MT.debug = {
    sim, items, drops,
    place(type, x, y, r0) { items.push({ type, x, y, rot: r0 || 0 }); rebuild(); },
    clear() { items.length = 0; rebuild(); },
    run(n) { for (let i = 0; i < n; i++) step(); render(); },
  };
})(window.MT);
