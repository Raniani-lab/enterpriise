/** @odoo-module alias=documents_spreadsheet.PivotAutofillPlugin */

import core from "web.core";
import pivotUtils from "documents_spreadsheet.pivot_utils";
import spreadsheet from "documents_spreadsheet.spreadsheet";
import {
    getNumberOfPivotFormulas,
    getFormulaNameAndArgs,
} from "documents_spreadsheet/static/src/js/o_spreadsheet/plugins/helpers.js";

const _t = core._t;

export default class PivotAutofillPlugin extends spreadsheet.UIPlugin {
    // ---------------------------------------------------------------------
    // Getters
    // ---------------------------------------------------------------------

    /**
     * Get the next value to autofill of a pivot function
     *
     * @param {string} formula Pivot formula
     * @param {boolean} isColumn True if autofill is LEFT/RIGHT, false otherwise
     * @param {number} increment number of steps
     *
     * @returns Autofilled value
     */
    getNextValue(formula, isColumn, increment) {
        if (getNumberOfPivotFormulas(formula) !== 1) {
            return formula;
        }
        const { functionName, args } = getFormulaNameAndArgs(formula);
        const pivot = this.getters.getPivot(args[0]);
        if (!pivot || !this.getters.isCacheLoaded(pivot.id)) {
            return formula;
        }
        let builder;
        if (functionName === "PIVOT") {
            builder = this._autofillPivotValue.bind(this);
        } else if (functionName === "PIVOT.HEADER") {
            if (pivot.rowGroupBys.includes(args[1])) {
                builder = this._autofillPivotRowHeader.bind(this);
            } else {
                builder = this._autofillPivotColHeader.bind(this);
            }
        }
        if (builder) {
            return builder(pivot, args, isColumn, increment);
        }
        return formula;
    }

    /**
     * Compute the tooltip to display from a Pivot formula
     *
     * @param {string} formula Pivot formula
     * @param {boolean} isColumn True if the direction is left/right, false
     *                           otherwise
     */
    getTooltipFormula(formula, isColumn) {
        if (!formula) {
            return [];
        }
        const { functionName, args } = getFormulaNameAndArgs(formula);
        const pivot = this.getters.getPivot(args[0]);
        if (!pivot) {
            return [];
        }
        if (functionName === "PIVOT") {
            return this._tooltipFormatPivot(pivot, args, isColumn);
        } else if (functionName === "PIVOT.HEADER") {
            return this._tooltipFormatPivotHeader(pivot, args);
        }
        return [];
    }

    // ---------------------------------------------------------------------
    // Autofill
    // ---------------------------------------------------------------------

