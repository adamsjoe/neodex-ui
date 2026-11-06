// Prepares prebuild-src/, the app directory electron-builder packages (see "build" in package.json):
// a minified UI bundle, the main-process sources and assets, and production dependencies.
// Usage: node scripts/prepare-package.js
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.join(__dirname, "..");
const src = path.join(root, "src");
const out = path.join(root, "prebuild-src");

// Page code is bundled into build/renderer.js, so its sources aren't shipped
const skip = new Set(["node_modules", "ui", "classes", "_renderer.js"].map(p => path.join(src, p)));
const skipFile = file => file.endsWith(".map");

console.log("Building the UI bundle (minified)...");
execSync("node scripts/build-renderer.js --minify", { cwd: root, stdio: "inherit" });

console.log("Copying src/ to prebuild-src/...");
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(src, out, {
    recursive: true,
    filter: from => !skip.has(from) && !skipFile(from)
});

console.log("Installing production dependencies...");
execSync("npm install --omit=dev --no-audit --no-fund", { cwd: out, stdio: "inherit" });

// node-pty's macOS helper loses its executable bit when npm unpacks it (see scripts/postinstall.js)
if (process.platform === "darwin") {
    const prebuilds = path.join(out, "node_modules", "node-pty", "prebuilds");
    for (const dir of fs.existsSync(prebuilds) ? fs.readdirSync(prebuilds) : []) {
        const helper = path.join(prebuilds, dir, "spawn-helper");
        if (fs.existsSync(helper)) fs.chmodSync(helper, 0o755);
    }
}

console.log("prebuild-src/ ready.");
