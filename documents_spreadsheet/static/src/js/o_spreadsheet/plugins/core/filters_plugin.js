odoo.define("documents_spreadsheet.FiltersPlugin", function (require) {
    "use strict";

    /**
     * @typedef {Object} GlobalFilter
     * @property {string} id
     * @property {string} label
     * @property {string} type "text" | "date" | "relation"
     * @property {string|undefined} rangeType "year" | "month" | "quarter"
     * @property {Object} fields
     * @property {string|Array<string>|Object} defaultValue Default Value
     * @property {string|Array<string>|Object} [value] Current Value
     * @property {number} [modelID] ID of the related model
     * @property {string} [modelName] Name of the related model
     */

    const spreadsheet = require("documents_spreadsheet.spreadsheet");
    const { getPeriodOptions } = require("web.searchUtils");
    const CommandResult = require("documents_spreadsheet.CommandResult");

    const core = require("web.core");
    const _t = core._t;

    const uuidGenerator = new spreadsheet.helpers.UuidGenerator();

    class FiltersPlugin extends spreadsheet.CorePlugin {
        constructor(getters, history, range, dispatch, config) {
            super(...arguments);
            this.globalFilters = [];
            this.orm = config.evalContext.env ? config.evalContext.env.services.orm : undefined;

            /**
             * Cache record display names for relation filters.
             * For each filter, contains a promise resolving to
             * the list of display names.
             */
            this.recordsDisplayName = {};
        }

        /**
         * Check if the given command can be dispatched
         *
         * @param {Object} cmd Command
         */
        allowDispatch(cmd) {
            switch (cmd.type) {
                case "EDIT_PIVOT_FILTER":
                    if (!this.getGlobalFilter(cmd.id)) {
                        return CommandResult.FilterNotFound;
                    } else if (this._isDuplicatedLabel(cmd.id, cmd.filter.label)) {
                        return CommandResult.DuplicatedFilterLabel;
                    }
                    return this._checkTypeValueCombination(
                        cmd.filter.type,
                        cmd.filter.defaultValue
                    );
                case "SET_PIVOT_FILTER_VALUE":
                    const filter = this.getGlobalFilter(cmd.id);
                    if (!filter) {
                        return CommandResult.FilterNotFound;
                    }
                    return this._checkTypeValueCombination(filter.type, cmd.value);
                case "REMOVE_PIVOT_FILTER":
                    if (!this.getGlobalFilter(cmd.id)) {
                        return CommandResult.FilterNotFound;
                    }
                    break;
                case "ADD_PIVOT_FILTER":
                    if (this._isDuplicatedLabel(cmd.id, cmd.filter.label)) {
                        return CommandResult.DuplicatedFilterLabel;
                    }
                    return this._checkTypeValueCombination(
                        cmd.filter.type,
                        cmd.filter.defaultValue
                    );
            }
            return CommandResult.Success;
        }

        /**
         * Handle a spreadsheet command
         *
         * @param {Object} cmd Command
         */
        handle(cmd) {
            switch (cmd.type) {
                case "ADD_PIVOT_FILTER":
                    this.recordsDisplayName[cmd.filter.id] = cmd.filter.defaultValueDisplayNames;
                    this._addGlobalFilter(cmd.filter);
                    break;
                case "EDIT_PIVOT_FILTER":
                    this.recordsDisplayName[cmd.filter.id] = cmd.filter.defaultValueDisplayNames;
                    this._editGlobalFilter(cmd.id, cmd.filter);
                    break;
                case "SET_PIVOT_FILTER_VALUE":
                    this.recordsDisplayName[cmd.id] = cmd.displayNames;
                    this._setGlobalFilterValue(cmd.id, cmd.value);
                    break;
                case "REMOVE_PIVOT_FILTER":
                    this._removeGlobalFilter(cmd.id);
                    break;
            }
        }

        // ---------------------------------------------------------------------
        // Getters
        // ---------------------------------------------------------------------

        /**
         * Retrive the global filter with the given id
         *
         * @param {number} id
         * @returns {Object} Global filter
         */
        getGlobalFilter(id) {
            return this.globalFilters.find((x) => x.id === id);
        }
        /**
         * Retrieve the global filters
         *
         * @returns {Array<Object>} Array of Global filters
         */
        getGlobalFilters() {
            return this.globalFilters;
        }

        /**
         * @returns {number}
         */
        getActiveFilterCount() {
            return this.globalFilters.filter((filter) => {
                switch (filter.type) {
                    case "text":
                        return filter.value;
                    case "date":
                        return filter.value && (filter.value.year || filter.value.period);
                    case "relation":
                        return filter.value && filter.value.length;
                }
            }).length;
        }

        getFilterDisplayValue(filterName) {
            const filter = this.globalFilters.find((filter) => filter.label === filterName);
            if (!filter) {
                throw new Error(_.str.sprintf(_t(`Filter "%s" not found`), filterName));
            }
            switch (filter.type) {
                case "text":
                    return filter.value || "";
                case "date":
                    return getPeriodOptions(moment())
                        .filter(
                            ({ id }) =>
                                filter.value &&
                                [filter.value.year, filter.value.period].includes(id)
                        )
                        .map((period) => period.description)
                        .join(" ");
                case "relation":
                    if (!filter.value || !this.orm) return "";
                    if (!this.recordsDisplayName[filter.id]) {
                        this.orm
                            .call(filter.modelName, "name_get", [filter.value])
                            .then((result) => {
                                const names = result.map(([, name]) => name);
                                this.recordsDisplayName[filter.id] = names;
                                this.dispatch("EVALUATE_CELLS", {
                                    sheetId: this.getters.getActiveSheetId(),
                                });
                            });
                        return "";
                    }
                    return this.recordsDisplayName[filter.id].join(", ");
            }
        }

        // ---------------------------------------------------------------------
        // Handlers
        // ---------------------------------------------------------------------

        /**
         * Add a global filter
         *
         * @param {GlobalFilter} filter
         */
        _addGlobalFilter(filter) {
            const gb = this.globalFilters.slice();
            gb.push({
                id: filter.id,
                label: filter.label,
                type: filter.type,
                rangeType: filter.rangeType,
                fields: filter.fields,
                value: filter.defaultValue,
                defaultValue: filter.defaultValue,
                modelName: filter.modelName,
            });
            this.history.update("globalFilters", gb);
        }
        /**
         * Set the current value of a global filter
         *
         * @param {number} id Id of the filter
         * @param {string|Array<string>} value Current value to set
         */
        _setGlobalFilterValue(id, value) {
            const globalFilter = this.globalFilters.find((filter) => filter.id === id);
            globalFilter.value = value;
        }
        /**
         * Remove a global filter
         *
         * @param {number} id Id of the filter to remove
         */
        _removeGlobalFilter(id) {
            const gb = this.globalFilters.filter((filter) => filter.id !== id);
            this.history.update("globalFilters", gb);
        }
        /**
         * Edit a global filter
         *
         * @param {number} id Id of the filter to update
         * @param {GlobalFilter} newFilter
         */
        _editGlobalFilter(id, newFilter) {
            const currentLabel = this.getGlobalFilter(id).label;
            const gb = this.globalFilters.map((filter) =>
                filter.id !== id
                    ? filter
                    : {
                          id: filter.id,
                          label: newFilter.label,
                          type: newFilter.type,
                          rangeType: newFilter.rangeType,
                          fields: newFilter.fields,
                          defaultValue: newFilter.defaultValue,
                          value: newFilter.defaultValue,
                          modelName: newFilter.modelName,
                      }
            );
            this.history.update("globalFilters", gb);
            const newLabel = this.getGlobalFilter(id).label;
            if (currentLabel !== newLabel) {
                this._updateFilterLabelInFormulas(currentLabel, newLabel);
            }
        }

        // ---------------------------------------------------------------------
        // Import/Export
        // ---------------------------------------------------------------------

        /**
         * Import the filters
         *
         * @param {Object} data
         */
        import(data) {
            if (data.globalFilters) {
                this.globalFilters = data.globalFilters;
                for (let globalFilter of this.globalFilters) {
                    globalFilter.value = globalFilter.defaultValue;
                }
            }
        }
        /**
         * Export the filters
         *
         * @param {Object} data
         */
        export(data) {
            data.globalFilters = this.globalFilters.map((filter) => Object.assign({}, filter));
            for (let globalFilter of data.globalFilters) {
                globalFilter.value = undefined;
            }
        }

        /**
         * Adds all active filters (and their values) at the time of export in a dedicated sheet
         *
         * @param {Object} data
         */
        exportForExcel(data) {
            if (this.globalFilters.length === 0) {
                return;
            }
            const styles = Object.entries(data.styles);
            let titleStyleId =
                styles.findIndex((el) => JSON.stringify(el[1]) === JSON.stringify({ bold: true })) +
                1;

            if (titleStyleId <= 0) {
                titleStyleId = styles.length + 1;
                data.styles[styles.length + 1] = { bold: true };
            }

            const cells = {};
            cells["A1"] = { content: "Filter", style: titleStyleId };
            cells["B1"] = { content: "Value", style: titleStyleId };
            for (let [index, filter] of Object.entries(this.globalFilters)) {
                const row = parseInt(index) + 2;
                cells[`A${row}`] = { content: filter.label };
                let content;
                switch (filter.type) {
                    case "text":
                        content = filter.value || "";
                        break;
                    case "date":
                        content = getPeriodOptions(moment())
                            .filter(
                                ({ id }) =>
                                    filter.value &&
                                    [filter.value.year, filter.value.period].includes(id)
                            )
                            .map((period) => period.description)
                            .join(" ");
                        break;
                    case "relation":
                        content = this.recordsDisplayName[filter.id].join(", ");
                        break;
                }
                cells[`B${row}`] = { content };
            }
            data.sheets.push({
                id: uuidGenerator.uuidv4(),
                name: "Active Filters",
                cells,
                colNumber: 2,
                rowNumber: this.globalFilters.length + 1,
                cols: {},
                rows: {},
                merges: [],
                figures: [],
                conditionalFormats: [],
                charts: [],
            });
        }

        // ---------------------------------------------------------------------
        // Global filters
        // ---------------------------------------------------------------------

        /**
         * Update all FILTER.VALUE formulas to reference a filter
         * by its new label.
         *
         * @param {string} currentLabel
         * @param {string} newLabel
         */
        _updateFilterLabelInFormulas(currentLabel, newLabel) {
            const sheets = this.getters.getSheets();
            for (let sheet of sheets) {
                for (let cell of Object.values(this.getters.getCells(sheet.id))) {
                    if (cell.type === "formula") {
                        const newContent = cell.formula.text.replace(
                            new RegExp(`FILTER\\.VALUE\\(\\s*"${currentLabel}"\\s*\\)`, "g"),
                            `FILTER.VALUE("${newLabel}")`
                        );
                        if (newContent !== cell.formula.text) {
                            const { col, row } = this.getters.getCellPosition(cell.id);
                            this.dispatch("UPDATE_CELL", {
                                sheetId: sheet.id,
                                content: newContent,
                                col,
                                row,
                            });
                        }
                    }
                }
            }
        }

        /**
         * Return true if the label is duplicated
         *
         * @param {string | undefined} filterId
         * @param {string} label
         * @returns {boolean}
         */
        _isDuplicatedLabel(filterId, label) {
            return (
                this.globalFilters.findIndex(
                    (filter) => (!filterId || filter.id !== filterId) && filter.label === label
                ) > -1
            );
        }

        _checkTypeValueCombination(type, value) {
            if (value !== undefined) {
                switch (type) {
                    case "text":
                        if (typeof value !== "string") {
                            return CommandResult.InvalidValueTypeCombination;
                        }
                        break;
                    case "date":
                        if (typeof value !== "object" || Array.isArray(value)) {
                            // not a date
                            return CommandResult.InvalidValueTypeCombination;
                        }
                        break;
                    case "relation":
                        if (!Array.isArray(value)) {
                            return CommandResult.InvalidValueTypeCombination;
                        }
                        break;
                }
            }
            return CommandResult.Success;
        }
    }

    FiltersPlugin.modes = ["normal", "headless", "readonly"];
    FiltersPlugin.getters = [
        "getGlobalFilter",
        "getGlobalFilters",
        "getFilterDisplayValue",
        "getActiveFilterCount",
    ];

    return FiltersPlugin;
});
