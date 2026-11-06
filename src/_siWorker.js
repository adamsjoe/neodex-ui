// Runs systeminformation calls in an Electron utility process (see _multithread.js).
// Several of its functions use synchronous child processes on Windows (netstat, ipconfig, netsh...),
// which would freeze the main process, and with it the terminal, if called there.

const si = require("systeminformation");
const { isAllowedSystemInformationCall } = require("./lib/validation.js");

process.parentPort.on("message", async ({ data }) => {
    const { id, type, args } = data || {};
    let res = null;
    if (isAllowedSystemInformationCall(si, type)) {
        try {
            res = await si[type](...(Array.isArray(args) ? args : []));
        } catch (err) {
            res = null;
        }
    }
    process.parentPort.postMessage({ id, res });
});
