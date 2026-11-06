# Roadmap

Outstanding work for neoDEX-UI, roughly in priority order.

## CI (removed for now, to be put back)

The upstream GitHub Actions workflows were removed in November 2026: they targeted Node 14, npm 7 and CodeQL v1 and could no longer run. Restore these when there's something for them to do:

- [x] **Tests on every push/PR** (`.github/workflows/test.yml`): unit + end-to-end on Windows, macOS and Linux runners.
- [ ] **Release builds.** Once packaging is verified with electron-builder 26: build the Windows installer, macOS dmg and Linux AppImages on tag push, and attach them to a GitHub release. Use native ARM runners rather than QEMU for arm64.
- [ ] **CodeQL** (v3) for JavaScript, on push to `master` and weekly.
- [ ] Turn on **Dependabot alerts** and **private vulnerability reporting** in the repo settings (no workflow needed; `SECURITY.md` already points at private reporting).

## Testing

- [x] Isolated config dir for tests (`NEODEX_USER_DATA`), so test runs never touch the real settings.
- [x] Playwright Electron end-to-end suite (`npm test`, see `tests/e2e/README.md`): boot, terminals, file browser, settings, layout at five ratios, security regressions.
- [x] `node:test` unit tests (`npm run test:unit`, under a second) for the logic extracted to `src/lib/`: shell integration (including a real PowerShell run), OSC cwd parsing, IPC input validation, the systeminformation allowlist, `env` setting parsing, HTML/CSS escaping, default config.
- [ ] Unit-test more of the main process as it moves out of the classes (e.g. the IPC sender guard in `_boot.js`, terminal output buffering).

## Security

- [ ] Enable `contextIsolation` and the sandbox with a preload/`contextBridge` API. Requires moving the renderer's direct `fs` use (file browser, settings, themes) behind IPC. Then the CSP's missing `'unsafe-eval'` takes effect (Chromium ignores it while `nodeIntegration` is on): drop the `window.eval` override in `_renderer.js` and extend the eval test in `security.spec.js` to cover `new Function()`.
- [ ] Remove the remaining inline `onclick` handlers (keyboard, file browser, shell tabs) so the CSP can drop `'unsafe-inline'`. Includes the disk-path string in `filesystem.class.js` (`readFS("${e.path}")`).
- [ ] Make the `myexternalip.com` lookup (runs on every start) opt-in.

## Upgrades and platforms

- [ ] Verify packaging (`prebuild-*` / `build-*`, electron-builder 26, `prebuild-minify.js`). On macOS, node-pty's `spawn-helper` must stay executable and be unpacked from the asar archive (`asarUnpack`), or shells fail with `posix_spawnp failed` (`scripts/postinstall.js` handles this for development installs).
- [ ] Test on macOS and Linux. macOS: tab process names use `ps --no-headers`, which BSD `ps` doesn't support.
- [ ] Replace `geolite2-redist` (deprecated; MaxMind licensing changed) for the globe's GeoIP lookups.
- [ ] Review the 8 `npm audit` findings at the root.
- [ ] Revisit `@xterm/addon-webgl` in a later release (0.19 ignores the bundled web fonts).

## Branding

- [x] Interim neoDEX-UI wordmark and app icons, generated from hand-drawn glyphs by `scripts/icons/` (no font outlines, so no font-licence concerns).
- [ ] Optional: a properly designed logo and icon set to replace the interim ones (regenerate the PNG/ICO/ICNS with `scripts/icons/render.js`).
- [ ] Optional: one-time import of settings/themes from an existing eDEX-UI config dir.

## Smaller items

- [ ] Decide whether to keep the in-app PDF viewer (pdf.js) or open PDFs in the system viewer.
- [ ] Load config files without `require()`, so a typo in `settings.json` shows an error instead of crashing.
- [ ] Stop overwriting the built-in themes on every start.
- [ ] Settings validation and versioning.
