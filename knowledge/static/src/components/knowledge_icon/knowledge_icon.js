/** @odoo-module */

import { registry } from "@web/core/registry";
import { standardFieldProps } from "@web/views/fields/standard_field_props";

import { Component, useEffect } from "@odoo/owl";

export class KnowledgeIcon extends Component {
    static template = "knowledge.KnowledgeIcon";
    static props = standardFieldProps;

    setup() {
        super.setup();
        useEffect((addIconBtn) => {
            if (addIconBtn) {
                addIconBtn.addEventListener("mousedown", this.env.addIcon);
                return () => addIconBtn.removeEventListener("mousedown", this.env.addIcon);
            }
        }, () => [document.querySelector(".o_knowledge_add_icon")]);
    }
}

registry.category("fields").add("knowledge_icon", {
    component: KnowledgeIcon,
});
