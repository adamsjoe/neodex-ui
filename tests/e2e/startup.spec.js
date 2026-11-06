// Startup failures must end the app with an error, not leave it running with no window.
//
// The app is started as a plain child process, not through Playwright: it can crash before Playwright
// has finished attaching to it (especially the packaged app), which made electron.launch() itself fail.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { test, expect } = require("@playwright/test");
const { defaultSettings, defaultShortcuts } = require("../../src/_defaults.js");

const repoRoot = path.resolve(__dirname, "..", "..");

// Same choice as appLaunchOptions() in helpers.js: a packaged build if NEODEX_APP_EXECUTABLE is set
function appCommand() {
    const executable = process.env.NEODEX_APP_EXECUTABLE;
    return executable
        ? { command: path.resolve(executable), args: ["--nointro"] }
        : { command: require(path.join(repoRoot, "node_modules", "electron")), args: [path.join(repoRoot, "src"), "--nointro"] };
}

test("a shell that can't be started makes the app exit with an error instead of hanging", async () => {
    const userData = fs.mkdtempSync(path.join(os.tmpdir(), "neodex-test-"));
    const settings = Object.assign(defaultSettings({ platform: process.platform, userData }), {
        audio: false,
        shell: "definitely-not-a-real-shell-xyz"
    });
    fs.writeFileSync(path.join(userData, "settings.json"), JSON.stringify(settings, null, 4));
    fs.writeFileSync(path.join(userData, "shortcuts.json"), JSON.stringify(defaultShortcuts(), null, 4));

    const { command, args } = appCommand();
    const child = spawn(command, args, {
        cwd: repoRoot,
        env: Object.assign({}, process.env, { NEODEX_USER_DATA: userData, NEODEX_NO_ERROR_DIALOG: "1" })
    });
    let log = "";
    child.stdout.on("data", d => { log += d; });
    child.stderr.on("data", d => { log += d; });

    try {
        const exitCode = await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(`app did not exit within 30s\n${log}`)), 30 * 1000);
            child.once("error", err => { clearTimeout(timer); reject(err); });
            child.once("exit", code => { clearTimeout(timer); resolve(code); });
        });
        expect(exitCode, log).toBe(1);
        expect(log).toMatch(/fatal/i);
    } finally {
        if (child.exitCode === null) child.kill("SIGKILL");
        fs.rmSync(userData, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
});
