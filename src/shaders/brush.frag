#version 300 es
// Soft-edged brush stamp. Outputs a colored circle (or square, for
// the Mondrian gallery preset) with a smooth falloff, premultiplied
// by strength so the caller can blend it additively (adaptation
// buffer) or "over" (paint buffer).

precision highp float;

in vec2 vLocal;
out vec4 outColor;

uniform vec3 uColor;
uniform float uStrength;
uniform int uShape; // 0 = circle, 1 = square

void main() {
  float mask;
  if (uShape == 0) {
    float d = length(vLocal);
    mask = 1.0 - smoothstep(0.6, 1.0, d);
    if (d > 1.0) mask = 0.0;
  } else {
    vec2 a = abs(vLocal);
    float d = max(a.x, a.y);
    mask = 1.0 - smoothstep(0.85, 1.0, d);
  }
  float m = mask * uStrength;
  outColor = vec4(uColor * m, m);
}
