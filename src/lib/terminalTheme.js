// xterm.js options derived from a neoDEX-UI theme (themes/*.json). Used when a terminal is created and
// when the settings editor previews a theme on the open terminals.

const color = require("color");

const NO_ARG_FILTERS = ["negate", "grayscale"];
const ONE_ARG_FILTERS = ["lighten", "darken", "saturate", "desaturate", "whiten", "blacken", "fade", "opaquer", "rotate", "mix"];

/**
 * Parses a theme's terminal.colorFilter (e.g. ["grayscale()", "mix(0.3)"]) into steps, or returns null if
 * there is none or any step is invalid. See #483.
 */
function parseColorFilter(filter) {
    if (!Array.isArray(filter) || filter.length === 0) return null;
    const steps = [];
    for (const step of filter) {
        if (typeof step !== "string") return null;
        const match = /^(\w+)\((.*)\)$/.exec(step.trim());
        if (!match) return null;
        const [, func, rawArg] = match;
        if (NO_ARG_FILTERS.includes(func)) {
            steps.push({ func, arg: [] });
        } else if (ONE_ARG_FILTERS.includes(func) && rawArg.trim() !== "" && !isNaN(Number(rawArg))) {
            steps.push({ func, arg: [Number(rawArg)] });
        } else {
            return null;
        }
    }
    return steps;
}

/** xterm.js ITheme for a neoDEX-UI theme. ANSI colours the theme doesn't set are derived from its main colour. */
function xtermTheme(theme) {
    const themeColor = `rgb(${theme.colors.r}, ${theme.colors.g}, ${theme.colors.b})`;
    const steps = parseColorFilter(theme.terminal.colorFilter);

    const colorify = steps
        ? base => steps.reduce((c, { func, arg }) => func === "mix" ? c.mix(color(themeColor), ...arg) : c[func](...arg), color(base)).hex()
        : base => color(base).grayscale().mix(color(themeColor), 0.3).hex();

    const ansi = {
        black: "#2e3436", red: "#cc0000", green: "#4e9a06", yellow: "#c4a000",
        blue: "#3465a4", magenta: "#75507b", cyan: "#06989a", white: "#d3d7cf",
        brightBlack: "#555753", brightRed: "#ef2929", brightGreen: "#8ae234", brightYellow: "#fce94f",
        brightBlue: "#729fcf", brightMagenta: "#ad7fa8", brightCyan: "#34e2e2", brightWhite: "#eeeeec"
    };
    const result = {
        foreground: theme.terminal.foreground,
        background: theme.terminal.background,
        cursor: theme.terminal.cursor,
        cursorAccent: theme.terminal.cursorAccent,
        selectionBackground: theme.terminal.selectionBackground || theme.terminal.selection
    };
    for (const [name, base] of Object.entries(ansi)) {
        result[name] = theme.colors[name] || colorify(base);
    }
    return result;
}

/** Font and cursor options for a theme (the user's termFontSize applies unless the theme sets a size). */
function xtermFontOptions(theme, settings = {}) {
    const t = theme.terminal;
    return {
        cursorBlink: t.cursorBlink !== false,
        cursorStyle: t.cursorStyle || "block",
        fontFamily: t.fontFamily || "Fira Mono",
        fontSize: t.fontSize || settings.termFontSize || 15,
        fontWeight: t.fontWeight || "normal",
        fontWeightBold: t.fontWeightBold || "bold",
        letterSpacing: t.letterSpacing || 0,
        lineHeight: t.lineHeight || 1
    };
}

module.exports = { parseColorFilter, xtermTheme, xtermFontOptions };
