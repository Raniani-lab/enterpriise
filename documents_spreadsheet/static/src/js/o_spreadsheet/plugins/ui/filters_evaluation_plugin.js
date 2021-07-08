/** @odoo-module */
/* global moment */

import spreadsheet from "documents_spreadsheet.spreadsheet";
import Domain from "web.Domain";
import { constructDateDomain, constructDateRange, yearSelected } from "web.searchUtils";
import pyUtils from "web.py_utils";

const MONTHS = {
    january: { value: 0, granularity: "month" },
    february: { value: 1, granularity: "month" },
    march: { value: 2, granularity: "month" },
    april: { value: 3, granularity: "month" },
    may: { value: 4, granularity: "month" },
    june: { value: 5, granularity: "month" },
    july: { value: 6, granularity: "month" },
    august: { value: 7, granularity: "month" },
    september: { value: 8, granularity: "month" },
    october: { value: 9, granularity: "month" },
    november: { value: 10, granularity: "month" },
    december: { value: 11, granularity: "month" },
};
const THIS_YEAR = moment().year();
const YEARS = {
    this_year: { value: THIS_YEAR, granularity: "year" },
    last_year: { value: THIS_YEAR - 1, granularity: "year" },
    antepenultimate_year: { value: THIS_YEAR - 2, granularity: "year" },
};
const PERIOD_OPTIONS = Object.assign({}, MONTHS, YEARS);

export default class FiltersEvaluationPlugin extends spreadsheet.UIPlugin {
    /**
     * Handle a spreadsheet command
     *
     * @param {Object} cmd Command
     */
    handle(cmd) {
        switch (cmd.type) {
            case "START":
            case "ADD_PIVOT_FILTER":
            case "EDIT_PIVOT_FILTER":
            case "SET_PIVOT_FILTER_VALUE":
            case "REMOVE_PIVOT_FILTER":
                this._updatePivotsDomain();
                break;
        }
    }

    // -------------------------------------------------------------------------
    // Private
    // -------------------------------------------------------------------------

    /**
     * Update the domain of all the pivots by applying global filters to
     * the initial domain of the pivot.
     */
    _updatePivotsDomain() {
        for (const pivotId of this.getters.getPivotIds()) {
            let domain = "[]";
            for (let filter of this.getters.getGlobalFilters()) {
                if (!(pivotId in filter.fields)) {
                    continue;
                }
                if (filter.type === "date") {
                    const values = filter.value && Object.values(filter.value).filter(Boolean);
                    if (!values || values.length === 0) {
                        continue;
                    }
                    if (!yearSelected(values)) {
                        values.push("this_year");
                    }
                    const field = filter.fields[pivotId].field;
                    const type = filter.fields[pivotId].type;
                    const dateFilterRange =
                        filter.rangeType === "month"
                            ? constructDateRange({
                                  referenceMoment: moment(),
                                  fieldName: field,
                                  fieldType: type,
                                  granularity: "month",
                                  setParam: this._getSelectedOptions(values),
                              })
                            : constructDateDomain(moment(), field, type, values);
                    const dateDomain = Domain.prototype.arrayToString(
                        pyUtils.eval("domain", dateFilterRange.domain, {})
                    );
                    domain = pyUtils.assembleDomains([domain, dateDomain], "AND");
                }
                if (filter.type === "text") {
                    const value = filter.value;
                    if (!value) {
                        continue;
                    }
                    const field = filter.fields[pivotId].field;
                    const textDomain = Domain.prototype.arrayToString([[field, "ilike", value]]);
                    domain = pyUtils.assembleDomains([domain, textDomain], "AND");
                }
                if (filter.type === "relation") {
                    const values = filter.value;
                    if (!values || values.length === 0) {
                        continue;
                    }
                    const field = filter.fields[pivotId].field;
                    const textDomain = Domain.prototype.arrayToString([[field, "in", values]]);
                    domain = pyUtils.assembleDomains([domain, textDomain], "AND");
                }
            }
            this.dispatch("ADD_PIVOT_DOMAIN", { id: pivotId, domain, refresh: true });
        }
        this.dispatch("EVALUATE_CELLS", { sheetId: this.getters.getActiveSheetId() });
    }

    _getSelectedOptions(selectedOptionIds) {
        const selectedOptions = { year: [] };
        for (const optionId of selectedOptionIds) {
            const option = PERIOD_OPTIONS[optionId];
            const granularity = option.granularity;
            selectedOptions[granularity] = option.value;
        }
        return selectedOptions;
    }
}

FiltersEvaluationPlugin.modes = ["normal", "readonly"];
FiltersEvaluationPlugin.getters = [];
