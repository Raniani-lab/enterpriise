/** @odoo-module **/

import { one, Model } from '@mail/model';

/**
 * Models specifically the remove action in the emoji picker.
 */
 Model({
    name: 'KnowledgeEmojiPickerRemoveActionView',
    template: 'mail.KnowledgeEmojiPickerRemoveActionView',
    recordMethods: {
        onClick() {
            this.messaging.knowledge.onClickRemoveEmoji();
        },
    },
    fields: {
        owner: one('EmojiPickerHeaderActionView', {
            identifying: true,
            inverse: 'removeActionView',
        }),
    },
});
