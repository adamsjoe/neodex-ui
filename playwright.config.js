// End-to-end tests that drive the real Electron app. See tests/e2e/README.md.
const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
    testDir: "tests/e2e",
    // One app instance at a time: it opens fullscreen and spawns real shells
    workers: 1,
    fullyParallel: false,
    timeout: (process.env.CI ? 180 : 90) * 1000,
    // CI runners (Windows especially) are several times slower than a desktop
    expect: { timeout: (process.env.CI ? 45 : 15) * 1000 },
    retries: process.env.CI ? 1 : 0,
    // On CI, "github" turns each failure into an annotation on the workflow run (readable without the logs)
    reporter: process.env.CI ? [["github"], ["list"], ["html", { open: "never" }]] : "list",
    outputDir: "test-results"
});
