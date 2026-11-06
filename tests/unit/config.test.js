const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { parseConfigFile } = require("../../src/lib/config.js");

const defaults = { theme: "tron", audio: true, termFontSize: 15 };

describe("parseConfigFile", () => {
    test("a missing file means defaults, with no problem", () => {
        assert.deepEqual(parseConfigFile(undefined, defaults, "settings.json"), { value: defaults, problem: null });
    });

    test("fills in missing keys from the defaults and keeps the file's values (and unknown keys)", () => {
        const { value, problem } = parseConfigFile('{"theme": "blade", "custom": 1}', defaults, "settings.json");
        assert.equal(problem, null);
        assert.deepEqual(value, { theme: "blade", audio: true, termFontSize: 15, custom: 1 });
    });

    test("invalid JSON falls back to defaults and names the file and the error", () => {
        const { value, problem } = parseConfigFile('{"theme": "blade",}', defaults, "settings.json");
        assert.deepEqual(value, defaults);
        assert.match(problem, /^settings\.json is not valid JSON \(.+\)\. Using defaults\.$/);
    });

    test("the wrong shape falls back to defaults", () => {
        for (const text of ["[]", "42", '"text"', "null"]) {
            const { value, problem } = parseConfigFile(text, defaults, "settings.json");
            assert.deepEqual(value, defaults, text);
            assert.match(problem, /should be a JSON object/, text);
        }
    });

    test("array files (shortcuts.json) must be arrays and aren't merged", () => {
        const shortcutDefaults = [{ trigger: "Ctrl+X" }];
        assert.deepEqual(parseConfigFile('[{"trigger": "Ctrl+Y"}]', shortcutDefaults, "shortcuts.json"),
            { value: [{ trigger: "Ctrl+Y" }], problem: null });
        const { value, problem } = parseConfigFile('{"trigger": "Ctrl+Y"}', shortcutDefaults, "shortcuts.json");
        assert.deepEqual(value, shortcutDefaults);
        assert.match(problem, /shortcuts\.json should be a JSON array/);
    });

    test("doesn't modify the defaults object", () => {
        const before = JSON.stringify(defaults);
        parseConfigFile('{"theme": "blade"}', defaults, "settings.json");
        assert.equal(JSON.stringify(defaults), before);
    });
});
