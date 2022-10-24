/** @odoo-module **/

import { registerPatch } from '@mail/model/model_core';

registerPatch({
    name: 'EmojiView',
    recordMethods: {
        /**
         * Overrides click on emoji view so it's handled in the context of a
         * social comment. Useful to determine the resulting state of a click
         * on an emoji in this context.
         *
         * @override
         */
        onClick(ev) {
            if (!this.emojiGridItemViewOwner.emojiGridRowViewOwner) {
                return;
            }
            if (this.emojiPickerViewOwner.popoverViewOwner.socialOwnerAsEmojiPicker) {
                this.emojiPickerViewOwner.popoverViewOwner.socialOwnerAsEmojiPicker.onClickEmoji(this);
                return;
            }
            return this._super(ev);
        },
    },
});
