// Backend for the renderer's window.si proxy (see initSystemInformationProxy in _renderer.js).
//
// This used to fan calls out to a pool of `cluster` workers. systeminformation's calls are
// asynchronous and mostly spawn OS commands, so they already run in parallel without blocking the
// main process; running them here directly avoids forking extra Electron processes.

const signale = require("signale");
const si = require("systeminformation");
const {isAllowedSystemInformationCall} = require("./lib/validation.js");

module.exports = function initSystemInformationBackend(ipc, isTrustedSender) {
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

        Promise.resolve()
            .then(() => si[type](...args))
            .catch(err => {
                signale.debug(`systeminformation.${type} failed: ${err && err.message}`);
                return null;
            })
            .then(res => {
                if (!e.sender.isDestroyed()) {
                    e.sender.send("systeminformation-reply-"+id, res);
                }
            });
    });

    signale.success("Systeminformation backend ready");
};
