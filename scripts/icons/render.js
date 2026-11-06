// Renders the generated SVGs to the PNG/ICO/ICNS files electron-builder and the README use.
// The renderers aren't project dependencies; install them temporarily first:
//   npm install --no-save @resvg/resvg-js png-to-ico png2icons
// Usage (from the repo root):
//   node scripts/icons/make-svgs.js media && node scripts/icons/render.js media media
//   cp media/icon.icns src/assets/icons/icon.icns
const fs = require("fs");
const path = require("path");
const { Resvg } = require("@resvg/resvg-js");
const pngToIco = require("png-to-ico").default || require("png-to-ico");
const png2icons = require("png2icons");

const [svgDir, outDir] = process.argv.slice(2);
const render = (file, width) => new Resvg(fs.readFileSync(path.join(svgDir, file), "utf-8"), {fitTo: {mode: "width", value: width}}).render().asPng();

(async () => {
    fs.mkdirSync(path.join(outDir, "linuxIcons"), {recursive: true});

    // README wordmark
    fs.writeFileSync(path.join(outDir, "logo.png"), render("logo-wordmark.svg", 430));

    // Linux icon set (same sizes as before)
    const sizes = [16, 24, 32, 48, 64, 96, 128, 256, 512];
    const pngs = {};
    for (const s of sizes) {
        pngs[s] = render("logo.svg", s);
        fs.writeFileSync(path.join(outDir, "linuxIcons", `${s}x${s}.png`), pngs[s]);
    }

    // Windows .ico (16-256)
    fs.writeFileSync(path.join(outDir, "icon.ico"), await pngToIco([16, 24, 32, 48, 64, 128, 256].map(s => pngs[s])));

    // macOS .icns from a 1024px render
    const icns = png2icons.createICNS(render("logo.svg", 1024), png2icons.BICUBIC, 0);
    if (!icns) throw new Error("ICNS generation failed");
    fs.writeFileSync(path.join(outDir, "icon.icns"), icns);

    console.log("rendered:", fs.readdirSync(outDir).join(", "));
})().catch(e => { console.error(e); process.exit(1); });
