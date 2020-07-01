odoo.define("spreadsheet.DocumentsKanbanController", function (require) {
    "use strict";

    const DocumentsKanbanController = require("documents.DocumentsKanbanController");
    const DocumentsControllerMixin = require("documents.controllerMixin");
    const core = require("web.core");

    const _t = core._t;

    DocumentsKanbanController.include({
        events: _.extend(
            {
                "click .o_documents_kanban_spreadsheet": "_onNewSpreadSheet",
            },
            DocumentsKanbanController.prototype.events
        ),
        //--------------------------------------------------------------------------
        //Private
        //--------------------------------------------------------------------------
        /**
         * Disables the control panel buttons if there is no selected folder.
         *
         * @private
         */
        updateButtons() {
            this._super(...arguments);
            DocumentsControllerMixin.updateButtons.apply(this, arguments);
            const selectedFolderId = this.searchModel.get('selectedFolderId');
            this.$buttons
                .find(".o_documents_kanban_spreadsheet")
                .prop("disabled", !selectedFolderId);
        },
        //--------------------------------------------------------------------------
        // Handlers
        //--------------------------------------------------------------------------
        /**
         * Create a new spreadsheet
         *
         * @private
         * @param {MouseEvent} ev
         */
        _onNewSpreadSheet: async function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            const folder_id = this.searchModel.get('selectedFolderId');
            const spreadsheetId = await this._rpc({
                model: "documents.document",
                method: "create",
                args: [
                    {
                        name: _t("Untitled spreadsheet"),
                        mimetype: "application/o-spreadsheet",
                        folder_id,
                        handler: "spreadsheet",
                        raw: "{}",
                    },
                ],
            });
            this.displayNotification({
                type: "info",
                message: _t("New sheet saved in Documents"),
                sticky: false,
            });
            this.do_action({
                type: "ir.actions.client",
                tag: "action_open_spreadsheet",
                params: {
                    active_id: spreadsheetId,
                },
            });
        },
    });
});
