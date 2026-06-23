# Visual Targets: afterimage_painter

What the screen should look like in each state, used as the reference for tuning brush radius, decay timings, and the gallery presets.

## Free Paint (default)

- Background is pure black — "the canvas is the eye," not a sheet of paper.
- Brush strokes are fully saturated (one of the six `PALETTE` colors in `src/js/complementary.js`): red, green, blue, cyan, magenta, yellow.
- While the pointer is held down, strokes look like ordinary paint — bright, opaque, slightly soft-edged (`brush.frag`'s circular falloff).
- Within ~1.5s of lifting the pointer (`PAINT_TAU` in `main.js`), the stroke itself fades to black.
- As the ink fades, a glow appears in the *opposite* hue (red stroke → cyan ghost, etc.), centered exactly where the stroke was. This is the adaptation buffer showing through.
- The ghost itself fades out over the adaptation time constant (`adaptTau`, default 8s, tunable 2–30s with `↑ / ↓`).
- A stroke held longer or repainted over itself multiple times produces a stronger, longer-lived ghost — burn accumulates.

## Mondrian

- Four flat-colored rectangular blocks (red, blue, yellow, green) arranged off-center, reminiscent of a Mondrian composition, pre-burned into both buffers at full strength.
- On entry, the canvas briefly shows the blocks as solid color, then the paint layer fades on the usual fast timescale while the rectangles' afterimages — in their complements (cyan, yellow, blue, magenta) — bloom in the same positions.

## Spiral

- A ~4-turn logarithmic-ish spiral built from ~140 small stamps, each colored from the 6-color palette in sequence, so adjacent arms differ in hue.
- The spiral paint fades quickly; what's left is a multicolor complementary spiral ghost, visually "rotated" in hue from the original — read it as the original spiral's photo-negative.

## Troxler

- A ring of saturated cyan stamps (`PALETTE[3]`) surrounds a tiny white fixation dot at the exact center.
- Stare at the dot: the surrounding ring is burned only into the `adapt` buffer (never the `paint` layer), so it never visually "fades out" through the normal paint-decay path — instead the eye's own fixation should be doing the Troxler fading. This regime intentionally bypasses the usual paint→reveal→ghost sequence to surface the literal vision phenomenon.

## Successive Contrast

- Every ~0.35s (`flickerInterval` in `gallery.js`), a full-screen-ish 0.3-radius circle flashes the next palette color at the canvas center.
- Because each flash both paints and burns, the adaptation buffer accumulates contributions from every recent color — the ghost you see between flashes is a blend that drifts as the sequence continues, not a clean single complement.

## Complementary Mix

- Two large circles — red (`PALETTE[0]`) on the left, cyan (`PALETTE[3]`) on the right — burned at full strength, overlapping slightly in the middle.
- Cyan is literally the complement of red, so where the two ghosts eventually overlap (after the paint fades), the overlap region should read close to white/gray — complementary afterimages canceling rather than mixing.

## Palette swatches

| Name | RGB | Complement |
|------|-----|------------|
| Red | `(1.0, 0.05, 0.05)` | Cyan |
| Green | `(0.05, 1.0, 0.15)` | Magenta |
| Blue | `(0.1, 0.3, 1.0)` | Yellow |
| Cyan | `(0.05, 1.0, 1.0)` | Red |
| Magenta | `(1.0, 0.05, 1.0)` | Green |
| Yellow | `(1.0, 0.95, 0.05)` | Blue |
