// How to launch the user's shell, including "shell integration" on Windows.
//
// Windows can't report another process's working directory, so for known shells we make the prompt
// report it instead, as an OSC 9;9 escape sequence that the terminal client picks up (see osc.js).
// This is only done when the user hasn't configured their own shell arguments.

const path = require("path");

// Wraps whatever prompt the user's profile defined, prefixing it with ESC ] 9 ; 9 ; "<cwd>" ESC \
const POWERSHELL_PROMPT_SCRIPT = [
    '$global:__edexPrompt = $function:prompt',
    'function global:prompt {',
    '  $loc = $executionContext.SessionState.Path.CurrentLocation',
    '  $osc = ""',
    '  if ($loc.Provider.Name -eq "FileSystem") { $osc = "$([char]27)]9;9;`"$($loc.ProviderPath)`"$([char]27)\\" }',
    '  $osc + (& $global:__edexPrompt)',
    '}'
].join("\n");

// cmd.exe expands $e to ESC, $P to the current path and $G to ">"
const CMD_PROMPT = "$e]9;9;$P$e\\$P$G";

/**
 * @param {object} opts
 * @param {string} opts.platform  process.platform
 * @param {string} opts.shell     path or name of the shell executable
 * @param {string|string[]} opts.params  user-configured shell arguments ("" or [] if none)
 * @param {object} opts.env       environment for the shell (not modified)
 * @returns {{args: string|string[], env: object, cwdFromShell: boolean}}
 *          cwdFromShell is true when the shell will report its cwd through the prompt.
 */
function shellLaunchOptions({ platform, shell, params, env }) {
    const hasCustomParams = Boolean(params && params.length > 0);
    let args = hasCustomParams ? params : (platform === "win32" ? [] : ["--login"]);
    const shellEnv = Object.assign({}, env);
    let cwdFromShell = false;

    if (platform === "win32" && !hasCustomParams) {
        const shellName = path.win32.basename(shell || "").toLowerCase();
        if (shellName === "powershell.exe" || shellName === "pwsh.exe") {
            args = ["-NoExit", "-EncodedCommand", Buffer.from(POWERSHELL_PROMPT_SCRIPT, "utf16le").toString("base64")];
            cwdFromShell = true;
        } else if (shellName === "cmd.exe" && !shellEnv.PROMPT) {
            shellEnv.PROMPT = CMD_PROMPT;
            cwdFromShell = true;
        }
    }

    return { args, env: shellEnv, cwdFromShell };
}

module.exports = {
    shellLaunchOptions,
    POWERSHELL_PROMPT_SCRIPT,
    CMD_PROMPT
};
