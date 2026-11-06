<p align="center">
  <br>
  <img alt="neoDEX-UI" src="media/logo-wordmark.svg" width="430">
  <br><br>
  <a href="https://github.com/adamsjoe/neodex-ui/blob/master/LICENSE"><img alt="License: GPL-3.0" src="https://img.shields.io/github/license/adamsjoe/neodex-ui.svg?style=popout"></a>
  <br><br>
</p>

neoDEX-UI is a fullscreen, cross-platform terminal emulator and system monitor that looks and feels like a sci-fi computer interface.

> **neoDEX-UI is an independent, maintained fork of [eDEX-UI](https://github.com/GitSquared/edex-ui)** by Gabriel "Squared" Saillard, which was archived in October 2021. It is not affiliated with or endorsed by the original author. The full history of the original project is preserved in this repository.

---

<a href="https://youtu.be/BGeY1rK19zA">
  <img align="right" width="400" alt="Demo of the original eDEX-UI on YouTube" src="media/youtube-demo-teaser.gif">
</a>

Heavily inspired from the [TRON Legacy movie effects](https://web.archive.org/web/20170511000410/http://jtnimoy.com/blogs/projects/14881671) (especially the [Board Room sequence](https://gmunk.com/TRON-Board-Room)), the original eDEX-UI project was meant to be *"[DEX-UI](https://github.com/seenaburns/dex-ui) with less « art » and more « distributable software »"*.

While keeping a futuristic look and feel, it strives to maintain a certain level of functionality and to be usable in real-life scenarios, with the larger goal of bringing science-fiction UXs to the mainstream.

<br clear="right">

## What's different from eDEX-UI

Modified from eDEX-UI v2.2.8, starting November 2026. The main changes so far:

- **Security:** the terminal no longer uses a local WebSocket server (any web page could connect to it and drive your shell); it uses Electron IPC instead. The UI runs isolated and sandboxed with no Node.js access, reaching the system only through a small allowlisted API, and a strict Content Security Policy blocks inline scripts and `eval()`. Several HTML/JS injection paths (file contents, file names, process names, settings values) are fixed.
- **Up-to-date stack:** Electron 45, node-pty 1.1 (prebuilt binaries, no C++ toolchain needed on Windows or macOS), xterm.js 6, pdf.js 6, systeminformation 5.33.
- **Settings editor:** a proper editor with validation and a live theme picker, instead of a table of text boxes (see [Settings](#settings)). A broken `settings.json` no longer stops the app from starting.
- **Windows:** the file browser now follows the terminal's working directory (PowerShell and cmd shell integration), and the window/layout sizing bugs on 16:10 displays are fixed.
- **Tested:** unit and end-to-end tests run on Windows, macOS and Linux for every change, including against the packaged installers.

See the [releases](https://github.com/adamsjoe/neodex-ui/releases) and the commit history for details.

## Features
- Fully featured terminal emulator with tabs, colors, mouse events, and support for `curses` and `curses`-like applications.
- Real-time system (CPU, RAM, swap, processes) and network (GeoIP, active connections, transfer rates) monitoring.
- Full support for touch-enabled displays, including an on-screen keyboard.
- Directory viewer that follows the CWD (current working directory) of the terminal.
- Settings editor with validation, and a theme picker that previews themes live.
- Advanced customization using themes, on-screen keyboard layouts, CSS injections. The original [eDEX-UI wiki](https://github.com/GitSquared/edex-ui/wiki) still largely applies.
- Optional sound effects made by a talented sound designer for maximum hollywood hacking vibe.

## Settings

Press **Ctrl+Shift+S** (or click `settings.json` in the file browser, in the config directory) to open the settings editor.

- Settings are grouped into **Shell**, **Appearance**, **Sound**, **Behaviour**, **Network** and **Advanced** tabs, with a short explanation for each.
- Values are **checked as you type**: problems are shown next to the setting, and nothing is saved until everything is valid.
- Each setting shows whether it applies after a **reload** of the UI or a **restart**. After saving, the editor offers the one that's needed.
- **Themes:** on the Appearance tab, click a theme to preview it on the whole UI and the terminals straight away. Close the editor to undo, or save to keep it. (The graphs and the globe switch colours after the reload.)
- **Open settings.json** opens the file in your editor, for anything the form doesn't cover.

Settings are stored in the app's config directory (see [Where are my settings?](#where-are-my-settings)). If the file is broken or a setting is missing, the app starts with the defaults and tells you what was wrong.

## Screenshots
These screenshots are of the original eDEX-UI 2.2.

![Default screenshot](media/screenshot_default.png)

_[neofetch](https://github.com/dylanaraps/neofetch) with the default "tron" theme & QWERTY keyboard_

![Blade screenshot](media/screenshot_blade.png)

_Checking out available themes in the config dir with [`ranger`](https://github.com/ranger/ranger), with the "blade" theme_

![Disrupted screenshot](media/screenshot_disrupted.png)

_[cmatrix](https://github.com/abishekvashok/cmatrix) with the experimental "tron-disrupted" theme, and the user-contributed DVORAK keyboard_

![Horizon screenshot](media/screenshot_horizon.png)

_Editing source code with `nvim`, with the custom [`horizon-full`](https://github.com/GitSquared/horizon-edex-theme) theme_

## Q&A
#### How do I get it?
Download the installer for your system from the [releases page](https://github.com/adamsjoe/neodex-ui/releases): Windows (`.exe`), macOS (`.dmg`, Intel or Apple Silicon) or Linux (`.AppImage`, run `chmod +x` on it first). Or run it from source (see below).

The installers aren't code-signed yet, so Windows SmartScreen will warn about an unrecognised app (click *More info*, then *Run anyway*), and on macOS you'll need to right-click the app and choose *Open* the first time.
#### I have a problem!
Search through the [Issues](https://github.com/adamsjoe/neodex-ui/issues) to see if yours has already been reported. If not, feel free to open a new one.
#### Can you disable the keyboard/the filesystem display?
You can't disable them (yet) but you can hide them. See the `tron-notype` theme.
#### Where are my settings?
In the app's config directory: `%APPDATA%\neoDEX-UI` on Windows, `~/.config/neoDEX-UI` on Linux, `~/Library/Application Support/neoDEX-UI` on macOS. Settings from eDEX-UI are not imported automatically.

## Running from source

You'll need [Node.js](https://nodejs.org) 22 or newer.

```
git clone https://github.com/adamsjoe/neodex-ui.git
cd neodex-ui
npm install
npm start
```

`npm install` also installs the app's own dependencies in `src/`, and Electron downloads itself the first time you start the app. On Linux, node-pty has no prebuilt binary and is compiled during `npm install`, so you need a C++ toolchain (`build-essential` and Python).

`npm start` builds the UI bundle (`src/build/renderer.js`) and starts the app. Use `npm run build:renderer -- --watch` to rebuild the UI as you edit it.

#### Testing
- `npm test` runs the unit tests (`node:test`, under a second) and then the end-to-end tests ([Playwright](https://playwright.dev), about a minute; the app opens fullscreen while they run).
- `npm run test:unit` or `npm run test:e2e` runs one of them.

See [tests/e2e/README.md](tests/e2e/README.md) for how the end-to-end tests work.

#### Building
`npm run package` builds the installer for the OS you're on (Windows NSIS `.exe`, macOS `.dmg` for Intel and Apple Silicon, Linux `.AppImage`) in `dist/`. `npm run package:dir` builds just the unpacked app.

Releases are built by CI: pushing a tag `vX.Y.Z` that matches the version in `package.json` builds and tests the installers on all three systems, then creates a draft GitHub release with them attached and release notes generated from the commits.

## Credits
neoDEX-UI is maintained by [Joseph Adams](https://github.com/adamsjoe).

The original eDEX-UI was primarily written by [Squared](https://github.com/GitSquared) ([website](https://gaby.dev)).

[PixelyIon](https://github.com/PixelyIon) helped get eDEX-UI started with Windows compatibility.

[IceWolf](https://soundcloud.com/iamicewolf) composed the sound effects (eDEX-UI v2.1.x and above).

## Thanks
eDEX-UI would never have existed without the amazing work of [Seena](https://github.com/seenaburns) on [DEX-UI](https://github.com/seenaburns/dex-ui), shared on [r/unixporn](https://reddit.com/r/unixporn).

Thanks to the developers behind [xterm.js](https://github.com/xtermjs/xterm.js), [systeminformation](https://github.com/sebhildebrandt/systeminformation), [node-pty](https://github.com/microsoft/node-pty) and [SmoothieCharts](https://github.com/joewalnes/smoothie).

Huge thanks to [Rob "Arscan" Scanlon](https://github.com/arscan) for making the fantastic [ENCOM Globe](https://github.com/arscan/encom-globe), also inspired by the TRON: Legacy movie, and distributing it freely.

eDEX-UI was featured in [Hacker News](https://news.ycombinator.com/item?id=18509828), [Hackaday](https://hackaday.com/2018/11/23/look-like-a-movie-hacker/), the [GitHub Blog's Release Radar](https://blog.github.com/2018-12-21-release-radar-november-2018/), [opensource.com](https://opensource.com/article/19/1/productivity-tool-edex-ui) and many more.

## Licensing

Licensed under the [GPLv3.0](LICENSE), like the original eDEX-UI.

Original work copyright © 2017-2021 Gabriel "Squared" Saillard. Modifications copyright © 2026 Joseph Adams.
