/** @odoo-module **/

import { one, registerPatch } from '@mail/model';

registerPatch({
    name: 'Messaging',
    fields: {
        /**
         * Registers the system singleton 'knowledge' in global messaging
         * singleton.
         */
        knowledge: one('Knowledge', {
            default: {},
            readonly: true,
            required: true,
        }),
    },
});
