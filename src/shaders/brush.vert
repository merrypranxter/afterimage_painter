#version 300 es
// Positions a unit quad as a single brush stamp (circle or square) at
// a given normalized screen position and radius. Used for both live
// mouse/touch painting and for pre-burned gallery patterns.

layout(location = 0) in vec2 aPosition; // unit quad, [-1, 1]

out vec2 vLocal;

uniform vec2 uCenter; // normalized [0,1] screen position
// Half-extent in clip-space units along each axis. The caller (main.js)
// pre-converts circle radius / rect width+height into this so a circle
// stays round regardless of canvas aspect, while a rect can have
// independent width and height.
uniform vec2 uHalfSize;

void main() {
  vLocal = aPosition;
  vec2 clipCenter = uCenter * 2.0 - 1.0;
  gl_Position = vec4(clipCenter + aPosition * uHalfSize, 0.0, 1.0);
}
