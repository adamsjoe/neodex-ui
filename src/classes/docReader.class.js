class DocReader {
    constructor(opts) {
        const modalElementId = "modal_" + opts.modalId;
        const path = opts.path;
        const scale = 1;
        const canvas = document.getElementById(modalElementId).querySelector(".pdf_canvas");
        // Read the file ourselves: pdf.js would otherwise try to fetch() a raw filesystem path
        const loadingTask = window.neodex.invoke("fs-read-bytes", path).then(bytes => window.pdfjsLib.getDocument({
            data: new Uint8Array(bytes),
            isEvalSupported: false
        }).promise);
        let pdfDoc = null,
            pageNum = 1,
            pageRendering = false,
            pageNumPending = null,
            zoom = 100

        this.renderPage = (num) => {
            pageRendering = true;
            pdfDoc.getPage(num).then(page => {
                const viewport = page.getViewport({ scale: scale });
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                return page.render({ canvas, viewport }).promise;
            }).then(() => {
                pageRendering = false;
                if (pageNumPending !== null) {
                    const next = pageNumPending;
                    pageNumPending = null;
                    this.renderPage(next);
                }
            }).catch(e => {
                pageRendering = false;
                console.error("PDF render failed", e);
            });
            document.getElementById(modalElementId).querySelector(".page_num").textContent = num;
        }

        this.queueRenderPage = (num) => {
            if (pageRendering) {
                pageNumPending = num;
            } else {
                this.renderPage(num);
            }
        }

        this.onPrevPage = () => {
            if (pageNum <= 1) {
                return;
            }
            pageNum--;
            this.queueRenderPage(pageNum);
        }

        this.onNextPage = () => {
            if (pageNum >= pdfDoc.numPages) {
                return;
            }
            pageNum++;
            this.queueRenderPage(pageNum);
        }

        this.zoomIn = () => {
            if (zoom >= 200) {
                return;
            }
            zoom = zoom + 10;
            canvas.style.zoom = zoom + "%";
        }

        this.zoomOut = () => {
            if (zoom <= 50) {
                return;
            }
            zoom = zoom - 10;
            canvas.style.zoom = zoom + "%";
        }

        document.getElementById(modalElementId).querySelector(".previous_page").addEventListener('click', this.onPrevPage);
        document.getElementById(modalElementId).querySelector(".next_page").addEventListener('click', this.onNextPage);
        document.getElementById(modalElementId).querySelector(".zoom_in").addEventListener('click', this.zoomIn);
        document.getElementById(modalElementId).querySelector(".zoom_out").addEventListener('click', this.zoomOut);

        loadingTask.then((pdfDoc_) => {
            pdfDoc = pdfDoc_;
            document.getElementById(modalElementId).querySelector(".page_count").textContent = pdfDoc.numPages;
            this.renderPage(pageNum);
        }).catch(e => {
            document.getElementById(modalElementId).querySelector(".page_count").textContent = "ERROR";
            console.error("Could not open PDF", e);
        });
    }
}

module.exports = {
    DocReader
};