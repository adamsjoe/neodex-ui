class UpdateChecker {
    constructor() {
        const current = window._appInfo.version;
        const log = (level, message) => window.neodex.send("log", level, message);

        // The request to GitHub's API is made by the main process (see "app-latest-release" in _api.js)
        window.neodex.invoke("app-latest-release").then(release => {
            const latest = release.tagName.replace(/^v/, "");
            if (latest === current) {
                log("info", "UpdateChecker: Running latest version.");
            } else if (Number(latest.replace(/\./g, "")) < Number(current.replace("-pre", "").replace(/\./g, ""))) {
                log("info", "UpdateChecker: Running an unreleased, development version.");
            } else {
                let modal = new Modal({
                    type: "info",
                    title: "New version available",
                    message: `neoDEX-UI <strong>${window._escapeHtml(release.tagName)}</strong> is now available.<br/>Head over to <a href="#" class="update-link">github.com</a> to download the latest version.`
                });
                let link = document.querySelector(`#modal_${modal.id} a.update-link`);
                if (link && release.url) {
                    link.addEventListener("click", e => {
                        e.preventDefault();
                        window.neodex.invoke("shell-open-external", release.url);
                    });
                }
                log("info", `UpdateChecker: New version ${release.tagName} available.`);
            }
        }).catch(e => {
            log("note", "UpdateChecker: Could not fetch latest release from GitHub's API.");
            log("debug", `Error: ${e && e.message}`);
        });
    }
}

module.exports = {
    UpdateChecker
};
