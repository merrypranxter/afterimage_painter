// FBO feedback adaptation buffer.
//
// Models retinal cone bleaching: a per-pixel RGB accumulator that
// rises while a brush burns color into it and relaxes back to zero
// over a slow, tunable time constant. The afterimage shown to the
// user is the optical complement of this buffer's current value.

import { createPingPongFBO } from './gl-utils.js';

// Tuning constants, see docs/math-reference.md for derivation.
export const TAU_MIN = 2; // seconds, fastest recovery
export const TAU_MAX = 30; // seconds, slowest recovery (long stare)
export const TAU_DEFAULT = 8;
export const TAU_STEP = 1; // change per arrow-key press
export const BURN_RATE = 1.6; // accumulation gain while actively painting

export function createAdaptationBuffer(gl, width, height) {
  return createPingPongFBO(gl, width, height);
}

// exp(-dt/tau): the per-frame multiplicative decay factor handed to
// adaptation.frag as uDecay. Computing it on the CPU keeps the
// fragment shader a single multiply-and-clamp.
export function decayFactor(tau, dt) {
  return Math.exp(-dt / tau);
}

export function clampTau(tau) {
  return Math.min(TAU_MAX, Math.max(TAU_MIN, tau));
}
