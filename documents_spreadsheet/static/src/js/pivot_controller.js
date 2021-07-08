/** @odoo-module */
/* global $ _ */

import { _t } from "web.core";
import spreadsheet from "./o_spreadsheet/o_spreadsheet_extended";
import config from "web.config";
import session from "web.session";
import PivotController from "web.PivotController";
import { sanitizePivot } from "./o_spreadsheet/helpers/pivot_helpers";
import SpreadsheetSelectorDialog from "documents_spreadsheet.SpreadsheetSelectorDialog";
import { createEmptySpreadsheet } from "./o_spreadsheet/helpers/helpers";
import PivotDataSource from "./o_spreadsheet/helpers/pivot_data_source";

const uuidGenerator = new spreadsheet.helpers.UuidGenerator();

/**
 * @typedef {import("./o_spreadsheet/plugins/core/pivot_plugin").SpreadsheetPivot} SpreadsheetPivot
 */

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
        this.$buttons.filter(".o_pivot_add_spreadsheet").prop("disabled", noDataDisplayed);
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
            const params = {
                spreadsheets,
                title: _t("Select a spreadsheet to insert your pivot"),
            };
            const dialog = new SpreadsheetSelectorDialog(this, params).open();
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

    async _getPivotCache(pivot) {
        const dataSource = new PivotDataSource({
            rpc: this._rpc.bind(this),
            definition: pivot,
            model: pivot.model,
        });
        return dataSource.get({ domain: pivot.domain });
    },

    /**
     * Get the function to be called when the spreadsheet is opened in order
     * to insert the pivot.
     *
     * @param {boolean} isNewSpreadsheet True if the pivot is inserted in
     *                                     an empty spreadsheet, false
     *                                     otherwise
     *
     * @private
     * @returns Function to call
     */
    async _getCallbackBuildPivot(pivot, isNewSpreadsheet) {
        const cache = await this._getPivotCache(pivot);
        return (model) => {
            if (!isNewSpreadsheet) {
                const sheetId = uuidGenerator.uuidv4();
                const sheetIdFrom = model.getters.getActiveSheetId();
                model.dispatch("CREATE_SHEET", {
                    sheetId,
                    position: model.getters.getVisibleSheets().length,
                });
                model.dispatch("ACTIVATE_SHEET", { sheetIdFrom, sheetIdTo: sheetId });
            }
            pivot.id = model.getters.getNextPivotId();
            model.dispatch("BUILD_PIVOT", {
                sheetId: model.getters.getActiveSheetId(),
                pivot,
                cache,
                anchor: [0, 0],
            });
        };
    },
    /**
     * Retrieves the pivot data from an existing view instance.
     *
     * @private
     * @returns {SpreadsheetPivot}
     */
    _getPivotForSpreadsheet() {
        const payload = this.model.get();
        return sanitizePivot(payload);
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
    async _insertInSpreadsheet({ id: spreadsheet }) {
        let documentId;
        let notificationMessage;
        const pivot = this._getPivotForSpreadsheet();
        if (!spreadsheet) {
            documentId = await createEmptySpreadsheet(this._rpc.bind(this));
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
                initCallback: await this._getCallbackBuildPivot(pivot, !spreadsheet),
            },
        });
    },
});
