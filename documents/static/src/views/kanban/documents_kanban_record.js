/** @odoo-module **/

import { KanbanRecord } from "@web/views/kanban/kanban_record";
import { DocumentsKanbanCompiler } from "./documents_kanban_compiler";
import { DocumentsFileUploadProgressBar } from "../helper/documents_file_upload";
import { useFileUpload } from "../helper/documents_file_upload_service";
import { KANBAN_BOX_ATTRIBUTE } from "@web/views/kanban/kanban_arch_parser";
import { onNewPdfThumbnail } from "../helper/documents_pdf_thumbnail_service";
import { useService } from "@web/core/utils/hooks";

const CANCEL_GLOBAL_CLICK = ["a", ".dropdown", ".oe_kanban_action"].join(",");

const { xml } = owl;

export class DocumentsKanbanRecord extends KanbanRecord {
    setup() {
        this.props.Compiler = DocumentsKanbanCompiler;
        super.setup();
        useFileUpload(this.props.record.resId);

        this.pdfService = useService("documents_pdf_thumbnail");
        this.pdfService.enqueueRecords([this.props.record]);

        onNewPdfThumbnail(async ({ detail }) => {
            if (detail.record.resId === this.props.record.resId) {
                this.render(true);
            }
        });
    }

    /**
     * @override
     */
    getRecordClasses() {
        let result = super.getRecordClasses();
        if (this.props.record.selected) {
            result += " o_record_selected";
        }
        if (this.props.record.data.type === "empty") {
            result += " oe_file_request";
        }
        return result;
    }

    /**
     * Get the current file upload for this record if there is any
     */
    getFileUpload(record) {
        return this.env.documentsStore.getFileUploadForRecord(record.resId);
    }

    /**
     * @override
     */
    onGlobalClick(ev) {
        if (ev.target.closest(CANCEL_GLOBAL_CLICK)) {
            return;
        }
        // Preview is clicked
        if (ev.target.closest("div[name='document_preview']")) {
            this.props.record.onClickPreview(ev);
            if (ev.cancelBubble) {
                return;
            }
        }
        const options = {};
        if (ev.target.classList.contains("o_record_selector")) {
            options.isKeepSelection = true;
        }
        this.props.record.onRecordClick(ev, options);
    }

    onKeydown(ev) {
        if (ev.key !== "Enter" && ev.key !== " ") {
            return;
        }
        ev.preventDefault();
        const options = {};
        if (ev.key === " ") {
            options.isKeepSelection = true;
        }
        return this.props.record.onRecordClick(ev, options);
    }
}
DocumentsKanbanRecord.components = {
    ...KanbanRecord.components,
    DocumentsFileUploadProgressBar,
};

DocumentsKanbanRecord.template = xml`
    <div
        role="article"
        t-att-class="getRecordClasses()"
        t-att-data-id="props.canResequence and props.record.id"
        t-att-tabindex="props.record.model.useSampleModel ? -1 : 0"
        t-on-click.synthetic="onGlobalClick"
        t-on-keydown.synthetic="onKeydown"
        t-ref="root">
        <t t-call="{{ templates['${KANBAN_BOX_ATTRIBUTE}'] }}"/>
    </div>`;
