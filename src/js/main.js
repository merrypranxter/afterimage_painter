// Afterimage painter renderer and brush logic.
//
// Pipeline per frame:
//   1. decay.frag relaxes the paint ("ink") buffer on a fast timescale
//   2. adaptation.frag relaxes the adaptation ("bleach") buffer on a
//      slow, user-tunable timescale
//   3. live brush input (or an active gallery preset) stamps fresh
//      color additively into both buffers
//   4. afterimage.frag composites paint + the complement of the
//      adaptation buffer to the screen
//
// The canvas is the eye: nothing is drawn directly, every pixel is
// simulation state read back and inverted.

import { createFullscreenQuad, createUnitQuad, createProgram, uniformLocations } from './gl-utils.js';
import { createAdaptationBuffer, decayFactor, clampTau, TAU_DEFAULT, TAU_STEP, BURN_RATE } from './adaptation.js';
import { PaletteCycler } from './complementary.js';
import { PRESETS, presetName } from './gallery.js';

const PAINT_TAU = 1.4; // seconds, fast ink fade
const STAMP_SPACING_FACTOR = 0.35; // fraction of brush radius between interpolated stamps
const BRUSH_RADIUS = 0.045; // normalized to canvas height

async function loadText(url) {
  const res = await fetch(url);
  return res.text();
}

