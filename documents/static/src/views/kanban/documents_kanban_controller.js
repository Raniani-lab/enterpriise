/** @odoo-module **/

import { KanbanController } from "@web/views/kanban/kanban_controller";

import { DocumentsControllerMixin } from "../documents_controller_mixin";

export class DocumentsKanbanController extends DocumentsControllerMixin(KanbanController) {
    /**
     * @override
     */
    getSelectedDocumentsElements() {
        return this.root.el.querySelectorAll(".o_kanban_record.o_record_selected");
    }

}
DocumentsKanbanController.template = "documents.DocumentsKanbanView";
