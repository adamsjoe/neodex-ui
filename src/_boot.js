const signale = require("signale");
const {app, BrowserWindow, dialog, shell, clipboard, globalShortcut, screen} = require("electron");

process.on("uncaughtException", e => {
    signale.fatal(e);
    dialog.showErrorBox("neoDEX-UI crashed", e.message || "Cannot retrieve error message.");
    if (tty) {
        tty.close();
    }
    if (extraTtys) {
        Object.keys(extraTtys).forEach(key => {
            if (extraTtys[key] !== null) {
                extraTtys[key].close();
            }
        });
    }
    process.exit(1);
});

signale.start(`Starting neoDEX-UI v${app.getVersion()}`);
signale.info(`With Node ${process.versions.node} and Electron ${process.versions.electron}`);
signale.info(`Renderer is Chrome ${process.versions.chrome}`);

// Alternative config directory, used by the automated tests so they never touch the real settings.
// Must be set before anything reads userData, including the single-instance lock (which is per directory).
if (process.env.NEODEX_USER_DATA) {
    app.setPath("userData", require("path").resolve(process.env.NEODEX_USER_DATA));
    signale.info(`Using config dir from NEODEX_USER_DATA`);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
    signale.fatal("Error: Another instance of neoDEX-UI is already running. Cannot proceed.");
    app.exit(1);
}

signale.time("Startup");

const electron = require("electron");
const ipc = electron.ipcMain;
const path = require("path");
const fs = require("fs");
const which = require("which");
const Terminal = require("./classes/terminal.class.js").Terminal;
const {defaultSettings, defaultShortcuts} = require("./_defaults.js");

var win, tty, extraTtys;

// Only our own UI window may talk to the backend over IPC
function isTrustedSender(webContents) {
    return Boolean(win) && !win.isDestroyed() && webContents === win.webContents;
}
function onTrusted(channel, handler) {
    ipc.on(channel, (e, ...args) => {
        if (!isTrustedSender(e.sender)) {
            signale.warn(`Rejected IPC message on "${channel}" from untrusted sender`);
            return;
        }
        handler(e, ...args);
    });
}
function handleTrusted(channel, handler) {
    ipc.handle(channel, (e, ...args) => {
        if (!isTrustedSender(e.sender)) {
            throw new Error(`Rejected IPC call on "${channel}" from untrusted sender`);
        }
        return handler(e, ...args);
    });
}

const {normaliseLogLevel} = require("./lib/validation.js");
onTrusted("log", (e, type, content) => {
    signale[normaliseLogLevel(type)](content);
});
const settingsFile = path.join(electron.app.getPath("userData"), "settings.json");
const shortcutsFile = path.join(electron.app.getPath("userData"), "shortcuts.json");
const lastWindowStateFile = path.join(electron.app.getPath("userData"), "lastWindowState.json");
const themesDir = path.join(electron.app.getPath("userData"), "themes");
const innerThemesDir = path.join(__dirname, "assets/themes");
const kblayoutsDir = path.join(electron.app.getPath("userData"), "keyboards");
const innerKblayoutsDir = path.join(__dirname, "assets/kb_layouts");
const fontsDir = path.join(electron.app.getPath("userData"), "fonts");
const innerFontsDir = path.join(__dirname, "assets/fonts");

// Bypass GPU acceleration blocklist, trading a bit of stability for a great deal of performance, mostly on Linux
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-video-decode");

