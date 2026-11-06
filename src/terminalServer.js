// Terminal server, running in the main process: a pty (node-pty) for one terminal tab, connected to the
// UI's Terminal client (src/classes/terminal.class.js) over IPC.
class TerminalServer {
    constructor(opts) {

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
                const {shellLaunchOptions} = require("./lib/shellIntegration.js");
        const {parseResize} = require("./lib/validation.js");
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
        // Name of the terminal's foreground process (shown in the tab), read by node-pty from the pty itself
        // on Linux and macOS. (This used `ps --no-headers --sort -g`, which macOS's ps doesn't support.)
        // Windows has no equivalent.
        this._getTtyProcess = tty => {
            return new Promise((resolve, reject) => {
                if (process.platform === "win32") {
                    reject("Unsupported OS");
                    return;
                }
                try {
                    resolve(require("path").basename(String(tty.process || "")));
                } catch (e) {
                    reject(e);
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
    }
}

module.exports = {
    TerminalServer
};
