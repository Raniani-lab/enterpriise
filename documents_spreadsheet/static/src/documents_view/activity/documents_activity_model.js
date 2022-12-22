/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { DocumentsActivityModel } from "@documents/views/activity/documents_activity_model";

import { XLSX_MIME_TYPE } from "@documents_spreadsheet/helpers";

patch(DocumentsActivityModel.Record.prototype, "documents_spreadsheet_documents_kanban_record", {
    /**
     * @override
     */
    isViewable() {
        return (
            this.data.handler === "spreadsheet" || this.data.mimetype === XLSX_MIME_TYPE || this._super(...arguments)
        );
    },
});
