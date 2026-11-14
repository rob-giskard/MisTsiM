// The mist simulation: a small GPU fluid solver. See docs/DESIGN.md for the model.
'use strict';
window.MT = window.MT || {};
(function (MT) {
  // Every tunable in one place. Units: cells and steps (60 steps per second).
  MT.PARAMS = {
    pressureIters: 20,
    // air
    uBuoyT: 0.014,   // lift per unit of warmth
    uBuoyM: 0.0015,   // weight per unit of mist
    uFan: 1.6,       // fan target speed
    uDamp: 0.999,
    uVmax: 4,
    uVort: 0.06,
    uSettle: 0.04,   // droplet fall speed relative to the air
    // diffusion
    uDm: 0.04, uDt: 0.06, uDv: 0.06,
    uSurfK: 2.0,     // extra conduction from heater / cooler surfaces
    uSurfT: 1.0,
    uWallT: 0.5,     // conduction into the glass
    // water: saturation = uS0 + uS1 * T
    uS0: 0.30, uS1: 0.40,
    uRc: 0.2,        // condensation rate
    uRe: 0.02,       // evaporation rate
    uLat: 0.05,      // latent heat
    uKp: 0.02, uMcrit: 1.2,   // coalescence into drops above a critical density
    uKs: 0.002,      // collection on any surface
    uKc: 0.02,       // collection on cold surfaces
    uKg: 0.0008,     // loss on the front/back panes
    uKv: 0.0001, uVamb: 0.29,
    uKt: 0.0008,     // heat loss through the panes
    uEmit: 0.25, uEmitT: -0.05,
    uSink: 0.08,
    uGain: 100,      // precipitation read-back scale
  };

  MT.Sim = function (gl, w, h) {
    const S = MT.SHADERS, P = MT.PARAMS;
    const HF = gl.HALF_FLOAT;
    const px = [1 / w, 1 / h];
    const prog = {};
    for (const k in S) if (k !== 'composite') prog[k] = MT.program(gl, S[k]);

    const vel = MT.double(gl, w, h, gl.RG16F, gl.RG, HF, gl.LINEAR);
    const sca = MT.double(gl, w, h, gl.RGBA16F, gl.RGBA, HF, gl.LINEAR);
    const prs = MT.double(gl, w, h, gl.R16F, gl.RED, HF, gl.NEAREST);
    const div = MT.target(gl, w, h, gl.R16F, gl.RED, HF, gl.NEAREST);
    const curl = MT.target(gl, w, h, gl.R16F, gl.RED, HF, gl.NEAREST);
    const pw = Math.ceil(w / 8), ph = Math.ceil(h / 8);
    const precip = MT.target(gl, pw, ph, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.NEAREST);
    const precipBuf = new Uint8Array(pw * ph * 4);

    const objA = MT.texture(gl, w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.NEAREST);
    const objB = MT.texture(gl, w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.NEAREST);

    // start with still, slightly humid room-temperature air
    gl.bindFramebuffer(gl.FRAMEBUFFER, sca.read.fbo);
    gl.clearColor(0, 0, P.uVamb, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    let seed = 0;
    const U = (extra) => Object.assign({ px, uObjA: objA }, P, extra);

    this.w = w; this.h = h; this.pw = pw; this.ph = ph;

    this.setObjects = function (a, b) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.bindTexture(gl.TEXTURE_2D, objA);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, a);
      gl.bindTexture(gl.TEXTURE_2D, objB);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, b);
    };

    this.step = function () {
      seed = (seed + 0.618) % 10;
      MT.pass(gl, prog.advectVel, vel.write, U({ uVel: vel.read.tex, uSca: sca.read.tex, uObjB: objB }));
      vel.swap();
      MT.pass(gl, prog.curl, curl, U({ uVel: vel.read.tex }));
      MT.pass(gl, prog.vorticity, vel.write, U({ uVel: vel.read.tex, uCurl: curl.tex }));
      vel.swap();
      MT.pass(gl, prog.divergence, div, U({ uVel: vel.read.tex }));
      for (let i = 0; i < P.pressureIters; i++) {
        MT.pass(gl, prog.jacobi, prs.write, U({ uP: prs.read.tex, uDiv: div.tex }));
        prs.swap();
      }
      MT.pass(gl, prog.gradient, vel.write, U({ uP: prs.read.tex, uVel: vel.read.tex }));
      vel.swap();
      MT.pass(gl, prog.advectSca, sca.write, U({ uVel: vel.read.tex, uSca: sca.read.tex }));
      sca.swap();
      MT.pass(gl, prog.update, sca.write, U({ uSca: sca.read.tex, uObjB: objB, uSeed: seed }));
      sca.swap();
    };

    // Returns bytes (RGBA, R used), pw x ph, row 0 = bottom of the box.
    this.readPrecip = function () {
      MT.pass(gl, prog.precip, precip, { uSca: sca.read.tex, px, uGain: P.uGain });
      gl.readPixels(0, 0, pw, ph, gl.RGBA, gl.UNSIGNED_BYTE, precipBuf);
      return precipBuf;
    };

    this.scalarTex = () => sca.read.tex;
    this.objATex = () => objA;
  };
})(window.MT);
