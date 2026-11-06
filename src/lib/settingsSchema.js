// What each setting in settings.json is, how it's edited, and how it's validated.
// Used by the settings editor (form, inline errors) and by the main process (validation on save).
//
// applies: "reload"  - takes effect after reloading the UI
//          "restart" - only read when the app starts

const SECTIONS = ["Shell", "Appearance", "Sound", "Behaviour", "Network", "Advanced"];

const SCHEMA = [
    // Shell
    { key: "shell", section: "Shell", type: "string", required: true, applies: "restart",
        label: "Shell", help: "Program to run in the terminal (name on PATH, or full path)" },
    { key: "shellArgs", section: "Shell", type: "string", applies: "restart",
        label: "Shell arguments", help: "Passed to the shell. Leave empty for the defaults (and Windows shell integration)" },
    { key: "cwd", section: "Shell", type: "string", required: true, applies: "restart",
        label: "Starting folder", help: "Working directory the terminal starts in" },
    { key: "env", section: "Shell", type: "env", applies: "restart",
        label: "Environment", help: "Extra environment variables, as a JSON object of strings, e.g. {\"EDITOR\": \"vim\"}" },

    // Appearance
    { key: "theme", section: "Appearance", type: "theme", applies: "reload",
        label: "Theme", help: "Colours, fonts and layout" },
    { key: "termFontSize", section: "Appearance", type: "integer", min: 8, max: 40, applies: "reload",
        label: "Terminal font size", help: "In pixels (themes can override it)" },
    { key: "keyboard", section: "Appearance", type: "keyboard", applies: "reload",
        label: "On-screen keyboard layout", help: "" },
    { key: "clockHours", section: "Appearance", type: "enum", options: [24, 12], applies: "reload",
        label: "Clock format", help: "12 or 24 hours", optionLabels: { 24: "24-hour", 12: "12-hour" } },
    { key: "username", section: "Appearance", type: "string", applies: "reload",
        label: "Display name", help: "Shown in the boot greeting. Leave empty to use your account name" },
    { key: "nocursor", section: "Appearance", type: "boolean", applies: "reload",
        label: "Hide the mouse cursor", help: "" },

    // Sound
    { key: "audio", section: "Sound", type: "boolean", applies: "reload",
        label: "Sound effects", help: "" },
    { key: "audioVolume", section: "Sound", type: "number", min: 0, max: 1, step: 0.05, applies: "reload",
        label: "Volume", help: "From 0 (silent) to 1" },
    { key: "disableFeedbackAudio", section: "Sound", type: "boolean", applies: "reload",
        label: "Mute typing and output sounds", help: "Keeps the other effects" },

    // Behaviour
    { key: "nointro", section: "Behaviour", type: "boolean", applies: "restart",
        label: "Skip the boot animation", help: "" },
    { key: "hideDotfiles", section: "Behaviour", type: "boolean", applies: "reload",
        label: "Hide dotfiles in the file browser", help: "Files and folders starting with a dot" },
    { key: "fsListView", section: "Behaviour", type: "boolean", applies: "reload",
        label: "File browser list view", help: "A detailed list instead of an icon grid" },
    { key: "excludeThreadsFromToplist", section: "Behaviour", type: "boolean", applies: "reload",
        label: "Group threads in top processes", help: "Combine processes that share a name" },
    { key: "experimentalGlobeFeatures", section: "Behaviour", type: "boolean", applies: "reload",
        label: "Show connections on the globe", help: "Marks IP addresses that appear in the terminal" },

    // Network
    { key: "pingAddr", section: "Network", type: "host", required: true, applies: "reload",
        label: "Connectivity check address", help: "Host pinged (TCP port 80) to show the online status" },
    { key: "iface", section: "Network", type: "string", applies: "reload",
        label: "Network interface", help: "Leave empty to pick one automatically" },

    // Advanced
    { key: "forceFullscreen", section: "Advanced", type: "boolean", applies: "restart",
        label: "Start fullscreen", help: "" },
    { key: "allowWindowed", section: "Advanced", type: "boolean", applies: "restart",
        label: "Allow windowed mode", help: "F11 toggles fullscreen" },
    { key: "keepGeometry", section: "Advanced", type: "boolean", applies: "reload",
        label: "Keep a 16:9 window shape", help: "In windowed mode" },
    { key: "monitor", section: "Advanced", type: "monitor", applies: "restart",
        label: "Display", help: "Which monitor to open on (default: the primary one)" },
    { key: "experimentalFeatures", section: "Advanced", type: "boolean", applies: "restart",
        label: "Chromium experimental web features", help: "Not recommended" }
];

const BY_KEY = new Map(SCHEMA.map(s => [s.key, s]));

/**
 * Validates one value. Returns an error message, or null if it's valid.
 * @param {object} context  { themes: string[], keyboards: string[], displayCount: number }
 */
function validateSetting(key, value, context = {}) {
    const spec = BY_KEY.get(key);
    if (!spec) return null; // unknown keys are kept as they are
    const empty = value === undefined || value === null || value === "";
    if (empty) return spec.required ? "Required" : null;

    switch (spec.type) {
        case "string":
            return typeof value === "string" ? null : "Must be text";
        case "boolean":
            return typeof value === "boolean" ? null : "Must be on or off";
        case "integer":
        case "number": {
            if (typeof value !== "number" || !Number.isFinite(value)) return "Must be a number";
            if (spec.type === "integer" && !Number.isInteger(value)) return "Must be a whole number";
            if (value < spec.min || value > spec.max) return `Must be between ${spec.min} and ${spec.max}`;
            return null;
        }
        case "enum":
            return spec.options.includes(value) ? null : `Must be one of: ${spec.options.join(", ")}`;
        case "theme":
            return !context.themes || context.themes.includes(value) ? null : `No theme called "${value}"`;
        case "keyboard":
            return !context.keyboards || context.keyboards.includes(value) ? null : `No keyboard layout called "${value}"`;
        case "monitor":
            if (!Number.isInteger(value) || value < 0) return "Must be a display number";
            return context.displayCount === undefined || value < context.displayCount ? null : `There are only ${context.displayCount} displays`;
        case "host":
            return typeof value === "string" && /^[A-Za-z0-9.:-]+$/.test(value) ? null : "Must be a host name or IP address";
        case "env":
            if (typeof value !== "object" || Array.isArray(value)) return "Must be a JSON object";
            for (const [name, v] of Object.entries(value)) {
                if (typeof v !== "string") return `"${name}" must be a string`;
            }
            return null;
        default:
            return null;
    }
}

/**
 * Validates a whole settings object.
 * @returns {{ errors: Object<string, string> }}  errors by key (empty if everything is valid)
 */
function validateSettings(settings, context = {}) {
    const errors = {};
    for (const spec of SCHEMA) {
        const error = validateSetting(spec.key, settings[spec.key], context);
        if (error) errors[spec.key] = error;
    }
    return { errors };
}

/** "restart", "reload" or null: what's needed for the changes between two settings objects to take effect. */
function changeImpact(before, after) {
    let impact = null;
    for (const spec of SCHEMA) {
        if (JSON.stringify(before[spec.key]) === JSON.stringify(after[spec.key])) continue;
        if (spec.applies === "restart") return "restart";
        impact = "reload";
    }
    return impact;
}

module.exports = { SECTIONS, SCHEMA, validateSetting, validateSettings, changeImpact };
