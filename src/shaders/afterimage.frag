#version 300 es
// Final composite: the painted ink layered over its complementary
// afterimage. The ghost is strongest in the opponent hue where
// adaptation is high and the live paint has faded out of that pixel,
// which is what makes the burn-then-release effect read clearly.

precision highp float;

in vec2 vUv;
out vec4 outColor;

uniform sampler2D uPaint;
uniform sampler2D uAdapt;

void main() {
  vec3 paint = texture(uPaint, vUv).rgb;
  vec3 adapt = texture(uAdapt, vUv).rgb;

  vec3 complementColor = vec3(1.0) - adapt; // red<->cyan, green<->magenta, blue<->yellow
  float adaptStrength = max(max(adapt.r, adapt.g), adapt.b);
  float paintCoverage = max(max(paint.r, paint.g), paint.b);

  vec3 ghost = complementColor * adaptStrength * (1.0 - paintCoverage);
  vec3 finalColor = paint + ghost;

  outColor = vec4(clamp(finalColor, 0.0, 1.0), 1.0);
}
