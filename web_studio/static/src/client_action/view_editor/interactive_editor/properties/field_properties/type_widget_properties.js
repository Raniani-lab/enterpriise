/** @odoo-module */

import { Component } from "@odoo/owl";
import { Property } from "@web_studio/client_action/view_editor/property/property";
import { FIELD_PROPERTIES } from "./field_properties_data";
import { _lt } from "@web/core/l10n/translation";
import { getWowlFieldWidgets } from "@web_studio/client_action/view_editor/editors/utils";

const imageSizes = {
    small: { label: _lt("Small"), value: [0, 90] },
    medium: { label: _lt("Medium"), value: [0, 180] },
    large: { label: _lt("Large"), value: [0, 270] },
};

const FIELD_TYPE_PROPERTIES = {
    many2many: {
        common: [FIELD_PROPERTIES.no_create, FIELD_PROPERTIES.domain, FIELD_PROPERTIES.context],
    },
    many2one: {
        common: [
            FIELD_PROPERTIES.no_create,
            FIELD_PROPERTIES.no_open,
            FIELD_PROPERTIES.domain,
            FIELD_PROPERTIES.context,
        ],
    },
    monetary: {
        list: [FIELD_PROPERTIES.aggregate],
    },
    integer: {
        list: [FIELD_PROPERTIES.aggregate],
    },
};

// By default, any widget inherit the properties of its field type
const FIELD_WIDGET_PROPERTIES = {
    boolean_icon: {
        common: [
            {
                name: "icon",
                string: _lt("Icon"),
                type: "string",
            },
        ],
    },
    product_configurator: {
        common: [FIELD_PROPERTIES.no_create, FIELD_PROPERTIES.no_open],
    },
    many2many_tags: {
        common: [
            {
                name: "color_field",
                string: _lt("Use colors"),
                type: "boolean",
            },
        ],
    },
    radio: {
        common: [
            {
                name: "horizontal",
                string: _lt("Display horizontally"),
                type: "boolean",
            },
        ],
    },
    signature: {
        common: [
            {
                name: "full_name",
                string: _lt("Auto-complete with"),
                type: "selection",
            },
        ],
    },
    daterange: {
        common: [
            {
                name: "related_start_date",
                string: _lt("Related Start Date"),
                type: "selection",
            },
            {
                name: "related_end_date",
                string: _lt("Related End Date"),
                type: "selection",
            },
        ],
    },
    phone: {
        common: [
            {
                name: "enable_sms",
                string: _lt("Enable SMS"),
                type: "boolean",
                getValue(node) {
                    const attrs = node.attrs;
                    return attrs.options && "enable_sms" in attrs.options
                        ? attrs.options.enable_sms
                        : true;
                },
            },
        ],
    },
    image: {
        common: [
            {
                name: "size",
                string: _lt("Size"),
                type: "selection",
                getChoices() {
                    return Object.values(imageSizes);
                },
                getValue(node) {
                    const size = node.attrs.options?.size;
                    if (size) {
                        const stringSize = JSON.stringify(size);
                        const choice = Object.entries(imageSizes).find(([s, def]) => {
                            return JSON.stringify(def.value) === stringSize;
                        });
                        return choice ? choice[1].value : "";
                    }
                },
            },
        ],
    },
};

export class TypeWidgetProperties extends Component {
    static template =
        "web_studio.ViewEditor.InteractiveEditorProperties.Field.TypeWidgetProperties";
    static components = { Property };
    static props = {
        node: { type: Object },
        onChangeAttribute: { type: Function },
    };

    get attributesOfTypeSelection() {
        return this.getWidgetAttributes("selection");
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
        const widget = node.attrs.widget;
        const { viewType } = this.env.viewEditorModel;

        const fieldCommonViewsProperties = FIELD_TYPE_PROPERTIES[fieldType]?.common || [];
        const fieldSpecificViewProperties = FIELD_TYPE_PROPERTIES[fieldType]?.[viewType] || [];

        const widgetCommonViewsProperties = FIELD_WIDGET_PROPERTIES[widget]?.common || [];
        const widgetSpecificViewProperties = FIELD_WIDGET_PROPERTIES[widget]?.[viewType] || [];

        return [
            ...fieldCommonViewsProperties,
            ...fieldSpecificViewProperties,
            ...widgetCommonViewsProperties,
            ...widgetSpecificViewProperties,
        ];
    }

    /**
     * @param {string} type of the attribute (eg. "string", "boolean" )
     * @returns only the given type of attributes for the current field node
     */
    getWidgetAttributes(type) {
        return this._attributesForCurrentTypeAndWidget
            .filter((o) => o.type === type)
            .map((o) => this.getProperty(o));
    }

    getSelectionChoices(attribute) {
        if (attribute.name === "full_name") {
            return this.getFullNameChoices(attribute);
        } else {
            return attribute.getChoices();
        }
    }

    getProperty(attribute) {
        let value;
        if (attribute.getValue) {
            value = attribute.getValue(this.props.node);
        } else if (!attribute.isNodeAttribute) {
            value = this.props.node.attrs.options?.[attribute.name];
        } else {
            value = this.props.node.attrs[attribute.name];
        }
        return {
            ...attribute,
            value,
        };
    }

    getFullNameChoices() {
        const vem = this.env.viewEditorModel;
        const fields = vem.fields;
        return Object.entries(vem.controllerProps.archInfo.activeFields)
            .filter(([fname]) => {
                return ["char", "many2one"].includes(fields[fname].type);
            })
            .map(([fname, activeField]) => {
                const fstring = activeField.string || fields[fname].string;
                return {
                    value: fname,
                    label: odoo.debug ? `${fstring} (${fname})` : fstring,
                };
            });
    }

    onChangeWidget(value) {
        return this.props.onChangeAttribute(value, "widget");
    }

    onChangeProperty(value, name) {
        const currentProperty = this._attributesForCurrentTypeAndWidget.find(
            (e) => e.name === name
        );
        if (currentProperty.isNodeAttribute) {
            return this.props.onChangeAttribute(value, name);
        }
        const options = { ...this.props.node.attrs.options };
        if (value || currentProperty.type === "boolean") {
            options[name] = value;
        } else {
            delete options[name];
        }
        if (name === "color_field" && !value) {
            delete options.color_field;
        }
        this.props.onChangeAttribute(JSON.stringify(options), "options");
    }
}
