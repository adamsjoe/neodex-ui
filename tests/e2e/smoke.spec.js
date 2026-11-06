// Core behaviour: boot, terminals, file browser, modals.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { test, expect } = require("@playwright/test");
const { launchApp, inPage, waitInPage, clickModalButton, runCommand, expectTerminalToContain } = require("./helpers");

test.describe.configure({ mode: "serial" });

// Smallest valid one-page PDF (pdf.js tolerates the approximate xref offsets)
const MINIMAL_PDF = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >> endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
trailer << /Size 4 /Root 1 0 R >>
startxref
186
%%EOF
`;

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

        // Refreshes when the directory changes (watched by the main process)
        fs.writeFileSync(path.join(dir, "created-later.txt"), "new");
        await expect(page.locator("#fs_disp_container")).toContainText("created-later.txt");

        // Opening a text file shows it in the editor, and saving writes it back (through the main process)
        await inPage(app, () => {
            const index = window.fsDisp.cwd.findIndex(e => e.name === "marker-file.txt");
            window.fsDisp.openFile(index);
        });
        const editor = page.locator(".modal_popup textarea.fileEdit");
        await expect(editor).toHaveValue("hello");
        await inPage(app, () => { document.querySelector(".modal_popup textarea.fileEdit").value = "edited in neoDEX"; });
        await clickModalButton(app, "Save to Disk");
        await expect(page.locator(".modal_popup p.fedit-status")).toHaveText("File saved.");
        expect(fs.readFileSync(path.join(dir, "marker-file.txt"), "utf-8")).toBe("edited in neoDEX");
        await clickModalButton(app, "Close");

        // PDFs open in the built-in viewer (pdf.js, file bytes read through the main process)
        fs.writeFileSync(path.join(dir, "doc.pdf"), MINIMAL_PDF);
        await expect(page.locator("#fs_disp_container")).toContainText("doc.pdf");
        await inPage(app, () => {
            window.fsDisp.openFile(window.fsDisp.cwd.findIndex(e => e.name === "doc.pdf"));
        });
        await expect(page.locator(".modal_popup .page_count")).toHaveText("1");
        await clickModalButton(app, "Close");
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

test("system information is gathered in utility processes, not the main process", async () => {
    // Several systeminformation calls block (synchronous child processes on Windows); in the main process
    // they froze terminal I/O every couple of seconds
    const workers = await ctx.app.evaluate(({ app }) =>
        app.getAppMetrics().filter(m => m.type === "Utility" && m.name === "neoDEX-UI systeminformation").length);
    expect(workers).toBeGreaterThanOrEqual(1);
});

test("top processes shows a header row and process rows", async () => {
    const { page } = ctx;
    await expect(page.locator("#mod_toplist_table th")).toHaveText(["PID", "NAME", "CPU", "MEM"]);
    await expect.poll(() => page.locator("#mod_toplist_table > tr").count()).toBeGreaterThan(0);
});

test("the tab shows the terminal's foreground process (Linux and macOS)", async () => {
    test.skip(process.platform === "win32", "Windows has no way to read a terminal's foreground process");
    const { app, page } = ctx;
    await runCommand(app, "sleep 4");
    await expect(page.locator("#shell_tab0")).toHaveText(/MAIN - sleep/);
    // Back to the shell once it finishes
    await expect(page.locator("#shell_tab0")).not.toHaveText(/sleep/, { timeout: 30000 });
});
