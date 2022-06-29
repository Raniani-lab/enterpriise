/** @odoo-module **/

import { ListController } from "@web/views/list/list_controller";

import { patch } from "@web/core/utils/patch";
import { DocumentsControllerMixin } from "../documents_controller_mixin";

export class DocumentsListController extends ListController {
    setup() {
        super.setup(...arguments);
    }
}

patch(DocumentsListController.prototype, "documents_list_controller_mixin", DocumentsControllerMixin);

DocumentsListController.template = "documents.DocumentsListController";
