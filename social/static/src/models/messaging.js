/** @odoo-module **/

import { one, Patch } from '@mail/model';

Patch({
    name: 'Messaging',
    fields: {
        /**
         * Registers the system singleton 'social' in global messaging
         * singleton.
         */
        social: one('Social', {
            default: {},
            readonly: true,
            required: true,
        }),
    },
});
