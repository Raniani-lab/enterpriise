/** @odoo-module **/

import { KanbanController } from "@web/views/kanban/kanban_controller";

import { patch } from "@web/core/utils/patch";
import { DocumentsControllerMixin } from "../documents_controller_mixin";

export class DocumentsKanbanController extends KanbanController {
    setup() {
        super.setup(...arguments);
    }
}

patch(DocumentsKanbanController.prototype, "documents_kanban_controller_mixin", DocumentsControllerMixin);

DocumentsKanbanController.template = "documents.DocumentsKanbanView";
