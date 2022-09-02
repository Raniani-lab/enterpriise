/** @odoo-module **/

import { registry } from "@web/core/registry";
import { standardFieldProps } from "@web/views/fields/standard_field_props";

const { Component } = owl;

export class PopulatedFieldsWidget extends Component {
    getTooltipInfo() {
        return JSON.stringify({
            'populated_fields': this.props.value,
        });
    }
}

PopulatedFieldsWidget.template = "account_invoice_extract.PopulatedFieldsWidget";
PopulatedFieldsWidget.props = {
    ...standardFieldProps,
};

registry.category("fields").add("populated_fields_tooltip", PopulatedFieldsWidget);
