const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { shellLaunchOptions, POWERSHELL_PROMPT_SCRIPT, CMD_PROMPT } = require("../../src/lib/shellIntegration.js");
const { cwdFromOsc9 } = require("../../src/lib/osc.js");

const decodeEncodedCommand = b64 => Buffer.from(b64, "base64").toString("utf16le");

describe("shellLaunchOptions", () => {
    test("on Linux/macOS, starts a login shell and leaves cwd tracking to the backend", () => {
        for (const platform of ["linux", "darwin"]) {
            const result = shellLaunchOptions({ platform, shell: "/bin/bash", params: "", env: { HOME: "/home/x" } });
            assert.deepEqual(result.args, ["--login"]);
            assert.equal(result.cwdFromShell, false);
            assert.deepEqual(result.env, { HOME: "/home/x" });
        }
    });

    test("PowerShell on Windows gets a prompt wrapper via -EncodedCommand", () => {
        const result = shellLaunchOptions({ platform: "win32", shell: "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe", params: "", env: {} });
        assert.equal(result.cwdFromShell, true);
        assert.deepEqual(result.args.slice(0, 2), ["-NoExit", "-EncodedCommand"]);
        assert.equal(decodeEncodedCommand(result.args[2]), POWERSHELL_PROMPT_SCRIPT);
    });

    test("matches pwsh.exe too, case-insensitively", () => {
        for (const shell of ["pwsh.exe", "C:\\Program Files\\PowerShell\\7\\PWSH.EXE", "PowerShell.EXE"]) {
            assert.equal(shellLaunchOptions({ platform: "win32", shell, params: "", env: {} }).cwdFromShell, true, shell);
        }
    });

    test("cmd.exe gets a PROMPT that reports the cwd, without mutating the input env", () => {
        const env = { PATH: "C:\\Windows" };
        const result = shellLaunchOptions({ platform: "win32", shell: "C:\\Windows\\System32\\cmd.exe", params: "", env });
        assert.equal(result.cwdFromShell, true);
        assert.equal(result.env.PROMPT, CMD_PROMPT);
        assert.equal(result.env.PATH, "C:\\Windows");
        assert.equal(env.PROMPT, undefined, "input env must not be modified");
    });

    test("cmd.exe keeps a PROMPT the user already set (and then can't report the cwd)", () => {
        const result = shellLaunchOptions({ platform: "win32", shell: "cmd.exe", params: "", env: { PROMPT: "$P$G " } });
        assert.equal(result.env.PROMPT, "$P$G ");
        assert.equal(result.cwdFromShell, false);
    });

    test("user-configured shell arguments are used as-is, with no integration", () => {
        for (const params of ["-NoLogo", ["-NoLogo", "-NoProfile"]]) {
            const result = shellLaunchOptions({ platform: "win32", shell: "powershell.exe", params, env: {} });
            assert.deepEqual(result.args, params);
            assert.equal(result.cwdFromShell, false);
        }
    });

    test("other shells on Windows get no arguments and no integration", () => {
        const result = shellLaunchOptions({ platform: "win32", shell: "C:\\Program Files\\Git\\bin\\bash.exe", params: "", env: {} });
        assert.deepEqual(result.args, []);
        assert.equal(result.cwdFromShell, false);
    });
});

// Runs the real prompt wrapper in PowerShell and checks the terminal-side parser understands its output
const powershell = ["pwsh", "powershell"].find(exe => spawnSync(exe, ["-NoProfile", "-Command", "exit 0"], { stdio: "ignore" }).status === 0);

describe("PowerShell prompt wrapper (integration)", { skip: powershell ? false : "PowerShell not installed" }, () => {
    test("prompt emits OSC 9;9 with the current directory, before the normal prompt", () => {
        const dir = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "neodex unit '")));
        try {
            const script = [
                POWERSHELL_PROMPT_SCRIPT,
                `Set-Location -LiteralPath '${dir.replace(/'/g, "''")}'`,
                "[Console]::Out.Write((prompt))"
            ].join("\n");
            const run = spawnSync(powershell, ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")], { encoding: "utf8" });
            assert.equal(run.status, 0, run.stderr);

            const match = run.stdout.match(/\x1b\](9;[\s\S]*?)\x1b\\/);
            assert.ok(match, `no OSC 9 sequence in output: ${JSON.stringify(run.stdout)}`);
            // xterm.js hands the handler for OSC 9 everything after "9;"
            assert.equal(cwdFromOsc9(match[1].slice(2)), dir);
            assert.match(run.stdout.slice(match.index + match[0].length), /PS .*> $/, "the original prompt should follow");
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});
