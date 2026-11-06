// Settings editor: validation, saving, and the theme picker's live preview.
const fs = require("fs");
const path = require("path");
const { test, expect } = require("@playwright/test");
const { launchApp, inPage, clickModalButton } = require("./helpers");

test.describe.configure({ mode: "serial" });

let ctx;
test.beforeAll(async () => { ctx = await launchApp(); });
test.afterAll(async () => { if (ctx) await ctx.close(); });

const savedSettings = () => JSON.parse(fs.readFileSync(path.join(ctx.userData, "settings.json"), "utf-8"));

// Sets a field the way typing/clicking would, firing its input and change events
function setField(key, value) {
    return inPage(ctx.app, ([k, v]) => {
        const el = document.getElementById(`settingsEditor-${k}`);
        if (el.type === "checkbox") el.checked = v; else el.value = v;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
    }, [key, value]);
}
const cssColorR = () => inPage(ctx.app, () => getComputedStyle(document.documentElement).getPropertyValue("--color_r").trim());
const terminalForeground = () => inPage(ctx.app, () => window.term[0].term.options.theme.foreground);

async function openEditor() {
    await inPage(ctx.app, () => window.openSettings().then(() => true)); // (the editor object itself can't cross IPC)
    await expect(ctx.page.locator("#settingsEditor")).toBeVisible();
}
// Like a user: switch to the Appearance tab, then click a theme card
function pickTheme(name) {
    return inPage(ctx.app, n => {
        document.querySelector('.settings_tab[data-section="Appearance"]').click();
        document.querySelector(`.theme_card[data-theme="${n}"]`).click();
    }, name);
}
async function closeEditor() {
    await clickModalButton(ctx.app, "Close");
    await expect(ctx.page.locator("#settingsEditor")).toHaveCount(0);
}

test("an invalid value is flagged, and nothing is saved", async () => {
    const before = savedSettings();
    await openEditor();
    await setField("termFontSize", "99");
    await expect(ctx.page.locator("#settingsEditor-termFontSize-error")).toHaveText("Must be between 8 and 40");
    await expect(ctx.page.locator('.settings_tab[data-section="Appearance"]')).toHaveClass(/invalid/);

    await clickModalButton(ctx.app, "Save");
    await expect(ctx.page.locator("#settingsEditorStatus")).toContainText("Not saved");
    expect(savedSettings()).toEqual(before);
    await closeEditor();
});

test("a valid change is saved, and the editor says it needs a reload", async () => {
    await openEditor();
    await setField("hideDotfiles", true);
    await setField("termFontSize", "17");
    await clickModalButton(ctx.app, "Save");
    await expect(ctx.page.locator("#settingsEditorStatus")).toContainText("Saved. Reload the UI");
    await expect(ctx.page.locator("#settingsEditor-apply")).toHaveText("Reload now");

    const saved = savedSettings();
    expect(saved.hideDotfiles).toBe(true);
    expect(saved.termFontSize).toBe(17);
    expect(saved).not.toHaveProperty("nointroOverride"); // runtime-only flags stay out of the file
    await closeEditor();
});

test("a setting that's read at startup asks for a restart", async () => {
    await openEditor();
    await setField("allowWindowed", true);
    await clickModalButton(ctx.app, "Save");
    await expect(ctx.page.locator("#settingsEditor-apply")).toHaveText("Restart now");
    expect(savedSettings().allowWindowed).toBe(true);
    await closeEditor();
});

test("clicking a theme previews it live; closing without saving reverts it", async () => {
    const originalR = await cssColorR();
    const originalForeground = await terminalForeground();
    await openEditor();
    await pickTheme("blade");
    await expect.poll(cssColorR).toBe("204");                    // blade's main colour
    await expect.poll(terminalForeground).toBe("#cc5e37");       // and the terminal follows
    await closeEditor();

    await expect.poll(cssColorR).toBe(originalR);
    await expect.poll(terminalForeground).toBe(originalForeground);
    expect(savedSettings().theme).toBe("tron");
});

test("saving keeps the previewed theme", async () => {
    await openEditor();
    await pickTheme("blade");
    await clickModalButton(ctx.app, "Save");
    await expect(ctx.page.locator("#settingsEditorStatus")).toContainText("Saved");
    await closeEditor();

    expect(savedSettings().theme).toBe("blade");
    await expect.poll(cssColorR).toBe("204"); // still applied after closing
});

test("the main process rejects invalid settings even if the UI is bypassed", async () => {
    const before = savedSettings();
    const result = await inPage(ctx.app, () => window.neodex.invoke("settings-save",
        { shell: "bash", cwd: "/definitely/missing", theme: "no-such-theme", termFontSize: 500, pingAddr: "1.1.1.1" }));
    expect(result.ok).toBe(false);
    expect(Object.keys(result.errors).sort()).toEqual(["cwd", "termFontSize", "theme"]);
    expect(savedSettings()).toEqual(before);
});
