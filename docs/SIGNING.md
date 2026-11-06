# Code signing plan

The installers are currently **unsigned**. Windows SmartScreen warns about an "unrecognised app" (users click *More info* → *Run anyway*) and macOS Gatekeeper blocks the first launch (users right-click → *Open*). This document records how to fix that. Nothing here is set up yet.

Signing needs a certificate tied to the maintainer's identity, so the accounts have to be obtained by the maintainer. Once credentials exist, the rest (electron-builder config, release workflow steps, GitHub secrets) is straightforward to add.

> Pricing and eligibility change often. Check each provider's current terms before choosing.

## Windows (SmartScreen)

A code-signing certificate is needed. Since 2023 the private key must live on a hardware token or a cloud HSM, so in practice it's one of:

| Option | Rough cost | Notes |
|---|---|---|
| **SignPath Foundation** | Free for open-source projects | Apply and the project is reviewed. Signing runs through their service from CI; the certificate is issued in their name. **Likely the best fit for neoDEX-UI.** |
| **Certum Open Source Code Signing** | Low (tens of euros/year) | Issued to the developer personally, with a cloud key (SimplySign). Signing from CI is fiddlier than SignPath. |
| **Azure Trusted Signing** (Microsoft) | ~$10/month | Cleanest CI integration (electron-builder supports it via `win.azureSignOptions`). Eligibility for individuals has been limited by country — check whether the UK is supported. |
| Standard OV/EV certificate from a commercial CA | Hundreds/year | Works, but no advantage here for the cost. |

Note: signing doesn't remove the SmartScreen warning immediately. Since 2024 even EV certificates don't get instant reputation; it builds up as signed builds are downloaded.

### Work needed once a certificate exists
- Store the signing credentials as GitHub Actions secrets (used only by the release workflow).
- Configure signing in the `build.win` section of `package.json` (or the provider's CI action for SignPath).
- Sign in `.github/workflows/release.yml` only; regular CI builds stay unsigned.

## macOS (Gatekeeper)

The only route is the **Apple Developer Program ($99/year)**:

- A **Developer ID Application** certificate signs the app.
- **Notarization** (Apple scans the app) is then required for Gatekeeper to accept it without a warning. electron-builder does this as part of the build.

### Work needed once the membership exists
- GitHub secrets: the certificate (`CSC_LINK`, `CSC_KEY_PASSWORD`) and notarization credentials (an App Store Connect API key, or `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID`).
- `build.mac` in `package.json`: `hardenedRuntime: true`, an entitlements file allowing what Electron's V8 needs (`com.apple.security.cs.allow-jit`, `com.apple.security.cs.allow-unsigned-executable-memory`), and `notarize: true`.
- Check that node-pty's `spawn-helper` (unpacked from the asar archive) is signed too; otherwise shells fail to start under the hardened runtime.

## Linux

AppImages don't need signing.

## Free, available now

- **SHA-256 checksums** attached to each release, so downloads can be verified against what CI built. One extra step in the release workflow.

## Recommendation

1. Add checksums to the release workflow (free, no accounts).
2. Apply to **SignPath Foundation** for Windows.
3. Join the **Apple Developer Program** if macOS users matter.
4. Linux: nothing to do.
