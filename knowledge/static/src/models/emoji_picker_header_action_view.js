/** @odoo-module **/

import { clear, one, registerPatch } from '@mail/model';

registerPatch({
    name: 'EmojiPickerHeaderActionView',
    fields: {
        /**
         * Sets content to be used for the "remove" action in emoji picker.
         */
        content: {
            compute() {
                if (this.removeActionView) {
                    return this.removeActionView;
                }
                return this._super();
            },
        },
        /**
         * Sets component to be used for the "remove" action in emoji picker.
         */
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
        ownerAsRemove: one('EmojiPickerView', {
            identifying: true,
            inverse: 'removeActionView',
        }),
        /**
         * Registers the remove action button as uniquely defined action in the
         * emoji picker.
         */
        removeActionView: one('KnowledgeEmojiPickerRemoveActionView', {
            compute() {
                if (this.ownerAsRemove) {
                    return {};
                }
                return clear();
            },
            inverse: 'owner',
        }),
    },
});
