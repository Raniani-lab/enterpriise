/** @odoo-module **/

import { addFields, patchRecordMethods } from '@mail/model/model_core';
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
patchRecordMethods('PopoverView', {
    /**
     * @override
     */
    _computeAnchorRef() {
        if (this.knowledgeOwnerAsEmojiPicker) {
            return this.knowledgeOwnerAsEmojiPicker.emojiPickerPopoverAnchorRef;
        }
        return this._super();
    },
    /**
     * @override
     */
    _computeEmojiPickerView() {
        if (this.knowledgeOwnerAsEmojiPicker) {
            return {};
        }
        return this._super();
    },
    /**
     * @override
     */
    _computePosition() {
        if (this.knowledgeOwnerAsEmojiPicker) {
            return 'bottom';
        }
        return this._super();
    },
});
