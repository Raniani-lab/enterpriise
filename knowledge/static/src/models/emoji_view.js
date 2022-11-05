/** @odoo-module **/

import { Patch } from '@mail/model';

Patch({
    name: 'EmojiView',
    recordMethods: {
        /**
         * Overrides click on emoji view so it's handled in the context of a
         * knowledge article. Useful to determine the resulting state of a click
         * on an emoji in this context.
         *
         * @override
         */
        onClick(ev) {
            if (!this.emojiGridRowViewOwner) {
                return;
            }
            if (this.emojiPickerViewOwner.popoverViewOwner.knowledgeOwnerAsEmojiPicker) {
                this.emojiPickerViewOwner.popoverViewOwner.knowledgeOwnerAsEmojiPicker.onClickEmoji(this);
                return;
            }
            return this._super(ev);
        },
    },
});
