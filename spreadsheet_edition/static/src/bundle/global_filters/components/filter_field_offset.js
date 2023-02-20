/** @odoo-module */

import { Component } from "@odoo/owl";
import { _t, _lt } from "@web/core/l10n/translation";

const FIELD_OFFSETS = [
    { value: 0, description: "" },
    { value: -1, description: _lt("Previous") },
    { value: -2, description: _lt("Before previous") },
    { value: 1, description: _lt("Next") },
    { value: 2, description: _lt("After next") },
];

export class FilterFieldOffset extends Component {
    setup() {
        this.fieldsOffsets = FIELD_OFFSETS;
    }

    /**
     * @param {Event & { target: HTMLSelectElement }} ev
     */
    onOffsetSelected(ev) {
        this.props.onOffsetSelected(parseInt(ev.target.value));
    }

    get title() {
        return this.props.active
            ? _t("Period offset applied to this source")
            : _t("Requires a selected field");
    }
}

FilterFieldOffset.template = "spreadsheet_edition.FilterFieldOffset";
FilterFieldOffset.props = {
    onOffsetSelected: Function,
    selectedOffset: Number,
    active: Boolean,
};
