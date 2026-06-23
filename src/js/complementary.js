// Opponent color channel inversion.
//
// The painter uses the simple additive-RGB complement (1 - c), which
// maps red<->cyan, green<->magenta, blue<->yellow exactly as named in
// the README. The GPU recomputes this per pixel in afterimage.frag;
// this module is the CPU-side reference used for the brush palette
// and for the standalone examples in /examples.

export const PALETTE = [
  [1.0, 0.05, 0.05], // red
  [0.05, 1.0, 0.15], // green
  [0.1, 0.3, 1.0], // blue
  [0.05, 1.0, 1.0], // cyan
  [1.0, 0.05, 1.0], // magenta
  [1.0, 0.95, 0.05], // yellow
];

export function complement(rgb) {
  return [1 - rgb[0], 1 - rgb[1], 1 - rgb[2]];
}

export class PaletteCycler {
  constructor(palette = PALETTE) {
    this.palette = palette;
    this.index = 0;
  }

  get color() {
    return this.palette[this.index];
  }

  next() {
    this.index = (this.index + 1) % this.palette.length;
    return this.color;
  }
}
