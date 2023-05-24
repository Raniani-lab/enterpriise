/** @odoo-module */

import { Component } from "@odoo/owl";
import { Property } from "@web_studio/client_action/view_editor/property/property";

export class ModifiersProperties extends Component {
    static template = "web_studio.ViewEditor.InteractiveEditorProperties.Modifiers";
    static components = { Property };
    static props = {
        node: { type: Object },
        availableOptions: { type: Array },
    };

    /**
     * @param {string} name of the attribute
     * @returns if this attribute supported in the current view
     */
    isAttributeSupported(name) {
        return this.props.availableOptions?.includes(name);
    }

    // <tag invisible="BOOL"  />
    // <tag attrs="{ 'invisble': DOMAIN }" />
    onChangeModifier(value, name) {
        const isBoolean = typeof value === "boolean";
        const newAttrs = {};
        const modifiers = {
            ...(this.props.node.attrs.attrs || {}),
            ...this.props.node.attrs.modifiers,
        };

        const hadModifiers = Object.keys(modifiers).length;
        const changingInvisible = name === "invisible";
        const isInList = this.env.viewEditorModel.viewType === "list";

        if (!isBoolean) {
            newAttrs[name] = "";
            if (changingInvisible && isInList) {
                name = "column_invisible";
            }
            newAttrs.attrs = { ...modifiers, [name]: value };
        } else {
            delete modifiers[name];
            if (changingInvisible && isInList) {
                delete modifiers.invisible;
                delete modifiers.column_invisible;
            }
            newAttrs.attrs = modifiers;
            newAttrs[name] = value ? "1" : "";
        }

        // We are potentially overwriting some attrs on the node with the modifier itself
        // With this we make sure we don't send unnecessary empty attributes. We only send them
        // if we do have something to overwrite.
        if (!hadModifiers && !Object.keys(newAttrs.attrs).length) {
            delete newAttrs.attrs;
        }

        if (this.env.viewEditorModel.viewType === "form" && name === "readonly") {
            newAttrs.force_save = value ? "True" : "False";
        }

        const operation = {
            new_attrs: newAttrs,
            type: "attributes",
            position: "attributes",
            target: this.env.viewEditorModel.getFullTarget(
                this.env.viewEditorModel.activeNodeXpath
            ),
        };
        this.env.viewEditorModel.doOperation(operation);
    }
}
