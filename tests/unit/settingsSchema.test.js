const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { SCHEMA, SECTIONS, validateSetting, validateSettings, changeImpact } = require("../../src/lib/settingsSchema.js");
const { defaultSettings } = require("../../src/_defaults.js");

const context = { themes: ["tron", "blade"], keyboards: ["en-US", "fr-FR"], displayCount: 2 };

describe("settings schema", () => {
    test("every setting has a known section, a label and how it applies", () => {
        for (const spec of SCHEMA) {
            assert.ok(SECTIONS.includes(spec.section), spec.key);
            assert.ok(spec.label, spec.key);
            assert.ok(["reload", "restart"].includes(spec.applies), spec.key);
        }
    });

    test("the default settings are valid", () => {
        for (const platform of ["win32", "linux", "darwin"]) {
            const defaults = defaultSettings({ platform, userData: "/x" });
            assert.deepEqual(validateSettings(defaults, { themes: ["tron"], keyboards: ["en-US"], displayCount: 1 }).errors, {}, platform);
        }
    });
});

describe("validateSetting", () => {
    test("numbers: type, whole numbers and range", () => {
        assert.equal(validateSetting("termFontSize", 15, context), null);
        assert.match(validateSetting("termFontSize", 99, context), /between 8 and 40/);
        assert.match(validateSetting("termFontSize", 12.5, context), /whole number/);
        assert.match(validateSetting("termFontSize", "15", context), /number/);
        assert.equal(validateSetting("audioVolume", 0.35, context), null);
        assert.match(validateSetting("audioVolume", 2, context), /between 0 and 1/);
    });

    test("required settings can't be empty; optional ones can", () => {
        assert.equal(validateSetting("shell", "", context), "Required");
        assert.equal(validateSetting("pingAddr", undefined, context), "Required");
        assert.equal(validateSetting("username", "", context), null);
        assert.equal(validateSetting("iface", undefined, context), null);
    });

    test("booleans, enums and hosts", () => {
        assert.equal(validateSetting("audio", false, context), null);
        assert.match(validateSetting("audio", "true", context), /on or off/);
        assert.equal(validateSetting("clockHours", 12, context), null);
        assert.match(validateSetting("clockHours", 13, context), /one of: 24, 12/);
        assert.equal(validateSetting("pingAddr", "1.1.1.1", context), null);
        assert.equal(validateSetting("pingAddr", "example.com", context), null);
        assert.match(validateSetting("pingAddr", "1.1.1.1; rm -rf /", context), /host name or IP/);
    });

    test("themes, keyboard layouts and displays must exist", () => {
        assert.equal(validateSetting("theme", "blade", context), null);
        assert.match(validateSetting("theme", "missing", context), /No theme called "missing"/);
        assert.match(validateSetting("keyboard", "xx-XX", context), /No keyboard layout/);
        assert.equal(validateSetting("monitor", 1, context), null);
        assert.match(validateSetting("monitor", 2, context), /only 2 displays/);
        assert.match(validateSetting("monitor", -1, context), /display number/);
    });

    test("env must be an object of strings", () => {
        assert.equal(validateSetting("env", { EDITOR: "vim" }, context), null);
        assert.match(validateSetting("env", { PORT: 3000 }, context), /"PORT" must be a string/);
        assert.match(validateSetting("env", ["x"], context), /JSON object/);
    });

    test("unknown keys are left alone", () => {
        assert.equal(validateSetting("somethingCustom", 42, context), null);
    });
});

describe("validateSettings and changeImpact", () => {
    test("collects errors by key", () => {
        const { errors } = validateSettings({ shell: "", cwd: "/home/x", termFontSize: 2, pingAddr: "1.1.1.1", theme: "tron" }, context);
        assert.deepEqual(Object.keys(errors).sort(), ["shell", "termFontSize"]);
    });

    test("reports whether changes need a reload or a restart", () => {
        const before = { theme: "tron", shell: "bash", termFontSize: 15 };
        assert.equal(changeImpact(before, Object.assign({}, before)), null);
        assert.equal(changeImpact(before, Object.assign({}, before, { theme: "blade" })), "reload");
        assert.equal(changeImpact(before, Object.assign({}, before, { theme: "blade", shell: "zsh" })), "restart");
    });
});
