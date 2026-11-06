// Shared helpers for the end-to-end tests: launch the app against a throwaway config directory,
// and drive/read its terminals.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { _electron: electron, expect } = require("@playwright/test");
const { defaultSettings, defaultShortcuts } = require("../../src/_defaults.js");

const repoRoot = path.resolve(__dirname, "..", "..");

/**
 * Runs `fn(arg)` in the app's UI page and returns its (JSON-serialisable) result.
 *
 * Use this instead of Playwright's page.evaluate()/waitForFunction(): those go through window.eval,
 * which the app deliberately disables. Electron's executeJavaScript compiles the code directly.
 */
function inPage(app, fn, arg) {
    return app.evaluate(({ BrowserWindow }, [source, argument]) => {
        const win = BrowserWindow.getAllWindows().find(w => !w.isDestroyed() && w.webContents.getURL().endsWith("/ui.html"));
        if (!win) throw new Error("UI window not found");
        return win.webContents.executeJavaScript(`(${source})(${JSON.stringify(argument)})`);
    }, [fn.toString(), arg === undefined ? null : arg]);
}

/** Polls `fn(arg)` in the UI page until it returns something truthy. */
async function waitInPage(app, fn, arg, { timeout = 15000, message } = {}) {
    await expect.poll(() => inPage(app, fn, arg).catch(() => false), { timeout, message }).toBeTruthy();
}

/**
 * Launches neoDEX-UI with an isolated config directory (never the user's real settings).
 * Resolves once the UI has finished booting. Collects uncaught page errors in `pageErrors`.
 */
async function launchApp({ settings = {} } = {}) {
    const userData = fs.mkdtempSync(path.join(os.tmpdir(), "neodex-test-"));
    const allSettings = Object.assign(defaultSettings({ platform: process.platform, userData }), {
        audio: false,
        nointro: true
    }, settings);
    fs.writeFileSync(path.join(userData, "settings.json"), JSON.stringify(allSettings, null, 4));
    fs.writeFileSync(path.join(userData, "shortcuts.json"), JSON.stringify(defaultShortcuts(), null, 4));

    const app = await electron.launch({
        args: [path.join(repoRoot, "src"), "--nointro"],
        cwd: repoRoot,
        env: Object.assign({}, process.env, {
            NEODEX_USER_DATA: userData,
            NEODEX_NO_ERROR_DIALOG: "1", // a crash should fail the test with its log, not hang on a modal dialog
            ELECTRON_ENABLE_LOGGING: "1" // renderer console messages also go to stderr
        })
    });

    // Keep the app's own output, so a failed launch can say why
    let log = "";
    const capture = chunk => { log = (log + chunk.toString()).slice(-20000); };
    app.process().stdout.on("data", capture);
    app.process().stderr.on("data", capture);

    let page;
    const pageErrors = [];
    try {
        page = await app.firstWindow({ timeout: 60 * 1000 });
        page.on("pageerror", err => pageErrors.push(err));

        // Boot is complete once the terminal, file browser and side modules exist
        await waitInPage(app, () => Boolean(window.term && window.term[0] && window.fsDisp && window.mods && window.mods.toplist), null,
            { timeout: 60 * 1000, message: "app should finish booting" });
    } catch (err) {
        await app.close().catch(() => {});
        fs.rmSync(userData, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
        err.message += `\n\n--- app output (last 20 KB) ---\n${log || "(none)"}`;
        throw err;
    }

    return {
        app,
        page,
        userData,
        pageErrors,
        /** Quits the app. If it hasn't exited within 30s, kills it and fails with its output. */
        async close() {
            let timer;
            const quit = app.close().then(() => "closed", () => "closed");
            const timeout = new Promise(resolve => { timer = setTimeout(() => resolve("timeout"), 30 * 1000); });
            const outcome = await Promise.race([quit, timeout]);
            clearTimeout(timer);
            if (outcome === "timeout") killProcessTree(app.process().pid);
            fs.rmSync(userData, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
            if (outcome === "timeout") {
                throw new Error(`app did not quit within 30s and was killed

--- app output (last 20 KB) ---
${log || "(none)"}`);
            }
        }
    };
}

/**
 * Clicks a modal button by its label, from inside the page. This fires the button's real click listener,
 * without waiting for the modal's open animation to settle (slow on CI) and without page.evaluate (see inPage).
 */
async function clickModalButton(app, label) {
    const clicked = await inPage(app, text => {
        const buttons = [...document.querySelectorAll(".modal_popup button")].filter(b => b.textContent === text);
        if (buttons.length === 0) return false;
        buttons[buttons.length - 1].click();
        return true;
    }, label);
    expect(clicked, `modal button "${label}" should exist`).toBe(true);
}

function killProcessTree(pid) {
    try {
        if (process.platform === "win32") {
            require("child_process").execSync(`taskkill /pid ${pid} /T /F`, { stdio: "ignore" });
        } else {
            process.kill(pid, "SIGKILL");
        }
    } catch (e) {
        // already gone
    }
}

/** Full text of a terminal's buffer (scrollback included). */
function readTerminal(app, tab = 0) {
    return inPage(app, n => {
        const buffer = window.term[n].term.buffer.active;
        const lines = [];
        for (let i = 0; i < buffer.length; i++) {
            const line = buffer.getLine(i);
            if (line) lines.push(line.translateToString(true));
        }
        return lines.join("\n");
    }, tab);
}

/** Types a command (plus Enter) into a terminal through the app's normal input path. */
function runCommand(app, command, tab = 0) {
    return inPage(app, ([n, cmd]) => { window.term[n].writelr(cmd); }, [tab, command]);
}

/** Waits until a terminal's buffer contains `text`. */
async function expectTerminalToContain(app, text, tab = 0) {
    await expect.poll(() => readTerminal(app, tab), { message: `terminal ${tab} should contain ${text}` }).toContain(text);
}

module.exports = {
    inPage,
    waitInPage,
    launchApp,
    clickModalButton,
    readTerminal,
    runCommand,
    expectTerminalToContain
};
