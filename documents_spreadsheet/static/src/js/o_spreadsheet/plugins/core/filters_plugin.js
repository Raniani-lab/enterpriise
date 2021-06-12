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

    const Domain = require("web.Domain");
    const spreadsheet = require("documents_spreadsheet.spreadsheet");
    const { constructDateDomain, constructDateRange, yearSelected, getPeriodOptions } = require("web.searchUtils");
    const CommandResult = require("documents_spreadsheet.CommandResult");
    const pyUtils = require("web.py_utils");

    const core = require("web.core");
    const _t = core._t;

    const MONTHS = {
        january: { value: 0, granularity: 'month' },
        february: { value: 1, granularity: 'month' },
        march: { value: 2, granularity: 'month' },
        april: { value: 3, granularity: 'month' },
        may: { value: 4, granularity: 'month' },
        june: { value: 5, granularity: 'month' },
        july: { value: 6, granularity: 'month' },
        august: { value: 7, granularity: 'month' },
        september: { value: 8, granularity: 'month' },
        october: { value: 9, granularity: 'month' },
        november: { value: 10, granularity: 'month' },
        december: { value: 11, granularity: 'month' },
    };
    const THIS_YEAR = moment().year();
    const YEARS = {
        this_year: { value: THIS_YEAR, granularity: 'year' },
        last_year: { value: THIS_YEAR - 1, granularity: 'year' },
        antepenultimate_year: { value: THIS_YEAR - 2, granularity: 'year' },
    };
    const PERIOD_OPTIONS = Object.assign({}, MONTHS, YEARS);

    const { uuidv4 } = spreadsheet.helpers;

    class FiltersPlugin extends spreadsheet.CorePlugin {
        constructor(getters, history, range, dispatch, config) {
            super(...arguments);
            this.rpc = config.evalContext.env ? config.evalContext.env.services.rpc : undefined;
            this.globalFilters = [];

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
                    if (!this.globalFilters.find((x) => x.id === cmd.id)) {
                        return CommandResult.FilterNotFound;
                    } else if (this._isDuplicatedLabel(cmd.id, cmd.filter.label)) {
                        return CommandResult.DuplicatedFilterLabel;
                    }
                    break;
                case "REMOVE_PIVOT_FILTER":
                    if (!this.globalFilters.find((x) => x.id === cmd.id)) {
                        return CommandResult.FilterNotFound;
                    }
                    break;
                case "ADD_PIVOT_FILTER":
                    if (this._isDuplicatedLabel(cmd.id, cmd.filter.label)) {
                        return CommandResult.DuplicatedFilterLabel;
                    }
                    break;
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
                case "START":
                    this._setUpFilters();
                    break;
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

        async getFilterDisplayValue(filterName) {
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
                    if (!filter.value || !this.rpc) return "";
                    if (!this.recordsDisplayName[filter.id]) {
                        // store the promise resolving to the list of display names
                        this.recordsDisplayName[filter.id] = this.rpc({
                            model: filter.modelName,
                            method: "name_get",
                            args: [filter.value],
                        }).then((result) => result.map(([id, name]) => name));
                    }
                    const names = await this.recordsDisplayName[filter.id];
                    return names.join(", ");
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
            this._updatePivotsDomain();
            this.dispatch("EVALUATE_CELLS", { sheetId: this.getters.getActiveSheetId() });
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
            this._updatePivotsDomain();
            this.dispatch("EVALUATE_CELLS", { sheetId: this.getters.getActiveSheetId() });
        }
        /**
         * Remove a global filter
         *
         * @param {number} id Id of the filter to remove
         */
        _removeGlobalFilter(id) {
            const gb = this.globalFilters.filter((filter) => filter.id !== id);
            this.history.update("globalFilters", gb);
            this._updatePivotsDomain();
            this.dispatch("EVALUATE_CELLS", { sheetId: this.getters.getActiveSheetId() });
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
            this._updatePivotsDomain();
            this.dispatch("EVALUATE_CELLS", { sheetId: this.getters.getActiveSheetId() });
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
        exportForExcel(data){
            if (this.globalFilters.length === 0){
                return;
            }
            const styles = Object.entries(data.styles)
            let titleStyleId =
              styles.findIndex(
                el => JSON.stringify(el[1]) === JSON.stringify({bold: true})
              ) + 1;

            if (titleStyleId <= 0){
                titleStyleId = styles.length + 1
                data.styles[styles.length + 1] = {bold: true}
            }

            const cells = {}
            cells["A1"] = {content: "Filter", style: titleStyleId}
            cells["B1"] = {content: "Value", style: titleStyleId}
            for (let [index, filter] of Object.entries(this.globalFilters)){
                const row = parseInt(index) + 2;
                cells[`A${row}`] = {content: filter.label};
                let content;
                switch (filter.type){
                    case "text":
                        content = filter.value || "";
                        break;
                    case "date":
                        content = getPeriodOptions(moment())
                            .filter(
                                ({ id }) =>
                                    filter.value && [filter.value.year, filter.value.period].includes(id)
                            )
                            .map((period) => period.description)
                            .join(" ");
                        break;
                    case "relation":
                        content = this.recordsDisplayName[filter.id].join(', ');
                        break;
                }
                cells[`B${row}`] = { content };
            }
            data.sheets.push({
                id: uuidv4(),
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
            })
        }

        // ---------------------------------------------------------------------
        // Global filters
        // ---------------------------------------------------------------------

        _setUpFilters() {
            if (this.getters.getPivots().length) {
                this._updatePivotsDomain({ refresh: true });
            }
        }

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
        /**
         * Update the domain of all the pivots by applying global filters to
         * the initial domain of the pivot.
         */
        _updatePivotsDomain({ refresh = true } = {}) {
            for (let pivot of this.getters.getPivots()) {
                let domain = "[]";
                for (let filter of this.globalFilters) {
                    if (!(pivot.id in filter.fields)) {
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
                        const field = filter.fields[pivot.id].field;
                        const type = filter.fields[pivot.id].type;
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
                        const field = filter.fields[pivot.id].field;
                        const textDomain = Domain.prototype.arrayToString([
                            [field, "ilike", value],
                        ]);
                        domain = pyUtils.assembleDomains([domain, textDomain], "AND");
                    }
                    if (filter.type === "relation") {
                        const values = filter.value;
                        if (!values || values.length === 0) {
                            continue;
                        }
                        const field = filter.fields[pivot.id].field;
                        const textDomain = Domain.prototype.arrayToString([[field, "in", values]]);
                        domain = pyUtils.assembleDomains([domain, textDomain], "AND");
                    }
                }
                this.dispatch("ADD_PIVOT_DOMAIN", { id: pivot.id, domain, refresh });
            }
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

    FiltersPlugin.modes = ["normal", "headless", "readonly"];
    FiltersPlugin.getters = [
        "getGlobalFilter",
        "getGlobalFilters",
        "getFilterDisplayValue",
        "getActiveFilterCount",
    ];

    return FiltersPlugin;
});
