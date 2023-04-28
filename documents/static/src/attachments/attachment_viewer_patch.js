/* @odoo-module */

import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";
import { FileViewer } from "@web/core/file_viewer/file_viewer";

patch(FileViewer.prototype, "documents", {
    setup() {
        this._super();
        /** @type {import("@documents/core/document_service").DocumentService} */
        this.documentService = useService("document.document");
        this.onSelectDocument = this.documentService.documentList?.onSelectDocument;
    },
    get hasSplitPdf() {
        if (this.documentService.documentList?.initialRecordSelectionLength === 1) {
            return this.documentService.documentList.selectedDocument.attachment.isPdf;
        }
        return this.documentService.documentList?.documents.every(
            (document) => document.attachment.isPdf
        );
    },
    get withDownload() {
        if (this.documentService.documentList?.initialRecordSelectionLength === 1) {
            return this.documentService.documentList.selectedDocument.attachment.isUrlYoutube;
        }
        return this.documentService.documentList?.documents.every(
            (document) => document.attachment.isUrlYoutube
        );
    },
    onClickPdfSplit() {
        if (this.documentService.documentList?.initialRecordSelectionLength === 1) {
            return this.documentService.documentList?.pdfManagerOpenCallback([
                this.documentService.documentList.selectedDocument,
            ]);
        }
        return this.documentService.documentList?.pdfManagerOpenCallback(
            this.documentService.documentList.documents
        );
    },
    close() {
        this.documentService.documentList?.onDeleteCallback();
        this._super();
    },
    next() {
        this._super();
        if (this.onSelectDocument) {
            const index = this.documentService.documentList?.documents.findIndex(
                (document) => document === this.documentService.documentList.selectedDocument
            );
            const nextIndex =
                index === this.documentService.documentList?.documents.length - 1 ? 0 : index + 1;
            this.documentService.documentList.selectedDocument =
                this.documentService.documentList?.documents[nextIndex];
            this.onSelectDocument(this.documentService.documentList.selectedDocument.record);
        }
    },
    previous() {
        this._super();
        if (this.onSelectDocument) {
            const index = this.documentService.documentList?.documents.findIndex(
                (document) => document === this.documentService.documentList?.selectedDocument
            );
            const nextIndex =
                index === this.documentService.documentList?.documents.length - 1 ? 0 : index - 1;
            this.documentService.documentList.selectedDocument =
                this.documentService.documentList?.documents[nextIndex];
            this.onSelectDocument(this.documentService.documentList.selectedDocument.record);
        }
    },
});
