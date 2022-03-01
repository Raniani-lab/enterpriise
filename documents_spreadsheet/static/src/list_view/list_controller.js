/** @odoo-module */

import ListController from "web.ListController";
import { _t } from "web.core";
import { sprintf } from "@web/core/utils/strings";

import SpreadsheetSelectorDialog from "documents_spreadsheet.SpreadsheetSelectorDialog";
export const MAXIMUM_CELLS_TO_INSERT = 20000;



ListController.include({
    async _insertListSpreadsheet() {
        const spreadsheets = await this._rpc({
            model: "documents.document",
            method: "get_spreadsheets_to_display",
            args: [],
        });
        const model = this.model.get(this.handle);
        const threshold = Math.min(model.count, model.limit);
        const columns = this._getColumnsForSpreadsheet();
        // This maxThreshold is used to ensure that there is not more than
        // MAXIMUM_CELLS_TO_INSERT to insert in the spreadsheet.
        // In the multi-user, we send the commands to the server which transfer
        // through the bus the commands. As the longpolling bus stores the
        // result in the localStorage, we have to ensure that the payload is less
        // than 5mb
        const maxThreshold = Math.floor(MAXIMUM_CELLS_TO_INSERT / columns.length);
        const params = {
            spreadsheets,
            title: _t("Select a spreadsheet to insert your list"),
            threshold,
            maxThreshold,
        };
        const dialog = new SpreadsheetSelectorDialog(this, params).open();
        dialog.on("confirm", this, this._insertInSpreadsheet);
    },

    /**
     * Get the columns of a list to insert in spreadsheet
     *
     * @private
     *
     * @returns {Array<string>} Columns name
     */
    _getColumnsForSpreadsheet() {
        const fields = this.model.get(this.handle).fields;
        return this.renderer.columns
            .filter((col) => col.tag === "field")
            .filter((col) => col.attrs.widget !== "handle")
            .filter((col) => fields[col.attrs.name].type !== "binary")
            .map((col) => col.attrs.name);
    },

    /**
     * Retrieves the list object from an existing view instance.
     *
     * @private
     *
     * @returns {SpreadsheetListForRPC}
     */
    _getListForSpreadsheet() {
        const data = this.model.get(this.handle);
        const columns = this._getColumnsForSpreadsheet();
        return {
            list: {
                model: data.model,
                domain: data.domain,
                orderBy: data.orderedBy,
                context: data.context,
                columns,
            }, fields: this.model.get(this.handle).fields
        };
    },


    /**
     * Open a new spreadsheet or an existing one and insert the list in it.
     *
     * @private
     *
     * @param {Object} params
     * @param {object} params.spreadsheet details of the selected document 
     *                                  in which the pivot should be inserted. undefined if
     *                                  it's a new sheet. Might be null is no spreadsheet was selected
     * @param {number} params.spreadsheet.id the id of the selected spreadsheet
     * @param {string} params.spreadsheet.name the name of the selected spreadsheet
     *
     */
    async _insertInSpreadsheet({ id: spreadsheet, threshold }) {
        let notificationMessage;
        const list = this._getListForSpreadsheet();
        const actionOptions = {
            preProcessingAction: "insertList",
            preProcessingActionData: { list: list.list, threshold, fields: list.fields }
        };

        if (!spreadsheet) {
            actionOptions.alwaysCreate = true;
            notificationMessage = _t("New spreadsheet created in Documents");
        } else {
            actionOptions.spreadsheet_id = spreadsheet.id;
            notificationMessage = sprintf(
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
            params: actionOptions,
        });
    },

    on_attach_callback() {
        this._super(...arguments);
        if (this.searchModel) {
            this.searchModel.on("insert-list-spreadsheet", this, this._insertListSpreadsheet);
        }
    },

    on_detach_callback() {
        this._super(...arguments);
        if (this.searchModel) {
            this.searchModel.off("insert-list-spreadsheet", this);
        }
    },
});
