/** @odoo-module **/

import { addFields, patchRecordMethods } from "@mail/model/model_core";
import { insertAndReplace } from "@mail/model/model_field_command";
import { one } from "@mail/model/model_field";
import "@mail/models/dialog";

addFields("Dialog", {
    documentListOwnerAsDocumentViewer: one("DocumentList", {
        identifying: true,
        inverse: "documentViewerDialog",
    }),
});

patchRecordMethods("Dialog", {
    /**
     * @override
     * @private
     */
    _computeComponentName() {
        if (this.documentListOwnerAsDocumentViewer) {
            return "AttachmentViewer";
        }
        return this._super();
    },
    /**
     * @override
     * @private
     */
    _computeAttachmentViewer() {
        if (this.documentListOwnerAsDocumentViewer) {
            return insertAndReplace();
        }
        return this._super();
    },
});
