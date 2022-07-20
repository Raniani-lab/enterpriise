/** @odoo-module */

import { registry } from "@web/core/registry";
import { archParseBoolean } from '@web/views/utils';
import { formatInteger } from "@web/views/fields/formatters";
import { IntegerField } from '@web/views/fields/integer/integer_field';

const { useState } = owl;

export class FsmProductQuantity extends IntegerField {
    setup() {
        super.setup(...arguments);
        this.state = useState({
            readonly: this.props.readonly,
            addSmallClass: this.props.value.toString().length > 5,
        });

    get formattedValue() {
        if (!this.state.readonly && this.props.inputType === "number") {
            return this.props.value;
        }
        return formatInteger(this.props.value);
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
        this.props.update(this.props.value - 1);
    }

    addQuantity() {
        this.props.update(this.props.value + 1);
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
    ...IntegerField.props,
    hideButtons: { type: Boolean, optional: true }
};
FsmProductQuantity.defaultProps = {
    ...IntegerField.defaultProps,
    hideButtons: false,
};

FsmProductQuantity.template = 'industry_fsm_sale.FsmProductQuantity';
FsmProductQuantity.extractProps = (props) => {
    return {
        ...IntegerField.extractProps(props),
        hideButtons: archParseBoolean(props.attrs.hide_buttons),
    };
};

registry.category('fields').add('fsm_product_quantity', FsmProductQuantity);
