// Loads the user's config files for the main process (see src/lib/config.js for the parsing rules).
// Read fresh on each call: the UI re-reads them on reload, after the user edits settings.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { app } = require("electron");
const { parseConfigFile } = require("./lib/config.js");
const { defaultSettings, defaultShortcuts } = require("./_defaults.js");

function readIfExists(file) {
    try {
        return fs.readFileSync(file, "utf-8");
    } catch (err) {
        if (err.code === "ENOENT") return undefined;
        throw err;
    }
}

/**
 * @returns {{settings: object, shortcuts: Array, lastWindowState: object, problems: string[]}}
 */
function loadConfig() {
    const userData = app.getPath("userData");
    const problems = [];
    const load = (name, defaults) => {
        const result = parseConfigFile(readIfExists(path.join(userData, name)), defaults, name);
        if (result.problem) problems.push(result.problem);
        return result.value;
    };

    const settings = load("settings.json", defaultSettings({ platform: process.platform, userData }));
    const shortcuts = load("shortcuts.json", defaultShortcuts());
    const lastWindowState = load("lastWindowState.json", { useFullscreen: true });

    if (typeof settings.cwd !== "string" || !fs.existsSync(settings.cwd)) {
        problems.push(`The configured working directory (cwd: ${JSON.stringify(settings.cwd)}) doesn't exist. Starting in your home folder.`);
        settings.cwd = os.homedir();
    }

    return { settings, shortcuts, lastWindowState, problems };
}

module.exports = { loadConfig };
