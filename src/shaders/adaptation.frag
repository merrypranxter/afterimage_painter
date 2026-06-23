#version 300 es
// Adaptation (cone-bleach) buffer relaxation pass.
//
// Burning (the brush) is accumulated additively elsewhere via stamp
// draws straight into this buffer's framebuffer; this pass only
// applies the slow exponential recovery toward zero each frame:
//   A(t) = A(t-1) * exp(-dt/tau)
// The result is clamped to 1.0, the physically meaningful "fully
// bleached" ceiling, even though additive stamping can momentarily
// push it higher (see docs/math-reference.md).

precision highp float;

in vec2 vUv;
out vec4 outColor;

uniform sampler2D uPrev;
uniform float uDecay; // exp(-dt / adaptTau)

void main() {
  vec3 a = texture(uPrev, vUv).rgb * uDecay;
  outColor = vec4(min(a, vec3(1.0)), 1.0);
}
