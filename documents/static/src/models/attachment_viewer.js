/** @odoo-module **/

import { addFields, addRecordMethods, patchRecordMethods } from "@mail/model/model_core";
import { insertAndReplace } from "@mail/model/model_field_command";
import { attr, one } from "@mail/model/model_field";

addRecordMethods("AttachmentViewer", {
    /**
     * Called upon clicking on the "Split PDF" button
     */
    onClickPdfSplit() {
        if (this.documentList) {
            this.documentList.openPdfManager();
            this.close();
        }
    },
    /**
     * @private
     */
    _computeIsPdfOnly() {
        return this.attachmentViewerViewables.every(viewable => viewable.isPdf);
    },
});

patchRecordMethods("AttachmentViewer", {
    /**
     * @override
     * @private
     */
    _computeAttachmentViewerViewable() {
        if (this.documentList) {
            return this.documentList.selectedDocument.attachmentViewerViewable;
        }
        return this._super();
    },
    /**
     * @override
     * @private
     */
    _computeAttachmentViewerViewables() {
        if (this.documentList) {
            return insertAndReplace(this.documentList.documents.map(doc => {
                return { documentOwner: doc };
            }));
        }
        return this._super();
    },
    /**
     * @override
     * @private
     */
    next() {
        if (this.documentList) {
            this.documentList.selectNextAttachment();
            return;
        }
        return this._super();
    },
    /**
     * @override
     * @private
     */
    previous() {
        if (this.documentList) {
            this.documentList.selectPreviousAttachment();
            return;
        }
        return this._super();
    },
});

addFields("AttachmentViewer", {
    documentList: one("DocumentList", {
        related: "dialogOwner.documentListOwnerAsDocumentViewer",
    }),
    hasPdfSplit: attr({
        default: false,
    }),
    isPdfOnly: attr({
        compute: "_computeIsPdfOnly",
    }),
});
