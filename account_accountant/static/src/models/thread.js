/** @odoo-module **/

import { many, Patch } from '@mail/model';

Patch({
    name: 'Thread',
    fields: {
        allAttachments: {
            compute() {
                return this._super().concat(this.extraAttachments);
            },
        },
        /**
         * Determines which attachments have to be displayed on this thread but
         * possibly come from another thread.
         * See `_get_attachment_domains` in python.
         */
        extraAttachments: many('Attachment'),
    },
});
