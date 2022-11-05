/** @odoo-module **/

import { clear, one, registerPatch } from '@mail/model';

registerPatch({
    name: 'EmojiPickerView',
    fields: {
        /**
         * Adds an action list in emoji picker to remove icon.
         */
        removeActionView: one('EmojiPickerHeaderActionView', {
            compute() {
                if (this.popoverViewOwner.knowledgeOwnerAsEmojiPicker) {
                    return {};
                }
                return clear();
            },
            inverse: 'ownerAsRemove',
        }),
    },
});
