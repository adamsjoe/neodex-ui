// Backend for the renderer's window.si proxy (see initSystemInformationProxy in _renderer.js).
//
// systeminformation calls run in a small pool of Electron utility processes (_siWorker.js), never in the
// main process: on Windows several of them use synchronous child processes (netstat, ipconfig, netsh...),
// which would freeze the main process, and the terminal I/O that goes through it, every time the UI polls.

const path = require("path");
const { app, utilityProcess } = require("electron");
const signale = require("signale");
const si = require("systeminformation");
const { isAllowedSystemInformationCall } = require("./lib/validation.js");

const POOL_SIZE = 2;

module.exports = function initSystemInformationBackend(ipc, isTrustedSender) {
    const workers = [];
    // In-flight calls, keyed by call (type + arguments). Identical requests made while one is running
    // share its result: the UI polls on timers, and on slow machines (some calls take seconds on Windows)
    // separate requests would queue up faster than they're answered.
    const inFlight = new Map(); // key -> { worker, waiters: [{ sender, id }] }
    let next = 0;
    let quitting = false;

    const reply = (sender, id, res) => {
        if (sender && !sender.isDestroyed()) sender.send("systeminformation-reply-" + id, res);
    };

    function spawn(index) {
        const worker = utilityProcess.fork(path.join(__dirname, "_siWorker.js"), [], {
            serviceName: "neoDEX-UI systeminformation"
        });
        worker.on("message", ({ id: key, res }) => {
            const call = inFlight.get(key);
            if (!call) return;
            inFlight.delete(key);
            call.waiters.forEach(w => reply(w.sender, w.id, res));
        });
        worker.on("exit", code => {
            // Answer anything this worker was still handling, then replace it
            for (const [key, call] of inFlight) {
                if (call.worker === worker) {
                    inFlight.delete(key);
                    call.waiters.forEach(w => reply(w.sender, w.id, null));
                }
            }
            if (!quitting) {
                signale.warn(`systeminformation worker exited (code ${code}), restarting`);
                spawn(index);
            }
        });
        workers[index] = worker;
    }

    for (let i = 0; i < POOL_SIZE; i++) spawn(i);
    app.on("before-quit", () => {
        quitting = true;
        workers.forEach(worker => worker.kill());
    });

    ipc.on("systeminformation-call", (e, type, id, ...args) => {
        if (!isTrustedSender(e.sender)) {
            signale.warn("Rejected systeminformation request from untrusted sender");
            return;
        }
        if (!isAllowedSystemInformationCall(si, type)) {
            signale.warn("Illegal request for systeminformation");
            return;
        }
        if (typeof id !== "string") return;

        let key;
        try {
            key = type + ":" + JSON.stringify(args);
        } catch (err) {
            return; // arguments must be serialisable anyway
        }
        const existing = inFlight.get(key);
        if (existing) {
            existing.waiters.push({ sender: e.sender, id });
            return;
        }
        const worker = workers[next];
        next = (next + 1) % POOL_SIZE;
        inFlight.set(key, { worker, waiters: [{ sender: e.sender, id }] });
        worker.postMessage({ id: key, type, args });
    });

    signale.success(`Systeminformation backend ready (${POOL_SIZE} utility processes)`);
};
