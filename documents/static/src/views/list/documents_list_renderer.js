/** @odoo-module **/

import { ListRenderer } from "@web/views/list/list_renderer";

import { patch } from "@web/core/utils/patch";
import { DocumentsRendererMixin } from "../documents_renderer_mixin";
import { DocumentsInspector } from "../inspector/documents_inspector";
import { DocumentsFileUploadViewContainer } from "../helper/documents_file_upload";
import { DocumentsDropZone } from "../helper/documents_drop_zone";
import { CheckBox } from "@web/core/checkbox/checkbox";
import { DocumentsActionHelper } from "../helper/documents_action_helper";

const { useEffect } = owl;

export class DocumentsListRenderer extends ListRenderer {
    setup() {
        super.setup();
        useEffect(
            (el) => {
                if (!el) {
                    return;
                }
                const handler = (ev) => {
                    if (ev.key !== "Enter" && ev.key !== " ") {
                        return;
                    }
                    const row = ev.target.closest(".o_data_row");
                    const record = row && this.props.list.records.find((rec) => rec.id === row.dataset.id);
                    if (!record) {
                        return;
                    }
                    const options = {};
                    if (ev.key === " ") {
                        options.isKeepSelection = true;
                    }
                    ev.stopPropagation();
                    record.onRecordClick(ev, options);
                };
                el.addEventListener("keydown", handler);
                return () => {
                    el.removeEventListener("keydown", handler);
                };
            },
            () => [this.root.el]
        );
    }

    get hasSelectors() {
        return this.props.hasSelectors;
    }

    get uploadRecordTemplate() {
        return "documents.DocumentsFileUploadProgressLine";
    }

    /**
     * @override
     */
    getRowClass(record) {
        let result = super.getRowClass(record) + " o_document_draggable";
        if (record.selected) {
            result += " o_data_row_selected";
        }
        return result;
    }
}
patch(DocumentsListRenderer.prototype, "documents_list_renderer_mixin", DocumentsRendererMixin);

// We need the actual event when clicking on a checkbox (to support multi select), only accept onClick
export class DocumentsListRendererCheckBox extends CheckBox {
    /**
     * @override
     */
    onChange(ev) {}

    /**
     * @override
     */
    onClick(ev) {
        if (ev.target.tagName !== "INPUT") {
            return;
        }
        this.props.onChange(ev);
    }
}

DocumentsListRenderer.template = "documents.DocumentsListRenderer";
DocumentsListRenderer.components = Object.assign({}, ListRenderer.components, {
    DocumentsInspector,
    DocumentsListRendererCheckBox,
    DocumentsFileUploadViewContainer,
    DocumentsDropZone,
    DocumentsActionHelper,
});
