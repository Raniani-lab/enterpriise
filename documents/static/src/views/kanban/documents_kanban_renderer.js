/** @odoo-module **/

import { KanbanRenderer } from "@web/views/kanban/kanban_renderer";

import { DocumentsRendererMixin } from "../documents_renderer_mixin";
import { DocumentsDropZone } from "../helper/documents_drop_zone";
import { DocumentsInspector } from "../inspector/documents_inspector";
import { DocumentsFileUploadViewContainer } from "../helper/documents_file_upload";
import { DocumentsKanbanRecord } from "./documents_kanban_record";
import { DocumentsActionHelper } from "../helper/documents_action_helper";

export class DocumentsKanbanRenderer extends DocumentsRendererMixin(KanbanRenderer) {
    get uploadRecordTemplate() {
        return "documents.DocumentsFileUploadProgressCard";
    }
}

DocumentsKanbanRenderer.template = "documents.DocumentsKanbanRenderer";
DocumentsKanbanRenderer.components = Object.assign({}, KanbanRenderer.components, {
    DocumentsInspector,
    DocumentsDropZone,
    DocumentsFileUploadViewContainer,
    KanbanRecord: DocumentsKanbanRecord,
    DocumentsActionHelper,
});
