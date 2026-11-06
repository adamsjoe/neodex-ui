// Entry point for the UI bundle (built by scripts/build-renderer.js into src/build/renderer.js).
//
// The UI modules still talk to each other through globals, as they did when each was its own <script>:
// expose the classes on window first, then start the app (_renderer.js).

const classes = [
    require("../classes/modal.class.js"),
    require("../classes/terminal.class.js"),
    require("../classes/docReader.class.js"),
    require("../classes/mediaPlayer.class.js"),
    require("../classes/filesystem.class.js"),
    require("../classes/keyboard.class.js"),
    require("../classes/updateChecker.class.js"),
    require("../classes/clock.class.js"),
    require("../classes/sysinfo.class.js"),
    require("../classes/hardwareInspector.class.js"),
    require("../classes/cpuinfo.class.js"),
    require("../classes/netstat.class.js"),
    require("../classes/conninfo.class.js"),
    require("../classes/locationGlobe.class.js"),
    require("../classes/ramwatcher.class.js"),
    require("../classes/toplist.class.js"),
    require("../classes/fuzzyFinder.class.js"),
    require("../classes/audiofx.class.js")
];
for (const exported of classes) Object.assign(window, exported);

require("../_renderer.js");
