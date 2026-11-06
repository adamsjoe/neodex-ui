// A broken config must not crash the app: it starts with defaults and says what's wrong.
const path = require("path");
const os = require("os");
const { test, expect } = require("@playwright/test");
const { launchApp, inPage, runCommand, expectTerminalToContain } = require("./helpers");

test("a settings.json with invalid JSON: starts with defaults and shows the problem", async () => {
    const ctx = await launchApp({ rawSettings: '{ "theme": "tron", "audio": false, }' });
    try {
        const warning = ctx.page.locator(".modal_popup", { hasText: "Configuration problem" });
        await expect(warning).toBeVisible();
        await expect(warning).toContainText("settings.json is not valid JSON");
        expect(await inPage(ctx.app, () => window.settings.theme)).toBe("tron");

        await runCommand(ctx.app, "echo CONFIG_$((5*5))");
        await expectTerminalToContain(ctx.app, "CONFIG_25");
    } finally {
        await ctx.close();
    }
});

test("a cwd that no longer exists: starts in the home folder and says so", async () => {
    const missing = path.join(os.tmpdir(), "neodex-definitely-missing-dir");
    const ctx = await launchApp({ settings: { cwd: missing } });
    try {
        const warning = ctx.page.locator(".modal_popup", { hasText: "Configuration problem" });
        await expect(warning).toContainText("doesn't exist");
        expect(await inPage(ctx.app, () => window.settings.cwd)).toBe(os.homedir());

        await runCommand(ctx.app, "echo HOME_$((6*6))");
        await expectTerminalToContain(ctx.app, "HOME_36");
    } finally {
        await ctx.close();
    }
});
