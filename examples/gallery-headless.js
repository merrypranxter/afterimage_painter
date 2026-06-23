// Drives a gallery preset's stamp callback without any WebGL context,
// useful for unit-testing preset layouts or dumping them for
// visualization elsewhere. Run with: node examples/gallery-headless.js

import { PRESETS, presetName } from '../src/js/gallery.js';

const presetIndex = Number(process.argv[2] ?? 1); // default: Mondrian
const preset = PRESETS[presetIndex];

if (!preset) {
  console.log(`Free Paint (index ${presetIndex}) has no stamps — pick 1-${PRESETS.length - 1}.`);
  process.exit(0);
}

const stamps = [];
function recordStamp(s) {
  stamps.push(s);
}

if (preset.apply) preset.apply(recordStamp);
if (preset.tick) {
  // Sample a few ticks to show what the animated presets look like over time.
  for (let i = 0; i < 5; i++) preset.tick(recordStamp, i * 0.35, 0.35);
}

console.log(`${presetName(presetIndex)}: ${stamps.length} stamp(s)`);
for (const s of stamps) {
  const size = s.rectWidth !== undefined
    ? `w=${s.rectWidth.toFixed(3)} h=${s.rectHeight.toFixed(3)}`
    : `r=${s.radius.toFixed(3)}`;
  console.log(
    `  (${s.x.toFixed(2)}, ${s.y.toFixed(2)}) ${size} ` +
      `color=[${s.color.map((c) => c.toFixed(2)).join(',')}] shape=${s.shape} target=${s.target}`
  );
}
