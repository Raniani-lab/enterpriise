/** @odoo-module */

import { Component } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { memoize } from "@web/core/utils/functions";
import { Property } from "@web_studio/client_action/view_editor/property/property";
import { getWowlFieldWidgets } from "@web_studio/client_action/view_editor/editors/utils";
import { EDITABLE_ATTRIBUTES, FIELD_TYPE_ATTRIBUTES } from "./field_type_properties";
import { useService } from "@web/core/utils/hooks";

export class TypeWidgetProperties extends Component {
    static template =
        "web_studio.ViewEditor.InteractiveEditorProperties.Field.TypeWidgetProperties";
    static components = { Property };
    static props = {
        node: { type: Object },
        onChangeAttribute: { type: Function },
    };

    setup() {
        this._getAvailableFields = memoize(() => {
            const fields = this.env.viewEditorModel.fields;
            const fieldNodes = this.env.viewEditorModel.controllerProps.archInfo.fieldNodes;
            return Object.values(fieldNodes).map((fNode) => {
                const fName = fNode.name;
                const field = fields[fName];
                field.name = field.name || fName;
                return field;
            });
        });
        this.rpc = useService("rpc");
    }

    get attributesOfTypeSelection() {
        return this.getWidgetAttributes("selection");
    }

    get attributesOfTypeField() {
        const fieldAttributes = this.getWidgetAttributes("field");
        if (fieldAttributes.length) {
            const fields = this._getAvailableFields();
            fieldAttributes.forEach((attribute) => {
                attribute.choices = this.getFieldChoices(attribute, fields);
            });
            return fieldAttributes;
        }
        return [];
    }

    get attributesOfTypeBoolean() {
        return this.getWidgetAttributes("boolean");
    }

    get attributesOfTypeDomain() {
        return this.getWidgetAttributes("domain");
    }

    get attributesOfTypeString() {
        return this.getWidgetAttributes("string");
    }

    get supportedOptions() {
        const widgetName = this.props.node.attrs?.widget || this.props.node.field.type;
        const fieldRegistry = registry.category("fields").content;
        const widgetDescription =
            fieldRegistry[this.env.viewEditorModel.viewType + "." + widgetName] ||
            fieldRegistry[widgetName];
        return widgetDescription?.[1].supportedOptions || [];
    }

    /**
     * @returns the list of available widgets for the current node
     */
    get widgetChoices() {
        const widgets = getWowlFieldWidgets(
            this.props.node.field.type,
            this.props.node.attrs.widget,
            [],
            this.env.debug
        );
        return {
            choices: widgets.map(([value, label]) => {
                label = label ? label : "";
                return {
                    label: `${label} (${value})`.trim(),
                    value,
                };
            }),
        };
    }

    /**
     * @returns the list of attributes available depending the type of field,
     * as well the current widget selected
     */
    get _attributesForCurrentTypeAndWidget() {
        const node = this.props.node;
        const fieldType = node.field.type;
        const { viewType } = this.env.viewEditorModel;

        const fieldCommonViewsProperties = FIELD_TYPE_ATTRIBUTES[fieldType]?.common || [];
        const fieldSpecificViewProperties = FIELD_TYPE_ATTRIBUTES[fieldType]?.[viewType] || [];

        return [
            ...fieldCommonViewsProperties,
            ...fieldSpecificViewProperties,
            ...this.supportedOptions,
        ];
    }

    /**
     * @param {string} type of the attribute (eg. "string", "boolean" )
     * @returns only the given type of attributes for the current field node
     */
    getWidgetAttributes(type) {
        return this._attributesForCurrentTypeAndWidget
            .filter((attribute) => attribute.type === type)
            .map((attribute) => {
                if (EDITABLE_ATTRIBUTES[attribute.name]) {
                    return this.getPropertyFromAttributes(attribute);
                }
                return this.getPropertyFromOptions(attribute);
            });
    }

