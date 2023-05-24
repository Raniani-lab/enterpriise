/** @odoo-module */

import { Component } from "@odoo/owl";
import { CheckBox } from "@web/core/checkbox/checkbox";
import { DomainSelectorDialog } from "@web/core/domain_selector_dialog/domain_selector_dialog";
import { SelectMenu } from "@web/core/select_menu/select_menu";
import { useService } from "@web/core/utils/hooks";

export class Property extends Component {
    static template = "web_studio.Property";
    static components = { CheckBox, SelectMenu, DomainSelectorDialog };
    static defaultProps = {
        childProps: {},
        class: "",
    };
    static props = {
        isConditional: { type: Boolean, optional: true },
        name: { type: String },
        type: { type: String },
        value: { optional: true },
        onChange: { type: Function, optional: true },
        childProps: { type: Object, optional: true },
        class: { type: String, optional: true },
        isReadonly: { type: Boolean, optional: true },
        slots: {
            type: Object,
            optional: true,
        },
        tooltip: { type: String, optional: true },
    };

    setup() {
        this.dialog = useService("dialog");
    }

    get className() {
        const propsClass = this.props.class ? this.props.class : "";
        return `o_web_studio_property_${this.props.name} ${propsClass}`;
    }

    getCheckboxClassname(value) {
        if (this.props.isConditional && !!value && !(typeof value === "boolean")) {
            return "o_web_studio_checkbox_indeterminate";
        }
    }

    onConditionalButtonClicked() {
        const valueType = typeof this.props.value;
        let value = valueType === "boolean" || valueType === "undefined" ? [] : this.props.value;

        if (typeof value !== "string") {
            value = JSON.stringify(value);
        }

        this.dialog.add(DomainSelectorDialog, {
            resModel: this.env.viewEditorModel.resModel,
            domain: value,
            isDebugMode: !!this.env.debug,
            onConfirm: (domain) => this.props.onChange(domain, this.props.name),
        });
    }

    onDomainClicked() {
        this.dialog.add(DomainSelectorDialog, {
            resModel: this.props.childProps.relation,
            domain: this.props.value || "[]",
            isDebugMode: !!this.env.debug,
            onConfirm: (domain) => this.props.onChange(domain, this.props.name),
        });
    }

    onViewOptionChange(value) {
        this.props.onChange(value, this.props.name);
    }
}