    /**
     * Get the next value to autofill from a pivot value ("=PIVOT()")
     *
     * Here are the possibilities:
     * 1) LEFT-RIGHT
     *  - Working on a date value, with one level of group by in the header
     *      => Autofill the date, without taking care of headers
     *  - Targeting a row-header
     *      => Creation of a PIVOT.HEADER with the value of the current rows
     *  - Targeting outside the pivot (before the row header and after the
     *    last col)
     *      => Return empty string
     *  - Targeting a value cell
     *      => Autofill by changing the cols
     * 2) UP-DOWN
     *  - Working on a date value, with one level of group by in the header
     *      => Autofill the date, without taking care of headers
     *  - Targeting a col-header
     *      => Creation of a PIVOT.HEADER with the value of the current cols,
     *         with the given increment
     *  - Targeting outside the pivot (after the last row)
     *      => Return empty string
     *  - Targeting a value cell
     *      => Autofill by changing the rows
     *
     * @param {Pivot} pivot
     * @param {Array<string>} args args of the pivot formula
     * @param {boolean} isColumn True if the direction is left/right, false
     *                           otherwise
     * @param {number} increment Increment of the autofill
     *
     * @private
     */
    _autofillPivotValue(pivot, args, isColumn, increment) {
        const currentElement = this._getCurrentValueElement(pivot, args);
        const cache = this.getters.getCache(pivot.id);
        const date = cache.isGroupedByDate(isColumn ? pivot.colGroupBys : pivot.rowGroupBys);
        let cols = [];
        let rows = [];
        let measure;
        if (isColumn) {
            // LEFT-RIGHT
            rows = currentElement.rows;
            if (date.isDate) {
                // Date
                cols = currentElement.cols;
                cols[0] = this._incrementDate(cols[0], date.group, increment);
                measure = cols.pop();
            } else {
                const currentColIndex = cache.getTopGroupIndex(currentElement.cols);
                if (currentColIndex === -1) {
                    return "";
                }
                const nextColIndex = currentColIndex + increment;
                if (nextColIndex === -1) {
                    // Targeting row-header
                    return this._autofillRowFromValue(pivot, currentElement);
                }
                if (nextColIndex < -1 || nextColIndex >= cache.getTopHeaderCount()) {
                    // Outside the pivot
                    return "";
                }
                // Targeting value
                cols = cache.getColumnValues(nextColIndex);
                measure = cache.getMeasureName(nextColIndex);
            }
        } else {
            // UP-DOWN
            cols = currentElement.cols;
            if (date.isDate) {
                // Date
                rows = currentElement.rows;
                rows[0] = this._incrementDate(rows[0], date.group, increment);
            } else {
                const currentRowIndex = cache.getRowIndex(currentElement.rows);
                if (currentRowIndex === -1) {
                    return "";
                }
                const nextRowIndex = currentRowIndex + increment;
                if (nextRowIndex < 0) {
                    // Targeting col-header
                    return this._autofillColFromValue(pivot, nextRowIndex, currentElement);
                }
                if (nextRowIndex >= cache.getRowCount()) {
                    // Outside the pivot
                    return "";
                }
                // Targeting value
                rows = cache.getRowValues(nextRowIndex);
            }
            measure = cols.pop();
        }
        return this._buildValueFormula(this._buildArgs(pivot, measure, rows, cols));
    }
    /**
     * Get the next value to autofill from a pivot header ("=PIVOT.HEADER()")
     * which is a col.
     *
     * Here are the possibilities:
     * 1) LEFT-RIGHT
     *  - Working on a date value, with one level of group by in the header
     *      => Autofill the date, without taking care of headers
     *  - Targeting outside (before the first col after the last col)
     *      => Return empty string
     *  - Targeting a col-header
     *      => Creation of a PIVOT.HEADER with the value of the new cols
     * 2) UP-DOWN
     *  - Working on a date value, with one level of group by in the header
     *      => Replace the date in the headers and autocomplete as usual
     *  - Targeting a cell (after the last col and before the last row)
     *      => Autofill by adding the corresponding rows
     *  - Targeting a col-header (after the first col and before the last
     *    col)
     *      => Creation of a PIVOT.HEADER with the value of the new cols
     *  - Targeting outside the pivot (before the first col of after the
     *    last row)
     *      => Return empty string
     *
     * @param {Pivot} pivot
     * @param {Array<string>} args args of the pivot.header formula
     * @param {boolean} isColumn True if the direction is left/right, false
     *                           otherwise
     * @param {number} increment Increment of the autofill
     *
     * @private
     */
    _autofillPivotColHeader(pivot, args, isColumn, increment) {
        const currentElement = this._getCurrentHeaderElement(pivot, args);
        const cache = this.getters.getCache(pivot.id);
        const currentIndex = cache.getTopGroupIndex(currentElement.cols);
        const date = cache.isGroupedByDate(pivot.colGroupBys);
        if (isColumn) {
            // LEFT-RIGHT
            let groupValues;
            if (date.isDate) {
                // Date
                groupValues = currentElement.cols;
                groupValues[0] = this._incrementDate(groupValues[0], date.group, increment);
            } else {
                const colIndex = cache.getSubgroupLevel(currentElement.cols);
                const nextIndex = currentIndex + increment;
                if (
                    currentIndex === -1 ||
                    nextIndex < 0 ||
                    nextIndex >= cache.getTopHeaderCount()
                ) {
                    // Outside the pivot
                    return "";
                }
                // Targeting a col.header
                groupValues = cache.getColGroupHierarchy(nextIndex, colIndex);
            }
            return this._buildHeaderFormula(this._buildArgs(pivot, undefined, [], groupValues));
        } else {
            // UP-DOWN
            const colIndex = cache.getSubgroupLevel(currentElement.cols);
            const nextIndex = colIndex + increment;
            const groupLevels = cache.getColGroupByLevels();
            if (nextIndex < 0 || nextIndex >= groupLevels + 1 + cache.getRowCount()) {
                // Outside the pivot
                return "";
            }
            if (nextIndex >= groupLevels + 1) {
                // Targeting a value
                const rowIndex = nextIndex - groupLevels - 1;
                const measure = cache.getMeasureName(currentIndex);
                const cols = cache.getColumnValues(currentIndex);
                const rows = cache.getRowValues(rowIndex);
                return this._buildValueFormula(this._buildArgs(pivot, measure, rows, cols));
            } else {
                // Targeting a col.header
                const cols = cache.getColGroupHierarchy(currentIndex, nextIndex);
                return this._buildHeaderFormula(this._buildArgs(pivot, undefined, [], cols));
            }
        }
    }
    /**
     * Get the next value to autofill from a pivot header ("=PIVOT.HEADER()")
     * which is a row.
     *
     * Here are the possibilities:
     * 1) LEFT-RIGHT
     *  - Targeting outside (LEFT or after the last col)
     *      => Return empty string
     *  - Targeting a cell
     *      => Autofill by adding the corresponding cols
     * 2) UP-DOWN
     *  - Working on a date value, with one level of group by in the header
     *      => Autofill the date, without taking care of headers
     *  - Targeting a row-header
     *      => Creation of a PIVOT.HEADER with the value of the new rows
     *  - Targeting outside the pivot (before the first row of after the
     *    last row)
     *      => Return empty string
     *
     * @param {Pivot} pivot
     * @param {Array<string>} args args of the pivot.header formula
     * @param {boolean} isColumn True if the direction is left/right, false
     *                           otherwise
     * @param {number} increment Increment of the autofill
     *
     * @private
     */
    _autofillPivotRowHeader(pivot, args, isColumn, increment) {
        const currentElement = this._getCurrentHeaderElement(pivot, args);
        const cache = this.getters.getCache(pivot.id);
        const currentIndex = cache.getRowIndex(currentElement.rows);
        const date = cache.isGroupedByDate(pivot.rowGroupBys);
        if (isColumn) {
            // LEFT-RIGHT
            if (increment < 0 || increment > cache.getTopHeaderCount()) {
                // Outside the pivot
                return "";
            }
            const values = cache.getColumnValues(increment - 1);
            const measure = cache.getMeasureName(increment - 1);
            return this._buildValueFormula(
                this._buildArgs(pivot, measure, currentElement.rows, values)
            );
        } else {
            // UP-DOWN
            let rows;
            if (date.isDate) {
                // Date
                rows = currentElement.rows;
                rows[0] = this._incrementDate(rows[0], date.group, increment);
            } else {
                const nextIndex = currentIndex + increment;
                if (currentIndex === -1 || nextIndex < 0 || nextIndex >= cache.getRowCount()) {
                    return "";
                }
                rows = cache.getRowValues(nextIndex);
            }
            return this._buildHeaderFormula(this._buildArgs(pivot, undefined, rows, []));
        }
    }
    /**
     * Create a col header from a value
     *
     * @param {Pivot} pivot
     * @param {number} nextIndex Index of the target column
     * @param {Object} currentElement Current element (rows and cols)
     *
     * @private
     */
    _autofillColFromValue(pivot, nextIndex, currentElement) {
        const cache = this.getters.getCache(pivot.id);
        const groupIndex = cache.getTopGroupIndex(currentElement.cols);
        if (groupIndex < 0) {
            return "";
        }
        const levels = cache.getColGroupByLevels();
        const index = levels + 1 + nextIndex;
        if (index < 0 || index >= levels + 1) {
            return "";
        }
        const cols = cache.getColGroupHierarchy(groupIndex, index);
        return this._buildHeaderFormula(this._buildArgs(pivot, undefined, [], cols));
    }
    /**
     * Create a row header from a value
     *
     * @param {Pivot} pivot
     * @param {Object} currentElement Current element (rows and cols)
     *
     * @private
     */
    _autofillRowFromValue(pivot, currentElement) {
        const rows = currentElement.rows;
        if (!rows) {
            return "";
        }
        return this._buildHeaderFormula(this._buildArgs(pivot, undefined, rows, []));
    }
    /**
     * Parse the arguments of a pivot function to find the col values and
     * the row values of a PIVOT.HEADER function
     *
     * @param {Pivot} pivot
     * @param {Array<string>} args Args of the pivot.header formula
     *
     * @private
     */
    _getCurrentHeaderElement(pivot, args) {
        const values = this._parseArgs(args.slice(1));
        const cols = this._getFieldValues([...pivot.colGroupBys, "measure"], values);
        const rows = this._getFieldValues(pivot.rowGroupBys, values);
        return { cols, rows };
    }
    /**
     * Parse the arguments of a pivot function to find the col values and
     * the row values of a PIVOT function
     *
     * @param {Pivot} pivot
     * @param {Array<string>} args Args of the pivot formula
     *
     * @private
     */
    _getCurrentValueElement(pivot, args) {
        const values = this._parseArgs(args.slice(2));
        const cols = this._getFieldValues(pivot.colGroupBys, values);
        cols.push(args[1]); // measure
        const rows = this._getFieldValues(pivot.rowGroupBys, values);
        return { cols, rows };
    }
    /**
     * Return the values for the fields which are present in the list of
     * fields
     *
     * ex: groupBys: ["create_date"]
     *     items: { create_date: "01/01", stage_id: 1 }
     *      => ["01/01"]
     *
     * @param {Array<string>} fields List of fields
     * @param {Object} values Association field-values
     *
     * @private
     * @returns {string}
     */
    _getFieldValues(fields, values) {
        return fields.filter((field) => field in values).map((field) => values[field]);
    }
    /**
     * Increment a date with a given increment and interval (group)
     *
     * @param {string} date
     * @param {string} group (day, week, month, ...)
     * @param {number} increment
     *
     * @private
     * @returns {string}
     */
    _incrementDate(date, group, increment) {
        const format = pivotUtils.formats[group].out;
        const interval = pivotUtils.formats[group].interval;
        const dateMoment = moment(date, format);
        return dateMoment.isValid() ? dateMoment.add(increment, interval).format(format) : date;
    }
    /**
     * Create a structure { field: value } from the arguments of a pivot
     * function
     *
     * @param {Array<string>} args
     *
     * @private
     * @returns {Object}
     */
    _parseArgs(args) {
        const values = {};
        for (let i = 0; i < args.length; i += 2) {
            values[args[i]] = args[i + 1];
        }
        return values;
    }

