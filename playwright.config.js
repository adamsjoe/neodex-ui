// End-to-end tests that drive the real Electron app. See tests/e2e/README.md.
const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
    testDir: "tests/e2e",
    // One app instance at a time: it opens fullscreen and spawns real shells
    workers: 1,
    fullyParallel: false,
    timeout: 90 * 1000,
    expect: { timeout: 15 * 1000 },
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
    outputDir: "test-results"
});