// Fix userData folder not setup on Windows
try {
    fs.mkdirSync(electron.app.getPath("userData"));
    signale.info(`Created config dir at ${electron.app.getPath("userData")}`);
} catch(e) {
    signale.info(`Base config dir is ${electron.app.getPath("userData")}`);
}
// Create default settings file
if (!fs.existsSync(settingsFile)) {
    fs.writeFileSync(settingsFile, JSON.stringify(defaultSettings({platform: process.platform, userData: electron.app.getPath("userData")}), "", 4));
    signale.info(`Default settings written to ${settingsFile}`);
}
// Create default shortcuts file
if (!fs.existsSync(shortcutsFile)) {
    fs.writeFileSync(shortcutsFile, JSON.stringify(defaultShortcuts(), "", 4));
    signale.info(`Default keymap written to ${shortcutsFile}`);
}
//Create default window state file
if(!fs.existsSync(lastWindowStateFile)) {
    fs.writeFileSync(lastWindowStateFile, JSON.stringify({
        useFullscreen: true
    }, "", 4));
    signale.info(`Default last window state written to ${lastWindowStateFile}`);
}

// Copy default themes & keyboard layouts & fonts
signale.pending("Mirroring internal assets...");
try {
    fs.mkdirSync(themesDir);
} catch(e) {
    // Folder already exists
}
fs.readdirSync(innerThemesDir).forEach(e => {
    fs.writeFileSync(path.join(themesDir, e), fs.readFileSync(path.join(innerThemesDir, e), {encoding:"utf-8"}));
});
try {
    fs.mkdirSync(kblayoutsDir);
} catch(e) {
    // Folder already exists
}
fs.readdirSync(innerKblayoutsDir).forEach(e => {
    fs.writeFileSync(path.join(kblayoutsDir, e), fs.readFileSync(path.join(innerKblayoutsDir, e), {encoding:"utf-8"}));
});
try {
    fs.mkdirSync(fontsDir);
} catch(e) {
    // Folder already exists
}
fs.readdirSync(innerFontsDir).forEach(e => {
    fs.writeFileSync(path.join(fontsDir, e), fs.readFileSync(path.join(innerFontsDir, e)));
});

// Version history logging
const versionHistoryPath = path.join(electron.app.getPath("userData"), "versions_log.json");
var versionHistory = fs.existsSync(versionHistoryPath) ? require(versionHistoryPath) : {};
var version = app.getVersion();
if (typeof versionHistory[version] === "undefined") {
	versionHistory[version] = {
		firstSeen: Date.now(),
		lastSeen: Date.now()
	};
} else {
	versionHistory[version].lastSeen = Date.now();
}
fs.writeFileSync(versionHistoryPath, JSON.stringify(versionHistory, 0, 2), {encoding:"utf-8"});

function createWindow(settings) {
    signale.info("Creating window...");

    let display;
    if (!isNaN(settings.monitor)) {
        display = electron.screen.getAllDisplays()[settings.monitor] || electron.screen.getPrimaryDisplay();
    } else {
        display = electron.screen.getPrimaryDisplay();
    }
    let {x, y, width, height} = display.bounds;
    win = new BrowserWindow({
        title: "neoDEX-UI",
        x,
        y,
        width,
        height,
        show: false,
        resizable: true,
        movable: settings.allowWindowed || false,
        fullscreen: settings.forceFullscreen || false,
        autoHideMenuBar: true,
        frame: settings.allowWindowed || false,
        // Windows: a frameless resizable window otherwise keeps invisible resize borders, which made the
        // fullscreen viewport larger than the display (e.g. 2576x1608 on 2560x1600) and broke the ratio CSS
        thickFrame: settings.allowWindowed || false,
        backgroundColor: '#000000',
        webPreferences: {
            devTools: true,
            // TODO: enable contextIsolation + sandbox once the renderer stops using Node APIs directly
            sandbox: false,
            contextIsolation: false,
            backgroundThrottling: false,
            webSecurity: true,
            nodeIntegration: true,
            nodeIntegrationInSubFrames: false,
            allowRunningInsecureContent: false,
            experimentalFeatures: settings.experimentalFeatures || false
        }
    });

    win.loadFile(path.join(__dirname, "ui.html"));

    signale.complete("Frontend window created!");
    win.show();
    if (!settings.allowWindowed) {
        win.setResizable(false);
    } else if (!require(lastWindowStateFile)["useFullscreen"]) {
        win.setFullScreen(false);
    }

    // On UI reload, keep the main shell alive (buffering its output) but drop the extra tabs, whose
    // frontends are gone. Same behaviour as the old WebSocket disconnect handling.
    win.webContents.on("did-start-loading", () => {
        if (tty) tty.detachRenderer();
        closeExtraTtys();
    });

    // See #413 - keep a 16:9 geometry in windowed mode
    let resizeTimeout = null;
    win.on("resize", () => {
        if (keepGeometry === false) return;
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if (win.isDestroyed() || win.isFullScreen()) return;
            if (win.isMaximized()) {
                win.unmaximize();
                win.setFullScreen(true);
                return;
            }
            let size = win.getSize();
            let base = Math.max(size[0], size[1]);
            win.setSize(base, parseInt(base * 9 / 16));
        }, 100);
    });
    win.on("leave-full-screen", () => {
        win.setSize(960, 540);
    });

    signale.watch("Waiting for frontend connection...");
}

