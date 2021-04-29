odoo.define("documents_spreadsheet.PivotStructurePlugin", function (require) {
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

    /**
     * @typedef {Object} RuntimePivot
     * @property {(PivotCache|undefined)} cache
     * @property {Date | undefined} lastUpdate
     */

    const core = require("web.core");
    const pivotUtils = require("documents_spreadsheet.pivot_utils");
    const spreadsheet = require("documents_spreadsheet.spreadsheet");
    const {
        getNumberOfPivotFormulas,
        getFormulaNameAndArgs,
    } = require("documents_spreadsheet/static/src/js/o_spreadsheet/plugins/helpers.js");

    const Domain = require("web.Domain");
    const pyUtils = require("web.py_utils");

    const _t = core._t;
    const computeTextWidth = spreadsheet.helpers.computeTextWidth;

    const HEADER_STYLE = { fillColor: "#f2f2f2" };
    const TOP_LEVEL_STYLE = { bold: true, fillColor: "#f2f2f2" };
    const MEASURE_STYLE = { fillColor: "#f2f2f2", textColor: "#756f6f" };

    class PivotStructurePlugin extends spreadsheet.UIPlugin {
        constructor(getters, history, dispatch, config) {
            super(getters, history, dispatch, config);
            this.rpc = config.evalContext.env ? config.evalContext.env.services.rpc : undefined;
            this.selectedPivot = undefined;
            this.runtimes = {};
        }

        /**
         * Handle a spreadsheet command
         * @param {Object} cmd Command
         */
        handle(cmd) {
            switch (cmd.type) {
                case "BUILD_PIVOT":
                    this._handleBuildPivot(cmd.sheetId, cmd.anchor, cmd.pivot, cmd.cache);
                    break;
                case "REBUILD_PIVOT":
                    this._rebuildPivot(cmd.id, cmd.anchor);
                    break;
                case "SELECT_PIVOT":
                    this._selectPivotFromId(cmd.pivotId);
                    break;
                case "ADD_PIVOT_DOMAIN":
                    this._addDomain(cmd.id, cmd.domain, cmd.refresh);
                    break;
                case "REFRESH_PIVOT":
                    this._refreshPivot(cmd.id);
                    break;
                case "START":
                    this._refreshAllPivots();
                    break;
                case "ADD_PIVOT":
                    this._onAddPivot(cmd.pivot);
                    break;
            }
        }

        // ---------------------------------------------------------------------
        // Getters
        // ---------------------------------------------------------------------

        /**
         * Get the cache of the given pivot. If the cache is not ready, wait for it.
         *
         * @param {number} pivotId
         * @param {Object} params
         * @param {boolean} params.dataOnly=false only refresh the data, not the structure of the pivot
         * @param {boolean} params.force=false Force to refresh the cache
         * @param {boolean} params.initialDomain=false only refresh the data with the domain of the pivot,
         *                                      without the global filters
         */
        async getAsyncCache(pivotId, { dataOnly = false, force = false, initialDomain = false } = {}) {
            const pivot = this.getters.getPivot(pivotId);
            if (!pivot) {
                throw new Error(_.str.sprintf( _t("There is no pivot with the given id: %s"), pivotId));
            }
            if (!(pivotId in this.runtimes)) {
                this.runtimes[pivotId] = {
                    cache: undefined,
                    lastUpdate: undefined,
                    promise: undefined,
                };
            }
            const runtime = this.runtimes[pivotId];
            if (force) {
                runtime.promise = undefined;
            }
            if (!runtime.promise) {
                runtime.promise = pivotUtils
                    .createPivotCache(pivot, this.rpc, runtime.cache, { dataOnly, initialDomain})
                    .then((cache) => {
                        runtime.lastUpdate = Date.now();
                        runtime.cache = cache;
                        return cache;
                    });
            }
            return runtime.promise;
        }

        isCacheLoaded(pivotId) {
            return !!this.runtimes[pivotId].cache;
        }

        getCache(pivotId) {
            return this.runtimes[pivotId].cache;
        }

        getLastUpdate(pivotId) {
            return this.runtimes[pivotId] && this.runtimes[pivotId].lastUpdate;
        }

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
            if (getNumberOfPivotFormulas(formula)!==1) {
                return formula;
            }
            const { functionName, args } = getFormulaNameAndArgs(formula);
            const pivot = this.getters.getPivot(args[0]);
            if (!pivot || !this.isCacheLoaded(pivot.id)) {
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
         * Retrieve the pivot of the current selected cell
         *
         * @returns {Pivot}
         */
        getSelectedPivot() {
            return this.selectedPivot;
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
        // Handlers
        // ---------------------------------------------------------------------

        /**
         * Add the runtime information to the local state
         *
         * @param {Pivot} pivot
         */
        _onAddPivot(pivot) {
            this.runtimes[pivot.id] = {
                cache: undefined,
                isCurrentlyLoading: false,
                lastUpdate: undefined,
            };
        }

        /**
         * Add a pivot to the local state and build it at the given anchor
         *
         * @param {string} sheetId
         * @param {Pivot} pivot
         * @param {Array<number>} anchor
         *
         * @private
         */
        _handleBuildPivot(sheetId, anchor, pivot, cache) {
            const pivots = this.getters.getPivots();
            const id = pivots.length ? Math.max(...pivots.map((p) => p.id)) + 1 : 1;
            pivot.id = id;
            this.dispatch("ADD_PIVOT", { pivot });
            this.runtimes[pivot.id] = {
                promise: cache,
                cache,
                lastUpdate: Date.now(),
            }
            this._buildPivot(sheetId, pivot, anchor, cache);
            this._autoresize(sheetId, anchor, cache);
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
            const pivot = this.getters.getPivot(id);
            const cache = this.getCache(pivot.id);
            const sheetId = this.getters.getActiveSheetId();
            this._buildPivot(sheetId, pivot, anchor, cache);
        }
        /**
         * Select the pivot provided
         *
         * @param {number | undefined} id
         *
         * @private
         */
        _selectPivotFromId(id) {
            this.selectedPivot = id ? this.getters.getPivot(id) : undefined;
        }

        /**
         * Refresh the cache of all pivots.
         */
        _refreshAllPivots() {
            for (let pivot of this.getters.getPivots()) {
                this._refreshPivotCache(pivot.id);
            }
        }
        /**
         * Refresh the cache of a given pivot or all pivots if none is provided.
         * This will also trigger a new re-evaluation
         *
         * @param {number | undefined} id
         */
        _refreshPivot(id) {
            const pivotIds = id ? [id] : this.getters.getPivots().map((item) => item.id);
            for (let pivotId of pivotIds) {
                this._refreshPivotCache(pivotId, { dataOnly: true });
            }
            this.dispatch("EVALUATE_CELLS", { sheetId: this.getters.getActiveSheetId() });
        }
        /**
         * Update the cache of a pivot object
         *
         * @param {string} id Id of the pivot to update
         * @private
         */
        _refreshPivotCache(id, { dataOnly = false } = {}) {
            this.getAsyncCache(id, { dataOnly, force: true });
        }

        /**
         * Add an additional domain to a pivot
         *
         * @private
         * @param {string} id pivot id
         * @param {Array<Array<any>>} domain
         * @param {boolean} refresh whether the cache should be reloaded or not
         */
        _addDomain(id, domain, refresh = true) {
            const pivot = this.getters.getPivot(id);
            domain = pyUtils.assembleDomains(
                [
                    Domain.prototype.arrayToString(pivot.domain),
                    Domain.prototype.arrayToString(domain),
                ],
                "AND"
            );
            pivot.computedDomain = pyUtils.eval("domain", domain, {});
            if (refresh) {
                this._refreshPivotCache(id, { dataOnly: true });
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
            const cache = this.getCache(pivot.id);
            const date = cache.isGroupedByDate(
                isColumn ? pivot.colGroupBys : pivot.rowGroupBys
            );
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
            const cache = this.getCache(pivot.id);
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
            const cache = this.getCache(pivot.id);
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
                    if (
                        currentIndex === -1 ||
                        nextIndex < 0 ||
                        nextIndex >= cache.getRowCount()
                    ) {
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
            const cache = this.getCache(pivot.id);
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
        _autoresize(sheetId, anchor, cache) {
            const end = anchor[0] + cache.getTopHeaderCount();
            for (let col = anchor[0]; col <= end; col++) {
                const cells = this.getters.getColCells(sheetId, col);
                const ctx = document.createElement("canvas").getContext("2d");
                const sizes = cells.map((cell) => {
                    const style = this.getters.getCellStyle(cell);
                    const text = this._getHeaderText(cell, cache);
                    return computeTextWidth(ctx, text, style) + 6;
                }); // 6: padding
                const size = Math.max(96, ...sizes); //96: default header width
                const columns = [col];
                if (size !== 0) {
                    this.dispatch("RESIZE_COLUMNS", { sheetId, columns, size });
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
        _buildPivot(sheetId, pivot, anchor, cache) {
            this._resizeSheet(sheetId, pivot, anchor, cache);
            this._buildColHeaders(sheetId, pivot, anchor, cache);
            this._buildRowHeaders(sheetId, pivot, anchor, cache);
            this._buildValues(sheetId, pivot, anchor, cache);
        }
        /**
         * Build the headers of the columns
         *  1) Apply style on the top-left cells
         *  2) Create the column headers
         *  3) Create the total measures
         *  4) Merge the consecutive titles
         *  5) Apply the style of titles
         *  6) Apply the style of headers
         *
         * @param {Pivot} pivot
         * @param {Array<number>} anchor
         *
         * @private
         */
        _buildColHeaders(sheetId, pivot, anchor, cache) {
            const [colAnchor, rowAnchor] = anchor;
            const bold = [];
            const levels = cache.getColGroupByLevels();
            // 1) Apply style on the top-left cells
            this._applyStyle(sheetId, HEADER_STYLE, [{
                top: rowAnchor,
                bottom: rowAnchor + levels,
                left: colAnchor,
                right: colAnchor,
            }]);

            // 2) Create the column headers
            let col = colAnchor + 1;

            // Do not take the last measures into account here
            let length = cache.getTopHeaderCount() - pivot.measures.length;
            if (length === 0) {
                length = cache.getTopHeaderCount();
            }

            for (let i = 0; i < length; i++) {
                let row = rowAnchor;
                for (let level = 0; level <= levels; level++) {
                    const args = [pivot.id];
                    const values = cache.getColGroupHierarchy(i, level);
                    for (const index in values) {
                        args.push(cache.getColLevelIdentifier(index));
                        args.push(values[index]);
                    }
                    this._applyFormula(sheetId, col, row, args, true);
                    if (level <= levels - 1) {
                        bold.push({ top: row, bottom: row, left: col, right: col });
                    }
                    row++;
                }
                col++;
            }

            // 3) Create the total for measures
            let row = rowAnchor + levels - 1;
            for (let i = length; i < cache.getTopHeaderCount(); i++) {
                const args = [pivot.id];
                this._applyFormula(sheetId, col, row, args, true);
                bold.push({ top: row, bottom: row, left: col, right: col });
                args.push("measure");
                args.push(cache.getColGroupHierarchy(i, 1)[0]);
                this._applyFormula(sheetId, col, row + 1, args, true);
                col++;
            }

            // 4) Merge the same headers
            col = colAnchor + 1;
            let value;
            let first;
            for (let index = 0; index < cache.getColGroupByLevels(); index++) {
                let row = rowAnchor + index;
                for (let i = 0; i < length; i++) {
                    const next = JSON.stringify(cache.getColGroupHierarchy(i, index));
                    if (!value) {
                        value = next;
                        first = col + i;
                    } else if (value !== next) {
                        this._merge(sheetId, { top: row, bottom: row, left: first, right: col + i - 1 });
                        value = next;
                        first = col + i;
                    }
                }
                if (first && first !== col + length - 1) {
                    this._merge(sheetId, { top: row, bottom: row, left: first, right: col + length - 1 });
                }
                first = undefined;
                value = undefined;
            }

            for (let index = 0; index < cache.getColGroupByLevels(); index++) {
                const row = rowAnchor + index;
                const colStart = cache.getTopHeaderCount() - pivot.measures.length + 1;
                this._merge(sheetId, {
                    top: row,
                    bottom: row,
                    left: colStart,
                    right: colStart + pivot.measures.length - 1,
                });
            }

            // 5) Apply formatting on headers
            this._applyStyle(sheetId, HEADER_STYLE, [
                {
                    top: rowAnchor,
                    bottom: rowAnchor + cache.getColGroupByLevels() - 1,
                    left: colAnchor,
                    right: colAnchor + cache.getTopHeaderCount(),
                },
            ]);

            for (let zone of bold) {
                this._applyStyle(sheetId, TOP_LEVEL_STYLE, [zone]);
            }

            // 6) Apply formatting on measures
            this._applyStyle(sheetId, MEASURE_STYLE, [
                {
                    top: rowAnchor + cache.getColGroupByLevels(),
                    bottom: rowAnchor + cache.getColGroupByLevels(),
                    left: colAnchor + 1,
                    right: colAnchor + cache.getTopHeaderCount(),
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
        _buildRowHeaders(sheetId, pivot, anchor, cache) {
            const col = anchor[0];
            const anchorRow = anchor[1] + cache.getColGroupByLevels() + 1;
            const bold = [];
            const rowCount = cache.getRowCount();
            for (let index = 0; index < rowCount; index++) {
                const args = [pivot.id];
                const row = anchorRow + parseInt(index, 10);
                const current = cache.getRowValues(index);
                for (let i in current) {
                    args.push(pivot.rowGroupBys[i]);
                    args.push(current[i]);
                }
                this._applyFormula(sheetId, col, row, args, true);
                if (current.length <= 1) {
                    bold.push({ top: row, bottom: row, left: col, right: col });
                }
            }
            this._applyStyle(sheetId, HEADER_STYLE, [
                {
                    top: anchorRow,
                    bottom: anchorRow + rowCount - 1,
                    left: col,
                    right: col,
                },
            ]);

            for (let zone of bold) {
                this._applyStyle(sheetId, TOP_LEVEL_STYLE, [zone]);
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
        _buildValues(sheetId, pivot, anchor, cache) {
            const anchorCol = anchor[0] + 1;
            const anchorRow = anchor[1] + cache.getColGroupByLevels() + 1;
            // 1) Create the values for all cols and rows
            let col = anchorCol;
            let row = anchorRow;

            const length = cache.getTopHeaderCount() - pivot.measures.length;

            for (let i = 0; i < length; i++) {
                const colElement = [
                    ...cache.getColumnValues(i),
                    cache.getMeasureName(i),
                ];
                row = anchorRow;
                for (let rowElement of cache.getRows()) {
                    const args = [];
                    for (let index in rowElement) {
                        args.push(pivot.rowGroupBys[index]);
                        args.push(rowElement[index]);
                    }
                    for (let index in colElement) {
                        const field = cache.getColLevelIdentifier(index);
                        if (field === "measure") {
                            args.unshift(colElement[index]);
                        } else {
                            args.push(cache.getColLevelIdentifier(index));
                            args.push(colElement[index]);
                        }
                    }
                    args.unshift(pivot.id);
                    this._applyFormula(sheetId, col, row, args, false);
                    row++;
                }
                col++;
            }

            // 2) Create the total for measures
            row = anchorRow;
            for (let i = length; i < cache.getTopHeaderCount(); i++) {
                const colElement = [
                    ...cache.getColumnValues(i),
                    cache.getMeasureName(i),
                ];
                row = anchorRow;
                for (let rowElement of cache.getRows()) {
                    const args = [];
                    for (let index in rowElement) {
                        args.push(pivot.rowGroupBys[index]);
                        args.push(rowElement[index]);
                    }
                    args.unshift(colElement[0]);
                    args.unshift(pivot.id);
                    this._applyFormula(sheetId, col, row, args, false);
                    row++;
                }
                col++;
            }

            // 3) Apply format
            this._applyFormat(sheetId, "#,##0.00", [
                {
                    top: anchorRow,
                    bottom: anchorRow + cache.getRowCount() - 1,
                    left: anchorCol,
                    right: anchorCol + cache.getTopHeaderCount() - 1,
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
        _getHeaderText(cell, cache) {
            if (cell.type !== "formula" || !cell.formula.text.startsWith("=PIVOT.HEADER")) {
                return "";
            }
            const { args } = getFormulaNameAndArgs(cell.formula.text);
            const len = args.length;
            if (len === 1) {
                return _t("Total");
            }
            const field = args[len - 2];
            const value = args[len - 1];
            return pivotUtils.formatHeader(cache, field, value);
        }
        /**
         * Extend the columns and rows to fit the pivot
         *
         * @param {Pivot} pivot
         * @param {Array<number>} anchor
         */
        _resizeSheet(sheetId, pivot, anchor, cache) {
            const colLimit = cache.getTopHeaderCount() + pivot.measures.length + 1;
            const sheet = this.getters.getSheet(sheetId)
            const numberCols = sheet.cols.length;
            const deltaCol = numberCols - anchor[0];
            if (deltaCol < colLimit) {
                this.dispatch("ADD_COLUMNS_ROWS", {
                    dimension: "COL",
                    base: numberCols - 1,
                    sheetId: sheetId,
                    quantity: colLimit - deltaCol,
                    position: "after",
                });
            }
            const rowLimit = cache.getRowCount() + cache.getColGroupByLevels() + 2;
            const numberRows = sheet.rows.length;
            const deltaRow = numberRows - anchor[1];
            if (deltaRow < rowLimit) {
                this.dispatch("ADD_COLUMNS_ROWS", {
                    dimension: "ROW",
                    base: numberRows - 1,
                    sheetId: sheetId,
                    quantity: rowLimit - deltaRow,
                    position: "after",
                });
            }
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
            const cache = this.getCache(pivot.id);
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
            const cache = this.getCache(pivot.id);
            for (let [field, value] of Object.entries(values)) {
                tooltips.push({
                    title:
                        field === "measure"
                            ? _t("Measure")
                            : pivotUtils.formatGroupBy(cache, field),
                    value: pivotUtils.formatHeader(cache, field, value) || _t("Undefined"),
                });
            }
            return tooltips;
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
        _applyFormula(sheetId, col, row, args, isHeader) {
            this.dispatch("ADD_PIVOT_FORMULA", {
                sheetId,
                col,
                row,
                formula: isHeader ? "PIVOT.HEADER" : "PIVOT",
                args
            });
        }
        /**
         * Apply the given format to the given target
         *
         * @param {string} format
         * @param {Object} target
         *
         * @private
         */
        _applyFormat(sheetId, format, target) {
            this.dispatch("SET_FORMATTING", { sheetId, target, format });
        }
        /**
         * Apply the given formatter to the given target
         *
         * @param {string} style
         * @param {Object} target
         *
         * @private
         */
        _applyStyle(sheetId, style, target) {
            this.dispatch("SET_FORMATTING", { sheetId, target, style });
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
            if (cols.length === 1 && pivot.measures.map((x) => x.field).includes(cols[0])) {
                args.push("measure");
                args.push(cols[0]);
            } else {
                const cache = this.getCache(pivot.id);
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
            return `=PIVOT.HEADER("${args.map((arg) => arg.toString().replace(/"/g, '\\"')).join('","')}")`;
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
        /**
         * Merge a zone
         *
         * @param {Object} zone
         */
        _merge(sheetId, zone) {
            this.dispatch("ADD_MERGE", { sheetId, target: [zone] });
        }
    }

    PivotStructurePlugin.modes = ["normal", "headless", "readonly"];
    PivotStructurePlugin.getters = [
        "getSelectedPivot",
        "getNextValue",
        "getTooltipFormula",
        "getCache",
        "getAsyncCache",
        "isCacheLoaded",
        "getLastUpdate",
    ];

    return PivotStructurePlugin;
});
