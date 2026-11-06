class Terminal {
    constructor(opts) {
        if (opts.role === "client") {
            if (!opts.parentId) throw "Missing options";

            this.xTerm = require("@xterm/xterm").Terminal;
            const {FitAddon} = require("@xterm/addon-fit");
            this.Ipc = require("electron").ipcRenderer;

            // Terminal ID, matching a pty in the main process. Data is exchanged over IPC.
            this.id = opts.id || 0;
            this.channel = "terminal_channel-"+this.id;
            this.cwd = "";
            this.oncwdchange = () => {};

            this._sendSizeToServer = () => {
                let cols = this.term.cols.toString();
                let rows = this.term.rows.toString();
                while (cols.length < 3) {
                    cols = "0"+cols;
                }
                while (rows.length < 3) {
                    rows = "0"+rows;
                }
                this.Ipc.send(this.channel, "Resize", cols, rows);
            };

            // Support for custom color filters on the terminal - see #483
            let doCustomFilter = (window.isTermFilterValidated) ? true : false;

            // Parse & validate color filter
            if (window.isTermFilterValidated !== true && typeof window.theme.terminal.colorFilter === "object" && window.theme.terminal.colorFilter.length > 0) {
                doCustomFilter = window.theme.terminal.colorFilter.every((step, i, a) => {
                    let func = step.slice(0, step.indexOf("("));

                    switch(func) {
                        case "negate":
                        case "grayscale":
                            a[i] = {
                                func,
                                arg: []
                            };
                            return true;
                        case "lighten":
                        case "darken":
                        case "saturate":
                        case "desaturate":
                        case "whiten":
                        case "blacken":
                        case "fade":
                        case "opaquer":
                        case "rotate":
                        case "mix":
                            break;
                        default:
                            return false;
                    }

                    let arg = step.slice(step.indexOf("(")+1, step.indexOf(")"));

                    if (typeof Number(arg) === "number") {
                        a[i] = {
                            func,
                            arg: [Number(arg)]
                        };
                        window.isTermFilterValidated = true;
                        return true;
                    }

                    return false;
                });
            }

            let color = require("color");
            let colorify;
            if (doCustomFilter) {
                colorify = (base, target) => {
                    let newColor = color(base);
                    target = color(target);

                    for (let i = 0; i < window.theme.terminal.colorFilter.length; i++) {
                        if (window.theme.terminal.colorFilter[i].func === "mix") {
                            newColor = newColor[window.theme.terminal.colorFilter[i].func](target, ...window.theme.terminal.colorFilter[i].arg);
                        } else {
                            newColor = newColor[window.theme.terminal.colorFilter[i].func](...window.theme.terminal.colorFilter[i].arg);
                        }
                    }

                    return newColor.hex();
                };
            } else {
                colorify = (base, target) => {
                    return color(base).grayscale().mix(color(target), 0.3).hex();
                };
            }

            let themeColor = `rgb(${window.theme.r}, ${window.theme.g}, ${window.theme.b})`;

            this.term = new this.xTerm({
                cols: 80,
                rows: 24,
                cursorBlink: window.theme.terminal.cursorBlink !== false,
                cursorStyle: window.theme.terminal.cursorStyle || "block",
                allowTransparency: window.theme.terminal.allowTransparency || false,
                fontFamily: window.theme.terminal.fontFamily || "Fira Mono",
                fontSize: window.theme.terminal.fontSize || window.settings.termFontSize || 15,
                fontWeight: window.theme.terminal.fontWeight || "normal",
                fontWeightBold: window.theme.terminal.fontWeightBold || "bold",
                letterSpacing: window.theme.terminal.letterSpacing || 0,
                lineHeight: window.theme.terminal.lineHeight || 1,
                scrollback: 1500,
                // Required by @xterm/addon-ligatures (character joiners are a proposed API)
                allowProposedApi: true,
                theme: {
                    foreground: window.theme.terminal.foreground,
                    background: window.theme.terminal.background,
                    cursor: window.theme.terminal.cursor,
                    cursorAccent: window.theme.terminal.cursorAccent,
                    selectionBackground: window.theme.terminal.selectionBackground || window.theme.terminal.selection,
                    black: window.theme.colors.black || colorify("#2e3436", themeColor),
                    red: window.theme.colors.red || colorify("#cc0000", themeColor),
                    green: window.theme.colors.green || colorify("#4e9a06", themeColor),
                    yellow: window.theme.colors.yellow || colorify("#c4a000", themeColor),
                    blue: window.theme.colors.blue || colorify("#3465a4", themeColor),
                    magenta: window.theme.colors.magenta || colorify("#75507b", themeColor),
                    cyan: window.theme.colors.cyan || colorify("#06989a", themeColor),
                    white: window.theme.colors.white || colorify("#d3d7cf", themeColor),
                    brightBlack: window.theme.colors.brightBlack || colorify("#555753", themeColor),
                    brightRed: window.theme.colors.brightRed || colorify("#ef2929", themeColor),
                    brightGreen: window.theme.colors.brightGreen || colorify("#8ae234", themeColor),
                    brightYellow: window.theme.colors.brightYellow || colorify("#fce94f", themeColor),
                    brightBlue: window.theme.colors.brightBlue || colorify("#729fcf", themeColor),
                    brightMagenta: window.theme.colors.brightMagenta || colorify("#ad7fa8", themeColor),
                    brightCyan: window.theme.colors.brightCyan || colorify("#34e2e2", themeColor),
                    brightWhite: window.theme.colors.brightWhite || colorify("#eeeeec", themeColor)
                }
            });
            let fitAddon = new FitAddon();
            this.term.loadAddon(fitAddon);
            this.term.open(document.getElementById(opts.parentId));
            // Uses xterm's default DOM renderer. @xterm/addon-webgl 0.19 ignores web fonts loaded by the page
            // (it falls back to a system sans-serif and mis-measures cells), which made the text unreadable.
            // @xterm/addon-ligatures 0.10.0 only ships an ES module build (its CommonJS "main" is missing),
            // so it's loaded asynchronously. Ligatures are cosmetic: failures never block the terminal.
            import(new URL("node_modules/@xterm/addon-ligatures/lib/addon-ligatures.mjs", document.baseURI).href)
                .then(({LigaturesAddon}) => this.term.loadAddon(new LigaturesAddon()))
                .catch(e => console.warn("Ligatures addon failed to load", e));
            this.term.attachCustomKeyEventHandler(e => {
                window.keyboard.keydownHandler(e);
                return true;
            });
            // Prevent soft-keyboard on touch devices #733
            document.querySelectorAll('.xterm-helper-textarea').forEach(textarea => textarea.setAttribute('readonly', 'readonly'))
            this.term.focus();

            this.lastSoundFX = Date.now();
            this._onPtyData = data => {
                this.term.write(data);

                let d = Date.now();
                if (d - this.lastSoundFX > 30) {
                    if(window.passwordMode == "false")
                        window.audioManager.stdout.play();
                    this.lastSoundFX = d;
                }
                if (d - this.lastRefit > 10000) {
                    this.fit();
                }

                // See #397
                if (!window.settings.experimentalGlobeFeatures) return;
                let ips = data.match(/((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)/g);
                if (ips !== null && ips.length >= 1) {
                    ips = ips.filter((val, index, self) => { return self.indexOf(val) === index; });
                    ips.forEach(ip => {
                        window.mods.globe.addTemporaryConnectedMarker(ip);
                    });
                }
            };

            this._ipcListener = (e, ...args) => {
                switch(args[0]) {
                    case "Data":
                        this._onPtyData(args[1]);
                        break;
                    case "Exit":
                        this.Ipc.removeListener(this.channel, this._ipcListener);
                        if (this.onclose) {
                            this.onclose({code: args[1], signal: args[2]});
                        }
                        break;
                    case "New cwd":
                        this.cwd = args[1];
                        this.oncwdchange(this.cwd);
                        break;
                    case "Fallback cwd":
                        this.cwd = "FALLBACK |-- "+args[1];
                        this.oncwdchange(this.cwd);
                        break;
                    case "New process":
                        if (this.onprocesschange) {
                            this.onprocesschange(args[1]);
                        }
                        break;
                    default:
                        return;
                }
            };
            this.Ipc.on(this.channel, this._ipcListener);

            // Shell integration: shells report their working directory through escape sequences in the
            // prompt. Needed on Windows, where the backend can't read another process's cwd.
            //   OSC 9;9;"<path>"        (Windows Terminal / ConEmu convention, used by our PowerShell & cmd setup)
            //   OSC 7;file://host/path  (common on Unix shells)
            // (Renderer-side require: paths resolve from ui.html's directory)
            const {cwdFromOsc9, cwdFromOsc7} = require("./lib/osc.js");
            this._setCwdFromShell = cwd => {
                if (!cwd || cwd === this.cwd) return;
                this.cwd = cwd;
                this.oncwdchange(this.cwd);
                this.Ipc.send(this.channel, "Cwd", cwd);
            };
            // Returning false lets other handlers (or xterm's defaults) process sequences that aren't cwd reports
            this.term.parser.registerOscHandler(9, data => {
                const cwd = cwdFromOsc9(data);
                if (cwd === null) return false;
                this._setCwdFromShell(cwd);
                return true;
            });
            this.term.parser.registerOscHandler(7, data => {
                const cwd = cwdFromOsc7(data, process.platform);
                if (cwd === null) return false;
                this._setCwdFromShell(cwd);
                return true;
            });

            this.resendCWD = () => {
                this.oncwdchange(this.cwd || null);
            };

            // User input -> pty
            this.term.onData(data => {
                this.Ipc.send(this.channel, "Data", data);
            });
            this.term.onBinary(data => {
                this.Ipc.send(this.channel, "Binary", data);
            });

            this.Ipc.send(this.channel, "Renderer startup");

            let parent = document.getElementById(opts.parentId);
            parent.addEventListener("wheel", e => {
                this.term.scrollLines(Math.round(e.deltaY/10));
            });
            this._lastTouchY = null;
            parent.addEventListener("touchstart", e => {
                this._lastTouchY = e.targetTouches[0].screenY;
            });
            parent.addEventListener("touchmove", e => {
                if (this._lastTouchY) {
                    let y = e.changedTouches[0].screenY;
                    let deltaY = y - this._lastTouchY;
                    this._lastTouchY = y;
                    this.term.scrollLines(-Math.round(deltaY/10));
                }
            });
            parent.addEventListener("touchend", e => {
                this._lastTouch = null;
            });
            parent.addEventListener("touchcancel", e => {
                this._lastTouch = null;
            });

            document.querySelector(".xterm-helper-textarea").addEventListener("keydown", e => {
                if (e.key === "F11" && window.settings.allowWindowed) {
                    e.preventDefault();
                    window.toggleFullScreen();
                }
            });

            this.fit = () => {
                this.lastRefit = Date.now();
                let dims = fitAddon.proposeDimensions();
                // Undefined while the terminal is hidden (e.g. inactive tab)
                if (!dims || isNaN(dims.cols) || isNaN(dims.rows)) return;
                let {cols, rows} = dims;

                // Apply custom fixes based on screen ratio, see #302
                let w = screen.width;
                let h = screen.height;
                let x = 1;
                let y = 0;

                function gcd(a, b) {
                    return (b == 0) ? a : gcd(b, a%b);
                }
                let d = gcd(w, h);

                if (d === 100) { y = 1; x = 3;}
                // if (d === 120) y = 1;
                if (d === 256) x = 2;

                if (window.settings.termFontSize < 15) y = y - 1;

                cols = cols+x;
                rows = rows+y;

                if (this.term.cols !== cols || this.term.rows !== rows) {
                    this.resize(cols, rows);
                }
            };

            this.resize = (cols, rows) => {
                this.term.resize(cols, rows);
                this._sendSizeToServer();
            };

            this.write = cmd => {
                this.Ipc.send(this.channel, "Data", cmd);
            };

            this.writelr = cmd => {
                this.Ipc.send(this.channel, "Data", cmd+"\r");
            };

            this.clipboard = {
                copy: () => {
                    if (!this.term.hasSelection()) return false;
                    document.execCommand("copy");
                    this.term.clearSelection();
                    this.clipboard.didCopy = true;
                },
                paste: () => {
                    this.Ipc.invoke("clipboard-read").then(text => {
                        this.write(text);
                    });
                    this.clipboard.didCopy = false;
                },
                didCopy: false
            };

            this.fit();

        } else if (opts.role === "server") {

            this.Pty = require("node-pty");
            this.Ipc = require("electron").ipcMain;

            this.renderer = null;
            this.id = opts.id || 0;
            this.channel = "terminal_channel-"+this.id;
            // Only accept IPC messages from webContents this callback approves (our UI window).
            this._isTrustedSender = opts.isTrustedSender || (() => false);

            this._closed = false;
            this.onclosed = () => {};
            this.onopened = () => {};
            this.onresized = () => {};

            // pty output produced before the renderer attaches (e.g. the first shell prompt) is kept here
            this._pendingOutput = [];
            this._pendingOutputSize = 0;
            this._maxPendingOutput = 1024 * 1024;

            this._send = (...args) => {
                if (!this.renderer || this.renderer.isDestroyed()) return false;
                try {
                    this.renderer.send(this.channel, ...args);
                    return true;
                } catch(e) {
                    // renderer closed
                    return false;
                }
            };

            this._disableCWDtracking = false;
            this._disableProcessTracking = false;

            // Shell arguments/env, including Windows shell integration (the prompt reports the cwd).
            // (Main-process require: paths resolve from this file's directory)
            const {shellLaunchOptions} = require("../lib/shellIntegration.js");
            const {parseResize} = require("../lib/validation.js");
            const launch = shellLaunchOptions({
                platform: process.platform,
                shell: opts.shell,
                params: opts.params,
                env: opts.env || process.env
            });
            let shellArgs = launch.args;
            let shellEnv = launch.env;
            this._cwdFromShell = launch.cwdFromShell;
            if (this._cwdFromShell) this._disableCWDtracking = true;
            this._getTtyCWD = tty => {
                return new Promise((resolve, reject) => {
                    let pid = tty.pid;
                    switch(require("os").type()) {
                        case "Linux":
                            require("fs").readlink(`/proc/${pid}/cwd`, (e, cwd) => {
                                if (e !== null) {
                                    reject(e);
                                } else {
                                    resolve(cwd);
                                }
                            });
                            break;
                        case "Darwin":
                            require("child_process").exec(`lsof -a -d cwd -p ${pid} | tail -1 | awk '{ for (i=9; i<=NF; i++) printf "%s ", $i }'`, (e, cwd) => {
                                if (e !== null) {
                                    reject(e);
                                } else {
                                    resolve(cwd.trim());
                                }
                            });
                            break;
                        default:
                            reject("Unsupported OS");
                    }
                });
            };
            this._getTtyProcess = tty => {
                return new Promise((resolve, reject) => {
                    let pid = tty.pid;
                    switch(require("os").type()) {
                        case "Linux":
                        case "Darwin":
                            require("child_process").exec(`ps -o comm --no-headers --sort=+pid -g ${pid} | tail -1`, (e, proc) => {
                                if (e !== null) {
                                    reject(e);
                                } else {
                                    resolve(proc.trim());
                                }
                            });
                            break;
                        default:
                            reject("Unsupported OS");
                    }
                });
            };
            this._nextTickUpdateTtyCWD = false;
            this._nextTickUpdateProcess = false;
            this._tick = setInterval(() => {
                if (this._nextTickUpdateTtyCWD && this._disableCWDtracking === false) {
                    this._nextTickUpdateTtyCWD = false;
                    this._getTtyCWD(this.tty).then(cwd => {
                        if (this.tty._cwd === cwd) return;
                        this.tty._cwd = cwd;
                        this._send("New cwd", cwd);
                    }).catch(e => {
                        if (!this._closed) {
                            console.log("Error while tracking TTY working directory: ", e);
                            this._disableCWDtracking = true;
                            this._send("Fallback cwd", opts.cwd || process.env.PWD);
                        }
                    });
                }

                if (this.renderer && this._nextTickUpdateProcess && !this._disableProcessTracking) {
                    this._nextTickUpdateProcess = false;
                    this._getTtyProcess(this.tty).then(process => {
                        if (this.tty._process === process) return;
                        this.tty._process = process;
                        this._send("New process", process);
                    }).catch(e => {
                        if (!this._closed) {
                            console.log("Error while retrieving TTY subprocess: ", e);
                            // Not going to start working on the next tick: stop polling (and logging)
                            if (e === "Unsupported OS") this._disableProcessTracking = true;
                            this._send("New process", "");
                        }
                    });
                }
            }, 1000);

            this.tty = this.Pty.spawn(opts.shell || "bash", shellArgs, {
                name: shellEnv.TERM || "xterm-256color",
                cols: 80,
                rows: 24,
                cwd: opts.cwd || process.env.PWD,
                env: shellEnv
            });

            this.tty.onExit(({exitCode, signal}) => {
                this._closed = true;
                clearInterval(this._tick);
                this.Ipc.removeListener(this.channel, this._ipcListener);
                this._send("Exit", exitCode, signal);
                this.onclosed(exitCode, signal);
            });

            this.tty.onData(data => {
                this._nextTickUpdateTtyCWD = true;
                this._nextTickUpdateProcess = true;
                if (!this._send("Data", data) && this._pendingOutputSize < this._maxPendingOutput) {
                    this._pendingOutput.push(data);
                    this._pendingOutputSize += data.length;
                }
            });

            this._ipcListener = (e, ...args) => {
                if (!this._isTrustedSender(e.sender)) {
                    console.warn(`Rejected message on ${this.channel} from untrusted sender`);
                    return;
                }
                switch(args[0]) {
                    case "Data":
                        if (typeof args[1] === "string") this.tty.write(args[1]);
                        break;
                    case "Cwd":
                        // Reported by the shell's prompt (shell integration); used to start new tabs in the same place
                        if (this._cwdFromShell && typeof args[1] === "string") this.tty._cwd = args[1];
                        break;
                    case "Binary":
                        if (typeof args[1] === "string") this.tty.write(Buffer.from(args[1], "binary"));
                        break;
                    case "Renderer startup":
                        this.renderer = e.sender;
                        if (this._pendingOutput.length > 0) {
                            this._send("Data", this._pendingOutput.join(""));
                            this._pendingOutput = [];
                            this._pendingOutputSize = 0;
                        }
                        if ((!this._disableCWDtracking || this._cwdFromShell) && this.tty._cwd) {
                            this._send("New cwd", this.tty._cwd);
                        }
                        if (this._disableCWDtracking && !this._cwdFromShell) {
                            this._send("Fallback cwd", opts.cwd || process.env.PWD);
                        }
                        this.onopened(this.tty.pid);
                        break;
                    case "Resize": {
                        const size = parseResize(args[1], args[2]);
                        if (size === null) break;
                        try {
                            this.tty.resize(size.cols, size.rows);
                        } catch (error) {
                            //Keep going, it'll work anyways.
                        }
                        this.onresized(size.cols, size.rows);
                        break;
                    }
                    default:
                        return;
                }
            };
            this.Ipc.on(this.channel, this._ipcListener);

            // Forget the current renderer (e.g. on UI reload), so output gets buffered until it reconnects
            this.detachRenderer = () => {
                this.renderer = null;
            };

            this.close = () => {
                if (this._closed) return;
                this._closed = true;
                // Don't notify the frontend of the exit: a new tab may already be reusing this ID
                this.renderer = null;
                clearInterval(this._tick);
                this.Ipc.removeListener(this.channel, this._ipcListener);
                try {
                    this.tty.kill();
                } catch(e) {
                    // already dead
                }
            };
        } else {
            throw "Unknown purpose";
        }
    }
}

module.exports = {
    Terminal
};
