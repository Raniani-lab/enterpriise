odoo.define("documents_spreadsheet.SpreadsheetSelectorDialog", function (require) {
    "use strict";

    const core = require("web.core");
    const Dialog = require("web.Dialog");
    const _t = core._t;

    const SpreadsheetSelectorDialog = Dialog.extend({
        template: "documents_spreadsheet.SpreadsheetSelectorDialog",
        /**
         * @constructor
         * @param {Widget} parent
         * @param {Object} params
         * @param {Object} params.spreadsheets
         * @param {string} params.type PIVOT or LIST or LINK
         * @param {string} params.title
         * @param {string} params.name Name of the list/pivot/link
         * @param {number|undefined} params.threshold
         * @param {number|undefined} params.maxThreshold
         */
        init: function (parent, params) {
            this.type = params.type;
            this.spreadsheets = params.spreadsheets;
            this.threshold = params.threshold;
            this.maxThreshold = params.maxThreshold;
            this.name = params.name;

            const options = {
                title: params.title,
                buttons: [
                    {
                        text: _t("Confirm"),
                        classes: "btn-primary",
                        click: this._onConfirm.bind(this),
                        close: true,
                    },
                    {
                        text: _t("Cancel"),
                        click: this._onCancel.bind(this),
                        close: true,
                    },
                ],
            };
            this._super(parent, options);
        },

        //--------------------------------------------------------------------------
        // Handlers
        //--------------------------------------------------------------------------

        /**
         * @private
         */
        _onConfirm: function () {
            const id = this.el.querySelector("select[name='spreadsheet']").value;
            let selectedSpreadsheet = false;
            if (id !== "") {
                selectedSpreadsheet = this.spreadsheets.find((s) => s.id === parseInt(id, 10));
            }
            const threshold = this.threshold
                ? Math.min(this.el.querySelector("input[id='threshold']").value, this.maxThreshold)
                : 0;
            const nameEl = this.el.querySelector("input[id='name']");
            const name = (nameEl && nameEl.value) || this.name;
            // TODO `selectedSpreadsheet` is not actually an id
            this.trigger("confirm", { id: selectedSpreadsheet, threshold, name });
        },
        /**
         * @private
         */
        _onCancel: function () {
            this.trigger("cancel");
        },
    });
    return SpreadsheetSelectorDialog;
});
