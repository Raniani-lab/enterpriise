/** @odoo-module **/

import { one, registerPatch } from '@mail/model';

registerPatch({
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
