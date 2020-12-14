odoo.define("documents_spreadsheet/static/src/js/actions/spreadsheet_template_action.js", function (require) {
    "use strict";

    const AbstractAction = require("documents_spreadsheet/static/src/js/actions/spreadsheet_abstract_action.js");
    const core = require("web.core");

    const { _lt, _t } = core;

    const SpreadsheetAction = AbstractAction.extend({
        notificationMessage: _lt("New spreadsheet template created"),
        thumbnailSize: 750,

        async _fetchSpreadsheetData(id) {
            const [record] = await this._rpc({
                model: "spreadsheet.template",
                method: "search_read",
                fields: ["name", "data"],
                domain: [["id", "=", id]],
                limit: 1,
            });
            return record;
        },

        _updateData(record) {
            this._super(record);
            this.spreadsheetData = JSON.parse(atob(record.data));
        },

        /**
         * Create a copy of the given spreadsheet and display it
         */
        async _makeCopy({ data, thumbnail }) {
            return this._rpc({
                model: "spreadsheet.template",
                method: "copy",
                args: [
                    this.res_id,
                    {
                        data: btoa(data),
                        thumbnail,
                    },
                ],
            });
        },
        /**
         * Create a new sheet
         */
        _createNewSpreadsheet() {
            return this._rpc({
                model: "spreadsheet.template",
                method: "create",
                args: [
                    {
                        name: _t("Untitled spreadsheet template"),
                        data: btoa("{}"),
                    },
                ],
            });
        },
        /**
         * Saves the spreadsheet name change.
         *
         * @private
         * @param {OdooEvent} ev
         * @returns {Promise}
         */
        _saveName(name) {
            return this._rpc({
                model: "spreadsheet.template",
                method: "write",
                args: [
                    [this.res_id],
                    {
                        name,
                    },
                ],
            });
        },
        _saveSpreadsheet(data, thumbnail) {
            return this._rpc({
                model: "spreadsheet.template",
                method: "write",
                args: [[this.res_id], { data: btoa(data), thumbnail }],
            });
        },
    });

    core.action_registry.add("action_open_template", SpreadsheetAction);

    return SpreadsheetAction;
});
