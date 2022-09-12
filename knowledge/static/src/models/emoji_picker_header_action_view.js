/** @odoo-module **/

import { addFields, patchFields } from '@mail/model/model_core';
import { one } from '@mail/model/model_field';
import { clear } from '@mail/model/model_field_command';
// ensure that the model definition is loaded before the patch
import '@mail/models/emoji_picker_header_action_view';

/**
 * Registers the remove action button as uniquely defined action in the emoji picker.
 */
addFields('EmojiPickerHeaderActionView', {
    ownerAsRemove: one('EmojiPickerHeaderActionListView', {
        identifying: true,
        inverse: 'removeActionView',
    }),
    removeActionView: one('KnowledgeEmojiPickerRemoveActionView', {
        compute() {
            if (this.ownerAsRemove) {
                return {};
            }
            return clear();
        },
        inverse: 'owner',
    }),
});

/**
 * Sets content and component to be used for the "remove" action in emoji picker.
 */
patchFields('EmojiPickerHeaderActionView', {
    content: {
        compute() {
            if (this.removeActionView) {
                return this.removeActionView;
            }
            return this._super();
        },
    },
    contentComponentName: {
        compute() {
            if (this.removeActionView) {
                return 'KnowledgeEmojiPickerRemoveActionView';
            }
            return this._super();
        },
    },
    owner: {
        compute() {
            if (this.ownerAsRemove) {
                return this.ownerAsRemove;
            }
            return this._super();
        },
    },
});
