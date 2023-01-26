/** @odoo-module */
import { Component, useState } from "@odoo/owl";

import { _lt } from "@web/core/l10n/translation";

export class ExistingFields extends Component {
    static props = {
        fieldsInArch: { type: Array },
        fields: { type: Object },
        folded: { type: Boolean, optional: true },
    };
    static defaultProps = {
        folded: true,
    };
    static template = "web_studio.ViewStructures.ExistingFields";

    setup() {
        this.state = useState({
            folded: this.props.folded,
            searchValue: "",
        });
    }

    isMatchingSearch(field) {
        if (!this.state.searchValue) {
            return true;
        }
        const search = this.state.searchValue.toLowerCase();
        let matches = field.string.toLowerCase().includes(search);
        if (!matches && this.env.debug) {
            matches = field.name.toLowerCase().includes(search);
        }
        return matches;
    }

    get existingFields() {
        const fieldsInArch = this.props.fieldsInArch;
        const filtered = Object.entries(this.props.fields).filter(([fName, field]) => {
            if (fieldsInArch.includes(fName) || !this.isMatchingSearch(field)) {
                return false;
            }
            return true;
        });

        return filtered.map(([fName, field]) => {
            return {
                ...field,
                name: fName,
                classType: field.type,
                dropData: JSON.stringify({ fieldName: fName }),
            };
        });
    }

    getDropInfo(field) {
        return {
            structure: "field",
            fieldName: field.name,
            isNew: false,
        };
    }
}

const newFields = [
    { type: "char", string: _lt("Text") },
    { type: "text", string: _lt("Multine Text") },
    { type: "integer", string: _lt("Integer") },
    { type: "float", string: _lt("Decimal") },
    { type: "html", string: _lt("HTML") },
    { type: "monetary", string: _lt("Monetary") },
    { type: "date", string: _lt("Date") },
    { type: "datetime", string: _lt("Datetime") },
    { type: "boolean", string: _lt("CheckBox") },
    { type: "selection", string: _lt("Selection") },
    { type: "binary", string: _lt("File"), widget: "file" },
    { type: "one2many", string: _lt("Lines"), special: "lines" },
    { type: "one2many", string: _lt("One2Many") },
    { type: "many2one", string: _lt("Many2One") },
    { type: "many2many", string: _lt("Many2Many") },
    { type: "binary", string: _lt("Image"), widget: "image", name: "picture" },
    { type: "many2many", string: _lt("Tags"), widget: "many2many_tags", name: "tags" },
    { type: "selection", string: _lt("Priority"), widget: "priority" },
    { type: "binary", string: _lt("Signature"), widget: "signature" },
    { type: "related", string: _lt("Related Field") },
];

export class NewFields extends Component {
    static props = {};
    static template = "web_studio.ViewStructures.NewFields";

    get newFieldsComponents() {
        return newFields.map((f) => {
            const classType = f.special || f.name || f.widget || f.type;
            return {
                ...f,
                name: classType,
                classType,
                dropData: JSON.stringify({
                    fieldType: f.type,
                    widget: f.widget,
                    name: f.name,
                    special: f.special,
                    string: f.string,
                }),
            };
        });
    }
}