    // ---------------------------------------------------------------------
    // Tooltips
    // ---------------------------------------------------------------------

    /**
     * Get the tooltip for a pivot formula
     *
     * @param {Pivot} pivot
     * @param {Array<string>} args
     * @param {boolean} isColumn True if the direction is left/right, false
     *                           otherwise
     * @private
     */
    _tooltipFormatPivot(pivot, args, isColumn) {
        const tooltips = [];
        const values = this._parseArgs(args.slice(2));
        const cache = this.getters.getCache(pivot.id);
        for (let [field, value] of Object.entries(values)) {
            if (
                (pivot.colGroupBys.includes(field) && isColumn) ||
                (pivot.rowGroupBys.includes(field) && !isColumn)
            ) {
                tooltips.push({
                    title: pivotUtils.formatGroupBy(cache, field),
                    value: pivotUtils.formatHeader(cache, field, value) || _t("Undefined"),
                });
            }
        }
        if (pivot.measures.length !== 1 && isColumn) {
            const measure = args[1];
            tooltips.push({
                title: _t("Measure"),
                value: pivotUtils.formatHeader(cache, "measure", measure),
            });
        }
        return tooltips;
    }
    /**
     * Get the tooltip for a pivot header formula
     *
     * @param {Pivot} pivot
     * @param {Array<string>} args
     * @private
     */
    _tooltipFormatPivotHeader(pivot, args) {
        const tooltips = [];
        const values = this._parseArgs(args.slice(1));
        const cache = this.getters.getCache(pivot.id);
        for (let [field, value] of Object.entries(values)) {
            tooltips.push({
                title: field === "measure" ? _t("Measure") : pivotUtils.formatGroupBy(cache, field),
                value: pivotUtils.formatHeader(cache, field, value) || _t("Undefined"),
            });
        }
        return tooltips;
    }

