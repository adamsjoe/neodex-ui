const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const {
    MAX_TERMINAL_DIMENSION,
    parseResize,
    normaliseLogLevel,
    isAllowedSystemInformationCall,
    parseEnvSetting
} = require("../../src/lib/validation.js");

describe("parseResize", () => {
    test("accepts positive integers, including as strings (the renderer pads them: '080')", () => {
        assert.deepEqual(parseResize(80, 24), { cols: 80, rows: 24 });
        assert.deepEqual(parseResize("080", "024"), { cols: 80, rows: 24 });
        assert.deepEqual(parseResize(MAX_TERMINAL_DIMENSION, 1), { cols: MAX_TERMINAL_DIMENSION, rows: 1 });
    });

    test("rejects zero, negative, fractional, huge and non-numeric sizes", () => {
        for (const [cols, rows] of [[0, 24], [80, -1], [80.5, 24], [MAX_TERMINAL_DIMENSION + 1, 24], ["abc", 24], [undefined, 24], [null, null], [Infinity, 24], [{}, []]]) {
            assert.equal(parseResize(cols, rows), null, `${cols}x${rows}`);
        }
    });
});

describe("normaliseLogLevel", () => {
    test("passes known signale levels through", () => {
        for (const level of ["error", "warn", "info", "debug", "note"]) assert.equal(normaliseLogLevel(level), level);
    });

    test("maps anything else to 'log', including object property names", () => {
        for (const level of ["constructor", "__proto__", "toString", "config", "unknown", undefined, null, 1]) {
            assert.equal(normaliseLogLevel(level), "log", String(level));
        }
    });
});

describe("isAllowedSystemInformationCall", () => {
    test("allows own function properties only", () => {
        const si = Object.assign(Object.create({ inherited() {} }), { cpu() {}, version: "5.0.0" });
        assert.equal(isAllowedSystemInformationCall(si, "cpu"), true);
        assert.equal(isAllowedSystemInformationCall(si, "version"), false, "not a function");
        assert.equal(isAllowedSystemInformationCall(si, "inherited"), false, "inherited");
        assert.equal(isAllowedSystemInformationCall(si, "missing"), false);
        assert.equal(isAllowedSystemInformationCall(si, undefined), false);
    });

    test("against the real systeminformation module", () => {
        const si = require(path.join(__dirname, "..", "..", "src", "node_modules", "systeminformation"));
        for (const fn of ["cpu", "currentLoad", "processes", "networkInterfaces", "fsSize"]) {
            assert.equal(isAllowedSystemInformationCall(si, fn), true, fn);
        }
        for (const name of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
            assert.equal(isAllowedSystemInformationCall(si, name), false, name);
        }
    });
});

describe("parseEnvSetting", () => {
    test("empty input means no override", () => {
        for (const input of ["", "   ", undefined, null]) {
            assert.deepEqual(parseEnvSetting(input), { ok: true, env: undefined });
        }
    });

    test("accepts a JSON object of strings", () => {
        assert.deepEqual(parseEnvSetting(' {"FOO": "bar", "EMPTY": ""} '), { ok: true, env: { FOO: "bar", EMPTY: "" } });
    });

    test("rejects invalid JSON and non-objects", () => {
        for (const input of ["{FOO: bar}", "[object Object]", "[]", '"text"', "42", "null"]) {
            const result = parseEnvSetting(input);
            assert.equal(result.ok, false, input);
            assert.match(result.error, /env must be/);
        }
    });

    test("rejects non-string values, naming the key", () => {
        const result = parseEnvSetting('{"OK": "x", "PORT": 3000}');
        assert.equal(result.ok, false);
        assert.match(result.error, /"PORT"/);
    });
});
