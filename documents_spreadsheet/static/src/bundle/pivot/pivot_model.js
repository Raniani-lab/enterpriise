/** @odoo-module */

import { _t } from "web.core";
import { Domain } from "@web/core/domain";
import { PivotModel } from "@web/views/pivot/pivot_model";
import { formats } from "../o_spreadsheet/constants";

import spreadsheet from "../o_spreadsheet/o_spreadsheet_extended";
import { formatDate } from "./pivot_helpers";
import { SpreadsheetPivotTable } from "./pivot_table";

const { toString, toNumber, toBoolean } = spreadsheet.helpers;

/**
 * @typedef {Object} PivotMetaData
 * @property {Array<string>} colGroupBys
 * @property {Array<string>} rowGroupBys
 * @property {Array<string>} activeMeasures
 * @property {string} resModel
 * @property {Object|undefined} fields
 * @property {string|undefined} modelLabel
 *
 * @typedef {Object} PivotSearchParams
 * @property {Array<string>} groupBy
 * @property {Array<string>} orderBy
 * @property {Object} domain
 * @property {Object} context
 */

/**
 * This class is an extension of PivotModel with some additional information
 * that we need in spreadsheet (name_get, isUsedInSheet, ...)
 */
export class SpreadsheetPivotModel extends PivotModel {

    /**
     * @param {Object} params
     * @param {PivotMetaData} params.metaData
     * @param {PivotSearchParams} params.searchParams
     * @param {Object} services
     * @param {import("../o_spreadsheet/metadata_repository").MetadataRepository} services.metadataRepository
     */
    setup(params, services) {
        // fieldAttrs is required, but not needed in Spreadsheet, so we define it as empty
        params.metaData.fieldAttrs = {},
        super.setup(params);

        this.metadataRepository = services.metadataRepository;

        /**
         * Contains the possible values for each group by of the pivot. This attribute is used *only* for templates,
         * so it's computed only in prepareForTemplateGeneration
         */
        this._fieldsValue = {};

        /**
         * Contains the domain of the values used during the evaluation of the formula =Pivot(...)
         * Is used to know if a pivot cell is missing or not
         * */

        this._usedValueDomains = new Set();
        /**
         * Contains the domain of the headers used during the evaluation of the formula =Pivot.header(...)
         * Is used to know if a pivot cell is missing or not
         * */
        this._usedHeaderDomains = new Set();

        /**
         * Display name of the model
         */
        this._modelLabel = params.metaData.modelLabel;
    }

    //--------------------------------------------------------------------------
    // Metadata getters
    //--------------------------------------------------------------------------

    /**
     * @returns {string} Display name of the model
     */
    getModelLabel() {
        return this._modelLabel;
    }

    /**
     * @returns {Object} List of fields
     */
    getFields() {
        return this.metaData.fields;
    }

    /**
     * @param {string} field Field name
     * @returns {Object | undefined} Field
     */
    getField(field) {
        return this.metaData.fields[field];
    }

    //--------------------------------------------------------------------------
    // Cell missing
    //--------------------------------------------------------------------------

    /**
     * Reset the used values and headers
     */
    clearUsedValues() {
        this._usedHeaderDomains.clear();
        this._usedValueDomains.clear();
    }

    /**
     * Check if the given domain with the given measure has been used
     */
    isUsedValue(domain, measure) {
        const tag = [measure, ...domain];
        return this._usedValueDomains.has(tag.join());
    }

    /**
     * Check if the given domain has been used
     */
    isUsedHeader(domain) {
        return this._usedHeaderDomains.has(domain.join());
    }

    /**
     * Indicate that the given domain has been used with the given measure
     */
    markAsValueUsed(domain, measure) {
        const toTag = [measure, ...domain];
        this._usedValueDomains.add(toTag.join());
    }

    /**
     * Indicate that the given domain has been used
     */
    markAsHeaderUsed(domain) {
        this._usedHeaderDomains.add(domain.join());
    }

    //--------------------------------------------------------------------------
    // Template
    //--------------------------------------------------------------------------

    /**
     * Get the possible values for the given groupBy
     */
    getPossibleValuesForGroupBy(groupBy) {
        return this._fieldsValue[groupBy];
    }

