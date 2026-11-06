const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { cwdFromOsc9, cwdFromOsc7 } = require("../../src/lib/osc.js");

describe("cwdFromOsc9", () => {
    test("reads a quoted path", () => {
        assert.equal(cwdFromOsc9('9;"C:\\Users\\josep"'), "C:\\Users\\josep");
    });

    test("reads an unquoted path", () => {
        assert.equal(cwdFromOsc9("9;C:\\Windows"), "C:\\Windows");
    });

    test("keeps spaces, quotes and semicolons inside the path", () => {
        assert.equal(cwdFromOsc9('9;"C:\\My Files\\a;b\\it\'s"'), "C:\\My Files\\a;b\\it's");
    });

    test("ignores OSC 9 sequences that aren't cwd reports", () => {
        assert.equal(cwdFromOsc9("Build finished"), null); // ConEmu/iTerm-style notification
        assert.equal(cwdFromOsc9("4;1;50"), null);          // progress indicator
    });

    test("rejects empty or non-string input", () => {
        assert.equal(cwdFromOsc9('9;""'), null);
        assert.equal(cwdFromOsc9("9;"), null);
        assert.equal(cwdFromOsc9(undefined), null);
        assert.equal(cwdFromOsc9(42), null);
    });
});

describe("cwdFromOsc7", () => {
    test("reads a Unix path, ignoring the host name", () => {
        assert.equal(cwdFromOsc7("file://myhost/home/josep/src", "linux"), "/home/josep/src");
    });

    test("decodes percent-encoding", () => {
        assert.equal(cwdFromOsc7("file://host/home/josep/My%20Files/caf%C3%A9", "darwin"), "/home/josep/My Files/café");
    });

    test("converts to a Windows path on Windows", () => {
        assert.equal(cwdFromOsc7("file://host/C:/Users/josep", "win32"), "C:\\Users\\josep");
    });

    test("leaves the path alone on other platforms", () => {
        assert.equal(cwdFromOsc7("file://host/C:/Users/josep", "linux"), "/C:/Users/josep");
    });

    test("rejects non-file URLs, invalid URLs and bad encoding", () => {
        assert.equal(cwdFromOsc7("https://example.com/home", "linux"), null);
        assert.equal(cwdFromOsc7("not a url", "linux"), null);
        assert.equal(cwdFromOsc7("file://host/bad%ZZencoding%", "linux"), null);
        assert.equal(cwdFromOsc7(undefined, "linux"), null);
    });
});
