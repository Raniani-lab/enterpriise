/* @odoo-module */

import { EmojiPicker } from "@mail/emoji_picker/emoji_picker";
import { patch } from "@web/core/utils/patch";

EmojiPicker.props.push("hasRemoveFeature?");
Object.assign(EmojiPicker.defaultProps, { hasRemoveFeature: false });

patch(EmojiPicker.prototype, "knowledge", {
    removeEmoji() {
        this.props.onSelect(false);
        this.gridRef.el.scrollTop = 0;
        this.props.close();
        this.props.onClose();
    },
});
