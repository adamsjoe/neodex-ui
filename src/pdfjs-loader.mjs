// Loads pdf.js (ES-module only) and exposes it as the global the file browser's DocReader uses.
// (Kept out of ui.html so the page needs no inline scripts.)
import * as pdfjsLib from "./node_modules/pdfjs-dist/build/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = "./node_modules/pdfjs-dist/build/pdf.worker.min.mjs";
window.pdfjsLib = pdfjsLib;
