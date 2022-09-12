/** @odoo-module **/

import { patchRecordMethods } from '@mail/model/model_core';
// ensure that the model definition is loaded before the patch
import '@mail/models/emoji_view';

/**
 * Overrides click on emoji view so it's handled in the context of a knowledge article.
 * Useful to determine the resulting state of a click on an emoji in this context.
 */
patchRecordMethods('EmojiView', {
    /**
     * @override
     * @param {MouseEvent} ev
     */
    onClick(ev) {
        if (!this.emojiGridItemViewOwner.emojiGridRowViewOwner) {
            return;
        }
        if (this.emojiGridItemViewOwner.emojiGridRowViewOwner.emojiGridViewOwner.emojiPickerViewOwner.popoverViewOwner.knowledgeOwnerAsEmojiPicker) {
            this.emojiGridItemViewOwner.emojiGridRowViewOwner.emojiGridViewOwner.emojiPickerViewOwner.popoverViewOwner.knowledgeOwnerAsEmojiPicker.onClickEmoji(this);
            return;
        }
        return this._super(ev);
    },
});
