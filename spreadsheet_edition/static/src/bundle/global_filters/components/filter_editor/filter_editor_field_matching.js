/** @odoo-module */

import { SpreadsheetModelFieldSelector } from "../model_field_selector/spreadsheet_model_field_selector";

const { Component } = owl;

/**
 * @typedef {import("@spreadsheet/global_filters/plugins/global_filters_core_plugin").FieldMatching} FieldMatching
 * @typedef {import("@spreadsheet/data_sources/metadata_repository").Field} Field
 */

export default class FilterEditorFieldMatching extends Component {
    /**
     *
     * @param {FieldMatching} fieldMatch
     * @returns {string}
     */
    getModelField(fieldMatch) {
        if (!fieldMatch || !fieldMatch.chain) {
            return "";
        }
        return fieldMatch.chain;
    }

    /**
     * @param {{resModel:string, field: Field}[]} [fieldChain]
     * @return {Field | undefined}
     */
    extractField(fieldChain) {
        if (!fieldChain) {
            return undefined;
        }
        const candidate = [...fieldChain].reverse().find((chain) => chain.field);
        return candidate ? candidate.field : undefined;
    }
}
FilterEditorFieldMatching.template = "spreadsheet_edition.FilterEditorFieldMatching";

FilterEditorFieldMatching.components = {
    SpreadsheetModelFieldSelector,
};

FilterEditorFieldMatching.props = {
    // See AbstractFilterEditorSidePanel fieldMatchings
    fieldMatchings: Array,
    wrongFieldMatchings: Array,
    selectField: Function,
    filterModelFieldSelectorField: Function,
};
