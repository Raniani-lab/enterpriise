/** @odoo-module **/

import { KanbanRenderer } from "@web/views/kanban/kanban_renderer";

import { DocumentsRendererMixin } from "../documents_renderer_mixin";
import { DocumentsDropZone } from "../helper/documents_drop_zone";
import { DocumentsInspector } from "../inspector/documents_inspector";
import { DocumentsFileUploadViewContainer } from "../helper/documents_file_upload";
import { DocumentsKanbanRecord } from "./documents_kanban_record";
import { DocumentsActionHelper } from "../helper/documents_action_helper";
import { DocumentsAttachmentViewer } from "../helper/documents_attachment_viewer";

export class DocumentsKanbanRenderer extends DocumentsRendererMixin(KanbanRenderer) {
    get uploadRecordTemplate() {
        return "documents.DocumentsFileUploadProgressCard";
    }

    /**
     * Focus next card with proper support for up and down arrows.
     *
     * @override
     */
    focusNextCard(area, direction) {
        // We do not need to support groups as it is disabled for this view.
        const cards = area.querySelectorAll(".o_kanban_record");
        if (!cards.length) {
            return;
        }
        // Find out how many cards there are per row.
        let cardsPerRow = 0;
        const firstCardClientTop = cards[0].getBoundingClientRect().top;
        for (const card of cards) {
            if (card.getBoundingClientRect().top === firstCardClientTop) {
                cardsPerRow++;
            } else {
                break;
            }
        }
        // Find out current x and y of the active card.
        const focusedCardIdx = [...cards].indexOf(document.activeElement);
        let newIdx = focusedCardIdx; // up
        if (direction === "up") {
            newIdx -= cardsPerRow; // up
        } else if (direction === "down") {
            newIdx += cardsPerRow; // down
        } else if (direction === "left") {
            newIdx -= 1; // left
        } else if (direction === "right") {
            newIdx += 1; // right
        }
        if (newIdx >= 0 && newIdx < cards.length && cards[newIdx] instanceof HTMLElement) {
            cards[newIdx].focus();
            return true;
        }
    }
}

DocumentsKanbanRenderer.template = "documents.DocumentsKanbanRenderer";
DocumentsKanbanRenderer.components = Object.assign({}, KanbanRenderer.components, {
    DocumentsInspector,
    DocumentsDropZone,
    DocumentsFileUploadViewContainer,
    KanbanRecord: DocumentsKanbanRecord,
    DocumentsActionHelper,
    DocumentsAttachmentViewer,
});
