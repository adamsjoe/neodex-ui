const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { parseColorFilter, xtermTheme, xtermFontOptions } = require("../../src/lib/terminalTheme.js");

const themesDir = path.join(__dirname, "..", "..", "src", "assets", "themes");
const loadTheme = name => JSON.parse(fs.readFileSync(path.join(themesDir, name + ".json"), "utf-8"));
const ANSI = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white",
    "brightBlack", "brightRed", "brightGreen", "brightYellow", "brightBlue", "brightMagenta", "brightCyan", "brightWhite"];

describe("parseColorFilter", () => {
    test("parses filter steps", () => {
        assert.deepEqual(parseColorFilter(["negate()", "lighten(0.2)", "mix(0.5)"]),
            [{ func: "negate", arg: [] }, { func: "lighten", arg: [0.2] }, { func: "mix", arg: [0.5] }]);
    });

    test("rejects unknown functions, bad arguments and non-lists", () => {
        assert.equal(parseColorFilter(["explode(1)"]), null);
        assert.equal(parseColorFilter(["lighten(lots)"]), null);
        assert.equal(parseColorFilter(["lighten()"]), null);
        assert.equal(parseColorFilter([]), null);
        assert.equal(parseColorFilter(undefined), null);
    });
});

describe("xtermTheme", () => {
    test("every bundled theme produces a complete xterm theme", () => {
        for (const file of fs.readdirSync(themesDir).filter(f => f.endsWith(".json"))) {
            const theme = xtermTheme(loadTheme(file.slice(0, -5)));
            for (const key of ["foreground", "background", ...ANSI]) {
                assert.equal(typeof theme[key], "string", `${file}: ${key}`);
            }
        }
    });

    test("uses the theme's terminal colours and its old 'selection' key", () => {
        const blade = loadTheme("blade");
        const theme = xtermTheme(blade);
        assert.equal(theme.foreground, blade.terminal.foreground);
        assert.equal(theme.background, blade.terminal.background);
        assert.equal(theme.selectionBackground, blade.terminal.selection);
    });

    test("ANSI colours the theme sets win; the rest are derived from the theme colour", () => {
        const base = loadTheme("blade");
        const custom = JSON.parse(JSON.stringify(base));
        custom.colors.red = "#ff0000";
        const theme = xtermTheme(custom);
        assert.equal(theme.red, "#ff0000");
        assert.match(theme.green, /^#[0-9A-F]{6}$/i);
        assert.notEqual(theme.green, "#4e9a06", "derived, not the stock colour");
    });

    test("doesn't modify the theme object", () => {
        const theme = loadTheme("tron-colorfilter");
        const before = JSON.stringify(theme);
        xtermTheme(theme);
        xtermTheme(theme);
        assert.equal(JSON.stringify(theme), before);
    });
});

describe("xtermFontOptions", () => {
    test("uses the user's font size unless the theme sets one", () => {
        assert.equal(xtermFontOptions(loadTheme("tron"), { termFontSize: 18 }).fontSize, 18);
        const sized = loadTheme("tron");
        sized.terminal.fontSize = 11;
        assert.equal(xtermFontOptions(sized, { termFontSize: 18 }).fontSize, 11);
        assert.equal(xtermFontOptions(loadTheme("blade")).cursorStyle, "underline");
    });
});
