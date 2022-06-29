/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { DocumentsKanbanRecord } from "@documents/views/kanban/documents_kanban_model";

patch(DocumentsKanbanRecord.prototype, "documents_spreadsheet_documents_kanban_record", {
    /**
     * @override
     */
    isViewable() {
      return this.data.handler === "spreadsheet" || this._super(...arguments);
    },
});
