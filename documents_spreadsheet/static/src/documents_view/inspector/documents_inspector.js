/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";
import { inspectorFields, DocumentsInspector } from "@documents/views/inspector/documents_inspector";

inspectorFields.push("handler");

patch(DocumentsInspector.prototype, "documents_spreadsheet_documents_inspector", {
    /**
     * @override
     */
    setup() {
        this._super(...arguments);
        this.notification = useService("notification");
    },

    /**
     * @override
     */
    getRecordAdditionalData(record) {
        const result = this._super(...arguments);
        result.isSheet = record.data.handler === "spreadsheet";
        return result;
    },

    /**
     * @override
     */
    getPreviewClasses(record, additionalData) {
        const result = this._super(...arguments);
        if (additionalData.isSheet) {
            return result.replace("o_documents_preview_mimetype", "o_documents_preview_image");
        }
        return result;
    },

    openSpreadsheet(record) {
        this.env.bus.trigger("documents-open-preview", {
            documents: [record],
            isPdfSplit: false,
            rules: [],
            hasPdfSplit: false,
        });
    },

    /**
     * @override
     */
    onDownload() {
        const selection = this.props.selection;
        if (selection.some((record) => record.data.handler === "spreadsheet")) {
            if (selection.length === 1) {
                this.action.doAction({
                    type: "ir.actions.client",
                    tag: "action_open_spreadsheet",
                    params: {
                        spreadsheet_id: selection[0].resId,
                        download: true,
                    },
                });
            } else {
                this.notification.add(
                    this.env._t(
                        "Spreadsheets mass download not yet supported.\n Download spreadsheets individually instead."
                    ),
                    {
                        sticky: false,
                        type: "danger",
                    }
                );
                this.download(selection.filter((rec) => rec.data.handler !== "spreadsheet"));
            }
        } else {
            this._super(...arguments);
        }
    },
});
