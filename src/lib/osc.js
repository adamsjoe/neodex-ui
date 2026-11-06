// Parsing of the escape sequences shells use to report their working directory (shell integration).
//   OSC 9;9;"<path>"        Windows Terminal / ConEmu convention; what our PowerShell and cmd setup emits
//   OSC 7;file://host/path  common on Unix shells
// Both functions receive the OSC payload after the numeric identifier, as xterm.js passes it to an
// OSC handler, and return the directory, or null if the sequence isn't a cwd report.

/** @param {string} data  payload of OSC 9, e.g. '9;"C:\\Users"' */
function cwdFromOsc9(data) {
    if (typeof data !== "string" || !data.startsWith("9;")) return null; // other OSC 9 uses, e.g. notifications
    const cwd = data.slice(2).replace(/^"(.*)"$/, "$1");
    return cwd === "" ? null : cwd;
}

/**
 * @param {string} data      payload of OSC 7, e.g. "file://host/home/user"
 * @param {string} platform  process.platform; on Windows, "/C:/x" becomes "C:\\x"
 */
function cwdFromOsc7(data, platform) {
    let url;
    try {
        url = new URL(data);
    } catch (e) {
        return null;
    }
    if (url.protocol !== "file:") return null;
    let cwd;
    try {
        cwd = decodeURIComponent(url.pathname);
    } catch (e) {
        return null; // malformed percent-encoding
    }
    if (platform === "win32") cwd = cwd.replace(/^\/([a-zA-Z]:)/, "$1").replace(/\//g, "\\");
    return cwd === "" ? null : cwd;
}

module.exports = {
    cwdFromOsc9,
    cwdFromOsc7
};
