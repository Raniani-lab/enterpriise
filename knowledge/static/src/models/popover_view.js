/** @odoo-module **/

import { addFields, patchFields } from '@mail/model/model_core';
import { one } from '@mail/model/model_field';
// ensure that the model definition is loaded before the patch
import '@mail/models/popover_view';

/**
 * Registers knowledge emoji picker as a uniquely identifiable popover view.
 */
addFields('PopoverView', {
    knowledgeOwnerAsEmojiPicker: one('Knowledge', {
        identifying: true,
        inverse: 'emojiPickerPopoverView',
    }),
});

/**
 * Determines the properties of the popover view of knowledge emoji picker in context,
 * such as anchor, content (emoji picker), and desirable position.
 */
patchFields('PopoverView', {
    anchorRef: {
        compute() {
            if (this.knowledgeOwnerAsEmojiPicker) {
                return this.knowledgeOwnerAsEmojiPicker.emojiPickerPopoverAnchorRef;
            }
            return this._super();
        },
    },
    emojiPickerView: {
        compute() {
            if (this.knowledgeOwnerAsEmojiPicker) {
                return {};
            }
            return this._super();
        },
    },
    position: {
        compute() {
            if (this.knowledgeOwnerAsEmojiPicker) {
                return 'bottom';
            }
            return this._super();
        },
    },
});
