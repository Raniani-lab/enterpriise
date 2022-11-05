/** @odoo-module **/

import { one, Patch } from '@mail/model';

Patch({
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
