/** @odoo-module **/

import { addFields } from '@mail/model/model_core';
import { one } from '@mail/model/model_field';
import { clear } from '@mail/model/model_field_command';
// ensure that the model definition is loaded before the patch
import '@mail/models/emoji_picker_header_action_list_view';

/**
 * Adds an action list in emoji picker to remove icon.
 */
addFields('EmojiPickerHeaderActionListView', {
    removeActionView: one('EmojiPickerHeaderActionView', {
        compute() {
            if (!this.emojiPickerView) {
                return clear();
            }
            if (this.emojiPickerView.popoverViewOwner.knowledgeOwnerAsEmojiPicker) {
                return {};
            }
            return clear();
        },
        inverse: 'ownerAsRemove',
    }),
});
