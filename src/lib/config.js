// Parsing of the user's JSON config files (settings.json, shortcuts.json, lastWindowState.json).
// A broken file must not crash the app: it falls back to defaults and reports a problem the UI can show.

/**
 * @param {string|undefined} text   file contents, or undefined if the file doesn't exist
 * @param {object|Array} defaults   used when the file is missing or unusable; objects are also merged
 *                                  under the file's values, so missing keys get their defaults
 * @param {string} fileName         for problem messages
 * @returns {{value: object|Array, problem: string|null}}
 */
function parseConfigFile(text, defaults, fileName) {
    if (text === undefined) return { value: defaults, problem: null };

    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch (err) {
        return { value: defaults, problem: `${fileName} is not valid JSON (${err.message}). Using defaults.` };
    }

    if (Array.isArray(defaults)) {
        if (!Array.isArray(parsed)) {
            return { value: defaults, problem: `${fileName} should be a JSON array. Using defaults.` };
        }
        return { value: parsed, problem: null };
    }

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return { value: defaults, problem: `${fileName} should be a JSON object. Using defaults.` };
    }
    return { value: Object.assign({}, defaults, parsed), problem: null };
}

module.exports = {
    parseConfigFile
};
