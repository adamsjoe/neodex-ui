// Preload script: the only bridge between the UI page and Electron/Node.
//
// It exposes `window.neodex`, a thin IPC wrapper restricted to the channels below. All real work happens
// in the main process (_api.js, _boot.js). Once the page runs with contextIsolation, this object is
// exposed through contextBridge and the page has no other way to reach Node.

const { ipcRenderer, webFrame, contextBridge } = require("electron");

const allow = (names, prefixes = []) => channel =>
    typeof channel === "string" && (names.includes(channel) || prefixes.some(p => channel.startsWith(p)));

const canSend = allow([
    "log", "app-focus", "app-quit", "app-relaunch", "toggle-devtools", "window-minimize", "window-set-keep-geometry",
    "shortcuts-register", "shortcuts-unregister", "ttyspawn", "getThemeOverride", "getKbOverride", "setThemeOverride",
    "setKbOverride", "systeminformation-call"
], ["terminal_channel-"]);

const canInvoke = allow([
    "clipboard-read", "display-count", "open-config-file", "window-toggle-fullscreen",
    "settings-save", "window-state-save", "themes-list", "theme-load", "keyboards-list", "keyboard-load", "boot-log",
    "username", "os-uptime", "shell-open-path", "shell-open-external", "app-latest-release", "net-public-ip",
    "net-ping", "geo-ready", "geo-lookup",
    "fs-list", "fs-exists", "fs-read-text", "fs-write-text", "fs-read-bytes", "fs-watch", "fs-unwatch"
]);

const canReceive = allow([
    "shortcut-triggered", "getThemeOverride", "getKbOverride", "ttyspawn-reply", "fs-changed"
], ["systeminformation-reply-", "terminal_channel-"]);

const check = (ok, kind, channel) => {
    if (!ok(channel)) throw new Error(`IPC ${kind} not allowed on channel "${channel}"`);
};

const api = {
    // Startup data (app info, platform, settings...), loaded once, synchronously
    boot: ipcRenderer.sendSync("boot-data"),

    send(channel, ...args) {
        check(canSend, "send", channel);
        ipcRenderer.send(channel, ...args);
    },
    invoke(channel, ...args) {
        check(canInvoke, "invoke", channel);
        return ipcRenderer.invoke(channel, ...args);
    },
    /** Subscribes to a channel; returns a function that unsubscribes. Listeners get the message arguments only. */
    on(channel, listener) {
        check(canReceive, "receive", channel);
        const wrapped = (event, ...args) => listener(...args);
        ipcRenderer.on(channel, wrapped);
        return () => ipcRenderer.removeListener(channel, wrapped);
    },
    once(channel, listener) {
        check(canReceive, "receive", channel);
        ipcRenderer.once(channel, (event, ...args) => listener(...args));
    },

    setZoomLimits(min, max) {
        webFrame.setVisualZoomLevelLimits(min, max);
    }
};

if (process.contextIsolated) {
    contextBridge.exposeInMainWorld("neodex", api);
} else {
    window.neodex = api;
}