    /**
     * This method is used to compute the possible values for each group bys.
     * It should be run before using templates
     */
     async prepareForTemplateGeneration() {
        const colValues = [];
        const rowValues = [];

        function collectValues(tree, collector) {
            const group = tree.root;
            if (!tree.directSubTrees.size) {
                //It's a leaf, we can fill the cols
                collector.push([...group.values]);
            }
            [...tree.directSubTrees.values()].forEach((subTree) => {
                collectValues(subTree, collector);
            });
        }

        collectValues(this.data.colGroupTree, colValues);
        collectValues(this.data.rowGroupTree, rowValues);

        for (let i = 0; i < this.metaData.fullRowGroupBys.length; i++) {
            let vals = [...new Set(rowValues.map((array) => array[i]))];
            if (i !== 0) {
                vals = await this._orderValues(vals, this.metaData.fullRowGroupBys[i]);
            }
            this._fieldsValue[this.metaData.fullRowGroupBys[i]] = vals;
        }
        for (let i = 0; i < this.metaData.fullColGroupBys.length; i++) {
            let vals;
            if (i !== 0) {
                vals = await this._orderValues(vals, this.metaData.fullColGroupBys[i]);
            } else {
                vals = colValues.map((array) => array[i]);
                vals = [...new Set(vals)];
            }
            this._fieldsValue[this.metaData.fullColGroupBys[i]] = vals;
        }
    }

    /**
     * Order the given values for the given groupBy. This is done by executing a
     * search_read
     */
    async _orderValues(values, groupBy) {
        const field = this._getFieldOfGroupBy(groupBy);
        const model = this.metaData.resModel;
        const context = this.searchParams.context;
        const baseDomain = this.searchParams.domain;
        const requestField = field.relation ? "id" : field.name;
        const domain = Domain.and([field.relation ? []: baseDomain, [[requestField, "in", values]]]).toList();
        // orderby is omitted for relational fields on purpose to have the default order of the model
        const records = await this.orm.searchRead(
            field.relation ? field.relation : model,
            domain,
            [requestField],
            { order: field.relation ? undefined : [{ name: field.name, asc: true }] },
            { ...context, active_test: false }
        )
        return [...new Set(records.map((record) => record[requestField].toString()))];
    }

    //--------------------------------------------------------------------------
    // Autofill
    //--------------------------------------------------------------------------

    /**
     * @param {string} dimension COLUMN | ROW
     */
     isGroupedOnlyByOneDate(dimension) {
        const groupBys =
            dimension === "COLUMN" ? this.metaData.fullColGroupBys : this.metaData.fullRowGroupBys;
        return groupBys.length === 1 && this._isDateField(groupBys[0].split(":")[0]);
    }
    /**
     * @param {string} dimension COLUMN | ROW
     */
    getGroupOfFirstDate(dimension) {
        if (!this.isGroupedOnlyByOneDate(dimension)) {
            return undefined;
        }
        const groupBys =
            dimension === "COLUMN" ? this.metaData.fullColGroupBys : this.metaData.fullRowGroupBys;
        return groupBys[0].split(":")[1] || "month";
    }

    /**
     * @param {string} dimension COLUMN | ROW
     * @param {number} index
     */
    getGroupByAtIndex(dimension, index) {
        const groupBys =
            dimension === "COLUMN" ? this.metaData.fullColGroupBys : this.metaData.fullRowGroupBys;
        return groupBys[index];
    }

    getNumberOfColGroupBys() {
        return this.metaData.fullColGroupBys.length;
    }

    //--------------------------------------------------------------------------
    // Evaluation
    //--------------------------------------------------------------------------

    /**
     * Get the value of the given domain for the given measure
     */
    getPivotCellValue(measure, domain) {
        const { cols, rows } = this._getColsRowsValuesFromDomain(domain);
        const group = JSON.stringify([rows, cols]);
        const values = this.data.measurements[group];
        return (values && values[0][measure]) || "";
    }

