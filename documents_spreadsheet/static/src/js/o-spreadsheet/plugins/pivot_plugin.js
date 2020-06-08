odoo.define("documents_spreadsheet.PivotPlugin", function (require) {
    "use strict";

    /**
     * @typedef {Object} Pivot
     * @property {(PivotCache|{})} cache
     * @property {Array<string>} colGroupBys
     * @property {Object} context
     * @property {Array} domain
     * @property {Array<string>} measures
     * @property {string} model
     * @property {Array<string>} rowGroupBys
     */

     /**
      * @typedef {Object} PivotCache
      * @property {Array<number>} cacheKeys
      * @property {Array<Array<Array<string>>>} cols
      * @property {Array<string>} colStructure
      * @property {Object} fields
      * @property {Object} groupBys
      * @property {Object} labels
      * @property {string} modelName
      * @property {Array<Array<string>>} rows
      * @property {Array<Array<number>>} values
      */

    const core = require("web.core");
    const pivotUtils = require("documents_spreadsheet.pivot_utils");
    const spreadsheet = require("documents_spreadsheet.spreadsheet");

    const _t = core._t;
    const parse = spreadsheet.parse;

    const HEADER_STYLE = { fillColor: "#f2f2f2" };
    const TOP_LEVEL_STYLE = { bold: true, fillColor: "#f2f2f2" };
    const MEASURE_STYLE = { fillColor: "#f2f2f2", textColor: "#756f6f" };

    class PivotPlugin extends spreadsheet.BasePlugin {
        constructor(workbook, getters, history, dispatch, config) {
            super(workbook, getters, history, dispatch, config);
            this.pivots = {};
            this.rpc = config.evalContext.env.services.rpc;
            this.selectedPivot = undefined;
        }

        /**
         * Handle a spreadsheet command
         * @param {Object} cmd Command
         */
        handle(cmd) {
            switch (cmd.type) {
                case "ADD_PIVOT":
                    this._addPivot(cmd.pivot, cmd.anchor);
                    break;
                case "REBUILD_PIVOT":
                    this._rebuildPivot(cmd.id, cmd.anchor);
                    break;
                case "SELECT_PIVOT":
                    this._selectPivot(cmd.cell);
                    break;
            }
        }

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
            const { functionName, args } = this._parseFormula(formula);
            const pivot = this.getPivot(args[0]);
            if (!pivot) {
                return "";
            }
            let builder;
            if (functionName === "PIVOT") {
                builder = this._autofillPivotValue.bind(this);
            } else if (functionName === "PIVOT.HEADER") {
                if (pivot.rowGroupBys.includes(args[1])) {
                    builder = this._autofillPivotRowHeader.bind(this);
                } else {
                    builder = this._autofillPivotColHeader.bind(this)
                }
            }
            if (builder) {
                return builder(pivot, args, isColumn, increment);
            }
            return formula;
        }
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
         * Retrieve the pivot of the current selected cell
         *
         * @returns {Pivot}
         */
        getSelectedPivot() {
            return this.selectedPivot;
        }

        // ---------------------------------------------------------------------
        // Handlers
        // ---------------------------------------------------------------------

        /**
         * Add a pivot to the local state and build it at the given anchor
         *
         * @param {Pivot} pivot
         * @param {Array<number>} anchor
         *
         * @private
         */
        _addPivot(pivot, anchor) {
            const pivots = this.getPivots()
            const id = pivots.length ? Math.max(...pivots.map((p) => p.id)) + 1 : 1;
            this.pivots[id] = Object.assign(pivot, { id });
            this._buildPivot(pivot, anchor);
            this._autoresize(pivot, anchor);
        }
        /**
         * Rebuild a specific pivot and build it at the given anchor
         *
         * @param {number} id Id of the pivot to rebuild
         * @param {Array<number>} anchor
         *
         * @private
         */
        _rebuildPivot(id, anchor) {
            const pivot = this.pivots[id];
            this._resizeSheet(pivot, anchor);
            this._buildPivot(pivot, anchor);
        }
        /**
         * Select the pivot that is used in the given cell
         *
         * @param {Object} cell
         *
         * @private
         */
        _selectPivot(cell) {
            if (cell && cell.type === "formula" && cell.content.startsWith("=PIVOT")) {
                const { args } = this._parseFormula(cell.content);
                const id = args[0];
                this.selectedPivot = this.pivots[id];
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
                for (let pivot of Object.values(this.pivots)) {
                    pivot.isLoaded = false;
                    pivotUtils.fetchCache(pivot, this.rpc).then(() => pivot.isLoaded = true);
                }
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
                data.pivots[id].cache = {};
                data.pivots[id].lastUpdate = undefined;
                data.pivots[id].isLoaded = false;
            }
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
         *  - Targetting a row-header
         *      => Creation of a PIVOT.HEADER with the value of the current rows
         *  - Targetting outside the pivot (before the row header and after the
         *    last col)
         *      => Return empty string
         *  - Targetting a value cell
         *      => Autofill by changing the cols
         * 2) UP-DOWN
         *  - Working on a date value, with one level of group by in the header
         *      => Autofill the date, without taking care of headers
         *  - Targetting a col-header
         *      => Creation of a PIVOT.HEADER with the value of the current cols,
         *         with the given increment
         *  - Targetting outside the pivot (after the last row)
         *      => Return empty string
         *  - Targetting a value cell
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
            const date = this._isDateHeader(isColumn ? pivot.colGroupBys : pivot.rowGroupBys, pivot.cache.fields);
            let cols = [];
            let rows = [];
            if (isColumn) {
                // LEFT-RIGHT
                rows = currentElement.rows;
                if (date.isDate) {
                    // Date
                    cols = currentElement.cols;
                    cols[0] = this._incrementDate(cols[0], date.group, increment);
                } else {
                    const currentColIndex = pivot.cache.cols.findIndex(
                        (elt) =>
                            JSON.stringify(elt[elt.length - 1]) === JSON.stringify(currentElement.cols)
                            );
                    if (currentColIndex === -1) {
                        return "";
                    }
                    const nextColIndex = currentColIndex + increment;
                    if (nextColIndex === -1) {
                        // Targeting row-header
                        return this._autofillRowFromValue(pivot, currentElement);
                    }
                    if (nextColIndex < -1 || nextColIndex >= pivot.cache.cols.length) {
                        // Outside the pivot
                        return "";
                    }
                    // Targeting value
                    const columns = pivot.cache.cols[nextColIndex];
                    cols = columns[columns.length - 1].slice();
                }
            } else {
                // UP-DOWN
                cols = currentElement.cols;
                if (date.isDate) {
                    // Date
                    rows = currentElement.rows;
                    rows[0] = this._incrementDate(rows[0], date.group, increment);
                } else {
                    const currentRowIndex = this._findIndex(pivot.cache.rows, currentElement.rows);
                    if (currentRowIndex === -1) {
                        return "";
                    }
                    const nextRowIndex = currentRowIndex + increment;
                    if (nextRowIndex < 0) {
                        // Targeting col-header
                        return this._autofillColFromValue(pivot, nextRowIndex, currentElement);
                    }
                    if (nextRowIndex >= pivot.cache.rows.length) {
                        // Outside the pivot
                        return "";
                    }
                    // Targeting value
                    rows = pivot.cache.rows[nextRowIndex];
                }
            }
            const measure = cols.pop();
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
         *  - Targetting outside (before the first col after the last col)
         *      => Return empty string
         *  - Targetting a col-header
         *      => Creation of a PIVOT.HEADER with the value of the new cols
         * 2) UP-DOWN
         *  - Working on a date value, with one level of group by in the header
         *      => Replace the date in the headers and autocomplete as usual
         *  - Targetting a cell (after the last col and before the last row)
         *      => Aufotill by adding the corresponding rows
         *  - Targetting a col-header (after the first col and before the last
         *    col)
         *      => Creation of a PIVOT.HEADER with the value of the new cols
         *  - Targetting outside the pivot (before the first col of after the
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
            const currentIndex = pivot.cache.cols.findIndex((elt) => {
                const index = elt.findIndex((e) => JSON.stringify(e) === JSON.stringify(currentElement.cols));
                return index !== -1;
            });
            const date = this._isDateHeader(pivot.colGroupBys, pivot.cache.fields);
            if (isColumn) {
                // LEFT-RIGHT
                let cols;
                if (date.isDate) {
                    // Date
                    cols = currentElement.cols;
                    cols[0] = this._incrementDate(cols[0], date.group, increment);
                } else {
                    const currentCols = pivot.cache.cols[currentIndex];
                    const colIndex = this._findIndex(currentCols, currentElement.cols);
                    const nextIndex = currentIndex + increment;
                    if (currentIndex === -1 || nextIndex < 0 || nextIndex >= pivot.cache.cols.length) {
                        // Outside the pivot
                        return "";
                    }
                    // Targetting a col.header
                    cols = pivot.cache.cols[nextIndex][colIndex];
                }
                return this._buildHeaderFormula(this._buildArgs(pivot, undefined, [], cols));
            } else {
                // UP-DOWN
                let currentCols;
                if (date.isDate) {
                    // Date => Simply replace a date with the current date
                    currentCols = pivot.cache.cols[0].slice();
                    currentCols.map((col) => {
                        const currentCol = col.slice();
                        currentCol[0] = currentElement.cols[0]
                        return currentCol;
                    });
                } else {
                    currentCols = pivot.cache.cols[currentIndex];
                }
                const colIndex = this._findIndex(currentCols, currentElement.cols);
                const nextIndex = colIndex + increment;
                if (nextIndex < 0 || nextIndex >= currentCols.length + pivot.cache.rows.length) {
                    // Outside the pivot
                    return "";
                }
                if (nextIndex >= currentCols.length) {
                    // Targetting a value
                    const rowIndex = nextIndex - currentCols.length;
                    const cols = currentCols[currentCols.length - 1].slice();
                    const measure = cols.pop();
                    const rows = pivot.cache.rows[rowIndex];
                    return this._buildValueFormula(this._buildArgs(pivot, measure, rows, cols));
                } else {
                    // Targetting a col.header
                    const cols = currentCols[nextIndex];
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
         *  - Targetting outside (LEFT or after the last col)
         *      => Return empty string
         *  - Targetting a cell
         *      => Aufotill by adding the corresponding cols
         * 2) UP-DOWN
         *  - Working on a date value, with one level of group by in the header
         *      => Autofill the date, without taking care of headers
         *  - Targetting a row-header
         *      => Creation of a PIVOT.HEADER with the value of the new rows
         *  - Targetting outside the pivot (before the first row of after the
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
            const currentIndex = this._findIndex(pivot.cache.rows, currentElement.rows);
            const date = this._isDateHeader(pivot.rowGroupBys, pivot.cache.fields);
            if (isColumn) {
                // LEFT-RIGHT
                if (increment < 0 || increment > pivot.cache.cols.length) {
                    // Outside the pivot
                    return "";
                }
                // Targetting value
                const columns = pivot.cache.cols[increment - 1];
                const cols = columns[columns.length - 1].slice();
                const measure = cols.pop();
                return this._buildValueFormula(this._buildArgs(pivot, measure, currentElement.rows, cols));
            } else {
                // UP-DOWN
                let rows;
                if (date.isDate) {
                    // Date
                    rows = currentElement.rows;
                    rows[0] = this._incrementDate(rows[0], date.group, increment);
                } else {
                    const nextIndex = currentIndex + increment;
                    if (currentIndex === -1 || nextIndex < 0 || nextIndex >= pivot.cache.rows.length) {
                        return "";
                    }
                    rows = pivot.cache.rows[nextIndex];
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
            const columns = pivot.cache.cols.find(
                (elt) =>
                    JSON.stringify(elt[elt.length - 1]) === JSON.stringify(currentElement.cols)
            );
            if (!columns) {
                return "";
            }
            const index = columns.length + nextIndex;
            if (index < 0 || index >= columns.length) {
                return "";
            }
            const cols = columns[index];
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
            const cols = this._getFieldValues(pivot.cache.colStructure, values);
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
         * Find the index of item in the target
         *
         * @param {Array<any>} target
         * @param {any} item Item to find
         *
         * @private
         * @returns {number}
         */
        _findIndex(target, item) {
            const stringifiedItem = JSON.stringify(item);
            return target.findIndex((x) => JSON.stringify(x) === stringifiedItem);
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
         * Check if the headers are only a level and represent a date
         *
         * @param {Array<string>} headers
         * @param {Object} fields
         *
         * @private
         * @returns {Object} isDate: boolean and group: string
         */
        _isDateHeader(headers, fields) {
            if (headers.length !== 1) {
                return false;
            }
            const [ fieldName, group ] = headers[0].split(":");
            const field = fields[fieldName];
            return {
                isDate: ["date", "datetime"].includes(field.type),
                group,
            }
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
            for (let i = 0; i < args.length; i+=2) {
                values[args[i]] = args[i + 1];
            }
            return values;
        }

        // ---------------------------------------------------------------------
        // Build Pivot
        // ---------------------------------------------------------------------

        /**
         * Autoresize the pivot, by computing the sizes of headers
         *
         * @param {Pivot} pivot
         * @param {Array<number>} anchor
         *
         * @private
         */
        _autoresize(pivot, anchor) {
            const end = anchor[0] + pivot.cache.cols.length;
            for (let col = anchor[0]; col <= end; col++) {
                const cells = this.getters.getColCells(col);
                const sizes = cells.map((cell) => this.getters.getTextWidth(this._getHeaderText(cell) + 6)); // 6: padding
                const size = Math.max(96, ...sizes); //96: default header width
                const cols = [col];
                if (size !== 0) {
                    this.dispatch("RESIZE_COLUMNS", { cols, size });
                }
            }
        }
        /**
         * Build a pivot at the given anchor
         *
         * @param {Pivot} pivot
         * @param {Array<number>} anchor
         *
         * @private
         */
        _buildPivot(pivot, anchor) {
            this._buildColHeaders(pivot, anchor);
            this._buildRowHeaders(pivot, anchor);
            this._buildValues(pivot, anchor);
        }
        /**
         * Build the headers of the columns
         *  1) Merge the top-left cell
         *  2) Create the column headers
         *  3) Create the total measures
         *  4) Merge the consecutives titles
         *  5) Apply the style of titles
         *  6) Apply the style of headers
         *
         * @param {Pivot} pivot
         * @param {Array<number>} anchor
         *
         * @private
         */
        _buildColHeaders(pivot, anchor) {
            const [colAnchor, rowAnchor] = anchor;
            const bold = [];

            // 1) Top Left merge
            this._merge({
                top: rowAnchor,
                bottom: rowAnchor + Object.keys(pivot.cache.cols[0]).length - 1,
                left: colAnchor,
                right: colAnchor,
            });

            // 2) Create the column headers
            let col = colAnchor + 1;

            // Do not take the last measures into account here
            let length = pivot.cache.cols.length - pivot.measures.length;
            if (length === 0) {
                length = pivot.cache.cols.length;
            }

            for (let i = 0; i < length; i++) {
                let row = rowAnchor;
                const colItems = pivot.cache.cols[i];
                for (let item of colItems) {
                    const args = [pivot.id];
                    for (let index in item) {
                        args.push(pivot.cache.colStructure[index]);
                        args.push(item[index]);
                    }
                    this._applyFormula(col, row, args, true);
                    if (item.length <= 1) {
                        bold.push({ top: row, bottom: row, left: col, right: col });
                    }
                    row++;
                }
                col++;
            }

            // 3) Create the total for measures
            let row = rowAnchor + pivot.cache.colStructure.length - 2;
            for (let i = length; i < pivot.cache.cols.length; i++) {
                const args = [pivot.id];
                this._applyFormula(col, row, args, true);
                bold.push({ top: row, bottom: row, left: col, right: col });
                args.push("measure");
                args.push(pivot.cache.cols[i][1][0]);
                this._applyFormula(col, row + 1, args, true);
                col++;
            }

            // 4) Merge the same headers
            col = colAnchor + 1;
            let value;
            let first;
            for (let index = 0; index < pivot.cache.cols[0].length - 1; index++) {
                let row = rowAnchor + index;
                for (let i = 0; i < length; i++) {
                    const next = JSON.stringify(pivot.cache.cols[i][index]);
                    if (!value) {
                        value = next;
                        first = col + i;
                    } else if (value !== next) {
                        this._merge({ top: row, bottom: row, left: first, right: col + i - 1 });
                        value = next;
                        first = col + i;
                    }
                }
                if (first && first !== col + length - 1) {
                    this._merge({ top: row, bottom: row, left: first, right: col + length - 1 });
                }
                first = undefined;
                value = undefined;
            }

            // 5) Apply formatting on headers
            this._applyStyle(HEADER_STYLE, [
                {
                    top: rowAnchor,
                    bottom: rowAnchor + pivot.cache.cols[0].length - 2,
                    left: colAnchor,
                    right: colAnchor + pivot.cache.cols.length,
                },
            ]);

            for (let zone of bold) {
                this._applyStyle(TOP_LEVEL_STYLE, [zone]);
            }

            // 6) Apply formatting on measures
            this._applyStyle(MEASURE_STYLE, [
                {
                    top: rowAnchor + pivot.cache.cols[0].length - 1,
                    bottom: rowAnchor + pivot.cache.cols[0].length - 1,
                    left: colAnchor + 1,
                    right: colAnchor + pivot.cache.cols.length,
                },
            ]);
        }
        /**
         * Build the row headers
         * 1) Create rows
         * 2) Apply style
         *
         * @param {Pivot} pivot
         * @param {Array<number>} anchor
         *
         * @private
         */
        _buildRowHeaders(pivot, anchor) {
            const col = anchor[0];
            const anchorRow = anchor[1] + Object.keys(pivot.cache.cols[0]).length;
            const bold = [];
            for (let index in pivot.cache.rows) {
                const args = [pivot.id];
                const row = anchorRow + parseInt(index, 10);
                const current = pivot.cache.rows[index];
                for (let i in current) {
                    args.push(pivot.rowGroupBys[i]);
                    args.push(current[i]);
                }
                this._applyFormula(col, row, args, true);
                if (current.length <= 1) {
                    bold.push({ top: row, bottom: row, left: col, right: col });
                }
            }
            this._applyStyle(HEADER_STYLE, [
                {
                    top: anchorRow,
                    bottom: anchorRow + pivot.cache.rows.length - 1,
                    left: col,
                    right: col,
                },
            ]);

            for (let zone of bold) {
                this._applyStyle(TOP_LEVEL_STYLE, [zone]);
            }
        }
        /**
         * Build the values of the pivot
         *  1) Create the values for all cols and rows
         *  2) Create the values for total measure
         *  3) Apply format
         *
         * @param {Pivot} pivot
         * @param {Array<number>} anchor
         *
         * @private
         */
        _buildValues(pivot, anchor) {
            const anchorCol = anchor[0] + 1;
            const anchorRow = anchor[1] + Object.keys(pivot.cache.cols[0]).length;
            // 1) Create the values for all cols and rows
            let col = anchorCol;
            let row = anchorRow;
            const sheet = this.getters.getActiveSheet();

            const length = pivot.cache.cols.length - pivot.measures.length;

            for (let i = 0; i < length; i++) {
                const cols = pivot.cache.cols[i];
                const colElement = cols[cols.length - 1];
                row = anchorRow;
                for (let rowElement of pivot.cache.rows) {
                    const args = [];
                    for (let index in rowElement) {
                        args.push(pivot.rowGroupBys[index]);
                        args.push(rowElement[index]);
                    }
                    for (let index in colElement) {
                        const field = pivot.cache.colStructure[index];
                        if (field === "measure") {
                            args.unshift(colElement[index]);
                        } else {
                            args.push(pivot.cache.colStructure[index]);
                            args.push(colElement[index]);
                        }
                    }
                    args.unshift(pivot.id);
                    this._applyFormula(col, row, args, false);
                    row++;
                }
                col++;
            }

            // 2) Create the total for measures
            row = anchorRow;
            for (let i = length; i < pivot.cache.cols.length; i++) {
                const cols = pivot.cache.cols[i];
                const colElement = cols[cols.length - 1];
                row = anchorRow;
                for (let rowElement of pivot.cache.rows) {
                    const args = [];
                    for (let index in rowElement) {
                        args.push(pivot.rowGroupBys[index]);
                        args.push(rowElement[index]);
                    }
                    args.unshift(colElement[0]);
                    args.unshift(pivot.id);
                    this._applyFormula(col, row, args, false);
                    row++;
                }
                col++;
            }

            // 3) Apply format
            this._applyFormatter("#,##0.00", [
                {
                    top: anchorRow,
                    bottom: anchorRow + pivot.cache.rows.length - 1,
                    left: anchorCol,
                    right: anchorCol + pivot.cache.cols.length - 1,
                },
            ]);
        }
        /**
         * Get the value of the pivot.header formula
         *
         * @param {Object} cell
         *
         * @private
         * @returns {string}
         */
        _getHeaderText(cell) {
            if (!cell.content || !cell.content.startsWith("=PIVOT.HEADER")) {
                return "";
            }
            const { args } = this._parseFormula(cell.content);
            const pivot = this.getPivot(args[0]);
            const len = args.length;
            if (len === 1) {
                return _t("Total");
            }
            const field = args[len - 2];
            const value = args[len - 1];
            return pivotUtils.formatHeader(pivot, field, value);
        }
        /**
         * Extend the columns and rows to fit the pivot
         *
         * @param {Pivot} pivot
         * @param {Array<number>} anchor
         */
        _resizeSheet(pivot, anchor) {
            const colLimit = pivot.cache.cols.length + pivot.measures.length + 1;
            const numberCols = this.getters.getNumberCols();
            const deltaCol = numberCols - anchor[0];
            if (deltaCol < colLimit) {
                this.dispatch("ADD_COLUMNS", {
                    column: numberCols - 1,
                    sheet: this.getters.getActiveSheet(),
                    quantity: colLimit - deltaCol,
                    position: "after",
                });
            }
            const rowLimit = pivot.cache.rows.length + pivot.cache.cols[0].length + 1;
            const numberRows = this.getters.getNumberRows();
            const deltaRow = numberRows - anchor[1];
            if (deltaRow < rowLimit) {
                this.dispatch("ADD_ROWS", {
                    row: numberRows - 1,
                    sheet: this.getters.getActiveSheet(),
                    quantity: rowLimit - deltaRow,
                    position: "after",
                });
            }
        }

        // ---------------------------------------------------------------------
        // Helpers
        // ---------------------------------------------------------------------

        /**
         * Build a formula and update the cell with this formula
         *
         * @param {number} col
         * @param {number} row
         * @param {Array<string>} args
         * @param {boolean} isHeader
         *
         * @private
         */
        _applyFormula(col, row, args, isHeader) {
            const sheet = this.getters.getActiveSheet();
            const content = isHeader
                ? this._buildHeaderFormula(args)
                : this._buildValueFormula(args);
            this.dispatch("UPDATE_CELL", { sheet, col, row, content });
        }
        /**
         * Apply the given formatter to the given target
         *
         * @param {string} formatter
         * @param {Object} target
         *
         * @private
         */
        _applyFormatter(formatter, target) {
            const sheet = this.getters.getActiveSheet();
            this.dispatch("SET_FORMATTER", { sheet, target, formatter });
        }
        /**
         * Apply the given formatter to the given target
         *
         * @param {string} style
         * @param {Object} target
         *
         * @private
         */
        _applyStyle(style, target) {
            const sheet = this.getters.getActiveSheet();
            this.dispatch("SET_FORMATTING", { sheet, target, style });
        }
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
            if (cols.length === 1 && pivot.measures.map(x => x.field).includes(cols[0])) {
                args.push("measure");
                args.push(cols[0]);
            } else {
                for (let index in cols) {
                    args.push(pivot.cache.colStructure[index]);
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
            return `=PIVOT.HEADER("${args.join('","')}")`;
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
            return `=PIVOT("${args.join('","')}")`;
        }
        /**
         * Merge a zone
         *
         * @param {Object} zone
         */
        _merge(zone) {
            const sheet = this.getters.getActiveSheet();
            this.dispatch("ADD_MERGE", { sheet, zone });
        }
        /**
         * Parse a pivot formula, returns the name of the function and the args
         *
         * @param {string} formula
         *
         * @private
         * @returns {Object} functionName: name of the function, args: array of string
         */
        _parseFormula(formula) {
            const ast = parse(formula);
            const functionName = ast.value;
            const args = ast.args.map((arg) => {
                switch (typeof arg.value) {
                    case "string":
                        return arg.value.slice(1, -1);
                    case "number":
                        return arg.value.toString();
                }
                return "";
            });
            return { functionName, args };
        }
    }

    PivotPlugin.modes = ["normal", "headless", "readonly"];
    PivotPlugin.getters = ["getPivot", "getPivots", "getSelectedPivot", "getNextValue"];

    return PivotPlugin;
});
