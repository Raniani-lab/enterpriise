/** @odoo-module */

import ListController from "web.ListController";
import { _t } from "web.core";
import { sprintf } from "@web/core/utils/strings";

import SpreadsheetSelectorDialog from "documents_spreadsheet.SpreadsheetSelectorDialog";
import { removeContextUserInfo } from "../helpers";



ListController.include({
    async _insertListSpreadsheet() {
        const model = this.model.get(this.handle);
        const spreadsheets = await this._rpc({
            model: "documents.document",
            method: "get_spreadsheets_to_display",
            args: [],
        });
        const threshold = Math.min(model.count, model.limit);

        let name = this._title;
        const sortBy = model.orderedBy[0];
        if (sortBy) {
            name += ` ${_t("by")} ` + model.fields[sortBy.name].string;
        }

        const params = {
            spreadsheets,
            title: _t("Select a spreadsheet to insert your list"),
            threshold,
            type: "LIST",
            name,
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
            .map((col) => ({name: col.attrs.name, type: fields[col.attrs.name].type}));
    },

    /**
     * Retrieves the list object from an existing view instance.
     *
     * @private
     * @param {string} name Name of the list
     *
     */
    _getListForSpreadsheet(name) {
        const data = this.model.get(this.handle);
        return {
            list: {
                model: data.model,
                domain: data.domain,
                orderBy: data.orderedBy,
                context: removeContextUserInfo(data.context),
                columns: this._getColumnsForSpreadsheet(),
                name,
            },
            fields: data.fields,
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
     * @param {number} params.threshold Number of records to insert
     * @param {string} params.name Name of the list
     *
     */
    async _insertInSpreadsheet({ id: spreadsheet, threshold, name }) {
        let notificationMessage;
        const { list, fields } = this._getListForSpreadsheet(name);
        const actionOptions = {
            preProcessingAsyncAction: "insertList",
            preProcessingAsyncActionData: { list, threshold, fields }
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
