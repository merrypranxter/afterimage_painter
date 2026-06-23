# Math Reference: afterimage_painter

## 1. Cone bleaching / adaptation

The adaptation buffer `A(x, y)` stores a per-pixel, per-channel accumulator that stands in for "how bleached are the photoreceptors looking at this point." It is updated in two places:

**Burn (brush stamp, additive blend), in `stamp()` in `main.js`:**

```
A(t) += burnRate * brushStrength * 0.12 * paintColor   // per stamp
```

The `0.12` factor keeps a single stamp from saturating the buffer instantly — burn should require holding the brush or repainting, matching real photopic adaptation building up over hundreds of milliseconds to seconds.

**Relax (every frame, `adaptation.frag`):**

```
A(t) = A(t-1) * exp(-dt / tau)
A(t) = min(A(t), 1.0)
```

This is the standard discretization of the first-order ODE `dA/dt = -A/tau`, i.e. exponential decay toward the unbleached state. `tau` is the *adaptation time constant*:

| `tau` | Behavior |
|-------|----------|
| 2s (`TAU_MIN`) | Quick recovery, weak/brief afterimages |
| 8s (`TAU_DEFAULT`) | Default — clearly visible afterimage, fades over several seconds |
| 30s (`TAU_MAX`) | Long stare, ghost lingers |

Adjustable live with `↑ / ↓` in `TAU_STEP` (1s) increments, clamped via `clampTau()`.

## 2. Paint (ink) decay

The visible stroke color is a *separate* buffer with its own, much faster time constant:

```
P(t) = P(t-1) * exp(-dt / paintTau),  paintTau = 1.4s
```

Keeping paint and adaptation as two buffers with two time constants is what makes "burn, then release, then see the ghost" legible: the real color has to visibly disappear before the complementary ghost reads clearly against the black canvas, even though both started accumulating at the same moment.

## 3. Complementary (opponent) color

The afterimage hue is the simple **additive-RGB complement**:

```
complement(c) = (1, 1, 1) - c
```

This is a deliberate simplification of full opponent-process theory (Hering) and von Kries chromatic adaptation, which operate in LMS cone space and produce hue shifts that aren't exact photometric negatives. The RGB complement was chosen because it reproduces exactly the canonical pairs the project targets:

| Stimulus | Complement |
|----------|------------|
| Red `(1,0,0)` | Cyan `(0,1,1)` |
| Green `(0,1,0)` | Magenta `(1,0,1)` |
| Blue `(0,0,1)` | Yellow `(1,1,0)` |

A higher-fidelity model would convert to LMS, apply per-cone adaptation (von Kries scaling `L' = L / L_adapt`), then convert back to RGB — left as a documented possible extension rather than implemented, to keep the shader cheap enough for 60fps GPGPU feedback on mid-range hardware.

## 4. Compositing

Final pixel color (`afterimage.frag`):

```
complementColor = 1 - A
adaptStrength   = max(A.r, A.g, A.b)
paintCoverage   = max(P.r, P.g, P.b)
ghost           = complementColor * adaptStrength * (1 - paintCoverage)
final           = clamp(P + ghost, 0, 1)
```

The `(1 - paintCoverage)` term is what suppresses the ghost wherever fresh paint is still visible — without it the ghost would visibly fight with the live stroke instead of only appearing once the ink fades.

## 5. Brush footprint

The brush stamp (`brush.vert` + `brush.frag`) is a screen-space quad whose half-extent (`uHalfSize`) is computed in `main.js`'s `stamp()`:

- **Circle** (live brush, most gallery stamps): `uHalfSize = (radius / aspect, radius)`, where `radius` is normalized to canvas height and `aspect = width / height`. Dividing X by aspect keeps the circle round on non-square canvases.
- **Rect** (Mondrian blocks): `uHalfSize = (rectWidth, rectHeight)` passed directly as fractions of canvas width/height — no aspect correction needed, since X and Y are independently specified.

The falloff is `1 - smoothstep(0.6, 1.0, d)` for circles and `1 - smoothstep(0.85, 1.0, max(|x|,|y|))` for the squares/rects, both evaluated in the stamp's local `[-1, 1]` space.

## 6. Stroke interpolation

Mouse/touch movement is sampled per animation frame, not per native pointer event resolution, so fast strokes would leave gaps without interpolation. `paintStroke()` in `main.js` inserts stamps along the segment from the last stamp position to the current pointer position, spaced at `BRUSH_RADIUS * STAMP_SPACING_FACTOR` (0.35× the brush radius) so consecutive stamps overlap enough to look continuous.
