const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { escapeHtml, purifyCss } = require("../../src/lib/escape.js");

describe("escapeHtml", () => {
    test("escapes all HTML-significant characters", () => {
        assert.equal(escapeHtml(`<img src=x onerror="alert('1')">&`), "&lt;img src=x onerror=&quot;alert(&#039;1&#039;)&quot;&gt;&amp;");
    });

    test("escapes ampersands first, so existing entities stay visible as text", () => {
        assert.equal(escapeHtml("&lt;"), "&amp;lt;");
    });

    test("leaves ordinary text alone", () => {
        assert.equal(escapeHtml("C:\\Users\\josep\\My Files"), "C:\\Users\\josep\\My Files");
    });

    test("accepts non-strings", () => {
        assert.equal(escapeHtml(42), "42");
        assert.equal(escapeHtml(undefined), "");
        assert.equal(escapeHtml(null), "");
    });
});

describe("purifyCss", () => {
    test("removes < so a value can't close the <style> element", () => {
        assert.equal(purifyCss("red;}</style><script>x()</script>"), "red;}/style>script>x()/script>");
    });

    test("accepts numbers and missing values", () => {
        assert.equal(purifyCss(170), "170");
        assert.equal(purifyCss(undefined), "");
        assert.equal(purifyCss(null), "");
    });
});
