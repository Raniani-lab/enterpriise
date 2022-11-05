/** @odoo-module **/

import { one, registerModel } from '@mail/model';

/**
 * Models specifically the remove action in the emoji picker.
 */
registerModel({
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
