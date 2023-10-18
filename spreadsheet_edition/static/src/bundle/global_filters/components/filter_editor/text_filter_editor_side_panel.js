/** @odoo-module */

import { AbstractFilterEditorSidePanel } from "./filter_editor_side_panel";
import { FilterEditorFieldMatching } from "./filter_editor_field_matching";

import { useState } from "@odoo/owl";

/**
 * @typedef {import("@spreadsheet/global_filters/plugins/global_filters_core_plugin").GlobalFilter} GlobalFilter
 *
 * @typedef TextState
 * @property {string} defaultValue

 */

/**
 * This is the side panel to define/edit a global filter of type "text".
 */
export class TextFilterEditorSidePanel extends AbstractFilterEditorSidePanel {
    setup() {
        super.setup();

        this.type = "text";
        /** @type {TextState} */
        this.textState = useState({
            defaultValue: "",
        });
        this.ALLOWED_FIELD_TYPES = ["many2one", "text", "char"];
    }

    /**
     * @override
     */
    shouldDisplayFieldMatching() {
        return this.fieldMatchings.length;
    }

    /**
     * @override
     */
    get filterValues() {
        const values = super.filterValues;
        return {
            ...values,
            defaultValue: this.textState.defaultValue,
        };
    }

    /**
     * @override
     * @param {GlobalFilter} globalFilter
     */
    loadSpecificFilterValues(globalFilter) {
        this.textState.defaultValue = globalFilter.defaultValue;
    }
}

TextFilterEditorSidePanel.template = "spreadsheet_edition.TextFilterEditorSidePanel";
TextFilterEditorSidePanel.components = {
    ...AbstractFilterEditorSidePanel.components,
    FilterEditorFieldMatching,
};
