# Roadmap

Outstanding work for neoDEX-UI, roughly in priority order.

## CI (removed for now, to be put back)

The upstream GitHub Actions workflows were removed in November 2026: they targeted Node 14, npm 7 and CodeQL v1 and could no longer run. Restore these when there's something for them to do:

- [ ] **Tests on every push/PR.** Once the smoke tests exist: Node 22, `actions/*@v4`, run on Windows, macOS and Linux runners (Linux needs `xvfb` for Electron, and `npm approve-scripts node-pty` to build node-pty).
- [ ] **Release builds.** Once packaging is verified with electron-builder 26: build the Windows installer, macOS dmg and Linux AppImages on tag push, and attach them to a GitHub release. Use native ARM runners rather than QEMU for arm64.
- [ ] **CodeQL** (v3) for JavaScript, on push to `master` and weekly.
- [ ] Turn on **Dependabot alerts** and **private vulnerability reporting** in the repo settings (no workflow needed; `SECURITY.md` already points at private reporting).

## Testing

- [ ] Isolated config dir for tests (e.g. an `EDEX_USER_DATA`-style env var in `_boot.js`) so test runs never touch the real settings.
- [ ] Playwright Electron smoke suite: boot without error modals, terminal round trip (main shell and a second tab), file browser follows `cd`, settings modal buttons, layout checks at 16:9 / 16:10 / 21:9 / 4:3, nothing listening on the old port 3000, untrusted IPC rejected.
- [ ] `node:test` unit tests for main-process logic (shell integration args, OSC cwd parsing, IPC sender checks, systeminformation allowlist, `env` setting validation), after extracting it from the classes.

## Security

- [ ] Enable `contextIsolation` and the sandbox with a preload/`contextBridge` API. Requires moving the renderer's direct `fs` use (file browser, settings, themes) behind IPC.
- [ ] Remove the remaining inline `onclick` handlers (keyboard, file browser, shell tabs) so the CSP can drop `'unsafe-inline'`. Includes the disk-path string in `filesystem.class.js` (`readFS("${e.path}")`).
- [ ] Make the `myexternalip.com` lookup (runs on every start) opt-in.

## Upgrades and platforms

- [ ] Verify packaging (`prebuild-*` / `build-*`, electron-builder 26, `prebuild-minify.js`).
- [ ] Test on macOS and Linux. macOS: tab process names use `ps --no-headers`, which BSD `ps` doesn't support.
- [ ] Replace `geolite2-redist` (deprecated; MaxMind licensing changed) for the globe's GeoIP lookups.
- [ ] Review the 8 `npm audit` findings at the root.
- [ ] Revisit `@xterm/addon-webgl` in a later release (0.19 ignores the bundled web fonts).

## Branding

- [ ] New logo (`media/logo.png`, `media/logo.svg`) and app icons (`media/icon.ico`, `media/icon.icns`, `media/linuxIcons/`). They still show eDEX-UI.
- [ ] Optional: one-time import of settings/themes from an existing eDEX-UI config dir.

## Smaller items

- [ ] Decide whether to keep the in-app PDF viewer (pdf.js) or open PDFs in the system viewer.
- [ ] Load config files without `require()`, so a typo in `settings.json` shows an error instead of crashing.
- [ ] Stop overwriting the built-in themes on every start.
- [ ] Settings validation and versioning.
