#version 300 es
// Paint-layer decay pass. The visible "ink" fades on a fast timescale
// (~1-2s) so the slower-decaying adaptation buffer's complementary
// ghost is revealed underneath as the real color disappears.

precision highp float;

in vec2 vUv;
out vec4 outColor;

uniform sampler2D uPrev;
uniform float uDecay; // exp(-dt / paintTau), precomputed on the CPU

void main() {
  vec3 c = texture(uPrev, vUv).rgb * uDecay;
  outColor = vec4(c, 1.0);
}