function closeExtraTtys() {
    if (!extraTtys) return;
    Object.keys(extraTtys).forEach(key => {
        if (extraTtys[key] !== null && typeof extraTtys[key].close === "function") {
            extraTtys[key].onclosed = () => {};
            extraTtys[key].close();
        }
        extraTtys[key] = null;
    });
}

let keepGeometry = true;

// Replacements for the @electron/remote calls previously made from the renderer
ipc.on("app-info", e => {
    // Synchronous, needed before the renderer can load its config. Read-only, non-sensitive info.
    e.returnValue = isTrustedSender(e.sender) ? {
        version: app.getVersion(),
        userData: app.getPath("userData"),
        argv: process.argv
    } : null;
});
onTrusted("app-focus", () => app.focus());
onTrusted("app-quit", () => app.quit());
onTrusted("app-relaunch", () => {
    app.relaunch();
    app.quit();
});
onTrusted("toggle-devtools", () => win.webContents.toggleDevTools());
onTrusted("window-minimize", () => win.minimize());
onTrusted("window-set-keep-geometry", (e, value) => {
    keepGeometry = (value !== false);
});
handleTrusted("window-toggle-fullscreen", () => {
    let useFullscreen = !win.isFullScreen();
    win.setFullScreen(useFullscreen);
    return useFullscreen;
});
handleTrusted("display-count", () => screen.getAllDisplays().length);
handleTrusted("clipboard-read", () => clipboard.readText());
handleTrusted("open-config-file", (e, which) => {
    const files = {settings: settingsFile, shortcuts: shortcutsFile};
    if (!files[which]) throw new Error("Unknown config file");
    win.minimize();
    return shell.openPath(files[which]);
});

// Global shortcuts: the renderer sends the list of accelerators, we notify it by index when one fires
onTrusted("shortcuts-register", (e, triggers) => {
    globalShortcut.unregisterAll();
    if (!Array.isArray(triggers)) return;
    triggers.forEach((trigger, index) => {
        if (typeof trigger !== "string") return;
        try {
            globalShortcut.register(trigger, () => {
                if (win && !win.isDestroyed()) win.webContents.send("shortcut-triggered", index);
            });
        } catch(err) {
            signale.warn(`Could not register shortcut ${trigger}: ${err.message}`);
        }
    });
});
onTrusted("shortcuts-unregister", () => globalShortcut.unregisterAll());

