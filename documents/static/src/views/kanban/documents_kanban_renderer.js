/** @odoo-module **/

import { KanbanRenderer } from "@web/views/kanban/kanban_renderer";

import { patch } from "@web/core/utils/patch";
import { DocumentsRendererMixin } from "../documents_renderer_mixin";
import { DocumentsDropZone } from "../helper/documents_drop_zone";
import { DocumentsInspector } from "../inspector/documents_inspector";
import { DocumentsFileUploadViewContainer } from "../helper/documents_file_upload";
import { DocumentsKanbanRecord } from "./documents_kanban_record";
import { DocumentsActionHelper } from "../helper/documents_action_helper";

export class DocumentsKanbanRenderer extends KanbanRenderer {
    setup() {
        super.setup(...arguments);
    }

    get uploadRecordTemplate() {
        return "documents.DocumentsFileUploadProgressCard";
    }
}
patch(DocumentsKanbanRenderer.prototype, "documents_kanban_renderer_mixin", DocumentsRendererMixin);

DocumentsKanbanRenderer.template = "documents.DocumentsKanbanRenderer";
DocumentsKanbanRenderer.components = Object.assign({}, KanbanRenderer.components, {
    DocumentsInspector,
    DocumentsDropZone,
    DocumentsFileUploadViewContainer,
    KanbanRecord: DocumentsKanbanRecord,
    DocumentsActionHelper,
});
