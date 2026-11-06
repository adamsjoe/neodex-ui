// Validation of values that cross a trust boundary (IPC from the renderer, user-edited settings).

// Terminal sizes beyond this are certainly bogus
const MAX_TERMINAL_DIMENSION = 10000;

/** Validates a terminal resize request. Returns {cols, rows} as integers, or null if invalid. */
function parseResize(cols, rows) {
    cols = Number(cols);
    rows = Number(rows);
    const valid = n => Number.isInteger(n) && n >= 1 && n <= MAX_TERMINAL_DIMENSION;
    return (valid(cols) && valid(rows)) ? { cols, rows } : null;
}

const LOG_LEVELS = ["error", "fatal", "warn", "info", "note", "debug", "success", "complete", "pending", "watch", "log"];

/** Maps a log level requested over IPC to a known signale method (anything else becomes "log"). */
function normaliseLogLevel(type) {
    return LOG_LEVELS.includes(type) ? type : "log";
}

/** Whether `type` names a real systeminformation function (not an inherited or non-function property). */
function isAllowedSystemInformationCall(si, type) {
    return typeof type === "string" && Object.prototype.hasOwnProperty.call(si, type) && typeof si[type] === "function";
}

/**
 * Parses the "env" setting as typed in the settings editor: empty, or a JSON object of string values.
 * @returns {{ok: true, env: object|undefined} | {ok: false, error: string}}
 */
function parseEnvSetting(input) {
    const text = String(input === undefined || input === null ? "" : input).trim();
    if (text === "") return { ok: true, env: undefined };

    let env;
    try {
        env = JSON.parse(text);
    } catch (e) {
        return { ok: false, error: "env must be valid JSON, e.g. {\"FOO\": \"bar\"}" };
    }
    if (typeof env !== "object" || env === null || Array.isArray(env)) {
        return { ok: false, error: "env must be a JSON object, e.g. {\"FOO\": \"bar\"}" };
    }
    const badKey = Object.keys(env).find(key => typeof env[key] !== "string");
    if (badKey !== undefined) {
        return { ok: false, error: `env values must be strings (check "${badKey}")` };
    }
    return { ok: true, env };
}

module.exports = {
    MAX_TERMINAL_DIMENSION,
    LOG_LEVELS,
    parseResize,
    normaliseLogLevel,
    isAllowedSystemInformationCall,
    parseEnvSetting
};
