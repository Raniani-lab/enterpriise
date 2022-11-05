/** @odoo-module **/

import { attr, many, one, registerModel } from "@mail/model";

registerModel({
    name: "DocumentList",
    lifecycleHooks: {
        _willDelete() {
            this.onDeleteCallback();
        },
    },
    recordMethods: {
        selectNextAttachment() {
            const index = this.viewableDocuments.findIndex((document) => document === this.selectedDocument);
            const nextIndex = index === this.viewableDocuments.length - 1 ? 0 : index + 1;
            this.update({ selectedDocument: this.viewableDocuments[nextIndex] });
            this.onSelectDocument(this.selectedDocument.record);
        },
        selectPreviousAttachment() {
            const index = this.viewableDocuments.findIndex((document) => document === this.selectedDocument);
            const prevIndex = index === 0 ? this.viewableDocuments.length - 1 : index - 1;
            this.update({ selectedDocument: this.viewableDocuments[prevIndex] });
            this.onSelectDocument(this.selectedDocument.record);
        },
        openPdfManager() {
            const documents = this.initialRecordSelectionLength === 1 ? [this.selectedDocument.record] : this.viewableDocuments.map(doc => doc.record);
            return this.pdfManagerOpenCallback(documents);
        }
    },
    fields: {
        attachmentViewer: one("AttachmentViewer", {
            inverse: "documentListOwner",
        }),
        documents: many("Document"),
        initialRecordSelectionLength: attr({
            required: true,
        }),
        onDeleteCallback: attr({
            required: true,
        }),
        onSelectDocument: attr({
            required: true,
        }),
        pdfManagerOpenCallback: attr({
            required: true,
        }),
        selectedDocument: one("Document"),
        viewableDocuments: many("Document", {
            compute() {
                return this.documents.filter((doc) => doc.isViewable);
            },
        }),
    },
});
