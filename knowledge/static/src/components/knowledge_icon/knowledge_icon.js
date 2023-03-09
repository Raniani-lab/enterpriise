/** @odoo-module */

import { registry } from "@web/core/registry";
import { standardFieldProps } from "@web/views/fields/standard_field_props";

import { Component } from "@odoo/owl";

class KnowledgeIcon extends Component {
    static template = "knowledge.KnowledgeIcon";
    static props = standardFieldProps;
}

registry.category("fields").add("knowledge_icon", {
    component: KnowledgeIcon,
});
