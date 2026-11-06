// Bundles the UI page's code (src/ui/index.js and everything it requires) into src/build/renderer.js,
// so the page needs no `require` and can run without Node integration.
// Usage: node scripts/build-renderer.js [--watch] [--minify]
const path = require("path");
const esbuild = require("esbuild");

const src = path.join(__dirname, "..", "src");

const options = {
    entryPoints: [path.join(src, "ui", "index.js")],
    outfile: path.join(src, "build", "renderer.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "chrome140",
    sourcemap: "linked",
    // Packaging builds are minified (scripts/prepare-package.js)
    minify: process.argv.includes("--minify"),
    legalComments: "linked",
    // Libraries resolve from the app's own dependencies in src/
    nodePaths: [path.join(src, "node_modules")],
    alias: {
        path: path.join(src, "ui", "shims", "path.js")
    },
    // Node's `global` (used by _renderer.js and some libraries) is `globalThis` in a browser page
    define: { global: "globalThis" },
    logLevel: "info"
};

(async () => {
    if (process.argv.includes("--watch")) {
        const ctx = await esbuild.context(options);
        await ctx.watch();
        console.log("Watching for changes...");
    } else {
        await esbuild.build(options);
    }
})().catch(() => process.exit(1));
