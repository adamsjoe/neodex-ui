// Settings editor: a tabbed form generated from the settings schema (src/lib/settingsSchema.js), with
// inline validation, and a theme picker that previews themes live on the UI and the terminals.

const { SECTIONS, SCHEMA, validateSetting, changeImpact } = require("../lib/settingsSchema.js");
const { parseEnvSetting } = require("../lib/validation.js");

// Runtime-only keys that live in window.settings but must never be written to settings.json
const RUNTIME_KEYS = ["nointroOverride", "nocursorOverride"];

class SettingsEditor {
    static async open() {
        if (document.getElementById("settingsEditor")) return null;
        const editor = new SettingsEditor();
        await editor.init();
        return editor;
    }

    async init() {
        const ipc = window.neodex;
        this.original = this.storedSettings();
        this.originalTheme = window.theme;
        this.previewing = false;
        this.saved = false;

        // Everything the form needs to offer choices and validate
        const [themeNames, keyboards, displayCount, nets] = await Promise.all([
            ipc.invoke("themes-list"),
            ipc.invoke("keyboards-list"),
            ipc.invoke("display-count"),
            // The interface list can be slow (seconds on some Windows machines): don't hold up the editor
            Promise.race([
                window.si.networkInterfaces().then(n => Array.isArray(n) ? n : []),
                window._delay(3000).then(() => [])
            ])
        ]);
        this.themes = {};
        await Promise.all(themeNames.map(async name => {
            try { this.themes[name] = await ipc.invoke("theme-load", name); } catch (e) { /* unreadable theme: skipped */ }
        }));
        this.context = { themes: Object.keys(this.themes), keyboards, displayCount };
        this.interfaces = nets.map(n => n.iface).filter(Boolean);
        this.values = Object.assign({}, this.original);

        window.keyboard.detach();
        this.modal = new Modal({
            type: "custom",
            title: `Settings <i>(v${window._escapeHtml(window._appInfo.version)})</i>`,
            html: this.render(),
            buttons: [
                { label: "Save", action: () => this.save() },
                { label: "Open settings.json", action: () => window.neodex.invoke("open-config-file", "settings") }
            ]
        }, () => this.onClose());
        this.root = document.getElementById("modal_" + this.modal.id);
        this.wire();
        this.validateAll();
    }

    // The settings as stored on disk (window.settings minus runtime-only keys)
    storedSettings() {
        const s = Object.assign({}, window.settings);
        RUNTIME_KEYS.forEach(k => delete s[k]);
        return s;
    }

    // ------------------------------------------------------------------ rendering

    render() {
        const esc = v => window._escapeHtml(String(v === undefined || v === null ? "" : v));
        const tabs = SECTIONS.map((s, i) =>
            `<button type="button" class="settings_tab${i === 0 ? " active" : ""}" data-section="${esc(s)}">${esc(s)}</button>`).join("");

        const sections = SECTIONS.map((section, i) => {
            const rows = SCHEMA.filter(spec => spec.section === section).map(spec => {
                if (spec.type === "theme") return this.renderThemePicker();
                return `<div class="settings_row" data-key="${esc(spec.key)}">
                    <label for="settingsEditor-${esc(spec.key)}">${esc(spec.label)}
                        <span class="settings_applies">${spec.applies === "restart" ? "restart" : "reload"}</span></label>
                    <div class="settings_control">${this.renderControl(spec)}</div>
                    <p class="settings_help">${esc(spec.help)}</p>
                    <p class="settings_error" id="settingsEditor-${esc(spec.key)}-error"></p>
                </div>`;
            }).join("");
            return `<section class="settings_section${i === 0 ? " active" : ""}" data-section="${esc(section)}">${rows}</section>`;
        }).join("");

        return `<div id="settingsEditor">
            <nav class="settings_tabs">${tabs}</nav>
            ${sections}
            <div class="settings_footer">
                <p id="settingsEditorStatus">Changes are saved to settings.json.</p>
                <button type="button" id="settingsEditor-apply" hidden></button>
            </div>
        </div>`;
    }

