// Helpers for putting untrusted text into HTML and CSS.

const HTML_ESCAPES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
};

/** Escapes text for use in HTML content and quoted attribute values. */
function escapeHtml(text) {
    return String(text === undefined || text === null ? "" : text).replace(/[&<>"']/g, ch => HTML_ESCAPES[ch]);
}

/** Strips "<" from a value going into a <style> block, so it can't close the element. */
function purifyCss(value) {
    if (value === undefined || value === null) return "";
    return String(value).replace(/</g, "");
}

module.exports = {
    escapeHtml,
    purifyCss
};
