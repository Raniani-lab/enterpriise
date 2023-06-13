/** @odoo-module */

import { registry } from "@web/core/registry";
import { standardFieldProps } from "@web/views/fields/standard_field_props";
import { useEmojiPicker } from "@web/core/emoji_picker/emoji_picker";

import { Component, useRef } from "@odoo/owl";

export default class KnowledgeIcon extends Component {
    static template = "knowledge.KnowledgeIcon";
    static props = {
        record: Object,
        readonly: Boolean,
        iconClasses: {type: String, optional: true},
    };

    setup() {
        super.setup();
        this.iconRef = useRef("icon");
        this.emojiPicker = useEmojiPicker(this.iconRef, { hasRemoveFeature: true, onSelect: this.updateIcon.bind(this) });
    }

    get icon() {
        return this.props.record.data.icon;
    }

    updateIcon(icon) {
        this.props.record.update({icon});
    }
}

class KnowledgeIconField extends KnowledgeIcon {
    static props = standardFieldProps;
}

registry.category("fields").add("knowledge_icon", {
    component: KnowledgeIconField,
});
