odoo.define("documents_spreadsheet.PivotPlugin", function (require) {
    "use strict";

    /**
     * @typedef {Object} Pivot
     * @property {(PivotCache|{})} cache
     * @property {Array<string>} colGroupBys
     * @property {Object} context
     * @property {Array} domain
     * @property {Array} computeDomain
     * @property {Array<string>} measures
     * @property {string} model
     * @property {Array<string>} rowGroupBys
     */

    const spreadsheet = require("documents_spreadsheet.spreadsheet");
    const { getFormulaNameAndArgs } = require("documents_spreadsheet/static/src/js/o-spreadsheet/plugins/helpers.js");

    class PivotPlugin extends spreadsheet.CorePlugin {
        constructor(getters, history, dispatch, config) {
            super(getters, history, dispatch, config);
            this.pivots = {};
            this.rpc = config.evalContext.env ? config.evalContext.env.services.rpc : undefined;
        }

        /**
         * Handle a spreadsheet command
         * @param {Object} cmd Command
         */
        handle(cmd) {
            switch (cmd.type) {
                case "ADD_PIVOT":
                    this.pivots[cmd.pivot.id] = cmd.pivot;
                    break;
            }
        }

        // ---------------------------------------------------------------------
        // Getters
        // ---------------------------------------------------------------------

        /**
         * Retrieve the pivot associated to the given Id
         *
         * @param {string} pivotId Id of the pivot
         *
         * @returns {Pivot} Pivot
         */
        getPivot(pivotId) {
            return this.pivots[pivotId];
        }
        /**
         * Retrieve all the pivots
         *
         * @returns {Array<Pivot>} Pivots
         */
        getPivots() {
            return Object.values(this.pivots);
        }
        /**
         *
         * @param {number} col Index of the col
         * @param {number} row Index of the row
         */
        getPivotFromPosition(col, row) {
            const sheetId = this.getters.getActiveSheetId();
            const cell = this.getters.getCell(sheetId, col, row);
            if (cell && cell.type === "formula" && cell.formula.text.startsWith("=PIVOT")) {
                const { args } = getFormulaNameAndArgs(cell.formula.text);
                const id = args[0];
                return id;
            } else {
                return undefined;
            }
        }
        // ---------------------------------------------------------------------
        // Import/Export
        // ---------------------------------------------------------------------

        /**
         * Import the pivots
         *
         * @param {Object} data
         */
        import(data) {
            if (data.pivots) {
                this.pivots = data.pivots;
            }
        }
        /**
         * Export the pivots
         *
         * @param {Object} data
         */
        export(data) {
            data.pivots = JSON.parse(JSON.stringify(this.pivots));
            for (const id in data.pivots) {
                data.pivots[id].computedDomain = undefined;
                data.pivots[id].cache = undefined;
                data.pivots[id].lastUpdate = undefined;
                data.pivots[id].isLoaded = false;
            }
        }
    }

    PivotPlugin.modes = ["normal", "headless", "readonly"];
    PivotPlugin.getters = [
        "getPivot",
        "getPivots",
        "getPivotFromPosition"
    ];

    return PivotPlugin;
});
