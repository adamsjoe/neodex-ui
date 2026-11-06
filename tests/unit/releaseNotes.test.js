const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { parseCommit, buildReleaseNotes } = require("../../scripts/release-notes.js");

const hash = n => String(n).padEnd(40, "0"); // short hash: "2000000" for 2

describe("parseCommit", () => {
    test("reads type, scope and description", () => {
        assert.deepEqual(parseCommit({ hash: hash(1), subject: "fix(terminal): handle resize", body: "" }), {
            hash: hash(1), type: "fix", scope: "terminal", breaking: false, description: "handle resize", breakingNote: null
        });
    });

    test("! after the type marks a breaking change", () => {
        const c = parseCommit({ hash: hash(1), subject: "feat!: drop the port setting", body: "" });
        assert.equal(c.breaking, true);
        assert.equal(c.breakingNote, null);
    });

    test("reads a multi-line BREAKING CHANGE footer, up to the next blank line", () => {
        const c = parseCommit({
            hash: hash(1),
            subject: "chore!: rebrand",
            body: "Some details.\n\nBREAKING CHANGE: settings live in a new\nconfig directory.\n\nTrailer: x"
        });
        assert.equal(c.breaking, true);
        assert.equal(c.breakingNote, "settings live in a new config directory.");
    });

    test("ignores commits that aren't Conventional Commits", () => {
        assert.equal(parseCommit({ hash: hash(1), subject: "Merge branch 'x'", body: "" }), null);
        assert.equal(parseCommit({ hash: hash(1), subject: "fixed stuff", body: "" }), null);
    });
});

describe("buildReleaseNotes", () => {
    const commits = [ // newest first, as git log lists them
        { hash: hash(4), subject: "docs: update roadmap", body: "" },
        { hash: hash(3), subject: "fix(ui): stop the flicker", body: "" },
        { hash: hash(2), subject: "feat!: new IPC transport", body: "BREAKING CHANGE: the port setting is gone." },
        { hash: hash(1), subject: "random old commit", body: "" }
    ];
    const notes = buildReleaseNotes(commits, { repoUrl: "https://example.com/repo" });

    test("lists breaking changes first, with their footer text", () => {
        assert.match(notes, /^### ⚠ Breaking changes\n\n- the port setting is gone\. \(\[`2000000`\]\(https:\/\/example\.com\/repo\/commit\/20{39}\)\)/);
    });

    test("groups features and fixes, with scopes, and folds other changes away", () => {
        assert.match(notes, /### Features\n\n- new IPC transport/);
        assert.match(notes, /### Fixes\n\n- \*\*ui:\*\* stop the flicker/);
        assert.match(notes, /<details><summary><strong>Other changes<\/strong> \(1\)<\/summary>\n\n- update roadmap/);
    });

    test("leaves out non-conventional commits", () => {
        assert.doesNotMatch(notes, /random old commit/);
    });

    test("says so when there's nothing to list", () => {
        assert.equal(buildReleaseNotes([{ hash: hash(1), subject: "wip", body: "" }]), "No notable changes.\n");
    });
});
