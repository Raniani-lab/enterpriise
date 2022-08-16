/** @odoo-module **/

import { registerModel } from "@mail/model/model_core";
import { clear, replace } from "@mail/model/model_field_command";
import { attr, many, one } from "@mail/model/model_field";

registerModel({
    name: "DocumentList",
    recordMethods: {
        selectNextAttachment() {
            const index = this.viewableDocuments.findIndex((document) => document === this.selectedDocument);
            const nextIndex = index === this.viewableDocuments.length - 1 ? 0 : index + 1;
            this.update({ selectedDocument: replace(this.viewableDocuments[nextIndex]) });
        },
        selectPreviousAttachment() {
            const index = this.viewableDocuments.findIndex((document) => document === this.selectedDocument);
            const prevIndex = index === 0 ? this.viewableDocuments.length - 1 : index - 1;
            this.update({ selectedDocument: replace(this.viewableDocuments[prevIndex]) });
        },
        _computeSelectedDocument() {
            if (!this.viewableDocuments.length) {
                return clear();
            }
            return replace(this.viewableDocuments[0]);
        },
        _computeViewableDocuments() {
            return replace(this.documents.filter((doc) => doc.isViewable));
        },
        openPdfManager() {
            return this.pdfManagerOpenCallback();
        }
    },
    fields: {
        documentViewerDialog: one("Dialog", {
            inverse: "documentListOwnerAsDocumentViewer",
            isCausal: true,
        }),
        documents: many("Document"),
        pdfManagerOpenCallback: attr({
            required: true,
        }),
        selectedDocument: one("Document", {
            compute: "_computeSelectedDocument",
            readonly: false,
        }),
        viewableDocuments: many("Document", {
            compute: "_computeViewableDocuments",
        }),
    },
});
