# Roadmap

Outstanding work for neoDEX-UI, roughly in priority order.

## CI (removed for now, to be put back)

The upstream GitHub Actions workflows were removed in November 2026: they targeted Node 14, npm 7 and CodeQL v1 and could no longer run. Restore these when there's something for them to do:

- [x] **Tests on every push/PR** (`.github/workflows/test.yml`): unit + end-to-end on Windows, macOS and Linux runners.
- [ ] **Release builds.** CI already builds and tests the installers on every push (the `package` job); what's left is publishing them to a GitHub release on tag push, and code signing (Windows SmartScreen / macOS Gatekeeper).
- [ ] **CodeQL** (v3) for JavaScript, on push to `master` and weekly.
- [ ] Turn on **Dependabot alerts** and **private vulnerability reporting** in the repo settings (no workflow needed; `SECURITY.md` already points at private reporting).

## Testing

- [x] Isolated config dir for tests (`NEODEX_USER_DATA`), so test runs never touch the real settings.
- [x] Playwright Electron end-to-end suite (`npm test`, see `tests/e2e/README.md`): boot, terminals, file browser, settings, layout at five ratios, security regressions.
- [x] `node:test` unit tests (`npm run test:unit`, under a second) for the logic extracted to `src/lib/`: shell integration (including a real PowerShell run), OSC cwd parsing, IPC input validation, the systeminformation allowlist, `env` setting parsing, HTML/CSS escaping, default config.
- [ ] Unit-test more of the main process as it moves out of the classes (e.g. the IPC sender guard in `_boot.js`, terminal output buffering).

## Security

- [x] `contextIsolation`, sandbox and no Node integration for the UI page: it reaches the main process only through the preload's `window.neodex` API (an allowlist of IPC channels). The UI is bundled with esbuild (`npm run build:renderer`), and the CSP now blocks inline scripts and `eval()`.
- [x] No inline event handlers; CSP `script-src` without `'unsafe-inline'`.
- [ ] Make the `myexternalip.com` lookup (runs on every start) opt-in.

## Upgrades and platforms

- [x] Packaging verified: `npm run package` builds the Windows (NSIS), macOS (dmg, x64 + arm64) and Linux (AppImage) installers, and CI runs the end-to-end suite against each packaged app and uploads the installers.
- [x] macOS and Linux tested in CI (from source and packaged); tab names use node-pty's foreground process, which works on macOS too.
- [ ] Replace `geolite2-redist` (deprecated; MaxMind licensing changed) for the globe's GeoIP lookups.
- [ ] Review the 8 `npm audit` findings at the root.
- [ ] Revisit `@xterm/addon-webgl` in a later release (0.19 ignores the bundled web fonts).

## Branding

- [x] Interim neoDEX-UI wordmark and app icons, generated from hand-drawn glyphs by `scripts/icons/` (no font outlines, so no font-licence concerns).
- [ ] Optional: a properly designed logo and icon set to replace the interim ones (regenerate the PNG/ICO/ICNS with `scripts/icons/render.js`).
- [ ] Optional: one-time import of settings/themes from an existing eDEX-UI config dir.

## Smaller items

- [x] Keep the in-app PDF viewer (pdf.js 6, running in the isolated page; covered by the end-to-end tests).
- [x] Config files are parsed safely (`src/lib/config.js`): invalid JSON or the wrong shape falls back to defaults with a warning in the UI, missing keys get defaults, and a missing `cwd` falls back to the home folder.
- [ ] Stop overwriting the built-in themes on every start.
- [ ] Validate individual setting values (types/ranges) and version the settings format.
