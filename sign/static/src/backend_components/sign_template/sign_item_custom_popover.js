/** @odoo-module **/

import { Record } from "@web/views/record";
import {
    many2ManyTagsField,
    Many2ManyTagsField,
} from "@web/views/fields/many2many_tags/many2many_tags_field";
import { Many2OneField } from "@web/views/fields/many2one/many2one_field";

import { Component, useState } from "@odoo/owl";

const actionFieldsGet = {
    option_ids: { type: "many2many", relation: "sign.item.option", string: "Selected Options" },
    responsible_id: { type: "many2one", relation: "sign.item.role", string: "Responsible" },
};

function getActionActiveFields() {
    const activeFields = {};
    for (const fName of Object.keys(actionFieldsGet)) {
        if (actionFieldsGet[fName].type === "many2many") {
            activeFields[fName] = {
                relatedFields: Object.fromEntries(
                    many2ManyTagsField.relatedFields({ options: {} }).map((f) => [f.name, f])
                ),
            };
        } else {
            activeFields[fName] = actionFieldsGet[fName];
        }
    }
    return activeFields;
}

export class SignItemCustomPopover extends Component {
    setup() {
        this.alignmentOptions = [
            { title: this.env._t("Left"), key: "left" },
            { title: this.env._t("Center"), key: "center" },
            { title: this.env._t("Right"), key: "right" },
        ];
        this.state = useState({
            alignment: this.props.alignment,
            placeholder: this.props.placeholder,
            required: this.props.required,
            option_ids: this.props.option_ids,
            responsible: this.props.responsible,
        });
        this.signItemFieldsGet = getActionActiveFields();
        this.typesWithAlignment = new Set(["text", "textarea"]);
    }

    onChange(key, value) {
        this.state[key] = value;
    }

    parseInteger(value) {
        return parseInt(value);
    }

    onValidate() {
        this.props.onValidate(this.state);
    }

    get recordProps() {
        return {
            mode: "edit",
            resModel: "sign.item",
            resId: this.props.id,
            fieldNames: this.signItemFieldsGet,
            activeFields: this.signItemFieldsGet,
            onRecordChanged: async (record, changes) => {
                if (changes.option_ids) {
                    const ids = changes.option_ids[0][2];
                    this.state.option_ids = ids;
                    return this.props.updateSelectionOptions(ids);
                }
                if (changes.responsible_id) {
                    const id = changes.responsible_id;
                    this.state.responsible = id;
                    return this.props.updateRoles(id);
                }
            },
        };
    }

    getMany2XProps(record, fieldName) {
        return {
            name: fieldName,
            id: fieldName,
            record,
            readonly: false,
            canCreateEdit: false,
        };
    }

    get showAlignment() {
        return this.typesWithAlignment.has(this.props.type);
    }
}

SignItemCustomPopover.template = "sign.SignItemCustomPopover";
SignItemCustomPopover.components = {
    Record,
    Many2ManyTagsField,
    Many2OneField,
};
