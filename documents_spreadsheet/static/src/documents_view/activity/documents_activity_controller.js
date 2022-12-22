/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { DocumentsActivityController } from "@documents/views/activity/documents_activity_controller";
import { DocumentsSpreadsheetControllerMixin } from "../documents_spreadsheet_controller_mixin";

patch(DocumentsActivityController.prototype, "documents_spreadsheet_documents_activity_controller", {
    ...DocumentsSpreadsheetControllerMixin,

    /**
     * Prevents spreadsheets from being in the viewable attachments list
     * when previewing a file in the activity view.
     *
     * @override
     */
    isRecordPreviewable(record) {
        return this._super(...arguments) && record.data.handler !== "spreadsheet";
    },
});
