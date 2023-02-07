/** @odoo-module */

import { registry } from "@web/core/registry";

import { useNumpadDecimal } from "@web/views/fields/numpad_decimal_hook";
import { formatInteger, formatFloat } from "@web/views/fields/formatters";
import { parseInteger, parseFloat } from "@web/views/fields/parsers";
import { useInputHook } from "@web_grid/hooks/input_hook";

import { Component, onWillUpdateProps, useEffect, useState } from "@odoo/owl";
import { useMagnifierGlass } from "@web_grid/hooks/grid_cell_hook";

export const standardGridCellProps = {
    value: Number,
    fieldInfo: Object,
    readonly: { type: Boolean, optional: true },
    editMode: { type: Boolean, optional: true },
    cell: Object,
    openRecords: Function,
    onEdit: Function,
};

export class GridCell extends Component {
    static template = "web_grid.Cell";
    static props = standardGridCellProps;
    static defaultProps = {
        readonly: true,
        editMode: false,
    };

    setup() {
        this.state = useState({
            edit: this.isEditable(this.props) && this.props.editMode,
            invalid: false,
        });
        this.magnifierGlassHook = useMagnifierGlass(this.props);
        this.inputRef = useInputHook({
            getValue: () => this.formattedValue,
            refName: "numpadDecimal",
            parse: this.parse.bind(this),
            notifyChange: this.update.bind(this),
            commitChanges: this.saveEdition.bind(this),
            setInvalid: () => {
                this.state.invalid = true;
            },
            setDirty: () => {
                this.state.invalid = false;
            },
            isInvalid: () => this.state.invalid,
        });
        useNumpadDecimal();
        useEffect(
            (edit, inputEl) => {
                if (edit && inputEl) {
                    inputEl.focus();
                    if (inputEl.type === "text") {
                        if (inputEl.selectionStart === null) {
                            return;
                        }
                        if (inputEl.selectionStart === inputEl.selectionEnd) {
                            inputEl.selectionStart = 0;
                            inputEl.selectionEnd = inputEl.value.length;
                        }
                    }
                }
            },
            () => [this.state.edit, this.inputRef.el]
        );
        useEffect(
            (inputEl) => {
                if (inputEl) {
                    inputEl.value = this.formattedValue;
                }
            },
            () => [this.inputRef.el]
        );

        onWillUpdateProps(this.onWillUpdateProps);
    }

    onWillUpdateProps(nextProps) {
        if (!this.isEditable(nextProps)) {
            this.state.edit = false;
            this.state.editable = false;
        } else {
            if (!this.state.editable) {
                this.state.editable = true;
            }
            if (nextProps.editMode !== this.state.edit) {
                this.state.edit = nextProps.editMode;
            }
        }
    }

    get value() {
        return this.props.value;
    }

    get section() {
        return this.row.getSection();
    }

    get row() {
        return this.props.cell.row;
    }

    get formattedValue() {
        const { type, digits } = this.props.fieldInfo;
        if (type === "integer") {
            return formatInteger(this.value);
        }
        return formatFloat(this.value, { digits: digits || 2 });
    }

    isEditable(props = this.props) {
        return !props.readonly && props.cell?.readonly === false;
    }

    parse(value) {
        if (this.props.fieldInfo.type === "integer") {
            return parseInteger(value);
        }
        return parseFloat(value);
    }

    update(value) {
        this.props.cell.update(value);
        this.state.edit = false;
        this.props.onEdit(false);
    }

    saveEdition(value) {
        const changesCommitted = (value || false) !== (this.props.cell.value || false);
        if ((value || false) !== (this.props.cell.value || false)) {
            this.update(value);
        }
        this.state.edit = false;
        this.props.onEdit(false);
        return changesCommitted;
    }

    onCellClick() {
        if (this.isEditable()) {
            this.state.edit = true;
            this.props.onEdit(true);
        }
    }
}

export const integerGridCell = {
    component: GridCell,
    formatter: formatInteger,
};

registry.category("grid_components").add("integer", integerGridCell);

export const floatGridCell = {
    component: GridCell,
    formatter: formatFloat,
};

registry.category("grid_components").add("float", floatGridCell);
