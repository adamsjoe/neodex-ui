// Release notes from Conventional Commits (feat:, fix:, ...) between the previous version tag and this one.
// Usage: node scripts/release-notes.js <tag>      (prints Markdown)

const { execFileSync } = require("child_process");

const REPO_URL = "https://github.com/adamsjoe/neodex-ui";
// eDEX-UI's final commit: where neoDEX-UI's history starts. Used when there is no earlier version tag,
// so the first release doesn't list upstream's commits.
const FORK_POINT = "04a00c4079908788b371c6ecdefff96d0d9950f8";

const SECTIONS = [
    { title: "Features", types: ["feat"] },
    { title: "Fixes", types: ["fix"] },
    { title: "Performance", types: ["perf"] },
    { title: "Other changes", types: ["refactor", "build", "ci", "test", "docs", "chore", "style", "revert"], collapsed: true }
];

/** Parses a commit into {type, scope, breaking, description, breakingNote}, or null if not conventional. */
function parseCommit({ hash, subject, body = "" }) {
    const match = /^(\w+)(?:\(([^)]*)\))?(!)?: (.+)$/.exec(subject);
    if (!match) return null;
    // The footer runs to the next blank line or the end of the message (not just the end of its line)
    const footer = /(?:^|\n)BREAKING[ -]CHANGE: ([\s\S]+?)(?=\n\s*\n|\s*$(?![\s\S]))/.exec(body);
    return {
        hash,
        type: match[1].toLowerCase(),
        scope: match[2] || null,
        breaking: Boolean(match[3] || footer),
        description: match[4].trim(),
        breakingNote: footer ? footer[1].replace(/\s*\n\s*/g, " ").trim() : null
    };
}

/** Markdown release notes for a list of {hash, subject, body} commits (newest first, as git log gives them). */
function buildReleaseNotes(commits, { repoUrl = REPO_URL } = {}) {
    const parsed = commits.map(parseCommit).filter(Boolean).reverse(); // oldest first reads better
    const link = c => `[\`${c.hash.slice(0, 7)}\`](${repoUrl}/commit/${c.hash})`;
    const line = c => `- ${c.scope ? `**${c.scope}:** ` : ""}${c.description} (${link(c)})`;
    const out = [];

    const breaking = parsed.filter(c => c.breaking);
    if (breaking.length > 0) {
        out.push("### ⚠ Breaking changes", "");
        for (const c of breaking) out.push(`- ${c.breakingNote || c.description} (${link(c)})`);
        out.push("");
    }
    for (const section of SECTIONS) {
        const items = parsed.filter(c => section.types.includes(c.type));
        if (items.length === 0) continue;
        if (section.collapsed) {
            // Maintenance work: listed, but folded away
            out.push(`<details><summary><strong>${section.title}</strong> (${items.length})</summary>`, "", ...items.map(line), "", "</details>", "");
        } else {
            out.push(`### ${section.title}`, "", ...items.map(line), "");
        }
    }
    if (out.length === 0) out.push("No notable changes.", "");
    return out.join("\n");
}

function git(...args) {
    return execFileSync("git", args, { encoding: "utf-8" }).trim();
}

function commitsBetween(from, to) {
    const raw = git("log", "--format=%H%x1f%s%x1f%b%x1e", `${from}..${to}`);
    return raw.split("\x1e").map(r => r.trim()).filter(Boolean).map(r => {
        const [hash, subject, body] = r.split("\x1f");
        return { hash, subject, body };
    });
}

// Latest version tag before `tag` that belongs to neoDEX-UI (after the fork point), or null for the first
// release. (A clone that still has eDEX-UI's tags, e.g. v2.2.8, must not use them.)
function previousTag(tag) {
    let found;
    try {
        found = git("describe", "--tags", "--abbrev=0", "--match", "v*", `${tag}^`);
    } catch (e) {
        return null; // no earlier tag at all
    }
    const isAfterFork = (() => {
        try {
            git("merge-base", "--is-ancestor", FORK_POINT, found);
            return git("rev-parse", `${found}^{commit}`) !== FORK_POINT;
        } catch (e) {
            return false; // the fork point isn't an ancestor: an eDEX-UI tag
        }
    })();
    return isAfterFork ? found : null;
}

if (require.main === module) {
    const tag = process.argv[2];
    if (!tag) {
        console.error("Usage: node scripts/release-notes.js <tag>");
        process.exit(1);
    }
    const from = previousTag(tag) || FORK_POINT;
    process.stdout.write(buildReleaseNotes(commitsBetween(from, tag)));
}

module.exports = { parseCommit, buildReleaseNotes };
