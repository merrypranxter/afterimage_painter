// Shared WebGL2 helpers: shader/program compilation, geometry, and
// the generic ping-pong FBO factory used by both the paint and
// adaptation (bleach) buffers.

export function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error:\n${info}`);
  }
  return shader;
}

export function createProgram(gl, vsSource, fsSource) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link error:\n${info}`);
  }
  return program;
}

export async function fetchProgram(gl, vertUrl, fragUrl) {
  const [vsSource, fsSource] = await Promise.all([
    fetch(vertUrl).then((r) => r.text()),
    fetch(fragUrl).then((r) => r.text()),
  ]);
  return createProgram(gl, vsSource, fsSource);
}

export function uniformLocations(gl, program, names) {
  const out = {};
  for (const name of names) out[name] = gl.getUniformLocation(program, name);
  return out;
}

// Fullscreen quad: two triangles covering clip space, with a matching
// 0..1 UV. Used by every full-buffer simulation/composite pass.
export function createFullscreenQuad(gl) {
  const positions = new Float32Array([
    -1, -1, 1, -1, -1, 1,
    -1, 1, 1, -1, 1, 1,
  ]);
  const uvs = new Float32Array([
    0, 0, 1, 0, 0, 1,
    0, 1, 1, 0, 1, 1,
  ]);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const posBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const uvBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
  gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);

  gl.bindVertexArray(null);
  return { vao, count: 6 };
}

// Unit quad in [-1,1], reused for the brush stamp. The vertex shader
// scales/positions it per-stamp via uCenter/uRadius uniforms.
export function createUnitQuad(gl) {
  const positions = new Float32Array([
    -1, -1, 1, -1, -1, 1,
    -1, 1, 1, -1, 1, 1,
  ]);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  return { vao, count: 6 };
}

// Picks the best renderable color format available: half-float when
// EXT_color_buffer_float is present (smoother decay, no banding),
// falling back to plain RGBA8 on older/mobile GPUs.
export function pickBufferFormat(gl) {
  const floatExt = gl.getExtension('EXT_color_buffer_float');
  if (floatExt) {
    return { internalFormat: gl.RGBA16F, format: gl.RGBA, type: gl.HALF_FLOAT };
  }
  return { internalFormat: gl.RGBA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE };
}

function createTarget(gl, width, height, fmt) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, fmt.internalFormat, width, height, 0, fmt.format, fmt.type, null);
  // NEAREST + CLAMP_TO_EDGE: simulation buffers must not blur/wrap state.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { tex, fbo };
}

// Generic ping-pong feedback buffer: two equal targets, `read` always
// points at the most recently written one. swap() flips the pair after
// a pass renders into `write`.
export function createPingPongFBO(gl, width, height, fmt = pickBufferFormat(gl)) {
  let a = createTarget(gl, width, height, fmt);
  let b = createTarget(gl, width, height, fmt);

  const state = {
    fmt,
    get read() { return a; },
    get write() { return b; },
    swap() {
      const tmp = a;
      a = b;
      b = tmp;
    },
    clear(gl) {
      for (const target of [a, b]) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    },
    resize(gl, w, h) {
      gl.deleteTexture(a.tex);
      gl.deleteFramebuffer(a.fbo);
      gl.deleteTexture(b.tex);
      gl.deleteFramebuffer(b.fbo);
      a = createTarget(gl, w, h, fmt);
      b = createTarget(gl, w, h, fmt);
    },
  };
  return state;
}
