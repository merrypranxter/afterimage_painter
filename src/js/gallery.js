// Named gallery regimes: pre-burned patterns chosen for maximum
// afterimage effect, cycled with the `G` key. Each preset is pure
// data + logic decoupled from GL state — it only calls the `stamp`
// callback it's given, so it can be unit-tested or reused headless
// (see examples/gallery-headless.js).
//
// `apply(stamp)` fires once when a static preset becomes active.
// `tick(stamp, t, dt)` is called every frame for presets that need
// continuous animation (Successive Contrast's color flicker).

import { PALETTE } from './complementary.js';

// x, y, w, h are the rect's top-left corner and size as fractions of
// canvas width/height. The brush stamp itself is centered, so we
// offset by half the size.
function rectStamp(stamp, x, y, w, h, color) {
  stamp({
    x: x + w / 2,
    y: y + h / 2,
    rectWidth: w / 2,
    rectHeight: h / 2,
    color,
    shape: 1,
    strength: 1,
    target: 'both',
  });
}

const mondrian = {
  name: 'Mondrian',
  apply(stamp) {
    rectStamp(stamp, 0.18, 0.25, 0.3, 0.3, PALETTE[0]); // red block
    rectStamp(stamp, 0.55, 0.2, 0.35, 0.18, PALETTE[2]); // blue block
    rectStamp(stamp, 0.7, 0.6, 0.22, 0.3, PALETTE[5]); // yellow block
    rectStamp(stamp, 0.3, 0.68, 0.28, 0.2, PALETTE[1]); // green block
  },
};

const spiral = {
  name: 'Spiral',
  apply(stamp) {
    const turns = 4;
    const steps = 140;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const angle = t * turns * Math.PI * 2;
      const r = 0.04 + t * 0.42;
      const color = PALETTE[i % PALETTE.length];
      stamp({
        x: 0.5 + Math.cos(angle) * r,
        y: 0.5 + Math.sin(angle) * r,
        radius: 0.02 + t * 0.025,
        color,
        shape: 0,
        strength: 1,
        target: 'both',
      });
    }
  },
};

const troxler = {
  name: 'Troxler',
  apply(stamp) {
    // Saturated surround field with a small neutral fixation dot.
    const ringSteps = 24;
    for (let i = 0; i < ringSteps; i++) {
      const angle = (i / ringSteps) * Math.PI * 2;
      stamp({
        x: 0.5 + Math.cos(angle) * 0.3,
        y: 0.5 + Math.sin(angle) * 0.3,
        radius: 0.16,
        color: PALETTE[3],
        shape: 0,
        strength: 0.9,
        target: 'adapt',
      });
    }
    stamp({ x: 0.5, y: 0.5, radius: 0.015, color: [1, 1, 1], shape: 0, strength: 1, target: 'paint' });
  },
};

const successiveContrast = {
  name: 'Successive Contrast',
  flickerInterval: 0.35, // seconds between color swaps
  _accum: 0,
  _index: 0,
  apply() {
    this._accum = 0;
    this._index = 0;
  },
  tick(stamp, t, dt) {
    this._accum += dt;
    if (this._accum < this.flickerInterval) return;
    this._accum = 0;
    this._index = (this._index + 1) % PALETTE.length;
    stamp({
      x: 0.5,
      y: 0.5,
      radius: 0.3,
      color: PALETTE[this._index],
      shape: 0,
      strength: 1,
      target: 'both',
    });
  },
};

const complementaryMix = {
  name: 'Complementary Mix',
  apply(stamp) {
    stamp({ x: 0.38, y: 0.5, radius: 0.22, color: PALETTE[0], shape: 0, strength: 1, target: 'both' });
    stamp({ x: 0.62, y: 0.5, radius: 0.22, color: PALETTE[3], shape: 0, strength: 1, target: 'both' });
  },
};

// Index 0 is "Free Paint" — gallery mode off, normal brush painting.
export const PRESETS = [null, mondrian, spiral, troxler, successiveContrast, complementaryMix];

export function presetName(index) {
  return PRESETS[index] ? PRESETS[index].name : 'Free Paint';
}
