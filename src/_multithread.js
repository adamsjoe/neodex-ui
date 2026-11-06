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
    const pending = new Map(); // request id -> { sender, worker }
    let next = 0;
    let quitting = false;

    const reply = (sender, id, res) => {
        if (sender && !sender.isDestroyed()) sender.send("systeminformation-reply-" + id, res);
    };

    function spawn(index) {
        const worker = utilityProcess.fork(path.join(__dirname, "_siWorker.js"), [], {
            serviceName: "neoDEX-UI systeminformation"
        });
        worker.on("message", ({ id, res }) => {
            const request = pending.get(id);
            if (!request) return;
            pending.delete(id);
            reply(request.sender, id, res);
        });
        worker.on("exit", code => {
            // Answer anything this worker was still handling, then replace it
            for (const [id, request] of pending) {
                if (request.worker === worker) {
                    pending.delete(id);
                    reply(request.sender, id, null);
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

        const worker = workers[next];
        next = (next + 1) % POOL_SIZE;
        pending.set(id, { sender: e.sender, worker });
        worker.postMessage({ id, type, args });
    });

    signale.success(`Systeminformation backend ready (${POOL_SIZE} utility processes)`);
};
