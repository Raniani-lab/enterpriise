/** @odoo-module */

import { _t } from "web.core";
import spreadsheet from "@spreadsheet/o_spreadsheet/o_spreadsheet_extended";
import { LoadingDataError } from "@spreadsheet/o_spreadsheet/errors";

export default class PivotStructurePlugin extends spreadsheet.UIPlugin {
    constructor() {
        super(...arguments);
        /** @type {string} */
        this.selectedPivotId = undefined;
    }

    /**
     * Handle a spreadsheet command
     * @param {Object} cmd Command
     */
    handle(cmd) {
        switch (cmd.type) {
            case "REMOVE_PIVOT":
                this.dispatch("EVALUATE_CELLS", {
                    sheetId: this.getters.getActiveSheetId(),
                });
                break;
            case "SELECT_PIVOT":
                this.selectedPivotId = cmd.pivotId;
                break;
            case "ADD_PIVOT_DOMAIN":
                this._addDomain(cmd.id, cmd.domain);
                break;
            case "REFRESH_PIVOT":
                this._refreshOdooPivot(cmd.id);
                break;
            case "REFRESH_ALL_DATA_SOURCES":
                this._refreshOdooPivots();
                break;
        }
    }

    // ---------------------------------------------------------------------
    // Getters
    // ---------------------------------------------------------------------

    /**
     * Retrieve the pivotId of the current selected cell
     *
     * @returns {string}
     */
    getSelectedPivotId() {
        return this.selectedPivotId;
    }

    /**
     * Get the computed domain of a pivot
     *
     * @param {string} pivotId Id of the pivot
     * @returns {Array}
     */
    getPivotComputedDomain(pivotId) {
        return this.getters.getSpreadsheetPivotDataSource(pivotId).getComputedDomain();
    }

    /**
     * Return all possible values in the pivot for a given field.
     *
     * @param {string} pivotId Id of the pivot
     * @param {string} fieldName
     * @returns {Array<string>}
     */
    getPivotGroupByValues(pivotId, fieldName) {
        return this.getters
            .getSpreadsheetPivotModel(pivotId)
            .getPossibleValuesForGroupBy(fieldName);
    }

    /**
     * Get the value of a pivot header
     *
     * @param {string} pivotId Id of a pivot
     * @param {Array<string>} domain Domain
     */
    getPivotHeaderValue(pivotId, domain) {
        const model = this.getters.getSpreadsheetPivotModel(pivotId);
        if (!model) {
            throw new LoadingDataError();
        }
        model.markAsHeaderUsed(domain);
        const len = domain.length;
        if (len === 0) {
            return _t("Total");
        }
        return model.getPivotHeaderValue(domain);
    }

    /**
     * Get the value for a pivot cell
     *
     * @param {string} pivotId Id of a pivot
     * @param {string} measure Field name of the measures
     * @param {Array<string>} domain Domain
     *
     * @returns {string|number|undefined}
     */
    getPivotCellValue(pivotId, measure, domain) {
        const model = this.getters.getSpreadsheetPivotModel(pivotId);
        if (!model) {
            throw new LoadingDataError();
        }
        model.markAsValueUsed(domain, measure);
        return model.getPivotCellValue(measure, domain);
    }

    // ---------------------------------------------------------------------
    // Private
    // ---------------------------------------------------------------------

    /**
     * Refresh the cache of a pivot
     *
     * @param {string} pivotId Id of the pivot
     */
    _refreshOdooPivot(pivotId) {
        const model = this.getters.getSpreadsheetPivotModel(pivotId);
        if (model) {
            model.clearUsedValues();
        }
        this.getters.getSpreadsheetPivotDataSource(pivotId).load({ reload: true });
    }

    /**
     * Refresh the cache of all the lists
     */
    _refreshOdooPivots() {
        for (const pivotId of this.getters.getPivotIds()) {
            this._refreshOdooPivot(pivotId, false);
        }
    }

    /**
     * Add an additional domain to a pivot
     *
     * @private
     *
     * @param {string} pivotId pivot id
     * @param {Array<Array<any>>} domain
     */
    _addDomain(pivotId, domain) {
        this.getters.getSpreadsheetPivotDataSource(pivotId).addDomain(domain);
    }
}

PivotStructurePlugin.getters = [
    "getSelectedPivotId",
    "getPivotComputedDomain",
    "getPivotHeaderValue",
    "getPivotCellValue",
    "getPivotGroupByValues",
];
