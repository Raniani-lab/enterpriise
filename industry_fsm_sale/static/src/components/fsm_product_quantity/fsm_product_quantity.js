/** @odoo-module */

import { registry } from "@web/core/registry";
import { useAutofocus } from "@web/core/utils/hooks";
import { archParseBoolean } from '@web/views/utils';
import { formatFloat } from "@web/core/utils/numbers";
import { FloatField, floatField } from '@web/views/fields/float/float_field';

const { useState, useRef, useEffect } = owl;

export class FsmProductQuantity extends FloatField {
    setup() {
        super.setup(...arguments);
        const refName = 'numpadDecimal';
        useAutofocus({ refName });
        this.state = useState({
            readonly: this.props.readonly,
            addSmallClass: this.props.record.data[this.props.name].toString().length > 5,
        });

        const ref = useRef(refName);
        useEffect( // remove 0 when the input is focused.
            (el) => {
                if (el) {
                    if (["INPUT", "TEXTAREA"].includes(el.tagName) && el.type === 'number') {
                        el.value = el.value === '0' ? '' : el.value;
                    }
                }
            },
            () => [ref.el]
        );
    }

    get formattedValue() {
        if (!this.state.readonly && this.props.inputType === "number") {
            return this.props.record.data[this.props.name];
        }
        return formatFloat(this.props.record.data[this.props.name], { trailingZeros: false });
    }

    toggleMode() {
        this.state.readonly = !this.state.readonly;
    }

    setReadonly(readonly) {
        if (this.state.readonly !== readonly) {
            this.toggleMode();
        }
    }

    removeQuantity() {
        this.props.record.update({
            [this.props.name]: this.props.record.data[this.props.name] > 1 ? this.props.record.data[this.props.name] - 1 : 0,
        });
    }

    addQuantity() {
        this.props.record.update({ [this.props.name]: this.props.record.data[this.props.name] + 1 });
    }

    onInput(ev) {
        this.state.addSmallClass = ev.target.value.length > 5;
    }

    /**
     * Handle the keydown event on the input
     *
     * @param {KeyboardEvent} ev
     */
    onKeyDown(ev) {
        if (ev.key === 'Enter') {
            ev.target.dispatchEvent(new Event('change'));
            ev.target.dispatchEvent(new Event('blur'));
        }
    }
}

FsmProductQuantity.props = {
    ...FloatField.props,
    hideButtons: { type: Boolean, optional: true }
};
FsmProductQuantity.defaultProps = {
    ...FloatField.defaultProps,
    hideButtons: false,
};

FsmProductQuantity.template = 'industry_fsm_sale.FsmProductQuantity';

export const fsmProductQuantity = {
    ...floatField,
    component: FsmProductQuantity,
    extractProps({ attrs }) {
        const props = floatField.extractProps(...arguments);
        props.hideButtons = archParseBoolean(attrs.hide_buttons);
        return props;
    },
};

registry.category("fields").add("fsm_product_quantity", fsmProductQuantity);
