// Startup failures must end the app with an error, not leave it running with no window.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { test, expect, _electron: electron } = require("@playwright/test");
const { defaultSettings, defaultShortcuts } = require("../../src/_defaults.js");
const { appLaunchOptions } = require("./helpers");

test("a shell that can't be started makes the app exit with an error instead of hanging", async () => {
    const userData = fs.mkdtempSync(path.join(os.tmpdir(), "neodex-test-"));
    const settings = Object.assign(defaultSettings({ platform: process.platform, userData }), {
        audio: false,
        shell: "definitely-not-a-real-shell-xyz"
    });
    fs.writeFileSync(path.join(userData, "settings.json"), JSON.stringify(settings, null, 4));
    fs.writeFileSync(path.join(userData, "shortcuts.json"), JSON.stringify(defaultShortcuts(), null, 4));

    const app = await electron.launch(appLaunchOptions(
        Object.assign({}, process.env, { NEODEX_USER_DATA: userData, NEODEX_NO_ERROR_DIALOG: "1" })));
    let log = "";
    app.process().stdout.on("data", d => { log += d; });
    app.process().stderr.on("data", d => { log += d; });

    try {
        const exitCode = await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(`app did not exit within 30s\n${log}`)), 30 * 1000);
            app.process().once("exit", code => { clearTimeout(timer); resolve(code); });
        });
        // (Not asserting on the log: the crash can happen before the output listeners are attached)
        expect(exitCode, log).toBe(1);
    } finally {
        await app.close().catch(() => {});
        fs.rmSync(userData, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
});
