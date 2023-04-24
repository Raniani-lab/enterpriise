/** @odoo-module */

import { registry } from "@web/core/registry";

import { useNumpadDecimal } from "@web/views/fields/numpad_decimal_hook";
import { formatInteger, formatFloat } from "@web/views/fields/formatters";
import { parseInteger, parseFloat } from "@web/views/fields/parsers";
import { useInputHook } from "@web_grid/hooks/input_hook";

import { Component, useEffect, useRef, useState } from "@odoo/owl";
import { useGridCell, useMagnifierGlass } from "@web_grid/hooks/grid_cell_hook";

export const standardGridCellProps = {
    fieldInfo: Object,
    readonly: { type: Boolean, optional: true },
    editMode: { type: Boolean, optional: true },
    reactive: {
        type: Object,
        shape: {
            cell: [HTMLElement, { value: null }],
        },
    },
    openRecords: Function,
    onEdit: Function,
    getCell: Function,
    onKeyDown: { type: Function, optional: true },
};

export class GridCell extends Component {
    static template = "web_grid.Cell";
    static props = standardGridCellProps;
    static defaultProps = {
        readonly: true,
        editMode: false,
    };

    setup() {
        this.rootRef = useRef("root");
        this.state = useState({
            edit: this.props.editMode,
            invalid: false,
            cell: null,
        });
        this.magnifierGlassHook = useMagnifierGlass();
        this.inputRef = useInputHook({
            getValue: () => this.formattedValue,
            refName: "numpadDecimal",
            parse: this.parse.bind(this),
            notifyChange: this.update.bind(this),
            commitChanges: this.saveEdition.bind(this),
            onKeyDown: (ev) => this.props.onKeyDown(ev, this.state.cell),
            discard: () => this.props.onEdit(false),
            setInvalid: () => {
                this.state.invalid = true;
            },
            setDirty: () => {
                this.state.invalid = false;
            },
            isInvalid: () => this.state.invalid,
        });
        useNumpadDecimal();

        useGridCell();
        useEffect(
            (edit, inputEl, cellEl) => {
                if (inputEl) {
                    inputEl.value = this.formattedValue;
                }
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
            () => [this.state.edit, this.inputRef.el, this.props.reactive.cell]
        );
    }

    get value() {
        return this.state.cell?.value || 0;
    }

    get section() {
        return this.row.getSection();
    }

    get row() {
        return this.state.cell?.row;
    }

    get formattedValue() {
        const { type, digits } = this.props.fieldInfo;
        if (type === "integer") {
            return formatInteger(this.value);
        }
        return formatFloat(this.value, { digits: digits || 2 });
    }

    isEditable(props = this.props) {
        return (
            !props.readonly &&
            this.state.cell?.readonly === false &&
            !this.state.cell.row.isSection
        );
    }

    parse(value) {
        if (this.props.fieldInfo.type === "integer") {
            return parseInteger(value);
        }
        return parseFloat(value);
    }

    update(value) {
        this.state.cell.update(value);
        this.props.onEdit(false);
    }

    saveEdition(value) {
        const changesCommitted = (value || false) !== (this.state.cell.value || false);
        if ((value || false) !== (this.state.cell?.value || false)) {
            this.update(value);
        }
        this.props.onEdit(false);
        return changesCommitted;
    }

    onCellClick() {
        if (this.isEditable() && !this.state.edit) {
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