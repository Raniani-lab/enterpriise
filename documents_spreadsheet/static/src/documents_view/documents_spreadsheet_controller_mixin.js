/** @odoo-module **/

import { TemplateDialog } from "@documents_spreadsheet/spreadsheet_template/spreadsheet_template_dialog";
import { useService } from "@web/core/utils/hooks";

export const DocumentsSpreadsheetControllerMixin = {
    setup() {
        this._super(...arguments);
        this.action = useService("action");
        this.dialogService = useService("dialog");
    },

    /**
     * @override
     */
    async onOpenDocumentsPreview(ev) {
        const { documents } = ev.detail;
        if (documents.length !== 1 || documents[0].data.handler !== "spreadsheet") {
            return this._super(...arguments);
        }
        this.action.doAction({
            type: "ir.actions.client",
            tag: "action_open_spreadsheet",
            params: {
                spreadsheet_id: documents[0].resId,
            },
        });
    },

    async onClickCreateSpreadsheet(ev) {
        this.dialogService.add(TemplateDialog, {
            folderId: this.env.searchModel.getSelectedFolderId(),
            context: this.props.context,
        });
    },
};
