// Minimal WebGL2 plumbing: programs, render targets, fullscreen passes.
'use strict';
window.MT = window.MT || {};
(function (MT) {
  const VS = `#version 300 es
in vec2 a; out vec2 uv;
void main(){ uv = a*.5+.5; gl_Position = vec4(a,0.,1.); }`;

  MT.createGL = function (canvas) {
    const gl = canvas.getContext('webgl2', {
      alpha: false, antialias: false, depth: false, stencil: false,
      premultipliedAlpha: false, powerPreference: 'low-power',
    });
    if (!gl) return null;
    if (!gl.getExtension('EXT_color_buffer_float') &&
        !gl.getExtension('EXT_color_buffer_half_float')) return null;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.disable(gl.BLEND);
    return gl;
  };

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(s) + '\n' + src);
    }
    return s;
  }

  MT.program = function (gl, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'a');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const uniforms = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      const name = info.name.replace(/\[0\]$/, '');
      uniforms[name] = { loc: gl.getUniformLocation(p, info.name), type: info.type };
    }
    return { p, uniforms };
  };

  // target: {fbo,w,h} or null for the canvas. values: {uniformName: number|array|texture}
  MT.pass = function (gl, prog, target, values) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
    gl.viewport(0, 0, target ? target.w : gl.drawingBufferWidth, target ? target.h : gl.drawingBufferHeight);
    gl.useProgram(prog.p);
    let unit = 0;
    for (const name in values) {
      const u = prog.uniforms[name];
      if (!u) continue;
      const v = values[name];
      switch (u.type) {
        case gl.SAMPLER_2D:
          gl.activeTexture(gl.TEXTURE0 + unit);
          gl.bindTexture(gl.TEXTURE_2D, v);
          gl.uniform1i(u.loc, unit++);
          break;
        case gl.FLOAT: gl.uniform1f(u.loc, v); break;
        case gl.INT: gl.uniform1i(u.loc, v); break;
        case gl.FLOAT_VEC2: gl.uniform2fv(u.loc, v); break;
        case gl.FLOAT_VEC3: gl.uniform3fv(u.loc, v); break;
        case gl.FLOAT_VEC4: gl.uniform4fv(u.loc, v); break;
      }
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  MT.texture = function (gl, w, h, internal, format, type, filter, data) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data || null);
    return tex;
  };

  MT.target = function (gl, w, h, internal, format, type, filter) {
    const tex = MT.texture(gl, w, h, internal, format, type, filter);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return { tex, fbo, w, h };
  };

  MT.double = function (gl, w, h, internal, format, type, filter) {
    const d = {
      read: MT.target(gl, w, h, internal, format, type, filter),
      write: MT.target(gl, w, h, internal, format, type, filter),
      swap() { const t = d.read; d.read = d.write; d.write = t; },
    };
    return d;
  };
})(window.MT);
