// Core behaviour: boot, terminals, file browser, modals.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { test, expect } = require("@playwright/test");
const { launchApp, inPage, waitInPage, clickModalButton, runCommand, expectTerminalToContain } = require("./helpers");

test.describe.configure({ mode: "serial" });

let ctx;
test.beforeAll(async () => { ctx = await launchApp(); });
test.afterAll(async () => { if (ctx) await ctx.close(); });

test("boots without errors", async () => {
    const { app, page, pageErrors } = ctx;
    expect(await inPage(app, () => (window.edexErrorsModals || []).map(m => String(m.title)))).toEqual([]);
    expect(pageErrors.map(e => e.message)).toEqual([]);
    await expect(page.locator("#main_shell_tabs li").first()).toHaveText(/MAIN/);
});

test("main terminal runs commands and shows their output", async () => {
    // $((6*7)) is arithmetic in both bash and PowerShell; matching the result (not the typed text)
    // proves the command actually ran in the shell
    await runCommand(ctx.app, "echo NEO_$((6*7))");
    await expectTerminalToContain(ctx.app, "NEO_42");
});

test("file browser follows the terminal's working directory", async () => {
    const { app, page } = ctx;
    const normalise = s => (process.platform === "win32" ? s.toLowerCase() : s);
    const dir = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "neodex-cd-")));
    fs.writeFileSync(path.join(dir, "marker-file.txt"), "hello");
    try {
        await runCommand(app, `cd "${dir}"`);
        const title = page.locator("#fs_disp_title_dir");
        await expect.poll(async () => normalise(await title.innerText())).toBe(normalise(dir));
        await expect(page.locator("#fs_disp_container")).toContainText("marker-file.txt");
        await expect(page.locator("section#filesystem > h3.title > p").first()).not.toContainText("TRACKING FAILED");
    } finally {
        // Wait until the shell has really left the directory before deleting it (on Linux the backend
        // polls the shell's cwd once a second, and new tabs start in the last cwd it saw)
        await runCommand(app, "cd ..");
        await expect.poll(async () => normalise(await page.locator("#fs_disp_title_dir").innerText())).toBe(normalise(path.dirname(dir)));
        fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
});

test("a second tab gets its own shell, and closes cleanly on exit", async () => {
    const { app, page } = ctx;
    await inPage(app, () => { window.focusShellTab(1); });
    await waitInPage(app, () => Boolean(window.term[1] && window.term[1].term));

    await runCommand(app, "echo TAB_$((2+3))", 1);
    await expectTerminalToContain(app, "TAB_5", 1);

    await runCommand(app, "exit", 1);
    await expect(page.locator("#shell_tab1")).toHaveText("EMPTY");
    await expect.poll(() => inPage(app, () => typeof window.term[1])).toBe("undefined");

    // The main shell is unaffected
    await inPage(app, () => { window.focusShellTab(0); });
    await runCommand(app, "echo STILL_$((1+1))");
    await expectTerminalToContain(app, "STILL_2");
});

test("settings dialog opens and its buttons work", async () => {
    const { app, page } = ctx;
    await inPage(app, () => { window.openSettings(); });
    const modal = page.locator(".modal_popup", { has: page.locator("#settingsEditor") });
    await expect(modal).toBeVisible();
    await expect(modal.locator("#settingsEditor-shell")).toHaveValue(/.+/);

    await clickModalButton(app, "Close");
    await expect(page.locator("#settingsEditor")).toHaveCount(0);
});

test("top processes shows a header row and process rows", async () => {
    const { page } = ctx;
    await expect(page.locator("#mod_toplist_table th")).toHaveText(["PID", "NAME", "CPU", "MEM"]);
    await expect.poll(() => page.locator("#mod_toplist_table > tr").count()).toBeGreaterThan(0);
});