    getFieldChoices(attribute, fields) {
        if (attribute.availableTypes) {
            let availableFields = fields.filter((f) => attribute.availableTypes.includes(f.type));
            if (attribute.name === "currency_field") {
                if (this.props.node.field.type === "monetary") {
                    const fields = this.env.viewEditorModel.fields;
                    availableFields = Object.values(fields);
                }
                availableFields = availableFields.filter((f) => f.relation === "res.currency");
            }
            return availableFields.map((f) => {
                return {
                    label: this.env.debug ? `${f.string} (${f.name})` : f.string,
                    value: f.name,
                };
            });
        }
        return fields;
    }

    /**
     * Compute the property and its value from one or more attributes on the node
     */
    getPropertyFromAttributes(property) {
        let value;
        value = this.props.node.attrs[property.name];
        if (property.getValue) {
            const attrs = this.props.node.attrs || {};
            const field = this.props.node.field || {};
            value = property.getValue({ attrs, field });
        }
        if (value === undefined && property.default) {
            value = property.default;
        }
        return {
            ...property,
            value,
        };
    }

    /**
     * Compute the property and its value from the `options` attribute on the node
     */
    getPropertyFromOptions(property) {
        let value;
        value = this.props.node.attrs.options?.[property.name];
        if (property.type === "string") {
            value = JSON.stringify(value);
        }
        if (value === undefined && property.default) {
            value = property.default;
        }
        if (property.name === "currency_field" && !value) {
            value = this.props.node.field.currency_field;
        }
        return {
            ...property,
            value,
        };
    }

    getSelectValue(value) {
        return typeof value === "object" ? JSON.stringify(value) : value;
    }

    async onChangeCurrency(value) {
        const proms = [];
        proms.push(
            this.rpc("/web_studio/set_currency", {
                model_name: this.env.viewEditorModel.resModel,
                field_name: this.props.node.field.name,
                value,
            })
        );
        this.env.viewEditorModel.fields[this.props.node.field.name]["currency_field"] = value;

        if (this.env.viewEditorModel.fieldsInArch.includes(value)) {
            // is the new currency in the view ?
            await Promise.all(proms).then((results) => {
                if (results[0] === true) {
                    this.env.viewEditorModel.fields[this.props.node.field.name]["currency_field"] =
                        value;
                }
            });
            return;
        }

        const currencyNode = {
            tag: "field",
            attrs: { name: value },
        };

        const operation = {
            node: currencyNode,
            target: this.env.viewEditorModel.getFullTarget(
                this.env.viewEditorModel.activeNodeXpath
            ),
            position: "after",
            type: "add",
        };

        proms.push(this.env.viewEditorModel.doOperation(operation));
        await Promise.all(proms).then((results) => {
            if (results[0] === true) {
                this.env.viewEditorModel.fields[this.props.node.field.name]["currency_field"] =
                    value;
            }
        });
    }

    onChangeWidget(value) {
        return this.props.onChangeAttribute(value, "widget");
    }

    async onChangeProperty(value, name) {
        const currentProperty = this._attributesForCurrentTypeAndWidget.find(
            (e) => e.name === name
        );
        if (name === "currency_field" && this.props.node.field.type === "monetary") {
            await this.onChangeCurrency(value);
            if (!this.props.node.attrs.options?.[name]) {
                return;
            }
            value = ""; // the currency_field arch option will be deleted
        }
        if (EDITABLE_ATTRIBUTES[name]) {
            return this.props.onChangeAttribute(value, name);
        }
        const options = { ...this.props.node.attrs.options };
        if (value || currentProperty.type === "boolean") {
            if (["[", "{"].includes(value[0]) || !isNaN(value)) {
                options[name] = JSON.parse(value);
            } else {
                options[name] = value;
            }
        } else {
            delete options[name];
        }
        this.props.onChangeAttribute(JSON.stringify(options), "options");
    }
}
