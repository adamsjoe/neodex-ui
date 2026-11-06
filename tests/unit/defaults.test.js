const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { defaultSettings, defaultShortcuts } = require("../../src/_defaults.js");

describe("defaultSettings", () => {
    test("uses PowerShell on Windows and bash elsewhere", () => {
        assert.equal(defaultSettings({ platform: "win32", userData: "C:\\x" }).shell, "powershell.exe");
        assert.equal(defaultSettings({ platform: "linux", userData: "/x" }).shell, "bash");
        assert.equal(defaultSettings({ platform: "darwin", userData: "/x" }).shell, "bash");
    });

    test("starts in the config directory", () => {
        assert.equal(defaultSettings({ platform: "linux", userData: "/home/x/.config/neoDEX-UI" }).cwd, "/home/x/.config/neoDEX-UI");
    });

    test("has the keys the app reads at startup, and round-trips through JSON", () => {
        const settings = defaultSettings({ platform: "linux", userData: "/x" });
        for (const key of ["shell", "shellArgs", "cwd", "keyboard", "theme", "termFontSize", "audio", "forceFullscreen", "allowWindowed", "experimentalGlobeFeatures"]) {
            assert.ok(key in settings, key);
        }
        assert.deepEqual(JSON.parse(JSON.stringify(settings)), settings);
        assert.equal("port" in settings, false, "the WebSocket port setting was removed");
    });

    test("returns a fresh object each time", () => {
        const a = defaultSettings({ platform: "linux", userData: "/x" });
        a.theme = "changed";
        assert.equal(defaultSettings({ platform: "linux", userData: "/x" }).theme, "tron");
    });
});

describe("defaultShortcuts", () => {
    test("every shortcut is well-formed", () => {
        for (const cut of defaultShortcuts()) {
            assert.ok(["app", "shell"].includes(cut.type), JSON.stringify(cut));
            assert.equal(typeof cut.trigger, "string");
            assert.equal(typeof cut.action, "string");
            assert.equal(typeof cut.enabled, "boolean");
        }
    });

    test("no two enabled shortcuts share a trigger", () => {
        const triggers = defaultShortcuts().filter(c => c.enabled).map(c => c.trigger);
        assert.equal(new Set(triggers).size, triggers.length);
    });
});
