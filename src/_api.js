// Main-process implementation of the API the UI uses through the preload script (_preload.js).
//
// The UI page is being moved off Node (contextIsolation + sandbox): everything that needs the filesystem,
// the network or the OS happens here, behind IPC handlers that only answer the app's own window.

const fs = require("fs");
const os = require("os");
const path = require("path");
const net = require("net");
const https = require("https");
const { app, shell } = require("electron");
const { pathToFileURL } = require("url");
const signale = require("signale");

/**
 * @param {object} deps
 * @param {(channel: string, handler: Function) => void} deps.handleTrusted  ipcMain.handle, for the app window only
 * @param {(channel: string, handler: Function) => void} deps.onSyncTrusted  sync ipcMain.on (e.returnValue), app window only
 * @param {() => Electron.BrowserWindow} deps.getWindow
 */
module.exports = function registerApi({ handleTrusted, onSyncTrusted, getWindow }) {
    const userData = app.getPath("userData");
    const dirs = {
        themes: path.join(userData, "themes"),
        keyboards: path.join(userData, "keyboards"),
        fonts: path.join(userData, "fonts")
    };
    const files = {
        settings: path.join(userData, "settings.json"),
        shortcuts: path.join(userData, "shortcuts.json"),
        lastWindowState: path.join(userData, "lastWindowState.json")
    };

    const readJson = file => JSON.parse(fs.readFileSync(file, "utf-8"));
    const writeJson = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 4));

    // Theme/keyboard names come from the UI: only plain file names inside their directory
    const namedJson = (dir, name) => {
        if (typeof name !== "string" || name === "" || name !== path.basename(name)) {
            throw new Error(`Invalid name: ${name}`);
        }
        return path.join(dir, name + ".json");
    };
    const listJson = dir => fs.readdirSync(dir).filter(f => f.endsWith(".json")).map(f => f.slice(0, -5));

    // ---- Startup data, read synchronously by the preload before the UI scripts run
    onSyncTrusted("boot-data", () => ({
        appInfo: { version: app.getVersion(), userData, argv: process.argv },
        dirs: { userData, themes: dirs.themes, keyboards: dirs.keyboards, fonts: dirs.fonts },
        platform: process.platform,
        versions: { electron: process.versions.electron },
        isArch: process.platform === "linux" && (() => {
            try { return fs.readFileSync("/etc/os-release", "utf-8").includes("arch"); } catch (e) { return false; }
        })(),
        fontsUrl: pathToFileURL(dirs.fonts).href,
        settings: readJson(files.settings),
        shortcuts: readJson(files.shortcuts),
        lastWindowState: readJson(files.lastWindowState)
    }));

    // ---- Config
    handleTrusted("settings-save", (e, settings) => {
        if (typeof settings !== "object" || settings === null || Array.isArray(settings)) throw new Error("Invalid settings");
        writeJson(files.settings, settings);
    });
    handleTrusted("window-state-save", (e, state) => {
        if (typeof state !== "object" || state === null || Array.isArray(state)) throw new Error("Invalid window state");
        writeJson(files.lastWindowState, state);
    });
    handleTrusted("themes-list", () => listJson(dirs.themes));
    handleTrusted("theme-load", (e, name) => readJson(namedJson(dirs.themes, name)));
    handleTrusted("keyboards-list", () => listJson(dirs.keyboards));
    handleTrusted("keyboard-load", (e, name) => readJson(namedJson(dirs.keyboards, name)));
    handleTrusted("boot-log", () => fs.readFileSync(path.join(__dirname, "assets", "misc", "boot_log.txt"), "utf-8"));
    handleTrusted("username", async () => {
        try {
            return os.userInfo().username || null;
        } catch (e) {
            return null;
        }
    });
    handleTrusted("os-uptime", () => Math.floor(os.uptime()));

    // ---- Shell
    handleTrusted("shell-open-path", (e, target) => {
        if (typeof target !== "string" || target === "") throw new Error("Invalid path");
        getWindow().minimize();
        return shell.openPath(target);
    });
    handleTrusted("shell-open-external", (e, url) => {
        if (typeof url !== "string" || !/^https:\/\//i.test(url)) throw new Error("Only https links can be opened");
        return shell.openExternal(url);
    });

    // ---- Network
    const getJson = (options, timeout = 5000) => new Promise((resolve, reject) => {
        const req = https.get(options, res => {
            if (res.statusCode !== 200) {
                res.resume();
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
            }
            let raw = "";
            res.setEncoding("utf-8");
            res.on("data", chunk => { raw += chunk; });
            res.on("end", () => {
                try { resolve(JSON.parse(raw)); } catch (err) { reject(err); }
            });
        });
        req.on("error", reject);
        req.setTimeout(timeout, () => req.destroy(new Error("Request timed out")));
    });

    handleTrusted("app-latest-release", async () => {
        const release = await getJson({
            host: "api.github.com",
            path: "/repos/adamsjoe/neodex-ui/releases/latest",
            headers: { "User-Agent": "neoDEX-UI UpdateChecker" }
        });
        return {
            tagName: String(release.tag_name),
            url: (typeof release.html_url === "string" && release.html_url.startsWith("https://github.com/")) ? release.html_url : null
        };
    });

    handleTrusted("net-public-ip", async (e, localAddress) => {
        const data = await getJson({ host: "myexternalip.com", path: "/json", localAddress: localAddress || undefined });
        return typeof data.ip === "string" ? data.ip : null;
    });

    // TCP connect time, in milliseconds
    handleTrusted("net-ping", (e, host, port, localAddress) => new Promise((resolve, reject) => {
        const socket = new net.Socket();
        const start = process.hrtime.bigint();
        socket.setTimeout(1900, () => {
            socket.destroy();
            reject(new Error("Socket timeout"));
        });
        socket.on("error", err => {
            socket.destroy();
            reject(err);
        });
        socket.connect({ port: Number(port), host: String(host), localAddress: localAddress || undefined, family: 4 }, () => {
            resolve(Number(process.hrtime.bigint() - start) / 1e6);
            socket.destroy();
        });
    }));

    // ---- GeoIP (GeoLite2 City database, downloaded to the config dir)
    let geoLookup = null;
    try {
        const geolite2 = require("geolite2-redist");
        const maxmind = require("maxmind");
        geolite2.downloadDbs(path.join(userData, "geoIPcache"))
            .then(() => geolite2.open("GeoLite2-City", dbPath => maxmind.open(dbPath)))
            .then(lookup => {
                geoLookup = lookup;
                signale.info("GeoIP database ready");
            })
            .catch(err => signale.warn(`GeoIP database unavailable: ${err.message}`));
    } catch (err) {
        signale.warn(`GeoIP unavailable: ${err.message}`);
    }
    handleTrusted("geo-ready", () => geoLookup !== null);
    // Location of an IP address, as {latitude, longitude}, or null
    handleTrusted("geo-lookup", (e, ip) => {
        if (!geoLookup || typeof ip !== "string" || !net.isIP(ip)) return null;
        const result = geoLookup.get(ip);
        if (!result || !result.location) return null;
        return { latitude: result.location.latitude, longitude: result.location.longitude };
    });
};
