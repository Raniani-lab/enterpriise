/** @odoo-module **/

import { addFields, addRecordMethods, patchRecordMethods } from "@mail/model/model_core";
import { attr, one } from "@mail/model/model_field";

addRecordMethods("AttachmentViewer", {
    /**
     * Called upon clicking on the "Split PDF" button
     */
    onClickPdfSplit() {
        if (this.documentListOwner) {
            this.documentListOwner.openPdfManager();
            this.close();
        }
    },
    /**
     * If the initial record selection is a single record, and the current record is a pdf, return true.
     * If the initial record selection is a list, return true if every record is a pdf.
     *
     * @private
     */
    _computeWithPdfSplit() { 
        if (!this.documentListOwner) {
            return false;
        }
        if (this.documentListOwner.initialRecordSelectionLength === 1) {
            return this.attachmentViewerViewable.isPdf;
        }
        return this.attachmentViewerViewables.every(viewable => viewable.isPdf);
    },
});

patchRecordMethods("AttachmentViewer", {
    /**
     * @override
     * @private
     */
    _computeAttachmentViewerViewable() {
        if (this.documentListOwner) {
            return this.documentListOwner.selectedDocument.attachmentViewerViewable;
        }
        return this._super();
    },
    /**
     * @override
     * @private
     */
    _computeAttachmentViewerViewables() {
        if (this.documentListOwner) {
            return this.documentListOwner.documents.map(doc => {
                return { documentOwner: doc };
            });
        }
        return this._super();
    },
    /**
     * @override
     * @private
     */
    next() {
        if (this.documentListOwner) {
            this.documentListOwner.selectNextAttachment();
            return;
        }
        return this._super();
    },
    /**
     * @override
     * @private
     */
    previous() {
        if (this.documentListOwner) {
            this.documentListOwner.selectPreviousAttachment();
            return;
        }
        return this._super();
    },
});

addFields("AttachmentViewer", {
    documentListOwner: one("DocumentList", {
        identifying: true,
        inverse: "attachmentViewer",
        isCausal: true,
    }),
    hasPdfSplit: attr({
        default: false,
    }),
    withPdfSplit: attr({
        compute: "_computeWithPdfSplit",
    }),
});