    // ---------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------

    /**
     * Create the args from pivot, measure, rows and cols
     * if measure is undefined, it's not added
     *
     * @param {Pivot} pivot
     * @param {string} measure
     * @param {Object} rows
     * @param {Object} cols
     *
     * @private
     * @returns {Array<string>}
     */
    _buildArgs(pivot, measure, rows, cols) {
        const args = [pivot.id];
        if (measure) {
            args.push(measure);
        }
        for (let index in rows) {
            args.push(pivot.rowGroupBys[index]);
            args.push(rows[index]);
        }
        if (cols.length === 1 && pivot.measures.map((x) => x.field).includes(cols[0])) {
            args.push("measure");
            args.push(cols[0]);
        } else {
            const cache = this.getters.getCache(pivot.id);
            for (let index in cols) {
                args.push(cache.getColLevelIdentifier(index));
                args.push(cols[index]);
            }
        }
        return args;
    }
    /**
     * Create a pivot header formula at col/row
     *
     * @param {Array<string>} args
     *
     * @private
     * @returns {string}
     */
    _buildHeaderFormula(args) {
        return `=PIVOT.HEADER("${args
            .map((arg) => arg.toString().replace(/"/g, '\\"'))
            .join('","')}")`;
    }
    /**
     * Create a pivot formula at col/row
     *
     * @param {Array<string>} args
     *
     * @private
     * @returns {string}
     */
    _buildValueFormula(args) {
        return `=PIVOT("${args.map((arg) => arg.toString().replace(/"/g, '\\"')).join('","')}")`;
    }
}

PivotAutofillPlugin.modes = ["normal", "headless", "readonly"];
PivotAutofillPlugin.getters = ["getNextValue", "getTooltipFormula"];
