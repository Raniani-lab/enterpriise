/** @odoo-module **/

import { ListController } from "@web/views/list/list_controller";

import { DocumentsControllerMixin } from "../documents_controller_mixin";

export class DocumentsListController extends DocumentsControllerMixin(ListController) {}

DocumentsListController.template = "documents.DocumentsListController";
