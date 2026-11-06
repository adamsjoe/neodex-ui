// Layout: the window must match the display, and no panel may spill into another at any supported ratio.
// Uses geometry, not screenshots: the clock, graphs and globe change every frame.
const { test, expect } = require("@playwright/test");
const { launchApp, inPage } = require("./helpers");

test.describe.configure({ mode: "serial" });

let ctx, cdp;
test.beforeAll(async () => {
    ctx = await launchApp();
    cdp = await ctx.page.context().newCDPSession(ctx.page);
});
test.afterAll(async () => {
    if (cdp) await cdp.send("Emulation.clearDeviceMetricsOverride").catch(() => {});
    if (ctx) await ctx.close();
});

test("fullscreen window is exactly the size of the display", async () => {
    // Regression: a frameless window on Windows kept invisible resize borders, making the viewport
    // larger than the screen (2576x1608 on 2560x1600), which broke the aspect-ratio CSS
    const size = await inPage(ctx.app, () => ({ w: innerWidth, h: innerHeight, sw: screen.width, sh: screen.height }));
    expect(size.w).toBe(size.sw);
    expect(size.h).toBe(size.sh);
});

// Measures everything the checks below need, in the current viewport
function measure(app) {
    return inPage(app, () => {
        const rect = el => el.getBoundingClientRect();
        const shell = rect(document.getElementById("main_shell"));
        const visibleDescendants = id => [...document.querySelectorAll(`#${id} *`)]
            .map(rect).filter(r => r.width > 0 && r.height > 0);
        const [enterTop, enterBottom] = [...document.querySelectorAll(".keyboard_enter")];
        const topRect = rect(enterTop), bottomRect = rect(enterBottom);
        const topBorder = parseFloat(getComputedStyle(enterTop).borderBottomWidth);
        return {
            shellLeft: shell.left,
            shellRight: shell.right,
            leftColumnMaxRight: Math.max(...visibleDescendants("mod_column_left").map(r => r.right)),
            rightColumnMinLeft: Math.min(...visibleDescendants("mod_column_right").map(r => r.left)),
            toplistBottom: rect(document.getElementById("mod_toplist")).bottom,
            // Some layouts (4:3, 5:4) hide the file browser entirely
            filesystemVisible: getComputedStyle(document.getElementById("filesystem")).display !== "none",
            filesystemTop: rect(document.getElementById("filesystem")).top,
            enterRightEdgeDelta: Math.abs(topRect.right - bottomRect.right),
            // The lower half should start where the upper half's bottom border starts
            enterJoinDelta: Math.abs((topRect.bottom - topBorder) - bottomRect.top)
        };
    });
}

const ratios = [
    { name: "16:9", width: 2560, height: 1440 },
    { name: "16:10", width: 2560, height: 1600 },
    { name: "21:9", width: 2560, height: 1080 },
    { name: "4:3", width: 1600, height: 1200 },
    { name: "5:4", width: 1280, height: 1024 }
];

for (const ratio of ratios) {
    test(`no panel overflows at ${ratio.name} (${ratio.width}x${ratio.height})`, async () => {
        await cdp.send("Emulation.setDeviceMetricsOverride", { width: ratio.width, height: ratio.height, deviceScaleFactor: 1, mobile: false });
        await ctx.page.waitForTimeout(500); // let layout settle after the resize

        const m = await measure(ctx.app);
        expect.soft(m.leftColumnMaxRight, "left panel content must not reach into the terminal").toBeLessThanOrEqual(m.shellLeft + 0.5);
        expect.soft(m.rightColumnMinLeft, "right panel content must not reach into the terminal").toBeGreaterThanOrEqual(m.shellRight - 0.5);
        if (m.filesystemVisible) {
            expect.soft(m.toplistBottom, "top processes must not overlap the file browser").toBeLessThanOrEqual(m.filesystemTop);
        }
        expect.soft(m.enterRightEdgeDelta, "ENTER key halves should share a right edge").toBeLessThanOrEqual(1.5);
        expect.soft(m.enterJoinDelta, "ENTER key halves should join without a gap or overlap").toBeLessThanOrEqual(1.5);
    });
}
