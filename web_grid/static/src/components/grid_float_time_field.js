/** @odoo-module */

import { registry } from "@web/core/registry";
import { formatFloatTime } from "@web/views/fields/formatters";
import { GridCell } from "./grid_cell";

function formatter(value, options = {}) {
    return formatFloatTime(value, { ...options, noLeadingZeroHour: true });
}

export class FloatTimeGridCell extends GridCell {
    get formattedValue() {
        return formatter(this.props.value);
    }
}

const floatTimeGridCell = {
    component: FloatTimeGridCell,
    formatter,
};

registry.category("grid_components").add("float_time", floatTimeGridCell);
