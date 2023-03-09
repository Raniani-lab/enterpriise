/** @odoo-module */

import { registry } from "@web/core/registry";
import { formatFloatFactor } from "@web/views/fields/formatters";
import { useMagnifierGlass } from "@web_grid/hooks/grid_cell_hook";
import { standardGridCellProps } from "./grid_cell";

import { Component, useState } from "@odoo/owl";

function formatter(value, options = {}) {
    return formatFloatFactor(value, options);
}

export class FloatToggleGridCell extends Component {
    static props = {
        ...standardGridCellProps,
        factor: { type: Number, optional: true },
    };
    static template = "web_grid.FloatToggleGridCell";

    setup() {
        this.magnifierGlassHook = useMagnifierGlass(this.props);
        this.state = useState({
            edit: this.isEditable(this.props) && this.props.editMode,
            invalid: false,
        });
    }

    get factor() {
        return this.props.factor || this.props.fieldInfo.options?.factor || 1;
    }

    get range() {
        return this.props.fieldInfo.options?.range || [0.0, 0.5, 1.0];
    }

    get value() {
        return this.props.value * this.factor;
    }

    get formattedValue() {
        return formatter(this.props.value, {
            digits: this.props.fieldInfo.attrs?.digits || 2,
            factor: this.factor,
        });
    }

    isEditable(props = this.props) {
        return !props.readonly && props.cell?.readonly === false;
    }

    onChange() {
        let currentIndex = this.range.indexOf(this.value);
        currentIndex++;
        if (currentIndex > this.range.length - 1) {
            currentIndex = 0;
        }
        this.update(this.range[currentIndex] / this.factor);
    }

    update(value) {
        this.props.cell.update(value);
        this.state.edit = false;
        this.props.onEdit(false);
    }

    onCellClick() {
        if (this.isEditable()) {
            this.state.edit = true;
            this.props.onEdit(true);
        }
    }
}

export const floatToggleGridCell = {
    component: FloatToggleGridCell,
    formatter,
};

registry.category("grid_components").add("float_toggle", floatToggleGridCell);
