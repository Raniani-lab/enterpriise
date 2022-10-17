/** @odoo-module */

import { ModelFieldSelector } from "@web/core/model_field_selector/model_field_selector";
import { SpreadsheetModelFieldSelectorPopover } from "./spreadsheet_model_field_selector_popover";

/**
 * @typedef {import("@spreadsheet/data_sources/metadata_repository").Field} Field
 */
export class SpreadsheetModelFieldSelector extends ModelFieldSelector {
    /**
     * @override
     *
     * @param {string[]} fieldNameChain
     * @param {Object[]} chain
     */
    update(fieldNameChain, chain) {
        this.props.update(fieldNameChain.join("."), chain);
    }
}
SpreadsheetModelFieldSelector.components = {
    Popover: SpreadsheetModelFieldSelectorPopover,
};
