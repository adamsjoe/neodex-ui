# End-to-end tests

These tests launch the real app with [Playwright's Electron support](https://playwright.dev/docs/api/class-electron) and drive it: real shells, real IPC, real layout.

```
npm test
```

- **The app opens fullscreen** while the tests run (about 25 seconds), as it would for a user. Don't type while it's running.
- **Your settings are safe.** Each test file launches the app with its own temporary config directory (via the `NEODEX_USER_DATA` environment variable) with sound off, and deletes it afterwards.
- **Shells:** the tests use the default shell (PowerShell on Windows, bash elsewhere). Commands are written to work in both, e.g. `echo NEO_$((6*7))`, and assert on the *result* (`NEO_42`) so they prove the command actually ran.
- **Running JavaScript in the page:** use `inPage()` / `waitInPage()` from `helpers.js`, not `page.evaluate()` or `page.waitForFunction()`. The app disables `window.eval`, which Playwright's evaluation uses. Locators (`page.locator(...)`) work normally.

| File | Covers |
|---|---|
| `smoke.spec.js` | Boot, terminal round trip, second tab, file browser following `cd`, settings dialog, top processes |
| `layout.spec.js` | Window matches the display; no panel overflow and ENTER key alignment at 16:9, 16:10, 21:9, 4:3, 5:4 (emulated with DevTools) |
| `security.spec.js` | Old WebSocket ports closed, IPC from other pages rejected, `eval()` blocked, no inline `onclick` in modals |

On failure, Playwright saves details (including a screenshot) under `test-results/`.
