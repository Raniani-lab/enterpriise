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
    PivotPlugin.getters = ["getPivot", "getPivots"];

    return PivotPlugin;
});