    /**
     * Get the label the given field-value
     */
    getPivotHeaderValue(field, value) {
        if (field === "measure") {
            if (value === "__count") {
                return _t("Count");
            }
            const fieldDesc = this._getFieldOfGroupBy(value);
            return fieldDesc ? fieldDesc.string : value;
        }
        const undef = _t("(Undefined)");
        const fieldDesc = this._getFieldOfGroupBy(field);
        if (!fieldDesc) {
            return undef;
        }
        if (this._isDateField(field.split(":")[0])) {
            return formatDate(field, value);
        }
        if (fieldDesc.relation) {
            if (value === "false") {
                return undef;
            }
            const label = this.metadataRepository.getRecordDisplayName(fieldDesc.relation, toNumber(value));
            if (label === undefined) {
                return undef;
            }
            return label;
        }
        const label = this.metadataRepository.getLabel(this.metaData.resModel, field.split(":")[0], value);
        if (label === undefined) {
            return undef;
        }
        return label;
    }

    //--------------------------------------------------------------------------
    // Misc
    //--------------------------------------------------------------------------

    /**
     * Get the Odoo domain corresponding to the given domain
     */
    getPivotCellDomain(domain) {
        const { cols, rows } = this._getColsRowsValuesFromDomain(domain);
        const key = JSON.stringify([rows, cols]);
        const domains = this.data.groupDomains[key];
        return domains ? domains[0] : Domain.FALSE.toList();
    }

