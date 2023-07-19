/** @odoo-module */

import { Component } from "@odoo/owl";
import { Record } from "@web/views/record";
import { Many2ManyTagsField } from "@web/views/fields/many2many_tags/many2many_tags_field";
import { useEditNodeAttributes } from "@web_studio/client_action/view_editor/view_editor_model";

export class LimitGroupVisibility extends Component {
    static template = "web_studio.ViewEditor.LimitGroupVisibility";
    static components = {
        Record,
        Many2ManyTagsField,
    };
    static props = {
        node: { type: Object },
    };

    setup() {
        this.editNodeAttributes = useEditNodeAttributes();
        const m2mFieldsToFetch = {
            display_name: { type: "char" },
        };
        this.recordFields = {
            groups_id: {
                type: "many2many",
                relation: "res.groups",
                string: "Groups",
                related: { activeFields: m2mFieldsToFetch, fields: m2mFieldsToFetch },
            },
        };
    }

    onChangeAttribute(value, name) {
        return this.editNodeAttributes({ [name]: value });
    }

    get groupsRecords() {
        const studioGroups = JSON.parse(this.props.node.attrs.studio_groups || "[]");
        const records = [];
        for (let i = 0; i < studioGroups.length; i++) {
            records.push({ id: studioGroups[i].id, display_name: studioGroups[i].display_name });
        }
        return records;
    }

    get recordProps() {
        return {
            fields: this.recordFields,
            values: { groups_id: this.groupsRecords },
            activeFields: this.recordFields,
            onRecordChanged: (record, changes) => {
                const newIds = changes.groups_id[0][2];
                this.onChangeAttribute(newIds, "groups");
            },
        };
    }
}
