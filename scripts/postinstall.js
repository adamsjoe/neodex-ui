// Runs after `npm install` at the repo root: installs the app's own dependencies (src/) and fixes up
// node-pty's native helper.
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "src");

execSync("npm install", { cwd: src, stdio: "inherit" });

// On macOS, node-pty starts shells through a `spawn-helper` executable. Its prebuilt copies lose their
// executable bit when npm unpacks the package, and every spawn then fails with "posix_spawnp failed".
if (process.platform === "darwin") {
    const ptyDir = path.join(src, "node_modules", "node-pty");
    const candidates = [path.join(ptyDir, "build", "Release", "spawn-helper")];
    const prebuilds = path.join(ptyDir, "prebuilds");
    if (fs.existsSync(prebuilds)) {
        for (const dir of fs.readdirSync(prebuilds)) {
            if (dir.startsWith("darwin-")) candidates.push(path.join(prebuilds, dir, "spawn-helper"));
        }
    }
    for (const file of candidates.filter(f => fs.existsSync(f))) {
        fs.chmodSync(file, 0o755);
        console.log(`Made executable: ${path.relative(process.cwd(), file)}`);
    }
}
