// Security regressions: the old WebSocket shell server must stay gone, and the backend must only obey
// the app's own window.
const path = require("path");
const { test, expect } = require("@playwright/test");
const { launchApp, inPage, clickModalButton, readTerminal, runCommand, expectTerminalToContain } = require("./helpers");

test.describe.configure({ mode: "serial" });

let ctx;
test.beforeAll(async () => { ctx = await launchApp(); });
test.afterAll(async () => { if (ctx) await ctx.close(); });

test("no app process listens on the old WebSocket ports (3000-3006)", async () => {
    // eDEX-UI exposed every shell over ws://<any interface>:3000+ with no origin check
    const si = require(path.join(__dirname, "..", "..", "src", "node_modules", "systeminformation"));
    const pids = await ctx.app.evaluate(({ app }) => app.getAppMetrics().map(m => m.pid));
    const listeners = (await si.networkConnections())
        .filter(c => c.state === "LISTEN" && pids.includes(Number(c.pid)))
        .map(c => Number(c.localPort));
    expect(listeners.filter(port => port >= 3000 && port <= 3006)).toEqual([]);
});

test("other web contents cannot drive the terminal or call the backend", async () => {
    const { app } = ctx;

    // A second, untrusted page with full Node access tries to use the app's IPC channels
    const result = await app.evaluate(async ({ BrowserWindow }) => {
        const intruder = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: true, contextIsolation: false, sandbox: false } });
        await intruder.loadURL("data:text/html,<p>intruder</p>");
        const outcome = await intruder.webContents.executeJavaScript(`(async () => {
            const { ipcRenderer } = require("electron");
            ipcRenderer.send("terminal_channel-0", "Data", "echo INJECTED_$((3*3))\\r");
            const appInfo = ipcRenderer.sendSync("boot-data");
            let clipboard;
            try { await ipcRenderer.invoke("clipboard-read"); clipboard = "allowed"; } catch (e) { clipboard = "rejected"; }
            return { appInfo, clipboard };
        })()`);
        intruder.destroy();
        return outcome;
    });

    expect(result.appInfo).toBeNull();
    expect(result.clipboard).toBe("rejected");

    // Give an injected command time to run, then prove the shell is alive but never received it
    await runCommand(app, "echo CANARY_$((4*4))");
    await expectTerminalToContain(app, "CANARY_16");
    expect(await readTerminal(app)).not.toContain("INJECTED_9");
});

test("page scripts cannot call eval()", async () => {
    // Only eval() is blocked today, by an override in _renderer.js: Chromium doesn't enforce the CSP's
    // missing 'unsafe-eval' while nodeIntegration is on. Once contextIsolation is enabled the CSP applies,
    // and this test should also require new Function() to be blocked (see ROADMAP.md).
    const outcome = await inPage(ctx.app, () => {
        try { window.eval("1 + 1"); return "allowed"; } catch (e) { return e.message; }
    });
    expect(outcome).toMatch(/eval\(\) is disabled/);
});

test("no element uses inline event handler attributes", async () => {
    // Inline handlers (onclick="...") need 'unsafe-inline' in the CSP; the UI wires listeners in code instead
    const inline = await inPage(ctx.app, () => [...document.querySelectorAll("*")]
        .flatMap(el => [...el.attributes].filter(a => /^on/i.test(a.name)).map(a => `${el.tagName.toLowerCase()}[${a.name}]`)));
    expect(inline).toEqual([]);
});

test("the CSP blocks inline scripts", async () => {
    const ran = await inPage(ctx.app, () => {
        window.__inlineRan = false;
        const script = document.createElement("script");
        script.textContent = "window.__inlineRan = true;";
        document.head.appendChild(script);
        script.remove();
        return window.__inlineRan;
    });
    expect(ran).toBe(false);
});

test("modal buttons use real listeners, not inline code", async () => {
    const { app, page } = ctx;
    await inPage(app, () => { window.openSettings(); });
    await expect(page.locator("#settingsEditor")).toBeVisible();
    await expect(page.locator(".modal_popup button")).not.toHaveCount(0);
    await expect(page.locator(".modal_popup button[onclick]")).toHaveCount(0);
    await clickModalButton(app, "Close");
    await expect(page.locator("#settingsEditor")).toHaveCount(0);
});
