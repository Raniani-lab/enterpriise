/** @odoo-module **/

import { ListController } from "@web/views/list/list_controller";

import { DocumentsControllerMixin } from "../documents_controller_mixin";

export class DocumentsListController extends DocumentsControllerMixin(ListController) {
    getSelectedDocumentsElements() {
        return this.root.el.querySelectorAll(".o_data_row.o_data_row_selected .o_list_record_selector");
    }
}

DocumentsListController.template = "documents.DocumentsListController";
