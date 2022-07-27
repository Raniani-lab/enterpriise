/** @odoo-module **/

import { KanbanController } from "@web/views/kanban/kanban_controller";

import { DocumentsControllerMixin } from "../documents_controller_mixin";

export class DocumentsKanbanController extends DocumentsControllerMixin(KanbanController) {}
DocumentsKanbanController.template = "documents.DocumentsKanbanView";
