// Generates the neoDEX-UI wordmark and icon SVGs from hand-drawn chamfered glyphs, in the style of
// the original eDEX-UI logo (proportions taken from its "e": height 42.87, width 35.72, stroke ~9,
// 45-degree chamfers of 7.4). No font outlines are used, so there are no font-licence concerns.
// Usage: node scripts/icons/make-svgs.js media   (then see render.js)
const fs = require("fs");
const path = require("path");
const out = process.argv[2];

const H = 42.87, W = 35.72, T = 9, C = 7.41, IC = 2.3;
const f = n => +n.toFixed(3);
const poly = pts => "M" + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(" L") + " Z";

// Each glyph: { w: advance width, d(x0): path data }
const glyphs = {
    // Original eDEX "e", rebased to (0,0)
    e: { w: W, d: x => [
        [7.41, 42.87], [0, 35.46], [0, 7.41], [7.41, 0], [28.31, 0], [35.72, 7.41], [35.72, 24.33], [9.14, 24.33],
        [9.14, 31.97], [11.64, 34.55], [24.97, 34.55], [26.74, 32.45], [26.74, 27.71], [35.72, 27.71], [35.72, 36.34], [29.28, 42.87]
    ].map(([a, b]) => [a + x, b]), hole: x => [
        [9.23, 16.44], [26.66, 16.44], [26.66, 10.24], [24.41, 7.83], [11.48, 7.83], [9.23, 10.73]
    ].map(([a, b]) => [a + x, b]) },
    n: { w: W, d: x => [
        [0, H], [0, 0], [W - C, 0], [W, C], [W, H], [W - T, H], [W - T, T + IC], [W - T - IC, T], [T, T], [T, H]
    ].map(([a, b]) => [a + x, b]) },
    o: { w: W, d: x => [
        [C, 0], [W - C, 0], [W, C], [W, H - C], [W - C, H], [C, H], [0, H - C], [0, C]
    ].map(([a, b]) => [a + x, b]), hole: x => [
        [T + IC, T], [W - T - IC, T], [W - T, T + IC], [W - T, H - T - IC], [W - T - IC, H - T], [T + IC, H - T], [T, H - T - IC], [T, T + IC]
    ].map(([a, b]) => [a + x, b]) },
    D: { w: W, d: x => [
        [0, 0], [W - C, 0], [W, C], [W, H - C], [W - C, H], [0, H]
    ].map(([a, b]) => [a + x, b]), hole: x => [
        [T, T], [W - T - IC, T], [W - T, T + IC], [W - T, H - T - IC], [W - T - IC, H - T], [T, H - T]
    ].map(([a, b]) => [a + x, b]) },
    E: { w: W - 3, d: x => {
        const w = W - 3, m1 = (H - T) / 2, m2 = (H + T) / 2;
        return [[0, 0], [w, 0], [w, T], [T, T], [T, m1], [w - 5, m1], [w - 5, m2], [T, m2], [T, H - T], [w, H - T], [w, H], [0, H]]
            .map(([a, b]) => [a + x, b]);
    } },
    X: { w: W, d: x => {
        // Two crossing diagonal strokes as one outline
        const a = 10.5, e = 5.2, s = (W / 2 - a) / (W / 2 - e), b = (H / 2) * (1 - s);
        return [[0, 0], [a, 0], [W / 2, H / 2 - b], [W - a, 0], [W, 0], [W / 2 + e, H / 2], [W, H], [W - a, H],
                [W / 2, H / 2 + b], [a, H], [0, H], [W / 2 - e, H / 2]].map(([p, q]) => [p + x, q]);
    } },
    "-": { w: 20, d: x => [[0, (H - T) / 2], [20, (H - T) / 2], [20, (H + T) / 2], [0, (H + T) / 2]].map(([a, b]) => [a + x, b]) },
    U: { w: W, d: x => [
        [0, 0], [T, 0], [T, H - T - IC], [T + IC, H - T], [W - T - IC, H - T], [W - T, H - T - IC], [W - T, 0], [W, 0],
        [W, H - C], [W - C, H], [C, H], [0, H - C]
    ].map(([a, b]) => [a + x, b]) },
    I: { w: T, d: x => [[0, 0], [T, 0], [T, H], [0, H]].map(([a, b]) => [a + x, b]) }
};

function word(text, gap) {
    let x = 0, d = "";
    for (const ch of text) {
        const g = glyphs[ch];
        d += poly(g.d(x));
        if (g.hole) d += poly(g.hole(x));
        x += g.w + gap;
    }
    return { d, width: x - gap };
}

// --- Wordmark (README logo): dark lettering in a frame, on a light plate so it reads in light and dark mode
{
    const gap = 8.5, pad = 20, border = 4.5;
    const { d, width } = word("neoDEX-UI", gap);
    const vw = width + 2 * pad + 2 * border, vh = H + 2 * pad + 2 * border;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(vw)} ${f(vh)}" width="${Math.round(vw * 1.6)}" height="${Math.round(vh * 1.6)}">
  <title>neoDEX-UI</title>
  <rect x="${border / 2}" y="${border / 2}" width="${f(vw - border)}" height="${f(vh - border)}" fill="#eaeaeb" stroke="#1f1f1f" stroke-width="${border}"/>
  <path fill="#1f1f1f" fill-rule="evenodd" transform="translate(${f(border + pad)} ${f(border + pad)})" d="${d}"/>
</svg>
`;
    fs.writeFileSync(path.join(out, "logo-wordmark.svg"), svg);
}

// --- App icon: same layout as the original eDEX icon (dark disc, square frame), with an "n"
{
    const size = 512, cx = size / 2, r = 246;
    const frame = 298, fb = 18; // square frame size and border
    const g = glyphs.n, scale = 4.18;
    const gx = cx - (g.w * scale) / 2, gy = cx - (H * scale) / 2;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <title>neoDEX-UI</title>
  <defs>
    <linearGradient id="rim" x1="0.75" y1="0.85" x2="0.15" y2="0.1">
      <stop offset="0" stop-color="#373737"/>
      <stop offset="1" stop-color="#1f1f1f"/>
    </linearGradient>
  </defs>
  <circle cx="${cx}" cy="${cx}" r="${r}" fill="#1f1f1f" stroke="url(#rim)" stroke-width="11"/>
  <path fill="#eaeaeb" fill-rule="evenodd" d="M${cx - frame / 2} ${cx - frame / 2} h${frame} v${frame} h${-frame} Z M${cx - frame / 2 + fb} ${cx - frame / 2 + fb} v${frame - 2 * fb} h${frame - 2 * fb} v${-(frame - 2 * fb)} Z"/>
  <path fill="#eaeaeb" fill-rule="evenodd" transform="translate(${f(gx)} ${f(gy)}) scale(${scale})" d="${poly(g.d(0))}"/>
</svg>
`;
    fs.writeFileSync(path.join(out, "logo.svg"), svg);
}
console.log("wrote logo-wordmark.svg and logo.svg");