    /**
     * @returns {SpreadsheetPivotTable}
     */
    getTableStructure() {
        const cols = this._getSpreadsheetCols();
        const rows = this._getSpreadsheetRows(this.data.rowGroupTree);
        rows.push(rows.shift()); //Put the Total row at the end.
        const measures = this.metaData.activeMeasures;
        return new SpreadsheetPivotTable(cols, rows, measures);
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    async _loadData(config, prune = true) {
        await super._loadData(config, prune);

        const metadataRepository = this.metadataRepository;
        const _getFieldOfGroupBy = this._getFieldOfGroupBy.bind(this);

        function registerLabels(tree, groupBys) {
            const group = tree.root;
            if (!tree.directSubTrees.size) {
                for (let i = 0; i < group.values.length; i++) {
                    const field = _getFieldOfGroupBy(groupBys[i]);
                    if (field.relation) {
                        metadataRepository.addRecordDisplayName(field.relation, group.values[i], group.labels[i]);
                    } else {
                        metadataRepository.registerLabel(config.metaData.resModel, field.name, group.values[i], group.labels[i]);
                    }
                }
            }
            [...tree.directSubTrees.values()].forEach((subTree) => {
                registerLabels(subTree, groupBys);
            });
        }

        registerLabels(this.data.colGroupTree, this.metaData.fullColGroupBys);
        registerLabels(this.data.rowGroupTree, this.metaData.fullRowGroupBys);
    }

    /**
     * Determines if the given field is a date or datetime field.
     *
     * @param {string} fieldName Technical name of the field
     * @private
     * @returns {boolean} True if the type of the field is date or datetime
     */
     _isDateField(fieldName) {
        const field = this.metaData.fields[fieldName];
        return field && ["date", "datetime"].includes(field.type);
    }

    /**
     * Get the field corresponding to the given group by
     */
    _getFieldOfGroupBy(groupBy) {
        const fieldName = groupBy.split(":")[0];
        return this.metaData.fields[fieldName];
    }

    /**
     * Add the default group (month) to the given group by, if it's a date
     */
    _addDefaultDateGroup(groupBy) {
        let [fieldName, group] = groupBy.split(":");
        if (this._isDateField(fieldName)) {
            if (!group) {
                group = "month";
            }
            return `${fieldName}:${group}`;
        }
        return fieldName;
    }

    /**
     * @override
     */
    _getGroupValues(group, groupBys) {
        return groupBys.map((groupBy) => {
            return this._sanitizeValue(group[groupBy], groupBy);
        });
    }

    /**
     * @override
     */
    _sanitizeValue(value, groupBy) {
        const [fieldName, group] = groupBy.split(":");
        if (this._isDateField(fieldName)) {
            const fIn = formats[group]["in"];
            const fOut = formats[group]["out"];
            // eslint-disable-next-line no-undef
            const date = moment(value, fIn);
            return date.isValid() ? date.format(fOut) : false;
        }
        return super._sanitizeValue(value);
    }

    /**
     * Check if the given field is used as col group by
     */
    _isCol(field) {
        const fieldName = field.split(":")[0];
        return this.metaData.fullColGroupBys.map((x) => x.split(":")[0]).includes(fieldName);
    }

    /**
     * Check if the given field is used as row group by
     */
    _isRow(field) {
        const fieldName = field.split(":")[0];
        return this.metaData.fullRowGroupBys.map((x) => x.split(":")[0]).includes(fieldName);
    }

    /**
     * Transform the given domain in the structure used in this class
     */
    _getColsRowsValuesFromDomain(domain) {
        const rows = [];
        const cols = [];
        let i = 0;
        while (i < domain.length) {
            const field = toString(domain[i]);
            const fieldDesc = this._getFieldOfGroupBy(field);
            let value;
            switch (fieldDesc.type) {
                case "date":
                case "datetime":
                case "char":
                    value = toString(domain[i + 1]);
                    break;
                case "boolean":
                    value = toBoolean(domain[i + 1]);
                    break;
                default:
                    if (domain[i + 1] === "false") {
                        value = false;
                    } else {
                        value = toNumber(domain[i + 1]);
                    }
            }
            if (this._isCol(field)) {
                cols.push(value);
            } else if (this._isRow(field)) {
                rows.push(value);
            }
            i += 2;
        }
        return { rows, cols };
    }

    /**
     * Get the row structure
     */
    _getSpreadsheetRows(tree) {
        let rows = [];
        const group = tree.root;
        const indent = group.labels.length;
        const rowGroupBys = this.metaData.fullRowGroupBys;

        rows.push({
            fields: rowGroupBys.slice(0, indent),
            values: [...group.values],
            indent,
        });

        const subTreeKeys = tree.sortedKeys || [...tree.directSubTrees.keys()];
        subTreeKeys.forEach((subTreeKey) => {
            const subTree = tree.directSubTrees.get(subTreeKey);
            rows = rows.concat(this._getSpreadsheetRows(subTree));
        });
        return rows;
    }

    /**
     * Get the col structure
     */
    _getSpreadsheetCols() {
        const colGroupBys = this.metaData.fullColGroupBys;
        const height = colGroupBys.length;
        const measureCount = this.metaData.activeMeasures.length;
        const leafCounts = this._getLeafCounts(this.data.colGroupTree);

        const headers = new Array(height).fill(0).map(() => []);

        function generateTreeHeaders(tree, fields) {
            const group = tree.root;
            const rowIndex = group.values.length;
            if (rowIndex !== 0) {
                const row = headers[rowIndex - 1];
                const leafCount = leafCounts[JSON.stringify(tree.root.values)];
                const cell = {
                    fields: colGroupBys.slice(0, rowIndex),
                    values: [...group.values],
                    width: leafCount * measureCount,
                };
                row.push(cell);
            }

            [...tree.directSubTrees.values()].forEach((subTree) => {
                generateTreeHeaders(subTree, fields);
            });
        }

        generateTreeHeaders(this.data.colGroupTree, this.metaData.fields);
        const hasColGroupBys = this.metaData.colGroupBys.length;

        // 2) generate measures row
        const measureRow = [];

        if (hasColGroupBys) {
            headers[headers.length - 1].forEach((cell) => {
                this.metaData.activeMeasures.forEach((measureName) => {
                    const measureCell = {
                        fields: [...cell.fields, "measure"],
                        values: [...cell.values, measureName],
                        width: 1,
                    };
                    measureRow.push(measureCell);
                });
            });
        }
        this.metaData.activeMeasures.forEach((measureName) => {
            const measureCell = {
                fields: ["measure"],
                values: [measureName],
                width: 1,
            };
            measureRow.push(measureCell);
        });
        headers.push(measureRow);
        // 3) Add the total cell
        if (headers.length === 1) {
            headers.unshift([]); // Will add the total there
        }
        headers[headers.length - 2].push({
            fields: [],
            values: [],
            width: this.metaData.activeMeasures.length,
        });

        return headers;
    }
}
