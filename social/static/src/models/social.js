/** @odoo-module **/

import { attr, clear, one, registerModel } from '@mail/model';

/**
 * Models the state in the scope of the module 'social'.
 */
registerModel({
    name: 'Social',
    recordMethods: {
        /**
         * @param {EmojiView} emojiView
         */
        async onClickEmoji(emojiView) {
            const emoji = emojiView.emoji;
            this.messaging.messagingBus.trigger(`social_add_emoji_to_${this.textareaId}`, { emoji });
            this.update({ emojiPickerPopoverView: clear() });
        },
    },
    fields: {
        textareaId: attr(),
        emojiPickerPopoverAnchorRef: attr(),
        emojiPickerPopoverView: one('PopoverView', {
            inverse: 'socialOwnerAsEmojiPicker',
            isCausal: true,
        }),
    },
});