app.on('ready', async () => {
    signale.pending(`Loading settings file...`);
    let settings = require(settingsFile);
    signale.pending(`Resolving shell path...`);
    settings.shell = await which(settings.shell).catch(e => { throw(e) });
    signale.info(`Shell found at ${settings.shell}`);
    signale.success(`Settings loaded!`);

    if (!require("fs").existsSync(settings.cwd)) throw new Error("Configured cwd path does not exist.");

    // See #366
    let cleanEnv = await require("shell-env")(settings.shell).catch(e => { throw e; });

    Object.assign(cleanEnv, {
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
        TERM_PROGRAM: "neoDEX-UI",
        TERM_PROGRAM_VERSION: app.getVersion()
    }, settings.env);

    signale.pending(`Creating new terminal process`);
    tty = new Terminal({
        role: "server",
        id: 0,
        shell: settings.shell,
        params: settings.shellArgs || '',
        cwd: settings.cwd,
        env: cleanEnv,
        isTrustedSender
    });
    signale.success(`Terminal back-end initialized!`);
    tty.onclosed = (code, signal) => {
        signale.complete("Terminal exited", code, signal);
        app.quit();
    };
    tty.onopened = () => {
        signale.success("Connected to frontend!");
        signale.timeEnd("Startup");
    };
    tty.onresized = (cols, rows) => {
        signale.info("Resized TTY to ", cols, rows);
    };

    // Support for multithreaded systeminformation calls
    signale.pending("Starting systeminformation backend...");
    require("./_multithread.js")(ipc, isTrustedSender);

    createWindow(settings);

    // Support for more terminals, used for creating tabs (currently limited to 4 extra terms, IDs 1-4)
    extraTtys = {};
    for (let i = 1; i <= 4; i++) {
        extraTtys[i] = null;
    }

    onTrusted("ttyspawn", (e, arg) => {
        let id = Object.keys(extraTtys).find(key => extraTtys[key] === null);

        if (typeof id === "undefined") {
            signale.error("TTY spawn denied (Reason: exceeded max TTYs number)");
            e.sender.send("ttyspawn-reply", "ERROR: max number of ttys reached");
            return;
        }

        signale.pending(`Creating new TTY process #${id}`);
        let term = new Terminal({
            role: "server",
            id: Number(id),
            shell: settings.shell,
            params: settings.shellArgs || '',
            // Start where the main shell is, unless that directory has since been deleted
            cwd: [tty.tty._cwd, settings.cwd].find(dir => dir && fs.existsSync(dir)) || require("os").homedir(),
            env: cleanEnv,
            isTrustedSender
        });
        signale.success(`New terminal back-end initialized as #${id}`);
        term.onclosed = (code, signal) => {
            signale.complete(`TTY #${id} exited`, code, signal);
            extraTtys[id] = null;
        };
        term.onopened = pid => {
            signale.success(`TTY #${id} connected to frontend (process PID ${pid})`);
        };

        extraTtys[id] = term;
        e.sender.send("ttyspawn-reply", "SUCCESS: "+id);
    });

    // Backend support for theme and keyboard hotswitch
    let themeOverride = null;
    let kbOverride = null;
    onTrusted("getThemeOverride", (e, arg) => {
        e.sender.send("getThemeOverride", themeOverride);
    });
    onTrusted("getKbOverride", (e, arg) => {
        e.sender.send("getKbOverride", kbOverride);
    });
    onTrusted("setThemeOverride", (e, arg) => {
        themeOverride = arg;
    });
    onTrusted("setKbOverride", (e, arg) => {
        kbOverride = arg;
    });
});

app.on('web-contents-created', (e, contents) => {
    // Prevent creating more than one window; only hand http(s) links to the system browser
    contents.setWindowOpenHandler(({url}) => {
        if (/^https?:\/\//i.test(url)) shell.openExternal(url);
        return {action: "deny"};
    });

    // Prevent loading something else than the UI
    contents.on('will-navigate', (e, url) => {
        if (url !== contents.getURL()) e.preventDefault();
    });
});

app.on('window-all-closed', () => {
    signale.info("All windows closed");
    app.quit();
});

app.on('before-quit', () => {
    globalShortcut.unregisterAll();
    if (tty) {
        tty.onclosed = () => {};
        tty.close();
    }
    closeExtraTtys();
    signale.complete("Shutting down...");
});