    renderControl(spec) {
        const esc = v => window._escapeHtml(String(v === undefined || v === null ? "" : v));
        const id = `settingsEditor-${spec.key}`;
        const value = this.values[spec.key];
        const select = (options, current) => `<select id="${id}">${options.map(([v, label]) =>
            `<option value="${esc(v)}"${String(v) === String(current === undefined ? "" : current) ? " selected" : ""}>${esc(label)}</option>`).join("")}</select>`;

        switch (spec.type) {
            case "boolean":
                return `<label class="settings_switch"><input type="checkbox" id="${id}"${value === true ? " checked" : ""}><span></span></label>`;
            case "integer":
            case "number":
                return `<input type="number" id="${id}" min="${spec.min}" max="${spec.max}" step="${spec.step || 1}" value="${esc(value)}">`;
            case "enum":
                return select(spec.options.map(o => [o, (spec.optionLabels && spec.optionLabels[o]) || o]), value);
            case "keyboard":
                return select(this.context.keyboards.map(k => [k, k]), value);
            case "monitor": {
                const options = [["", "Primary display"]];
                for (let i = 0; i < this.context.displayCount; i++) options.push([i, `Display ${i + 1}`]);
                return select(options, value);
            }
            case "env":
                return `<textarea id="${id}" rows="2" spellcheck="false">${esc(value ? JSON.stringify(value) : "")}</textarea>`;
            default:
                if (spec.key === "iface") {
                    const names = this.interfaces.slice();
                    if (value && !names.includes(value)) names.unshift(value);
                    return select([["", "Automatic"]].concat(names.map(n => [n, n])), value);
                }
                return `<input type="text" id="${id}" value="${esc(value)}" spellcheck="false">`;
        }
    }

    renderThemePicker() {
        const esc = v => window._escapeHtml(String(v));
        const cards = Object.keys(this.themes).sort().map(name => {
            const t = this.themes[name];
            const main = `rgb(${Number(t.colors.r)}, ${Number(t.colors.g)}, ${Number(t.colors.b)})`;
            const swatches = [main, t.colors.black, t.colors.light_black, t.colors.grey, t.terminal.background, t.terminal.foreground]
                .filter(Boolean)
                .map(c => `<span style="background: ${window._purifyCSS(String(c).replace(/[;"]/g, ""))}"></span>`).join("");
            return `<button type="button" class="theme_card${name === this.values.theme ? " selected" : ""}" data-theme="${esc(name)}"
                        style="border-color: ${main}; color: ${main}; background: ${window._purifyCSS(String(t.colors.light_black || "#000").replace(/[;"]/g, ""))}">
                <span class="theme_name">${esc(name)}</span>
                <span class="theme_swatches">${swatches}</span>
                <span class="theme_font">${esc(t.terminal.fontFamily || "Fira Mono")}</span>
            </button>`;
        }).join("");
        return `<div class="settings_row settings_themes" data-key="theme">
            <label>Theme <span class="settings_applies">reload</span></label>
            <p class="settings_help">Click a theme to preview it. The graphs and globe change when you save.</p>
            <div class="theme_grid" id="settingsEditor-theme">${cards}</div>
            <p class="settings_error" id="settingsEditor-theme-error"></p>
        </div>`;
    }

    // ------------------------------------------------------------------ behaviour

    wire() {
        // Tabs
        this.root.querySelector(".settings_tabs").addEventListener("click", e => {
            const tab = e.target.closest("[data-section]");
            if (!tab) return;
            this.root.querySelectorAll(".settings_tab, .settings_section").forEach(el => {
                el.classList.toggle("active", el.dataset.section === tab.dataset.section);
            });
        });

        // Fields: read and validate as the user types
        for (const spec of SCHEMA) {
            if (spec.type === "theme") continue;
            const el = this.root.querySelector(`#settingsEditor-${spec.key}`);
            if (!el) continue;
            const update = () => {
                this.read(spec, el);
                this.validateAll();
            };
            el.addEventListener("input", update);
            el.addEventListener("change", update);
        }

        // Theme picker: select and preview
        this.root.querySelector("#settingsEditor-theme").addEventListener("click", e => {
            const card = e.target.closest("[data-theme]");
            if (!card) return;
            this.root.querySelectorAll(".theme_card").forEach(c => c.classList.toggle("selected", c === card));
            this.values.theme = card.dataset.theme;
            this.preview(this.themes[card.dataset.theme]);
            this.validateAll();
        });

        this.root.querySelector("#settingsEditor-apply").addEventListener("click", () => {
            if (this.pendingImpact === "restart") window.neodex.send("app-relaunch");
            else window.location.reload();
        });
    }