async function main() {
  const canvas = document.getElementById('gl');
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false });
  if (!gl) {
    document.body.textContent = 'WebGL2 is required for afterimage_painter.';
    return;
  }
  gl.getExtension('EXT_color_buffer_float');

  const [fullscreenVert, decayFrag, adaptationFrag, brushVert, brushFrag, afterimageFrag] = await Promise.all([
    loadText('src/shaders/fullscreen.vert'),
    loadText('src/shaders/decay.frag'),
    loadText('src/shaders/adaptation.frag'),
    loadText('src/shaders/brush.vert'),
    loadText('src/shaders/brush.frag'),
    loadText('src/shaders/afterimage.frag'),
  ]);

  const decayProgram = createProgram(gl, fullscreenVert, decayFrag);
  const adaptationProgram = createProgram(gl, fullscreenVert, adaptationFrag);
  const compositeProgram = createProgram(gl, fullscreenVert, afterimageFrag);
  const brushProgram = createProgram(gl, brushVert, brushFrag);

  const decayUniforms = uniformLocations(gl, decayProgram, ['uPrev', 'uDecay']);
  const adaptationUniforms = uniformLocations(gl, adaptationProgram, ['uPrev', 'uDecay']);
  const compositeUniforms = uniformLocations(gl, compositeProgram, ['uPaint', 'uAdapt']);
  const brushUniforms = uniformLocations(gl, brushProgram, ['uCenter', 'uHalfSize', 'uColor', 'uStrength', 'uShape']);

  const fullscreenQuad = createFullscreenQuad(gl);
  const brushQuad = createUnitQuad(gl);

  let width = 0;
  let height = 0;
  let paint = null;
  let adapt = null;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (w === width && h === height) return;
    width = w;
    height = h;
    canvas.width = width;
    canvas.height = height;
    if (!paint) {
      paint = createAdaptationBuffer(gl, width, height); // same ping-pong shape as adapt
      adapt = createAdaptationBuffer(gl, width, height);
    } else {
      paint.resize(gl, width, height);
      adapt.resize(gl, width, height);
    }
  }

  window.addEventListener('resize', resize);
  resize();

  // --- input state -------------------------------------------------
  const palette = new PaletteCycler();
  let isPainting = false;
  let pointerUV = { x: 0.5, y: 0.5 };
  let lastStampUV = null;
  let adaptTau = TAU_DEFAULT;
  let galleryIndex = 0; // 0 = Free Paint

  function uvFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = 1 - (e.clientY - rect.top) / rect.height;
    return { x, y };
  }

  canvas.addEventListener('pointerdown', (e) => {
    isPainting = true;
    pointerUV = uvFromEvent(e);
    lastStampUV = null;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    pointerUV = uvFromEvent(e);
  });
  window.addEventListener('pointerup', () => {
    isPainting = false;
    lastStampUV = null;
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      paint.clear(gl);
      adapt.clear(gl);
    } else if (e.code === 'KeyC') {
      palette.next();
    } else if (e.code === 'KeyG') {
      galleryIndex = (galleryIndex + 1) % PRESETS.length;
      const preset = PRESETS[galleryIndex];
      if (preset && preset.apply) preset.apply(stamp);
      console.info(`gallery: ${presetName(galleryIndex)}`);
    } else if (e.code === 'ArrowUp') {
      adaptTau = clampTau(adaptTau + TAU_STEP);
    } else if (e.code === 'ArrowDown') {
      adaptTau = clampTau(adaptTau - TAU_STEP);
    }
  });

  // --- stamping ------------------------------------------------------
  // target: 'paint' | 'adapt' | 'both'
  // `radius` (normalized to canvas height) draws a round/square stamp.
  // `width`/`height` (normalized to canvas width/height respectively)
  // override it to draw a true axis-aligned rectangle, used by the
  // Mondrian gallery preset.
  function stamp({ x, y, radius = BRUSH_RADIUS, rectWidth, rectHeight, color, shape = 0, strength = 1, target = 'both' }) {
    const halfSize = rectWidth !== undefined
      ? [rectWidth, rectHeight]
      : [radius / (width / height), radius];

    gl.viewport(0, 0, width, height);
    gl.useProgram(brushProgram);
    gl.bindVertexArray(brushQuad.vao);
    gl.uniform2f(brushUniforms.uCenter, x, y);
    gl.uniform2fv(brushUniforms.uHalfSize, halfSize);
    gl.uniform3fv(brushUniforms.uColor, color);
    gl.uniform1f(brushUniforms.uStrength, strength);
    gl.uniform1i(brushUniforms.uShape, shape);

    gl.enable(gl.BLEND);

    if (target === 'paint' || target === 'both') {
      gl.bindFramebuffer(gl.FRAMEBUFFER, paint.read.fbo);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.TRIANGLES, 0, brushQuad.count);
    }
    if (target === 'adapt' || target === 'both') {
      gl.bindFramebuffer(gl.FRAMEBUFFER, adapt.read.fbo);
      gl.blendFunc(gl.ONE, gl.ONE); // additive: burns deepen with repeated passes
      gl.uniform1f(brushUniforms.uStrength, strength * BURN_RATE * 0.12);
      gl.drawArrays(gl.TRIANGLES, 0, brushQuad.count);
    }

    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  function paintStroke(dt) {
    if (!isPainting) return;
    const color = palette.color;
    if (!lastStampUV) {
      stamp({ x: pointerUV.x, y: pointerUV.y, color, target: 'both' });
      lastStampUV = { ...pointerUV };
      return;
    }
    const dx = pointerUV.x - lastStampUV.x;
    const dy = pointerUV.y - lastStampUV.y;
    const dist = Math.hypot(dx, dy);
    const spacing = BRUSH_RADIUS * STAMP_SPACING_FACTOR;
    const steps = Math.floor(dist / spacing);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      stamp({ x: lastStampUV.x + dx * t, y: lastStampUV.y + dy * t, color, target: 'both' });
    }
    if (steps > 0) lastStampUV = { ...pointerUV };
  }

  // --- render loop -----------------------------------------------------
  let lastTime = performance.now();

  function runDecayPass(pp, program, uniforms, decay) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, pp.write.fbo);
    gl.viewport(0, 0, width, height);
    gl.useProgram(program);
    gl.bindVertexArray(fullscreenQuad.vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, pp.read.tex);
    gl.uniform1i(uniforms.uPrev, 0);
    gl.uniform1f(uniforms.uDecay, decay);
    gl.drawArrays(gl.TRIANGLES, 0, fullscreenQuad.count);
    pp.swap();
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    runDecayPass(paint, decayProgram, decayUniforms, decayFactor(PAINT_TAU, dt));
    runDecayPass(adapt, adaptationProgram, adaptationUniforms, decayFactor(adaptTau, dt));

    paintStroke(dt);

    const activePreset = PRESETS[galleryIndex];
    if (activePreset && activePreset.tick) activePreset.tick(stamp, now / 1000, dt);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.useProgram(compositeProgram);
    gl.bindVertexArray(fullscreenQuad.vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, paint.read.tex);
    gl.uniform1i(compositeUniforms.uPaint, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, adapt.read.tex);
    gl.uniform1i(compositeUniforms.uAdapt, 1);
    gl.drawArrays(gl.TRIANGLES, 0, fullscreenQuad.count);

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

main();
