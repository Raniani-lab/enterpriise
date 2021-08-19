odoo.define("documents_spreadsheet.PivotController", function (require) {
    "use strict";

    const core = require("web.core");
    const config = require('web.config');
    const PivotController = require("web.PivotController");
    const session = require("web.session");

    const pivotUtils = require("documents_spreadsheet.pivot_utils");
    const SpreadsheetSelectorDialog = require("documents_spreadsheet.SpreadsheetSelectorDialog");
    const spreadsheet = require("documents_spreadsheet.spreadsheet_extended");
    const { UNTITLED_SPREADSHEET_NAME } = require("@documents_spreadsheet/constants");

    const _t = core._t;
    const uuidGenerator = new spreadsheet.helpers.UuidGenerator();

    PivotController.include({
        init() {
            this._super(...arguments);
            session.user_has_group("documents.group_documents_user").then((has_group) => {
                this.canInsertPivot = has_group;
            });
        },

        /**
         * Disable the spreadsheet button when data is empty. It makes no sense
         * to insert an empty pivot in a spreadsheet
         *
         * @override
         */
        updateButtons: function () {
            this._super(...arguments);
            if (!this.$buttons) {
                return;
            }
            const state = this.model.get({ raw: true });
            const noDataDisplayed = !state.hasData || !state.measures.length;
            this.$buttons.filter('.o_pivot_add_spreadsheet').prop('disabled', noDataDisplayed);
        },

        //----------------------------------------------------------------------
        // Handlers
        //----------------------------------------------------------------------

        /**
         * Add export button to insert a pivot in a Workbook.
         * It will prompt a Dialog to choose either a new sheet (and a
         * workspace), or an existing one.
         *
         * @private
         * @param {MouseEvent} ev
         */
        _addIncludedButtons: async function (ev) {
            await this._super(...arguments);
            if ($(ev.target).hasClass("o_pivot_add_spreadsheet")) {
                const spreadsheets = await this._rpc({
                    model: "documents.document",
                    method: "get_spreadsheets_to_display",
                    args: [],
                });
                const dialog = new SpreadsheetSelectorDialog(this, spreadsheets).open();
                dialog.on("confirm", this, this._insertInSpreadsheet);
            }
        },
        /**
         * @override
         */
        _getRenderButtonContext: function () {
            const context = this._super(...arguments);
            context.canInsertPivot = this.canInsertPivot;
            context.isMobile = config.device.isMobile;
            return context;
        },

        //----------------------------------------------------------------------
        // Private
        //----------------------------------------------------------------------

        /**
         * Create a new empty spreadsheet
         *
         * @private
         * @returns ID of the newly created spreadsheet
         */
        async _createEmptySpreadsheet() {
            return await this._rpc({
                model: "documents.document",
                method: "create",
                args: [
                    {
                        name: UNTITLED_SPREADSHEET_NAME,
                        mimetype: "application/o-spreadsheet",
                        handler: "spreadsheet",
                        raw: "{}",
                    },
                ],
            });
        },
        /**
         * Get the function to be called when the spreadsheet is opened in order
         * to insert the pivot.
         *
         * @param {boolean} isEmptySpreadsheet True if the pivot is inserted in
         *                                     an empty spreadsheet, false
         *                                     otherwise
         *
         * @private
         * @returns Function to call
         */
        async _getCallbackBuildPivot(isEmptySpreadsheet) {
            const { pivot, cache } = await this._getPivotForSpreadsheet();
            return (model) => {
                if (!isEmptySpreadsheet) {
                    const sheetId = uuidGenerator.uuidv4();
                    const sheetIdFrom = model.getters.getActiveSheetId();
                    model.dispatch("CREATE_SHEET", {
                        sheetId,
                        position: model.getters.getVisibleSheets().length
                    });
                    model.dispatch("ACTIVATE_SHEET", { sheetIdFrom, sheetIdTo: sheetId});
                }
                model.dispatch("BUILD_PIVOT", {
                    sheetId: model.getters.getActiveSheetId(),
                    pivot,
                    cache,
                    anchor: [0, 0],
                });
            }
        },
        /**
         * Retrieves the pivot data from an existing view instance.
         *
         * @private
         * @returns {Object} { pivot: Pivot, cache: PivotCache}
         */
        async _getPivotForSpreadsheet() {
            const payload = this.model.get();
            const pivot = pivotUtils.sanitizePivot(payload);
            const cache = await pivotUtils.createPivotCache(pivot, this._rpc.bind(this));
            return { pivot, cache };
        },
        /**
         * Open a new spreadsheet or an existing one and insert the pivot in it.
         *
         * @param {number|false} spreadsheet Id of the document in which the
         *                                   pivot should be inserted. False if
         *                                   it's a new sheet
         *
         * @private
         */
        async _insertInSpreadsheet(spreadsheet) {
            let documentId;
            let notificationMessage;
            const initCallback = await this._getCallbackBuildPivot(!spreadsheet);
            if (!spreadsheet) {
                documentId = await this._createEmptySpreadsheet();
                notificationMessage = _t("New spreadsheet created in Documents");
            } else {
                documentId = spreadsheet.id;
                notificationMessage = notificationMessage = _.str.sprintf(
                    _t("New sheet inserted in '%s'"),
                    spreadsheet.name
                );
            }
            this.displayNotification({
                type: "info",
                message: notificationMessage,
                sticky: false,
            });
            this.do_action({
                type: "ir.actions.client",
                tag: "action_open_spreadsheet",
                params: {
                    active_id: documentId,
                    initCallback,
                },
            });
        },
    });
});