    read(spec, el) {
        let value;
        this.parseErrors = this.parseErrors || {};
        delete this.parseErrors[spec.key];
        switch (spec.type) {
            case "boolean":
                value = el.checked;
                break;
            case "integer":
            case "number":
                value = el.value.trim() === "" ? undefined : Number(el.value);
                break;
            case "enum":
                value = spec.options.find(o => String(o) === el.value);
                break;
            case "monitor":
                value = el.value === "" ? undefined : Number(el.value);
                break;
            case "env": {
                const parsed = parseEnvSetting(el.value);
                if (parsed.ok) value = parsed.env;
                else this.parseErrors[spec.key] = parsed.error;
                break;
            }
            default:
                value = el.value === "" && !spec.required ? undefined : el.value;
        }
        if (value === undefined) delete this.values[spec.key];
        else this.values[spec.key] = value;
    }

    validateAll(serverErrors = {}) {
        const errors = {};
        for (const spec of SCHEMA) {
            const error = (this.parseErrors && this.parseErrors[spec.key]) || serverErrors[spec.key]
                || validateSetting(spec.key, this.values[spec.key], this.context);
            if (error) errors[spec.key] = error;
            const errorEl = this.root.querySelector(`#settingsEditor-${spec.key}-error`);
            if (errorEl) errorEl.textContent = error || "";
            const row = this.root.querySelector(`.settings_row[data-key="${spec.key}"]`);
            if (row) row.classList.toggle("invalid", Boolean(error));
        }
        // Mark tabs that contain errors
        this.root.querySelectorAll(".settings_tab").forEach(tab => {
            tab.classList.toggle("invalid", SCHEMA.some(s => s.section === tab.dataset.section && errors[s.key]));
        });
        this.errors = errors;
        return errors;
    }

    preview(theme) {
        if (!theme) return;
        this.previewing = true;
        window._loadTheme(theme);
        Object.values(window.term || {}).forEach(t => { if (t && t.applyTheme) t.applyTheme(theme); });
    }

    revertPreview() {
        if (!this.previewing) return;
        this.previewing = false;
        window._loadTheme(this.originalTheme);
        Object.values(window.term || {}).forEach(t => { if (t && t.applyTheme) t.applyTheme(this.originalTheme); });
    }

    setStatus(text) {
        this.root.querySelector("#settingsEditorStatus").textContent = text;
    }

    async save() {
        if (Object.keys(this.validateAll()).length > 0) {
            this.setStatus("Not saved: fix the highlighted settings first.");
            return;
        }
        const toSave = Object.assign({}, this.values);
        Object.keys(toSave).forEach(k => { if (toSave[k] === undefined) delete toSave[k]; });

        let result;
        try {
            result = await window.neodex.invoke("settings-save", toSave);
        } catch (err) {
            this.setStatus(`Could not save: ${err.message}`);
            return;
        }
        if (!result.ok) {
            this.validateAll(result.errors);
            this.setStatus("Not saved: fix the highlighted settings first.");
            return;
        }

        this.saved = true;
        this.pendingImpact = changeImpact(this.original, toSave) || this.pendingImpact || null;
        this.original = toSave;
        // Keep runtime-only flags (e.g. --nointro from the command line)
        const runtime = {};
        RUNTIME_KEYS.forEach(k => { if (k in window.settings) runtime[k] = window.settings[k]; });
        window.settings = Object.assign(toSave, runtime);
        if (this.previewing) {
            this.originalTheme = window.theme;
            this.previewing = false;
        }

        const apply = this.root.querySelector("#settingsEditor-apply");
        if (this.pendingImpact === "restart") {
            this.setStatus("Saved. Some changes take effect after a restart.");
            apply.textContent = "Restart now";
            apply.hidden = false;
        } else if (this.pendingImpact === "reload") {
            this.setStatus("Saved. Reload the UI to apply everything.");
            apply.textContent = "Reload now";
            apply.hidden = false;
        } else {
            this.setStatus("Saved. Nothing changed.");
            apply.hidden = true;
        }
    }

    onClose() {
        // An unsaved preview is undone (a saved theme has already become the original)
        this.revertPreview();
        window.keyboard.attach();
        window.term[window.currentTerm].term.focus();
    }
}

module.exports = {
    SettingsEditor
};
