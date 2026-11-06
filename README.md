<p align="center">
  <br>
  <img alt="Logo" src="media/logo.png">
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

- **Security:** the terminal no longer uses a local WebSocket server (any web page could connect to it and drive your shell); it uses Electron IPC instead. `@electron/remote` has been removed, and several HTML/JS injection paths (file contents, file names, process names, settings values) are fixed.
- **Up-to-date stack:** Electron 45, node-pty 1.1 (prebuilt binaries, no C++ toolchain needed on Windows or macOS), xterm.js 6, pdf.js 6, systeminformation 5.33.
- **Windows:** the file browser now follows the terminal's working directory (PowerShell and cmd shell integration), and the window/layout sizing bugs on 16:10 displays are fixed.

See the commit history for details.

## Features
- Fully featured terminal emulator with tabs, colors, mouse events, and support for `curses` and `curses`-like applications.
- Real-time system (CPU, RAM, swap, processes) and network (GeoIP, active connections, transfer rates) monitoring.
- Full support for touch-enabled displays, including an on-screen keyboard.
- Directory viewer that follows the CWD (current working directory) of the terminal.
- Advanced customization using themes, on-screen keyboard layouts, CSS injections. The original [eDEX-UI wiki](https://github.com/GitSquared/edex-ui/wiki) still largely applies.
- Optional sound effects made by a talented sound designer for maximum hollywood hacking vibe.

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
There are no release builds yet. For now, run it from source (see below).
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

`npm install` also installs the app's own dependencies in `src/`, and Electron downloads itself the first time you start the app. On Linux, node-pty has no prebuilt binary, so you need a C++ toolchain and to allow its build script (`npm approve-scripts node-pty`).

#### Building
Packaging hasn't been verified since the upgrade to Electron 45. The previous scripts are still there:

- `npm run build-linux`, `build-windows` or `build-darwin`

They minify the source code and create distributable assets in the `dist` folder. You can only build targets for the host OS you are using.

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
