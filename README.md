# afterimage_painter

> paint with color. burn it in. watch the ghost.

Interactive afterimage painting system. Paint with saturated colors on the screen; holding the brush increases retinal adaptation. When you release, a vivid afterimage appears in the complementary color. The afterimage decays over seconds using FBO feedback for temporal adaptation simulation. The canvas is the eye.

## How to run

No build step, but the shaders and JS modules are loaded with `fetch()`, which most browsers block over `file://`. Serve the folder with anything static:

```sh
python3 -m http.server 8000
# or: npx serve .
```

Then open `http://localhost:8000`.

## Live Controls

| Key | Action |
|-----|--------|
| `Mouse / touch` | Paint with current color |
| `Hold` | Burn in (increase adaptation) |
| `Release` | View afterimage |
| `Space` | Clear canvas and adaptation buffer |
| `C` | Cycle brush color |
| `G` | Cycle gallery mode (pre-burn patterns, loops back to Free Paint) |
| `↑ / ↓` | Increase / decrease adaptation decay time constant |

## Named Regimes

Cycled with `G`:

- **Free Paint** — Mouse painting with burn and release
- **Mondrian** — Pre-burn geometric pattern for strong afterimage
- **Spiral** — Rotating spiral, release to see the complementary trail
- **Troxler** — Saturated surround with a fixation dot, peripheral color fades
- **Successive Contrast** — Rapid color switching, cumulative adaptation
- **Complementary Mix** — Two overlapping colors, overlapping afterimages

See `docs/visual-targets.md` for what each regime should look like and `docs/math-reference.md` for the underlying model.

## Architecture

Two RGBA ping-pong FBOs drive the whole simulation (`src/js/gl-utils.js`):

- **paint** — the visible "ink," fast exponential decay (`src/shaders/decay.frag`)
- **adapt** — the per-pixel cone-bleach accumulator, slow tunable decay (`src/shaders/adaptation.frag`)

The brush (`src/shaders/brush.vert` / `brush.frag`) stamps color into both buffers — "over" blending for paint, additive for adapt. The final pass (`src/shaders/afterimage.frag`) composites the ink over the RGB complement of the adapt buffer, so the ghost only shows where real paint has faded.

`src/js/gallery.js` holds the named pre-burn presets as pure data/logic, decoupled from GL state.

## The Math

Chromatic adaptation model (von Kries-style):
- Adaptation state: `A(t) = A(t-1) + burnRate * paintColor * dt` while painting
- Relaxation: `A(t) = A(t-1) * exp(-dt / tau)` every frame
- `tau` ranges 2–30s, default 8s, adjustable with `↑ / ↓`
- Afterimage signal: `ghost = (1 - A) * adaptStrength * (1 - paintCoverage)`
- Complementary: simple additive-RGB inversion (`1 - rgb`), which maps red↔cyan, green↔magenta, blue↔yellow

Full derivation and reference values: `docs/math-reference.md`.

## Examples

`examples/` has small standalone snippets for using the modules outside the full app:

- `examples/complementary-demo.html` — palette cycling + complement math in isolation
- `examples/gallery-headless.js` — driving a gallery preset's `stamp` callback without WebGL, for testing
- `examples/minimal-pingpong.html` — the smallest possible ping-pong FBO decay loop, no brush

## Acknowledgments

Johann Wolfgang von Goethe (color theory), Ewald Hering (opponent process), modern work by Fairchild and others on chromatic adaptation.
