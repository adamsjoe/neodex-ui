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
const { loadConfig } = require("./_config.js");

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
    onSyncTrusted("boot-data", () => {
        const config = loadConfig();
        return {
            appInfo: { version: app.getVersion(), userData, argv: process.argv },
            dirs: { userData, themes: dirs.themes, keyboards: dirs.keyboards, fonts: dirs.fonts },
            platform: process.platform,
            versions: { electron: process.versions.electron },
            isArch: process.platform === "linux" && (() => {
                try { return fs.readFileSync("/etc/os-release", "utf-8").includes("arch"); } catch (e) { return false; }
            })(),
            fontsUrl: pathToFileURL(dirs.fonts).href,
            settings: config.settings,
            shortcuts: config.shortcuts,
            lastWindowState: config.lastWindowState,
            // Problems found in the config files (shown to the user; defaults are used meanwhile)
            configProblems: config.problems
        };
    });

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

    // ---- Filesystem (file browser, editor, PDF viewer)
    // The UI is a file manager and editor, so it can read and write any path the user can; what changes
    // is that it has to ask the main process instead of holding Node's fs module itself.
    const checkPath = p => {
        if (typeof p !== "string" || p === "" || p.includes("\0")) throw new Error("Invalid path");
        return p;
    };

    // Lists a directory. One entry failing must not fail the listing: files vanish between readdir and
    // lstat (e.g. in temp folders), and some are locked or unreadable.
    handleTrusted("fs-list", async (e, dir) => {
        checkPath(dir);
        if (process.platform === "win32" && /^[a-z]:$/i.test(dir)) dir += "\\"; // "C:" means the drive root
        const names = await fs.promises.readdir(dir);
        const entries = await Promise.all(names.map(async name => {
            const full = path.resolve(dir, name);
            let stat;
            try {
                stat = await fs.promises.lstat(full);
            } catch (err) {
                if (err.code === "ENOENT") return null; // deleted since readdir
                return { name, path: full, kind: "system" }; // locked/unreadable
            }
            return {
                name,
                path: full,
                kind: stat.isSymbolicLink() ? "symlink" : stat.isDirectory() ? "dir" : stat.isFile() ? "file" : "other",
                size: stat.size,
                mtime: stat.mtimeMs
            };
        }));
        const isRoot = path.parse(dir).root === path.resolve(dir);
        return {
            dir,
            parent: isRoot ? null : path.resolve(dir, ".."),
            entries: entries.filter(entry => entry !== null)
        };
    });
    handleTrusted("fs-exists", (e, p) => fs.existsSync(checkPath(p)));
    handleTrusted("fs-read-text", (e, p) => fs.promises.readFile(checkPath(p), "utf-8"));
    handleTrusted("fs-write-text", (e, p, content) => fs.promises.writeFile(checkPath(p), String(content), "utf-8"));
    handleTrusted("fs-read-bytes", async (e, p) => new Uint8Array(await fs.promises.readFile(checkPath(p))));

    // One watched directory for the UI; changes (other than file contents) are sent as "fs-changed"
    let watcher = null;
    const unwatch = () => {
        if (watcher) watcher.close();
        watcher = null;
    };
    handleTrusted("fs-watch", (e, dir) => {
        unwatch();
        const sender = e.sender;
        try {
            watcher = fs.watch(checkPath(dir), eventType => {
                // #758: don't refresh the file view when only a file's contents changed
                if (eventType !== "change" && !sender.isDestroyed()) sender.send("fs-changed", dir);
            });
            watcher.on("error", unwatch);
        } catch (err) {
            watcher = null; // e.g. directory deleted; the next listing will report it
        }
    });
    handleTrusted("fs-unwatch", () => unwatch());

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
