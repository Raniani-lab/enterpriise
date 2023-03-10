/** @odoo-module **/

import { TemplateDialog } from "@documents_spreadsheet/spreadsheet_template/spreadsheet_template_dialog";
import { useService } from "@web/core/utils/hooks";
import { ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { SpreadsheetCloneXlsxDialog } from "@documents_spreadsheet/spreadsheet_clone_xlsx_dialog/spreadsheet_clone_xlsx_dialog";
import { _t } from "@web/core/l10n/translation";

import { XLSX_MIME_TYPE } from "@documents_spreadsheet/helpers";

export const DocumentsSpreadsheetControllerMixin = {
    setup() {
        this._super(...arguments);
        this.action = useService("action");
        this.dialogService = useService("dialog");
        // Hack-ish way to do this but the function is added by a hook which we can't really override.
        this.baseOnOpenDocumentsPreview = this.onOpenDocumentsPreview.bind(this);
        this.onOpenDocumentsPreview = this._onOpenDocumentsPreview.bind(this);
    },

    /**
     * @override
     */
    async _onOpenDocumentsPreview({ documents }) {
        if (
            documents.length !== 1 ||
            (documents[0].data.handler !== "spreadsheet" &&
                documents[0].data.mimetype !== XLSX_MIME_TYPE)
        ) {
            return this.baseOnOpenDocumentsPreview(...arguments);
        }
        if (documents[0].data.handler === "spreadsheet") {
            this.action.doAction({
                type: "ir.actions.client",
                tag: "action_open_spreadsheet",
                params: {
                    spreadsheet_id: documents[0].resId,
                },
            });
        } else if (documents[0].data.mimetype === XLSX_MIME_TYPE) {
            if (!documents[0].data.active) {
                this.dialogService.add(ConfirmationDialog, {
                    title: _t("Restore file?"),
                    body: _t(
                        "Spreadsheet files cannot be handled from the Trash. Would you like to restore this document?"
                    ),
                    cancel: () => {},
                    confirm: async () => {
                        await this.orm.call("documents.document", "action_unarchive", [
                            documents[0].resId,
                        ]);
                        toggleDomainFilterIfEnabled(
                            this.env.searchModel,
                            "[('active', '=', False)]"
                        );
                    },
                    confirmLabel: _t("Restore"),
                });
            } else {
                this.dialogService.add(SpreadsheetCloneXlsxDialog, {
                    title: _t("Format issue"),
                    cancel: () => {},
                    cancelLabel: _t("Discard"),
                    documentId: documents[0].resId,
                    confirmLabel: _t("Open with Odoo Spreadsheet"),
                });
            }
        }
    },

    async onClickCreateSpreadsheet(ev) {
        this.dialogService.add(TemplateDialog, {
            folderId: this.env.searchModel.getSelectedFolderId(),
            context: this.props.context,
        });
    },
};

function toggleDomainFilterIfEnabled(searchModel, domain) {
    for (const { searchItemId } of searchModel.query) {
        if (searchModel.searchItems[searchItemId].domain === domain) {
            searchModel.toggleSearchItem(searchItemId);
            return;
        }
    }
}
