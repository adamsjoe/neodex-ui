// Minimal stand-in for Node's `path` module in the UI bundle. The only user is mime-types, which needs
// extname() to find a file name's extension.

function extname(p) {
    const base = String(p).split(/[\\/]/).pop();
    const dot = base.lastIndexOf(".");
    return dot > 0 ? base.slice(dot) : "";
}

module.exports = { extname };
